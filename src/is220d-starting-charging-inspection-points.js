import { buildIs220dRepairManualVisualsHtml } from "./is220d-repair-manual-visuals.js";
import { getIs220dDiagnosticSignal } from "./is220d-diagnostic-signals.js";

export const IS220D_STARTING_CHARGING_INSPECTION_SCHEMA_VERSION = 1;
export const IS220D_STARTING_CHARGING_INSPECTION_SOURCE = "Bom-kaapija / Vikadiag_kohteet";

const GROUP_ID = "starting-charging-position";
const COMPONENTS = Object.freeze({
  "engine.alternator": Object.freeze({ label: "Laturi", pnc: "27020", oe: "27060-26030" }),
  "engine.starter": Object.freeze({ label: "Starttimoottori", pnc: "28100", oe: "28100-0R010" }),
  "engine.crank_position_sensor": Object.freeze({ label: "Kampiakselin asentotunnistin", pnc: "11401G", oe: "90919-05069" })
});

const STATE_LABELS = Object.freeze({
  physical: "FYYSINEN",
  "key-on": "KOEO",
  cranking: "STARTTAUS",
  running: "KÄYNTI",
  "hot-restart": "LÄMMIN UUDELLEENKÄYNNISTYS"
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
    id: "alternator-physical-baseline",
    componentId: "engine.alternator",
    label: "Laturin hihna-, kaapeli- ja maaperusta",
    kind: "physical",
    operatingStates: ["physical"],
    signalKeys: ["engine.ecu_voltage"],
    sourceRows: [11, 350],
    instruction: "Tarkista akun kunto, apulaitehihna, laturin B+, runkomaa sekä plus- ja maapuolen jännitehäviöt ennen laturin vaihtopäätelmää.",
    expectedPattern: "Latausvika erotetaan lähderivien mukaan ensin akusta, hihnasta, johdotuksesta ja maadoituksista.",
    limitation: "ECU-jännite on tukisignaali; varmistus tehdään yleismittarilla ja kuormituksella, eikä ECU-arvo korvaa B+- tai maapuolen jännitehäviömittausta.",
    physicalFollowUp: "Jos lataus vaihtelee, tarkista myös laturin vapaakytkinhihnapyörä ja AC-ripple diodivian varalta."
  },
  {
    id: "alternator-running-voltage",
    componentId: "engine.alternator",
    label: "Latausjännitteen käyntivaste",
    kind: "dynamic",
    operatingStates: ["key-on", "running"],
    signalKeys: ["engine.ecu_voltage", "engine.rpm"],
    sourceRows: [11, 350],
    instruction: "Vertaa ECU-jännitettä ennen käynnistystä ja moottorin käydessä sekä tarkista muutos sähkökuormaa lisättäessä.",
    expectedPattern: "Vikadiag-rivi 11 antaa yleismittarilla varmennettavaksi latausjännitteeksi noin 13–15 V käynnissä; ECU-jännitteen tulee samalla käyttäytyä loogisesti käyntitilan kanssa.",
    limitation: "13–15 V on lähderivin yleismittaritarkistus, ei Flexin automaattinen laturin hyväksymisraja.",
    physicalFollowUp: "Poikkeamassa mittaa suoraan akulta ja laturin B+:sta sekä tarkista jännitehäviö ja ripple."
  },
  {
    id: "starter-permission-and-circuit",
    componentId: "engine.starter",
    label: "Starttilupa ja starttipiiri ennen starttimoottoria",
    kind: "physical",
    operatingStates: ["physical", "key-on"],
    signalKeys: ["engine.ecu_voltage"],
    sourceRows: [12, 170, 350],
    instruction: "Jos startti ei pyöri, erottele ensin akun kunto, maadoitukset, päävirtakaapeli, solenoidin heräte ja starttilupa ennen starttimoottorin tuomiota.",
    expectedPattern: "Yksi naksahdus, sähköjen himmeneminen tai täysin puuttuva starttaus eivät ole sama vika; lähderivi 170 erottaa starttiluvan puuttumisen solenoidi-/starttiviasta.",
    limitation: "Kytkinpolkimen starttilupa/immobilizer-permission ei ole vielä varmennettuna Flex-signaalina tässä profiilissa.",
    physicalFollowUp: "Tarkista kytkinstarttikytkin erikseen, jos starttilupaviestikin puuttuu; jos lupa tulee mutta startti ei pyöri, jatka solenoidi- ja kaapelimittauksiin."
  },
  {
    id: "starter-cranking-voltage-rpm",
    componentId: "engine.starter",
    label: "Starttauksen jännite ja RPM",
    kind: "cross-check",
    operatingStates: ["cranking"],
    signalKeys: ["engine.ecu_voltage", "engine.rpm", "engine.rail_pressure_obd"],
    sourceRows: [12, 170, 350],
    instruction: "Tallenna ECU-jännite, cranking RPM ja rail-paine samassa starttauksessa, jotta hidas startti ei näyttäisi virheellisesti pelkältä polttoainevialta.",
    expectedPattern: "Jos RPM syntyy, kampisignaali ja mekaaninen pyöritys ovat ainakin havaittavissa; hidas pyöritys ja jännitepoikkeama ohjaavat ensin akku-/kaapeli-/starttipuolelle.",
    limitation: "Flexin ECU-jännite ei korvaa startin pääkaapelin ja maakaapelin kuormitettua jännitehäviömittausta tai starttivirran mittausta.",
    physicalFollowUp: "Mittaa akun kuormitus, plus- ja maapuolen jännitehäviöt sekä solenoidin heräte starttaushetkellä."
  },
  {
    id: "crank-sensor-physical-baseline",
    componentId: "engine.crank_position_sensor",
    label: "Kampianturin liitin, johto ja lämpö-/tärinäperusta",
    kind: "physical",
    operatingStates: ["physical", "hot-restart"],
    signalKeys: ["engine.rpm"],
    sourceRows: [17, 113, 268, 305, 325],
    instruction: "Tarkista kampianturin liitin, johdon hankaus, kiinnitys, etäisyys triggeriin ja metallipöly sekä vertaile oiretta kylmänä ja lämpimänä.",
    expectedPattern: "Lähderivit korostavat, ettei staattinen vastusarvo yksin todista kampianturia ehjäksi lämpö- tai tärinäkatkoksessa.",
    limitation: "Flexillä on varmennettu RPM, mutta cam/crank sync/correlation ei ole vielä varmennettuna nimettynä tuotantosignaalina.",
    physicalFollowUp: "Jos lämpö-/tärinäoire jatkuu, oskilloskooppi startatessa ja johtosarjan wiggle-testi ovat staattista vastusmittausta vahvempia varmistuksia."
  },
  {
    id: "crank-sensor-cranking-rpm",
    componentId: "engine.crank_position_sensor",
    label: "Kampisignaalin starttaus-RPM",
    kind: "dynamic",
    operatingStates: ["cranking", "hot-restart"],
    signalKeys: ["engine.rpm", "engine.ecu_voltage"],
    sourceRows: [113, 268, 305, 325],
    instruction: "Tarkista syntyykö moottorin RPM starttauksen aikana, erityisesti lämpimän no-start- tai sammumisoireen jälkeen.",
    expectedPattern: "Jos RPM puuttuu startissa, lähderivit nostavat kampianturin/piirin vahvaksi epäilyksi; havaittu RPM ei kuitenkaan yksin varmista cam/crank-synkronointia tai anturin signaalimuotoa.",
    limitation: "RPM on epäsuora ECU:n tulkinta kampisignaalista; signaalin amplitudi, muoto ja cam/crank correlation vaativat muuta evidenssiä.",
    physicalFollowUp: "RPM:n puuttuessa tarkista CKP-liitin, johdotus, anturin välys/kiinnitys ja triggerilevy; tarvittaessa mittaa CKP/CMP oskilloskoopilla."
  }
];

