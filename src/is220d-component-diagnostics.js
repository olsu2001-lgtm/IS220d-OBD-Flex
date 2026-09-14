import {
  commandsForIs220dDiagnosticSignal,
  getIs220dDiagnosticSignal
} from "./is220d-diagnostic-signals.js";
import { assessIs220dComponentEvidence } from "./is220d-component-assessment.js";

/**
 * BOM-derived component diagnostics for Lexus IS220d / 2AD-FHV.
 *
 * This layer is read-only and transport-free: it maps diagnostic results that
 * Flex already collected to BOM components. Physical-only inspection items are
 * intentionally excluded.
 */

export const IS220D_COMPONENT_DIAGNOSTIC_SCHEMA_VERSION = 2;
export const IS220D_COMPONENT_DIAGNOSTIC_SOURCE = "Bom-kaapija / reviewed offline snapshot";
export const IS220D_COMPONENT_DIAGNOSTIC_POLICY = "direct-indirect-only";

const ENGINE_REQUEST_HEADERS = new Set(["", "7DF", "7E0"]);
const VALID_CLASSES = new Set(["direct", "indirect"]);
const normalizeHex = value => String(value || "").replace(/\s+/g, "").toUpperCase();

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function component(definition) {
  if (!VALID_CLASSES.has(definition.diagnosticClass)) throw new Error(`Unsupported diagnostic class: ${definition.diagnosticClass}`);
  for (const group of definition.signalGroups || []) {
    for (const signalKey of group) {
      const signal = getIs220dDiagnosticSignal(signalKey);
      if (!signal) throw new Error(`Unknown diagnostic signal ${signalKey} in ${definition.id}`);
      if (signal.authorization === "field-rejected") throw new Error(`Field-rejected signal ${signalKey} cannot be recipe evidence for ${definition.id}`);
    }
  }
  return definition;
}

/**
 * signalGroups contain named evidence signals. A group is observed if any
 * signal in it produced a valid response. minimumGroups controls how many
 * independent groups are needed before the component has useful coverage.
 * Signal definitions resolve to existing command identities only after data
 * has already been collected; this module never transmits a command.
 */
