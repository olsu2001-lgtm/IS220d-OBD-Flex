# AI development contract

This repository contains **IS220d OBD Flex** only. It is an offline-first,
read-only Android diagnostic application for a Lexus IS220d / XE20 / 2AD-FHV.

## Project identity

- Application name: `IS220d OBD Flex`
- Package ID: `fi.oliver.is220dobd`
- Current source version: read `package.json`; never infer it from a branch name,
  chat memory, an APK filename or this document.
- Shared release registry: `releases/registry.json` on branch `flex-release-registry`.
  Read it live before release work; the highest registered source commit identifies
  the latest delivered baseline even when `main` or a development branch differs.
- Required release workflow: read `docs/VERSIONING.md`.
- `IS220d OBD Classic` is a separate project. Never import, merge or synchronize
  Classic code, transports, versioning or lifecycle into this repository.

## AI handoff rules

GitHub is the durable project state. These rules intentionally make it possible
for a less capable or context-poor agent to continue development without relying
on a previous chat transcript.

- Start by reading `AGENTS.md`, `docs/VERSIONING.md`, the live release registry,
  the relevant source and its tests. Do not reconstruct project state from memory.
- A source-only fix **does not reserve or increment an app version**. Keep the
  currently delivered `package.json:version` while developing and reviewing code.
- Use ordinary branches such as `fix/*`, `feat/*` or `work/*` for source work.
  Their pull requests run tests only and must not publish APKs.
- A `release/*` branch is an explicit publication signal. Do not create or rename
  a branch to `release/*` unless the user has explicitly requested a new APK or
  release. Before doing so, run `npm run version:next` and verify the live registry.
- Every delivered APK, including a changed test APK, gets a globally unused
  version. A registered version is immutable and can never be rebuilt with new
  source under the same identifier.
- Keep behavior rules close to the code and lock them with deterministic tests.
  When adding a build-time source transform, make it fail closed on changed
  anchors, make it idempotent and add a marker that the APK build verifies.

## UI/UX development contract

Before changing any user-facing layout, navigation, copy, visual hierarchy or
interaction, read `skills/flex-ui/SKILL.md` and
`docs/FLEX_UI_DESIGN_SYSTEM.md`.

- Treat the Flex UI skill as the default review rubric for all new screens and
  UI changes.
- Keep one obvious primary task per screen/state and use progressive disclosure
  for advanced settings, raw evidence and developer tools.
- Keep persistent navigation small; infrequent functions belong under `Lisää`.
- Interactive targets must be at least 44 × 44 CSS px.
- Never communicate diagnostic state by colour alone.
- Keep measurement availability separate from diagnostic assessment.
- Use existing theme variables; do not introduce one-off hard-coded feature
  colours.
- Preserve safe-area handling and deterministic UI guardrail tests.

The design system governs presentation only. It never overrides the safety,
protocol or evidence boundaries below.

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

## vLinker Android connection invariants

- For vLinker MC / MC+, Android Bluetooth Classic/SPP (`vLinker MC` or
  `vLinker MC-Android`) is the primary route. The documented pairing PIN in the
  current UI guidance is `1234`.
- `vLinker MC-IOS` is a BLE advertisement/route. Seeing it does not prove that
  the Android Classic bond exists or is healthy.
- If MC-IOS is visible but no bonded Classic vLinker is returned, present this as
  a Classic-pairing recovery condition. Do not silently treat BLE as a replacement
  for a lost Classic bond.
- Persist the automatic device/transport preference only **after** the adapter
  protocol has initialized successfully. A failed GATT/ELM attempt must never
  overwrite the last known-good route.
- Connection-stage UI must distinguish radio/GATT success from ELM327 success.
  If GATT opened but ELM initialization failed and the transport was closed, the
  Bluetooth stage must not remain falsely green.
- The packaged behavior is applied by
  `scripts/vlinker-recovery-main-transform.mjs`; its regression tests are in
  `tests/vlinker-recovery-build.test.mjs`.

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

1. Read the live registry and identify the latest delivered source commit. Start
   source work from that baseline or explicitly reconcile any later unshipped work.
2. Work on a dedicated non-release branch. Do not bump `package.json:version`
   merely to develop, review or test source code.
3. Make the smallest change that satisfies the issue and add deterministic tests.
4. Run `npm ci` and `npm test`. A normal source PR is expected to stop here; CI
   intentionally does not build or register an APK from `fix/*`, `feat/*` or
   `work/*` branches.
5. When and only when the user requests a new APK/delivery, read the live registry
   again, run `npm run version:next`, commit the version/lockfile change and use a
   `release/*` branch (or an explicitly authorized manual publish dispatch).
6. The release path runs `npm run release:check`, `npm run build`, APK verification
   and `npm run release:register`. Any registry/network/version conflict blocks
   delivery. Never bypass the live registry or rename old APK bytes.
7. Verify package ID, version, permissions, command allowlists, source SHA and APK
   hashes. Deliver only the exact registered APK bytes.
8. Describe behavior, tests and field-verification status in the pull request.
   Simulated success is not vehicle verification.

## Evidence policy

- Production values require vehicle-verified evidence.
- Techstream-derived values may be implemented only behind explicit validation
  and must remain labelled until confirmed on the vehicle.
- Research candidates must not enter live data or a transmit allowlist.
- Every published value needs its source ECU, unit, decoder, plausible range and
  evidence level.

## Completion criteria

A source change is ready for review when deterministic tests pass, safety tests
remain green and documentation matches behavior. A release is complete only when
both APK variants also build and verify, the exact hashes are registered, and no
generated files or signing secrets are committed.
