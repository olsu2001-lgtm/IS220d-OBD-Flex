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

## Per-item focus runner

Runnable generic Test Lab cards now expose **Aja tämän kohteen OBD-evidenssi**. This is deliberately a focus runner, not a second or selectively synthesized vehicle transport.

The action:

1. verifies that the existing `#bomDiagnosticRun` production runner is currently available;
2. remembers the selected component;
3. delegates the vehicle work to that existing read-only BOM coverage runner;
4. waits for the normal BOM coverage refresh;
5. rebuilds the Test Lab from stored coverage and highlights the selected component's updated request/response/evidence chain.

This means the current per-item action may collect the shared BOM diagnostic coverage rather than transmitting only the selected card's signals. The UI states this explicitly. Catalog metadata is never converted directly into native commands.

Rows that are not runnable never receive a per-item action. Repeated controller attachment does not duplicate buttons or vehicle-run clicks. If the shared production runner is unavailable, the per-item action fails closed and sends nothing.

DPNR is intentionally excluded from the generic per-item focus action because it already has a dedicated guided `217E` / `617E` capture path. The Test Lab continues to open that existing DPNR test instead of replacing it with the shared coverage runner.

## Safety boundary

The Test Lab controller remains transport-free. It does not create or transmit OBD commands itself. It visualizes command identities already in the production signal registry and evidence already collected by Flex; all vehicle work is delegated to existing production runners.

`needs-signal-verification` and `blocked` rows are visible because they are important diagnostic gaps, but they are not runnable. `physical-only` rows are excluded from the OBD Test Lab. Field-rejected `219C` can never make an item runnable.

No Active Test, forced regeneration, DTC clear, ECU write, coding, programming or security access is introduced.

## DPNR reference

For the DPNR pressure sensor the visual identity is:

- request identity `217E`
- positive response prefix `617E`
- decoder `toyota-2ad-fhv-217e-v1`

The actual dedicated DPNR capture remains in the existing production read-only path. The Test Lab links to that existing page rather than implementing a second transport.

## Next phase

A later true selective runner can reduce a component test to only the registry-approved signals needed by that item, but it must be implemented inside the existing diagnostic/`Elm327Client`/vehicle-profile production layer. The Test Lab controller must not call the native bridge directly, construct requests from catalog strings, or create a parallel allowlist.

Operating-state guidance (KOEO, idle, warm-up and load where supported) can then drive that production runner and feed exact fresh results back to this same visual model. Each selective execution path needs deterministic transport/decoder/state tests before separate vehicle field validation.

`source/test verified` and `field verified` remain separate states.
