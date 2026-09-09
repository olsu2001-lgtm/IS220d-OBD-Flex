# Evidence Support Bundle v1

Status: **compact local read-only evidence export for field-validation review and support analysis**.

## Purpose

The full Flex diagnostic report intentionally retains raw ELM/CAN responses so protocol and parser behavior can be traced when necessary. That full report is useful for deep investigation, but it is larger than needed for the normal three-run ECU Survey validation review.

Evidence Support Bundle v1 provides a second, deliberately compact JSON export for ordinary support analysis. It summarizes the already stored ECU Survey / field-validation / Techstream-reference evidence and sends no command to the vehicle.

Typical workflow:

1. install a commit-traceable Flex APK from the repository CI artifact;
2. run the wide diagnostic three times under the same declared engine state;
3. review the `Kenttävalidointi · 0.7.0-portti` state;
4. optionally import the neutral Techstream reference JSON;
5. press **Kopioi evidenssipaketti**;
6. paste the resulting JSON into the project analysis conversation;
7. provide a full raw diagnostic report separately only if protocol-level investigation is needed.

## Schema identity

Top level:

```json
{
  "schemaVersion": 1,
  "bundleType": "is220d-obd-flex-evidence-support",
  "generatedAt": "...",
  "mode": "read-only-evidence",
  "profileVersion": "...",
  "safeProbe": "0100",
  "buildSha": "...",
  "fieldValidation": {},
  "runs": [],
  "techstream": {},
  "privacy": {}
}
```

The bundle is an analysis/support format. It is not a replay fixture, vehicle profile or command definition.

## Included field-validation evidence

The bundle carries the current three-run validation summary:

- status and `readyForTechstream` state;
- required/observed run count;
- embedded Build SHA;
- declared engine state;
- stable topology signature when established;
- individual validation checks and their PASS/PENDING details;
- external evidence still pending.

For up to the latest three runs in the current validation group it carries:

- run ID and timestamps;
- Build SHA;
- declared engine state;
- selected existing connection strategy label;
- topology signature;
- whether `7E0 → 7E8` was observed;
- Mode 09 identity **status only**;
- current-settings `0100` observed/pass state;
- restoration `0100` observed/pass state;
- cancellation/internal-failure flags;
- compact `217E`, `217F`, `212C` attempt/positive/status/query-form/response-header information.

If a complete validation group does not yet exist, the bundle falls back to the latest three stored survey snapshots so an incomplete run can still be reviewed.

## Identity privacy boundary

The compact ECU Survey local history contains decoded identity values because it supports the on-device match/mismatch view. Evidence Support Bundle intentionally does not copy those values.

For VIN, Calibration ID, CVN and ECU name the support bundle carries only:

- parser/evidence status (`match`, `mismatch`, `observed`, etc.);
- response header when known;
- whether an observed value existed;
- whether an expected evidence value existed.

It does **not** copy the VIN, Calibration ID, CVN or ECU-name value itself.

## Excluded diagnostic data

The bundle deliberately excludes:

- raw CAN/ELM responses;
- ISO-TP payloads;
- raw Mode 09 payloads;
- adapter identity strings;
- Bluetooth MAC/device addresses;
- arbitrary diagnostic error strings;
- full adapter capability-probe output;
- vehicle identity values.

The `privacy` object records these exclusions explicitly so the receiving analysis can tell which evidence class is intentionally absent rather than assuming it was lost.

## Toyota read-data representation

The three current production Toyota identifiers remain the only manufacturer read-data identifiers summarized:

- `217E`;
- `217F`;
- `212C`.

The bundle may state that a request was attempted, whether a positive response was accepted, the normalized result state, the successful query form and response CAN header(s). It does not include the response payload.

Protocol-level questions therefore still require the original full diagnostic report.

## Techstream reference evidence

If a neutral Techstream reference has been imported, the bundle includes:

- reference metadata;
- transcribed systems and DTC codes;
- explicit candidate/verified CAN mappings and their evidence notes;
- the current Flex comparison status;
- mapping observation states;
- unmapped Flex responders;
- unmapped Techstream systems.

It does not parse or include proprietary Techstream files. A system name still never creates a CAN mapping automatically.

## Read-only boundary

The bundle module is a pure transform of data already present in the local history summary.

It does not:

- access the Bluetooth transport;
- call the ELM client;
- change CAN headers or protocol;
- run a diagnostic;
- add a Toyota request;
- use network APIs;
- alter the production allowlist.

The UI performs only a local JSON build and clipboard copy. If clipboard access is unavailable, it exposes the same JSON in a local read-only text field for manual copying.

## Review use

The support bundle is sufficient for normal questions such as:

- did all three field-validation runs belong to the same build/state group?;
- was topology stable?;
- did the engine relationship repeat?;
- did Mode 09 evidence match on every run?;
- were all three current Toyota read paths exercised?;
- did the restoration verification pass?;
- does the imported Techstream reference contain an explicit mapping discrepancy?;

It is not sufficient for questions that require exact response bytes, ISO-TP reconstruction, parser-offset verification or adapter/ELM timing analysis. For those cases, attach the corresponding full raw diagnostic report as separate evidence.
