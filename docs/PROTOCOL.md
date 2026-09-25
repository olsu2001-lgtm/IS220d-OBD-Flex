# Verified protocol profile

This document records the production Toyota Read Data boundary for the 2008
Lexus IS220d / XE20 / 2AD-FHV European profile.

## ECU and bus

| Item | Value |
|---|---|
| Bus | ISO 15765-4 CAN, 11-bit, 500 kbit/s |
| ELM protocol | 6 |
| Engine request header | `7E0` |
| Engine response header | `7E8` |
| Profile | `is220d-xe20-2ad-fhv-readonly-v1` |

## Toyota production allowlist

| Purpose | Formatted request | Exact raw single frame | Required response prefix |
|---|---|---|---|
| DPNR pressure and regeneration states | `217E` | `02217E0000000000` | `617E` |
| DPNR inlet and outlet temperatures | `217F` | `02217F0000000000` | `617F` |
| EGR production signal (legacy label: position; commanded-vs-lift semantics pending Techstream capture) | `212C` | `02212C0000000000` | `612C` |

The executable source of truth is `src/is220d-profile.js`. These are the
normal production live-data requests. This allowlist status does not by itself
prove that a displayed semantic label matches the Techstream Data List item.
Target-vehicle evidence from 2026-09-10 returned `NO DATA` for `217E`/`217F`
and a complete `612C` response for `212C`; the DPF/EGR semantic cross-check is
therefore tracked separately in `DPF_EGR_VEHICLE_VALIDATION.md`.

`2193` (fuel temperature), `2196` (rail pressure) and `21AF` (injection
timing) remain Techstream-derived screening candidates outside normal live
polling. The `219C` injection-feedback candidate is field-disabled: it returned
`NO DATA` in three repeatable runs on calibration `35360000`. Flex must reject
`219C` before transport until an independently captured Techstream Data List
transaction verifies the correct request and response layout for this vehicle.

## Current conversions

- DPNR differential pressure: `raw16 * 0.0039 - 5 kPa`
- DPNR inlet and outlet temperatures: `raw16 * 0.625 °C`
- EGR position: `raw8 * 100 / 255 %`

Derived values are published only after response identity, payload completeness
and plausible-range checks succeed. Raw `217E`, `217F` and `212C` responses are
retained in the driving-log schema for independent review.

## Evidence states

| State | Meaning | Production use |
|---|---|---|
| `vehicle-verified` | Confirmed against the target vehicle/evidence set | Allowed |
| `techstream-derived` | Derived from Techstream definitions, pending vehicle confirmation | Label and validate first |
| `research-candidate` | Hypothesis or unexplained traffic | Raw research only |

No evidence state permits a write operation.

