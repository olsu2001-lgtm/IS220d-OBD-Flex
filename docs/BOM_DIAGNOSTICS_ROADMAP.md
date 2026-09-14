# BOM diagnostics implementation roadmap

Status: active implementation plan, 2026-09-12

## Goal

Bring every **DIRECT** and **INDIRECT** diagnostic target from the project `Bom-kaapija` workbook, primarily `Vikadiag_kohteet` and `Diag_ryhmät`, into IS220d OBD Flex as an offline, evidence-backed component diagnostic workflow.

The BOM describes **what should be diagnosed**. It must never authorize an ECU request by itself. Vehicle communication remains governed by `AGENTS.md`, `docs/SAFETY.md`, `docs/PROTOCOL.md`, the vehicle profile and executable allowlists.

Physical-only BOM items remain outside the electronic diagnosis engine. A DIRECT/INDIRECT component may still show the workbook's physical confirmation step as a recommended follow-up after electronic evidence has been evaluated.

## Current baseline

The current 0.8.1 development line already contains the first vertical slice:

- `src/is220d-component-diagnostics.js` maps **23 components**: 9 DIRECT and 14 INDIRECT.
- `src/component-diagnostics-page.js` provides the BOM diagnostics page, search and coverage filters.
- `src/component-diagnostics-publisher.js` publishes the latest component coverage from the wide diagnostic.
- ECU Survey/report integration can include the component coverage without sending a second diagnostic loop.
- The current component engine primarily answers **whether useful evidence was collected**, not yet whether the evidence pattern points toward a specific component fault.
- `219C` is explicitly excluded from injector evidence and must remain blocked before transport.
- Normal Toyota production reads remain limited by `docs/PROTOCOL.md`; Techstream-derived candidates do not become production commands merely because a BOM recipe references them.

This roadmap evolves that slice into a complete, maintainable diagnosis system instead of expanding the hard-coded 23-component table indefinitely.

---

## Target architecture

The implementation should have five separate layers:

1. **BOM source snapshot** — component identity, symptom, diagnostic class, physical group and source notes.
2. **Signal registry** — known ECU/OBD measurements and their evidence level, decoder, unit and plausibility rules.
3. **Component recipes** — which independent signals are needed and how they are interpreted for one component.
4. **Test-plan builder** — deduplicates required reads for the selected component/group while enforcing the existing allowlist.
5. **Assessment/UI/reporting** — displays evidence, confidence, deviations and the next useful verification step without turning missing evidence into a fault verdict.

The layers must stay independent. In particular, changing a BOM row must not silently change the transport allowlist.

## 1. Versioned BOM diagnostic data

### Repository representation

Create a generated, reviewable data artifact, for example:

- `data/is220d-bom-diagnostics.json`
- schema definition/validator under `src/` or `scripts/`
- import/update script such as `scripts/import-bom-diagnostics.mjs`

The APK must not depend on Google Drive at runtime. Drive is the project source; the repository contains the reviewed snapshot used by the build.

### Minimum component fields

Each DIRECT/INDIRECT target should have a stable record containing at least:

- stable component ID
- diagnostic class: `direct` or `indirect`
- main group/category
- diagnostic/physical group
- PNC
- OE number(s)
- Finnish component name
- symptom description
- non-OBD/physical confirmation method
- OBD/Techstream check description
- source/reference note
- source confidence/status
- BOM source locator/version

The import must reject duplicate IDs, malformed classes and missing required identifiers. It should also report BOM rows that are not represented in the generated snapshot.

### Stable IDs

IDs must be semantic and independent of spreadsheet row numbers, for example `engine.maf_sensor` or `engine.intake_manifold`. Spreadsheet row numbers may remain source locators but must not be runtime identity keys.

---

## 2. Signal registry

Move reusable diagnostic measurements into a single signal registry instead of embedding raw request strings directly in every component recipe.

A signal definition should contain:

- stable signal key, e.g. `engine.rpm`, `engine.maf`, `engine.map`, `engine.ect`, `engine.egr_position`
- source ECU/request header
- command/request identity
- expected response identity
- decoder
- unit
- plausible range
- evidence level: `vehicle-verified`, `techstream-derived`, or `research-candidate`
- production authorization state
- valid engine state(s), where relevant
- source/evidence note

### Required rule

A signal may be referenced by a component recipe before it is production-authorized, but the test-plan builder must then report it as **waiting for verification** and must not transmit it.

Current examples:

