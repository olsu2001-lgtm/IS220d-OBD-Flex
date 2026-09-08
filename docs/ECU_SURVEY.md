# ECU Survey foundation

Status: **wired into the existing wide ELM diagnostic report with compact local repeatability history and a read-only topology panel; no separate survey transmit path**.

This module implements the first reusable part of the historical 0.7.0 ECU Survey roadmap while preserving the current IS220d-only read-only contract.

## Purpose

The August development study identified topology discovery as the next major step before expanding functions or data coverage. It also required equipment-aware interpretation: an optional ECU that is not installed must not automatically be reported as faulty.

`src/ecu-survey.js` turns that requirement into deterministic code. `src/ecu-survey-diagnostic.js` converts the wide diagnostic's already collected `ECU-osoitehaku` results into the survey model, `src/ecu-survey-history.js` keeps a compact local history, `src/ecu-survey-report.js` appends a human-readable survey section to the exported report, and `src/ecu-survey-ui*.js` exposes the same evidence in a compact local UI.

## Current survey boundary

The executable survey plan is derived only from `IS220D_DIAGNOSTIC_PROFILE.ecuSurvey`:

- CAN request headers: `7E0`–`7E7`;
- safe probe: standard Mode 01 PID `00` (`0100`);
- expected positive response mode: `41`;
- every plan step is `operation: read-only` and `writable: false`.

The survey policy has a hard allowlist containing only `0100`. Changing `safeProbe` to another command makes plan creation fail before transport integration.

No Toyota `21xx` command, service/coding operation, Active Test, DTC clearing or ECU write is introduced by this module.

## Runtime integration

The wide **vLinker / ELM + Toyota** diagnostic already performs the direct-header `7E0`–`7E7` `0100` address scan. ECU Survey reuses those exact results instead of sending another scan.

At report-finalization time:

1. only results from phase `ECU-osoitehaku` are considered;
2. only command `0100` is accepted;
3. only request headers present in the validated survey plan are accepted;
4. raw response headers are extracted without guessing an identity;
5. the results are converted to an ECU Survey snapshot;
6. a compact snapshot is appended to local history;
7. the last three compatible topologies are compared;
8. the text snapshot and repeatability result are appended to the existing full diagnostic report;
9. the local topology UI is refreshed from the same snapshot/history result.

This integration therefore adds **zero new vehicle requests** to a diagnostic run.

## Connection preflight order

The wide diagnostic follows the Drive 0.5.1 connection principle:

1. try `0100` with the adapter's current ELM/protocol state first;
2. run optional adapter/vLinker capability probes;
3. only if the current-state `0100` did not work, continue to the existing clone-safe reset/fallback sequence beginning with `ATZ` and then `ATSP0`, `ATTP6` and `ATSP6` paths.

This prevents optional capability probing from delaying the first ECU connectivity check. Capability probes remain read-only adapter identity/status commands.

## Known versus unknown ECUs

The current production profile names only one ECU mapping:

- request `7E0` → response `7E8` → `engine` / 2AD-FHV engine ECU.

The survey **does not derive or guess identities for `7E1`–`7E7`**. A valid response from an address without a profile definition is stored and shown as `unmapped-response` / `Tunnistamaton ECU` until independent evidence identifies it.

This is deliberate: CAN address arithmetic or a response alone is not enough evidence to publish an ECU identity.

## Expectation model

Each planned request header has one expectation:

- `expected` — equipment/profile says the ECU should be present;
- `not-expected` — equipment information says the ECU is not applicable;
- `unknown` — installation state or ECU identity has not been established.

Default behavior marks profile-defined ECUs as `expected` and all other survey headers as `unknown`.

## Result states

The evaluator produces these explicit states:

| State | Meaning |
|---|---|
| `expected-responding` | expected ECU/header returned a valid read response |
| `expected-no-response` | expected ECU/header did not return a valid response; requires inspection, not an automatic fault verdict |
| `not-expected` | explicitly not applicable and no response observed |
| `unexpected-response` | explicitly not expected, but a valid response was observed |
| `unmapped-response` | response observed from a currently unidentified survey header |
| `unknown-not-observed` | no response and no equipment expectation is known |

The three source-study states — expected/responding, expected/not responding and not expected/not applicable — are therefore represented without forcing unknown addresses into a false equipment conclusion.

## Observation input

The evaluator consumes already collected read-only observations. Example shape:

```js
{
  requestHeader: "7E0",
  responseHeader: "7E8",
  validResponse: true,
  raw: "41 00 ...",
  durationMs: 42
}
```

The survey modules do not open Bluetooth, change ELM settings or send a command.

Observations outside the profile's `7E0`–`7E7` plan are rejected rather than silently added to topology.

## Local history

`src/ecu-survey-history.js` stores at most the latest 10 survey snapshots under a versioned localStorage key.

The stored form is intentionally compact. It keeps only data needed to compare topology:

- run/profile identifiers and timestamps;
- request headers;
- observed response headers;
- known ECU ID when one already exists in the profile;
- expectation/result state;
- response/attempt counts.

It deliberately removes:

- raw CAN/ELM responses;
- last-error text;
- adapter identity and address;
- full diagnostic metadata.

Invalid or unreadable history fails to an empty history. A localStorage write failure is reported in the survey report but does not fail the diagnostic run.

## Repeatability gate

`evaluateEcuSurveyRepeatability()` implements the study's topology-repeatability principle.

Default gate:

- at least 3 completed compatible survey snapshots;
- the last 3 responding-topology signatures must be identical;
- only then is `stable: true` returned.

Compatibility requires the same survey schema version, profile version and safe probe. Older history can remain stored without being mixed into the current repeatability decision.

The report and UI present repeatability as:

- `collecting` / `Kerätään` before three compatible runs exist;
- `stable` / `Vakaa` when the latest three compatible topologies are identical;
- `changed` / `Topologia muuttui` when at least three compatible runs exist but their latest topologies differ.

The signature contains request header, observed response header(s) and a profile-defined ECU ID when one exists. Unknown responders remain `unmapped`.

Stable topology is evidence of repeatability, **not proof of ECU identity**.

## Topology UI

`src/ecu-survey-ui.js` creates a DOM-independent view model and `src/ecu-survey-ui-runtime.js` installs the panel next to the existing wide diagnostic summary.

The panel shows:

- current responding/planned header count;
- compatible/total local history count;
- latest survey timestamp;
- each `7E0`–`7E7` request header, observed response header and known/unmapped identity;
- repeatability badge;
- the five latest stored topology signatures.

The UI runtime is loaded through the already imported history module. It only reads local survey state, creates DOM elements and listens for a local history-update event. It contains no ELM/OBD transport call and no vehicle command path.

## Next integration step

The next evidence-driven step is to compare stable repeated survey topologies against Techstream Health Check / vehicle equipment evidence before naming any new ECU:

1. collect at least three repeatable real-car survey runs;
2. compare observed responders with Techstream's ECU/system list from the same vehicle;
3. promote an unmapped responder to a named profile ECU only when independent evidence supports the mapping;
4. add equipment expectations only when the specific vehicle configuration supports them.

Future integration must not widen `TOYOTA_READ_DATA_ALLOWED_COMMANDS` or the production IS220d `21xx` profile without separate evidence and review.
