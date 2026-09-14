import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PACKAGE_ID = "fi.oliver.is220dobd";

export function versionToCode(version) {
  if (typeof version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error(`Use a numeric major.minor.patch version: ${version}`);
  }
  const [major, minor, patch] = version.split(".").map(Number);
  const code = major * 10000 + minor * 100 + patch;
  // Nitron uses this encoding. Bound both fields to prevent collisions such
  // as 0.9.100 == 0.10.0 and reject prereleases instead of silently parsing them.
  if (minor > 99 || patch > 99 || !Number.isSafeInteger(code) || code < 1 || code > 2100000000) {
    throw new Error(`Version cannot be encoded safely for Android: ${version}`);
  }
  return code;
}

export function readVersion(root = ROOT) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
  if (lock.version !== pkg.version || lock.packages?.[""]?.version !== pkg.version) {
    throw new Error("package-lock.json version differs; use npm run version:next");
  }
  return { versionName: pkg.version, versionCode: versionToCode(pkg.version), packageId: PACKAGE_ID };
}

export function apkNames(version) {
  versionToCode(version);
  return ["debug", "release"].map(variant => `Lexus_OBD-Flex-${version}-${variant}.apk`);
}

export function sourceSha(root = ROOT) {
  const git = args => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`Cannot verify Git source: ${args[0]}`);
    return result.stdout.trim();
  };
  const sha = git(["rev-parse", "HEAD"]);
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error("A full source commit is required");
  if (git(["status", "--porcelain", "--untracked-files=normal"])) {
    throw new Error("Commit source changes before building a distributable APK");
  }
  const expectedSha = process.env.FLEX_SOURCE_SHA || process.env.GITHUB_SHA;
  if (expectedSha && expectedSha !== sha) {
    throw new Error("Checkout must match the expected source commit, including on pull requests");
  }
  return sha;
}