- standard OBD signals such as RPM, ECT, MAP, MAF, rail pressure, barometric pressure and ECU voltage can be represented immediately using their current decoders;
- `212C`, `217E` and `217F` can use their currently verified Toyota profile definitions;
- `2193`, `2196` and `21AF` remain evidence-labelled candidates until their release gate is met;
- `219C` remains field-rejected and cannot satisfy any recipe.

---

## 3. Component diagnostic recipes

The present `signalGroups/minimumGroups` coverage model should be retained as the first stage, but extended with an explicit **assessment** stage.

### Two separate outputs

Every component must expose two different concepts:

**Coverage**
- `not-tested`
- `unavailable`
- `partial`
- `observed`

**Assessment**
- `not-evaluated`
- `inconclusive`
- `normal-pattern`
- `deviation`
- `strong-deviation`

`normal-pattern` means only that the observed data matches the implemented rule set. It must not be displayed as “component proven good”.

### DIRECT recipe

A DIRECT recipe uses a signal that measures the component itself or a verified component-specific value. Its rule can evaluate, as evidence permits:

- response validity
- plausible range
- stuck/fixed value detection
- rate/change under a known operating state
- comparison with another independently measured signal
- repeated-run consistency

Examples for the first implementation wave:

- MAF
- MAP/boost pressure sensor
- coolant temperature sensor
- EGR position
- DPNR differential pressure
- EGT sensors

### INDIRECT recipe

An INDIRECT recipe must require multiple independent evidence groups wherever practical. It should explain **why** the signals support the component hypothesis.

Examples:

- turbo: MAP + MAF + BARO + EGR context
- intercooler/intake leak: MAP + MAF + BARO response
- SCV/high-pressure pump/fuel filter: rail-pressure behavior + RPM + fuel-temperature context when available
- starter: cranking RPM + ECU voltage
- intake manifold: MAF + MAP + EGR behavior

Indirect assessment must remain correlation-based. One abnormal signal must not automatically nominate every component that shares it.

### Recipe structure

A recipe should be data-driven and contain fields such as:

- `requiredSignals`
- `optionalSignals`
- `minimumIndependentGroups`
- `operatingState`
- `evaluationRules`
- `severity/weight`
- `physicalConfirmation`
- `limitations`
- `evidenceRequired`

The rule engine must be deterministic and testable from replay fixtures.

---

## 4. Operating-state and guided tests

Many components cannot be meaningfully assessed from a single arbitrary snapshot. Add explicit passive/guided operating states without adding actuator control.

Candidate states include:

- key on, engine off
- cranking
- cold idle
- warm stable idle
- user-held steady RPM
- user-driven load/acceleration capture
- deceleration/overrun capture when useful

The app may instruct the user to create the state, but Flex must remain read-only: no Active Tests, forced regeneration or actuator commands.

Each recipe declares which state it needs. If the state is not satisfied, the result is `inconclusive`, not a fault.

---

## 5. Physical-location diagnostic groups

After every DIRECT/INDIRECT BOM target has a recipe, group them into small service/inspection sessions using `Diag_ryhmät` and physical location.

Initial group candidates:

- **Air intake / turbo / vacuum / EGR** — MAF, MAP, intake hose, intake manifold, intercooler, turbo, vacuum valves, EGR
- **Fuel / rail / injection** — fuel filter, SCV, high-pressure pump, rail pressure sensor, injectors
- **DPNR / exhaust aftertreatment** — differential pressure, EGT sensors, exhaust fuel addition injector
- **Starting / charging / engine position** — starter, alternator, crank signal and related voltage/RPM evidence
- additional groups are created from the workbook rather than guessed when the full diagnostic target set is imported

### Group workflow

A group page should:

1. show the affected components and symptoms;
2. calculate one deduplicated read plan from all component recipes;
3. show which requested evidence is already available and which is still missing;
4. run only profile-authorized read commands;
5. evaluate component recipes from the same captured dataset;
6. rank useful follow-up checks by evidence strength;
7. show the BOM physical confirmation steps for unresolved components.

This replaces repeated one-component command loops with one physically meaningful inspection session.

---

## 6. Test-plan builder and transport boundary

Implement a pure function that accepts component/group recipes and returns a diagnostic plan.

The plan builder must:

- deduplicate identical signals/requests;
- separate already-collected data from missing data;
- reject non-authorized signals before transport;
- retain ECU/header atomicity;
- respect required engine state;
- expose why a signal was requested and which components use it;
- never allow BOM data to add a command to the vehicle profile;
- remain compatible with the non-blocking Android transport bridge so long waits do not freeze the WebView.

If a component requires a Techstream-derived but not vehicle-verified signal, the plan should still show the component but label its electronic diagnosis as incomplete.

---