function validatePoint(point, ids) {
  if (!point?.id || !/^[a-z0-9-]+$/.test(point.id)) throw new Error(`Invalid starting/charging inspection point id: ${point?.id}`);
  if (ids.has(point.id)) throw new Error(`Duplicate starting/charging inspection point id: ${point.id}`);
  ids.add(point.id);
  if (!COMPONENTS[point.componentId]) throw new Error(`Unknown starting/charging component: ${point.componentId}`);
  if (!Array.isArray(point.sourceRows) || !point.sourceRows.length || point.sourceRows.some(row => !Number.isInteger(row) || row < 2)) {
    throw new Error(`Starting/charging point ${point.id} has invalid source rows`);
  }
  for (const signalKey of point.signalKeys || []) {
    const signal = getIs220dDiagnosticSignal(signalKey);
    if (!signal) throw new Error(`Unknown starting/charging signal ${signalKey} in ${point.id}`);
    if (signal.authorization === "field-rejected") throw new Error(`Field-rejected signal cannot enter starting/charging point ${point.id}`);
  }
}

const ids = new Set();
for (const point of rawPoints) validatePoint(point, ids);

export const IS220D_STARTING_CHARGING_INSPECTION_POINTS = deepFreeze(rawPoints.map(point => ({
  ...point,
  groupId: GROUP_ID,
  sourceSheet: "Vikadiag_kohteet",
  source: IS220D_STARTING_CHARGING_INSPECTION_SOURCE
})));

