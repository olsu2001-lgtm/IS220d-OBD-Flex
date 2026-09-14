import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { APP_VERSION } from "../src/app-version.js";
import { versionToCode, readVersion, apkNames } from "../scripts/release-version.mjs";
import { appendRelease, assertUnused, createRegistryClient, nextVersion, validateRegistry } from "../scripts/release-registry.mjs";
import { assertArtifactHashes, validateBadging, validateBuildInfo } from "../scripts/verify-release.mjs";

const empty = () => ({ schemaVersion: 1, legacy: { maxVersion: "0.9.2", maxVersionCode: 902 }, releases: [] });
const candidate = (name = "0.9.3") => ({ versionName: name, versionCode: versionToCode(name), packageId: "fi.oliver.is220dobd" });
const record = (name = "0.9.3") => ({ ...candidate(name), gitSha: "a".repeat(40), buildInfoSha256: "b".repeat(64), artifacts: apkNames(name).map(file => ({ file, bytes: 100, sha256: "c".repeat(64) })) });

test("runtime, lockfile and Android build use the one package version", async () => {
  const version = readVersion();
  assert.equal(APP_VERSION, version.versionName);
  delete globalThis.__nitron_captured_config__;
  await import("../app.js");
  const config = globalThis.__nitron_captured_config__;
  assert.ok(config, "Nitron must capture app.init");
  assert.equal(config.version, undefined, "Nitron must obtain the version from package.json");
  assert.equal(config.packageId, version.packageId);
  assertUnused(version, empty());
});

test("duplicate and older releases are rejected across branches and hashes", () => {
  const registry = appendRelease(empty(), record());
  for (const name of ["0.7.8", "0.8.1", "0.9.1", "0.9.2", "0.9.3"]) {
    assert.throws(() => assertUnused(candidate(name), registry), /already used or older/);
  }
  assert.throws(() => appendRelease(registry, { ...record(), gitSha: "d".repeat(40) }), /already used/);
  assert.throws(() => appendRelease(registry, record()), /already used/, "same-commit rebuilds cannot replace a release either");
  assert.doesNotThrow(() => assertUnused(candidate("0.9.4"), registry));
});

test("next version uses the shared maximum, including numeric rollover", () => {
  assert.equal(nextVersion(empty(), "0.7.8"), "0.9.3");
  assert.equal(nextVersion(empty(), "0.9.3"), "0.9.3");
  assert.equal(nextVersion(appendRelease(empty(), record("0.9.99")), "0.9.3"), "0.10.0");
  assert.equal(versionToCode("0.10.0"), 1000);
  for (const name of ["0.9.100", "0.100.0", "0.9.3-test", "0.9.3+1", "00.9.3", "1.2", "210001.0.0", "0.0.0"]) assert.throws(() => versionToCode(name));
});

test("missing, reset or malformed registries block publication", () => {
  for (const registry of [null, {}, { ...empty(), legacy: { maxVersion: "0.6.9", maxVersionCode: 609 } }, { ...empty(), releases: [record(), record()] }]) assert.throws(() => validateRegistry(registry));
});

test("a stale lockfile cannot produce a distributable build", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flex-version-"));
  try {
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ version: "0.9.3" }));
    fs.writeFileSync(path.join(dir, "package-lock.json"), JSON.stringify({ version: "0.9.2", packages: { "": { version: "0.9.2" } } }));
    assert.throws(() => readVersion(dir), /package-lock/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("renaming an old APK cannot satisfy manifest or metadata verification", () => {
  const version = candidate();
  assert.doesNotThrow(() => validateBadging("package: name='fi.oliver.is220dobd' versionCode='903' versionName='0.9.3'", version));
  for (const badging of [
    "package: name='fi.oliver.is220dobd' versionCode='902' versionName='0.9.2'",
    "package: name='fi.oliver.is220dobd' versionCode='902' versionName='0.9.3'",
    "package: name='other.app' versionCode='903' versionName='0.9.3'"
  ]) assert.throws(() => validateBadging(badging, version), /APK manifest/);
  const info = { schemaVersion: 2, appVersion: version.versionName, versionCode: version.versionCode, packageId: version.packageId, gitSha: "a".repeat(40), gitShortSha: "a".repeat(12), outputs: apkNames(version.versionName) };
  assert.doesNotThrow(() => validateBuildInfo(info, version, info.gitSha));
  assert.throws(() => validateBuildInfo(info, version, "b".repeat(40)), /metadata/);
  const original = record().artifacts;
  assertArtifactHashes({ artifacts: original }, original);
  assert.throws(() => assertArtifactHashes({ artifacts: original }, original.map(a => ({ ...a, sha256: "d".repeat(64) }))), /hash mismatch/);
});

test("two simultaneous releases cannot overwrite the shared registry", async () => {
  let registry = empty(), sha = "1".repeat(40), successfulWrites = 0;
  const client = createRegistryClient({ token: "test-only", fetchImpl: async (_url, options) => {
    if (options.method === "GET") return { ok: true, json: async () => ({ sha, encoding: "base64", content: Buffer.from(JSON.stringify(registry)).toString("base64") }) };
    const body = JSON.parse(options.body);
    if (body.sha !== sha) return { ok: false, status: 409 };
    assert.equal(body.branch, "flex-release-registry");
    registry = JSON.parse(Buffer.from(body.content, "base64").toString());
    sha = "2".repeat(40); successfulWrites++;
    return { ok: true, json: async () => ({ content: { sha } }) };
  } });
  const first = await client.read(), second = await client.read();
  const result = await Promise.allSettled([client.register(first, record()), client.register(second, record("0.9.4"))]);
  assert.equal(result.filter(r => r.status === "fulfilled").length, 1);
  assert.match(String(result.find(r => r.status === "rejected").reason), /HTTP 409/);
  assert.equal(successfulWrites, 1);
  assert.equal(registry.releases.length, 1);
});

test("registry unavailability never falls back to an old local version", async () => {
  await assert.rejects(createRegistryClient({ token: "" }).read(), /GITHUB_TOKEN/);
  const client = createRegistryClient({ token: "test-only", fetchImpl: async () => ({ ok: false, status: 503 }) });
  await assert.rejects(client.read(), /HTTP 503/);
});
