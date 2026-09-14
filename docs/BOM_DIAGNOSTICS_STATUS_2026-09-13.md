# BOM diagnostics implementation status — 2026-09-13

This document records the current implementation state of the `Bom-kaapija`-backed IS220d component workflow on branch `fix/flex-0.8.1-injector-no-data`.

## Current coverage

All **23** currently reviewed DIRECT/INDIRECT component recipes have at least one source-linked workshop inspection point.

| Layer | Points | Components | Physical group coverage |
| --- | ---: | ---: | --- |
| `is220d-component-inspection-points.js` | 16 | 5 | MAP, MAF, EGR, DPNR pressure sensor, ECT |
| `is220d-fuel-inspection-points.js` | 12 | 6 | fuel filter, SCV, injection pump, rail pressure sensor, fuel temperature sensor, main injectors |
| `is220d-starting-charging-inspection-points.js` | 6 | 3 | alternator, starter, crank position sensor |
| `is220d-air-exhaust-inspection-points.js` | 16 | 9 | turbo, intercooler, intake manifold, vacuum regulator, VSV, intake hose, EGT1, EGT2, exhaust fuel addition injector |
| **Total** | **50** | **23 / 23** | all current DIRECT/INDIRECT recipes |

Every point contains a stable point ID, component/PNC/OE context, exact `Vikadiag_kohteet` row locators, required operating state, named signal dependencies, a source-backed qualitative pattern, an explicit limitation and a physical follow-up step.

The aggregate test requires the union of inspection-point component IDs to equal the 23 IDs in `IS220D_COMPONENT_DIAGNOSTICS`. A new recipe therefore cannot silently remain outside the inspection workflow.

## Execution state

`is220d-inspection-execution-state.js` tracks all 50 points using five user-facing states:

- `EI ALOITETTU`;
- `OSITTAIN`;
- `EVIDENSSI KERÄTTY`;
- `VAATII FYYSISEN VARMISTUKSEN`;
- `ODOTTAA VARMENNETTUA SIGNAALIA`.

Electronic completion (`EVIDENSSI KERÄTTY`) is derived from actually observed production-authorized live evidence. Physical checks require an explicit local user confirmation (`checked-normal` or `deviation-found`). A physical confirmation cannot be used to mark an electronic point complete.

Compatible imported Techstream CSV evidence can move a linked electronic point only to `OSITTAIN`. It can never produce `EVIDENSSI KERÄTTY`, because the imported values may come from a different session or operating state than the current Flex capture.

## Operating-state capture history

`is220d-capture-history.js` now adds an explicit local capture history for evidence already collected by the existing wide diagnostic. It does not run a second diagnostic pass.

Supported user-assigned capture contexts are:

- `KOEO`;
- `STARTTAUS`;
- `KÄYNTI`;
- `LÄMMIN TYHJÄKÄYNTI`;
- `KUORMITUS`.

A completed diagnostic run becomes a sanitized capture candidate. The user must explicitly choose its context before it enters capture history. Context is not inferred from a generic `engine running` flag, and one diagnostic run can belong to only one context at a time.

The local capture record contains only run identity/timestamps, the explicit context, observed named signal keys and decoded numeric values with their units/evidence metadata. Raw CAN/ELM frames, request commands, Bluetooth addresses and vehicle identity payloads are not persisted by this layer.

Only signals that are both production-authorized and currently collected by the wide diagnostic can enter capture history. Field-rejected `219C` and the non-authorized `2193`, `2196` and `21AF` candidates therefore cannot become capture values.

Cross-run comparison uses only the two latest captures with the same explicit context. The current BOM physical-group selection further limits which signal values appear in the comparison. A displayed delta is only a numeric difference between compatible captures; it is not an automatic fault verdict. Values from different contexts are never combined as if they were simultaneous measurements.

## Techstream Data List reference evidence

Flex can import an offline Techstream Data List CSV/text export for these current evidence gaps:

- `Injection Feedback Val #1–#4`;
- `Target Common Rail Pressure`;
- `Target Pump SCV Current`.

`is220d-techstream-evidence.js` stores only the sanitized parsed values, import timestamp and source filename in local storage. Raw CSV is not persisted by this layer.

