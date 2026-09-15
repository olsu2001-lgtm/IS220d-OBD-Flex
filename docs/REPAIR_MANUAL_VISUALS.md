# Repair-manual visuals: source preparation

All figures in this track come from the user-supplied Lexus IS250/220D RM0150
repair manual. AI-generated component illustrations are not used.

## Third image batch + continuation: reviewed 2AD-FHV sources (2026-09-15)

The source review now covers **14 diagnostic components using 10 unique RM0150
figures**. Every candidate records the exact image path, source HTML, component
identity, source row, 2AD-FHV applicability and SHA-256 hashes in
`src/is220d-repair-manual-visual-candidates.js`.

This batch remains deliberately **source-identified**, not `available`: the
matching PNG bytes have not yet been committed under `assets/repair-manual/`, so
the normal Flex renderer must not pretend these pictures are already packaged.

| Drive row | Diagnostic component | RM0150 image | 2AD-FHV manual section |
| ---: | --- | --- | --- |
| 11 | Laturi / generator | `a132252e01.png` | `rm000001arc007x.html` / GENERATOR / COMPONENTS |
| 12 | Starttimoottori | `a132250e01.png` | `rm00000167v005x.html` / STARTER / COMPONENTS |
| 18 | Ilmansuodatinkotelo | `a133283e01.png` | `rm0000019s7004x.html` / TURBOCHARGER / COMPONENTS |
| 20 | Ilmanpuhdistimen letku turbon imupuolella | `a133283e01.png` | `rm0000019s7004x.html` / TURBOCHARGER / COMPONENTS |
| 21 | Välijäähdytin | `a132945e01.png` | `rm0000019sa007x.html` / INTERCOOLER / COMPONENTS |
| 24 | Pakosarja / pakosarjan tiiviste | `a122201e01.png` | `rm0000019s7004x.html` / TURBOCHARGER / COMPONENTS |
| 25 | Turboahdin ja liitännät | `a122209e03.png` | `rm0000019s7004x.html` / TURBOCHARGER / COMPONENTS |
| 26 | Turbon öljyputket | `a122209e03.png` | `rm0000019s7004x.html` / TURBOCHARGER / COMPONENTS |
| 29 | Alipaineen säätöventtiili | `a122208e01.png` | `rm000001hnk003x.html` / VACUUM REGULATING VALVE / COMPONENTS |
| 61 | Vesipumppu | `a132388e01.png` | `rm000000v1h00ix.html` / WATER PUMP / COMPONENTS |
| 65 | Moniurahihna | `a132960e01.png` | `rm000000rps009x.html` / DRIVE BELT / COMPONENTS |
| 66 | Jäähdytin | `a134875e01.png` | `rm000000v1x00jx.html` / RADIATOR / COMPONENTS |
| 67 | Jäähdytyspuhaltimet | `a134875e01.png` | `rm000000v1x00jx.html` / RADIATOR / COMPONENTS |
| 68 | Paisuntasäiliö ja korkki | `a134875e01.png` | `rm000000v1x00jx.html` / RADIATOR / COMPONENTS |

### Engine-family verification correction

The image review now checks the RM0150 table-of-contents engine family, not just
the component-page title or a visually plausible drawing. This caught two
important false positives from the first pass of the third batch:

- `rm000001bjy006x.html` / `a125620e02.png` is **4GR-FSE WATER PUMP**, so it is
  rejected for IS220d. The reviewed IS220d source is the **2AD-FHV COOLING** page
  `rm000000v1h00ix.html` with `a132388e01.png`.
- `rm000001bjv006x.html` / `a121167e01.png` is **4GR-FSE RADIATOR**, so it is
  rejected for IS220d. The reviewed IS220d source is the **2AD-FHV COOLING** page
  `rm000000v1x00jx.html` with `a134875e01.png`.

The candidate tests explicitly reject those two 4GR-FSE page IDs to prevent the
same cross-engine mapping from returning later.

The 2AD-FHV radiator figure is especially useful because one original drawing
labels the radiator, intercooler, fan assembly, radiator reserve tank/cap and
coolant hoses. It is therefore reused only for the catalog components that are
explicitly visible in that drawing. Likewise, the turbo components page is
reused for the air-cleaner hose/cap, exhaust-side connection and turbo oil-pipe
rows only where those parts are explicitly labelled.

