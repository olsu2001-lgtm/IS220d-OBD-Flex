# Flex release versioning

`package.json:version` is the only editable app version. Nitron reads it for the
Android manifest; the runtime imports it for the visible version and reports;
the build derives filenames and metadata from it. `npm run version:next` also
updates both package-lock version entries. Do not add historical version strings
to app config merely to satisfy old tests.

## Authoritative state

All source branches share `releases/registry.json` on branch
[`flex-release-registry`](https://github.com/olsu2001-lgtm/IS220d-OBD-Flex/blob/flex-release-registry/releases/registry.json).
That branch contains release metadata, not development source. Never merge it
into a source branch, reset it, lower its version floor or recreate it on failure.
The latest record includes the exact delivered source commit and both APK hashes.
Start new work from that source, reconciling later unshipped changes explicitly.
Do not assume `main`, a version in a branch name or an archived ZIP is current.

Historical identifiers through **0.9.2 / 902** are closed permanently. The
bootstrap evidence is the Drive 0.9.2-CI229 archive and successful CI229 at commit
`40fc602b74877e659170341418840f2c49e22a29`. The historical floor does not claim
that every possible lower number was published or that legacy duplicate APKs
have been individually hashed. Original legacy files remain unchanged.

## Development without delivery

Source development and version allocation are separate operations.

- A normal `fix/*`, `feat/*` or `work/*` branch keeps the currently delivered
  `package.json:version`. It may contain new source and tests without reserving a
  release identifier.
- Pull requests from ordinary development branches run regression/safety tests
  only. They do not build, register or upload APKs.
- It is therefore normal for a development branch to contain a package version
  that is already present in the release registry. `npm run build` remains
  fail-closed in that state and must not be bypassed.
- Allocate a new version only when the user explicitly requests a changed APK or
  release. At that point reread the live registry and run `npm run version:next`.
- Use a `release/*` branch only for deliberate APK publication. The CI workflow
  treats that prefix as publication intent. A manual workflow dispatch publishes
  only when its `publish` input is explicitly true.

This split lets agents develop and review code without burning version numbers,
while every delivered binary still receives a unique immutable identity.

## Release workflow

1. Read the live registry, latest CI history and FLEX app Drive folder. Select the
   latest delivered source commit and reconcile any later unshipped source work.
2. On a normal development branch, implement the change, update documentation and
   run `npm ci` plus `npm test`. Do **not** run `version:next` just to develop or
   review source code.
3. When an APK delivery is explicitly requested, reread the live registry, run
   `npm run version:next`, commit both package files and use a `release/*` branch
   (or an explicitly authorized manual publish dispatch). The command chooses an
   unused version from the global maximum, including releases from other branches.
4. Release CI checks out the **head commit**, checks the live registry, builds both
   APKs from clean output directories, runs the UI smoke test and verifies the
   manifest, package identity, signature, source and SHA-256 hashes.
5. CI runs `npm run release:register`, rereading the registry and atomically
   appending a record with the existing GitHub blob SHA. A concurrent publication
   causes a conflict and blocks upload. Only then is the artifact uploaded.
6. Deliver the exact registered release APK to the FLEX app Drive folder. Keep
   `build-info.json` and `release-registration.json` with the build archive. Verify
   the APK hash against the live registry before delivery; never infer its version
   from the outer ZIP name. Report versionName, versionCode and source commit.

`npm run build` enforces the live registry check locally. If the current package
version is already registered, that failure is intentional: keep testing source
with `npm test` until a new delivery has actually been requested. Without
authorized registry access a release build also fails closed. Never introduce an
offline bypass. `npm run release:verify` checks already built files; it does not
register or approve publication. GitHub access is a build-time operation, never an
Android permission.

## Retries and version ordering

- Every changed delivery needs a new version, including test APK deliveries.
- Source-only commits and test-only pull requests do not consume versions.
- Once registered, an identifier is consumed. A rerun cannot replace it, even for
  the same source commit. Retrieve the existing artifact or prepare a new version.
  If upload failed after registration, the version remains consumed.
- A failed build before registration can be fixed and retried if no artifact has
  been distributed. Never upload a partial build.
- Main-branch merge pushes run regression tests without publishing another APK;
  the previously registered APK remains the release artifact.
- Encoding remains compatible with Nitron: `major*10000 + minor*100 + patch`.
  Minor/patch are restricted to 0..99 to prevent collisions. The next version
  after 0.9.99 is 0.10.0; Android codes strictly increase. Prerelease suffixes
  are rejected rather than silently being converted into a reused code.
- Historical Drive duplicates are identified by their original filenames,
  timestamps and checksums when examined; do not rename their internal versions.

## Validation boundary

Tests exercise duplicate/older versions, stale lockfiles, mismatched APK metadata,
replaced hashes, concurrent registration and unavailable registry access. Both
APK variants are verified after compilation, including the visible UI version.
These checks establish artifact identity; they are not a vehicle field test.
