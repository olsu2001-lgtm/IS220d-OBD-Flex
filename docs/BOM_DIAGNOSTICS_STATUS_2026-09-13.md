# BOM diagnostics implementation status — 2026-09-13

This document records the current implementation state of the `Bom-kaapija`-backed IS220d component workflow on branch `fix/flex-0.8.1-injector-no-data`.

## Current coverage

All **23** currently reviewed DIRECT/INDIRECT component recipes now have at least one source-linked workshop inspection point.

| Layer | Points | Components | Physical group coverage |
| --- | ---: | ---: | --- |
| `is220d-component-inspection-points.js` | 16 | 5 | MAP, MAF, EGR, DPNR pressure sensor, ECT |
| `is220d-fuel-inspection-points.js` | 12 | 6 | fuel filter, SCV, injection pump, rail pressure sensor, fuel temperature sensor, main injectors |
| `is220d-starting-charging-inspection-points.js` | 6 | 3 | alternator, starter, crank position sensor |
| `is220d-air-exhaust-inspection-points.js` | 16 | 9 | turbo, intercooler, intake manifold, vacuum regulator, VSV, intake hose, EGT1, EGT2, exhaust fuel addition injector |
| **Total** | **50** | **23 / 23** | all current DIRECT/INDIRECT recipes |

Every point contains:

- a stable point ID;
- component ID / PNC / OE context;
- one or more exact `Vikadiag_kohteet` source row locators;
- a required operating state or physical inspection state;
- named signal dependencies from the signal registry;
- a source-backed expected pattern;
- an explicit limitation;
- a physical follow-up step.

The aggregate test requires the union of inspection-point component IDs to equal the 23 IDs in `IS220D_COMPONENT_DIAGNOSTICS`. A new recipe therefore cannot silently remain outside the inspection workflow.

## Transport boundary

The inspection-point modules are metadata/evaluation/UI layers only. They do not send vehicle requests.

Static tests reject vehicle/network execution paths such as `.send()`, `queryPid`, `queryToyotaReadData`, `NativeElm`, `transport.send`, `fetch`, WebSocket and XMLHttpRequest from these modules.

The BOM still cannot authorize an ECU command. Signal definitions are sanitized before being exposed to an inspection point and do not include executable `commands` arrays.

`219C` remains field-rejected and is not accepted into inspection evidence. The main-injector workflow explicitly records cylinder feedback as an unresolved evidence gap instead of replacing it with another guessed request.

## What the current verified wide diagnostic can support

The inspection workflow can already reuse current production-authorized evidence such as:

- engine RPM;
- coolant temperature;
- MAP;
- MAF;
- standard OBD rail pressure;
- barometric pressure;
- ECU/control-module voltage;
- verified Toyota EGR position `212C`;
- DPNR differential pressure `217E`;
- DPNR inlet/outlet EGT data `217F`.

Inspection points may reference registered signals that are not yet collected by the current wide diagnostic. Those dependencies are shown as unavailable / awaiting verification and do not become transport actions.

## Named evidence gaps

The next implementation/evidence work should focus on these gaps because they materially improve component separation:

1. correct Techstream Data List transaction for **Injection Feedback #1–#4**;
2. **target rail pressure** separately from actual rail pressure;
3. **SCV duty/command**;
4. vehicle verification for the current **fuel-temperature** candidate;
5. vehicle verification / collection policy for useful **injection timing** data;
6. **boost target / VNT control command**;
7. **cam/crank sync/correlation**;
8. **starter permission / clutch-start switch** state if available read-only;
9. **5th injector command** and passive **regeneration status** if a verified read-only Data List item exists;
10. exact EGR-cooler/VSV command identity where it improves physical VSV separation.

These gaps must follow the existing evidence gate: identify from Techstream/manual evidence, add as non-authorized metadata first, capture on the target vehicle, compare with Techstream, require repeatability, then review any allowlist change separately.

## Workshop behavior now available

The BOM page can now combine:

- group selection;
- signal/evidence preflight;
- operating-state guidance;
- electronic coverage and component assessment;
- 50 component-specific source-linked inspection points;
- physical checklist/progress;
- next physical task prioritization.

The group selection remains a workshop scope selector. It does not create a second vehicle-command implementation and does not bypass the existing profile-authorized wide diagnostic.

## Next software step

The next useful software layer is **inspection-point execution state**: persist which operating-state captures and physical checks have actually been completed for each point, then derive `not-started / partial / evidence-collected / needs-physical-confirmation / blocked-by-unverified-signal` without introducing new ECU reads.

After that, add deterministic point-level evaluation only where the source and verified signals support it. Do not invent numerical fault thresholds when the reviewed source provides only a qualitative comparison or trend.
