# Repair-manual visuals: source preparation

All figures in this track come from the user-supplied Lexus IS250/220D RM0150 repair manual. AI-generated component illustrations are not used.

## Current source-identified set (2026-09-15)

The staging registry now contains **22 diagnostic components** backed by exact **2AD-FHV** RM0150 source figures. Every candidate records the source image, source HTML page, image and HTML SHA-256, diagnostic component identity, Drive row and intended local asset path in `src/is220d-repair-manual-visual-candidates.js`.

These records remain deliberately **source-identified**, not `available`: their PNG bytes have not yet been committed to the recorded `assets/repair-manual/` paths and verified there. The normal Flex renderer therefore continues to expose only already packaged manual images.

| Drive row | Diagnostic component | RM0150 image | 2AD-FHV source section |
| ---: | --- | --- | --- |
| 11 | Laturi / generator | `a132252e01.png` | `rm000001arc007x.html` / GENERATOR / COMPONENTS |
| 12 | Starttimoottori | `a132250e01.png` | `rm00000167v005x.html` / STARTER / COMPONENTS |
| 18 | Ilmansuodatinkotelo | `a133283e01.png` | `rm0000019s7004x.html` / TURBOCHARGER / COMPONENTS |
| 20 | Ilmanpuhdistimen letku turbon imupuolella | `a133283e01.png` | `rm0000019s7004x.html` / TURBOCHARGER / COMPONENTS |
| 21 | Välijäähdytin | `a132945e01.png` | `rm0000019sa007x.html` / INTERCOOLER / COMPONENTS |
| 24 | Pakosarja / pakopuolen liitännät | `a122201e01.png` | `rm0000019s7004x.html` / TURBOCHARGER / COMPONENTS |
| 25 | Turboahdin ja liitännät | `a122209e03.png` | `rm0000019s7004x.html` / TURBOCHARGER / COMPONENTS |
| 26 | Turbon öljyputket | `a122209e03.png` | `rm0000019s7004x.html` / TURBOCHARGER / COMPONENTS |
| 28 | Alipaineletkut VRV:n ympärillä | `a122208e01.png` | `rm000001hnk003x.html` / VACUUM REGULATING VALVE / COMPONENTS |
| 29 | Alipaineen säätöventtiili | `a122208e01.png` | `rm000001hnk003x.html` / VACUUM REGULATING VALVE / COMPONENTS |
| 30 | No. 1 alipaineen vaihtoventtiili / VSV | `a122203e01.png` | `rm000001dnb003x.html` / EMISSION CONTROL / COMPONENTS |
| 32 | Polttoainesuodatin | `a135220e01.png` | `rm0000024nc000x.html` / FUEL FILTER / COMPONENTS |
| 33 | Polttoaineen sedimenter / vedenerotin | `a133199e01.png` | `rm0000024nc000x.html` / FUEL FILTER / COMPONENTS |
| 35 | Common rail -ruiskutusputket | `a130379e01.png` | `rm0000023c8000x.html` / COMMON RAIL / COMPONENTS |
| 37 | Polttoaineen takaiskuventtiili | `a133848e02.png` | `rm000001asw004x.html` / FUEL INJECTOR / COMPONENTS |
| 61 | Vesipumppu | `a132388e01.png` | `rm000000v1h00ix.html` / WATER PUMP / COMPONENTS |
| 63 | No. 1 idler pulley | `a131681.png` | `rm0000019y9009x.html` / ENGINE ASSEMBLY / REMOVAL |
| 64 | Moniurahihnan kiristin | `a111243.png` | `rm0000019y9009x.html` / ENGINE ASSEMBLY / REMOVAL |
| 65 | Moniurahihna | `a132960e01.png` | `rm000000rps009x.html` / DRIVE BELT / COMPONENTS |
| 66 | Jäähdytin | `a134875e01.png` | `rm000000v1x00jx.html` / RADIATOR / COMPONENTS |
| 67 | Jäähdytyspuhaltimet | `a134875e01.png` | `rm000000v1x00jx.html` / RADIATOR / COMPONENTS |
| 68 | Paisuntasäiliö ja korkki | `a134875e01.png` | `rm000000v1x00jx.html` / RADIATOR / COMPONENTS |

The eight most recent additions are rows **28, 30, 32, 33, 35, 37, 63 and 64**. Row 28 deliberately describes the VRV-area hoses as a local example rather than claiming that one drawing is the complete vacuum-routing diagram. Row 64 now has a dedicated 2AD-FHV removal figure that explicitly identifies the `V-RIBBED BELT TENSIONER ASSEMBLY`; the earlier belt-only drawing is no longer used as tensioner evidence.

### Engine-family verification

The image review checks the RM0150 table-of-contents engine family, not only the page title or a visually plausible drawing. This rejected two earlier false positives:

- `rm000001bjy006x.html` / `a125620e02.png` is **4GR-FSE WATER PUMP** and is not mapped to IS220d. The IS220d candidate is `rm000000v1h00ix.html` / `a132388e01.png`.
- `rm000001bjv006x.html` / `a121167e01.png` is **4GR-FSE RADIATOR** and is not mapped to IS220d. The IS220d candidate is `rm000000v1x00jx.html` / `a134875e01.png`.

Candidate tests explicitly reject those 4GR-FSE source pages. Shared drawings are reused only where the labelled content supports the mapped component identity. A picture does not change diagnostic readiness, authorize a signal, create a threshold or prove a component faulty.

The next packaging step for this staged set is mechanical: copy each exact reviewed source PNG to its recorded `targetAssetPath`, verify the committed bytes against `sourceImageSha256`, and only then add that mapping to `src/is220d-repair-manual-visuals.js` as an available local asset.

## Already packaged manual images

Earlier source-only image batches committed 13 unique RM0150 PNG assets supporting 15 component identities. Within the row-by-row catalog, packaged visual plans currently cover rows 2, 4–9, 16–17, 34, 38, 40 and 45–46; ECT also reuses existing inspection-point references.

Examples include DPNR sensor/hoses, MAF, EGR, cam/crank sensors, EGT pair, exhaust fuel addition injector, main injectors, supply pump/drive coupling, brake-booster inspection and the rear-disc/parking-brake layout. The existing component, fuel, air/exhaust and starting/charging views reuse the same reviewed-image renderer.

The supply-pump image is not mapped to SCV because that figure does not explicitly identify the SCV. Likewise no nearby component is inferred merely because it appears in the same service area.

## Source-only boundary

This work remains on `work/vikadiag-obd-test-catalog` / PR #29. It does not allocate a new Flex version, modify package/lockfile versions, create a release branch, build or publish an APK, modify the release registry, register APK hashes or upload a Flex release to Drive. It adds no PID, Toyota identifier, decoder, ECU write, Active Test or forced regeneration.

The row-by-row Vikadiag review itself is still complete only through Drive row 68; the next unreviewed diagnostic row is 69. Image-source review does not by itself mark later diagnostic rows reviewed. PR #29 remains open and must not be merged without separate user approval.
