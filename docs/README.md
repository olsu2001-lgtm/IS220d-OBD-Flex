# IS220d OBD Flex documentation

This directory separates the **active development contract** from historical Drive material and field evidence.

## Authoritative current documents

1. [`../AGENTS.md`](../AGENTS.md) — AI/development contract and current project identity.
2. [`SAFETY.md`](SAFETY.md) — current fail-closed, read-only safety model.
3. [`PROTOCOL.md`](PROTOCOL.md) — current verified IS220d production protocol profile and Toyota allowlist.
4. [`ECU_SURVEY.md`](ECU_SURVEY.md) — current read-only ECU Survey policy/data-model foundation and integration boundary.
5. [`MODE09_IDENTITY.md`](MODE09_IDENTITY.md) — parsing and evidence-comparison boundary for VIN, Calibration ID, CVN and ECU-name results already collected by the wide diagnostic.
6. [`FIELD_VALIDATION.md`](FIELD_VALIDATION.md) — commit-traceable three-run real-car validation gate for the unified 0.8.0 field-test line.
7. [`FIELD_TEST_MODE.md`](FIELD_TEST_MODE.md) — guided one-run-at-a-time UI wrapper for collecting the three matching validation runs with an explicit engine state.
8. [`TECHSTREAM_REFERENCE.md`](TECHSTREAM_REFERENCE.md) — neutral external-reference schema and explicit Techstream/ECU Survey comparison boundary.
9. [`EVIDENCE_SUPPORT_BUNDLE.md`](EVIDENCE_SUPPORT_BUNDLE.md) — compact privacy-bounded JSON export for field-validation/support analysis without raw CAN/ELM data.
10. Executable source and regression tests — the final source of truth for shipped behavior.
11. [`FLEX_UI_DESIGN_SYSTEM.md`](FLEX_UI_DESIGN_SYSTEM.md) and
    [`../skills/flex-ui/SKILL.md`](../skills/flex-ui/SKILL.md) — mobile UI review contract.

Historical documents never expand the active command allowlist by themselves.

## Current implementation roadmaps

- [`BOM_DIAGNOSTICS_ROADMAP.md`](BOM_DIAGNOSTICS_ROADMAP.md) — phased plan for importing all DIRECT/INDIRECT `Bom-kaapija` diagnostic targets, separating BOM data from signal authorization, adding component assessment rules, physical-location diagnostic groups, Techstream gap closure and field-validation gates.

Roadmaps describe intended work. They do not override the development contract, protocol allowlist, current source or tests.

## Imported / reconciled project evidence

- [`VEHICLE_EVIDENCE.md`](VEHICLE_EVIDENCE.md) — target IS220d ECU/bus/calibration evidence from the project Drive.
- [`FIELD_EVIDENCE.md`](FIELD_EVIDENCE.md) — useful real-device and diagnostic observations retained from the older Flex work.
- [`DRIVE_ARCHIVE.md`](DRIVE_ARCHIVE.md) — inventory of relevant Drive artifacts and the Git migration decision for each class of artifact.
- [`HISTORICAL_0_7_X.md`](HISTORICAL_0_7_X.md) — the August 2026 multi-vehicle `Lexus OBD Flex` 0.7.x branch, kept as historical evidence rather than the current baseline.
- [`DEVELOPMENT_STUDY_2026-08-11.md`](DEVELOPMENT_STUDY_2026-08-11.md) — source-faithful digest of the 40-page Drive development study, reconciled against the current read-only repository policy.

## Authority rule for future development

When historical Drive material conflicts with the current repository, use this order:

1. `AGENTS.md`, `SAFETY.md` and `PROTOCOL.md`.
2. Current source code and tests.
3. Vehicle-verified field evidence.
4. Techstream-derived evidence explicitly marked as pending vehicle confirmation.
5. Historical plans and experimental branches.

The archived 0.7.x branch and the August development study contain useful design and test evidence, but they do not authorize CT 200h commands, service operations, coding, Active Tests, DTC clearing or ECU writes in the current IS220d-only project.
