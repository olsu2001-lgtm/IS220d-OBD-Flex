# Techstream 12.20.024 static request trace — IS220d / 2AD-FHV

Status: **Priority #1 static research. No command in this document is production-authorized.**

This note records the static trace recovered from the user-supplied Techstream 12.20.024 VM.
It exists to prevent the earlier mistake of treating a Techstream signal identifier as the
ECU communication PID.

## Extracted source chain

The split archive contains a Techstream OVA/Windows VM. The relevant EU files recovered from
the VM include:

- `EU/Data/PIDGroup/Brand/330/Engine Control.CT`
- `EU/Data/PIDGroup/Brand/330/Common Rail (All).CT`
- `EU/DB/ECD_P3.ddb`
- `EU/DB/Engine_P3.ddb`
- `EU/DB/Engine_P4.ddb`

Relevant runtime modules include:

- `GetPIDSignalData_DT.dll`
- `GetDatMonSignalInfo.dll`
- `KgpDataCtrl.dll`
- `CommandCommon.dll`
- `CommandDataLib.dll`
- `CSDFCommControler.dll`
- `J2534Ctrl.dll`
- `PassThruWrapNK.dll`

The DLL symbols expose the expected chain: signal metadata -> DB record -> communication
PID -> communication command -> J2534.

Observed names include `CDbPidTable`, `CDbPidResRecords`,
`CDbCommPidDataTable`, `CDbCommPidDataResRecords`, `CDbCustPidTable`,
`CDbMultiPIDIDTable`, `CDbSupPidTable`, `CCmdCommPidData::GetPidData`,
`CCmdCommPidDataEx`, `GetPidIdDataP3` and `GetEcuPidIdDataP3`.

## .CT layer: logical signal IDs

The `.CT` files are grouping/selection metadata. Their IDs are logical Techstream signal
IDs, **not request identifiers**.

Recovered examples:

| Techstream item | Logical signal ID |
| --- | ---: |
| Engine Speed | `0x013B` |
| Vehicle Speed | `0x013C` |
| Injection Feedback Val #1 | `0x0170` |
| Injection Feedback Val #2 | `0x0171` |
| Injection Feedback Val #3..#8 | `0x0172..0x0177` |
| Fuel Temperature | `0x0193` and later-family IDs also exist |
| DPNR Status Reju (S) | `0x01A9` |
| DPNR/DPF Status Reju (PM) | `0x01AA` |
| EGR Lift Sensor Volt % | `0x01B3` |
| Diff. Press. Sensor Corr. | `0x01A7` |
| Pre Injection Timing | `0x043B` |
| Pilot 1 Injection Timing | `0x016B` |
| Pilot 2 Injection Timing | `0x016C` |
| Main Injection Timing | `0x016D` (additional later-family IDs exist) |
| After Injection Timing | `0x016E` |

This corrects the old assumption that identifiers such as `0x0193`, `0x0196`,
`0x019C` or `0x01AF` could be converted directly into `2193/2196/219C/21AF`.

## Engine_P3.ddb 84-byte signal-record observations

The extracted v12 `Engine_P3.ddb` contains a fixed 84-byte record family around the
logical Data List IDs. **Its exact Techstream table/class identity is not yet proven.**
It must not be called `CDbPidTable`: independent newer-Techstream factory evidence
shows the actual `CDbPidTable` as a separate compact table. The modern P5 Data Monitor
record grammar was also tested against these v12 rows and does not fit.

What is directly observed in repeated v12 records:

- offset `+40`: the same logical Techstream signal ID used by the `.CT` grouping layer;
- offset `+44`: a second compact field shared by groups of related signals;
- offsets `+46/+48`: structured per-signal position/range fields;
- later fields vary with conversion/presentation/applicability metadata.

Thus the important proven result is narrower than the earlier interpretation: the logical
signal ID and the compact `+44` field are distinct. The semantic name
`communication PID` for `+44` remains a research hypothesis until its consumer is
traced through the v12 command/DDB code path.

### Control records

Engine Speed:

- signal ID: `0x013B`
- communication PID candidate: `0x39`
- response range metadata: `16..23`

Vehicle Speed:

- signal ID: `0x013C`
- communication PID candidate: `0x39`
- response range metadata: `8..15`

Two independent logical signals therefore share one communication group but occupy different
positions in its response. This is incompatible with interpreting the logical signal ID itself
as the request PID.

### Injection feedback

Injection Feedback Val #1:

- logical ID `0x0170`
- communication PID candidate `0x01`
- response range metadata `12..13`

Injection Feedback Val #2:

- logical ID `0x0171`
- communication PID candidate `0x01`
- response range metadata `10..11`

The adjacent feedback values are therefore packed in one communication response. The previous
`219C` request was derived from the wrong abstraction and remains field-rejected.

### EGR

