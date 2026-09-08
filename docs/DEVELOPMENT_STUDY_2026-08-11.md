# Development study digest — 2026-08-11

Source: `IS220d_OBD_Flex_kehitysselvitys_2026-08-11.docx`, dated 11 August 2026. The original 40-page document remains in the project Drive.

This is a source-faithful digest of the study's architecture, evidence model, roadmap and test strategy. The study was written against Flex 0.6.5 and therefore contains plans that are now historical. Where it proposed later service or coding work, the **current repository contract supersedes those proposals**: the active project is read-only and does not authorize service writes, coding, Active Tests or ECU programming.

## Study objective

The study examined how the then-current IS220d OBD Flex 0.6.5 could evolve into a Lexus-specific diagnostic and customization tool. It used a Link/Code product split as the conceptual target while keeping IS220d vehicle architecture and evidence requirements central.

The study explicitly treated `IS220d OBD Classic` as a separate product and did not propose merging its lifecycle into Flex.

## Evidence levels used by the study

| Level | Meaning in the source study | Publication interpretation |
|---|---|---|
| `V` | Verified from current code, repair information, Techstream documentation or other source; vehicle behavior measured when needed | Candidate for release when acceptance criteria are met |
| `J` | Technically derived from sources but not yet confirmed on the target IS220d / equipment combination | Research / alpha only |
| `A` | Address, frame, precondition, variant or consequence still open | Not publishable |

The current repository's `vehicle-verified`, `techstream-derived` and `research-candidate` labels are conceptually compatible with this evidence-first approach, although they are not identical historical labels.

## Scope of the 2026-08-11 study

Included in the study:

- Flex 0.6.5 source, tests and Android path;
- vLinker MC+ as the primary mobile adapter candidate;
- CAN read operations;
- K-line / gateway research;
- DTC and Data List architecture;
- Techstream concepts and repair-manual Customize inventory as research inputs;
- Mini-VCI / J2534 as a lab/reference environment.

Explicitly outside the study's first-release scope:

- merging IS220d OBD Classic into Flex;
- distributing Techstream databases with the app;
- ECU flashing;
- key registration / immobilizer work;
- safety-system programming;
- using J2534 as the Android production transport in the first releases.

## Vehicle network model captured by the study

### DLC3 physical paths

| Path | Source-study interpretation | Development implication |
|---|---|---|
| DLC3 pins 6 / 14 | CANH / CANL, ISO 15765-4, 500 kbit/s | primary powertrain / chassis diagnostic path |
| DLC3 pins 7 / 5 | SIL / SG, ISO 9141-2 | gateway / BEAN diagnostic research path |
| Gateway ECU | network bridge | vehicle/equipment topology matters before interpreting missing ECUs |

### Network layers

The study distinguished:

- CAN at 500 kbit/s for powertrain/chassis-related controllers;
- BEAN, documented as a low-speed body network, for body/customize-related systems via the gateway;
- AVC-LAN for audio/visual components, not a first-phase target.

The central design conclusion was that extending CAN requests alone would not provide full access to the body/customize architecture.

### CAN-side ECU inventory used for planning

The study identified these as first survey targets or topology participants, subject to actual equipment:

- ECM;
- Skid Control ECU;
- Steering Angle Sensor;
- Yaw Rate Sensor;
- Center Airbag Sensor;
- Gateway ECU;
- Power Steering ECU;
- Television Camera ECU as an optional example.

The proposed first step was identity/status/DTC-style read-only discovery, not calibration or actuator control.

### BEAN/body inventory captured by the study

The repair-information inventory listed 20 possible BEAN-side nodes, with equipment/market conditions affecting presence:

