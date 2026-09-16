import {
  CT200H_DIAGNOSTIC_PROFILE,
  CT200H_READ_DATA_PROBES,
  CT200H_LIVE_DATA_PROBES,
  CT200H_DTC_REQUESTS
} from "./ct200h-profile.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

const unique = values => [...new Set((values || []).filter(Boolean))];
const liveProbe = id => CT200H_LIVE_DATA_PROBES.find(probe => probe.id === id) || null;
const readProbe = id => CT200H_READ_DATA_PROBES.find(probe => probe.id === id) || null;

function metricsForProbe(id) {
  const probe = liveProbe(id);
  return probe ? probe.fields.map(field => field.id) : [];
}

function metricTest(id, ecuId, label, metricIds, {
  diagnosticClass = "direct",
  operatingStates = ["ready"],
  note = ""
} = {}) {
  return {
    id,
    ecuId,
    label,
    runner: "metric",
    diagnosticClass,
    metricIds: unique(metricIds),
    operatingStates: unique(operatingStates),
    note,
    productionAuthorized: true
  };
}

function probeTest(id, ecuId, label, probeId, note = "") {
  const probe = readProbe(probeId);
  return {
    id,
    ecuId,
    label,
    runner: "profile-probe",
    diagnosticClass: "direct",
    probeId,
    expectedResponsePrefix: probe?.expectedResponsePrefix || "",
    operatingStates: ["ignition-on", "ready"],
    note,
    productionAuthorized: Boolean(probe) && probe.evidence !== "research-candidate"
  };
}

function dtcTest(id, ecuId, label, requestIds, note = "") {
  return {
    id,
    ecuId,
    label,
    runner: "vehicle-dtc",
    diagnosticClass: "direct",
    dtcRequestIds: unique(requestIds),
    operatingStates: ["ignition-on", "ready"],
    note,
    productionAuthorized: true
  };
}

function blockedTest(id, ecuId, label, reason) {
  return {
    id,
    ecuId,
    label,
    runner: "blocked",
    diagnosticClass: "blocked",
    metricIds: [],
    operatingStates: [],
    note: reason,
    productionAuthorized: false
  };
}

const hybridDtcIds = CT200H_DTC_REQUESTS
  .filter(request => request.ecuId === "hybrid" && request.evidence !== "research-candidate")
  .map(request => request.id);

