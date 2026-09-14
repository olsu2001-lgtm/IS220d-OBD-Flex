# AI development contract

This repository contains **IS220d OBD Flex** only. It is an offline-first,
read-only Android diagnostic application for a Lexus IS220d / XE20 / 2AD-FHV.

## Project identity

- Application name: `IS220d OBD Flex`
- Package ID: `fi.oliver.is220dobd`
- Current version: read `package.json`; never infer it from a branch name or this document.
- Shared release registry: `releases/registry.json` on branch `flex-release-registry`.
  Read it live at the start of every update; the highest registered source commit
  identifies the latest delivered baseline even when `main` is older.
- Required release workflow: read `docs/VERSIONING.md`.
- `IS220d OBD Classic` is a separate project. Never import, merge or synchronize
  Classic code, transports, versioning or lifecycle into this repository.

## Non-negotiable safety boundary

- Vehicle communication is read-only and fail-closed.
- Normal IS220d production live data allows `217E`, `217F` and `212C`,
  plus their exact raw ISO-TP single-frame forms in `src/is220d-profile.js`.
- The evidence-labelled `2193`, `2196` and `21AF` reads remain outside
  normal live polling. The field-rejected `219C` request must fail before
  transport until a correct Techstream Data List transaction is verified.
- Never add guessed PIDs, identifiers, byte layouts or conversion formulas.
- Never add Mode 04, DTC clearing, Active Test, forced DPF/DPNR regeneration,
  immobilizer/key functions, security access, coding, programming or ECU writes.
- Never add a free-form command or hexadecimal terminal.
- Unknown data remains raw and must not be presented as a verified measurement.
- Keep Quicklynks FFF0/FFF6 binary transport separate from ASCII ELM327,
  vLinker Classic/SPP and BLE ISO-TP paths.
- Do not add `android.permission.INTERNET`; keep cleartext traffic disabled.

Read `docs/SAFETY.md` and `docs/PROTOCOL.md` before changing any transport,
profile, parser, measurement or Android bridge code.

## Imported Drive evidence

The project Drive has been reconciled into the versioned evidence index under
`docs/README.md`. Read it when historical design, field captures, archived
builds or vehicle identity matter to a task.

- `docs/VEHICLE_EVIDENCE.md` records target-vehicle identity and calibration
  evidence.
- `docs/FIELD_EVIDENCE.md` records sanitized real-device/transport findings.
- `docs/DRIVE_ARCHIVE.md` records what remains in Drive and why.
- `docs/HISTORICAL_0_7_X.md` records the older multi-vehicle `Lexus OBD Flex`
  0.7.x line.
- `docs/DEVELOPMENT_STUDY_2026-08-11.md` preserves the older development-study
  architecture and roadmap.

Historical evidence never overrides this contract, `docs/SAFETY.md`,
`docs/PROTOCOL.md`, current source or current regression tests. The application
retains reviewed read-only multi-vehicle workflows, the field-disabled
injector transaction and the GSIC-grounded DPNR hose-cleaning before/after test
with explicit profile separation, evidence labels and matching tests.

## Change workflow

1. Read the shared release registry from `flex-release-registry`, inspect the
   FLEX app Drive folder and CI history, and start from the latest delivered
   source commit. Never start from an older default branch without reconciling
   newer work. Run `npm run version:next` to select an unused version from the
   shared maximum. Only `package.json:version` is editable; the lockfile is
   synchronized by that command. Never reuse a distributed version, even for a
   different branch, retry, filename, commit or variant.
2. Work on a dedicated branch; do not push an unreviewed change to `main`.
3. Make the smallest change that satisfies the issue.
4. Add or update deterministic tests for every behavior change.
5. Run `npm ci`, `npm test` and `npm run build`.
6. Verify that package ID, version, permissions and command allowlists did not
   change unexpectedly.
7. Run `npm run release:register` after APK verification and before distributing
   any APK. CI does this automatically before artifact upload. A registry/network
   error blocks delivery; never use a cached ledger, force an update or rename an
   old APK to bypass it. Registered APKs are immutable; reuse the exact bytes or
   select a new version. Never change the registry branch from feature code.
8. Describe safety impact, tests and field-verification status in the pull
   request. Simulated success is not vehicle verification.

## Evidence policy

- Production values require vehicle-verified evidence.
- Techstream-derived values may be implemented only behind explicit validation
  and must remain labelled until confirmed on the vehicle.
- Research candidates must not enter live data or a transmit allowlist.
- Every published value needs its source ECU, unit, decoder, plausible range and
  evidence level.

## Completion criteria

A change is complete only when all tests pass, both APK variants build, safety
tests remain green, documentation matches behavior and no generated files or
signing secrets are committed.
