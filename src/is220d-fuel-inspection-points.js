import { getIs220dDiagnosticSignal } from "./is220d-diagnostic-signals.js";

export const IS220D_FUEL_INSPECTION_POINT_SCHEMA_VERSION = 1;
export const IS220D_FUEL_INSPECTION_POINT_SOURCE = "Bom-kaapija / Vikadiag_kohteet";

const FUEL_GROUP_ID = "fuel-rail-injection";
const COMPONENTS = Object.freeze({
  "engine.fuel_filter": Object.freeze({ label: "Polttoainesuodatin", pnc: "23300/23303", oe: "23300-26100; 23390-0L010" }),
  "engine.scv": Object.freeze({ label: "SCV / imuohjausventtiili", pnc: "04226", oe: "04226-0L040" }),
  "engine.injection_pump": Object.freeze({ label: "Korkeapainepumppu", pnc: "22100", oe: "22100-0R031" }),
  "engine.common_rail_pressure_sensor": Object.freeze({ label: "Common rail -paineanturi", pnc: "Pc Sensor / 23810A", oe: "89458-60010" }),
  "engine.fuel_temperature_sensor": Object.freeze({ label: "Polttoaineen lämpötila-anturi", pnc: "89454", oe: "89454-20010" }),
  "engine.main_injectors": Object.freeze({ label: "Pääsuuttimet", pnc: "23670", oe: "23670-29105" })
});