function hydrateSignal(key) {
  const signal = getIs220dDiagnosticSignal(key);
  return deepFreeze({ key: signal.key, label: signal.label, evidence: signal.evidence, authorization: signal.authorization, productionAuthorized: signal.productionAuthorized === true, collectedByWideDiagnostic: signal.collectedByWideDiagnostic === true });
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
      awaitingVerification: signals.filter(signal => !signal.productionAuthorized).length
    }
  });
}

export function buildIs220dStartingChargingInspectionScope(groupId = "all") {
  const normalized = String(groupId || "all");
  if (!["all", GROUP_ID].includes(normalized)) return deepFreeze({ schemaVersion: IS220D_STARTING_CHARGING_INSPECTION_SCHEMA_VERSION, groupId: normalized, visible: false, pointCount: 0, componentCount: 0, points: [] });
  const points = IS220D_STARTING_CHARGING_INSPECTION_POINTS.map(hydratePoint);
  return deepFreeze({ schemaVersion: IS220D_STARTING_CHARGING_INSPECTION_SCHEMA_VERSION, source: IS220D_STARTING_CHARGING_INSPECTION_SOURCE, groupId: normalized, visible: true, pointCount: points.length, componentCount: Object.keys(COMPONENTS).length, points });
}

function kindLabel(kind) {
  return ({ physical: "FYYSINEN", dynamic: "VASTE", "cross-check": "RISTIVERTAILU" })[kind] || String(kind || "").toUpperCase();
}

export function buildIs220dStartingChargingInspectionScopeHtml(scope) {
  if (!scope?.visible) return "";
  return `<div class="bom-start-point-summary"><strong>Startti / lataus / kampisignaali</strong><span>${scope.pointCount} tarkastuspistettä · ${scope.componentCount} komponenttia</span></div>${scope.points.map(point => `<article class="bom-start-point-card" data-bom-start-point="${escapeHtml(point.id)}"><div class="bom-start-point-head"><div><span>${escapeHtml(kindLabel(point.kind))}</span><strong>${escapeHtml(point.label)}</strong></div><small>${escapeHtml(point.states.map(state => state.label).join(" · "))}</small></div><div class="bom-start-point-component">${escapeHtml(point.componentLabel)} · PNC ${escapeHtml(point.pnc)} · OE ${escapeHtml(point.oe)}</div><p>${escapeHtml(point.instruction)}</p>${buildIs220dRepairManualVisualsHtml(point.componentId)}<div class="bom-start-point-pattern"><strong>Odotettu kuvio</strong><span>${escapeHtml(point.expectedPattern)}</span></div><div class="bom-start-point-limit"><strong>Raja</strong><span>${escapeHtml(point.limitation)}</span></div><details><summary>Jatkotoimi ja lähde</summary><div>${escapeHtml(point.physicalFollowUp)}</div><div>Evidenssi nykytestissä ${point.evidenceSummary.currentWideDiagnostic}/${point.evidenceSummary.signalCount}</div><div class="bom-start-point-source">${escapeHtml(point.sourceSheet)} · rivit ${escapeHtml(point.sourceRows.join(", "))}</div></details></article>`).join("")}`;
}

