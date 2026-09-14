import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./release-version.mjs";
import { createRegistryClient, nextVersion } from "./release-registry.mjs";

const { registry } = await createRegistryClient().read();
const pkgPath = path.join(ROOT, "package.json");
const lockPath = path.join(ROOT, "package-lock.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
const version = nextVersion(registry, pkg.version);
pkg.version = lock.version = lock.packages[""].version = version;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
console.log(`Prepared Flex ${version}. Commit the change; publication checks the registry again.`);
