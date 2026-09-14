import { getIs220dDiagnosticSignal } from "./is220d-diagnostic-signals.js";

export const IS220D_AIR_EXHAUST_INSPECTION_SCHEMA_VERSION = 1;
export const IS220D_AIR_EXHAUST_INSPECTION_SOURCE = "Bom-kaapija / Vikadiag_kohteet";

const COMPONENTS = Object.freeze({
  "engine.turbocharger": Object.freeze({ label: "Turboahdin", pnc: "17201", oe: "17201-26011", groupId: "air-intake-turbo-egr" }),
  "engine.intercooler": Object.freeze({ label: "Välijäähdytin", pnc: "17940D", oe: "17940-26010", groupId: "air-intake-turbo-egr" }),
  "engine.intake_manifold": Object.freeze({ label: "Imusarja", pnc: "17111", oe: "17101-26110", groupId: "air-intake-turbo-egr" }),
  "engine.vacuum_regulating_valve": Object.freeze({ label: "Alipaineen säätöventtiili", pnc: "25819", oe: "25819-0R011", groupId: "air-intake-turbo-egr" }),
  "engine.vacuum_switching_valve": Object.freeze({ label: "Alipaineen vaihtoventtiili / VSV", pnc: "25860", oe: "25860-0R010", groupId: "air-intake-turbo-egr" }),
  "engine.air_cleaner_hose": Object.freeze({ label: "Ilmanputsarin / MAF:n jälkeinen imuletku", pnc: "17881/17881A/17882A", oe: "17880-26010; 96111-10850; 96111-10710", groupId: "air-intake-turbo-egr" }),
  "engine.exhaust_gas_temperature_sensor_1": Object.freeze({ label: "Pakokaasun lämpötila-anturi 1", pnc: "89425", oe: "89425-53010", groupId: "dpnr-exhaust" }),
  "engine.exhaust_gas_temperature_sensor_2": Object.freeze({ label: "Pakokaasun lämpötila-anturi 2", pnc: "89425A", oe: "89425-53020", groupId: "dpnr-exhaust" }),
  "engine.exhaust_fuel_addition_injector": Object.freeze({ label: "DPNR:n lisäpolttoainesuutin / 5th injector", pnc: "23710B", oe: "23710-26011", groupId: "dpnr-exhaust" })
});

const STATE_LABELS = Object.freeze({ physical: "FYYSINEN", "key-on": "KOEO", running: "KÄYNTI", acceleration: "KIIHDYTYS", "cold-start": "KYLMÄ", regeneration: "REGEN-KONTEKSTI" });

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

