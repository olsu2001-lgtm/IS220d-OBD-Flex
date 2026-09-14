import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const packageMeta = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const appVersion = String(packageMeta.version || "").trim();

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(appVersion)) {
  throw new Error(`Virheellinen sovellusversio package.json:ssa: ${appVersion || "(tyhjä)"}`);
}

const outputs = [];
for (const variant of ["debug", "release"]) {
  const desiredName = `Lexus_OBD-Flex-${appVersion}-${variant}.apk`;
  const desiredPath = path.join(dist, desiredName);

  if (!fs.existsSync(desiredPath)) {
    const legacyName = `Lexus_OBD-Flex-0.9.1-${variant}.apk`;
    const legacyPath = path.join(dist, legacyName);
    if (!fs.existsSync(legacyPath)) {
      throw new Error(`Buildistä puuttuu ${variant}-APK: ${desiredName}`);
    }
    fs.renameSync(legacyPath, desiredPath);
  }

  outputs.push(desiredName);
}

const buildInfoPath = path.join(dist, "build-info.json");
if (!fs.existsSync(buildInfoPath)) throw new Error("Build-info puuttuu");
const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, "utf8"));
buildInfo.appVersion = appVersion;
buildInfo.outputs = outputs;
fs.writeFileSync(buildInfoPath, `${JSON.stringify(buildInfo, null, 2)}\n`, "utf8");

console.log(`Julkaisun APK-nimet normalisoitu versiolle ${appVersion}: ${outputs.join(", ")}`);
