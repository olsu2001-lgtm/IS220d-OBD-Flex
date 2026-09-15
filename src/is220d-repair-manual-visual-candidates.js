// Third repair-manual image batch: exact RM0150 source figures identified and reviewed.
// Source-only staging: these records MUST NOT be treated as packaged/available assets until
// the matching PNG bytes exist under targetAssetPath and their SHA-256 is verified.
const candidates = [
  {
    "id": "alternator-location",
    "componentId": "engine.alternator",
    "sourceRow": 11,
    "sourceImagePath": "rm0150/repair2/img/a132252e01.png",
    "sourceImageSha256": "0e1a5b46f1ab74ba7d6c1d7364ab9fd1aaf027fea0d5c8077fc1c9ae5804b4a1",
    "manualReference": "rm0150/repair2/html/contents/rm000001arc007x.html",
    "sourceHtmlSha256": "30a2106082f943ce8daeb534162ccc88099406e30985c9f20b892a34681318f3",
    "section": "COMPONENTS",
    "title": "Laturin sijainti",
    "caption": "Manuaalin GENERATOR-kokonaisuus moottoritilassa; kuva auttaa tunnistamaan laturin ja hihnakäytön sijainnin.",
    "status": "source-identified",
    "reviewedAt": "2026-09-15",
    "targetAssetPath": "assets/repair-manual/a132252e01.png"
  },
  {
    "id": "starter-location",
    "componentId": "engine.starter",
    "sourceRow": 12,
    "sourceImagePath": "rm0150/repair2/img/a132250e01.png",
    "sourceImageSha256": "94074cee93bc363c912f58dcb28fadc25b9407574e7f0d71befa0d54b4b72a58",
    "manualReference": "rm0150/repair2/html/contents/rm00000167v005x.html",
    "sourceHtmlSha256": "f20ddc36973508b74e1801de1f4220a98d5a41839a5d3a899aeed59ef11cbc93",
    "section": "COMPONENTS",
    "title": "Starttimoottorin sijainti",
    "caption": "STARTER ASSEMBLY moottoritilassa ja johtokiinnitykset; käytä kuvaa osan paikantamiseen.",
    "status": "source-identified",
    "reviewedAt": "2026-09-15",
    "targetAssetPath": "assets/repair-manual/a132250e01.png"
  },
  {
    "id": "turbo-layout",
    "componentId": "engine.turbocharger",
    "sourceRow": 25,
    "sourceImagePath": "rm0150/repair2/img/a122209e03.png",
    "sourceImageSha256": "ddb960ebc3b18b0d182c8c01d61c78e4539410a4148f36acaa21320a68c06503",
    "manualReference": "rm0150/repair2/html/contents/rm0000019s7004x.html",
    "sourceHtmlSha256": "8c18ca3fbf71e5dceda0ac929637899c14b1cb3e9860664ac3f58a90ac3d6f17",
    "section": "COMPONENTS",
    "title": "Turboahdin ja liitännät",
    "caption": "Turbocharger-kokonaisuus sekä vesi-, öljy- ja ilmaputkien liitännät. Kuva auttaa erottamaan putkisto- ja liitäntäviat itse ahtimesta.",
    "status": "source-identified",
    "reviewedAt": "2026-09-15",
    "targetAssetPath": "assets/repair-manual/a122209e03.png"
  },
  {
    "id": "intercooler-layout",
    "componentId": "engine.intercooler",
    "sourceRow": 21,
    "sourceImagePath": "rm0150/repair2/img/a132945e01.png",
    "sourceImageSha256": "de82417c9a33a91a15c9c6b814b6e680fcfdcd12c5b012756315376257bda392",
    "manualReference": "rm0150/repair2/html/contents/rm0000019sa007x.html",
    "sourceHtmlSha256": "e9b24ddf099bff71f9561ef999682b2302683c4e5c83bd69ffbdbc3992688a4e",
    "section": "COMPONENTS",
    "title": "Välijäähdyttimen sijainti",
    "caption": "Intercooler assembly jäähdytinpaketin yhteydessä. Kuva auttaa vuoto-, halkeama- ja letkuliitosten tarkastuksessa.",
    "status": "source-identified",
    "reviewedAt": "2026-09-15",
    "targetAssetPath": "assets/repair-manual/a132945e01.png"
  },
  {
    "id": "vacuum-regulator-location",
    "componentId": "engine.vacuum_regulating_valve",
    "sourceRow": 29,
    "sourceImagePath": "rm0150/repair2/img/a122208e01.png",
    "sourceImageSha256": "5d7a0a50b58f14da8d5cdb3228e95592db3317f3023f3e0fe7578fc2dc25ef68",
    "manualReference": "rm0150/repair2/html/contents/rm000001hnk003x.html",
    "sourceHtmlSha256": "6159c01284cae8cb9e61c5d6405c6bf08e0838e944ce0d7c91cb8a1125c7aed4",
    "section": "COMPONENTS",
    "title": "Alipaineen säätöventtiilin sijainti",
    "caption": "Vacuum regulating valve assembly ja vacuum hose moottoritilassa. Kuva ei yksin vahvista ohjaustoimintoa.",
    "status": "source-identified",
    "reviewedAt": "2026-09-15",
    "targetAssetPath": "assets/repair-manual/a122208e01.png"
  },
  {
    "id": "water-pump-location",
    "componentId": "engine.water_pump",
    "sourceRow": 61,
    "sourceImagePath": "rm0150/repair2/img/a125620e02.png",
    "sourceImageSha256": "5e2ddd7aeda22b413024be9a9c569a8ef1e2803e50ef40c1d1c771a275c1fc6c",
    "manualReference": "rm0150/repair2/html/contents/rm000001bjy006x.html",
    "sourceHtmlSha256": "e70ec38c2dd6d81ea4a4ad98dae00476d14cdaced537d1ea2963790329312004",
    "section": "COMPONENTS",
    "title": "Vesipumpun sijainti",
    "caption": "Water pump assembly ja water pump pulley moottorin sivulla; tarkista vuoto-, laakeri- ja hihnakonteksti erikseen.",
    "status": "source-identified",
    "reviewedAt": "2026-09-15",
    "targetAssetPath": "assets/repair-manual/a125620e02.png"
  },
  {
    "id": "radiator-layout",
    "componentId": "engine.radiator",
    "sourceRow": 66,
    "sourceImagePath": "rm0150/repair2/img/a121167e01.png",
    "sourceImageSha256": "b7b6351edbfa953351de3ca7eba7a6559bd09a39c22d3cea380edddf965e5033",
    "manualReference": "rm0150/repair2/html/contents/rm000001bjv006x.html",
    "sourceHtmlSha256": "0d8f4991022582687997aa0e02d4657866018389781224ba60778b081ec7422d",
    "section": "COMPONENTS",
    "title": "Jäähdytin ja puhallinkokonaisuus",
    "caption": "Radiator assembly, fan assembly sekä tulo- ja lähtöletkut. Kuva auttaa erottamaan kennon, puhaltimen ja letkuliitännät.",
    "status": "source-identified",
    "reviewedAt": "2026-09-15",
    "targetAssetPath": "assets/repair-manual/a121167e01.png"
  }
];

for (const candidate of candidates) Object.freeze(candidate);
export const IS220D_REPAIR_MANUAL_VISUAL_CANDIDATES = Object.freeze(candidates);

export function getIs220dRepairManualVisualCandidate(componentId) {
  return IS220D_REPAIR_MANUAL_VISUAL_CANDIDATES.find(item => item.componentId === String(componentId || "")) || null;
}
