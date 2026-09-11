import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import { build as bundle } from "esbuild";
import { patchCoreForAsyncNativeBridge } from "./async-native-core-transform.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildRoot = path.join(root, ".build");
const smaliProject = path.join(buildRoot, "smali-project");
const nitronProject = path.join(buildRoot, "nitron-project");
const apktoolJar = path.join(root, "node_modules", "apktool", "bin", "apktool.jar");
const nitronRoot = path.join(root, "node_modules", "nitron");
const templateApk = path.join(nitronRoot, "template", "base.apk");
const cliPath = path.join(nitronRoot, "dist", "cli.js");
const nitronCacheRoot = path.join(buildRoot, "nitron-cache-root");
const nitronAndroidCache = path.join(nitronCacheRoot, ".nitron", "android");
const bundledAapt2 = path.join(root, "node_modules", "aaptjs3", "bin", "x64", "linux", "aapt2");
const packageMeta = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

function resolveBuildSha() {
  const fromEnvironment = String(process.env.GITHUB_SHA || "").trim();
  if (/^[0-9a-f]{7,40}$/i.test(fromEnvironment)) return fromEnvironment.toLowerCase();
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
  const fromGit = String(result.stdout || "").trim();
  return /^[0-9a-f]{7,40}$/i.test(fromGit) ? fromGit.toLowerCase() : "local";
}

const buildSha = resolveBuildSha();
const buildShortSha = buildSha === "local" ? "local" : buildSha.slice(0, 12);
const appVersion = String(packageMeta.version || "0.0.0");

const asyncNativeBridgePlugin = {
  name: "async-native-obd-bridge",
  setup(build) {
    build.onLoad({ filter: /[\\/]src[\\/]core\.js$/ }, args => ({
      contents: patchCoreForAsyncNativeBridge(fs.readFileSync(args.path, "utf8")),
      loader: "js"
    }));
  }
};

for (const required of [apktoolJar, templateApk, cliPath, bundledAapt2]) {
  if (!fs.existsSync(required)) throw new Error(`Puuttuva rakennusriippuvuus: ${required}. Suorita ensin npm install.`);
}

fs.rmSync(buildRoot, { recursive: true, force: true });
fs.mkdirSync(path.join(smaliProject, "smali"), { recursive: true });
fs.cpSync(path.join(root, "native", "smali"), path.join(smaliProject, "smali"), { recursive: true });
fs.writeFileSync(path.join(smaliProject, "apktool.yml"), "version: 2.0.3\napkFileName: base.apk\ndoNotCompress:\n- dex\n", "utf8");

fs.mkdirSync(nitronAndroidCache, { recursive: true });
fs.copyFileSync(bundledAapt2, path.join(nitronAndroidCache, "aapt2"));
fs.chmodSync(path.join(nitronAndroidCache, "aapt2"), 0o755);
const apktoolZip = new AdmZip(apktoolJar);
const frameworkEntry = apktoolZip.getEntry("brut/androlib/android-framework.jar");
if (!frameworkEntry) throw new Error("Apktool-paketista puuttuu Android framework -resurssipaketti");
fs.writeFileSync(path.join(nitronAndroidCache, "android.jar"), frameworkEntry.getData());

console.log(`Build provenance: ${appVersion} · ${buildShortSha}`);
console.log("[1/5] Kootaan Bluetooth Classic + BLE -natiivisillat…");
const smaliBuild = spawnSync("java", ["-jar", apktoolJar, "b", smaliProject, "-o", path.join(buildRoot, "ignored.apk")], {
  cwd: root,
  encoding: "utf8"
});
const dexPath = path.join(smaliProject, "build", "apk", "classes.dex");
if (!fs.existsSync(dexPath)) {
  process.stderr.write(smaliBuild.stdout || "");
  process.stderr.write(smaliBuild.stderr || "");
  throw new Error("classes.dex-tiedoston kokoaminen epäonnistui");
}

console.log("[2/5] Lisätään natiivisilta APK-pohjaan…");
const templateZip = new AdmZip(templateApk);
templateZip.updateFile("classes.dex", fs.readFileSync(dexPath));
templateZip.writeZip(templateApk);