const STATE_LABELS = Object.freeze({
  physical: "FYYSINEN",
  "key-on": "KOEO",
  cranking: "STARTTAUS",
  running: "KÄYNTI",
  "warm-idle": "LÄMMIN TYHJÄKÄYNTI",
  acceleration: "KIIHDYTYS"
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
    id: "fuel-filter-baseline",
    componentId: "engine.fuel_filter",
    label: "Suodattimen, vedenerottimen ja ilmauksen perusta",
    kind: "physical",
    operatingStates: ["physical"],
    signalKeys: ["engine.rail_pressure_obd"],
    sourceRows: [32, 145],
    instruction: "Tarkista suodatinelementti, tiivisteet, vedenerotin, käsipumpun tuntuma, ilmaus ja mahdolliset ilmakuplat ennen SCV-, pumppu- tai suutinpäätelmää.",
    expectedPattern: "Suodatin- tai ilmavuoto voi lähderivien mukaan jäljitellä rail pressure-, SCV-, pumppu- tai suutinongelmaa.",
    limitation: "Rail-paine on tässä seurausarvo; Flex ei mittaa suodattimen painehäviötä suoraan.",
    physicalFollowUp: "Koska suodatin on huoltohistoriassa vaihdettu, painota pesän tiivisteitä, ilmausta ja letkujen ilmavuotoja."
  },
  {
    id: "fuel-filter-rail-build",
    componentId: "engine.fuel_filter",
    label: "Rail-paineen nousu startissa ja kuormalla",
    kind: "dynamic",
    operatingStates: ["cranking", "acceleration"],
    signalKeys: ["engine.rail_pressure_obd", "engine.rpm"],
    sourceRows: [32, 145],
    instruction: "Tallenna rail-paine ja kierrosluku startissa sekä kuormitushetkellä ja käytä poikkeamaa syynä palata ensin suodattimen, ilmauksen ja matalapainepuolen tarkastukseen.",
    expectedPattern: "Rail-paineen hidas nousu tai kuormalla heikkenevä vaste ei yksin nimeä suodatinta, koska sama ketju voi tulla SCV:stä, pumpusta, ilmasta tai paluuvuodosta.",
    limitation: "Nykyinen varmennettu Flex-signaali antaa actual-rail-paineen; source-rivien target-vs-actual-vertailu vaatii vielä varmennetun target-signaalin.",
    physicalFollowUp: "Jos oire näkyy, tarkista suodatinpesä ja matalapainepuoli ennen kalliimpia osia."
  },
  {
    id: "scv-physical-baseline",
    componentId: "engine.scv",
    label: "SCV:n sähkö- ja polttoaineperusta",
    kind: "physical",
    operatingStates: ["physical"],
    signalKeys: ["engine.rail_pressure_obd"],
    sourceRows: [10, 336, 343],
    instruction: "Tarkista polttoainesuodatin ja ilmavuodot ensin, sitten SCV-liitin, johdotus, pumpun alueen lika/vuoto ja paluupuoli.",
    expectedPattern: "SCV:tä ei nimetä syyksi vain nykimisen tai rail-painepoikkeaman perusteella, koska lähderivit listaavat saman oireketjun suodattimelle, ilmalle, pumpulle ja paluuvuodolle.",
    limitation: "SCV duty/command ei ole nykyisessä varmennetussa Flex-signaalijoukossa.",
    physicalFollowUp: "Sähkö- ja syöttöpuoli pitää olla uskottava ennen venttiilin vaihtopäätelmää."
  },
  {
    id: "scv-rail-response",
    componentId: "engine.scv",
    label: "SCV-epäilyn rail-painevaste",
    kind: "cross-check",
    operatingStates: ["running", "acceleration"],
    signalKeys: ["engine.rail_pressure_obd", "engine.rpm", "engine.fuel_temperature_screening"],
    sourceRows: [10, 336, 343],
    instruction: "Tallenna rail-paine ja kierrosluku erityisesti nykäisyhetkellä; fuel temp näkyy tässä varmennusta odottavana tukisignaalina, koska lähderivit korostavat lämpötilakontekstia.",
    expectedPattern: "SCV-epäily vahvistuu vasta, jos rail-paineen käyttäytyminen sopii oirehetkeen ja suodatin/ilma/paluupuoli eivät selitä sitä.",
    limitation: "Target rail pressure ja SCV duty puuttuvat nykyisestä varmennetusta lukusarjasta, joten piste ei voi yksin erottaa SCV:tä pumpusta.",
    physicalFollowUp: "Jos rail-paine poikkeaa oirehetkellä, käy suodatin, ilmaus, letkut, paluuvuoto ja pumpun ulkoinen vuoto läpi."
  },
  {
    id: "pump-preconditions",
    componentId: "engine.injection_pump",
    label: "Korkeapainepumpun esiehdot ennen tuomiota",
    kind: "physical",
    operatingStates: ["physical"],
    signalKeys: ["engine.rail_pressure_obd"],
    sourceRows: [34, 336, 343],
    instruction: "Ennen pumpun tuomiota tarkista tankin/matalapainepuolen syöttö, suodatin, ilmavuodot, SCV, paluuvuodot, pumpun ulkoinen vuoto ja polttoainenäyte metallihileelle.",
    expectedPattern: "Pumppu on lähderivien mukaan kallis viimeisempi päätelmä, ei ensimmäinen osa rail pressure -oireessa.",
    limitation: "Flex ei tee aktiivista pump test- tai fuel leak test -toimintoa.",
    physicalFollowUp: "Jos metallihilettä löytyy, kirjaa havainto erikseen; muuten jatka rail-paineen startti- ja kuormavasteeseen."
  },
  {
    id: "pump-rail-build",
    componentId: "engine.injection_pump",
    label: "Pumpun rail-paineen muodostus",
    kind: "dynamic",
    operatingStates: ["cranking", "running", "acceleration"],
    signalKeys: ["engine.rail_pressure_obd", "engine.rpm", "engine.fuel_temperature_screening"],
    sourceRows: [34, 336, 343],
    instruction: "Tallenna rail-paine startissa, tyhjäkäynnillä ja kuormalla yhdessä kierrosluvun kanssa; vertaa oirehetkeä matalapainepuolen ja SCV:n havaintoihin.",
    expectedPattern: "Rail-paineen muodostuksen poikkeama kertoo järjestelmäviasta, mutta ei erottele pumppua SCV:stä, suodattimesta, ilmasta tai suuttimien paluuvuodosta ilman lisäevidenssiä.",
    limitation: "Target rail pressure, SCV duty ja aktiivinen pump test eivät ole nykyisessä varmennetussa Flex-lukusarjassa.",
    physicalFollowUp: "Jos actual-paine käyttäytyy poikkeavasti, varmista esiehdot ja tee tarvittaessa paluuvuotomittaus ennen pumppupäätelmää."
  },
  {
    id: "rail-sensor-koeo-plausibility",
    componentId: "engine.common_rail_pressure_sensor",
    label: "Rail-paineanturin KOEO-uskottavuus",
    kind: "comparison",
    operatingStates: ["key-on"],
    signalKeys: ["engine.rail_pressure_obd", "engine.rail_pressure_screening"],
    sourceRows: [452],
    instruction: "Tarkista rail-paineanturin arvo jo KOEO-tilassa ennen SCV- tai pumppupäätelmää ja vertaa myöhemmin starttauksen vasteeseen.",
    expectedPattern: "Lähderivi korostaa, että epäuskottava rail-paine jo ilman käyntiä ohjaa ensin anturi-/johtopiiriin.",
    limitation: "Standardoitu actual-rail-paine on varmennettu; Techstream-johdettu rinnakkaissignaali näkyy vain varmennusta odottavana eikä sitä lähetetä.",
    physicalFollowUp: "Tarkista anturin liitin, 5 V syöttö, sensorimaa ja signaalijohdot."
  },
  {
    id: "rail-sensor-cranking-response",
    componentId: "engine.common_rail_pressure_sensor",
    label: "Rail-paineanturin starttausvaste",
    kind: "dynamic",
    operatingStates: ["cranking", "running"],
    signalKeys: ["engine.rail_pressure_obd", "engine.rpm"],
    sourceRows: [452],
    instruction: "Tallenna rail-paine ja RPM starttauksen aikana sekä käynnin alettua ja tarkista, että anturisignaali käyttäytyy dynaamisesti eikä jää selvästi kiinteäksi tai epäloogiseksi.",
    expectedPattern: "Anturin vasteen tulee muuttua moottorin tilan mukana; lähde ei anna kiinteää numeerista starttirajaa tähän tarkastuspisteeseen.",
    limitation: "Target rail pressure ja PCR1/PCR2-rinnakkaiskanavat eivät ole nykyisessä varmennetussa Flex-signaalijoukossa.",
    physicalFollowUp: "Epäuskottavassa signaalissa tarkista anturin sähköpiiri ennen SCV:n tai pumpun vaihtopäätelmää."
  },
  {
    id: "fuel-temp-cold-plausibility",
    componentId: "engine.fuel_temperature_sensor",
    label: "Fuel temp -kylmäuskottavuus",
    kind: "comparison",
    operatingStates: ["key-on"],
    signalKeys: ["engine.fuel_temperature_screening"],
    sourceRows: [154, 256, 313],
    instruction: "Kylmällä autolla vertaa fuel temp -arvoa ympäristön lämpötilaan ennen rail-/SCV-diagnoosin pitkälle viemistä.",
    expectedPattern: "Polttoainelämpötilan tulee olla kylmässä tilanteessa ympäristöön nähden uskottava; lähde ei anna kiinteää numeerista toleranssia.",
    limitation: "Fuel temp -signaali on Techstream-johdettu ja odottaa ajoneuvovarmennusta, joten Flex ei lähetä sitä tuotantotestissä.",
    physicalFollowUp: "Tarkista anturin liitin ja johtosarjan hankaus polttoaineputkien/pumpun alueella."
  },
  {
    id: "fuel-temp-warmup-trend",
    componentId: "engine.fuel_temperature_sensor",
    label: "Fuel temp -lämpenemistrendi",
    kind: "dynamic",
    operatingStates: ["running"],
    signalKeys: ["engine.fuel_temperature_screening", "engine.rail_pressure_obd"],
    sourceRows: [154, 256, 313],
    instruction: "Seuraa fuel temp -arvon nousua ajossa ja tarkastele rail-paineen käyttäytymistä samassa kylmä/lämmin-kontekstissa.",
    expectedPattern: "Lähderivien mukaan epärealistinen fuel temp voi vääristää rail-/määrälogiikan tulkintaa; trendi on tärkeämpi kuin yksittäinen arvo.",
    limitation: "Fuel temp odottaa ajoneuvovarmennusta eikä sitä käytetä vielä automaattiseen vikapäätelmään.",
    physicalFollowUp: "Jos lämpötilakäyttäytyminen jää epäuskottavaksi Techstream-varmennuksen jälkeen, tarkista anturi, liitin ja johtosarja."
  },
  {
    id: "injector-physical-baseline",
    componentId: "engine.main_injectors",
    label: "Suutinten fyysinen ja mekaaninen erotus",
    kind: "physical",
    operatingStates: ["physical"],
    signalKeys: ["engine.rail_pressure_obd"],
    sourceRows: [8, 140, 281, 334, 344],
    instruction: "Tee paluuvuotomittaus, tarkista kuparitiivisteiden puhallus/noki, suutinliittimet ja johtosarja sekä tarvittaessa sylinterin puristus/ohivuoto ennen suutinvaihtoa.",
    expectedPattern: "Suutinkorjausarvo tai savutus ei lähderivien mukaan yksin todista suutinrunkoa, koska puristus, tiiviste, johdotus ja driver voivat vaikuttaa samaan oireeseen.",
    limitation: "Kentässä hylättyä suutinkorjaustunnistetta ei käytetä tässä mallissa; sylinterikohtainen feedback odottaa oikean Techstream-transaktion varmennusta.",
    physicalFollowUp: "Vertaa paluuvuotoja kylmänä ja lämpimänä ja kirjaa sylinterikohtaiset erot."
  },
  {
    id: "injector-system-context",
    componentId: "engine.main_injectors",
    label: "Suutinoireen järjestelmäkonteksti",
    kind: "cross-check",
    operatingStates: ["cranking", "running", "warm-idle", "acceleration"],
    signalKeys: ["engine.rail_pressure_obd", "engine.rpm", "engine.fuel_temperature_screening", "engine.injection_timing_obd"],
    sourceRows: [8, 140, 281, 334, 344],
    instruction: "Tallenna rail-paine ja RPM oirehetkellä; pidä fuel temp ja ruiskutusajoitus erillisinä evidenssiaukkoina, kunnes niiden käyttö on varmennettu.",
    expectedPattern: "Pääsuutinpäätelmä vaatii usean riippumattoman evidenssin yhdistämistä: käyntioire, rail-järjestelmä, fyysinen leak-off/tiiviste ja myöhemmin varmennettu sylinterikohtainen palaute.",
    limitation: "Nykyinen Flex ei julkaise sylinterikohtaista injection feedback -arvoa, eikä puuttuvaa arvoa korvata arvatulla PID:llä.",
    physicalFollowUp: "Jos rail-paine pysyy uskottavana mutta yksi sylinteri oireilee, painota leak-off-, tiiviste-, johtosarja- ja puristustarkastuksia."
  }
];