const rawPoints = [
  {
    id: "turbo-preconditions",
    componentId: "engine.turbocharger",
    label: "Turbon esiehdot ennen turbotuomiota",
    kind: "physical",
    operatingStates: ["physical"],
    signalKeys: ["engine.map", "engine.maf", "engine.dpnr_differential_pressure"],
    sourceRows: [25, 416],
    instruction: "Tarkista ilmansuodatin, imu- ja ahtoputket, välijäähdytin, alipaineohjaus, pakopuolen vastapaine, öljyn syöttö/paluu, siivet ja akselivälys ennen turbon vaihtopäätelmää.",
    expectedPattern: "Turbo on lähderivien mukaan usein seurausvika; imu-, boost-, alipaine-, DPNR- ja öljykierto pitää erottaa ensin.",
    limitation: "Boost target/VNT command ei ole vielä varmennettuna Flex-signaalina, joten actual-MAP ei yksin erota ohjaus- ja mekaanista turbrovikaa.",
    physicalFollowUp: "Tarkista actuator/VNT-liike ja alipaine käsipumpulla sekä ahtoputkien ja intercoolerin tiiveys."
  },
  {
    id: "turbo-airflow-pressure-response",
    componentId: "engine.turbocharger",
    label: "Turbon ilmavirta- ja painevaste",
    kind: "cross-check",
    operatingStates: ["running", "acceleration"],
    signalKeys: ["engine.map", "engine.maf", "engine.barometric_pressure", "engine.egr_position_toyota", "engine.dpnr_differential_pressure", "engine.rpm"],
    sourceRows: [25, 416],
    instruction: "Tallenna MAP/boost, MAF, BARO, EGR, DPNR-paine-ero ja RPM samassa kuormituksessa ja arvioi, sopiiko hidas/poikkeava boost-vastaus muuhun ilmavirta- ja vastapainedataan.",
    expectedPattern: "Poikkeaman muoto useassa signaalissa auttaa erottamaan ahtovuodon, alipaineohjauksen, pakovastapaineen ja turbon toisistaan ilman yhden arvon perusteella tehtyä tuomiota.",
    limitation: "Target boost puuttuu nykyisestä varmennetusta datapolusta.",
    physicalFollowUp: "Jos MAP jää epäloogiseksi suhteessa MAFiin ja kuormaan, tee paine-/savutesti ja alipaineohjauksen tarkastus."
  },
  {
    id: "intercooler-leak-baseline",
    componentId: "engine.intercooler",
    label: "Välijäähdyttimen vuotoperusta",
    kind: "physical",
    operatingStates: ["physical"],
    signalKeys: ["engine.map", "engine.maf"],
    sourceRows: [21],
    instruction: "Tee paine- tai savukoe imupuolelle ja tarkista intercoolerin päädyt, kenno, letkuliitokset sekä öljyiset pölyjäljet.",
    expectedPattern: "Ahtovuoto voi lähderivin mukaan matkia turbo-, EGR- tai MAF-vikaa.",
    limitation: "OBD/Flex kertoo vuodon seurauksia, ei vuotokohtaa.",
    physicalFollowUp: "Paikanna vuoto fyysisellä paine-/savutestillä ennen komponenttivaihtoa."
  },
  {
    id: "intercooler-load-response",
    componentId: "engine.intercooler",
    label: "Intercoolerin kuormitusvaste",
    kind: "cross-check",
    operatingStates: ["acceleration"],
    signalKeys: ["engine.map", "engine.maf", "engine.barometric_pressure", "engine.rpm"],
    sourceRows: [21],
    instruction: "Tarkastele MAP:n nousua suhteessa MAFiin, BAROon ja RPM:ään kuormalla; hidas painevaste yhdessä vuotojälkien kanssa tukee ahtovuodon jatkotutkimusta.",
    expectedPattern: "Yksi MAP-arvo ei osoita intercooleria, vaan kuormavaste yhdistetään fyysiseen vuototestiin.",
    limitation: "Boost target ei ole nykyisessä varmennetussa signaalijoukossa.",
    physicalFollowUp: "Jos vaste epäilyttää, paineista koko ahtoputkisto ja tarkista intercoolerin saumat/päädyt."
  },
  {
    id: "intake-manifold-carbon-baseline",
    componentId: "engine.intake_manifold",
    label: "Imusarjan karsta- ja virtausperusta",
    kind: "physical",
    operatingStates: ["physical"],
    signalKeys: ["engine.maf", "engine.map", "engine.egr_position_toyota"],
    sourceRows: [22, 353, 407],
    instruction: "Tarkista EGR-liittymän kautta karstan paksuus ja tarvittaessa imusarjan kanavat, imuportit sekä tiivistevuodot. Puhdas EGR-venttiili ei poissulje imusarjan tukosta.",
    expectedPattern: "Karstoittuminen voi lähderivien mukaan heikentää alakierrosvääntöä ja muuttaa EGR/MAF/MAP-järjestelmävastetta ilman suoraa karstamittaria.",
    limitation: "OBD ei mittaa karstan määrää suoraan.",
    physicalFollowUp: "Jos EGR-aukon näkyvä osuus on selvästi kaventunut, tarkastus jatkuu imusarjan/imuporttien fyysiseen arvioon."
  },
  {
    id: "intake-manifold-airflow-crosscheck",
    componentId: "engine.intake_manifold",
    label: "Imusarjan MAF–MAP–EGR-ristivertailu",
    kind: "cross-check",
    operatingStates: ["running", "acceleration"],
    signalKeys: ["engine.maf", "engine.map", "engine.egr_position_toyota", "engine.rpm"],
    sourceRows: [22, 407],
    instruction: "Vertaa MAF-, MAP- ja EGR-vastetta ennen ja jälkeen fyysisen puhdistuksen tai oirehetkellä, mutta käytä dataa vain karstahypoteesin tukena.",
    expectedPattern: "EGR:n muutoksen pitäisi näkyä ilmavirran kokonaisuudessa; ristiriita voi tulla karstasta, vuodosta tai EGR-ohjauksesta eikä nimeä imusarjaa yksinään.",
    limitation: "Injection feedback -vertailu, jonka lähde mainitsee, ei ole nykyisessä varmennetussa Flex-datapolussa.",
    physicalFollowUp: "Varmista karstan määrä ja tiivisteet fyysisesti."
  },
  {
    id: "vacuum-regulator-baseline",
    componentId: "engine.vacuum_regulating_valve",
    label: "E-VRV:n alipaine- ja sähköperusta",
    kind: "physical",
    operatingStates: ["physical"],
    signalKeys: ["engine.map", "engine.egr_position_toyota"],
    sourceRows: [29, 455],
    instruction: "Mittaa venttiilin sähköpiiri manuaalin mukaan ja alipaine sisään/ulos; tarkista vuodottomuus ja vaste ohjauksen muutokseen käsipumpulla/mittarilla.",
    expectedPattern: "Sähköisesti ehjä kela ei lähderivien mukaan todista, että venttiili säätelee alipainetta oikein.",
    limitation: "VNT/boost-control command ei ole vielä varmennettu Flex-signaali.",
    physicalFollowUp: "Varmista letkureititys ja venttiilin todellinen käyttökohde ennen nimeämistä turbo- tai EGR-ohjaukseksi."
  },
  {
    id: "vacuum-regulator-system-response",
    componentId: "engine.vacuum_regulating_valve",
    label: "E-VRV:n järjestelmävaste",
    kind: "cross-check",
    operatingStates: ["running", "acceleration"],
    signalKeys: ["engine.map", "engine.maf", "engine.egr_position_toyota", "engine.rpm"],
    sourceRows: [29, 455],
    instruction: "Tarkastele boost/MAP- ja EGR-järjestelmävastetta kuormalla yhdessä fyysisen alipainemittauksen kanssa.",
    expectedPattern: "Jos sähköinen ohjaus muuttuu mutta alipaine tai boost ei seuraa, lähde ohjaa venttiili-/letku-/turbohaaraan; Flex ei vielä mittaa ohjauskäskyä suoraan.",
    limitation: "Ilman varmennettua command/duty-signaalia OBD-seuraus ei yksin tuomitse venttiiliä.",
    physicalFollowUp: "Mittaa alipaine todellisesti venttiilin molemmin puolin oirehetkeä vastaavassa tilanteessa."
  },
  {
    id: "vacuum-switch-baseline",
    componentId: "engine.vacuum_switching_valve",
    label: "VSV:n vaihto- ja vuototesti",
    kind: "physical",
    operatingStates: ["physical"],
    signalKeys: ["engine.map", "engine.egr_position_toyota"],
    sourceRows: [30, 456],
    instruction: "Tarkista kelan sähköpiiri, porttien alipainepolku, suodatin/letkut ja että venttiili vaihtaa alipaineen oikeaan porttiin eikä vuoda.",
    expectedPattern: "VSV:tä ei vaihdeta ennen letkujen ja alipaineen mittausta; tarkka EGR cooler/turbo-funktio pitää varmistaa letkukaaviosta.",
    limitation: "Tarkka ECBV/VSV-toiminto ja command-signaali eivät ole vielä varmennettuina Flexissä.",
    physicalFollowUp: "Käytä käsialipainepumppua ja varmista letkureititys."
  },
  {
    id: "vacuum-switch-system-response",
    componentId: "engine.vacuum_switching_valve",
    label: "VSV:n vaikutus boost/EGR-järjestelmään",
    kind: "cross-check",
    operatingStates: ["running"],
    signalKeys: ["engine.map", "engine.maf", "engine.egr_position_toyota", "engine.egt_inlet", "engine.egt_outlet"],
    sourceRows: [30, 456],
    instruction: "Vertaa fyysisen VSV/alipainehavainnon kanssa MAP-, MAF-, EGR- ja tarvittaessa EGT-käyttäytymistä.",
    expectedPattern: "Järjestelmävaste voi tukea alipaineohjauksen epäilyä, mutta ei määritä venttiilin tarkkaa funktiota ilman letkukaaviota/ohjaussignaalia.",
    limitation: "Active Test tai EGR cooler bypass command ei kuulu nykyiseen read-only Flex-polkuun.",
    physicalFollowUp: "Varmista porttien toiminta fyysisesti ennen osapäätelmää."
  },
  {
    id: "air-cleaner-hose-baseline",
    componentId: "engine.air_cleaner_hose",
    label: "MAF:n jälkeisen imuletkun 360° vuototarkastus",
    kind: "physical",
    operatingStates: ["physical"],
    signalKeys: ["engine.maf", "engine.map"],
    sourceRows: [20, 559, 560, 561],
    instruction: "Taivuta letku kauttaaltaan ja tarkista alapinta, hiushalkeamat, kaulukset, klemmarit, liukumisjäljet sekä öljy-/pölyjäljet. Tee tarvittaessa savutesti.",
    expectedPattern: "Halpa imu-/liitosvika voi lähderivien mukaan aiheuttaa saman oireen kuin MAF- tai turbo-ongelma.",
    limitation: "MAF/MAP näyttää vain mahdollisen seurauksen, ei letkun vuotokohtaa.",
    physicalFollowUp: "Korjaa löysä/väsynyt kiristin tai haljennut letku ennen anturi-/turbo-osien vaihtoa."
  },
  {
    id: "air-cleaner-hose-airflow-response",
    componentId: "engine.air_cleaner_hose",
    label: "Imuletkun MAF–MAP-kuormavaste",
    kind: "cross-check",
    operatingStates: ["acceleration"],
    signalKeys: ["engine.maf", "engine.map", "engine.rpm"],
    sourceRows: [20, 559],
    instruction: "Tarkastele MAF/MAP/RPM-käyttäytymistä kuormalla yhdessä fyysisen letku- ja liitostarkastuksen kanssa.",
    expectedPattern: "Epälooginen ilmamassa tai hidas painevaste tukee vuototestin tarvetta mutta ei yksin nimeä letkua.",
    limitation: "Vuodon paikannus on fyysinen savutesti/tiiveystarkastus.",
    physicalFollowUp: "Tarkista erityisesti MAF:n jälkeiset liitokset ja letkun alapinta."
  },
  {
    id: "egt1-plausibility",
    componentId: "engine.exhaust_gas_temperature_sensor_1",
    label: "EGT1 kylmä- ja kuormaususkottavuus",
    kind: "dynamic",
    operatingStates: ["cold-start", "running", "acceleration"],
    signalKeys: ["engine.egt_inlet", "engine.egt_outlet", "engine.dpnr_differential_pressure"],
    sourceRows: [6, 331, 347, 469],
    instruction: "Tarkista EGT1 kylmänä suhteessa ympäristöön/EGT2:een ja seuraa loogista nousua kuormalla yhdessä DPNR-paine-eron kanssa.",
    expectedPattern: "Yksittäinen EGT1-arvo pitää lähderivien mukaan verrata EGT2:een ja ajotilanteeseen.",
    limitation: "Mallikohtaisia vastus- tai vikakynnyksiä ei ole näissä lähderiveissä; niitä ei keksitä Flexiin.",
    physicalFollowUp: "Tarkista liitin, johdon lämpösuoja, anturin kiinnitys ja pakovuodot."
  },
  {
    id: "egt2-plausibility",
    componentId: "engine.exhaust_gas_temperature_sensor_2",
    label: "EGT2 kylmä- ja kuormaususkottavuus",
    kind: "dynamic",
    operatingStates: ["cold-start", "running", "acceleration"],
    signalKeys: ["engine.egt_outlet", "engine.egt_inlet", "engine.dpnr_differential_pressure"],
    sourceRows: [7, 331, 347, 469],
    instruction: "Tarkista EGT2 kylmänä suhteessa EGT1:een ja seuraa sen muutosta kuormalla/DPNR-tilanteessa.",
    expectedPattern: "EGT1/EGT2-parin tulee muuttua ajotilanteeseen nähden loogisesti; yhtä anturia ei tulkita ilman parivertailua.",
    limitation: "Mallikohtaisia kiinteitä lämpötilaero- tai vastusrajoja ei ole lähderiveissä.",
    physicalFollowUp: "Tarkista liitin, lämpövaurio, anturin kiinnitys ja pakovuodot."
  },
  {
    id: "fifth-injector-physical-baseline",
    componentId: "engine.exhaust_fuel_addition_injector",
    label: "5th injector -vuoto, karsta ja liitin",
    kind: "physical",
    operatingStates: ["physical"],
    signalKeys: ["engine.dpnr_differential_pressure", "engine.egt_inlet", "engine.egt_outlet"],
    sourceRows: [9, 139, 280, 333],
    instruction: "Tarkista lisäsuuttimen kärjen karsta, polttoainelinja, liitin, pakopuolen tiiveys ja ettei suutin vuoda silloin kun sitä ei pitäisi käyttää. Erottele tämä moottorin pääsuuttimista.",
    expectedPattern: "Valkoinen/harmaa savu, palamattoman dieselin haju ja regenerointiongelma voivat lähderivien mukaan liittyä lisäsuuttimeen, mutta sama oire vaatii EGT- ja paine-erokontekstin.",
    limitation: "5th injector command/active test ei ole nykyisessä read-only Flex-signaalijoukossa.",
    physicalFollowUp: "Varmista ensin myös DPNR-paineletkut ja EGT-anturit ennen lisäsuutinpäätelmää."
  },
  {
    id: "fifth-injector-exhaust-response",
    componentId: "engine.exhaust_fuel_addition_injector",
    label: "5th injector -oireen EGT/DPNR-konteksti",
    kind: "cross-check",
    operatingStates: ["running", "regeneration"],
    signalKeys: ["engine.egt_inlet", "engine.egt_outlet", "engine.dpnr_differential_pressure", "engine.rail_pressure_obd"],
    sourceRows: [9, 139, 280, 333, 347],
    instruction: "Kirjaa savu/haju ja tarkastele samaan aikaan EGT1/EGT2-, DPNR-paine-ero- ja rail-painedataa. Käytä yhdistelmää jatkotutkimuksen priorisointiin, ei aktiivisen regen-komennon korvikkeena.",
    expectedPattern: "Pakopuolen lisäpolttoaineoire arvioidaan lämpöjen, paine-eron ja havaittavan savun/hajun kokonaisuutena; pelkkä EGT-nousu tai paine-ero ei nimeä suutinta.",
    limitation: "Regen status/command ja 5th injector command odottavat erillistä varmennettua read-only-datapolkua; Flex ei pakota regenerointia.",
    physicalFollowUp: "Jos oireketju sopii, tarkista suutin fyysisesti sekä sen polttoaine- ja sähköliitännät."
  }
];