export const IS220D_COMPONENT_DIAGNOSTICS = deepFreeze([
  component({ id: "engine.maf_sensor", diagnosticClass: "direct", pnc: "22204", oe: "22204-30010", label: "MAF / ilmamäärämittari", symptom: "Tehonpuute, savutus, kulutuksen nousu tai MAF/P010x-poikkeama.", bomSource: "BOM rivit 941-942", signalGroups: [["engine.maf"]] }),
  component({ id: "engine.map_sensor", diagnosticClass: "direct", pnc: "89421C", oe: "89421-20200", label: "Ahtopaineanturi / MAP turbo pressure", symptom: "Virheellinen ahtopaine, tehonpuute tai epälooginen MAP/boost-kuormavaste.", bomSource: "BOM rivit 6970-6971", signalGroups: [["engine.map"]] }),
  component({ id: "engine.coolant_temperature_sensor", diagnosticClass: "direct", pnc: "89422C", oe: "89422-33030", label: "Moottorin jäähdytysnesteen lämpötila-anturi", symptom: "Virheellinen lämpenemistieto, korkea lämmin tyhjäkäynti, regen-estot tai ECT-poikkeama.", bomSource: "BOM rivit 6972-6973", signalGroups: [["engine.coolant_temperature"]] }),
  component({ id: "engine.egr_valve", diagnosticClass: "direct", pnc: "25620", oe: "25620-26101", label: "EGR-venttiili", symptom: "Nykiminen, tehonpuute, musta savu/noki tai EGR/DPF-poikkeama.", bomSource: "BOM rivi 1297", signalGroups: [["engine.egr_position_toyota", "engine.egr_commanded_obd", "engine.egr_position_obd"]] }),
  component({ id: "engine.dpnr_differential_pressure_sensor", diagnosticClass: "direct", pnc: "89480A", oe: "89480-53010", label: "DPF/DPNR paine-eroanturi", symptom: "DPF-oire, epäonnistuvat regeneroinnit, limp mode tai epäuskottava paine-ero.", bomSource: "BOM rivit 6939-6940", signalGroups: [["engine.dpnr_differential_pressure"]] }),
  component({ id: "engine.exhaust_gas_temperature_sensor_1", diagnosticClass: "direct", pnc: "89425", oe: "89425-53010", label: "Pakokaasun lämpötila-anturi 1", symptom: "Epäuskottava EGT-data tai regeneroinnin häiriö.", bomSource: "BOM rivit 6931-6932", signalGroups: [["engine.egt_inlet"]] }),
  component({ id: "engine.exhaust_gas_temperature_sensor_2", diagnosticClass: "direct", pnc: "89425A", oe: "89425-53020", label: "Pakokaasun lämpötila-anturi 2", symptom: "Epäuskottava EGT-data tai regeneroinnin häiriö.", bomSource: "BOM rivit 6933-6934", signalGroups: [["engine.egt_outlet"]] }),
  component({ id: "engine.fuel_temperature_sensor", diagnosticClass: "direct", pnc: "89454", oe: "89454-20010", label: "Polttoaineen lämpötila-anturi", symptom: "Epärealistinen polttoainelämpö voi vääristää rail-paineen ja ruiskutusmäärän tulkintaa.", bomSource: "BOM rivit 6976-6977", signalGroups: [["engine.fuel_temperature_screening"]] }),
  component({ id: "engine.common_rail_pressure_sensor", diagnosticClass: "direct", pnc: "Pc Sensor / 23810A", oe: "89458-60010", label: "Common rail -paineanturi", symptom: "Rail-paineen epäuskottavuus, hidas paineennousu tai target/actual-ristiriita.", bomSource: "BOM rail assy rivi 1211 + DENSO IS220d bulletin", signalGroups: [["engine.rail_pressure_obd", "engine.rail_pressure_screening"]] }),

  component({ id: "engine.main_injectors", diagnosticClass: "indirect", pnc: "23670", oe: "23670-29105", label: "Common rail -pääsuuttimet", symptom: "Epätasainen käynti, palamattoman dieselin haju, savu, nakutus tai kulutuksen nousu.", bomSource: "BOM rivit 1104-1105", signalGroups: [["engine.rail_pressure_obd", "engine.rail_pressure_screening"], ["engine.injection_timing_obd", "engine.injection_timing_screening"], ["engine.rpm"], ["engine.fuel_temperature_screening"]], minimumGroups: 2, excludedSignals: ["219C"], excludedSignalKeys: ["engine.injection_feedback_rejected"], note: "219C on Flex 0.8.1:ssa kenttäevidenssin perusteella estetty eikä koskaan nosta suutinten kattavuutta." }),
  component({ id: "engine.exhaust_fuel_addition_injector", diagnosticClass: "indirect", pnc: "23710B", oe: "23710-26011", label: "DPF/DPNR lisäpolttoainesuutin", symptom: "Regenerointi ei onnistu, savu/regenerointipoikkeama tai korkea DPF-paine-ero.", bomSource: "BOM rivit 1114-1115", signalGroups: [["engine.dpnr_differential_pressure"], ["engine.egt_inlet", "engine.egt_outlet"], ["engine.rail_pressure_obd", "engine.rail_pressure_screening"]], minimumGroups: 2 }),
  component({ id: "engine.scv", diagnosticClass: "indirect", pnc: "04226", oe: "04226-0L040", label: "SCV / imuohjausventtiili", symptom: "Rail pressure putoaa kuormalla, nykiminen, limp mode tai sammuminen.", bomSource: "BOM rivit 1131-1132", signalGroups: [["engine.rail_pressure_obd", "engine.rail_pressure_screening"], ["engine.rpm"], ["engine.fuel_temperature_screening"]], minimumGroups: 2 }),
  component({ id: "engine.fuel_filter", diagnosticClass: "indirect", pnc: "23300/23303", oe: "23300-26100; 23390-0L010", label: "Polttoainesuodatin / elementti", symptom: "Pitkä startti, tehonpuute kuormalla, nykiminen, sammuminen tai matala rail-paine.", bomSource: "BOM rivit 1256-1259", signalGroups: [["engine.rail_pressure_obd", "engine.rail_pressure_screening"], ["engine.rpm"]], minimumGroups: 2 }),
  component({ id: "engine.injection_pump", diagnosticClass: "indirect", pnc: "22100", oe: "22100-0R031", label: "Common rail -korkeapainepumppu", symptom: "Rail-paine ei nouse startissa tai putoaa kuormalla, tehon katoaminen tai sammuminen.", bomSource: "BOM rivit 1139-1140", signalGroups: [["engine.rail_pressure_obd", "engine.rail_pressure_screening"], ["engine.rpm"], ["engine.fuel_temperature_screening"]], minimumGroups: 2 }),
  component({ id: "engine.turbocharger", diagnosticClass: "indirect", pnc: "17201", oe: "17201-26011", label: "Turboahdin", symptom: "Hidas ahtopaineen nousu, yli-/aliahto, tehonpuute, limp mode tai savu.", bomSource: "BOM rivit 828-829", signalGroups: [["engine.map"], ["engine.maf"], ["engine.barometric_pressure"], ["engine.egr_position_toyota", "engine.egr_commanded_obd", "engine.egr_position_obd"]], minimumGroups: 3 }),
  component({ id: "engine.intercooler", diagnosticClass: "indirect", pnc: "17940D", oe: "17940-26010", label: "Välijäähdytin", symptom: "Ahtovuoto, tehonpuute, sihinä, musta savu tai toteutuneen ahtopaineen jääminen matalaksi.", bomSource: "BOM rivit 939-940", signalGroups: [["engine.map"], ["engine.maf"], ["engine.barometric_pressure"]], minimumGroups: 2 }),
  component({ id: "engine.intake_manifold", diagnosticClass: "indirect", pnc: "17111", oe: "17101-26110", label: "Imusarja", symptom: "Karstoittuminen, alakierrosväännön heikkeneminen, savutus tai kulutuksen nousu.", bomSource: "BOM rivit 806-807", signalGroups: [["engine.maf"], ["engine.map"], ["engine.egr_position_toyota", "engine.egr_commanded_obd", "engine.egr_position_obd"]], minimumGroups: 2 }),
  component({ id: "engine.vacuum_regulating_valve", diagnosticClass: "indirect", pnc: "25819", oe: "25819-0R011", label: "Alipaineen säätöventtiili", symptom: "Turbon/EGR:n hidas tai väärä liike, tehonpuute, yli-/aliahto tai nykäisy.", bomSource: "BOM rivit 988-989", signalGroups: [["engine.map"], ["engine.egr_position_toyota", "engine.egr_commanded_obd", "engine.egr_position_obd"], ["engine.maf"]], minimumGroups: 2 }),
  component({ id: "engine.vacuum_switching_valve", diagnosticClass: "indirect", pnc: "25860", oe: "25860-0R010", label: "Alipaineen vaihtoventtiili / VSV", symptom: "Turbo/EGR-asento väärä, tehonpuute tai satunnainen nykäisy.", bomSource: "BOM rivit 990-991", signalGroups: [["engine.map"], ["engine.egr_position_toyota", "engine.egr_commanded_obd", "engine.egr_position_obd"], ["engine.maf"]], minimumGroups: 2 }),
  component({ id: "engine.air_cleaner_hose", diagnosticClass: "indirect", pnc: "17881/17881A/17882A", oe: "17880-26010; 96111-10850; 96111-10710", label: "Ilmaputki ja kiristimet MAFin/turbon imupuolella", symptom: "Imuvuoto, MAF-poikkeama, tehonpuute, savutus tai hidas ahtopaineen nousu.", bomSource: "BOM rivit 933-938", signalGroups: [["engine.maf"], ["engine.map"]], minimumGroups: 2 }),
  component({ id: "engine.alternator", diagnosticClass: "indirect", pnc: "27020", oe: "27060-26030", label: "Laturi", symptom: "Alijännite, akun tyhjeneminen tai latauksen katoaminen kuormalla.", bomSource: "BOM rivit 1035-1036", signalGroups: [["engine.ecu_voltage"]] }),
  component({ id: "engine.starter", diagnosticClass: "indirect", pnc: "28100", oe: "28100-0R010", label: "Starttimoottori", symptom: "Hidas pyöritys, satunnainen starttaamattomuus tai käynnistyksen liian matala kierrosluku.", bomSource: "BOM rivit 1067-1068", signalGroups: [["engine.rpm"], ["engine.ecu_voltage"]], minimumGroups: 2 }),
  component({ id: "engine.crank_position_sensor", diagnosticClass: "indirect", pnc: "11401G", oe: "90919-05069", label: "Kampiakselin asentotunnistin", symptom: "Käynnistymättömyys, sammuminen, nykiminen tai kierroslukusignaalin katkeaminen.", bomSource: "BOM rivit 133-134", signalGroups: [["engine.rpm"]], note: "RPM on epäsuora signaali; cam/crank-correlation ei ole vielä Flexissä ajoneuvovarmennettu oma lukuarvo." })
]);

