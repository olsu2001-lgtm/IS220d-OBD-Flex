// Original RM0150 images extracted byte-for-byte from the attached IS250,220D.iso.
// No generated illustrations or vehicle commands. See docs/REPAIR_MANUAL_VISUALS.md.
const visuals = [
  {
    "assetPath": "assets/repair-manual/a122206e01.png",
    "caption": "Anturi sekä No. 1- ja No. 2 -paineletkut moottoritilassa.",
    "componentIds": [
      "engine.dpnr_differential_pressure_sensor"
    ],
    "figureReviewed": true,
    "id": "dpnr-location",
    "manualReference": "rm0150/repair2/html/contents/rm000001fzq003x.html",
    "reviewedAt": "2026-09-15",
    "section": "COMPONENTS",
    "sha256": "a6e1ea7c55011238b1f3cce44379ffe60e80681806ab5e37d6529536d3c8fca5",
    "sourceHtmlSha256": "bd768ae3613c1b036ffcabcdf4cbba3a1578458e3795ab301e3ccc1a2cdf376f",
    "sourceImagePath": "rm0150/repair2/img/a122206e01.png",
    "sourceRows": [
      5
    ],
    "status": "available",
    "title": "DPNR-anturin sijainti ja paineletkut"
  },
  {
    "assetPath": "assets/repair-manual/a132929e01.png",
    "caption": "Punainen ja vihreä merkki auttavat säilyttämään letkujen oikean kytkennän.",
    "componentIds": [
      "engine.dpnr_differential_pressure_sensor"
    ],
    "figureReviewed": true,
    "id": "dpnr-hose-marks",
    "manualReference": "rm0150/repair2/html/contents/rm000001fzp003x.html",
    "reviewedAt": "2026-09-15",
    "section": "INSTALLATION",
    "sha256": "cb944fed3d57f1cd4be572450b0ba49758a35be1b80d0864ea4afbc797f08bb4",
    "sourceHtmlSha256": "ef9b16c3a748f3226a4e446487c137515d41fb9cabded2e6c96a4db4bc06e38f",
    "sourceImagePath": "rm0150/repair2/img/a132929e01.png",
    "sourceRows": [
      5
    ],
    "status": "available",
    "title": "DPNR-letkujen värimerkit"
  },
  {
    "assetPath": "assets/repair-manual/a122189e01.png",
    "caption": "MAF-anturi, liitin ja O-rengas alkuperäisessä ilmanotossa.",
    "componentIds": [
      "engine.maf_sensor"
    ],
    "figureReviewed": true,
    "id": "maf-location",
    "manualReference": "rm0150/repair2/html/contents/rm000001blm006x.html",
    "reviewedAt": "2026-09-15",
    "section": "COMPONENTS",
    "sha256": "642110b9163bc3a5a5e7699e28ba7fdd08e60b9146648f687e868496b071d4d6",
    "sourceHtmlSha256": "d95e267f6eccbf0643c484c4f5a8e22b8f6f2aa7f13c1c24df166a544418f86f",
    "sourceImagePath": "rm0150/repair2/img/a122189e01.png",
    "sourceRows": [
      4
    ],
    "status": "available",
    "title": "MAF-anturin sijainti"
  },
  {
    "assetPath": "assets/repair-manual/a122197e01.png",
    "caption": "EGR-venttiili, No. 2 EGR -putki ja tiivisteet.",
    "componentIds": [
      "engine.egr_valve"
    ],
    "figureReviewed": true,
    "id": "egr-location",
    "manualReference": "rm0150/repair2/html/contents/rm000001aw5003x.html",
    "reviewedAt": "2026-09-15",
    "section": "COMPONENTS",
    "sha256": "a00da2e42592c53e6515fc6ef9641edc94ef8413a3b60d231545717a39c909d5",
    "sourceHtmlSha256": "c446dc1b115ebd407f8b8a2b0dff45d51f19c91a4215606769f9ea0eeda8335f",
    "sourceImagePath": "rm0150/repair2/img/a122197e01.png",
    "sourceRows": [
      2
    ],
    "status": "available",
    "title": "EGR-venttiilin sijainti"
  },
  {
    "assetPath": "assets/repair-manual/c109132.png",
    "caption": "Polkimen liikkeen havainnointi moottoria käynnistettäessä.",
    "componentIds": [
      "brakes.booster"
    ],
    "figureReviewed": true,
    "id": "booster-operation",
    "manualReference": "rm0150/repair2/html/contents/rm000002811000x.html",
    "reviewedAt": "2026-09-15",
    "section": "ON-VEHICLE INSPECTION",
    "sha256": "50de28e2af3c76129f89fcab829c794ce7baf58198f0fd3b5dbd952ef06d9393",
    "sourceHtmlSha256": "91ccaf18eb745f0a9a3c68653a13f0546e0671c1ac297ece4c8d7e3c0af05cad",
    "sourceImagePath": "rm0150/repair2/img/c109132.png",
    "sourceRows": [
      40
    ],
    "status": "available",
    "title": "Jarrutehostimen toimintatarkistus"
  },
  {
    "assetPath": "assets/repair-manual/c124896e02.png",
    "caption": "Kuva erottaa satulan, levyn ja levyn sisällä olevat seisontajarrukengät. Ei satulan korjausohje.",
    "componentIds": [
      "brakes.rear_calipers",
      "brakes.rear_pads_discs"
    ],
    "figureReviewed": true,
    "id": "rear-brake-layout",
    "manualReference": "rm0150/repair2/html/contents/rm000000uw1005x.html",
    "reviewedAt": "2026-09-15",
    "section": "COMPONENTS",
    "sha256": "c1ad7ebae45401285c9212740ecffb3bb20ea96e7004ebfbeefd0d546a79b465",
    "sourceHtmlSha256": "1683cec9d2c4fde81104fb15372c367524a73256e6cc6c6d10700a19f93e947e",
    "sourceImagePath": "rm0150/repair2/img/c124896e02.png",
    "sourceRows": [
      45,
      46
    ],
    "status": "available",
    "title": "Takajarru ja erilliset seisontajarrukengät"
  }
];
for (const visual of visuals) {
  Object.freeze(visual.componentIds);
  Object.freeze(visual.sourceRows);
  Object.freeze(visual);
}
export const IS220D_REPAIR_MANUAL_VISUALS = Object.freeze(visuals);
export function getIs220dRepairManualVisuals(componentId) {
  return IS220D_REPAIR_MANUAL_VISUALS.filter(visual => visual.componentIds.includes(componentId));
}
function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
export function buildIs220dRepairManualVisualsHtml(componentId) {
  const matches = getIs220dRepairManualVisuals(componentId);
  if (!matches.length) return "";
  return `<details class="repair-manual-visuals"><summary>Korjaamo-opaskuvat (${matches.length})</summary>
    <p>Kuvat auttavat tunnistamaan osan ja liitännät. Ne eivät yksin ole täydellinen työohje tai osan sopivuusvarmennus.</p>
    ${matches.map(v => `<figure style="margin:12px 0"><img src="${escapeHtml(v.assetPath)}" alt="${escapeHtml(v.title)}" loading="lazy" style="display:block;max-width:100%;height:auto;background:white">
    <figcaption><strong>${escapeHtml(v.title)}</strong><p>${escapeHtml(v.caption)}</p><small>Lexus IS250/220D · RM0150 · ${escapeHtml(v.section)} · ${escapeHtml(v.sourceImagePath.split("/").at(-1))}</small></figcaption></figure>`).join("")}</details>`;
}

