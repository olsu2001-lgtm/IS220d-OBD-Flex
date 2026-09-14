import { IS220D_COMPONENT_DIAGNOSTICS } from "./is220d-component-diagnostics.js";
import {
  IS220D_DIAGNOSTIC_GROUPS,
  getIs220dDiagnosticGroup,
  getIs220dDiagnosticGroupForComponent
} from "./is220d-diagnostic-groups.js";
import { getIs220dDiagnosticSignal } from "./is220d-diagnostic-signals.js";

export const IS220D_COMPONENT_INSPECTION_POINT_SCHEMA_VERSION = 1;
export const IS220D_COMPONENT_INSPECTION_POINT_SOURCE = "Bom-kaapija / Vikadiag_kohteet";

const COMPONENT_BY_ID = new Map(IS220D_COMPONENT_DIAGNOSTICS.map(component => [component.id, component]));
const STATE_LABELS = Object.freeze({
  "key-on": "KOEO",
  running: "KÄYNTI",
  "warm-idle": "LÄMMIN TYHJÄKÄYNTI",
  "steady-load": "TASAKAASU",
  acceleration: "KIIHDYTYS",
  "held-rpm": "2500 RPM",
  physical: "FYYSINEN"
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const rawPoints = [
  {
    id: "map-koeo-zero",
    componentId: "engine.map_sensor",
    label: "MAP:n KOEO-nollataso",
    kind: "comparison",
    operatingStates: ["key-on"],
    signalKeys: ["engine.map", "engine.barometric_pressure"],
    sourceRows: [151, 310, 328],
    instruction: "Virrat päällä ja moottori sammuksissa vertaa MAP/boost-arvoa ilmanpaineeseen ennen turbo-, VSV- tai ahtovuotopäätelmiä.",
    expectedPattern: "MAP/boost on lähderivien mukaan KOEO-tilassa lähellä barometrista painetta.",
    physicalFollowUp: "Jos nollataso ei ole uskottava, tarkista anturin painekanava, öljy/karsta, liitin sekä 5 V-, maa- ja signaalipiiri."
  },
  {
    id: "map-load-response",
    componentId: "engine.map_sensor",
    label: "MAP:n kuormavaste",
    kind: "dynamic",
    operatingStates: ["running", "acceleration"],
    signalKeys: ["engine.map", "engine.maf", "engine.rpm"],
    sourceRows: [151, 253, 328],
    instruction: "Tallenna boost/MAP tyhjäkäynniltä kuormitukseen ja tarkastele vasteen suuntaa ja viivettä yhdessä MAF:n kanssa.",
    expectedPattern: "Kuormavasteen pitää olla looginen; viive tai ristiriita ohjaa erottamaan anturin, ahtovuodon, alipaineohjauksen ja turbon.",
    physicalFollowUp: "Tarkista painekanava, boost-letkut, alipaineohjaus sekä turbon actuator/siipien liike ennen osan vaihtoa."
  },
  {
    id: "map-air-egr-crosscheck",
    componentId: "engine.map_sensor",
    label: "MAP–MAF–EGR-ristivertailu",
    kind: "cross-check",
    operatingStates: ["running", "acceleration"],
    signalKeys: ["engine.map", "engine.maf", "engine.egr_position_toyota", "engine.dpnr_differential_pressure"],
    sourceRows: [310, 345, 469],
    instruction: "Vertaa MAP/boostia MAF-, EGR- ja DPNR-paine-erodataan samassa ajossa, jotta yhtä poikkeavaa anturiarvoa ei tulkita yksinään.",
    expectedPattern: "Ilmamassan, ahtopaineen, EGR:n ja pakokaasun vastapaineen muutosten tulee muodostaa keskenään uskottava kokonaisuus.",
    physicalFollowUp: "Jos usea paine-/päästöanturi poikkeaa yhtä aikaa, tarkista yhteiset syötöt, maat ja johtosarja ennen yksittäisen anturin tuomiota."
  },
  {
    id: "maf-physical-baseline",
    componentId: "engine.maf_sensor",
    label: "MAF:n asennus- ja vuotoperusta",
    kind: "physical",
    operatingStates: ["physical"],
    signalKeys: ["engine.maf"],
    sourceRows: [4, 277],
    instruction: "Tarkista ilmansuodatin, kotelon tiiviys, MAF:n puhtaus ja liitin sekä MAF:n jälkeiset vuodot ennen livedatan tulkintaa.",
    expectedPattern: "Anturin ympärillä ei ole lähderivien kuvaamia suodatin-, lika-, tiiveys- tai ilmavirran suuntaan liittyviä selittäviä tekijöitä.",
    physicalFollowUp: "Custom intake -ratkaisussa tarkista lisäksi ilmavirran suunta ja ettei anturin kohdalle synny ilmeistä pyörteistä tai vuotavaa liitosta."
  },
  {
    id: "maf-running-response",
    componentId: "engine.maf_sensor",
    label: "MAF:n käynti- ja kaasuv vaste",
    kind: "dynamic",
    operatingStates: ["running", "steady-load", "acceleration"],
    signalKeys: ["engine.maf", "engine.rpm"],
    sourceRows: [4, 277],
    instruction: "Tallenna MAF-arvo tyhjäkäynnillä, tasakaasulla ja kevyessä kiihdytyksessä ja varmista, että arvo reagoi moottorin ilmantarpeen muutokseen.",
    expectedPattern: "MAF:n tulee reagoida kaasuun ja kuormaan; yksittäinen hetkellinen arvo ei riitä diagnoosiin.",
    physicalFollowUp: "Jos vaste on epäuskottava, palaa suodattimen, anturin puhtauden, liittimen ja MAF:n jälkeisten vuotojen tarkastukseen."
  },
  {
    id: "maf-egr-boost-crosscheck",
    componentId: "engine.maf_sensor",
    label: "MAF:n uskottavuus EGR:n ja boostin kanssa",
    kind: "cross-check",
    operatingStates: ["running", "acceleration"],
    signalKeys: ["engine.maf", "engine.map", "engine.egr_position_toyota", "engine.dpnr_differential_pressure"],
    sourceRows: [309, 327, 345],
    instruction: "Arvioi MAF yhdessä EGR-asennon, boost/MAP:n ja DPNR-paine-eron kanssa eikä pelkän MAF-luvun tai vikakoodin perusteella.",
    expectedPattern: "EGR:n, boostin ja ilmamassan muutosten tulee olla keskenään loogisia; MAF voi näyttää yksin uskottavalta mutta olla ristiriidassa muun järjestelmän kanssa.",
    physicalFollowUp: "Ristiriidassa tarkista EGR:n liike, ahtovuodot, imusarjan karsta ja DPF-vastapaine sekä MAF:n asennus."
  },
  {
    id: "egr-mechanical-baseline",
    componentId: "engine.egr_valve",
    label: "EGR:n mekaaninen perusta",
    kind: "physical",
    operatingStates: ["physical"],
    signalKeys: ["engine.egr_position_toyota"],
    sourceRows: [2, 147, 278],
    instruction: "Tarkista EGR-venttiilin karsta, vapaa liike ja sulkeutuminen sekä EGR-putkien ja jäähdyttimen kanavien läpivirtaus.",
    expectedPattern: "Puhdas venttiili ei yksin todista sähköistä toimintaa, mutta mekaaninen jumitus tai tukos pitää erottaa ennen signaalipäätelmiä.",
    physicalFollowUp: "Tarkista liitin, tiivistepinnat ja putkisto samalla käynnillä; seuraa puhdistuksen jälkeen muuttuuko käynti tai alakierrosvaste."
  },
  {
    id: "egr-position-response",
    componentId: "engine.egr_valve",
    label: "EGR-asennon vaste",
    kind: "dynamic",
    operatingStates: ["running"],
    signalKeys: ["engine.egr_position_toyota", "engine.egr_commanded_obd", "engine.maf"],
    sourceRows: [278, 459, 460],
    instruction: "Seuraa EGR:n asento-/lift-tietoa ja MAF:n muutosta EGR-ohjauksen muuttuessa. Erottele sähköinen toimilaite, asentoanturi ja mekaaninen jumitus.",
    expectedPattern: "EGR:n ilmoitetun asennon ja ilmamassan vasteen tulee muuttua loogisesti ohjauksen mukana; yhtä prosenttilukua ei tulkita yksin.",
    physicalFollowUp: "Jos komento/asento/MAF eivät sovi yhteen, tarkista venttiilin vapaa liike, liitin, 5 V/sensorimaa/signaali ja sulkeutuminen."
  },
  {
    id: "egr-airflow-crosscheck",
    componentId: "engine.egr_valve",
    label: "EGR–MAF–MAP-järjestelmävaste",
    kind: "cross-check",
    operatingStates: ["running", "acceleration"],
    signalKeys: ["engine.egr_position_toyota", "engine.maf", "engine.map", "engine.dpnr_differential_pressure"],
    sourceRows: [147, 345, 459, 460],
    instruction: "Tarkastele EGR:n muutosta samassa lokissa MAF:n, MAP/boostin ja DPNR-paine-eron kanssa ennen EGR- tai DPF-päätelmää.",
    expectedPattern: "EGR-järjestelmän vaste arvioidaan ilmamassan ja paineiden muutoksesta, ei pelkästä venttiilin ilmoittamasta asennosta.",
    physicalFollowUp: "Jos EGR-asento seuraa mutta järjestelmävaste ei, tarkista putkisto, imusarjan karsta, ahtovuodot ja pakokaasun vastapaine."
  },
  {
    id: "dpnr-hose-baseline",
    componentId: "engine.dpnr_differential_pressure_sensor",
    label: "DPNR-paineletkujen perusta",
    kind: "physical",
    operatingStates: ["physical"],
    signalKeys: ["engine.dpnr_differential_pressure"],
    sourceRows: [5, 263, 315, 332],
    instruction: "Tarkista DPNR:ltä paineanturille tulevien letkujen halkeamat, sulaminen, nokitukos, kondenssivesi, nipat ja oikea kytkentä ennen anturi- tai DPNR-tuomiota.",
    expectedPattern: "Letkuvika tai väärä reititys voi lähderivien mukaan jäljitellä tukkeutunutta DPNR:ää tai viallista anturia.",
    physicalFollowUp: "Avaa tukos vain letku anturista irrotettuna ja tarkista samalla anturin kiinnitys sekä letkujen järjestys."
  },
  {
    id: "dpnr-koeo-zero",
    componentId: "engine.dpnr_differential_pressure_sensor",
    label: "DPNR-paine-eron KOEO-nollataso",
    kind: "comparison",
    operatingStates: ["key-on"],
    signalKeys: ["engine.dpnr_differential_pressure", "engine.map", "engine.barometric_pressure"],
    sourceRows: [5, 315, 469],
    instruction: "Virrat päällä ja moottori sammuksissa tarkista DPNR-paine-eron nollatason uskottavuus ennen virtaus- tai tukkoisuuspäätelmiä.",
    expectedPattern: "Ilman pakokaasuvirtausta paine-eron tulee lähderivien mukaan olla lähellä nollaa; samalla MAP:n pitäisi olla lähellä ilmanpainetta.",
    physicalFollowUp: "Epäuskottavassa nollatasossa tarkista letkut, anturin liitin, 5 V/maat/signaalit ja yhteinen päästöanturien johtosarja."
  },
  {
    id: "dpnr-rpm-response",
    componentId: "engine.dpnr_differential_pressure_sensor",
    label: "DPNR-paine-eron kierrosvaste",
    kind: "dynamic",
    operatingStates: ["running", "held-rpm", "acceleration"],
    signalKeys: ["engine.dpnr_differential_pressure", "engine.rpm"],
    sourceRows: [315, 332],
    instruction: "Tallenna paine-ero tyhjäkäynnillä, noin 2500 rpm pidolla ja kuormalla ja vertaa vasteen loogisuutta moottorin virtausmuutokseen.",
    expectedPattern: "Paine-eron vasteen tulee muuttua loogisesti virtauksen mukana; hyppivä, nolla-/negatiiviseksi jäävä tai epälooginen vaste ohjaa ensin letku-/anturipuolelle.",
    physicalFollowUp: "Tarkista letkujen tukos, vesi, sulaminen, halkeamat ja oikea reititys ennen DPNR:n tukkoisuuspäätelmää."
  },
  {
    id: "dpnr-egt-crosscheck",
    componentId: "engine.dpnr_differential_pressure_sensor",
    label: "DPNR-paine–EGT-yhteistarkastus",
    kind: "cross-check",
    operatingStates: ["running", "acceleration"],
    signalKeys: ["engine.dpnr_differential_pressure", "engine.egt_inlet", "engine.egt_outlet", "engine.rpm"],
    sourceRows: [263, 315, 347],
    instruction: "Arvioi paine-ero yhdessä DPNR:n tulo- ja lähtölämpöjen sekä kuormituksen kanssa ennen regenerointi- tai tukkoisuuspäätelmää.",
    expectedPattern: "Paine- ja lämpödataa tulkitaan yhtenä jälkikäsittelyketjuna; yksittäinen painearvo ei riitä DPNR:n tuomitsemiseen.",
    physicalFollowUp: "Tarkista paineletkujen lisäksi pakovuodot, EGT-anturien johdot ja jälkikäsittelyketjun muut lähderiveillä nimetyt selittäjät."
  },
  {
    id: "ect-cold-plausibility",
    componentId: "engine.coolant_temperature_sensor",
    label: "ECT:n kylmäuskottavuus",
    kind: "comparison",
    operatingStates: ["key-on"],
    signalKeys: ["engine.coolant_temperature"],
    sourceRows: [152, 254, 330],
    instruction: "Kylmällä moottorilla vertaa ECU:n ECT-arvoa ulkolämpöön ja mahdollisuuksien mukaan muihin kylmän auton lämpöihin ennen käynti- tai DPF/EGR-päätelmää.",
    expectedPattern: "Kylmän auton ECT:n tulee olla ympäristöön nähden uskottava; lähde ei anna tähän kiinteää numeerista toleranssia.",
    physicalFollowUp: "Jos arvo ei ole uskottava, tarkista anturin liitin, johtosarja, jäähdytysnestevuoto/ilma anturin kohdalla ja tarvittaessa anturin resistanssi lämpötilan mukaan."
  },
  {
    id: "ect-warmup-trend",
    componentId: "engine.coolant_temperature_sensor",
    label: "ECT:n lämpenemiskäyrä",
    kind: "dynamic",
    operatingStates: ["running"],
    signalKeys: ["engine.coolant_temperature", "engine.rpm"],
    sourceRows: [152, 254, 330],
    instruction: "Seuraa ECT:n lämpenemiskäyrää kylmästä lämpimäksi ja vertaa käyttäytymistä termostaatin toimintaan sekä moottorin käyntitilaan.",
    expectedPattern: "Lämpötilan tulee muuttua ajon aikana uskottavasti; lähderivit korostavat termostaatti-/ilmalukko-ongelman erottamista anturiviasta.",
    physicalFollowUp: "Poikkeavassa trendissä tarkista termostaatti, jäähdytysnesteen taso/ilma sekä anturin liitin ja johdotus ennen pelkkää anturituomiota."
  },
  {
    id: "ect-high-idle-context",
    componentId: "engine.coolant_temperature_sensor",
    label: "ECT korkean lämpimän tyhjäkäynnin yhteydessä",
    kind: "cross-check",
    operatingStates: ["warm-idle"],
    signalKeys: ["engine.coolant_temperature", "engine.rpm"],
    sourceRows: [311, 330],
    instruction: "Kun lämmin tyhjäkäynti jää korkeaksi, tallenna ECT ja kierrosluku samasta tilanteesta sekä lämpimän uudelleenkäynnistyksen ympäriltä.",
    expectedPattern: "Korkea tyhjäkäynti voi olla ECU:n pyytämä toimintatila; ECT:n uskottavuus tarkistetaan ennen mekaanisen tyhjäkäyntivian, EGR:n tai DPF:n syyttämistä.",
    physicalFollowUp: "Jos ECT on epäuskottava, tarkista liitin ja johtosarja. Jos ECT on uskottava, tämä piste ei yksin nimeä korkean tyhjäkäynnin syytä."
  }
];

function validatePoint(point, ids) {
  if (!point?.id || !/^[a-z0-9-]+$/.test(point.id)) throw new Error(`Invalid inspection point id: ${point?.id}`);
  if (ids.has(point.id)) throw new Error(`Duplicate inspection point id: ${point.id}`);
  ids.add(point.id);
  if (!COMPONENT_BY_ID.has(point.componentId)) throw new Error(`Unknown inspection component: ${point.componentId}`);
  if (!Array.isArray(point.sourceRows) || !point.sourceRows.length || point.sourceRows.some(row => !Number.isInteger(row) || row < 2)) {
    throw new Error(`Inspection point ${point.id} has invalid Vikadiag source rows`);
  }
  if (!Array.isArray(point.operatingStates) || !point.operatingStates.length) throw new Error(`Inspection point ${point.id} has no operating state`);
  if (!Array.isArray(point.signalKeys) || !point.signalKeys.length) throw new Error(`Inspection point ${point.id} has no diagnostic evidence keys`);
  for (const signalKey of point.signalKeys) {
    const signal = getIs220dDiagnosticSignal(signalKey);
    if (!signal) throw new Error(`Unknown inspection signal ${signalKey} in ${point.id}`);
    if (signal.authorization === "field-rejected") throw new Error(`Field-rejected signal cannot enter inspection point ${point.id}`);
  }
}

const pointIds = new Set();
for (const point of rawPoints) validatePoint(point, pointIds);

export const IS220D_COMPONENT_INSPECTION_POINTS = deepFreeze(rawPoints.map(point => ({
  ...point,
  sourceSheet: "Vikadiag_kohteet",
  source: IS220D_COMPONENT_INSPECTION_POINT_SOURCE
})));

function sanitizedSignal(signalKey) {
  const signal = getIs220dDiagnosticSignal(signalKey);
  return deepFreeze({
    key: signal.key,
    label: signal.label,
    evidence: signal.evidence,
    authorization: signal.authorization,
    productionAuthorized: signal.productionAuthorized === true,
    collectedByWideDiagnostic: signal.collectedByWideDiagnostic === true
  });
}

function hydratePoint(point) {
  const component = COMPONENT_BY_ID.get(point.componentId);
  const group = getIs220dDiagnosticGroupForComponent(point.componentId);
  const signals = point.signalKeys.map(sanitizedSignal);
  return deepFreeze({
    ...point,
    componentLabel: component.label,
    diagnosticClass: component.diagnosticClass,
    pnc: component.pnc,
    oe: component.oe,
    groupId: group?.id || "",
    groupLabel: group?.shortLabel || "",
    states: point.operatingStates.map(state => ({ state, label: STATE_LABELS[state] || state })),
    signals,
    evidenceSummary: {
      signalCount: signals.length,
      currentWideDiagnostic: signals.filter(signal => signal.productionAuthorized && signal.collectedByWideDiagnostic).length,
      registeredButNotCurrent: signals.filter(signal => signal.productionAuthorized && !signal.collectedByWideDiagnostic).length,
      awaitingVerification: signals.filter(signal => !signal.productionAuthorized).length
    }
  });
}

export function is220dInspectionPointsForComponent(componentId) {
  const id = String(componentId || "");
  if (!COMPONENT_BY_ID.has(id)) return Object.freeze([]);
  return deepFreeze(IS220D_COMPONENT_INSPECTION_POINTS.filter(point => point.componentId === id).map(hydratePoint));
}

export function buildIs220dInspectionPointScope(groupId = "all") {
  const normalized = String(groupId || "all");
  if (normalized !== "all" && !getIs220dDiagnosticGroup(normalized)) throw new Error(`Unknown IS220d inspection-point group: ${normalized}`);
  const points = IS220D_COMPONENT_INSPECTION_POINTS
    .map(hydratePoint)
    .filter(point => normalized === "all" || point.groupId === normalized);
  const componentIds = [...new Set(points.map(point => point.componentId))];
  return deepFreeze({
    schemaVersion: IS220D_COMPONENT_INSPECTION_POINT_SCHEMA_VERSION,
    source: IS220D_COMPONENT_INSPECTION_POINT_SOURCE,
    groupId: normalized,
    pointCount: points.length,
    componentCount: componentIds.length,
    componentIds,
    points,
    summary: {
      physical: points.filter(point => point.kind === "physical").length,
      comparisons: points.filter(point => point.kind === "comparison").length,
      dynamic: points.filter(point => point.kind === "dynamic").length,
      crossChecks: points.filter(point => point.kind === "cross-check").length,
      currentWideDiagnosticSignals: new Set(points.flatMap(point => point.signals.filter(signal => signal.productionAuthorized && signal.collectedByWideDiagnostic).map(signal => signal.key))).size,
      registeredButNotCurrentSignals: new Set(points.flatMap(point => point.signals.filter(signal => signal.productionAuthorized && !signal.collectedByWideDiagnostic).map(signal => signal.key))).size,
      awaitingVerificationSignals: new Set(points.flatMap(point => point.signals.filter(signal => !signal.productionAuthorized).map(signal => signal.key))).size
    }
  });
}

function kindLabel(kind) {
  if (kind === "physical") return "FYYSINEN";
  if (kind === "comparison") return "VERTAILU";
  if (kind === "dynamic") return "VASTE";
  if (kind === "cross-check") return "RISTIVERTAILU";
  return String(kind || "").toUpperCase();
}

export function buildIs220dInspectionPointScopeHtml(scope) {
  if (!scope?.points?.length) return '<div class="bom-point-empty">Tälle tarkastusalueelle ei ole vielä komponenttikohtaisia tarkastuspisteitä.</div>';
  const cards = scope.points.map(point => {
    const stateText = point.states.map(state => state.label).join(" · ");
    const sourceRows = point.sourceRows.join(", ");
    const evidence = point.evidenceSummary;
    const evidenceText = [
      `nykytestissä ${evidence.currentWideDiagnostic}/${evidence.signalCount}`,
      evidence.registeredButNotCurrent ? `rekisterissä, ei nykytestissä ${evidence.registeredButNotCurrent}` : "",
      evidence.awaitingVerification ? `odottaa varmennusta ${evidence.awaitingVerification}` : ""
    ].filter(Boolean).join(" · ");
    return `<article class="bom-point-card" data-bom-point="${escapeHtml(point.id)}" data-component-id="${escapeHtml(point.componentId)}">
      <div class="bom-point-head"><div><span>${escapeHtml(kindLabel(point.kind))} · ${escapeHtml(point.groupLabel)}</span><strong>${escapeHtml(point.label)}</strong></div><small>${escapeHtml(stateText)}</small></div>
      <div class="bom-point-component">${escapeHtml(point.componentLabel)} · PNC ${escapeHtml(point.pnc)}</div>
      <p>${escapeHtml(point.instruction)}</p>
      <div class="bom-point-pattern"><strong>Odotettu kuvio</strong><span>${escapeHtml(point.expectedPattern)}</span></div>
      <details><summary>Jatkotoimi ja lähde</summary><div class="bom-point-followup">${escapeHtml(point.physicalFollowUp)}</div><div class="bom-point-evidence">Evidenssi: ${escapeHtml(evidenceText)}</div><div class="bom-point-source">${escapeHtml(point.sourceSheet)} · rivit ${escapeHtml(sourceRows)}</div></details>
    </article>`;
  }).join("");
  return `<div class="bom-point-summary"><strong>Komponenttikohtaiset tarkastuspisteet</strong><span>${scope.pointCount} pistettä · ${scope.componentCount} komponenttia</span></div>${cards}`;
}

function ensureStyles() {
  if (typeof document === "undefined" || document.querySelector("#bom-inspection-point-styles")) return;
  const style = document.createElement("style");
  style.id = "bom-inspection-point-styles";
  style.textContent = `
    .bom-inspection-points { margin-top:10px; }
    .bom-point-summary { display:flex; justify-content:space-between; gap:10px; align-items:flex-end; margin-bottom:7px; }
    .bom-point-summary strong { color:var(--text-strong); font-size:10px; }
    .bom-point-summary span { color:var(--muted); font-size:8px; text-align:right; }
    .bom-point-card { margin-top:7px; padding:9px; border:1px solid var(--line); border-radius:10px; background:var(--surface); }
    .bom-point-head { display:flex; justify-content:space-between; gap:8px; align-items:flex-start; }
    .bom-point-head > div { display:flex; flex-direction:column; gap:3px; }
    .bom-point-head span { color:var(--info); font-size:7px; font-weight:800; letter-spacing:.04em; }
    .bom-point-head strong { color:var(--text-strong); font-size:10px; }
    .bom-point-head small { max-width:45%; color:var(--muted); font-size:7px; text-align:right; line-height:1.35; }
    .bom-point-component { margin-top:5px; color:var(--muted); font-size:8px; }
    .bom-point-card p { margin:7px 0 0; color:var(--text-strong); font-size:9px; line-height:1.45; }
    .bom-point-pattern { display:flex; flex-direction:column; gap:3px; margin-top:7px; padding:7px; border-radius:8px; background:var(--surface-inset); }
    .bom-point-pattern strong { color:var(--muted); font-size:7px; text-transform:uppercase; }
    .bom-point-pattern span { color:var(--text-strong); font-size:8px; line-height:1.4; }
    .bom-point-card details { margin-top:7px; }
    .bom-point-card summary { color:var(--info); cursor:pointer; font-size:8px; font-weight:800; }
    .bom-point-followup,.bom-point-evidence,.bom-point-source,.bom-point-empty { margin-top:6px; color:var(--muted); font-size:8px; line-height:1.4; }
    .bom-point-source { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  `;
  document.head.append(style);
}

function selectedGroupId() {
  const value = String(document.querySelector("#bomDiagnosticRunGroup")?.value || "all");
  return value === "all" || getIs220dDiagnosticGroup(value) ? value : "all";
}

function render() {
  if (typeof document === "undefined") return null;
  const target = document.querySelector("#bomInspectionPoints");
  if (!target) return null;
  const scope = buildIs220dInspectionPointScope(selectedGroupId());
  target.innerHTML = buildIs220dInspectionPointScopeHtml(scope);
  return scope;
}

function ensurePanel() {
  if (typeof document === "undefined") return null;
  const existing = document.querySelector("#bomInspectionPoints");
  if (existing) return existing;
  const guided = document.querySelector("#bomGuidedSession");
  if (!guided) return null;
  ensureStyles();
  const panel = document.createElement("div");
  panel.id = "bomInspectionPoints";
  panel.className = "bom-inspection-points";
  guided.append(panel);
  document.querySelector("#bomDiagnosticRunGroup")?.addEventListener("change", render);
  document.querySelector("#bomGroupFilter")?.addEventListener("change", () => globalThis.queueMicrotask?.(render));
  render();
  return panel;
}

export function publishIs220dComponentInspectionPoints() {
  ensurePanel();
  return typeof document === "undefined" ? buildIs220dInspectionPointScope("all") : render();
}

ensurePanel();
