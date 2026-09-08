# ECU Survey foundation

Status: **policy/data-model foundation, not yet wired to the Android transport or UI**.

This module implements the first reusable part of the historical 0.7.0 ECU Survey roadmap while preserving the current IS220d-only read-only contract.

## Purpose

The August development study identified topology discovery as the next major step before expanding functions or data coverage. It also required equipment-aware interpretation: an optional ECU that is not installed must not automatically be reported as faulty.

`src/ecu-survey.js` turns that requirement into deterministic code.

## Current survey boundary

The executable survey plan is derived only from `IS220D_DIAGNOSTIC_PROFILE.ecuSurvey`:

- CAN request headers: `7E0`–`7E7`;
- safe probe: standard Mode 01 PID `00` (`0100`);
- expected positive response mode: `41`;
- every plan step is `operation: read-only` and `writable: false`.

The survey policy has a hard allowlist containing only `0100`. Changing `safeProbe` to another command makes plan creation fail before transport integration.

No Toyota `21xx` command, service/coding operation, Active Test, DTC clearing or ECU write is introduced by this module.

## Known versus unknown ECUs

The current production profile names only one ECU mapping:

- request `7E0` → response `7E8` → `engine` / 2AD-FHV engine ECU.

The survey **does not derive or guess identities for `7E1`–`7E7`**. A valid response from an address without a profile definition is stored as `unmapped-response` until independent evidence identifies the ECU.

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

The module itself does not open Bluetooth, change ELM settings or send a command.

Observations outside the profile's `7E0`–`7E7` plan are rejected rather than silently added to topology.

## Repeatability gate

`evaluateEcuSurveyRepeatability()` implements the study's topology-repeatability principle.

Default gate:

- at least 3 completed survey snapshots;
- the last 3 responding-topology signatures must be identical;
- only then is `stable: true` returned.

The signature contains request header, observed response header(s) and a profile-defined ECU ID when one exists. Unknown responders remain `unmapped`.

Stable topology is evidence of repeatability, **not proof of ECU identity**.

## Next integration step

The next runtime step should reuse the existing direct-header `0100` diagnostic path rather than create another transport implementation:

1. run the connection preflight with current adapter settings first;
2. execute the validated survey plan through the existing queued ELM command path;
3. convert each result into an ECU Survey observation;
4. preserve complete raw responses in the exported report;
5. compare repeated snapshots and Techstream Health Check before assigning new ECU identities.

Transport integration must not widen `TOYOTA_READ_DATA_ALLOWED_COMMANDS` or the production IS220d `21xx` profile.