function relevantResults(run) {
  return Array.isArray(run?.results) ? run.results.filter(result => ENGINE_REQUEST_HEADERS.has(normalizeHex(result?.requestHeader))) : [];
}

function commandState(results, command) {
  const normalized = normalizeHex(command);
  const matches = results.filter(result => normalizeHex(result?.command) === normalized);
  return Object.freeze({ command: normalized, attempted: matches.length > 0, observed: matches.some(result => result?.validResponse === true), attempts: matches.length });
}

function signalState(results, signalKey) {
  const definition = getIs220dDiagnosticSignal(signalKey);
  if (!definition) throw new Error(`Unknown IS220d diagnostic signal: ${signalKey}`);
  const commandStates = definition.commands.map(command => commandState(results, command));
  const observedState = commandStates.find(state => state.observed);
  const attemptedState = commandStates.find(state => state.attempted);
  return Object.freeze({
    signalKey,
    command: observedState?.command || attemptedState?.command || definition.commands[0],
    commands: definition.commands,
    attempted: commandStates.some(state => state.attempted),
    observed: commandStates.some(state => state.observed),
    attempts: commandStates.reduce((sum, state) => sum + state.attempts, 0),
    evidence: definition.evidence,
    authorization: definition.authorization,
    productionAuthorized: definition.productionAuthorized,
    commandStates: Object.freeze(commandStates)
  });
}

