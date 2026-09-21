# DPF/EGR target-vehicle validation plan

Status: **capture tooling implemented; production promotion blocked on target-vehicle Techstream/J2534 evidence**.

This plan exists because the current IS220d profile has historical production requests for DPNR/EGR, while the latest target-vehicle evidence is mixed:

- engine topology is repeatably 7E0 -> 7E8;
- 212C returns a complete 612C response on calibration 35360000;
- 217E and 217F returned NO DATA in three repeated field runs on the same calibration;
- a response from 212C proves only that a readable signal exists. It does not by itself prove that the byte is the physical EGR lift feedback.

The goal is not to scan more guessed PIDs. The goal is to capture what Techstream actually reads on this vehicle and correlate those passive transactions with the values displayed by Techstream.

## Reference values to capture

The first two targets are intentionally narrow:

1. **DPF Differential Pressure (kPa)** from Powertrain / Engine and ECT / Data List / All Data.
2. **EGR Lift Sensor Output (%)** while Techstream/IT2 operates Active Test / Control the EGR Step Position.

Also capture **Engine Speed** and **MAF** as operating-state context.

Toyota/TME service information explicitly distinguishes DPF Differential Pressure from Diff. Press. Sensor Corr. and uses the former together with MAF for DPF/DPNR diagnosis. The same service procedure observes EGR Lift Sensor Output while controlling EGR step position.

External research references used only to design the capture:

- Toyota Motor Europe service bulletin EG-0029L-0909-EN:
  https://www.scribd.com/document/507473097/EG-0029L-0909-EN-AD
- Toyota Motor Europe service bulletin EG-0170T-0311-FR mirror:
  https://manualzz.com/doc/5292663/bulletin-de-service-technique
- J2534 logger shim project:
  https://github.com/joeyoravec/j2534-logger

These references do **not** authorize a raw request or conversion in Flex. The target vehicle capture is the promotion gate.

## How to capture Techstream traffic

The preferred method is a J2534 shim/logger between Techstream and the actual MINI VCI J2534 DLL. A suitable logger must record PassThruWriteMsgs payloads, PassThruReadMsgs payloads, order/timestamps, and CAN/ISO15765 message bytes including the 7E0/7E8 relationship.

The repository passive parser reconstructs ISO-TP single- and multi-frame payloads before looking for diagnostic services. Incomplete or out-of-sequence multi-frame responses are discarded instead of being correlated as partial Data List values. It accepts both compact lines such as:

    TX 7E0 02 21 AB 00 00 00 00 00
    RX 7E8 06 61 AB 01 02 03 04 05

and common J2534 log lines where the CAN ID is a four-byte prefix:

    data = { 00 00 07 E0 02 21 AB 00 00 00 00 00 }
    data = { 00 00 07 E8 06 61 AB 01 02 03 04 05 }

Flex performs **offline passive analysis only**. The capture parser does not send a request to the car and does not modify the production allowlist.

## DPF capture sequence

Use a warm engine except for the KOEO zero point. Keep each phase as a separate short Techstream/J2534 capture so the physical state is unambiguous.

| Phase | Condition | Record from Techstream |
|---|---|---|
| dpf-koeo | ignition ON, engine OFF | DPF Differential Pressure |
| dpf-idle | stable warm idle | DPF Differential Pressure, RPM, MAF |
| dpf-1500 | ~1500 rpm, no load | DPF Differential Pressure, RPM, MAF |
| dpf-2000 | ~2000 rpm, no load | DPF Differential Pressure, RPM, MAF |
| dpf-2500 | ~2500 rpm, no load | DPF Differential Pressure, RPM, MAF |
| dpf-3000 | ~3000 rpm, no load | DPF Differential Pressure, RPM, MAF |

The KOEO phase gives a useful zero-flow reference. The changing RPM phases provide enough signal variation to distinguish the actual pressure channel from constants, flags and unrelated bytes.

Do not use Diff. Press. Sensor Corr. as the reference value.

## EGR capture sequence

Warm coolant above the service-procedure threshold and keep each step as a separate capture.

| Phase | Techstream action | Record |
|---|---|---|
| egr-idle | no commanded step change | EGR Lift Sensor Output |
| egr-step-20 | Control the EGR Step Position = 20 | EGR Lift Sensor Output |
| egr-step-40 | Control the EGR Step Position = 40 | EGR Lift Sensor Output |
| egr-step-60 | Control the EGR Step Position = 60 | EGR Lift Sensor Output |
| egr-step-80 | Control the EGR Step Position = 80 | EGR Lift Sensor Output |

The Active Test is performed by Techstream as reference equipment. Flex does not implement or transmit the Active Test. Flex only analyzes the captured read traffic afterward.

This sequence also answers the 212C question. If 212C follows the commanded step but not the Techstream lift feedback, it is not the actual lift signal. If another request/byte follows the lift feedback over all steps, that becomes the better research candidate.

## Offline correlation in Flex

src/dpf-egr-capture-analysis.js accepts a phase bundle containing the Techstream reference value for each phase and the matching passive J2534 trace.

The bundle is target-vehicle-specific: its calibration ID must be `35360000` and phase IDs must be unique. Repeating the same physical state does not satisfy the promotion gate; a research candidate needs at least four independently varying raw/reference states, and the strongest class needs at least five.

For every observed read request/response pair it tests, without transmission:

- each 8-bit response byte;
- each adjacent 16-bit big-endian word;
- each adjacent 16-bit little-endian word.

For each channel it fits only the simple affine form:

    value = raw * scale + offset

and reports phase count, R², RMSE, normalized RMSE and the candidate formula.

A high correlation is still only a **research candidate**. The analyzer always reports authorizationChanged=false, vehicleCommandSent=false and productionVerified=false.

## Promotion gate into real Flex live data

A DPF or EGR signal may move into the normal live profile only after all of the following are recorded:

1. Techstream Data List item and unit are unambiguous.
2. The matching J2534 request/response is repeatable across at least four sufficiently different physical states; five or more is preferred.
3. The response byte/word and conversion reproduce the Techstream values with small residual error.
4. The candidate is checked against raw target-vehicle traffic, including negative-response and payload-length behavior.
5. Flex then sends only that independently captured **read-only** request on a dedicated validation build.
6. Flex and Techstream are run in matching operating states and the numerical values are compared again.
7. At least three target-vehicle validation runs repeat the result.
8. Only then is a separate source change allowed to mark the decoder vehicle-verified and publish the value in normal live data.

No correlation result may automatically edit src/is220d-profile.js.

## What to bring back from the car

For the next development step, the smallest useful evidence package is:

- one Techstream Data List CSV/text export containing DPF Differential Pressure, Engine Speed and MAF over the DPF phases;
- the J2534 log for those same phases, preferably one file per phase;
- EGR Lift Sensor Output values for idle and 20/40/60/80 Techstream step phases;
- matching J2534 logs for each EGR phase;
- confirmation that the connected ECU calibration is still 35360000.

Once those captures exist, the repository tooling can rank the actual request, byte offset and conversion without guessing another PID.
