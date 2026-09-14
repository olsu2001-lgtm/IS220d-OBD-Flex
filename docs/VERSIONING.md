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

## Workflow

1. Read the live registry, latest CI runs and FLEX app Drive folder. Select the
   latest delivered source commit, then create a dedicated development branch.
2. Run `npm run version:next` with a GitHub token authorized to read this private
   repository. It uses the global maximum, including releases from other branches.
   A prepared unused version is retained; the registry is rechecked at publication.
3. Implement the change, update the changelog, run `npm ci` and `npm test`, and
   commit all source changes. Do not distribute from a dirty checkout.
4. Open a pull request. CI checks out the **head commit**, checks the live registry,
   builds both APKs from clean output directories, runs the UI smoke test and
   verifies the manifest, package identity, signature, source and SHA-256 hashes.
5. CI runs `npm run release:register`, rereading the registry and atomically
   appending a record with the existing GitHub blob SHA. A concurrent publication
   causes a conflict and blocks upload. Only then is the artifact uploaded.
6. Deliver the exact registered release APK to the FLEX app Drive folder. Keep
   `build-info.json` and `release-registration.json` with the build archive. Verify
   the APK hash against the live registry before delivery; never infer its version
   from the outer ZIP name. Report versionName, versionCode and source commit.

`npm run build` also enforces the live registry check locally. Without authorized
registry access it fails closed; use CI rather than introducing an offline bypass.
`npm run release:verify` checks already built files; it does not register or approve
publication. GitHub access is a build-time operation, never an Android permission.

## Retries and version ordering

- Every changed delivery needs a new version, including test APK deliveries.
- Once registered, that identifier is consumed. A rerun cannot replace it, even
  for the same source commit. Retrieve the existing artifact or prepare a new
  version. If upload failed after registration, the version remains consumed.
- A failed build before registration can be fixed and retried; no artifact has
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
