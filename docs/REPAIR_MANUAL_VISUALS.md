# Repair-manual visuals: source preparation

Six original PNGs were extracted byte-for-byte from the user-supplied
IS250,220D.iso / RM0150 and visually reviewed on 2026-09-15. No AI illustration,
redrawing or image modification is used. Source image and HTML paths and their
SHA-256 checksums are recorded in src/is220d-repair-manual-visuals.js.
These are source-asset integrity checks, not APK artifact registration.

| Drive row | Image | Source section | Intended use |
| --- | --- | --- | --- |
| 5 | a122206e01.png | rm000001fzq003x.html / COMPONENTS | Anturi sekä No. 1- ja No. 2 -paineletkut moottoritilassa. |
| 5 | a132929e01.png | rm000001fzp003x.html / INSTALLATION | Punainen ja vihreä merkki auttavat säilyttämään letkujen oikean kytkennän. |
| 4 | a122189e01.png | rm000001blm006x.html / COMPONENTS | MAF-anturi, liitin ja O-rengas alkuperäisessä ilmanotossa. |
| 2 | a122197e01.png | rm000001aw5003x.html / COMPONENTS | EGR-venttiili, No. 2 EGR -putki ja tiivisteet. |
| 40 | c109132.png | rm000002811000x.html / ON-VEHICLE INSPECTION | Polkimen liikkeen havainnointi moottoria käynnistettäessä. |
| 45, 46 | c124896e02.png | rm000000uw1005x.html / COMPONENTS | Kuva erottaa satulan, levyn ja levyn sisällä olevat seisontajarrukengät. Ei satulan korjausohje. |

The existing component cards, component inspection points and both DPNR test
panels reuse one visual renderer. Pictures open in a native details section,
fit the display width and use local asset URLs with alt text and source captions.
No network access is required. The existing build already copies assets;
no workflow or build gate was changed and no APK was built.

The catalog marks only rows 2, 4, 5, 40, 45 and 46 available. All other visual
plans remain pending as before. Two images can share one component, and one
structural drawing can support two explicitly mapped components. No matching by
name fragment or automatic expansion to EGR No.2, IS250 or unrelated parts occurs.
The original PNC/OE remains in the catalog; a drawing is not a fitment approval.
Figures may contain original service annotations, but this change does not turn
them into executable thresholds or replace complete workshop procedures.

## Preparation status

Local validation: npm ci succeeded; npm test passed **493/493**, including
asset-byte integrity, exact row/component mapping, local rendering and existing
DPNR/inspection integration checks. No APK build was run.

- Source baseline reconciles delivered registry source 17e8a96419724421cb4625abe6f20ebbfb36dcff
  and unshipped catalog work through 3e2c47c5c4b05e3650df5288931db52fb92d96e5.
- Existing package/lockfile version remains unchanged; no release branch,
  APK, release-registry write, artifact registration or Drive delivery.
- Remaining image work: fuel system, EGT, turbo/vacuum, starting/charging,
  cooling and remaining chassis components. Select exact model/section before mapping.
- DPNR field report remains unresolved: ECU-connected does not establish live
  217E data. Both existing tests currently require the page live reader to be
  started separately. This image change does not claim to fix or vehicle-validate
  that measurement problem. Verify live start, raw response and capture on device
  before a later authorized release.
- Later release still requires explicit user instruction, registry-based unique
  version allocation and the normal publication checks. Do not merge PR #29
  without user approval.