function validatePoint(point, ids) {
  if (!point?.id || !/^[a-z0-9-]+$/.test(point.id)) throw new Error(`Invalid air/exhaust inspection point id: ${point?.id}`);
  if (ids.has(point.id)) throw new Error(`Duplicate air/exhaust inspection point id: ${point.id}`);
  ids.add(point.id);
  if (!COMPONENTS[point.componentId]) throw new Error(`Unknown air/exhaust component: ${point.componentId}`);
  if (!Array.isArray(point.sourceRows) || !point.sourceRows.length || point.sourceRows.some(row => !Number.isInteger(row) || row < 2)) throw new Error(`Air/exhaust point ${point.id} has invalid source rows`);
  for (const signalKey of point.signalKeys || []) {
    const signal = getIs220dDiagnosticSignal(signalKey);
    if (!signal) throw new Error(`Unknown air/exhaust signal ${signalKey} in ${point.id}`);
    if (signal.authorization === "field-rejected") throw new Error(`Field-rejected signal cannot enter air/exhaust point ${point.id}`);
  }
}

const ids = new Set();
for (const point of rawPoints) validatePoint(point, ids);

export const IS220D_AIR_EXHAUST_INSPECTION_POINTS = deepFreeze(rawPoints.map(point => ({ ...point, groupId: COMPONENTS[point.componentId].groupId, sourceSheet: "Vikadiag_kohteet", source: IS220D_AIR_EXHAUST_INSPECTION_SOURCE })));

