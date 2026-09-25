import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import { ROOT, readVersion, apkNames, sourceSha } from "./release-version.mjs";
import { assertUnused, createRegistryClient } from "./release-registry.mjs";
import { verifyPackagedWebStyles } from "./web-assets.mjs";

export function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

export function validateBuildInfo(info, version, gitSha) {
  if (info.schemaVersion !== 2 || info.appVersion !== version.versionName
      || info.versionCode !== version.versionCode || info.packageId !== version.packageId
      || info.gitSha !== gitSha || info.gitShortSha !== gitSha.slice(0, 12)
      || JSON.stringify(info.outputs) !== JSON.stringify(apkNames(version.versionName))) {
    throw new Error("Build metadata does not match the version and source being released");
  }
}

export function validateBadging(badging, version) {
  const line = String(badging).split("\n").find(value => value.startsWith("package: ")) || "";
  const fields = Object.fromEntries([...line.matchAll(/(\w+)='([^']*)'/g)].map(m => [m[1], m[2]]));
  if (fields.name !== version.packageId || fields.versionName !== version.versionName
      || fields.versionCode !== String(version.versionCode)) {
    throw new Error("APK manifest has a different package, versionName or versionCode");
  }
  if (badging.includes("android.permission.INTERNET")) throw new Error("APK must remain offline");
}

export function assertArtifactHashes(info, artifacts) {
  if (JSON.stringify(info.artifacts) !== JSON.stringify(artifacts)) {
    throw new Error("APK hash mismatch: stale or replaced build output");
  }
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout: 120000 });
  if (result.status !== 0) throw new Error(`${path.basename(command)} verification failed: ${result.stderr || result.error || result.status}`);
  return result.stdout;
}

function androidTool(name) {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (sdk && fs.existsSync(path.join(sdk, "build-tools"))) {
    const versions = fs.readdirSync(path.join(sdk, "build-tools")).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const version of versions) {
      const tool = path.join(sdk, "build-tools", version, name);
      if (fs.existsSync(tool)) return tool;
    }
  }
  if (name === "aapt2") return path.join(ROOT, "node_modules/aaptjs3/bin/x64/linux/aapt2");
  return name;
}

export function verifyArtifacts() {
  const version = readVersion();
  const gitSha = sourceSha();
  const dist = path.join(ROOT, "dist");
  const infoBytes = fs.readFileSync(path.join(dist, "build-info.json"));
  const info = JSON.parse(infoBytes);
  validateBuildInfo(info, version, gitSha);
  const actualNames = fs.readdirSync(dist).filter(file => file.endsWith(".apk")).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(apkNames(version.versionName).sort())) {
    throw new Error("Unexpected APKs in dist; clean the output instead of renaming old APKs");
  }
  const artifacts = apkNames(version.versionName).map(file => {
    const apk = path.join(dist, file);
    const bytes = fs.readFileSync(apk);
    const zip = new AdmZip(bytes);
    verifyPackagedWebStyles(zip, ROOT);
    for (const entry of ["AndroidManifest.xml", "classes.dex", "assets/index.html", "assets/app.bundle.js", "assets/flex-version.json"]) {
      if (!zip.getEntry(entry)) throw new Error(`Missing ${entry} in ${file}`);
    }
    const embedded = JSON.parse(zip.readAsText("assets/flex-version.json"));
    if (JSON.stringify(embedded) !== JSON.stringify({ ...version, gitSha })) throw new Error("Embedded APK version differs from source");
    validateBadging(run(androidTool("aapt2"), ["dump", "badging", apk]), version);
    run(androidTool("apksigner"), ["verify", "--verbose", "--print-certs", apk]);
    run("unzip", ["-t", apk]);
    const bundle = zip.readAsText("assets/app.bundle.js");
    if (!bundle.includes(gitSha.slice(0, 12))) throw new Error("APK bundle has a different source commit");
    return { file, bytes: bytes.length, sha256: sha256(bytes) };
  });
  assertArtifactHashes(info, artifacts);
  return { ...version, gitSha, artifacts, buildInfoSha256: sha256(infoBytes) };
}

export async function runReleaseCommand(command) {
  const client = createRegistryClient();
  if (command === "check") {
    const { registry } = await client.read();
    assertUnused(readVersion(), registry);
    console.log(`Unused version verified: ${readVersion().versionName}`);
    return;
  }
  const release = verifyArtifacts();
  if (command === "verify") { console.log(`Verified both APKs: ${release.versionName}`); return; }
  if (command !== "register") throw new Error("Expected check, verify or register");
  const snapshot = await client.read();
  const record = { ...release, registeredAt: new Date().toISOString(), buildRunUrl: process.env.GITHUB_RUN_ID ? `https://github.com/olsu2001-lgtm/IS220d-OBD-Flex/actions/runs/${process.env.GITHUB_RUN_ID}` : null };
  await client.register(snapshot, record);
  const { registry } = await client.read();
  if (JSON.stringify(registry.releases.find(r => r.versionName === release.versionName)) !== JSON.stringify(record)) {
    throw new Error("Registration readback mismatch; do not publish");
  }
  fs.writeFileSync(path.join(ROOT, "dist", "release-registration.json"), `${JSON.stringify(record, null, 2)}\n`);
  console.log(`Registered Flex ${release.versionName} / ${release.versionCode}; APK hashes are now immutable`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runReleaseCommand(process.argv[2]);
}
