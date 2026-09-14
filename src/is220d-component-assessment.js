import { decodePidResponse, decodeToyotaReadDataResponse } from "./core.js";
import { getIs220dDiagnosticSignal } from "./is220d-diagnostic-signals.js";

export const IS220D_COMPONENT_ASSESSMENT_SCHEMA_VERSION = 1;
export const IS220D_COMPONENT_ASSESSMENT_STATUSES = Object.freeze([
  "not-evaluated",
  "inconclusive",
  "normal-pattern",
  "deviation",
  "strong-deviation"
]);

const STATUS_SET = new Set(IS220D_COMPONENT_ASSESSMENT_STATUSES);
const normalizeHex = value => String(value || "").replace(/\s+/g, "").toUpperCase();

const STANDARD_SIGNAL_METRIC = Object.freeze({
  "engine.rpm": "rpm",
  "engine.coolant_temperature": "coolant",
  "engine.map": "map",
  "engine.maf": "maf",
  "engine.rail_pressure_obd": "railPressure",
  "engine.barometric_pressure": "barometricPressure",
  "engine.ecu_voltage": "voltage",
  "engine.egr_commanded_obd": "commandedEgr",
  "engine.egr_position_obd": "egrPositionActual",
  "engine.injection_timing_obd": "injectionTiming"
});

const TOYOTA_SIGNAL_VALUE = Object.freeze({
  "engine.egr_position_toyota": Object.freeze({ identifier: 0x2c, valueKey: "egrPositionPercent" }),
  "engine.dpnr_differential_pressure": Object.freeze({ identifier: 0x7e, valueKey: "dpnrDifferentialPressureKpa" }),
  "engine.egt_inlet": Object.freeze({ identifier: 0x7f, valueKey: "dpnrInletTemperatureC" }),
  "engine.egt_outlet": Object.freeze({ identifier: 0x7f, valueKey: "dpnrOutletTemperatureC" }),
  "engine.fuel_temperature_screening": Object.freeze({ identifier: 0x93, valueKey: "fuelTemperatureC" }),
  "engine.rail_pressure_screening": Object.freeze({ identifier: 0x96, valueKey: "railPressureMpa" }),
  "engine.injection_timing_screening": Object.freeze({ identifier: 0xaf, valueKey: "injectionTimingDegCa" })
});

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) freeze(nested);
  return value;
}

function inPlausibleRange(value, range) {
  if (!Number.isFinite(value) || !Array.isArray(range) || range.length !== 2) return null;
  const [minimum, maximum] = range.map(Number);
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return null;
  return value >= minimum && value <= maximum;
}

function matchingValidResults(signal, results) {
  const commands = new Set(signal.commands.map(normalizeHex));
  return (Array.isArray(results) ? results : []).filter(result =>
    result?.validResponse === true && commands.has(normalizeHex(result?.command))
  );
}

/**
 * Decode one named signal from one already-collected diagnostic result.
 * No command is created or transmitted here.
 */
export function decodeIs220dDiagnosticSignalResult(signalKey, result) {
  const signal = getIs220dDiagnosticSignal(signalKey);
  if (!signal || result?.validResponse !== true) return null;
  if (!signal.commands.map(normalizeHex).includes(normalizeHex(result?.command))) return null;

  const standardMetric = STANDARD_SIGNAL_METRIC[signalKey];
  if (standardMetric) {
    const value = decodePidResponse(standardMetric, result.raw || "");
    return Number.isFinite(value)
      ? freeze({ signalKey, value, unit: signal.unit, evidence: signal.evidence, sourceCommand: normalizeHex(result.command), inPlausibleRange: inPlausibleRange(value, signal.plausibleRange) })
      : null;
  }

  const toyota = TOYOTA_SIGNAL_VALUE[signalKey];
  if (toyota) {
    const decoded = decodeToyotaReadDataResponse(result.raw || "", toyota.identifier, "is220d");
    const value = decoded?.complete ? Number(decoded.values?.[toyota.valueKey]) : NaN;
    return Number.isFinite(value)
      ? freeze({ signalKey, value, unit: signal.unit, evidence: signal.evidence, sourceCommand: normalizeHex(result.command), inPlausibleRange: inPlausibleRange(value, signal.plausibleRange) })
      : null;
  }

  return null;
}

