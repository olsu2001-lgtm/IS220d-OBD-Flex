import { versionToCode, apkNames, PACKAGE_ID } from "./release-version.mjs";

export const REPOSITORY = "olsu2001-lgtm/IS220d-OBD-Flex";
export const REGISTRY_BRANCH = "flex-release-registry";
export const REGISTRY_PATH = "releases/registry.json";
export const LEGACY_FLOOR = 902;

export function validateRegistry(registry) {
  if (registry?.schemaVersion !== 1 || !Number.isInteger(registry.legacy?.maxVersionCode)
      || registry.legacy.maxVersionCode < LEGACY_FLOOR || !Array.isArray(registry.releases)) {
    throw new Error("Missing or invalid shared release registry; publication is blocked");
  }
  if (versionToCode(registry.legacy.maxVersion) !== registry.legacy.maxVersionCode) {
    throw new Error("Invalid historical version floor");
  }
  let maximum = registry.legacy.maxVersionCode;
  for (const release of registry.releases) {
    if (versionToCode(release.versionName) !== release.versionCode || release.versionCode <= maximum
        || !/^[a-f0-9]{40}$/.test(release.gitSha) || !/^[a-f0-9]{64}$/.test(release.buildInfoSha256)
        || release.packageId !== PACKAGE_ID
        || release.artifacts?.length !== 2
        || JSON.stringify(release.artifacts.map(a => a.file)) !== JSON.stringify(apkNames(release.versionName))
        || release.artifacts.some(a => !/^[a-f0-9]{64}$/.test(a.sha256) || !Number.isSafeInteger(a.bytes) || a.bytes < 1)) {
      throw new Error("Inconsistent release registry; publication is blocked");
    }
    maximum = release.versionCode;
  }
  return maximum;
}

export function assertUnused(version, registry) {
  const maximum = validateRegistry(registry);
  const code = versionToCode(version.versionName);
  if (code !== version.versionCode || code <= maximum) {
    throw new Error(`Version ${version.versionName} / ${version.versionCode} is already used or older than registry maximum ${maximum}`);
  }
}

export function nextVersion(registry, currentVersion) {
  const maximum = validateRegistry(registry);
  // Preserve an already prepared, unused local version on repeated invocation.
  if (versionToCode(currentVersion) > maximum) return currentVersion;
  const next = maximum + 1;
  const name = `${Math.floor(next / 10000)}.${Math.floor(next / 100) % 100}.${next % 100}`;
  versionToCode(name);
  return name;
}

export function appendRelease(registry, release) {
  assertUnused(release, registry);
  const updated = { ...registry, releases: [...registry.releases, release] };
  validateRegistry(updated);
  return updated;
}

export function createRegistryClient({ token = process.env.GITHUB_TOKEN, fetchImpl = fetch } = {}) {
  async function request(method, suffix, body) {
    if (!token) throw new Error("GITHUB_TOKEN is required to check the shared Flex registry; use GitHub Actions");
    const response = await fetchImpl(`https://api.github.com/repos/${REPOSITORY}/${suffix}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error(`Release registry ${method} failed (HTTP ${response.status}); do not retry with force or publish artifacts`);
    return response.json();
  }
  return {
    async read() {
      const file = await request("GET", `contents/${REGISTRY_PATH}?ref=${REGISTRY_BRANCH}`);
      if (file.encoding !== "base64" || !/^[a-f0-9]{40}$/.test(file.sha)) throw new Error("Invalid registry response");
      const registry = JSON.parse(Buffer.from(file.content, "base64").toString("utf8"));
      validateRegistry(registry);
      return { registry, sha: file.sha };
    },
    async register(snapshot, release) {
      const updated = appendRelease(snapshot.registry, release);
      // Contents API's blob SHA is a compare-and-swap: another branch publishing
      // between read and write causes HTTP 409/422, never an overwrite.
      return request("PUT", `contents/${REGISTRY_PATH}`, {
        branch: REGISTRY_BRANCH,
        sha: snapshot.sha,
        message: `Register Flex ${release.versionName} (${release.gitSha.slice(0, 12)})`,
        content: Buffer.from(`${JSON.stringify(updated, null, 2)}\n`).toString("base64")
      });
    }
  };
}