The imported values are displayed as **Techstream CSV · OFFLINE-REFERENSSI** on the relevant fuel/rail/injector inspection points. They do **not** authorize a vehicle command, change a diagnostic signal evidence level, or prove a same-run target/actual relationship. A value missing from the export remains missing; null/blank values are never converted into synthetic zero measurements.

Current point linkage:

- `fuel-filter-rail-build` → target rail pressure;
- `scv-rail-response` → target rail pressure + target SCV current;
- `pump-rail-build` → target rail pressure + target SCV current;
- `rail-sensor-cranking-response` → target rail pressure;
- `injector-system-context` → all four injector feedback values.

Existing target-vehicle `.TSE` sessions do not contain these three Data List targets, so no real values have been inferred from them. A future Techstream session must explicitly record/export the required items.

## Transport boundary

The inspection-point, execution-state, capture-history and Techstream-reference modules are metadata/evaluation/UI layers only. They do not send vehicle requests.

Static tests reject vehicle/network execution paths such as `.send()`, `queryPid`, `queryToyotaReadData`, `NativeElm`, `transport.send`, `fetch`, WebSocket and XMLHttpRequest from these modules.

The BOM, capture history and imported Techstream evidence cannot authorize an ECU command. `219C` remains field-rejected and is not accepted into inspection or capture evidence. The main-injector workflow records cylinder feedback as an unresolved live-data gap instead of replacing it with a guessed request.

## What the current verified wide diagnostic can support

The inspection and capture workflows can reuse current production-authorized evidence such as engine RPM, coolant temperature, MAP, MAF, standard OBD rail pressure, barometric pressure, ECU voltage, verified Toyota EGR position `212C`, DPNR differential pressure `217E`, and DPNR inlet/outlet EGT data `217F`.

Inspection points may reference registered signals that are not yet collected by the current wide diagnostic. Those dependencies remain unavailable / awaiting verification and do not become transport actions or capture-history values.

## Named evidence gaps

The next implementation/evidence work should focus on:

1. correct Techstream/J2534 raw transaction for **Injection Feedback #1–#4**;
2. correct raw transaction for **Target Common Rail Pressure**;
3. correct raw transaction for **Target Pump SCV Current**;
4. vehicle verification for the current **fuel-temperature** candidate;
5. vehicle verification / collection policy for useful **injection timing** data;
6. **boost target / VNT control command**;
7. **cam/crank sync/correlation**;
8. **starter permission / clutch-start switch** state if available read-only;
9. **5th injector command** and passive **regeneration status** if a verified read-only Data List item exists;
10. exact EGR-cooler/VSV command identity where it improves physical VSV separation.

These gaps follow the existing evidence gate: identify from Techstream/manual evidence, add as non-authorized metadata first, capture on the target vehicle, compare with Techstream, require repeatability, then review any allowlist change separately.

## I/M readiness integrity

The standard Mode 01 readiness layer reads `0101`, `0141`, `0130` and `0131`. Overall readiness fails closed when PID `0101` responds but reports zero supported monitors: that state is `unavailable`, not `ready`.

## Workshop behavior now available

The BOM page can combine group selection, signal/evidence preflight, operating-state guidance, electronic coverage and component assessment, 50 source-linked inspection points, execution state, physical checklist/progress, explicit operating-state capture history, Techstream offline reference evidence and next physical task prioritization.

Group selection remains a workshop scope selector. It does not create a second vehicle-command implementation and does not bypass the profile-authorized wide diagnostic.

## Next software step

The next useful layer is **context-aware point evaluation** using the new capture history, but only where the reviewed source evidence and verified signals support a deterministic relationship. Suitable first targets are qualitative same-context comparisons such as MAP/BARO KOEO plausibility, warm-idle stability/trend checks and DPNR/EGT repeatability. Fixed numeric fault thresholds must not be invented when the reviewed source gives only a qualitative comparison.

Before any point rule relies on an operating-state label, add state-quality checks where the already verified signals can support them. For example, a `warm-idle` capture can record whether coolant/RPM evidence is available, while a `load` capture can record whether RPM/MAP/MAF evidence is available. These quality checks should qualify the evidence rather than silently reclassify a user-selected context.
