# Diagnostic Test Lab

Source-only work. This module does not create a release or add new vehicle commands.

## Purpose

Diagnostic Test Lab visualizes the OBD evidence chain for every reviewed `Bom-kaapija / Vikadiag_kohteet` row that is not `physical-only`.

The first reference case is Drive row 5, DPNR differential-pressure sensor. The same UI/model is shared by direct, indirect and evidence-pending OBD diagnostic items.

## Pipeline shown in the UI

1. Drive / test definition
2. Evidence and production authorization
3. Read request attempted
4. Positive ECU response observed
5. Decoder configured
6. Component evidence coverage

The UI identifies the first useful gap without converting a data-availability result into a component health verdict.

## Data sources

- `src/is220d-vikadiag-obd-test-catalog.js`: reviewed Drive rows, readiness, recipes, missing evidence and component identity.
- `src/is220d-diagnostic-signals.js`: named signal identity, expected response prefix, decoder, evidence and authorization.
- stored BOM component diagnostic coverage: whether those signals were attempted/observed in the latest collected diagnostic evidence.
- `src/is220d-obd-diagnostic-visuals.js`: only already packaged original RM0150 workshop-manual figures.

## Running the shared coverage test

The Test Lab contains an **Aja yhteinen OBD-kattavuustesti** control. It does not implement a second transport. The controller delegates to the already existing `#bomDiagnosticRun` component-diagnostic control, which runs Flex's established read-only diagnostic path and production allowlist.

When the BOM diagnostic coverage badge changes after a completed run, the Test Lab requests a refresh and rebuilds the visual request/response/component states from the stored coverage. Replacing the Test Lab root also reattaches the controller without duplicating the vehicle transport.

If the existing BOM diagnostic is disabled, the Test Lab does not attempt a fallback native call. It reports that the shared diagnostic is unavailable and waits for the normal Flex connection/test state.

## Safety boundary

Phase 1 itself is transport-free. The Test Lab does not create or transmit OBD commands. It visualizes command identities that are already in the production signal registry and evidence already collected by Flex; its run control delegates only to the existing BOM diagnostic runner.

`needs-signal-verification` and `blocked` rows are visible because they are important diagnostic gaps, but they are not runnable. `physical-only` rows are excluded from the OBD Test Lab. Field-rejected `219C` can never make an item runnable.

No Active Test, forced regeneration, DTC clear, ECU write, coding, programming or security access is introduced.

## DPNR reference

For the DPNR pressure sensor the visual identity is:

- request identity `217E`
- positive response prefix `617E`
- decoder `toyota-2ad-fhv-217e-v1`

The actual dedicated DPNR capture remains in the existing production read-only path. The Test Lab links to that existing page rather than implementing a second transport.

## Next phase

The next live-runner phase can provide per-item execution and operating-state guidance for production-authorized signals through the existing `Elm327Client` / vehicle-profile allowlist and feed its results back to this same visual model. It must not call the native bridge directly or invent transport definitions from catalog metadata.

Until that phase is implemented and field-tested, `source/test verified` and `field verified` remain separate states.
