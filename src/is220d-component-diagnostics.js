/**
 * BOM-derived component diagnostics for Lexus IS220d / 2AD-FHV.
 *
 * This layer is read-only and transport-free: it maps diagnostic results that
 * Flex already collected to BOM components. Physical-only inspection items are
 * intentionally excluded.
 */

export const IS220D_COMPONENT_DIAGNOSTIC_SCHEMA_VERSION = 1;
export const IS220D_COMPONENT_DIAGNOSTIC_SOURCE = "Bom-kaapija / Vikadiag_kohteet";
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
  return definition;
}

/**
 * signalGroups are alternative command groups. A group is observed if any
 * command in it produced a valid response. minimumGroups controls how many
 * independent groups are needed before the component has useful coverage.
 */
export const IS220D_COMPONENT_DIAGNOSTICS = deepFreeze([
  component({ id: "engine.maf_sensor", diagnosticClass: "direct", pnc: "22204", oe: "22204-30010", label: "MAF / ilmamäärämittari", symptom: "Tehonpuute, savutus, kulutuksen nousu tai MAF/P010x-poikkeama.", bomSource: "BOM rivit 941-942", signalGroups: [["0110"]] }),
  component({ id: "engine.map_sensor", diagnosticClass: "direct", pnc: "89421C", oe: "89421-20200", label: "Ahtopaineanturi / MAP turbo pressure", symptom: "Virheellinen ahtopaine, tehonpuute tai epälooginen MAP/boost-kuormavaste.", bomSource: "BOM rivit 6970-6971", signalGroups: [["010B"]] }),
  component({ id: "engine.coolant_temperature_sensor", diagnosticClass: "direct", pnc: "89422C", oe: "89422-33030", label: "Moottorin jäähdytysnesteen lämpötila-anturi", symptom: "Virheellinen lämpenemistieto, korkea lämmin tyhjäkäynti, regen-estot tai ECT-poikkeama.", bomSource: "BOM rivit 6972-6973", signalGroups: [["0105"]] }),
  component({ id: "engine.egr_valve", diagnosticClass: "direct", pnc: "25620", oe: "25620-26101", label: "EGR-venttiili", symptom: "Nykiminen, tehonpuute, musta savu/noki tai EGR/DPF-poikkeama.", bomSource: "BOM rivi 1297", signalGroups: [["212C", "012C", "0169"]] }),
  component({ id: "engine.dpnr_differential_pressure_sensor", diagnosticClass: "direct", pnc: "89480A", oe: "89480-53010", label: "DPF/DPNR paine-eroanturi", symptom: "DPF-oire, epäonnistuvat regeneroinnit, limp mode tai epäuskottava paine-ero.", bomSource: "BOM rivit 6939-6940", signalGroups: [["217E"]] }),
  component({ id: "engine.exhaust_gas_temperature_sensor_1", diagnosticClass: "direct", pnc: "89425", oe: "89425-53010", label: "Pakokaasun lämpötila-anturi 1", symptom: "Epäuskottava EGT-data tai regeneroinnin häiriö.", bomSource: "BOM rivit 6931-6932", signalGroups: [["217F"]] }),
  component({ id: "engine.exhaust_gas_temperature_sensor_2", diagnosticClass: "direct", pnc: "89425A", oe: "89425-53020", label: "Pakokaasun lämpötila-anturi 2", symptom: "Epäuskottava EGT-data tai regeneroinnin häiriö.", bomSource: "BOM rivit 6933-6934", signalGroups: [["217F"]] }),
  component({ id: "engine.fuel_temperature_sensor", diagnosticClass: "direct", pnc: "89454", oe: "89454-20010", label: "Polttoaineen lämpötila-anturi", symptom: "Epärealistinen polttoainelämpö voi vääristää rail-paineen ja ruiskutusmäärän tulkintaa.", bomSource: "BOM rivit 6976-6977", signalGroups: [["2193"]] }),
  component({ id: "engine.common_rail_pressure_sensor", diagnosticClass: "direct", pnc: "Pc Sensor / 23810A", oe: "89458-60010", label: "Common rail -paineanturi", symptom: "Rail-paineen epäuskottavuus, hidas paineennousu tai target/actual-ristiriita.", bomSource: "BOM rail assy rivi 1211 + DENSO IS220d bulletin", signalGroups: [["0123", "2196"]] }),

  component({ id: "engine.main_injectors", diagnosticClass: "indirect", pnc: "23670", oe: "23670-29105", label: "Common rail -pääsuuttimet", symptom: "Epätasainen käynti, palamattoman dieselin haju, savu, nakutus tai kulutuksen nousu.", bomSource: "BOM rivit 1104-1105", signalGroups: [["0123", "2196"], ["015D", "21AF"], ["010C"], ["2193"]], minimumGroups: 2, excludedSignals: ["219C"], note: "219C on Flex 0.8.1:ssa kenttäevidenssin perusteella estetty eikä koskaan nosta suutinten kattavuutta." }),
  component({ id: "engine.exhaust_fuel_addition_injector", diagnosticClass: "indirect", pnc: "23710B", oe: "23710-26011", label: "DPF/DPNR lisäpolttoainesuutin", symptom: "Regenerointi ei onnistu, savu/regenerointipoikkeama tai korkea DPF-paine-ero.", bomSource: "BOM rivit 1114-1115", signalGroups: [["217E"], ["217F"], ["0123", "2196"]], minimumGroups: 2 }),
  component({ id: "engine.scv", diagnosticClass: "indirect", pnc: "04226", oe: "04226-0L040", label: "SCV / imuohjausventtiili", symptom: "Rail pressure putoaa kuormalla, nykiminen, limp mode tai sammuminen.", bomSource: "BOM rivit 1131-1132", signalGroups: [["0123", "2196"], ["010C"], ["2193"]], minimumGroups: 2 }),
  component({ id: "engine.fuel_filter", diagnosticClass: "indirect", pnc: "23300/23303", oe: "23300-26100; 23390-0L010", label: "Polttoainesuodatin / elementti", symptom: "Pitkä startti, tehonpuute kuormalla, nykiminen, sammuminen tai matala rail-paine.", bomSource: "BOM rivit 1256-1259", signalGroups: [["0123", "2196"], ["010C"]], minimumGroups: 2 }),
  component({ id: "engine.injection_pump", diagnosticClass: "indirect", pnc: "22100", oe: "22100-0R031", label: "Common rail -korkeapainepumppu", symptom: "Rail-paine ei nouse startissa tai putoaa kuormalla, tehon katoaminen tai sammuminen.", bomSource: "BOM rivit 1139-1140", signalGroups: [["0123", "2196"], ["010C"], ["2193"]], minimumGroups: 2 }),
  component({ id: "engine.turbocharger", diagnosticClass: "indirect", pnc: "17201", oe: "17201-26011", label: "Turboahdin", symptom: "Hidas ahtopaineen nousu, yli-/aliahto, tehonpuute, limp mode tai savu.", bomSource: "BOM rivit 828-829", signalGroups: [["010B"], ["0110"], ["0133"], ["212C", "012C", "0169"]], minimumGroups: 3 }),
  component({ id: "engine.intercooler", diagnosticClass: "indirect", pnc: "17940D", oe: "17940-26010", label: "Välijäähdytin", symptom: "Ahtovuoto, tehonpuute, sihinä, musta savu tai toteutuneen ahtopaineen jääminen matalaksi.", bomSource: "BOM rivit 939-940", signalGroups: [["010B"], ["0110"], ["0133"]], minimumGroups: 2 }),
  component({ id: "engine.intake_manifold", diagnosticClass: "indirect", pnc: "17111", oe: "17101-26110", label: "Imusarja", symptom: "Karstoittuminen, alakierrosväännön heikkeneminen, savutus tai kulutuksen nousu.", bomSource: "BOM rivit 806-807", signalGroups: [["0110"], ["010B"], ["212C", "012C", "0169"]], minimumGroups: 2 }),
  component({ id: "engine.vacuum_regulating_valve", diagnosticClass: "indirect", pnc: "25819", oe: "25819-0R011", label: "Alipaineen säätöventtiili", symptom: "Turbon/EGR:n hidas tai väärä liike, tehonpuute, yli-/aliahto tai nykäisy.", bomSource: "BOM rivit 988-989", signalGroups: [["010B"], ["212C", "012C", "0169"], ["0110"]], minimumGroups: 2 }),
  component({ id: "engine.vacuum_switching_valve", diagnosticClass: "indirect", pnc: "25860", oe: "25860-0R010", label: "Alipaineen vaihtoventtiili / VSV", symptom: "Turbo/EGR-asento väärä, tehonpuute tai satunnainen nykäisy.", bomSource: "BOM rivit 990-991", signalGroups: [["010B"], ["212C", "012C", "0169"], ["0110"]], minimumGroups: 2 }),
  component({ id: "engine.air_cleaner_hose", diagnosticClass: "indirect", pnc: "17881/17881A/17882A", oe: "17880-26010; 96111-10850; 96111-10710", label: "Ilmaputki ja kiristimet MAFin/turbon imupuolella", symptom: "Imuvuoto, MAF-poikkeama, tehonpuute, savutus tai hidas ahtopaineen nousu.", bomSource: "BOM rivit 933-938", signalGroups: [["0110"], ["010B"]], minimumGroups: 2 }),
  component({ id: "engine.alternator", diagnosticClass: "indirect", pnc: "27020", oe: "27060-26030", label: "Laturi", symptom: "Alijännite, akun tyhjeneminen tai latauksen katoaminen kuormalla.", bomSource: "BOM rivit 1035-1036", signalGroups: [["0142"]] }),
  component({ id: "engine.starter", diagnosticClass: "indirect", pnc: "28100", oe: "28100-0R010", label: "Starttimoottori", symptom: "Hidas pyöritys, satunnainen starttaamattomuus tai käynnistyksen liian matala kierrosluku.", bomSource: "BOM rivit 1067-1068", signalGroups: [["010C"], ["0142"]], minimumGroups: 2 }),
  component({ id: "engine.crank_position_sensor", diagnosticClass: "indirect", pnc: "11401G", oe: "90919-05069", label: "Kampiakselin asentotunnistin", symptom: "Käynnistymättömyys, sammuminen, nykiminen tai kierroslukusignaalin katkeaminen.", bomSource: "BOM rivit 133-134", signalGroups: [["010C"]], note: "RPM on epäsuora signaali; cam/crank-correlation ei ole vielä Flexissä ajoneuvovarmennettu oma lukuarvo." })
]);

