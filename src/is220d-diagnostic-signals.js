/**
 * Named diagnostic evidence used by BOM component recipes.
 *
 * This registry does not send anything and is not an allowlist. The transport
 * remains governed by the vehicle profile and existing command guards. A
 * signal may therefore exist here while productionAuthorized=false.
 */

const EVIDENCE_LEVELS = new Set(["vehicle-verified", "techstream-derived", "research-candidate"]);
const AUTHORIZATION_STATES = new Set(["standard-obd", "vehicle-profile", "not-authorized", "field-rejected"]);
const HEX = /^[0-9A-F]+$/;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function signal(definition) {
  if (!definition?.key || !/^engine\.[a-z0-9_]+$/.test(definition.key)) throw new Error(`Invalid diagnostic signal key: ${definition?.key}`);
  if (!EVIDENCE_LEVELS.has(definition.evidence)) throw new Error(`Invalid evidence level for ${definition.key}: ${definition.evidence}`);
  if (!AUTHORIZATION_STATES.has(definition.authorization)) throw new Error(`Invalid authorization state for ${definition.key}: ${definition.authorization}`);
  if (!Array.isArray(definition.commands) || definition.commands.length === 0) throw new Error(`Diagnostic signal ${definition.key} has no command identity`);
  for (const command of definition.commands) {
    if (!HEX.test(command) || command.length % 2 !== 0) throw new Error(`Invalid command identity ${command} for ${definition.key}`);
  }
  if (definition.authorization === "field-rejected" && definition.productionAuthorized !== false) throw new Error(`Field-rejected signal ${definition.key} cannot be production-authorized`);
  return definition;
}