function hydrateSignal(key) {
  const signal = getIs220dDiagnosticSignal(key);
  return deepFreeze({ key: signal.key, label: signal.label, evidence: signal.evidence, authorization: signal.authorization, productionAuthorized: signal.productionAuthorized === true, collectedByWideDiagnostic: signal.collectedByWideDiagnostic === true });
}
function hydratePoint(point) {
  const component = COMPONENTS[point.componentId];
  const signals = point.signalKeys.map(hydrateSignal);
  return deepFreeze({ ...point, componentLabel: component.label, pnc: component.pnc, oe: component.oe, states: point.operatingStates.map(state => ({ state, label: STATE_LABELS[state] || state })), signals, evidenceSummary: { signalCount: signals.length, currentWideDiagnostic: signals.filter(signal => signal.productionAuthorized && signal.collectedByWideDiagnostic).length, awaitingVerification: signals.filter(signal => !signal.productionAuthorized).length } });
}

export function buildIs220dAirExhaustInspectionScope(groupId = "all") {
  const normalized = String(groupId || "all");
  const valid = ["all", "air-intake-turbo-egr", "dpnr-exhaust"].includes(normalized);
  if (!valid) return deepFreeze({ schemaVersion: IS220D_AIR_EXHAUST_INSPECTION_SCHEMA_VERSION, groupId: normalized, visible: false, pointCount: 0, componentCount: 0, points: [] });
  const points = IS220D_AIR_EXHAUST_INSPECTION_POINTS.map(hydratePoint).filter(point => normalized === "all" || point.groupId === normalized);
  return deepFreeze({ schemaVersion: IS220D_AIR_EXHAUST_INSPECTION_SCHEMA_VERSION, source: IS220D_AIR_EXHAUST_INSPECTION_SOURCE, groupId: normalized, visible: points.length > 0, pointCount: points.length, componentCount: new Set(points.map(point => point.componentId)).size, points });
}