function ensureStyles() {
  if (typeof document === "undefined" || document.querySelector("#bom-start-inspection-styles")) return;
  const style = document.createElement("style");
  style.id = "bom-start-inspection-styles";
  style.textContent = `.bom-start-inspection{margin-top:10px}.bom-start-point-summary{display:flex;justify-content:space-between;gap:10px;align-items:flex-end;margin-bottom:7px;padding-top:9px;border-top:1px solid var(--line-soft)}.bom-start-point-summary strong{font-size:10px}.bom-start-point-summary span{color:var(--muted);font-size:8px;text-align:right}.bom-start-point-card{margin-top:7px;padding:9px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}.bom-start-point-head{display:flex;justify-content:space-between;gap:8px}.bom-start-point-head>div{display:flex;flex-direction:column;gap:3px}.bom-start-point-head span{color:var(--info);font-size:7px;font-weight:800}.bom-start-point-head strong{font-size:10px}.bom-start-point-head small{max-width:46%;color:var(--muted);font-size:7px;text-align:right}.bom-start-point-component{margin-top:5px;color:var(--muted);font-size:8px}.bom-start-point-card p{margin:7px 0 0;font-size:9px;line-height:1.45}.bom-start-point-pattern,.bom-start-point-limit{display:flex;flex-direction:column;gap:3px;margin-top:7px;padding:7px;border-radius:8px;background:var(--surface-inset)}.bom-start-point-pattern strong,.bom-start-point-limit strong{color:var(--muted);font-size:7px;text-transform:uppercase}.bom-start-point-pattern span,.bom-start-point-limit span{font-size:8px;line-height:1.4}.bom-start-point-limit{border:1px solid var(--warning-border)}.bom-start-point-card details{margin-top:7px;color:var(--muted);font-size:8px;line-height:1.4}.bom-start-point-card summary{color:var(--info);cursor:pointer;font-weight:800}.bom-start-point-source{margin-top:5px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}`;
  document.head.append(style);
}

function selectedGroupId() { return String(document.querySelector("#bomDiagnosticRunGroup")?.value || "all"); }
function render() {
  if (typeof document === "undefined") return null;
  const target = document.querySelector("#bomStartingChargingInspectionPoints");
  if (!target) return null;
  const scope = buildIs220dStartingChargingInspectionScope(selectedGroupId());
  target.innerHTML = buildIs220dStartingChargingInspectionScopeHtml(scope);
  target.classList.toggle("hidden", !scope.visible);
  return scope;
}
function ensurePanel() {
  if (typeof document === "undefined") return null;
  const existing = document.querySelector("#bomStartingChargingInspectionPoints");
  if (existing) return existing;
  const guided = document.querySelector("#bomGuidedSession");
  if (!guided) return null;
  ensureStyles();
  const panel = document.createElement("div");
  panel.id = "bomStartingChargingInspectionPoints";
  panel.className = "bom-start-inspection";
  guided.append(panel);
  document.querySelector("#bomDiagnosticRunGroup")?.addEventListener("change", render);
  render();
  return panel;
}

export function publishIs220dStartingChargingInspectionPoints() {
  ensurePanel();
  return typeof document === "undefined" ? buildIs220dStartingChargingInspectionScope("all") : render();
}

ensurePanel();