1. Gateway ECU
2. Main Body ECU LH
3. Main Body ECU RH
4. Tilt/Telescope ECU
5. Power Window Master Switch
6. Outer Mirror ECU LH
7. Power Seat ECU RH
8. Certification ECU
9. Front Controller
10. Outer Mirror ECU RH
11. Power Seat ECU LH
12. Sliding Roof ECU
13. Rain Sensor
14. Power Source Control ECU
15. Wiper Switch Assembly
16. Combination Meter ECU
17. Clearance Warning ECU
18. AFS ECU
19. A/C Amplifier
20. Double Door Lock ECU

The important interpretation rule in the study was: **an absent optional ECU is not automatically a fault**. A survey needs an equipment-aware state such as expected/responding, expected/not responding, and not expected/not applicable.

## Architecture and product direction proposed in the study

The study separated the envisioned product into:

- **Flex Link** — diagnostics, health check, DTC, live data and reports;
- **Flex Code** — a future, heavily gated Customize research direction;
- **Research Mode** — evidence collection, transcripts and definition validation;
- Quicklynks retained as a restricted read-only transport rather than a general manufacturer-command transport.

This historical split is useful architectural context, but the active 0.6.9 repository currently implements only the read-only IS220d diagnostic direction.

## Original roadmap

| Historical phase | Planned output in the study |
|---|---|
| 0.7.0 ECU Survey | protocol-core refactor, vLinker profile, CAN survey, K-line research framework, evidence report |
| 0.8.0 Flex Link MVP | detected-system view, identities, selected ECU DTC/FFD, ECU report |
| 0.8.x Coverage | ECU definition packs, Data List groups, dashboard/CSV |
| 0.9.0 Flex Link Service | selected service functions under a separate risk gate |
| 1.0.0 Flex Code Beta | selected Customize candidates with snapshot/diff/readback/restore concept |

Only the **read-only diagnostic and evidence-management ideas** should be considered active candidates under the current repository rules. The service/code rows above are historical planning information, not permission to implement writes.

## Work packages in the study

The source report grouped the effort into:

- WP0 — baseline and governance;
- WP1 — transport hardening;
- WP2 — protocol core;
- WP3 — ECU survey;
- WP4 — Flex Link;
- WP5 — Data List coverage;
- WP6 — safe service research;
- WP7 — Code engine research;
- WP8 — Customize definitions research;
- WP9 — release hardening.

For the current repository, WP0–WP5 and WP9 contain the most directly reusable concepts. WP6–WP8 remain historical research areas outside the current executable safety boundary.

## Testing strategy captured by the study

The report proposed layered validation:

- unit tests for parsers, serialization, state machines and policy;
- property/fuzz tests for malformed and truncated frames;
- transcript replay for complete ECU sessions;
- transport integration tests for RFCOMM/BLE lifecycle behavior;
- hardware-in-the-loop tests for adapters, delay, disconnect and voltage behavior;
- vehicle validation in KOEO, idle and read-only driving conditions;
- reference comparison against Techstream for ECU lists, DTC, Data List and later research targets.

This remains strongly aligned with the current repository's replay, deterministic tests and field-verification policy.

## Technical debt noted against Flex 0.6.5

The August study called out:

- large `core.js` / `main.js` modules coupling protocol, state and UI;
- a hand-maintained Smali/native bridge that was difficult to debug and test;
- a build path that patched third-party/template components;
- Android permission handling that did not yet cleanly separate legacy and Android 12+ models.

These findings describe the 0.6.5 baseline and should be re-audited against current source before opening new work items; they are not assumed to remain unchanged.

## Customize inventory

The source study counted 72 repair-manual Customize rows across 14 system groups and used them to prioritize research. The detailed manual table is intentionally **not copied into this repository**. The count and design implication are retained: documentation of a setting is not proof of a safe or known protocol transaction.

## Source-study conclusion retained for current development

The most durable conclusion from the report is the development order:

**topology before functions, read before write, evidence before UI promises.**

Under the present IS220d-only repository contract this is tightened further:

- topology and transport evidence before expanding data coverage;
- vehicle-verified read paths before publishing interpreted values;
- no write/service/coding path unless the repository's explicit safety contract is separately changed and reviewed in the future.
