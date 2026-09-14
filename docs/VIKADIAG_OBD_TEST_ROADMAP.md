# Vikadiag OBD test roadmap

This is a source-only development track. It does **not** allocate a new Flex
version and it does not build, register or distribute an APK.

## Source of truth

The row review starts from the current Google Drive workbook `Bom-kaapija`, tab
`Vikadiag_kohteet`. The executable preliminary catalog is
`src/is220d-vikadiag-obd-test-catalog.js`.

The Drive row remains the diagnostic intent and service context. Flex does not
copy every Techstream capability literally. Anything that would require Active
Test, forced regeneration, DTC clearing or a write remains excluded from the app.
A row may still use the corresponding read-only live data as diagnostic evidence.

## Per-row conversion contract

Each OBD/Techstream-relevant Drive row is reviewed into a catalog entry with:

- Drive source row, diagnostic group, PNC/OE and component identity;
- direct or indirect OBD role;
- implementation readiness;
- named Flex diagnostic signals, never a new raw command embedded in the row;
- blocked or missing signals when the Drive test needs data Flex has not verified;
- explicit excluded actions when the Drive text mentions a write/actuation path;
- repair-manual visual extraction metadata;
- a short note describing what the first safe guided test can and cannot prove.

A candidate is not considered ready merely because Techstream has a Data List
item. A ready candidate may reference only signals already production-authorized
by `src/is220d-diagnostic-signals.js`. Techstream-derived or research signals stay
pending until their request, response layout and conversion are verified on the
target vehicle. Field-rejected signals cannot be evidence for a ready test.

## Repair-manual visual requirement

Every future guided component test must have a visual plan. The image is to be
**extracted from the Lexus IS250/220D repair manual**, not generated. The catalog
stores search terms while the exact manual section/figure is still being located.
Later, the extracted and appropriately cropped project asset can fill `assetPath`
and `manualReference`.

The visual should identify the actual component and useful nearby landmarks or
connectors. It is supporting orientation material, not a replacement for the
manual procedure. Exact manual section/page/figure provenance should be retained
with the asset.

## Batch 1: Drive rows 2-10

The first batch covers the highest-value engine air/exhaust/fuel rows near the top
of `Vikadiag_kohteet`:

| Row | Component | Preliminary state | Existing Flex evidence |
|---:|---|---|---|
| 2 | EGR valve 25620-26101 | ready with existing signals | verified 212C + MAF + MAP |
| 3 | EGR No.2 / exhaust gas door 25630-26010 | needs component-specific signal verification | indirect EGR/air/DPNR/EGT context only |
| 4 | MAF 22204-30010 | ready with existing signals | standard MAF + MAP + verified EGR position |
| 5 | DPNR differential-pressure sensor 89480-53010 | dedicated test already implemented in 0.9.4 | verified 217E + RPM |
| 6 | EGT sensor 1 89425-53010 | ready with existing signals | verified 217F inlet + coolant/RPM context |
| 7 | EGT sensor 2 89425-53020 | ready with existing signals | verified 217F outlet/inlet + coolant/RPM context |
| 8 | Main injectors 23670-29105 | indirect screening only | standard rail pressure + RPM; 219C remains field-rejected |
| 9 | Exhaust fuel-addition injector 23710-26011 | indirect screening only | DPNR pressure + EGT pair + standard rail pressure |
| 10 | SCV 04226-0L040 | indirect screening only | standard rail pressure + RPM |

The row classifications deliberately describe **what can be built now**, not what
Techstream could potentially do. For example, row 8 cannot be promoted to a true
injector-correction test while the previously attempted `219C` transaction remains
field-rejected.

## Continuation order

Continue through the sheet in small reviewed batches. Prefer diagnostic groups 1,
3 and 4 first because they have the strongest OBD/Techstream role, then cooling,
starting/charging, chassis/ABS and body modules. Do not infer that every row
containing the word “Techstream” is directly OBD-testable; many rows use ECU data
only as indirect evidence for a mechanical or physical inspection.

For each batch:

1. Read the current Drive rows, not an old copied spreadsheet snapshot.
2. Reuse an existing signal if it already represents the required evidence.
3. If a signal is missing, record the gap instead of guessing a PID or Toyota ID.
4. Add deterministic catalog tests and, when a real guided test is later written,
   separate test logic tests.
5. Identify the repair-manual component image/diagram and retain its provenance.
6. Keep development on a non-release branch until the user explicitly requests a
   new APK.

## Release boundary

The delivered baseline remains Flex 0.9.4 while this roadmap is developed.
Source-only catalog changes must not call `version:next`, use a `release/*` branch,
build an APK for distribution, modify the shared release registry or upload a new
Flex package to Drive. A later release begins only after explicit user approval.