export const CT200H_ECU_COMPONENT_TESTS = deepFreeze([
  metricTest(
    "engine.ecu_status",
    "engine",
    "Moottori-ECU · perustila ja syöttöjännite",
    ["milOn", "dtcCount", "voltage"],
    { note: "Käyttää vain standardin EOBD Mode 01 -mittareita; ei päättele ECU:n kuntoa yksittäisestä arvosta." }
  ),
  metricTest(
    "engine.coolant_temperature_sensor",
    "engine",
    "Moottorin jäähdytysnesteen lämpötila-anturi",
    ["coolant"],
    { note: "Standardi EOBD 0105; tulos on anturin ECU:lle ilmoittama arvo." }
  ),
  metricTest(
    "engine.engine_speed_signal",
    "engine",
    "Moottorin kierroslukusignaali",
    ["rpm"],
    { note: "Standardi EOBD 010C; READY-tilassa bensiinimoottori voi olla pysähtynyt hybridijärjestelmän ohjauksesta." }
  ),
  metricTest(
    "engine.air_metering",
    "engine",
    "Moottorin ilmanmittaus ja kaasuläppä",
    ["map", "maf", "intakeTemp", "throttle", "pedal", "pedalE", "commandedThrottle"],
    {
      diagnosticClass: "indirect",
      note: "Lukee vain ECU:n tukemat standardit EOBD-mittarit. Puuttuva valinnainen PID näkyy puuttuvana evidenssinä eikä vikana."
    }
  ),
  metricTest(
    "engine.egr_feedback",
    "engine",
    "EGR/VVT-valvonnan standardi EOBD-palaute",
    ["commandedEgr", "egrError"],
    {
      diagnosticClass: "indirect",
      note: "Käyttää standardeja 012C/012D-arvoja silloin kun CT:n moottori-ECU tukee niitä."
    }
  ),
  metricTest(
    "engine.emissions_sensors",
    "engine",
    "Lambda- ja katalysaattorilämpöjen EOBD-evidenssi",
    ["lambdaB1S1", "catalystTemperatureB1S1", "catalystTemperatureB1S2"],
    {
      diagnosticClass: "indirect",
      note: "Valinnaisia standardeja EOBD-mittareita; tuki tarkistetaan lukuvastauksesta."
    }
  ),
  probeTest(
    "hybrid.identification",
    "hybrid",
    "Hybridiohjaimen ZWA10-tunnistus",
    "hybrid.model_identification",
    "Käyttää profiilin varmennettua 21C1-lukupyyntöä ja 61C1-vastausta."
  ),
  metricTest(
    "hybrid.state_of_charge",
    "hybrid",
    "HV-akun varaustila",
    metricsForProbe("hybrid.state_of_charge"),
    { note: "2101 / 6101 · CT-profiilin read-only-mittari." }
  ),
  metricTest(
    "hybrid.block_voltages",
    "hybrid",
    "HV-akun 14 lohkojännitettä ja jännite-ero",
    metricsForProbe("hybrid.block_voltages"),
    { note: "2181 / 6181 · yksi fyysinen ECU-luku tuottaa kaikki saman paketin lohkojännite- ja yhteenvetoarvot." }
  ),
  metricTest(
    "hybrid.battery_temperatures",
    "hybrid",
    "HV-akun jäähdytysilma ja lämpöanturit TB1–TB3",
    metricsForProbe("hybrid.battery_temperatures"),
    { note: "2187 / 6187 · kaikki lämpöarvot samasta varmennetusta lukupaketista." }
  ),
  metricTest(
    "hybrid.internal_resistance",
    "hybrid",
    "HV-akun 14 lohkon sisäiset vastukset",
    metricsForProbe("hybrid.internal_resistance"),
    { note: "2195 / 6195 · yksi fyysinen ECU-luku tuottaa lohkokohtaiset ja yhteenvetoarvot." }
  ),
  metricTest(
    "hybrid.current_and_limits",
    "hybrid",
    "HV-akun virta, tehorajat ja SOC-hajonta",
    metricsForProbe("hybrid.current_and_limits"),
    { note: "2198 / 6198 · CT-profiilin read-only-mittauspaketti." }
  ),
  dtcTest(
    "hybrid.dtc_memory",
    "hybrid",
    "Hybridiohjaimen vikakoodimuistit",
    hybridDtcIds,
    "Käyttää vain CT-profiilin tuotantoon hyväksyttyjä read-only DTC-pyyntöjä."
  ),
  blockedTest(
    "brake.dtc_candidate",
    "brake",
    "Skid Control / Brake Booster -ohjaimen vikakoodit",
    "7B0/7B8-luku on nykyisessä CT-profiilissa research-candidate ja validatedOnCt200h=false. Test Lab näyttää kohteen, mutta production-runner ei lähetä pyyntöä ennen kenttävarmennusta."
  )
]);

export const CT200H_ECU_COMPONENT_TEST_BY_ID = deepFreeze(Object.fromEntries(
  CT200H_ECU_COMPONENT_TESTS.map(test => [test.id, test])
));

export function getCt200hEcuComponentTest(testId) {
  return CT200H_ECU_COMPONENT_TEST_BY_ID[String(testId || "")] || null;
}

export function buildCt200hEcuCoverageSummary() {
  const profileEcus = Object.keys(CT200H_DIAGNOSTIC_PROFILE.ecus || {});
  const byEcu = Object.fromEntries(profileEcus.map(ecuId => {
    const tests = CT200H_ECU_COMPONENT_TESTS.filter(test => test.ecuId === ecuId);
    return [ecuId, {
      ecuId,
      label: CT200H_DIAGNOSTIC_PROFILE.ecus[ecuId]?.label || ecuId,
      total: tests.length,
      runnable: tests.filter(test => test.productionAuthorized && test.runner !== "blocked").length,
      blocked: tests.filter(test => !test.productionAuthorized || test.runner === "blocked").length,
      testIds: tests.map(test => test.id)
    }];
  }));
  return deepFreeze({
    vehicleKey: CT200H_DIAGNOSTIC_PROFILE.key,
    profileVersion: CT200H_DIAGNOSTIC_PROFILE.profileVersion,
    ecuIds: profileEcus,
    totalTests: CT200H_ECU_COMPONENT_TESTS.length,
    runnableTests: CT200H_ECU_COMPONENT_TESTS.filter(test => test.productionAuthorized && test.runner !== "blocked").length,
    blockedTests: CT200H_ECU_COMPONENT_TESTS.filter(test => !test.productionAuthorized || test.runner === "blocked").length,
    byEcu,
    scope: "Covers every ECU currently declared by the CT200h profile. Undeclared vehicle ECUs are not guessed or probed."
  });
}