EGR Lift Sensor Volt %:

- logical ID `0x01B3`
- communication PID candidate `0x01`
- response position metadata `20..20`

This places the EGR lift item in the same communication group family as several injection
signals. The currently responding `212C -> 612C00` transaction must not be equated with
Techstream EGR Lift Sensor Output until the two are correlated.

### DPNR status

DPNR Status Reju (S):

- logical ID `0x01A9`
- communication PID candidate `0x3E`
- response range metadata begins `0..7`

DPNR/DPF Status Reju (PM):

- logical ID `0x01AA`
- communication PID candidate `0x3F`
- response range metadata begins `8..15`

These records are a different mapping from the old `217E/217F` production assumptions.

### Fuel temperature proves variant-dependent mappings

The logical Fuel Temperature ID `0x0193` occurs in more than one valid P3 record.

Observed mappings include:

- communication PID candidate `0x35`;
- communication PID candidate `0x01`.

Therefore a logical signal cannot be mapped to a request without also resolving the
vehicle/ECU applicability record. Selecting the first matching signal ID is unsafe.

## P3 runtime support evidence

The user-supplied Techstream 12.20.024 binaries expose P3-specific command paths:

- `CCmdValidIdListPidP3`;
- `GetPidIdDataP3`;
- `GetEcuPidIdDataP3`;
- `CCmdCommPidData::GetPidData`;
- `CCmdCommPidDataEx`.

The same v12 `CommandCommon.dll` contains the diagnostic string:

`When PID[0x%02X] is not in the response of Mode$A8(E8 01 %02X).`

This is direct static evidence that P3 PID availability is resolved at runtime with an
`A8` request and an `E8 01 ...` response. Independent Toyota diagnostic captures
show the corresponding `A8 01` request returning an `E8 01` payload containing
PID-like entries and associated lengths/masks. That external capture is structural
corroboration only; its contents are not assumed to describe this IS220d ECU.

Working model, pending exact v12 consumer tracing:

`.CT logical signal -> v12 84-byte signal record -> compact +44 key -> P3 runtime A8/E8 support resolution -> CCmdCommPidData/GetPidIdDataP3 -> actual read frame`.

This model also explains why duplicate logical signals can coexist in the database without
making either mapping universally valid. The target ECU's runtime support result and vehicle
applicability must both be resolved.

## Communication service evidence

Techstream binaries contain P3 helpers named `GetPidIdDataP3`,
`GetEcuPidIdDataP3` and `CCmdValidIdListPidP3`. A diagnostic log string in
`CommandCommon.dll` references a PID support query as
`Mode$A8(E8 01 ...)`.

Independent Toyota CAN traces also show the same protocol family using `21 xx` reads
with `61 xx` positive responses and an `A8 01` support query with an `E8 01`
response. This makes `21 <communication PID>` a strong protocol-level hypothesis for
the P3 communication-PID field, but it is still not a target-vehicle authorization.

Current **unverified** static hypotheses include (kept only to guide tracing; the +44 consumer is not yet proven):

| Signal family | DDB communication PID | Static request hypothesis |
| --- | ---: | --- |
| Injection Feedback #1/#2/... | `0x01` | `2101` |
| EGR Lift Sensor Volt % | `0x01` | `2101` |
| Engine/Vehicle Speed Techstream group | `0x39` | `2139` |
| Fuel Temperature, one variant | `0x35` | `2135` |
| Fuel Temperature, another variant | `0x01` | `2101` |
| DPNR Status Reju (S) | `0x3E` | `213E` |
| DPNR/DPF Status Reju (PM) | `0x3F` | `213F` |

These are **research candidates** only. Flex must not transmit them from normal Live data
until the applicability record for the target ECU/calibration is resolved and the exact
request/response is verified.

## Target-vehicle filter

Target vehicle evidence for calibration `35360000`:

- engine ECU addressing `7E0 -> 7E8`;
- `212C -> 612C00` responds repeatedly;
- `217E`, raw `02217E0000000000`, `217F`, raw `02217F0000000000`,
  `2193`, `2196`, `219C` and `21AF` have returned no usable target-vehicle data.

This is consistent with the static finding that the old signal-ID-to-request mapping was wrong.

## Remaining Priority #1 gate

Before any candidate is promoted:

1. resolve which duplicate P3 record/applicability entry belongs to 2AD-FHV and calibration
   `35360000` / ECU software family `89663-53600`;
2. complete the `CDbCommPidDataTable` / `CCmdCommPidData::GetPidData` trace far enough
   to confirm that record offset `+44` is the local identifier consumed by service `0x21`;
3. recover the full response layout and conversion record for the target signal;
4. compare the resulting read-only transaction with the target vehicle;
5. only then modify the production profile.

J2534 passive capture remains the fallback when static applicability cannot be resolved.