## 7. Diagnostic assessment engine

Create a transport-free module, for example `src/component-diagnostic-assessment.js`, that consumes normalized observations and recipes.

The engine should return for each component:

- coverage status
- assessment status
- confidence/evidence strength
- values used
- failed/passed rule checks
- operating-state validity
- relevant DTC evidence, when separately verified
- unresolved evidence
- recommended next verification
- source/evidence notes

The assessment output must be serializable and usable by UI, reports and deterministic tests.

### No hidden diagnosis

Every `deviation` shown to the user must be explainable from the displayed observations/rules. Do not implement opaque scoring that cannot show why a component was ranked.

---

## 8. DTC-to-BOM linkage

Add DTC linkage as a separate evidence channel after the signal recipes are stable.

- map only documented/verified DTC relationships;
- distinguish current, pending and permanent DTC sources;
- one DTC may support several component hypotheses;
- a DTC must not override contradictory live data without an explicit rule;
- do not infer undocumented Toyota subcodes.

The component page should show DTC support separately from live-measurement support.

---

## 9. Techstream evidence workstream

Use the project Techstream 12.20.024 material and real-car Techstream captures to close missing signal gaps.

Priority targets:

1. real injector feedback/balance/correction Data List transaction replacing the rejected `219C` assumption;
2. rail pressure target/actual data if separately available;
3. fuel temperature;
4. injection timing;
5. DPNR/DPF states not yet verified in Flex;
6. additional EGR/turbo/airflow values that materially improve component separation.

For each candidate:

1. identify the 2AD-FHV/IS220d Data List item and request/response definition;
2. record source evidence in repository documentation;
3. add the signal as `techstream-derived`, not production-authorized;
4. capture the transaction on the target vehicle/calibration;
5. compare decoded Flex value with Techstream under the same state;
6. require repeatable field evidence;
7. only then review a profile/allowlist change in its own PR.

No Techstream discovery automatically expands the production allowlist.

---

## 10. UI evolution

Evolve the existing BOM page instead of creating a parallel diagnostic application.

### Component list

Keep:

- DIRECT/INDIRECT filter
- coverage filter
- component/OE/PNC search
- source identity

Add:

- assessment status
- physical group
- evidence level
- latest actual values used in the assessment
- “why this result” expandable rule trace
- missing evidence
- physical follow-up check
- history/delta from a comparable previous run

### Group view

Add a group selector and a guided **Run group diagnosis** action. The group page becomes the primary workshop workflow; the all-components list remains the audit/overview view.

### Result language

Prefer:

- `DATA SAATU`
- `OSITTAIN`
- `EI VASTAUSTA`
- `NORMAALI KUVIO`
- `POIKKEAMA`
- `VAHVA POIKKEAMA`
- `EI RIITTÄVÄÄ DATAA`
- `ODOTTAA VARMENNETTUA SIGNAALIA`

Avoid “osa on kunnossa” unless the implemented test genuinely proves that claim, which most OBD evidence does not.

---

## 11. Reporting and history

Extend the existing report/snapshot model so a BOM diagnostic run stores a compact assessment snapshot:

- component ID and part numbers
- recipe/schema version
- operating state
- observed signal values and timestamps
- assessment + confidence
- DTC support summary
- unresolved evidence
- build SHA/profile/calibration identity

Do not duplicate large raw transport logs into long-term component history. Raw responses remain in their existing diagnostic/run evidence path when needed for review.

History comparison must only compare compatible vehicle/profile/calibration/recipe versions.

---

## 12. Testing strategy

### Static/schema tests

- every imported DIRECT/INDIRECT BOM row has a unique stable ID;
- no PHYSICAL-only row enters the electronic recipe set;
- every recipe references existing signals;
- every production signal is backed by the vehicle profile/allowlist;
- every decoder has a unit, plausible range and evidence level;
- `219C` cannot enter a plan or count as evidence.

### Rule tests

For every component recipe, include replay fixtures for at least:

- normal-pattern evidence
- deviation evidence
- missing signal
- invalid response
- out-of-plausibility value
- wrong operating state

### Integration tests

- selected group creates the expected deduplicated request plan;
- one captured signal can feed several component recipes without duplicate vehicle requests;
- an unverified signal produces `ODOTTAA VARMENNUSTA` and zero transport calls;
- cancellation/timeouts leave UI responsive;
- Classic and BLE use the same diagnostic semantics while retaining isolated transports.

### Field validation

For every newly authorized Toyota signal:

- repeat the same build/profile on the target vehicle;
- collect at least three repeatable runs where practical;
- cross-check against Techstream when the value originates from Techstream evidence;
- store sanitized evidence under the existing field-evidence process.

