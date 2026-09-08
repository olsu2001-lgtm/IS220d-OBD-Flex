# AI development contract

This repository contains **IS220d OBD Flex** only. It is an offline-first,
read-only Android diagnostic application for a Lexus IS220d / XE20 / 2AD-FHV.

## Project identity

- Application name: `IS220d OBD Flex`
- Package ID: `fi.oliver.is220dobd`
- Current baseline: `0.6.9` / versionCode `609`
- `IS220d OBD Classic` is a separate project. Never import, merge or synchronize
  Classic code, transports, versioning or lifecycle into this repository.

## Non-negotiable safety boundary

- Vehicle communication is read-only and fail-closed.
- The only Toyota Read Data requests currently allowed are `217E`, `217F` and
  `212C`, plus their exact raw ISO-TP single-frame forms defined in
  `src/is220d-profile.js`.
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
`docs/PROTOCOL.md`, current source or current regression tests. In particular,
commands from the historical 0.7.x CT 200h or injector experiments are not in
the active IS220d transmit allowlist unless they are separately reintroduced
through a reviewed profile change with matching evidence and tests.

## Change workflow

1. Work on a dedicated branch; do not push an unreviewed change to `main`.
2. Make the smallest change that satisfies the issue.
3. Add or update deterministic tests for every behavior change.
4. Run `npm ci`, `npm test` and `npm run build`.
5. Verify that package ID, version, permissions and command allowlists did not
   change unexpectedly.
6. Describe safety impact, tests and field-verification status in the pull
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