function result(status, reason, values = [], limitations = []) {
  if (!STATUS_SET.has(status)) throw new Error(`Unsupported component assessment status: ${status}`);
  return freeze({
    schemaVersion: IS220D_COMPONENT_ASSESSMENT_SCHEMA_VERSION,
    status,
    reason,
    values: [...values],
    limitations: [...limitations]
  });
}

/**
 * First assessment wave: DIRECT components only, and only structural numeric
 * plausibility from evidence that is already vehicle-verified. Dynamic,
 * operating-state and correlation rules intentionally remain inconclusive or
 * not evaluated until their explicit scenarios are implemented.
 */
export function assessIs220dComponentEvidence(component, results) {
  if (!component || component.diagnosticClass !== "direct") {
    return result(
      "not-evaluated",
      "INDIRECT-komponentin syy-yhteys vaatii erillisen korrelaatio- ja toimintatilasäännön.",
      [],
      ["Kattavuus ei ole komponentin kuntoarvio."]
    );
  }

  if (component.status !== "observed") {
    return result(
      "not-evaluated",
      "Komponentin DIRECT-signaalikattavuutta ei saatu tässä ajossa.",
      [],
      ["Puuttuva vastaus ei ole vikatuomio."]
    );
  }

  const observedKeys = [...new Set((component.groupEvidence || [])
    .flatMap(group => group.signals || [])
    .filter(signal => signal.observed)
    .map(signal => signal.signalKey)
    .filter(Boolean))];

  const decodedValues = [];
  for (const signalKey of observedKeys) {
    const signal = getIs220dDiagnosticSignal(signalKey);
    if (!signal || signal.authorization === "field-rejected") continue;
    for (const diagnosticResult of matchingValidResults(signal, results)) {
      const decoded = decodeIs220dDiagnosticSignalResult(signalKey, diagnosticResult);
      if (decoded) decodedValues.push(decoded);
    }
  }

  if (!decodedValues.length) {
    return result(
      "inconclusive",
      "Positiivinen DIRECT-vastaus saatiin, mutta numeerista arvoa ei voitu purkaa varmennetulla dekooderilla.",
      [],
      ["Raakavastaus säilyy raportissa jatkoanalyysiä varten."]
    );
  }

  const verifiedValues = decodedValues.filter(value => value.evidence === "vehicle-verified");
  if (!verifiedValues.length) {
    return result(
      "inconclusive",
      "Saatu numeerinen arvo perustuu vielä varmentamattomaan tai Techstream-johdettuun signaaliin.",
      decodedValues,
      ["Arvo ei saa muodostaa automaattista komponenttituomiota ennen ajoneuvovarmennusta."]
    );
  }

  const outside = verifiedValues.filter(value => value.inPlausibleRange === false);
  if (outside.length) {
    return result(
      "strong-deviation",
      "Vähintään yksi ajoneuvovarmennettu DIRECT-arvo on määritellyn rakenteellisen uskottavuusalueen ulkopuolella.",
      decodedValues,
      ["Poikkeama osoittaa signaalin/data-arvon poikkeaman; se ei yksin todista fyysisen osan vikasyytä."]
    );
  }

  const undecidable = verifiedValues.some(value => value.inPlausibleRange == null);
  if (undecidable) {
    return result(
      "inconclusive",
      "DIRECT-arvo saatiin, mutta sille ei ole riittävää numeerista uskottavuusrajaa.",
      decodedValues,
      ["Tarvitaan komponentti- ja toimintatilakohtainen sääntö."]
    );
  }

  return result(
    "normal-pattern",
    "Ajoneuvovarmennettu DIRECT-arvo on määritellyn rakenteellisen uskottavuusalueen sisällä.",
    decodedValues,
    [
      "Tämä ei todista komponenttia ehjäksi.",
      "Jumiutuminen, hidas vaste ja kuormituksessa ilmenevät poikkeamat vaativat myöhemmän toimintatilatestin."
    ]
  );
}
