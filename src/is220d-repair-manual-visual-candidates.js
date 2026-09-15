// Reviewed RM0150 source figures for Vikadiag items that are not yet exposed by the packaged visual registry.
// Source-only staging: a candidate MUST NOT be treated as available until its target asset bytes and semantic
// mapping are committed and verified. Engine-family checks are explicit to avoid IS250/4GR-FSE cross-mapping.
function candidate(data) {
  return {
    engineFamily: "2AD-FHV",
    status: "source-identified",
    reviewedAt: "2026-09-15",
    ...data
  };
}

const candidates = [
  candidate({
    id: "alternator-location", componentId: "engine.alternator", sourceRow: 11,
    sourceImagePath: "rm0150/repair2/img/a132252e01.png",
    sourceImageSha256: "0e1a5b46f1ab74ba7d6c1d7364ab9fd1aaf027fea0d5c8077fc1c9ae5804b4a1",
    manualReference: "rm0150/repair2/html/contents/rm000001arc007x.html",
    sourceHtmlSha256: "30a2106082f943ce8daeb534162ccc88099406e30985c9f20b892a34681318f3",
    section: "COMPONENTS", title: "Laturin sijainti",
    caption: "2AD-FHV GENERATOR -komponenttikuva näyttää laturin, kiinnikkeet ja hihnakäytön sijainnin.",
    targetAssetPath: "assets/repair-manual/a132252e01.png"
  }),
  candidate({
    id: "starter-location", componentId: "engine.starter", sourceRow: 12,
    sourceImagePath: "rm0150/repair2/img/a132250e01.png",
    sourceImageSha256: "94074cee93bc363c912f58dcb28fadc25b9407574e7f0d71befa0d54b4b72a58",
    manualReference: "rm0150/repair2/html/contents/rm00000167v005x.html",
    sourceHtmlSha256: "f20ddc36973508b74e1801de1f4220a98d5a41839a5d3a899aeed59ef11cbc93",
    section: "COMPONENTS", title: "Starttimoottorin sijainti",
    caption: "2AD-FHV STARTER ASSEMBLY moottoritilassa ja johtokiinnitykset; kuva paikantaa startin ennen sähkömittauksia.",
    targetAssetPath: "assets/repair-manual/a132250e01.png"
  }),
  candidate({
    id: "air-cleaner-housing-turbo-prep", componentId: "engine.air_cleaner_housing", sourceRow: 18,
    sourceImagePath: "rm0150/repair2/img/a133283e01.png",
    sourceImageSha256: "d74beb0e2c8886b90ef5e97a0de25ce98baac570db0133f63d375c830e97a884",
    manualReference: "rm0150/repair2/html/contents/rm0000019s7004x.html",
    sourceHtmlSha256: "8c18ca3fbf71e5dceda0ac929637899c14b1cb3e9860664ac3f58a90ac3d6f17",
    section: "COMPONENTS", title: "Ilmanpuhdistimen kansi ja koteloyhteys",
    caption: "2AD-FHV TURBOCHARGER -komponenttisivun kuvassa näkyy AIR CLEANER CAP WITH AIR CLEANER HOSE ja sen sijainti.",
    targetAssetPath: "assets/repair-manual/a133283e01.png"
  }),
  candidate({
    id: "air-cleaner-hose-turbo-prep", componentId: "engine.air_cleaner_hose", sourceRow: 20,
    sourceImagePath: "rm0150/repair2/img/a133283e01.png",
    sourceImageSha256: "d74beb0e2c8886b90ef5e97a0de25ce98baac570db0133f63d375c830e97a884",
    manualReference: "rm0150/repair2/html/contents/rm0000019s7004x.html",
    sourceHtmlSha256: "8c18ca3fbf71e5dceda0ac929637899c14b1cb3e9860664ac3f58a90ac3d6f17",
    section: "COMPONENTS", title: "Ilmanpuhdistimen letku turbon imupuolella",
    caption: "AIR CLEANER CAP WITH AIR CLEANER HOSE näyttää 2AD-FHV:n MAF-/turbo-imupuolen letkukokonaisuuden ja klemmarialueet.",
    targetAssetPath: "assets/repair-manual/a133283e01.png"
  }),
  candidate({
    id: "intercooler-layout", componentId: "engine.intercooler", sourceRow: 21,
    sourceImagePath: "rm0150/repair2/img/a132945e01.png",
    sourceImageSha256: "de82417c9a33a91a15c9c6b814b6e680fcfdcd12c5b012756315376257bda392",
    manualReference: "rm0150/repair2/html/contents/rm0000019sa007x.html",
    sourceHtmlSha256: "e9b24ddf099bff71f9561ef999682b2302683c4e5c83bd69ffbdbc3992688a4e",
    section: "COMPONENTS", title: "Välijäähdyttimen sijainti",
    caption: "2AD-FHV INTERCOOLER ASSEMBLY jäähdytinpaketin yhteydessä; kuva auttaa vuoto-, halkeama- ja letkuliitosten tarkastuksessa.",
    targetAssetPath: "assets/repair-manual/a132945e01.png"
  }),
  candidate({
    id: "exhaust-manifold-turbo-layout", componentId: "engine.exhaust_manifold_gasket", sourceRow: 24,
    sourceImagePath: "rm0150/repair2/img/a122201e01.png",
    sourceImageSha256: "c9c17f20dcb2e3bb1e91e491fb1276cb23053e3f00a9d0c0a942c905b5167c64",
    manualReference: "rm0150/repair2/html/contents/rm0000019s7004x.html",
    sourceHtmlSha256: "8c18ca3fbf71e5dceda0ac929637899c14b1cb3e9860664ac3f58a90ac3d6f17",
    section: "COMPONENTS", title: "Pakosarjan/pakopuolen liitännät",
    caption: "2AD-FHV TURBOCHARGER -komponenttikuva näyttää EXHAUST MANIFOLD CONVERTER SUB-ASSEMBLYn ja pakopuolen liitoksia noki- ja vuotojälkien paikantamiseen.",
    targetAssetPath: "assets/repair-manual/a122201e01.png"
  }),
  candidate({
    id: "turbo-layout", componentId: "engine.turbocharger", sourceRow: 25,
    sourceImagePath: "rm0150/repair2/img/a122209e03.png",
    sourceImageSha256: "ddb960ebc3b18b0d182c8c01d61c78e4539410a4148f36acaa21320a68c06503",
    manualReference: "rm0150/repair2/html/contents/rm0000019s7004x.html",
    sourceHtmlSha256: "8c18ca3fbf71e5dceda0ac929637899c14b1cb3e9860664ac3f58a90ac3d6f17",
    section: "COMPONENTS", title: "Turboahdin ja liitännät",
    caption: "2AD-FHV turbocharger-kokonaisuus sekä vesi-, öljy- ja ilmaputkien liitännät; putkisto- ja liitäntäviat voidaan erottaa itse ahtimesta.",
    targetAssetPath: "assets/repair-manual/a122209e03.png"
  }),
  candidate({
    id: "turbo-oil-pipes-layout", componentId: "engine.turbo_oil_pipes", sourceRow: 26,
    sourceImagePath: "rm0150/repair2/img/a122209e03.png",
    sourceImageSha256: "ddb960ebc3b18b0d182c8c01d61c78e4539410a4148f36acaa21320a68c06503",
    manualReference: "rm0150/repair2/html/contents/rm0000019s7004x.html",
    sourceHtmlSha256: "8c18ca3fbf71e5dceda0ac929637899c14b1cb3e9860664ac3f58a90ac3d6f17",
    section: "COMPONENTS", title: "Turbon öljyputket ja liitännät",
    caption: "Sama 2AD-FHV turboahdinkuva näyttää NO. 2 TURBO OIL PIPE-, TURBO OIL OUTLET PIPE- ja TURBO OIL OUTLET HOSE -alueet.",
    targetAssetPath: "assets/repair-manual/a122209e03.png"
  }),
  candidate({
    id: "vacuum-hoses-vrv-local", componentId: "engine.vacuum_hoses", sourceRow: 28,
    sourceImagePath: "rm0150/repair2/img/a122208e01.png",
    sourceImageSha256: "5d7a0a50b58f14da8d5cdb3228e95592db3317f3023f3e0fe7578fc2dc25ef68",
    manualReference: "rm0150/repair2/html/contents/rm000001hnk003x.html",
    sourceHtmlSha256: "6159c01284cae8cb9e61c5d6405c6bf08e0838e944ce0d7c91cb8a1125c7aed4",
    section: "COMPONENTS", title: "Alipaineletkut VRV:n ympärillä",
    caption: "2AD-FHV VACUUM REGULATING VALVE -komponenttikuva näyttää kaksi VACUUM HOSE -liitäntää. Kuva on paikallinen esimerkki, ei koko alipainejärjestelmän reitityskaavio.",
    targetAssetPath: "assets/repair-manual/a122208e01.png"
  }),
  candidate({
    id: "vacuum-regulator-location", componentId: "engine.vacuum_regulating_valve", sourceRow: 29,
    sourceImagePath: "rm0150/repair2/img/a122208e01.png",
    sourceImageSha256: "5d7a0a50b58f14da8d5cdb3228e95592db3317f3023f3e0fe7578fc2dc25ef68",
    manualReference: "rm0150/repair2/html/contents/rm000001hnk003x.html",
    sourceHtmlSha256: "6159c01284cae8cb9e61c5d6405c6bf08e0838e944ce0d7c91cb8a1125c7aed4",
    section: "COMPONENTS", title: "Alipaineen säätöventtiilin sijainti",
    caption: "2AD-FHV VACUUM REGULATING VALVE ASSEMBLY ja vacuum hose moottoritilassa. Kuva ei yksin vahvista ohjaustoimintoa.",
    targetAssetPath: "assets/repair-manual/a122208e01.png"
  }),
  candidate({
    id: "vacuum-switching-valve-location", componentId: "engine.vacuum_switching_valve", sourceRow: 30,
    sourceImagePath: "rm0150/repair2/img/a122203e01.png",
    sourceImageSha256: "8bda5b814b3796e032cee748ddb436832e81cc586f0dfeb0c859712807ab21d0",
    manualReference: "rm0150/repair2/html/contents/rm000001dnb003x.html",
    sourceHtmlSha256: "60dc5c481775d4b30a0d4829c78a6b20db9205c0fd19b5b93fc62f2dff72f656",
    section: "COMPONENTS", title: "No. 1 alipaineen vaihtoventtiilin sijainti",
    caption: "2AD-FHV EMISSION CONTROL / VACUUM SWITCHING VALVE -kuva paikantaa NO. 1 VACUUM SWITCHING VALVE ASSEMBLYn, liittimen ja letkulähdöt.",
    targetAssetPath: "assets/repair-manual/a122203e01.png"
  }),
  candidate({
    id: "fuel-filter-exploded", componentId: "engine.fuel_filter", sourceRow: 32,
    sourceImagePath: "rm0150/repair2/img/a135220e01.png",
    sourceImageSha256: "712e08a49a1ac4ea90739cd56dc1610d9f1915f05e2eb4793bcb9e8d29b22194",
    manualReference: "rm0150/repair2/html/contents/rm0000024nc000x.html",
    sourceHtmlSha256: "4f7034e7b7c72084738b00d39967438a48a89ec2726d46ade8435841c80ea3ae",
    section: "COMPONENTS", title: "Polttoainesuodattimen rakenne",
    caption: "2AD-FHV FUEL FILTER -kuva erottaa FUEL FILTER CAPin, elementin, kaksi O-rengasta ja FUEL FILTER CASEn.",
    targetAssetPath: "assets/repair-manual/a135220e01.png"
  }),
  candidate({
    id: "fuel-sedimenter-location", componentId: "engine.fuel_sedimenter", sourceRow: 33,
    sourceImagePath: "rm0150/repair2/img/a133199e01.png",
    sourceImageSha256: "79aadef8015922565ca7260a02b91366ce7bc45ba227803f4343058d2cfd3b28",
    manualReference: "rm0150/repair2/html/contents/rm0000024nc000x.html",
    sourceHtmlSha256: "4f7034e7b7c72084738b00d39967438a48a89ec2726d46ade8435841c80ea3ae",
    section: "COMPONENTS", title: "Polttoainesuodatin ja sedimenter auton alla",
    caption: "2AD-FHV FUEL FILTER -kuva paikantaa FUEL SEDIMENTER ASSEMBLYn ja FUEL FILTER ASSEMBLYn erillisinä yksikköinä auton takaosan alle.",
    targetAssetPath: "assets/repair-manual/a133199e01.png"
  }),
  candidate({
    id: "injection-high-pressure-pipes-layout", componentId: "engine.injection_high_pressure_pipes", sourceRow: 35,
    sourceImagePath: "rm0150/repair2/img/a130379e01.png",
    sourceImageSha256: "441cc50766dde2530537fd3ed317e835ba73c1933564ddcddd8d866b4ac11d5f",
    manualReference: "rm0150/repair2/html/contents/rm0000023c8000x.html",
    sourceHtmlSha256: "5b4fa32579cb59841d5165d2f8309d57605661bd9fd1d61a1d5cff7941b03eb9",
    section: "COMPONENTS", title: "Common rail ja ruiskutusputket",
    caption: "2AD-FHV COMMON RAIL -komponenttikuva näyttää COMMON RAIL ASSEMBLYn sekä NO. 1 INJECTION PIPE SUB-ASSEMBLY / FUEL INLET PIPE -putkiston moottoritilassa.",
    targetAssetPath: "assets/repair-manual/a130379e01.png"
  }),
  candidate({
    id: "fuel-check-valve-layout", componentId: "engine.fuel_check_valve", sourceRow: 37,
    sourceImagePath: "rm0150/repair2/img/a133848e02.png",
    sourceImageSha256: "9b81505b0aa2e9d3dbfccbd46f3f99c7344a02a0813531aeff3857201f337c61",
    manualReference: "rm0150/repair2/html/contents/rm000001asw004x.html",
    sourceHtmlSha256: "0ca4df6ecd1739ad8e8d2560bff582b2256f2a57a6e1f9520b02dac02db42fad",
    section: "COMPONENTS", title: "Polttoaineen takaiskuventtiili suutin-/putkikokonaisuudessa",
    caption: "2AD-FHV FUEL INJECTOR -komponenttikuva nimeää FUEL CHECK VALVEn ja näyttää sen suhteessa NO. 1 FUEL PIPEen ja suutinten putkistoon.",
    targetAssetPath: "assets/repair-manual/a133848e02.png"
  }),
  candidate({
    id: "water-pump-location", componentId: "engine.water_pump", sourceRow: 61,
    sourceImagePath: "rm0150/repair2/img/a132388e01.png",
    sourceImageSha256: "dbd54bcaea679903932e68b84e927b84dbd4906811e30d5764aaca57718cb103",
    manualReference: "rm0150/repair2/html/contents/rm000000v1h00ix.html",
    sourceHtmlSha256: "6f9fc0bb7aa3cd6578d412a4d44f47a09f6bbaa728bb5d610b656c361414a3da",
    section: "COMPONENTS", title: "2AD-FHV vesipumpun sijainti",
    caption: "2AD-FHV WATER PUMP -komponenttikuva näyttää pumpun, hihnan, jäähdytysnestesäiliön ja viereiset hihnapyörät.",
    targetAssetPath: "assets/repair-manual/a132388e01.png"
  }),
  candidate({
    id: "idler-pulley-removal", componentId: "engine.idler_pulleys", sourceRow: 63,
    sourceImagePath: "rm0150/repair2/img/a131681.png",
    sourceImageSha256: "d9ddbf9744b128f7290920b28812286972a9a688591c7884506ad869a4be0bb2",
    manualReference: "rm0150/repair2/html/contents/rm0000019y9009x.html",
    sourceHtmlSha256: "0e4e8fdef985c30e80a539ae12d71291f3f436221d70a5b048fd21c3f3ab4cbd",
    section: "REMOVAL", title: "No. 1 idler pulley -sijainti",
    caption: "2AD-FHV ENGINE ASSEMBLY -irrotuskuva osoittaa NO. 1 IDLER PULLEY SUB-ASSEMBLYn pultin ja sijainnin hihnakäytössä.",
    targetAssetPath: "assets/repair-manual/a131681.png"
  }),
  candidate({
    id: "belt-tensioner-removal", componentId: "engine.belt_tensioner", sourceRow: 64,
    sourceImagePath: "rm0150/repair2/img/a111243.png",
    sourceImageSha256: "896fb0d72561b95469ea1bb94ab838dd3d0800b0dfc9caa4dc09da8fb3663a31",
    manualReference: "rm0150/repair2/html/contents/rm0000019y9009x.html",
    sourceHtmlSha256: "0e4e8fdef985c30e80a539ae12d71291f3f436221d70a5b048fd21c3f3ab4cbd",
    section: "REMOVAL", title: "Moniurahihnan kiristimen kiinnitys",
    caption: "2AD-FHV ENGINE ASSEMBLY -irrotusvaiheen kuva osoittaa V-RIBBED BELT TENSIONER ASSEMBLYn kolme kiinnityspulttia. Tämä korvaa aiemman liian yleisen pelkän hihnakuvan kiristinrivillä.",
    targetAssetPath: "assets/repair-manual/a111243.png"
  }),
  candidate({
    id: "accessory-belt-location", componentId: "engine.accessory_belt", sourceRow: 65,
    sourceImagePath: "rm0150/repair2/img/a132960e01.png",
    sourceImageSha256: "ccccdfc79bf1dd337428a1d032304bb1f3c9415e99fa5791bbfc7427de8c73d3",
    manualReference: "rm0150/repair2/html/contents/rm000000rps009x.html",
    sourceHtmlSha256: "cfa3f4107a3d15e4bd5149c75a48da58a3dfb86606e425d374e15ccb419457d8",
    section: "COMPONENTS", title: "2AD-FHV moniurahihnan reititys",
    caption: "2AD-FHV DRIVE BELT -komponenttikuva näyttää V-RIBBED BELTin ja moottoritilan sijainnin.",
    targetAssetPath: "assets/repair-manual/a132960e01.png"
  }),
  candidate({
    id: "radiator-layout", componentId: "engine.radiator", sourceRow: 66,
    sourceImagePath: "rm0150/repair2/img/a134875e01.png",
    sourceImageSha256: "9ed46fa3e5b4b2576b6d83dec55975d3c660823e57619e9f0c07c941b0df8a06",
    manualReference: "rm0150/repair2/html/contents/rm000000v1x00jx.html",
    sourceHtmlSha256: "8f38f757e58a713d5b6127e78acae12575f63c2f152998a93f0732142d7c4123",
    section: "COMPONENTS", title: "2AD-FHV jäähdytinpaketti",
    caption: "2AD-FHV RADIATOR -kuva näyttää jäähdyttimen, välijäähdyttimen, lauhduttimen, puhallinkokonaisuuden sekä tulo- ja lähtöletkut.",
    targetAssetPath: "assets/repair-manual/a134875e01.png"
  }),
  candidate({
    id: "cooling-fans-layout", componentId: "engine.cooling_fans", sourceRow: 67,
    sourceImagePath: "rm0150/repair2/img/a134875e01.png",
    sourceImageSha256: "9ed46fa3e5b4b2576b6d83dec55975d3c660823e57619e9f0c07c941b0df8a06",
    manualReference: "rm0150/repair2/html/contents/rm000000v1x00jx.html",
    sourceHtmlSha256: "8f38f757e58a713d5b6127e78acae12575f63c2f152998a93f0732142d7c4123",
    section: "COMPONENTS", title: "Jäähdytyspuhaltimien sijainti",
    caption: "2AD-FHV RADIATOR -kuvan FAN ASSEMBLY paikantaa puhaltimet suhteessa jäähdyttimeen ja välijäähdyttimeen.",
    targetAssetPath: "assets/repair-manual/a134875e01.png"
  }),
  candidate({
    id: "expansion-tank-layout", componentId: "engine.expansion_tank_cap", sourceRow: 68,
    sourceImagePath: "rm0150/repair2/img/a134875e01.png",
    sourceImageSha256: "9ed46fa3e5b4b2576b6d83dec55975d3c660823e57619e9f0c07c941b0df8a06",
    manualReference: "rm0150/repair2/html/contents/rm000000v1x00jx.html",
    sourceHtmlSha256: "8f38f757e58a713d5b6127e78acae12575f63c2f152998a93f0732142d7c4123",
    section: "COMPONENTS", title: "Paisuntasäiliö ja jäähdyttimen korkki",
    caption: "2AD-FHV RADIATOR -kuva näyttää RADIATOR RESERVE TANKin, RADIATOR CAP SUB-ASSEMBLYn ja säiliöletkut. Korkin painearvoa ei päätellä kuvasta.",
    targetAssetPath: "assets/repair-manual/a134875e01.png"
  })
];

for (const item of candidates) Object.freeze(item);
export const IS220D_REPAIR_MANUAL_VISUAL_CANDIDATES = Object.freeze(candidates);

export function getIs220dRepairManualVisualCandidate(componentId) {
  return IS220D_REPAIR_MANUAL_VISUAL_CANDIDATES.find(item => item.componentId === String(componentId || "")) || null;
}