export const IS220D_DIAGNOSTIC_SIGNALS = deepFreeze([
  signal({ key: "engine.rpm", label: "Moottorin kierrosluku", commands: ["010C"], expectedResponsePrefix: "410C", decoder: "sae-mode01-rpm", unit: "rpm", plausibleRange: [0, 8000], evidence: "vehicle-verified", authorization: "standard-obd", productionAuthorized: true, collectedByWideDiagnostic: true, operatingStates: ["cranking", "running"], source: "SAE Mode 01 PID 0C / existing Flex decoder" }),
  signal({ key: "engine.coolant_temperature", label: "Jäähdytysnesteen lämpötila", commands: ["0105"], expectedResponsePrefix: "4105", decoder: "sae-mode01-coolant-temperature", unit: "°C", plausibleRange: [-40, 215], evidence: "vehicle-verified", authorization: "standard-obd", productionAuthorized: true, collectedByWideDiagnostic: true, operatingStates: ["key-on", "running"], source: "SAE Mode 01 PID 05 / existing Flex decoder" }),
  signal({ key: "engine.map", label: "Imusarjan absoluuttinen paine / MAP", commands: ["010B"], expectedResponsePrefix: "410B", decoder: "sae-mode01-map", unit: "kPa", plausibleRange: [0, 255], evidence: "vehicle-verified", authorization: "standard-obd", productionAuthorized: true, collectedByWideDiagnostic: true, operatingStates: ["key-on", "running"], source: "SAE Mode 01 PID 0B / existing Flex decoder" }),
  signal({ key: "engine.maf", label: "Ilmamassa / MAF", commands: ["0110"], expectedResponsePrefix: "4110", decoder: "sae-mode01-maf", unit: "g/s", plausibleRange: [0, 655.35], evidence: "vehicle-verified", authorization: "standard-obd", productionAuthorized: true, collectedByWideDiagnostic: true, operatingStates: ["running"], source: "SAE Mode 01 PID 10 / existing Flex decoder" }),
  signal({ key: "engine.rail_pressure_obd", label: "Common rail -paine, standardi OBD", commands: ["0123"], expectedResponsePrefix: "4123", decoder: "sae-mode01-diesel-rail-pressure", unit: "kPa", plausibleRange: [0, 655350], evidence: "vehicle-verified", authorization: "standard-obd", productionAuthorized: true, collectedByWideDiagnostic: true, operatingStates: ["cranking", "running"], source: "SAE Mode 01 PID 23 / existing Flex decoder" }),
  signal({ key: "engine.barometric_pressure", label: "Ilmanpaine / BARO", commands: ["0133"], expectedResponsePrefix: "4133", decoder: "sae-mode01-barometric-pressure", unit: "kPa", plausibleRange: [0, 255], evidence: "vehicle-verified", authorization: "standard-obd", productionAuthorized: true, collectedByWideDiagnostic: true, operatingStates: ["key-on", "running"], source: "SAE Mode 01 PID 33 / existing Flex decoder" }),
  signal({ key: "engine.ecu_voltage", label: "ECU-ohjausmoduulin jännite", commands: ["0142"], expectedResponsePrefix: "4142", decoder: "sae-mode01-control-module-voltage", unit: "V", plausibleRange: [0, 20], evidence: "vehicle-verified", authorization: "standard-obd", productionAuthorized: true, collectedByWideDiagnostic: true, operatingStates: ["key-on", "cranking", "running"], source: "SAE Mode 01 PID 42 / existing Flex decoder" }),
  signal({ key: "engine.egr_commanded_obd", label: "EGR-pyyntö, standardi OBD", commands: ["012C"], expectedResponsePrefix: "412C", decoder: "sae-mode01-commanded-egr", unit: "%", plausibleRange: [0, 100], evidence: "research-candidate", authorization: "standard-obd", productionAuthorized: true, collectedByWideDiagnostic: false, operatingStates: ["running"], source: "SAE Mode 01 PID 2C; component-context fallback only" }),
  signal({ key: "engine.egr_position_obd", label: "EGR-asento, standardi OBD", commands: ["0169"], expectedResponsePrefix: "4169", decoder: "sae-mode01-egr-data", unit: "%", plausibleRange: [0, 100], evidence: "research-candidate", authorization: "standard-obd", productionAuthorized: true, collectedByWideDiagnostic: false, operatingStates: ["running"], source: "SAE Mode 01 PID 69; component-context fallback only" }),
  signal({ key: "engine.injection_timing_obd", label: "Ruiskutusajoitus, standardi OBD", commands: ["015D"], expectedResponsePrefix: "415D", decoder: "sae-mode01-fuel-injection-timing", unit: "°CA", plausibleRange: [-210, 301.992], evidence: "research-candidate", authorization: "standard-obd", productionAuthorized: true, collectedByWideDiagnostic: false, operatingStates: ["running"], source: "SAE Mode 01 PID 5D; not part of the current standard wide-diagnostic set" }),

  signal({ key: "engine.egr_position_toyota", label: "EGR-venttiilin asento", commands: ["212C"], expectedResponsePrefix: "612C", decoder: "toyota-2ad-fhv-212c-v1", unit: "%", plausibleRange: [0, 100], evidence: "vehicle-verified", authorization: "vehicle-profile", productionAuthorized: true, collectedByWideDiagnostic: true, operatingStates: ["running"], source: "IS220d profile / vehicle-verified 212C" }),
  signal({ key: "engine.dpnr_differential_pressure", label: "DPNR-paine-ero", commands: ["217E"], expectedResponsePrefix: "617E", decoder: "toyota-2ad-fhv-217e-v1", unit: "kPa", plausibleRange: [-5, 95], evidence: "vehicle-verified", authorization: "vehicle-profile", productionAuthorized: true, collectedByWideDiagnostic: true, operatingStates: ["key-on", "running"], source: "IS220d profile / vehicle-verified 217E" }),
  signal({ key: "engine.egt_inlet", label: "Pakolämpö ennen DPNR:ää", commands: ["217F"], expectedResponsePrefix: "617F", decoder: "toyota-2ad-fhv-217f-v1:inlet", unit: "°C", plausibleRange: [-40, 1200], evidence: "vehicle-verified", authorization: "vehicle-profile", productionAuthorized: true, collectedByWideDiagnostic: true, operatingStates: ["key-on", "running"], source: "IS220d profile / vehicle-verified 217F" }),
  signal({ key: "engine.egt_outlet", label: "Pakolämpö DPNR:n jälkeen", commands: ["217F"], expectedResponsePrefix: "617F", decoder: "toyota-2ad-fhv-217f-v1:outlet", unit: "°C", plausibleRange: [-40, 1200], evidence: "vehicle-verified", authorization: "vehicle-profile", productionAuthorized: true, collectedByWideDiagnostic: true, operatingStates: ["key-on", "running"], source: "IS220d profile / vehicle-verified 217F" }),

  signal({ key: "engine.fuel_temperature_screening", label: "Polttoaineen lämpötila, Techstream-johdettu", commands: ["2193"], expectedResponsePrefix: "6193", decoder: "toyota-2ad-fhv-2193-v1", unit: "°C", plausibleRange: [-40, 150], evidence: "techstream-derived", authorization: "not-authorized", productionAuthorized: false, collectedByWideDiagnostic: false, operatingStates: ["key-on", "running"], source: "IS220d injector screening profile; pending vehicle verification" }),
  signal({ key: "engine.rail_pressure_screening", label: "Common rail -paine, Techstream-johdettu", commands: ["2196"], expectedResponsePrefix: "6196", decoder: "toyota-2ad-fhv-2196-v1", unit: "MPa", plausibleRange: [0, 250], evidence: "techstream-derived", authorization: "not-authorized", productionAuthorized: false, collectedByWideDiagnostic: false, operatingStates: ["cranking", "running"], source: "IS220d injector screening profile; pending vehicle verification" }),
  signal({ key: "engine.injection_timing_screening", label: "Ruiskutusajoitus, Techstream-johdettu", commands: ["21AF"], expectedResponsePrefix: "61AF", decoder: "toyota-2ad-fhv-21af-v1", unit: "°CA", plausibleRange: [-90, 90], evidence: "techstream-derived", authorization: "not-authorized", productionAuthorized: false, collectedByWideDiagnostic: false, operatingStates: ["running"], source: "IS220d injector screening profile; pending vehicle verification" }),
  signal({ key: "engine.injection_feedback_rejected", label: "Suutinkorjaus 1–4, kentässä hylätty tunniste", commands: ["219C"], expectedResponsePrefix: "619C", decoder: "toyota-2ad-fhv-219c-v1-rejected", unit: "mm³", plausibleRange: [-10, 10], evidence: "techstream-derived", authorization: "field-rejected", productionAuthorized: false, collectedByWideDiagnostic: false, operatingStates: ["warm-idle"], source: "NO DATA in three repeatable target-vehicle runs on calibration 35360000" })
]);

export const IS220D_DIAGNOSTIC_SIGNAL_BY_KEY = new Map(IS220D_DIAGNOSTIC_SIGNALS.map(item => [item.key, item]));

export function getIs220dDiagnosticSignal(key) {
  return IS220D_DIAGNOSTIC_SIGNAL_BY_KEY.get(String(key || "")) || null;
}

export function commandsForIs220dDiagnosticSignal(key) {
  const definition = getIs220dDiagnosticSignal(key);
  if (!definition) throw new Error(`Unknown IS220d diagnostic signal: ${key}`);
  return definition.commands;
}

export function isProductionAuthorizedIs220dSignal(key) {
  return getIs220dDiagnosticSignal(key)?.productionAuthorized === true;
}