Simulation/replay validates software behavior only; it does not upgrade an evidence level.

---

## Implementation milestones

### P0 — Runtime stability gate

Before increasing the number or duration of component tests, finish field validation of the non-blocking Android OBD send path so a slow ECU response cannot freeze the WebView.

**Done when:** test UI remains responsive through long response/timeout paths on both used transports and regression/build gates pass.

### P1 — BOM source pipeline

- define JSON schema;
- create import/update script;
- import all DIRECT/INDIRECT rows from `Vikadiag_kohteet`;
- import physical grouping from `Diag_ryhmät`;
- add source-version metadata and completeness tests.

**Done when:** repository can prove that every in-scope BOM diagnostic row is represented exactly once.

### P2 — Signal registry and migration

- create normalized signal registry;
- migrate the existing 23 component mappings away from embedded raw command strings;
- retain current behavior and tests;
- expose unavailable/unverified signal dependencies explicitly.

**Done when:** no component recipe itself can authorize an ECU command.

### P3 — Assessment engine

- add coverage + assessment separation;
- implement deterministic rule traces;
- add operating-state validation;
- add replay tests.

**Done when:** component results explain both what data was collected and what the data pattern means.

### P4 — DIRECT components complete

Implement/evidence all DIRECT BOM targets that can be supported by current verified signals, then work through Techstream gaps.

Priority order:

1. MAF
2. MAP
3. ECT
4. EGR
5. DPNR differential pressure
6. EGT sensors
7. rail/fuel sensors as evidence permits

**Done when:** every DIRECT row is either diagnostically implemented or explicitly marked as waiting for a named missing verified signal.

### P5 — INDIRECT components complete

Implement multi-signal recipes for fuel, boost/intake/vacuum, start/charge and other imported INDIRECT targets.

**Done when:** every INDIRECT row has a recipe, limitation text and physical follow-up step; no component is inferred from a single shared abnormal signal unless specifically justified.

### P6 — Physical group workflow

- build group model from `Diag_ryhmät`;
- add group selector;
- add deduplicated group test-plan builder;
- show ordered physical follow-up checks.

**Done when:** the user can diagnose one physical area of the car in one guided session instead of manually running unrelated tests.

### P7 — DTC linkage, reports and history

- documented DTC-to-component evidence;
- assessment snapshots;
- comparable-run history;
- report output with rule traces and unresolved evidence.

### P8 — Techstream gap closure

Work through missing high-value Data List signals, beginning with injector feedback. Each new Toyota read follows the separate evidence/review gate before production authorization.

### P9 — Full BOM audit and release gate

Generate a coverage audit from the versioned BOM snapshot.

Release gate requires:

- 100% of in-scope DIRECT/INDIRECT BOM rows represented;
- every target either implemented or explicitly blocked by a named evidence gap;
- no orphan signal/recipe/component IDs;
- all safety/regression tests green;
- debug and release APK builds green;
- field validation completed for newly authorized Toyota signals;
- documentation matches the shipped behavior.

---

## Definition of done for one BOM diagnostic target

A component is not “implemented” merely because it appears in the UI. It is complete only when:

1. it has a stable BOM-derived component ID, PNC/OE identity and source locator;
2. DIRECT/INDIRECT class is explicit;
3. physical diagnostic group is assigned;
4. symptom and physical confirmation text are present;
5. required/optional signals are named through the signal registry;
6. every signal has ECU, unit, decoder, plausible range and evidence level;
7. unsupported signals fail closed before transport;
8. coverage behavior is tested;
9. assessment rules and limitations are tested;
10. UI shows observations and the reason for the assessment;
11. report/history serialization is deterministic;
12. any new Toyota command has passed the repository evidence and field-validation gate.

---

## Immediate next implementation queue

The next code PRs should be kept small and reviewable:

1. **BOM schema/import PR** — versioned `Vikadiag_kohteet` + `Diag_ryhmät` snapshot and completeness tests.
2. **Signal registry PR** — move the current 23 components to named signals with no behavioral expansion.
3. **Assessment-core PR** — coverage/assessment separation and deterministic rule trace.
4. **First DIRECT rule PR** — MAF, MAP, ECT and EGR using already available/verified data only.
5. **Group-workflow PR** — air intake/turbo/vacuum/EGR as the first physical diagnostic session.
6. **Techstream injector evidence PR** — document and validate the correct injector Data List transaction; do not restore `219C`.

This order gives the app a scalable data model before the number of BOM diagnostic targets grows, while keeping every transport change isolated from diagnosis-content changes.