function evaluateComponent(definition, results) {
  const groupEvidence = definition.signalGroups.map(group => {
    const signals = group.map(signalKey => signalState(results, signalKey));
    const commands = [...new Set(group.flatMap(signalKey => commandsForIs220dDiagnosticSignal(signalKey)))];
    return Object.freeze({ signalKeys: Object.freeze([...group]), commands: Object.freeze(commands), observed: signals.some(signal => signal.observed), attempted: signals.some(signal => signal.attempted), signals: Object.freeze(signals) });
  });
  const requiredGroups = Math.max(1, Number(definition.minimumGroups || 1));
  const observedGroups = groupEvidence.filter(group => group.observed).length;
  const attemptedGroups = groupEvidence.filter(group => group.attempted).length;
  let status = "not-tested";
  if (observedGroups >= requiredGroups) status = "observed";
  else if (observedGroups > 0) status = "partial";
  else if (attemptedGroups > 0) status = "unavailable";
  const evidence = { ...definition, requiredGroups, observedGroups, attemptedGroups, status, groupEvidence };
  const assessment = assessIs220dComponentEvidence(evidence, results);
  return deepFreeze({ ...evidence, assessment });
}

export function buildIs220dComponentDiagnosticCoverage(run) {
  const vehicleKey = String(run?.meta?.vehicleKey || "is220d");
  if (vehicleKey !== "is220d") return deepFreeze({ schemaVersion: IS220D_COMPONENT_DIAGNOSTIC_SCHEMA_VERSION, vehicleKey, applicable: false, policy: IS220D_COMPONENT_DIAGNOSTIC_POLICY, source: IS220D_COMPONENT_DIAGNOSTIC_SOURCE, components: [], summary: { total: 0, direct: 0, indirect: 0, observed: 0, partial: 0, unavailable: 0, notTested: 0 } });

  const results = relevantResults(run);
  const components = IS220D_COMPONENT_DIAGNOSTICS.map(definition => evaluateComponent(definition, results));
  const count = status => components.filter(item => item.status === status).length;
  return deepFreeze({
    schemaVersion: IS220D_COMPONENT_DIAGNOSTIC_SCHEMA_VERSION,
    vehicleKey,
    applicable: true,
    policy: IS220D_COMPONENT_DIAGNOSTIC_POLICY,
    source: IS220D_COMPONENT_DIAGNOSTIC_SOURCE,
    components,
    summary: {
      total: components.length,
      direct: components.filter(item => item.diagnosticClass === "direct").length,
      indirect: components.filter(item => item.diagnosticClass === "indirect").length,
      observed: count("observed"), partial: count("partial"), unavailable: count("unavailable"), notTested: count("not-tested")
    }
  });
}

