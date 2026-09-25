# Vikadiag OBD test roadmap

This is a source-only development track. It does **not** allocate a new Flex
version and it does not build, register or distribute an APK.

## PRIORITY #1 — extract the real Techstream read requests

**All further Toyota signal-ID guessing and ordinary Vikadiag row expansion are
secondary until this work is exhausted.**

The immediate development target is to recover the actual IS220d Data List read
requests from the available Techstream 12.20.024 material and correlate them with
calibration `35360000`.

Research order:

1. unpack the complete Techstream installation archive;
2. inventory databases, XML/configuration resources, DDB/DB files and DLL/EXE
   modules that contain vehicle/Data List definitions;
3. search for IS220d / 2AD-FHV / XE20 / calibration-family identifiers and the
   target Data List names;
4. trace each Data List definition to its diagnostic service, identifier,
   request header/response header, payload layout and conversion where present;
5. if the request is assembled in native code, follow the call path to the J2534
   write boundary and recover the request bytes statically;
6. only if static extraction cannot resolve a target, use a J2534 logger/passive
   capture against Techstream as the fallback evidence source.

First target signals:

- DPF/DPNR Differential Pressure;
- exhaust temperature before/after DPNR;
- EGR Lift Sensor Output;
- fuel temperature;
- common-rail target/actual pressure;
- injection timing;
- injector feedback/correction values.

Current target-vehicle evidence must be treated as a filter for the static search:
`212C -> 612C00` responds, while direct `217E`, `217F`, `2193`, `2196`
and `21AF` forms returned NO DATA on calibration `35360000`.

Do not promote another guessed `21xx` identifier merely because a Techstream
label appears to match it. A new production query requires either recovered
Techstream request evidence or an independently captured read transaction.

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
| 5 | DPNR differential-pressure sensor 89480-53010 | dedicated UI/test path exists, but signal request is blocked | 217E returned NO DATA on target calibration; request extraction is Priority #1 |
| 6 | EGT sensor 1 89425-53010 | blocked pending request extraction | 217F returned NO DATA on target calibration; coolant/RPM remain context only |
| 7 | EGT sensor 2 89425-53020 | blocked pending request extraction | 217F returned NO DATA on target calibration; coolant/RPM remain context only |
| 8 | Main injectors 23670-29105 | indirect screening only | standard rail pressure + RPM; 219C remains field-rejected |
| 9 | Exhaust fuel-addition injector 23710-26011 | indirect screening only | DPNR pressure + EGT pair + standard rail pressure |
| 10 | SCV 04226-0L040 | indirect screening only | standard rail pressure + RPM |

The row classifications deliberately describe **what can be built now**, not what
Techstream could potentially do. For example, row 8 cannot be promoted to a true
injector-correction test while the previously attempted `219C` transaction remains
field-rejected.

## Continuation order

**Paused behind Priority #1.** Continue ordinary row-by-row expansion only after
the Techstream static-extraction pass above has either recovered the required
requests or documented why a target must move to passive J2534 capture.

After that gate, continue through the sheet in small reviewed batches. Prefer diagnostic groups 1,
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



## Batch 2: live Drive rows 11–25 (2026-09-14)

Reviewed against PR #29 head `59524a5c2b9fc111856dbdb1192c1d7f05f0daf4`.
The live registry identifies delivered source `17e8a96419724421cb4625abe6f20ebbfb36dcff`;
the four later commits change only this catalog, its tests and roadmap.
Package version remains unchanged. Supporting reads: Diag_ryhmät rows 1–20,
Moottorisähkö_audit rows 1–40, BOM rows 133–134 and 194–195.
The audit and corrected Vikadiag row resolve the misleading BOM cam-sensor name.

Role describes available diagnostic scope; readiness separately records whether
the component-specific conclusion is blocked. No newly reviewed row is direct.

| Drive row | Component | Role | Readiness |
|---:|---|---|---|
| 11 | Laturi | indirect | indirect-existing-signals |
| 12 | Starttimoottori | indirect | indirect-existing-signals |
| 13 | Kytkimen pääsylinteri | physical-only | physical-only |
| 14 | Kardaani keskilaakereineen | physical-only | physical-only |
| 15 | Kardaanin keskilaakeri | physical-only | physical-only |
| 16 | Nokka-akselin asentotunnistin / sylinterintunnistusanturi | indirect | needs-signal-verification |
| 17 | Kampiakselin asentotunnistin | indirect | indirect-existing-signals |
| 18 | Ilmansuodatinkotelo kokonaisuutena | indirect | indirect-existing-signals |
| 19 | Moottorin ilmansuodatin | indirect | indirect-existing-signals |
| 20 | Ilmaputki ja kiristimet MAFin/turbon imupuolella | indirect | indirect-existing-signals |
| 21 | Välijäähdytin | indirect | indirect-existing-signals |
| 22 | Imusarja | indirect | indirect-existing-signals |
| 23 | Imusarjan tiiviste | indirect | indirect-existing-signals |
| 24 | Pakosarja ja pakosarjan tiiviste | indirect | indirect-existing-signals |
| 25 | Turboahdin | indirect | indirect-existing-signals |

