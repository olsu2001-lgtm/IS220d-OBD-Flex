# Target vehicle evidence

This file records project evidence that is useful for reproducing and validating the active IS220d profile. It is evidence/documentation only; executable constants remain in `src/is220d-profile.js` and `docs/PROTOCOL.md`.

## Vehicle identity

| Item | Value |
|---|---|
| Vehicle | Lexus IS220d / XE20 / 2AD-FHV |
| VIN | `JTHBB262302028787` |
| OBD protocol | ISO 15765-4 CAN, 11-bit, 500 kbit/s |
| ELM protocol number | `6` |
| Observed engine ECU response CAN ID | `7E8` |
| Calibration ID | `35360000` |
| Calibration Verification Number | `01CAD67F74` |

The project OBD evidence file records protocol 6, response CAN ID `7E8`, calibration ID `35360000`, CVN `01CAD67F74` and the VIN above.

## Current production relationship

The active repository profile uses:

- engine request CAN ID `7E0`
- engine response CAN ID `7E8`
- Toyota Read Data `217E`, `217F` and `212C`

The OBD identity evidence above supports the bus/profile identity but does **not** by itself prove individual Toyota request byte layouts or conversion formulas. Those remain governed by the active profile evidence and regression tests.

## Development use

Use this file when checking:

- whether a captured diagnostic report belongs to the intended test vehicle;
- whether an adapter reports the expected CAN protocol;
- whether calibration evidence has changed between test sessions;
- whether a future vehicle/profile change requires a separate profile rather than silently altering the IS220d profile.

Do not hard-code additional commands from vehicle identity evidence alone.
