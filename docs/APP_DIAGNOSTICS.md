# Query/value visibility diagnostics

Based on registered 0.9.8 source `25fe7c1735314f64a41e184c494b9bfb396a630a`.
Included in the requested 0.9.9 APK, with the source-only diagnostics work reconciled.

Open **Lisää → Kyselyt ja arvot**, run the existing Live reader, reproduce the
problem and generate a report. Generation is a passive snapshot, not a scan.
Every active-profile metric definition is included, even when omitted by the
normal Live view or when no verified live command exists. Missing data stays
null; zero stays a valid value. Rows explain missing definitions, transport
limitations, support-list absence, observed request/response failures,
response-without-state, stale values and mismatching/missing Live cards.

The report includes connection stages, simulation flag, source version,
units, values, timestamps, polling statistics and the latest 400 traffic
events from the existing client logger. Overflow is explicitly counted;
reconnection resets this traffic window. Raw measurement payloads are capped
at 4096 characters per event. Mode 09 identity and adapter responses are hidden.
MAC/VIN-like strings in free-text errors are redacted. Review before sharing.

The copy button uses the clipboard, with a selectable textarea fallback.
The report is not automatically uploaded or persisted. Refresh it manually
after more measurements. Report generation adds no polling loop or vehicle query.

The collapsed comparison section has a separate explicit read button. Stop Live,
recording and tests first. On IS220d with an ELM connection it reads only the existing
2193, 2196 and 21AF screening queries. Results remain labelled Techstream comparison
data, outside normal Live values; missing or implausible values remain null.
The field-rejected 219C injector request remains blocked.

## Target-vehicle field evidence 2026-09-25

On the target IS220d, calibration `35360000`, generic ELM transport with engine ECU
`7E0 -> 7E8` was healthy while the comparison run returned **NO DATA** for all
three direct candidate reads:

- `2193` — fuel temperature candidate;
- `2196` — common-rail pressure candidate;
- `21AF` — injection-timing candidate.

The same field session continued to return a complete `612C00` response for
`212C`, while both formatted and raw-single-frame forms of `217E` and `217F`
returned NO DATA. Therefore these direct query forms must not be described as
vehicle-verified values on this calibration. Their signals require Techstream/J2534
passive capture or equivalent target-vehicle evidence before production promotion.

Report schema v2 keeps this distinction explicit: Toyota discovery NO DATA is
`field-no-response`, Mode 01 support-bit absence remains `not-advertised`, and
values retained after Live is stopped are `cached` rather than `displayed`.
The summary also breaks missing values down by status.

Discovery results now record optional support-page errors and Toyota query forms.
Generic ELM readers participate in profile discovery. Incomplete IS220d formatted
live replies get one attempt using the exact existing raw single-frame form.
Successful forms are remembered for Live. Adapter formatting and filtering are
restored within the same queue transaction; a restoration failure blocks reads
until reconnect. No new identifiers, formulas, ECU writes or permissions are added.

## Limits

- This inventories existing live definitions, not every possible Techstream value.
- All logged query types appear in traffic; only live definitions are mapped to values.
- Quicklynks binary traffic remains separate from ASCII commands. Binary requests
  are not falsely matched to the analogous Mode 01/21 command.
- A recorded response is not proof of successful decoding or a healthy component.
- UI confirmation compares Live-card text to the existing formatter. It does not
  prove on-screen visibility or validate other screens' representations.
- A response without state is labelled a decoder-or-publication gap, not an exact
  diagnosis. Field measurements remain required for real-vehicle verification.