console.log("[3/5] Poistetaan internet-oikeus ja valmistellaan paikallinen Android-rakennus…");
let cliSource = fs.readFileSync(cliPath, "utf8");
const forcedInternet = 'new Set([...config.permissions.map((p) => p.toUpperCase()), "INTERNET"])';
if (cliSource.includes(forcedInternet)) {
  cliSource = cliSource.replace(forcedInternet, "new Set([...config.permissions.map((p) => p.toUpperCase())])");
}
cliSource = cliSource
  .replaceAll('join4(homedir(), ".nitron", "android")', 'join4(process.env.NITRON_CACHE_ROOT || homedir(), ".nitron", "android")')
  .replace('        android:roundIcon="@mipmap/ic_launcher"\n', "")
  .replace('android:usesCleartextTraffic="true"', 'android:usesCleartextTraffic="false"');
fs.writeFileSync(cliPath, cliSource, "utf8");

fs.mkdirSync(nitronProject, { recursive: true });
for (const name of ["app.js", "styles.css", "package.json"]) {
  fs.copyFileSync(path.join(root, name), path.join(nitronProject, name));
}
fs.cpSync(path.join(root, "assets"), path.join(nitronProject, "assets"), { recursive: true });
const bundledHtml = fs.readFileSync(path.join(root, "index.html"), "utf8")
  .replace('<script type="module" src="src/main.js"></script>', '<script src="app.bundle.js"></script>');
fs.writeFileSync(path.join(nitronProject, "index.html"), bundledHtml, "utf8");
const requiredEntries = ["classes.dex", "AndroidManifest.xml", "assets/index.html", "assets/app.bundle.js"];

async function buildVariant(label, minify, filename) {
  console.log(`${label === "debug" ? "[4/5]" : "[5/5]"} Rakennetaan ${label}-APK…`);
  await bundle({
    entryPoints: [path.join(root, "src", "main.js")],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["chrome90"],
    minify,
    plugins: [asyncNativeBridgePlugin],
    banner: { js: `globalThis.__IS220D_BUILD_SHA__=${JSON.stringify(buildShortSha)};` },
    outfile: path.join(nitronProject, "app.bundle.js")
  });
  const smoke = spawnSync(process.execPath, [
    path.join(root, "scripts", "ui-smoke.mjs"),
    path.join(nitronProject, "index.html"),
    path.join(nitronProject, "app.bundle.js")
  ], {
    cwd: root,
    encoding: "utf8"
  });
  if (smoke.status !== 0) {
    process.stderr.write(smoke.stdout || "");
    process.stderr.write(smoke.stderr || "");
    throw new Error(`${label}-APK:n paketoitu käyttöliittymä ei läpäissyt savutestiä`);
  }
  process.stdout.write(smoke.stdout || "");
  const nitron = spawnSync(process.execPath, [cliPath, "build", "--project", nitronProject], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NITRON_CACHE_ROOT: nitronCacheRoot }
  });
  if (nitron.status !== 0) throw new Error(`${label}-APK:n rakennus epäonnistui (exit ${nitron.status})`);
  const generated = path.join(nitronProject, "dist", "app.apk");
  if (!fs.existsSync(generated)) throw new Error(`Nitron ei tuottanut odotettua ${label}-APK-tiedostoa`);
  const output = path.join(root, "dist", filename);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.copyFileSync(generated, output);
  const finalZip = new AdmZip(output);
  for (const entry of requiredEntries) {
    if (!finalZip.getEntry(entry)) throw new Error(`${label}-APK:sta puuttuu ${entry}`);
  }
  const bundleText = finalZip.readAsText("assets/app.bundle.js");
  if (!bundleText.includes(buildShortSha)) throw new Error(`${label}-APK:sta puuttuu build-SHA ${buildShortSha}`);
  if (!bundleText.includes("__PENDING__")) throw new Error(`${label}-APK:sta puuttuu asynkroninen OBD-silta`);
  return output;
}

const debugOutput = await buildVariant("debug", false, "Lexus_OBD-Flex-0.8.1-debug.apk");
const releaseOutput = await buildVariant("release", true, "Lexus_OBD-Flex-0.8.1-release.apk");
const buildInfo = {
  schemaVersion: 1,
  appVersion,
  gitSha: buildSha,
  gitShortSha: buildShortSha,
  outputs: [path.basename(debugOutput), path.basename(releaseOutput)]
};
fs.writeFileSync(path.join(root, "dist", "build-info.json"), `${JSON.stringify(buildInfo, null, 2)}\n`, "utf8");
console.log("Valmiit APK:t:", debugOutput, releaseOutput);
console.log("Build-info:", path.join(root, "dist", "build-info.json"));