function kindLabel(kind) { return ({ physical: "FYYSINEN", dynamic: "VASTE", "cross-check": "RISTIVERTAILU" })[kind] || String(kind || "").toUpperCase(); }
export function buildIs220dAirExhaustInspectionScopeHtml(scope) {
  if (!scope?.visible) return "";
  return `<div class="bom-ae-point-summary"><strong>Ilma / turbo / alipaine / DPNR-lisäkohteet</strong><span>${scope.pointCount} tarkastuspistettä · ${scope.componentCount} komponenttia</span></div>${scope.points.map(point => `<article class="bom-ae-point-card" data-bom-ae-point="${escapeHtml(point.id)}"><div class="bom-ae-point-head"><div><span>${escapeHtml(kindLabel(point.kind))}</span><strong>${escapeHtml(point.label)}</strong></div><small>${escapeHtml(point.states.map(state => state.label).join(" · "))}</small></div><div class="bom-ae-point-component">${escapeHtml(point.componentLabel)} · PNC ${escapeHtml(point.pnc)} · OE ${escapeHtml(point.oe)}</div><p>${escapeHtml(point.instruction)}</p><div class="bom-ae-point-pattern"><strong>Odotettu kuvio</strong><span>${escapeHtml(point.expectedPattern)}</span></div><div class="bom-ae-point-limit"><strong>Raja</strong><span>${escapeHtml(point.limitation)}</span></div><details><summary>Jatkotoimi ja lähde</summary><div>${escapeHtml(point.physicalFollowUp)}</div><div>Evidenssi nykytestissä ${point.evidenceSummary.currentWideDiagnostic}/${point.evidenceSummary.signalCount}</div><div class="bom-ae-point-source">${escapeHtml(point.sourceSheet)} · rivit ${escapeHtml(point.sourceRows.join(", "))}</div></details></article>`).join("")}`;
}

