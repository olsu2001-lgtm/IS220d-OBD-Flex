# Query/value visibility diagnostics (source only)

Based on registered 0.9.8 source `25fe7c1735314f64a41e184c494b9bfb396a630a`.
No version allocation or APK build.

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
after more measurements. No new polling loop, query, decoder, ECU write,
permission or interpretation promotion is introduced.

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