const clean = value => String(value ?? "").replace(/[\r\n\t]+/g, " ").trim();
const formatAssessmentValue = value => `${clean(value.signalKey)}=${Number(value.value).toFixed(Math.abs(Number(value.value)) >= 100 ? 0 : 2)}${value.unit ? ` ${clean(value.unit)}` : ""}`;

export function buildIs220dComponentDiagnosticTextReport(coverage) {
  if (!coverage?.applicable) return "";
  const summary = coverage.summary || {};
  const lines = [
    "BOM COMPONENT DIAGNOSTICS",
    `Schema: ${Number(coverage.schemaVersion || IS220D_COMPONENT_DIAGNOSTIC_SCHEMA_VERSION)}`,
    `Vehicle: ${clean(coverage.vehicleKey) || "is220d"}`,
    `Source: ${clean(coverage.source) || IS220D_COMPONENT_DIAGNOSTIC_SOURCE}`,
    "Policy: DIRECT / INDIRECT only; physical-only components excluded",
    `Coverage: ${Number(summary.observed || 0)} observed + ${Number(summary.partial || 0)} partial / ${Number(summary.total || 0)} components`,
    `Classes: DIRECT ${Number(summary.direct || 0)} · INDIRECT ${Number(summary.indirect || 0)}`,
    "Components:"
  ];

  for (const item of coverage.components || []) {
    const observedStates = item.groupEvidence.flatMap(group => group.signals).filter(signal => signal.observed);
    const attemptedStates = item.groupEvidence.flatMap(group => group.signals).filter(signal => signal.attempted && !signal.observed);
    const observedSignals = observedStates.map(signal => signal.command);
    const attemptedSignals = attemptedStates.map(signal => signal.command);
    const observedKeys = observedStates.map(signal => signal.signalKey);
    const assessmentValues = (item.assessment?.values || []).map(formatAssessmentValue);
    const suffix = [
      `class=${String(item.diagnosticClass || "").toUpperCase()}`,
      `status=${clean(item.status)}`,
      `assessment=${clean(item.assessment?.status || "not-evaluated")}`,
      `pnc=${clean(item.pnc) || "-"}`,
      `oe=${clean(item.oe) || "-"}`,
      `component=${clean(item.label)}`,
      `groups=${Number(item.observedGroups || 0)}/${Number(item.requiredGroups || 1)}`,
      `observed_signal_keys=${[...new Set(observedKeys)].join(",") || "-"}`,
      `observed_signals=${[...new Set(observedSignals)].join(",") || "-"}`,
      `assessment_values=${assessmentValues.join(",") || "-"}`,
      `attempted_no_positive=${[...new Set(attemptedSignals)].join(",") || "-"}`,
      `symptom=${clean(item.symptom)}`,
      `bom=${clean(item.bomSource)}`
    ];
    if (item.excludedSignals?.length) suffix.push(`excluded=${item.excludedSignals.join(",")}`);
    if (item.note) suffix.push(`note=${clean(item.note)}`);
    lines.push(`- ${suffix.join(" | ")}`);
  }

  lines.push(
    "Interpretation boundary:",
    "- coverage status and assessment status are separate; DATA SAATU is not a health verdict.",
    "- normal-pattern currently means only that a vehicle-verified DIRECT value decoded and stayed inside its structural plausibility range.",
    "- INDIRECT means correlation evidence only; the mapped signals do not identify one physical cause by themselves.",
    "- named signal definitions are evidence metadata, not a vehicle-command allowlist.",
    "- Flex 0.8.1 field-disabled 219C injector feedback never counts toward component coverage.",
    "- This layer derives only from diagnostic results already collected by Flex and sends no additional vehicle command."
  );
  return `${lines.join("\n")}\n`;
}
