# Repair-manual visuals: chassis/drivetrain continuation

This source-only batch records exact figures reviewed from the user-supplied Lexus IS250/220D RM0150 repair manual. No AI-generated component illustrations are used.

The mappings remain **source-identified**, not `available`. The referenced PNG bytes have not yet been committed to the recorded `assets/repair-manual/` paths, so the normal Flex renderer must not expose them as packaged images. This batch changes no diagnostic readiness, signal authorization, PID, decoder, transport command or threshold.

## Reviewed mappings

| Drive row | Diagnostic component | RM0150 image | Manual section/scope |
| ---: | --- | --- | --- |
| 13 | Kytkimen pääsylinteri | `c130431e01.png` | `rm0000010ra005x.html` / CLUTCH MASTER CYLINDER / **for 2AD-FHV** |
| 14 | Kardaani | `c110948e03.png` | `rm000000893008x.html` / REAR PROPELLER SHAFT ASSEMBLY / **for 2AD-FHV** |
| 15 | Kardaanin keskilaakeri | `c110948e03.png` | same 2AD-FHV propeller-shaft page |
| 39 | Jarrupääsylinteri | `c110206e10.png` | `rm0000029k8000x.html` / BRAKE MASTER CYLINDER |
| 41 | Jarrutehostimen alipaineletkut/takaiskuventtiili | `c105676e14.png` | `rm0000029j0000x.html` / BRAKE BOOSTER |
| 42 | Etujarrupalat | `c110259e04.png` | `rm000000wej003x.html` / FRONT BRAKE |
| 43 | Etujarrusatula ja levy | `c110260e06.png` | same FRONT BRAKE page |
| 44 | Etujarrusatulan liukutapit | `c110260e06.png` | same FRONT BRAKE page |
| 47 | Takajarrusatulan tappirakenne | `c110251e01.png` | `rm000000sru003x.html` / REAR BRAKE |
| 48 | Etualapallonivel | `c125074e03.png` | `rm000000spq005x.html` / FRONT LOWER BALL JOINT |
| 49 | Etupään ylätukivarsi | `c125072e03.png` | `rm000000wwx005x.html` / FRONT UPPER SUSPENSION ARM |
| 50 | Etualatukivarsi | `c125074e03.png` | FRONT LOWER BALL JOINT page |
| 51 | Etuiskunvaimennin | `c128188e02.png` | `rm000000wx3004x.html` / FRONT SHOCK ABSORBER |
| 52 | Etutolpan yläkiinnitys | `c128188e02.png` | same FRONT SHOCK ABSORBER page |
| 53 | Etuvakaajan linkki | `c125074e03.png` | FRONT LOWER BALL JOINT page; link labelled, runkopusla not claimed |
| 54 | Takaiskunvaimennin | `c117331e02.png` | `rm000000spv005x.html` / REAR SHOCK ABSORBER |
| 55 | Takajousi | `c117331e02.png` | same REAR SHOCK ABSORBER page |
| 56 | Takapään tukivarret/linkit | `c125841e01.png` | `rm000000o4l008x.html` / REAR AXLE HUB |
| 57 | Etunapa | `c127362e02.png` | `rm000000o4d009x.html` / FRONT AXLE HUB |
| 58 | Takanapa | `c125841e01.png` | REAR AXLE HUB page |
| 59 | Sähkötehostettu ohjausvaihde | `c131885e01.png` | `rm000000sn3005x.html` / STEERING GEAR |
| 60 | Raidetangot / rack ends | `c107878e02.png` | same STEERING GEAR page |

Every record in `src/is220d-repair-manual-visual-candidates-chassis.js` stores the exact source image path, manual HTML page, image SHA-256, HTML SHA-256, source row and intended local asset path.

## Applicability boundary

Rows 13–15 are explicitly marked in RM0150 as procedures/components **for 2AD-FHV**. Brake, suspension, hub and steering pages in this batch are vehicle-common RM0150 service sections rather than engine-family pages. They are therefore recorded with `manualScope: "vehicle-common"` instead of being mislabeled as 2AD-FHV-specific.

Shared figures are mapped only where the drawing explicitly supports the component identity. Examples: `c125074e03.png` labels the lower ball joint, lower suspension arm and stabilizer link. It does **not** explicitly name the stabilizer-bar chassis bushing, so row 53 uses it only to orient the stabilizer link. Likewise no drawing changes an OBD role or turns a physical-only component into an electronically verified one.

## Packaging boundary

The next step is to copy the exact source PNG bytes to their `targetAssetPath`, verify them against the recorded SHA-256 values, and only then add them to `src/is220d-repair-manual-visuals.js`. Until that step, `getIs220dRepairManualVisuals()` must remain empty for these 22 component IDs.

This continuation stays on `work/vikadiag-obd-test-catalog` / PR #29. It does not change the Flex version, package/lockfile versions, release registry, release branch, APKs, artifact hashes or Drive publication. PR #29 remains unmerged.