function ensureStyles() {
  if (typeof document === "undefined" || document.querySelector("#bom-ae-inspection-styles")) return;
  const style = document.createElement("style");
  style.id = "bom-ae-inspection-styles";
  style.textContent = `.bom-ae-inspection{margin-top:10px}.bom-ae-point-summary{display:flex;justify-content:space-between;gap:10px;align-items:flex-end;margin-bottom:7px;padding-top:9px;border-top:1px solid var(--line-soft)}.bom-ae-point-summary strong{font-size:10px}.bom-ae-point-summary span{color:var(--muted);font-size:8px;text-align:right}.bom-ae-point-card{margin-top:7px;padding:9px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}.bom-ae-point-head{display:flex;justify-content:space-between;gap:8px}.bom-ae-point-head>div{display:flex;flex-direction:column;gap:3px}.bom-ae-point-head span{color:var(--info);font-size:7px;font-weight:800}.bom-ae-point-head strong{font-size:10px}.bom-ae-point-head small{max-width:46%;color:var(--muted);font-size:7px;text-align:right}.bom-ae-point-component{margin-top:5px;color:var(--muted);font-size:8px}.bom-ae-point-card p{margin:7px 0 0;font-size:9px;line-height:1.45}.bom-ae-point-pattern,.bom-ae-point-limit{display:flex;flex-direction:column;gap:3px;margin-top:7px;padding:7px;border-radius:8px;background:var(--surface-inset)}.bom-ae-point-pattern strong,.bom-ae-point-limit strong{color:var(--muted);font-size:7px;text-transform:uppercase}.bom-ae-point-pattern span,.bom-ae-point-limit span{font-size:8px;line-height:1.4}.bom-ae-point-limit{border:1px solid var(--warning-border)}.bom-ae-point-card details{margin-top:7px;color:var(--muted);font-size:8px;line-height:1.4}.bom-ae-point-card summary{color:var(--info);cursor:pointer;font-weight:800}.bom-ae-point-source{margin-top:5px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}`;
  document.head.append(style);
}
function selectedGroupId() { return String(document.querySelector("#bomDiagnosticRunGroup")?.value || "all"); }
function render() {
  if (typeof document === "undefined") return null;
  const target = document.querySelector("#bomAirExhaustInspectionPoints");
  if (!target) return null;
  const scope = buildIs220dAirExhaustInspectionScope(selectedGroupId());
  target.innerHTML = buildIs220dAirExhaustInspectionScopeHtml(scope);
  target.classList.toggle("hidden", !scope.visible);
  return scope;
}
function ensurePanel() {
  if (typeof document === "undefined") return null;
  const existing = document.querySelector("#bomAirExhaustInspectionPoints");
  if (existing) return existing;
  const guided = document.querySelector("#bomGuidedSession");
  if (!guided) return null;
  ensureStyles();
  const panel = document.createElement("div");
  panel.id = "bomAirExhaustInspectionPoints";
  panel.className = "bom-ae-inspection";
  guided.append(panel);
  document.querySelector("#bomDiagnosticRunGroup")?.addEventListener("change", render);
  render();
  return panel;
}
export function publishIs220dAirExhaustInspectionPoints() {
  ensurePanel();
  return typeof document === "undefined" ? buildIs220dAirExhaustInspectionScope("all") : render();
}
ensurePanel();