There are 13 small draft recipes and 14 references to existing inspection points
in this batch. Existing alternator, starter, crank, intake hose, intercooler,
intake manifold and turbo points are referenced, not cloned. The first nine
catalog entries remain intact, including the dedicated DPNR test link.

Every continuation row retains its live source range, symptom, source confidence,
physical follow-up, operating states, evidence labels and explicit limitations.
Recipes use the existing inspection-point field vocabulary. They do not enter
the UI, polling plan, execution state or capture history yet. A later integration
should use those existing modules, including `is220d-capture-history.js`; it must
not interpret absent/invalid samples as zero or a completed physical inspection.

Missing evidence includes cam/crank synchronization, start/clutch input states,
charging feedback, boost target and EGR target. Measured EGR position is not an
EGR command; MAP is absolute pressure. No absolute fault thresholds are added.

Manual visuals remain `pending-extract`: location and inspection diagrams for all
rows, connector views for electrical components and exploded views for mechanical
parts. The attached ISO is available, but no exact figure was identified for this
batch. Search metadata is not a claim that a picture has been found.

Validation: 13 deterministic catalog tests pass locally. Full regression/safety
results are recorded by PR CI; release check/build/register/upload must be skipped.
Batch 2 completed through row 25; continuation below.


## Batch 3: live Drive rows 26–38 (2026-09-14)

| Drive rows | Scope | Role / readiness |
|---|---|---|
| 26 | Turbo oil feed/return | physical-only |
| 27 | Turbo/exhaust gaskets | indirect |
| 28–30 | Vacuum hoses, regulator, VSV | indirect; exact branch mapping still needs manual verification |
| 31 | Vacuum/gas filter | indirect context, blocked pending layout evidence |
| 32–37 | Filter, sedimenter, pump, high/low-pressure pipes, check valve | indirect |
| 38 | Pump drive coupling | physical-only; weak source confidence retained |

This batch adds 16 small draft recipes and references eight existing inspection
points. Total continuation: 28 rows, 29 draft recipes, 22 existing point references.
Of the 28 new rows, 23 have an indirect role and five are physical-only. Two of
the indirect rows (16 and 31) remain pending evidence. No new direct test is claimed.

Missing rail target evidence reuses the intent of
`techstream-data-list-gap.js:target-common-rail-pressure`; pump/SCV context also
relates to `target-pump-scv-current`. These are capture targets, not polling
authorization. The catalog does not add a PID, decoder, evidence promotion or
request. Water-warning state, low-pressure supply measurement and vacuum branch
feedback remain descriptive gaps without guessed identifiers.

Fuel-leak/pump Active Tests and VSV actuation are excluded. The high-pressure-pipe
recipe uses inspection with the engine stopped and previously collected context;
it never asks for a leak-provoking drive or hand contact with a running rail leak.
Oil feed/return and pump drive integrity stay physical-only despite possible
secondary pressure symptoms.

Manual work still pending: turbo oil routing and flange exploded views; vacuum
routing diagrams (especially 90917-11036), valve connector views; fuel-filter and
sedimenter locations; pump, pipe routing and drive coupling removal/inspection
diagrams. All new `manualReference` and `assetPath` values remain null.

Local catalog tests cover identity, deduplication/reuse, source provenance, missing
evidence, physical-only boundaries and forbidden commands/thresholds. Full
regression and safety tests run in the existing PR CI without workflow changes.
Source work never runs the APK build. Batch 3 ends at row 38; later batches follow below.


### Validation record

- Batch 2 commit `dd236f506dea38200b24f7c1b81fbdd6e6643ec9`: local
  regression/safety suite 479/479; PR CI run 34891293340 successful.
  Release check, build, registration, version read and artifact upload all skipped.
- Batch 3: local regression/safety suite 482/482, including 16 catalog tests.
  PR CI runs on the exact pushed source head.
- Only the catalog, its test file and this roadmap are changed. Package/lockfile,
  release registry, protocol, decoders, production polling and CI workflow are unchanged.

## Batch 4: live Drive rows 39–53 (2026-09-15)

All fifteen rows are physical-only: master cylinder, booster and vacuum plumbing,
front/rear pads/discs/calipers/slides, lower ball joints, upper/lower arms, front
shocks, upper supports and stabilizer links/bushes. Fifteen small physical recipe
drafts are added without electronic coverage or fake ABS measurements. These
components have no matching existing component-specific inspection points.

Read live PR #29 head `1c9758f10baf2139694be7db5c9733ff929b5a50`, AGENTS,
versioning/safety/protocol, source and tests, and the shared registry. The delivered
baseline remains unchanged. Supporting Drive reads: Diag_ryhmät 6–10,
Moottorisähkö_audit 1–40, BOM 2583–2584, 2846–2853 and 2854–2863.

