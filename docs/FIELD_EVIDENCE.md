# Flex field evidence retained from Drive

This file summarizes field captures that materially help transport and protocol development. It intentionally omits full Bluetooth addresses and other unnecessary device identifiers.

Field reports are evidence about a specific adapter/session. They do not expand the production command allowlist.

## Target vehicle identity

See [`VEHICLE_EVIDENCE.md`](VEHICLE_EVIDENCE.md) for the persistent target-vehicle facts used to correlate captures:

- Lexus IS220d / XE20 / 2AD-FHV;
- ISO 15765-4 CAN, 11-bit, 500 kbit/s;
- engine response CAN ID `7E8`;
- calibration ID `35360000`;
- CVN `01CAD67F74`.

## 2026-08-17 — generic ELM327 / Classic diagnostic capture

Historical application: `Lexus OBD Flex 0.7.5`.

The saved wide ELM/CAN report showed:

- Android/WebView session completed rather than crashing;
- adapter identity `ELM327 v2.1`;
- adapter reported ISO 15765-4 CAN 11/500;
- OBD connector voltage was reported as approximately 12.1 V;
- `ATTP6` and `ATSP6` were accepted;
- no valid Mode 01 ECU response was obtained in that run;
- summary recorded 0 valid OBD responses despite the adapter itself responding to multiple AT capability/status commands;
- the diagnostic run lasted roughly 111 seconds and preserved the failure stages for analysis.

Development implication: **adapter responsiveness is not equivalent to ECU connectivity**. Connection UI/reporting must preserve Bluetooth, adapter/ELM and ECU states separately and must not mark the vehicle connection successful based on `ATI` or protocol-description responses alone.

The exact Bluetooth address from the archived report is deliberately not reproduced here.

## 2026-08-17 — Quicklynks BLE diagnostic capture

Historical application: `Lexus OBD Flex 0.7.5`.

The saved Quicklynks wide-diagnostic report confirmed a working FFF0/FFF6 binary session:

- transport: Bluetooth LE / Quicklynks FFF0/FFF6;
- FFF6 notification path enabled;
- verified main-frame status: PASS;
- recorded verified raw main frame: `134114403300015581000404DB002524AB00A0FF`;
- RPM interpretation in that session: approximately 1296 rpm;
- Android API 35;
- report kept the Quicklynks binary transport separate from ASCII ELM traffic.

The report's own safety boundary stated that the transport used only the known Quicklynks binary framing and restricted `02 41 PID` read candidates; it did not use ELM ASCII Toyota `21xx`, Mode 04, Active Test, ECU writes or forced regeneration on the Quicklynks path.

Development implication: the captured frame is useful regression evidence for the known Quicklynks parser/transport, but it is **not evidence that arbitrary Toyota manufacturer requests can be wrapped in FFF6**.

The exact Bluetooth address from the archived report is deliberately not reproduced here.

## Current 0.6.9 vehicle-verification status

The GitHub 0.6.9 build/test report records 102/102 software tests and successful debug/release builds, but also states that the physical IS220d + Vgate vLinker MC+ DPNR verification still needs to be performed.

Therefore:

- replay/simulation success proves software behavior only;
- a future field capture should preserve raw `217E`, `217F` and `212C` responses;
- DPNR interpreted values should be compared against Techstream on the same operating condition;
- suspicious fixed values (for example identical DPNR temperatures) should remain observations until the raw response and reference measurement establish the cause.

## Evidence handling rules

When new field reports are imported:

1. retain app/profile version, transport type, adapter family, protocol, timestamps and raw ECU/transport payloads needed for reproducibility;
2. redact full Bluetooth addresses and unrelated device identifiers from committed summaries;
3. distinguish adapter-level success from ECU-level success;
4. label whether a result is vehicle-verified, Techstream-derived or research-only;
5. never promote an unknown command or conversion into production solely because it appears in a historical report.

## 2026-09-10 — Flex 0.8.0 repeated vehicle validation

Three completed vLinker MC+ BLE runs on calibration `35360000` established a
stable `7E0 -> 7E8` engine topology. VIN, CALID and CVN matched in every run,
the initial and restored `0100` probes passed, and `212C` returned a complete
`61 2C 00` response.

The same runs returned `NO DATA` for `217E` and `217F` in formatted,
response-filtered and raw single-frame forms. These are negative support
observations, not DPNR fault verdicts.

A subsequent user-started injector screen returned `NO DATA` for `219C` and
the Android WebView remained in the synchronous restoration phase. Flex 0.8.1
therefore field-disables `219C` before transport and exposes completed/error
reports before running a short, bounded adapter restoration. The injector screen
stays unavailable until the correct Data List transaction is independently
captured with Techstream.

The reports included a full Bluetooth address and VIN. Those identifiers are
not reproduced in this repository summary.