The DRIVE BELT component figure shows the V-ribbed belt but does **not** label the
belt tensioner. Row 65 is therefore mapped, while row 64 remains pending rather
than inferring a tensioner from a nearby belt drawing.

These source mappings do not change diagnostic readiness, signal authorization,
thresholds, decoders or transport behavior. A repair-manual figure is an
orientation aid and source reference, not proof that a component is faulty or
that an OBD test is direct.

The next packaging step is mechanical: copy the reviewed exact source PNGs to
their recorded `targetAssetPath`, verify the bytes against
`sourceImageSha256`, then move only those verified mappings into
`src/is220d-repair-manual-visuals.js`. Until that happens the existing renderer
continues to expose only already packaged images.

## Second image batch (2026-09-15)

Seven original COMPONENTS PNGs were extracted and visually reviewed. Together
with the first batch, there are currently 13 packaged unique images supporting
15 component identities. Within the row-by-row catalog, packaged image plans
cover rows 2, 4–9, 16–17, 34, 38, 40 and 45–46 (14 rows). ECT reuses existing
inspection-point references 152/254/330; those rows have not been newly reviewed
in the row-by-row catalog.

| Component | Source image | Source section |
| --- | --- | --- |
| Kampiakselianturin sijainti | `a122191e01.png` | `rm000001blw006x.html` |
| Nokka-akselianturin sijainti | `a122190e01.png` | `rm000001blr006x.html` |
| Pakolämpöanturien sijainnit | `a122207e01.png` | `rm000001aw8003x.html` |
| Lisäpolttoainesuuttimen sijainti | `a122199e01.png` | `rm000001aw7003x.html` |
| Syöttöpumppu ja käyttökytkin | `a130378e01.png` | `rm000001at0004x.html` |
| Pääsuuttimet ja paluuputkisto | `a133848e02.png` | `rm000001asw004x.html` |
| Jäähdytysnesteanturin sijainti | `a119089e01.png` | `rm000001bm3006x.html` |

The existing fuel, air/exhaust and starting/charging inspection renderers call
the same reviewed-image renderer as the general component views. Main injectors
and the exhaust fuel addition injector have separate images. The supply-pump
image is not mapped to SCV because it does not identify that valve explicitly.
The EGT picture retains UPPER/LOWER labels and does not invent an ECU
byte-to-location mapping.

## First image batch (historical)

Six original PNGs were extracted byte-for-byte from `IS250,220D.iso` / RM0150
and visually reviewed on 2026-09-15. No AI illustration, redrawing or image
modification is used. Source image and HTML paths and their SHA-256 checksums are
recorded in `src/is220d-repair-manual-visuals.js`.

| Drive row | Image | Source section | Intended use |
| --- | --- | --- | --- |
| 5 | `a122206e01.png` | `rm000001fzq003x.html` / COMPONENTS | Anturi sekä No. 1- ja No. 2 -paineletkut moottoritilassa. |
| 5 | `a132929e01.png` | `rm000001fzp003x.html` / INSTALLATION | Punainen ja vihreä merkki auttavat säilyttämään letkujen oikean kytkennän. |
| 4 | `a122189e01.png` | `rm000001blm006x.html` / COMPONENTS | MAF-anturi, liitin ja O-rengas alkuperäisessä ilmanotossa. |
| 2 | `a122197e01.png` | `rm000001aw5003x.html` / COMPONENTS | EGR-venttiili, No. 2 EGR -putki ja tiivisteet. |
| 40 | `c109132.png` | `rm000002811000x.html` / ON-VEHICLE INSPECTION | Polkimen liikkeen havainnointi moottoria käynnistettäessä. |
| 45, 46 | `c124896e02.png` | `rm000000uw1005x.html` / COMPONENTS | Kuva erottaa satulan, levyn ja levyn sisällä olevat seisontajarrukengät. |

The existing component cards, component inspection points and both DPNR test
panels reuse one visual renderer. Packaged pictures use local asset URLs and no
network access is required.

## Source-only boundary

This work remains on `work/vikadiag-obd-test-catalog` / PR #29. It does not
allocate a new Flex version, change package/lockfile versions, create a release
branch, build/publish an APK, modify the release registry, register artifact
hashes or upload a Flex release to Drive. It also adds no PID, Toyota identifier,
ECU write, Active Test or forced regeneration.

The next row-by-row Vikadiag catalog review still starts at Drive row 69. Image
source review does not by itself mark further diagnostic rows as reviewed. PR #29
must not be merged without separate user approval.