The source wording is preserved separately in `sourcePhysicalText`.
The manual resolves the rear-caliper/parking-brake ambiguity: separate shoes sit
inside the rear disc, rather than an integrated caliper parking-brake mechanism.
Rows 45–46 use that distinction in their reviewed instructions. It does not
change the Drive source or claim a new part compatibility result.

Inspected attached ISO sections:
- `rm0150/repair2/html/contents/rm000000v5v006x.html`: PARKING BRAKE ASSEMBLY /
  DISASSEMBLY, separates caliper, disc and parking-brake shoes.
- `rm0150/repair2/html/contents/rm000000uw1005x.html`: COMPONENTS;
  visually inspected `rm0150/repair2/img/c124896e02.png` (rows 45–46).
- `rm0150/repair2/html/contents/rm000002811000x.html`: BRAKE BOOSTER /
  ON-VEHICLE INSPECTION; visually inspected
  `rm0150/repair2/img/c109132.png` (row 40).

Those three visual plans are source-identified, not packaged assets: assetPath
remains null. Other figures remain pending. Exact caliper-specific repair visuals
still need selection; the parking-brake figure only establishes the distinction.
No numeric service limits or torques from the drawings are adopted.

Row 50 retains the original OE shorthand and adds live BOM side/date variants:
RH 48620-53020 / 48620-30290; LH 48640-53020 / 48640-30290, separated at 08/2008.
This is traceable source evidence, not approval to order a part.

Local full regression/safety suite: **485/485 passed**, including 19 catalog tests.
Next unreviewed row after this batch: **54**.

## Batch 5: live Drive rows 54–68 (2026-09-15)

| Rows | Review classification | Existing evidence |
| --- | --- | --- |
| 54–56, 60, 63 | physical-only | No electronic measurement of these parts |
| 57–58 | indirect / pending-evidence | Four-wheel ABS speeds and ECU identity missing |
| 59 | indirect / pending-evidence | ECU voltage is context, not EPS terminal voltage; EPS torque/angle/supply missing |
| 61–62, 66–68 | indirect | Existing coolant-temperature signal only |
| 64–65 | indirect | Existing ECU-voltage signal only |

This batch adds fifteen physical recipes and eight separate context recipes.
Combined batches 4–5 cover every row 39–68 exactly once: 20 physical-only,
7 indirect with existing context, and 3 indirect pending signal verification.
No new direct part test, PID, decoder, transport path or UI is introduced.
Fan command/actual-speed and A/C request/pressure remain explicit evidence gaps.
The fan Active Test mentioned by Drive is excluded; no direct power-feed procedure
or spray-bottle test near a moving belt is adopted.

Physical recipes are separated from signal-dependent observations. Mechanical
inspection is performed with the engine stopped and safe support as applicable;
cooling inspection starts cold. Temperature context must not provoke overheating
or justify driving with a coolant leak. No invented pressure, temperature, wear,
torque or voltage acceptance limits are added.

Manual searches remain pending for rear shocks/springs/links, hub and sensor-ring
views, EPS rack/connectors, tie rods, water pump/seals, idlers/tensioner/belt routing,
radiator, fans/connectors and expansion tank/cap. Each row records its original
PNC/OE and component/system search metadata. Grouped part numbers and row 54's
shared RH/LH number remain source claims, not new fitment verification.

Validation:
- Batch 4 commit `49233dba57ea00b4b02a711ff71ee572cf4eddd0`: PR CI
  [34926567656](https://github.com/olsu2001-lgtm/IS220d-OBD-Flex/actions/runs/34926567656)
  passed regression/safety; registry check, APK build, hash registration,
  version read and artifact upload all skipped.
- Batch 5 local full regression/safety suite: **489/489 passed**, including
  23 catalog tests. PR CI validates the exact pushed source head.
- Only catalog, deterministic tests and roadmap changed; package/lockfile version,
  release registry, production read-only boundaries and workflows remain unchanged.

Next unreviewed row: **69**, but row expansion is intentionally secondary to
Priority #1 Techstream request extraction.

## First reviewed image integration (2026-09-15)

Six original RM0150 images now support rows 2, 4, 5, 40, 45 and 46.
The shared visual mapping feeds the catalog, existing component/inspection
cards and both DPNR panels. This supersedes the pending/source-identified
image status in the historical batch notes above. Other rows stay pending.
See [source provenance and release preparation](REPAIR_MANUAL_VISUALS.md).
No additional Drive rows, signal decoders, app version or APK were introduced.

### Second reviewed image integration

Seven additional original figures cover EGT1/2, main/exhaust injectors,
cam/crank sensors, supply pump/drive coupling and ECT. Total: 13 images,
14 catalog rows with available images, plus the existing ECT inspection component.
Rows 6–9, 16–17, 34 and 38 now have available images; previous batch notes
are historical. ECT source-row references are reused from existing inspection
points, not newly completed catalog reviews. The next catalog row remains 69.
Fuel, air/exhaust and starting/charging scopes reuse the shared renderer.
Full local regression/safety suite passed 495/495. No version or release change.