function relevantResults(run) {
  return Array.isArray(run?.results) ? run.results.filter(result => ENGINE_REQUEST_HEADERS.has(normalizeHex(result?.requestHeader))) : [];
}

function commandState(results, command) {
  const normalized = normalizeHex(command);
  const matches = results.filter(result => normalizeHex(result?.command) === normalized);
  return Object.freeze({ command: normalized, attempted: matches.length > 0, observed: matches.some(result => result?.validResponse === true), attempts: matches.length });
}

function evaluateComponent(definition, results) {
  const groupEvidence = definition.signalGroups.map(group => {
    const signals = group.map(command => commandState(results, command));
    return Object.freeze({ commands: Object.freeze([...group]), observed: signals.some(signal => signal.observed), attempted: signals.some(signal => signal.attempted), signals: Object.freeze(signals) });
  });
  const requiredGroups = Math.max(1, Number(definition.minimumGroups || 1));
  const observedGroups = groupEvidence.filter(group => group.observed).length;
  const attemptedGroups = groupEvidence.filter(group => group.attempted).length;
  let status = "not-tested";
  if (observedGroups >= requiredGroups) status = "observed";
  else if (observedGroups > 0) status = "partial";
  else if (attemptedGroups > 0) status = "unavailable";
  return deepFreeze({ ...definition, requiredGroups, observedGroups, attemptedGroups, status, groupEvidence });
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
    const observedSignals = item.groupEvidence.flatMap(group => group.signals).filter(signal => signal.observed).map(signal => signal.command);
    const attemptedSignals = item.groupEvidence.flatMap(group => group.signals).filter(signal => signal.attempted && !signal.observed).map(signal => signal.command);
    const suffix = [
      `class=${String(item.diagnosticClass || "").toUpperCase()}`,
      `status=${clean(item.status)}`,
      `pnc=${clean(item.pnc) || "-"}`,
      `oe=${clean(item.oe) || "-"}`,
      `component=${clean(item.label)}`,
      `groups=${Number(item.observedGroups || 0)}/${Number(item.requiredGroups || 1)}`,
      `observed_signals=${[...new Set(observedSignals)].join(",") || "-"}`,
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
    "- observed means Flex obtained the mapped signal coverage; it is not a component fault verdict.",
    "- INDIRECT means correlation evidence only; the mapped signals do not identify one physical cause by themselves.",
    "- Flex 0.8.1 field-disabled 219C injector feedback never counts toward component coverage.",
    "- This layer derives only from diagnostic results already collected by Flex and sends no additional vehicle command."
  );
  return `${lines.join("\n")}\n`;
}
