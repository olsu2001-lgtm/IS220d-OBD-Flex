# IS220d OBD Flex — real-car field validation

Status: **validation protocol for the unified 0.8.0 field-test line before release review**.

This procedure is read-only. It validates transport behavior, ECU Survey topology, existing Toyota read-data paths and report provenance. It does not authorize writes, coding, Active Tests, DTC clearing or ECU programming.

## Build selection and provenance

Use an APK produced by the repository's `Flex safety and build` GitHub Actions workflow.

The workflow artifact contains:

- `Lexus_OBD-Flex-0.8.0-debug.apk`
- `Lexus_OBD-Flex-0.8.0-release.apk`
- `build-info.json`

For field validation, prefer the debug APK so that behavior corresponds directly to the unminified build path while retaining the same functional source.

Before installing:

1. record the GitHub Actions run and commit SHA;
2. open `build-info.json` and confirm `gitSha` matches that commit;
3. keep the APK and `build-info.json` together until the reports have been reviewed.

The APK bundle contains the same short SHA. Completed ECU Survey reports include it as `Build SHA`, so a report can be tied back to its exact source commit even after the APK has been installed on the phone.

## Target setup

Primary target for this project:

- vehicle: Lexus IS220d / XE20 / 2AD-FHV;
- OBD protocol: ISO 15765-4 CAN, 11-bit, 500 kbit/s;
- engine request header: `7E0`;
- expected engine response header: `7E8`;
- primary adapter: Vgate vLinker MC+;
- Android field device: the project's normal test phone;
- no second OBD application connected to the adapter during a Flex test.

Keep the same ignition/engine condition for all three topology-repeatability runs. Record whether the engine was stopped or running.

## Phase A — connection preflight

Connect Flex normally and record the selected adapter/transport.

Acceptance observations:

- Bluetooth/GATT or SPP reaches connected state;
- the first ECU connectivity attempt in the wide diagnostic is the current-settings `0100` probe;
- optional adapter/vLinker capability probes occur after that first `0100` attempt;
- if fallback is needed, the documented order remains `ATZ` → `ATSP0` → `ATTP6` → `ATSP6` as required by the connection path;
- an `ATZ` reset is followed by the enforced 1.8 s settling delay;
- no apparent indefinite freeze occurs in the vLinker / ELM + Toyota phase.

If the current-settings `0100` succeeds, later protocol-search paths should be skipped rather than unnecessarily resetting a working connection.

## Phase B — repeatable ECU Survey

Run the complete **vLinker / ELM + Toyota** diagnostic three times under the same vehicle state.

Save the full diagnostic report after every run.

For each run record:

- report ID;
- Build SHA;
- engine stopped/running state;
- adapter identity and protocol;
- responding survey request headers;
- observed response headers;
- topology signature;
- Mode 09 identity result;
- Toyota Read Data positive-response count;
- restoration result after the diagnostic.

Expected baseline evidence:

- `7E0` should respond as the currently known engine ECU through `7E8`;
- unknown responders remain `unmapped` / `Tunnistamaton ECU` even if their address is stable;
- no response from an unknown optional address is not reported as an ECU failure.

On the third compatible run, the UI/report may show `Vakaa 3/3` / `stable` only when the three latest compatible topology signatures are identical.

A stable signature is repeatability evidence. It is not sufficient by itself to name an unmapped ECU.

## Phase C — Mode 09 identity evidence

The wide diagnostic already reads standard Mode 09 identity data. No additional identity query is introduced by ECU Survey.

Compare the decoded result against repository target-vehicle evidence:

| Field | Repository evidence | Validation result |
|---|---|---|
| VIN | `JTHBB262302028787` | `match` expected for the target vehicle |
| Calibration ID | `35360000` | `match` expected if calibration identity is unchanged |
| CVN payload evidence | `01CAD67F74` | `match` expected against the project's documented representation |
| ECU name | no hard-coded expected value | `observed` if decoded successfully |

Possible parser/evidence states:

- `match` — observed value equals the repository evidence;
- `mismatch` — observed value differs;
- `observed` — value decoded but no expected value is defined;
- `parse-error` — positive/valid response existed but the complete value could not be decoded safely;
- `not-observed` — no accepted response was obtained.

Do not convert `mismatch` into an automatic ECU-fault conclusion. First check that the report belongs to the intended vehicle/build and compare calibration evidence independently.

## Phase D — existing Toyota read-data paths

The active IS220d profile currently permits only these manufacturer read-data identifiers:

- `217E`
- `217F`
- `212C`

The wide diagnostic should preserve the complete raw response and identify which query form succeeded.

Record separately for each identifier:

- positive response / NO DATA / negative response / timeout;
- request form used when the first accepted positive response was obtained;
- response CAN header;
- decoded values where the current verified decoder accepts them.