function validatePoint(point, ids) {
  if (!point?.id || !/^[a-z0-9-]+$/.test(point.id)) throw new Error(`Invalid fuel inspection point id: ${point?.id}`);
  if (ids.has(point.id)) throw new Error(`Duplicate fuel inspection point id: ${point.id}`);
  ids.add(point.id);
  if (!COMPONENTS[point.componentId]) throw new Error(`Unknown fuel inspection component: ${point.componentId}`);
  if (!Array.isArray(point.sourceRows) || !point.sourceRows.length || point.sourceRows.some(row => !Number.isInteger(row) || row < 2)) {
    throw new Error(`Fuel inspection point ${point.id} has invalid Vikadiag source rows`);
  }
  for (const signalKey of point.signalKeys || []) {
    const signal = getIs220dDiagnosticSignal(signalKey);
    if (!signal) throw new Error(`Unknown fuel inspection signal ${signalKey} in ${point.id}`);
    if (signal.authorization === "field-rejected") throw new Error(`Field-rejected signal cannot enter fuel inspection point ${point.id}`);
  }
}

const ids = new Set();
for (const point of rawPoints) validatePoint(point, ids);

export const IS220D_FUEL_INSPECTION_POINTS = deepFreeze(rawPoints.map(point => ({
  ...point,
  groupId: FUEL_GROUP_ID,
  sourceSheet: "Vikadiag_kohteet",
  source: IS220D_FUEL_INSPECTION_POINT_SOURCE
})));

