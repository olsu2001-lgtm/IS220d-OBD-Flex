# Mode 09 vehicle identity evidence

Status: **read-only parser for identity results already collected by the existing wide ELM diagnostic**.

## Scope

The wide vLinker / ELM + Toyota diagnostic already sends these standard Mode 09 read requests during its existing `Laaja luku-OBD` phase:

| Request | Interpretation in this layer |
|---|---|
| `0902` | VIN |
| `0904` | Calibration ID |
| `0906` | Calibration Verification Number payload |
| `090A` | ECU name |

`src/mode09-identity.js` does not send these commands. It only reads the completed diagnostic run's existing result objects and parses their stored response data.

This feature therefore adds **zero new vehicle requests**.

## Repository evidence used for comparison

`src/vehicle-identity-evidence.js` mirrors the target-vehicle identity values recorded in `docs/VEHICLE_EVIDENCE.md`:

- VIN: `JTHBB262302028787`
- Calibration ID: `35360000`
- Calibration Verification Number evidence string: `01CAD67F74`

The CVN value is intentionally preserved exactly as documented by the project evidence. This parser does not silently reinterpret or rewrite the evidence representation.

The ECU name has no hard-coded expected value in the current evidence set. A successfully decoded ECU name is therefore marked `observed`, not `match`.

## Parsing behavior

The parser accepts common ELM/CAN forms used by the existing diagnostic report:

- CAN response header plus ISO-TP single frame;
- CAN response header plus ISO-TP first/consecutive frames;
- already formatted application payload containing the positive Mode 09 service byte `49`.

For ISO-TP multi-frame identity responses it checks:

- declared payload length;
- consecutive-frame sequence progression;
- complete payload availability before publishing a decoded value.

VIN output is accepted only as a 17-character VIN using the standard VIN character set. Text fields must consist of printable ASCII after removal of the Mode 09 record/count byte and trailing padding. CVN is retained as payload hex because that matches the current project evidence representation.

## Evidence states

Each identity field is classified as one of:

- `match` — decoded value equals repository vehicle evidence;
- `mismatch` — decoded value differs from repository vehicle evidence;
- `observed` — decoded value exists but no expected repository value is defined;
- `parse-error` — the diagnostic marked a positive/valid response but the complete value could not be decoded safely;
- `not-observed` — no accepted response exists.

Overall identity state is:

- `match` when VIN, Calibration ID and CVN all match;
- `mismatch` if any of those expected fields differs;
- `partial` when some identity evidence or parse failure exists but the complete expected set is not verified;
- `not-observed` when no Mode 09 identity evidence was obtained.

A `mismatch` is an **evidence comparison result**, not an automatic ECU fault verdict. It can indicate, for example, that the diagnostic belongs to another vehicle or that calibration identity has changed and requires investigation.

## ECU Survey integration

`ecuSurveySnapshotFromDiagnosticRun()` attaches the Mode 09 result as `snapshot.identity`. No transport function is called during this step.

The compact local survey history keeps only:

- decoded value;
- expected evidence value when one exists;
- comparison status;
- response CAN header;
- evidence/source identifiers.

It does **not** persist the Mode 09 raw response, command transcript or error text.

The existing ECU Survey report and topology UI display the decoded identity evidence. The UI labels fields as `Täsmää`, `Poikkeaa`, `Havaittu`, `Ei voitu purkaa` or `Ei luettu` and retains the repository evidence boundary.

## Current development boundary

This identity layer does not:

- add Mode 09 requests beyond those already present in the wide diagnostic;
- add Toyota `21xx` identifiers;
- identify unmapped `7E1`–`7E7` responders;
- modify ECU calibration or identity;
- send coding, programming, Active Test, DTC-clear or other write operations.

Future ECU mappings still require independent same-vehicle evidence, preferably repeated ECU Survey observations compared with Techstream Health Check / system inventory.