Do not add a new identifier based only on a Techstream label or a plausible-looking byte sequence.

## Phase E — restoration check

The wide diagnostic changes ELM display/filter/protocol settings temporarily. Its restoration phase must complete before the run is accepted as a useful field-validation sample.

Verify:

- CAN protocol restored to protocol 6;
- CAN automatic formatting and flow control restored;
- normal timing/header settings restored;
- the final `0100` verification succeeds;
- normal live data can be started after the diagnostic without reconnecting if the connection otherwise remains healthy.

If the final verification does not succeed, retain the report but classify that run as a transport/restoration investigation sample rather than a clean topology baseline.

## Phase F — Techstream cross-check

After obtaining repeatable Flex survey data, obtain a Techstream Health Check / system inventory from the same vehicle configuration.

Compare:

- systems/ECUs reported by Techstream;
- Flex responding CAN survey headers;
- known `7E0` / `7E8` engine relationship;
- Mode 09 VIN/calibration evidence.

Do **not** map an unmapped Flex responder to a Techstream ECU merely because one system name appears to be the only remaining candidate. Address mapping needs independent evidence sufficient to exclude alternative nodes/equipment variants.

A new named ECU mapping should be introduced in a separate reviewed PR with its evidence recorded.

## Phase G — DPNR/live-data sanity run

After the topology/identity diagnostic is complete, perform a normal live-data run at idle or during an ordinary test drive as appropriate.

For the existing vehicle-verified Toyota paths, retain:

- raw `217E` response;
- raw `217F` response;
- raw `212C` response;
- DPNR differential pressure;
- DPNR inlet/outlet temperatures;
- regeneration state values;
- EGR position;
- RPM, coolant, MAF and adapter/ECU voltage context.

The purpose is to verify that current decoded values change plausibly with operating conditions and that suspicious values remain traceable to their raw response. Exact-equal DPNR temperatures or the known suspicious 750 °C pair remain evidence flags, not automatic sensor-fault declarations.

## Automatic three-run field-validation gate

The app now derives a compact validation record from each completed wide diagnostic and stores it beside the existing ECU Survey history. This adds no vehicle request; it only summarizes results that the wide diagnostic already produced.

For each stored run the validation record retains:

- declared engine state (`running`, `stopped` or `auto`);
- connection strategy selected by the existing diagnostic;
- whether the initial current-settings `0100` result was recorded and whether it passed;
- whether the final restoration `0100` was recorded and whether it passed;
- cancellation/internal-error state;
- for `217E`, `217F` and `212C`: attempted/not-attempted, positive/non-positive state, successful query form when available, response CAN header(s) and attempt count.

The compact history deliberately does **not** duplicate raw CAN/ELM responses or error text. Those remain in the separately saved full diagnostic reports.

The **Kenttävalidointi · 0.8.0-portti** panel evaluates the latest run against previous history. A clean three-run group requires the same:

- survey schema/profile/safe probe;
- embedded Build SHA;
- declared engine state.

The automatic internal gate passes only when all of these are true:

1. three matching validation runs exist;
2. the Build SHA is present and identical;
3. engine state is explicitly declared as running or stopped and is identical;
4. the current-settings `0100` step exists in every run;
5. all three topology signatures are identical;
6. `7E0 → 7E8` is observed in every run;
7. Mode 09 VIN/CALID/CVN identity status is `match` in every run;
8. `217E`, `217F` and `212C` were all attempted in every run;
9. final restoration `0100` succeeds in every run;
10. none of the three runs is cancelled or contains an internal diagnostic-engine failure.

A positive manufacturer response is **not** required for all three Toyota identifiers to pass this gate; the requirement is that the existing production paths were actually exercised and their detailed result remains available in the corresponding full report.

When all internal checks pass, the panel reports **Valmis Techstream-vertailuun**. This is not a 0.8.0 release decision. Techstream Health Check/system inventory remains independent external evidence and is shown as pending until reviewed separately.

The panel can copy a compact field-validation summary. The same summary is also appended to the full ECU Survey text report.

## Minimum evidence before calling the ECU Survey line vehicle-validated

The 0.8.0 unified field-test line should not be promoted solely because unit tests and APK builds are green.

Minimum field evidence:

1. one commit-traceable APK/build-info pair;
2. three completed compatible wide-diagnostic runs on the target vehicle;
3. repeatable engine `7E0` → `7E8` observation;
4. stable 3/3 topology, or a documented explanation if topology legitimately varies with vehicle state;
5. Mode 09 VIN/CALID/CVN result recorded and reviewed;
6. restoration `0100` succeeds on the accepted baseline runs;
7. existing `217E`, `217F`, `212C` results retained with raw evidence;
8. Techstream Health Check/system inventory available for independent topology comparison;
9. no newly named ECU without separate supporting evidence.

Only after this evidence is reviewed should the release/version decision be made.