function hydrateSignal(key) {
  const signal = getIs220dDiagnosticSignal(key);
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
  const component = COMPONENTS[point.componentId];
  const signals = point.signalKeys.map(hydrateSignal);
  return deepFreeze({
    ...point,
    componentLabel: component.label,
    pnc: component.pnc,
    oe: component.oe,
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

export function buildIs220dFuelInspectionScope(groupId = "all") {
  const normalized = String(groupId || "all");
  if (!["all", FUEL_GROUP_ID].includes(normalized)) {
    return deepFreeze({ schemaVersion: IS220D_FUEL_INSPECTION_POINT_SCHEMA_VERSION, groupId: normalized, visible: false, pointCount: 0, componentCount: 0, points: [] });
  }
  const points = IS220D_FUEL_INSPECTION_POINTS.map(hydratePoint);
  return deepFreeze({
    schemaVersion: IS220D_FUEL_INSPECTION_POINT_SCHEMA_VERSION,
    source: IS220D_FUEL_INSPECTION_POINT_SOURCE,
    groupId: normalized,
    visible: true,
    pointCount: points.length,
    componentCount: Object.keys(COMPONENTS).length,
    points,
    summary: {
      physical: points.filter(point => point.kind === "physical").length,
      comparisons: points.filter(point => point.kind === "comparison").length,
      dynamic: points.filter(point => point.kind === "dynamic").length,
      crossChecks: points.filter(point => point.kind === "cross-check").length,
      awaitingVerificationSignals: new Set(points.flatMap(point => point.signals.filter(signal => !signal.productionAuthorized).map(signal => signal.key))).size
    }
  });
}

function kindLabel(kind) {
  return ({ physical: "FYYSINEN", comparison: "VERTAILU", dynamic: "VASTE", "cross-check": "RISTIVERTAILU" })[kind] || String(kind || "").toUpperCase();
}

export function buildIs220dFuelInspectionScopeHtml(scope) {
  if (!scope?.visible) return "";
  const cards = scope.points.map(point => {
    const evidence = point.evidenceSummary;
    const evidenceText = [
      `nykytestissä ${evidence.currentWideDiagnostic}/${evidence.signalCount}`,
      evidence.registeredButNotCurrent ? `rekisterissä, ei nykytestissä ${evidence.registeredButNotCurrent}` : "",
      evidence.awaitingVerification ? `odottaa varmennusta ${evidence.awaitingVerification}` : ""
    ].filter(Boolean).join(" · ");
    return `<article class="bom-fuel-point-card" data-bom-fuel-point="${escapeHtml(point.id)}">
      <div class="bom-fuel-point-head"><div><span>${escapeHtml(kindLabel(point.kind))}</span><strong>${escapeHtml(point.label)}</strong></div><small>${escapeHtml(point.states.map(state => state.label).join(" · "))}</small></div>
      <div class="bom-fuel-point-component">${escapeHtml(point.componentLabel)} · PNC ${escapeHtml(point.pnc)} · OE ${escapeHtml(point.oe)}</div>
      <p>${escapeHtml(point.instruction)}</p>
      <div class="bom-fuel-point-pattern"><strong>Odotettu kuvio</strong><span>${escapeHtml(point.expectedPattern)}</span></div>
      <div class="bom-fuel-point-limit"><strong>Raja</strong><span>${escapeHtml(point.limitation)}</span></div>
      <details><summary>Jatkotoimi ja lähde</summary><div>${escapeHtml(point.physicalFollowUp)}</div><div>Evidenssi: ${escapeHtml(evidenceText)}</div><div class="bom-fuel-point-source">${escapeHtml(point.sourceSheet)} · rivit ${escapeHtml(point.sourceRows.join(", "))}</div></details>
    </article>`;
  }).join("");
  return `<div class="bom-fuel-point-summary"><strong>Polttoaine / rail / ruiskutus</strong><span>${scope.pointCount} tarkastuspistettä · ${scope.componentCount} komponenttia</span></div>${cards}`;
}

function ensureStyles() {
  if (typeof document === "undefined" || document.querySelector("#bom-fuel-inspection-styles")) return;
  const style = document.createElement("style");
  style.id = "bom-fuel-inspection-styles";
  style.textContent = `
    .bom-fuel-inspection { margin-top:10px; }
    .bom-fuel-point-summary { display:flex; justify-content:space-between; gap:10px; align-items:flex-end; margin-bottom:7px; padding-top:9px; border-top:1px solid var(--line-soft); }
    .bom-fuel-point-summary strong { color:var(--text-strong); font-size:10px; }
    .bom-fuel-point-summary span { color:var(--muted); font-size:8px; text-align:right; }
    .bom-fuel-point-card { margin-top:7px; padding:9px; border:1px solid var(--line); border-radius:10px; background:var(--surface); }
    .bom-fuel-point-head { display:flex; justify-content:space-between; gap:8px; }
    .bom-fuel-point-head > div { display:flex; flex-direction:column; gap:3px; }
    .bom-fuel-point-head span { color:var(--info); font-size:7px; font-weight:800; }
    .bom-fuel-point-head strong { color:var(--text-strong); font-size:10px; }
    .bom-fuel-point-head small { max-width:46%; color:var(--muted); font-size:7px; text-align:right; }
    .bom-fuel-point-component { margin-top:5px; color:var(--muted); font-size:8px; }
    .bom-fuel-point-card p { margin:7px 0 0; color:var(--text-strong); font-size:9px; line-height:1.45; }
    .bom-fuel-point-pattern,.bom-fuel-point-limit { display:flex; flex-direction:column; gap:3px; margin-top:7px; padding:7px; border-radius:8px; background:var(--surface-inset); }
    .bom-fuel-point-pattern strong,.bom-fuel-point-limit strong { color:var(--muted); font-size:7px; text-transform:uppercase; }
    .bom-fuel-point-pattern span,.bom-fuel-point-limit span { color:var(--text-strong); font-size:8px; line-height:1.4; }
    .bom-fuel-point-limit { border:1px solid var(--warning-border); }
    .bom-fuel-point-card details { margin-top:7px; color:var(--muted); font-size:8px; line-height:1.4; }
    .bom-fuel-point-card summary { color:var(--info); cursor:pointer; font-weight:800; }
    .bom-fuel-point-source { margin-top:5px; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  `;
  document.head.append(style);
}

function selectedGroupId() {
  return String(document.querySelector("#bomDiagnosticRunGroup")?.value || "all");
}

function render() {
  if (typeof document === "undefined") return null;
  const target = document.querySelector("#bomFuelInspectionPoints");
  if (!target) return null;
  const scope = buildIs220dFuelInspectionScope(selectedGroupId());
  target.innerHTML = buildIs220dFuelInspectionScopeHtml(scope);
  target.classList.toggle("hidden", !scope.visible);
  return scope;
}

function ensurePanel() {
  if (typeof document === "undefined") return null;
  const existing = document.querySelector("#bomFuelInspectionPoints");
  if (existing) return existing;
  const guided = document.querySelector("#bomGuidedSession");
  if (!guided) return null;
  ensureStyles();
  const panel = document.createElement("div");
  panel.id = "bomFuelInspectionPoints";
  panel.className = "bom-fuel-inspection";
  guided.append(panel);
  document.querySelector("#bomDiagnosticRunGroup")?.addEventListener("change", render);
  document.querySelector("#bomGroupFilter")?.addEventListener("change", () => globalThis.queueMicrotask?.(render));
  render();
  return panel;
}

export function publishIs220dFuelInspectionPoints() {
  ensurePanel();
  return typeof document === "undefined" ? buildIs220dFuelInspectionScope("all") : render();
}

ensurePanel();
