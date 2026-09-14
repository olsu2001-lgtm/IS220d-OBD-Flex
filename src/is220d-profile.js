/**
 * Declarative, read-only diagnostic profile for the user's verified vehicle.
 *
 * The profile is intentionally data-only. A probe may enter this file only
 * after its request, response layout and conversion have been tied to the
 * IS220d / 2AD-FHV evidence set and, for published values, verified in the
 * vehicle. Runtime validation keeps malformed or accidentally writable
 * definitions out of the transport layer.
 */

/** @typedef {"vehicle-verified"|"techstream-derived"|"research-candidate"} EvidenceLevel */

/**
 * @typedef {Object} DiagnosticFieldDefinition
 * @property {string} id
 * @property {string} valueKey
 * @property {string} label
 * @property {string} unit
 * @property {number} decimals
 * @property {[number, number]} plausibleRange
 * @property {EvidenceLevel} evidence
 * @property {false} writable
 */

/**
 * @typedef {Object} DiagnosticProbeDefinition
 * @property {string} id
 * @property {number} service
 * @property {number} responseService
 * @property {number} identifier
 * @property {string} identifierHex
 * @property {string} command
 * @property {string} rawCommand
 * @property {string} expectedResponsePrefix
 * @property {string} label
 * @property {string} decoder
 * @property {number} minPayloadLength
 * @property {number} cacheMaxAgeMs
 * @property {EvidenceLevel} evidence
 * @property {false} writable
 * @property {readonly DiagnosticFieldDefinition[]} fields
 */

const EVIDENCE_LEVELS = new Set([
  "vehicle-verified",
  "techstream-derived",
  "research-candidate"
]);

const READ_ONLY_SERVICES = new Set([0x01, 0x02, 0x03, 0x07, 0x09, 0x0a, 0x21]);
const HEADER_PATTERN = /^[0-9A-F]{3}(?:[0-9A-F]{5})?$/;
const HEX_PATTERN = /^[0-9A-F]+$/;

const byteHex = value => (Number(value) & 0xff).toString(16).padStart(2, "0").toUpperCase();

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

const engineProbes = [
  {
    id: "engine.dpnr_status",
    service: 0x21,
    responseService: 0x61,
    identifier: 0x7e,
    identifierHex: "7E",
    command: "217E",
    rawCommand: "02217E0000000000",
    expectedResponsePrefix: "617E",
    label: "DPNR-paine-ero ja regenerointitilat",
    decoder: "toyota-2ad-fhv-217e-v1",
    minPayloadLength: 4,
    cacheMaxAgeMs: 700,
    evidence: "vehicle-verified",
    writable: false,
    fields: [
      { id: "dpnrDifferentialPressure", valueKey: "dpnrDifferentialPressureKpa", label: "DPNR-paine-ero", unit: "kPa", decimals: 2, plausibleRange: [-5, 95], evidence: "vehicle-verified", writable: false },
      { id: "dpnrSulfurRegenerationState", valueKey: "sulfurRegenerationState", label: "DPNR-rikkiregeneroinnin tila", unit: "", decimals: 0, plausibleRange: [0, 255], evidence: "vehicle-verified", writable: false },
      { id: "dpnrPmRegenerationState", valueKey: "pmRegenerationState", label: "DPNR-PM-regeneroinnin tila", unit: "", decimals: 0, plausibleRange: [0, 255], evidence: "vehicle-verified", writable: false },
      { id: "dpnrRegenerationActive", valueKey: "regenerationActive", label: "DPNR-regenerointi käynnissä", unit: "", decimals: 0, plausibleRange: [0, 1], evidence: "vehicle-verified", writable: false }
    ]
  },
  {
    id: "engine.dpnr_temperatures",
    service: 0x21,
    responseService: 0x61,
    identifier: 0x7f,
    identifierHex: "7F",
    command: "217F",
    rawCommand: "02217F0000000000",
    expectedResponsePrefix: "617F",
    label: "Pakolämmöt ennen DPNR:ää ja sen jälkeen",
    decoder: "toyota-2ad-fhv-217f-v1",
    minPayloadLength: 4,
    cacheMaxAgeMs: 1400,
    evidence: "vehicle-verified",
    writable: false,
    fields: [
      { id: "dpnrInletTemperature", valueKey: "dpnrInletTemperatureC", label: "Pakolämpö ennen DPNR:ää", unit: "°C", decimals: 1, plausibleRange: [-40, 1200], evidence: "vehicle-verified", writable: false },
      { id: "dpnrOutletTemperature", valueKey: "dpnrOutletTemperatureC", label: "Pakolämpö DPNR:n jälkeen", unit: "°C", decimals: 1, plausibleRange: [-40, 1200], evidence: "vehicle-verified", writable: false }
    ]
  },
  {
    id: "engine.egr_position",
    service: 0x21,
    responseService: 0x61,
    identifier: 0x2c,
    identifierHex: "2C",
    command: "212C",
    rawCommand: "02212C0000000000",
    expectedResponsePrefix: "612C",
    label: "EGR-venttiilin asento",
    decoder: "toyota-2ad-fhv-212c-v1",
    minPayloadLength: 1,
    cacheMaxAgeMs: 700,
    evidence: "vehicle-verified",
    writable: false,
    fields: [
      { id: "toyotaEgrPosition", valueKey: "egrPositionPercent", label: "EGR-venttiilin asento", unit: "%", decimals: 1, plausibleRange: [0, 100], evidence: "vehicle-verified", writable: false }
    ]
  }
];

const injectorScreeningProbes = [
  {
    id: "engine.fuel_temperature_screening",
    service: 0x21,
    responseService: 0x61,
    identifier: 0x93,
    identifierHex: "93",
    command: "2193",
    rawCommand: "0221930000000000",
    expectedResponsePrefix: "6193",
    label: "Polttoaineen lämpötila suutintestiä varten",
    decoder: "toyota-2ad-fhv-2193-v1",
    minPayloadLength: 1,
    cacheMaxAgeMs: 1400,
    evidence: "techstream-derived",
    writable: false,
    fields: [
      { id: "toyotaFuelTemperature", valueKey: "fuelTemperatureC", label: "Polttoaineen lämpötila", unit: "°C", decimals: 0, plausibleRange: [-40, 150], evidence: "techstream-derived", writable: false }
    ]
  },
  {
    id: "engine.rail_pressure_screening",
    service: 0x21,
    responseService: 0x61,
    identifier: 0x96,
    identifierHex: "96",
    command: "2196",
    rawCommand: "0221960000000000",
    expectedResponsePrefix: "6196",
    label: "Common rail -paine suutintestiä varten",
    decoder: "toyota-2ad-fhv-2196-v1",
    minPayloadLength: 1,
    cacheMaxAgeMs: 700,
    evidence: "techstream-derived",
    writable: false,
    fields: [
      { id: "toyotaRailPressure", valueKey: "railPressureMpa", label: "Common rail -paine", unit: "MPa", decimals: 0, plausibleRange: [0, 250], evidence: "techstream-derived", writable: false }
    ]
  },
  {
    id: "engine.injection_feedback_screening",
    service: 0x21,
    responseService: 0x61,
    identifier: 0x9c,
    identifierHex: "9C",
    command: "219C",
    rawCommand: "02219C0000000000",
    expectedResponsePrefix: "619C",
    label: "Suutinkorjaukset 1–4",
    decoder: "toyota-2ad-fhv-219c-v1",
    minPayloadLength: 4,
    cacheMaxAgeMs: 700,
    evidence: "techstream-derived",
    writable: false,
    fields: [
      { id: "injectionFeedback1", valueKey: "injectionFeedback1Mm3", label: "Suutinkorjaus 1", unit: "mm³", decimals: 2, plausibleRange: [-10, 10], evidence: "techstream-derived", writable: false },
      { id: "injectionFeedback2", valueKey: "injectionFeedback2Mm3", label: "Suutinkorjaus 2", unit: "mm³", decimals: 2, plausibleRange: [-10, 10], evidence: "techstream-derived", writable: false },
      { id: "injectionFeedback3", valueKey: "injectionFeedback3Mm3", label: "Suutinkorjaus 3", unit: "mm³", decimals: 2, plausibleRange: [-10, 10], evidence: "techstream-derived", writable: false },
      { id: "injectionFeedback4", valueKey: "injectionFeedback4Mm3", label: "Suutinkorjaus 4", unit: "mm³", decimals: 2, plausibleRange: [-10, 10], evidence: "techstream-derived", writable: false }
    ]
  },
  {
    id: "engine.injection_timing_screening",
    service: 0x21,
    responseService: 0x61,
    identifier: 0xaf,
    identifierHex: "AF",
    command: "21AF",
    rawCommand: "0221AF0000000000",
    expectedResponsePrefix: "61AF",
    label: "Ruiskutusajoitus suutintestiä varten",
    decoder: "toyota-2ad-fhv-21af-v1",
    minPayloadLength: 2,
    cacheMaxAgeMs: 1400,
    evidence: "techstream-derived",
    writable: false,
    fields: [
      { id: "toyotaInjectionTiming", valueKey: "injectionTimingDegCa", label: "Ruiskutusajoitus", unit: "°CA", decimals: 1, plausibleRange: [-90, 90], evidence: "techstream-derived", writable: false }
    ]
  }
];

export const IS220D_DIAGNOSTIC_PROFILE = deepFreeze({
  schemaVersion: 1,
  profileVersion: "is220d-xe20-2ad-fhv-readonly-v1",
  vehicle: {
    make: "Lexus",
    model: "IS220d",
    platform: "XE20",
    modelYear: 2008,
    engine: "2AD-FHV",
    market: "Europe",
    displayName: "Lexus IS220d · XE20",
    shortName: "IS220d"
  },
  evidencePolicy: {
    publishMinimum: "vehicle-verified",
    unknownValuesRemainRaw: true,
    researchCandidatesEnabledForLiveData: false
  },
  writable: false,
  buses: {
    powertrainCan: {
      protocol: "ISO 15765-4 CAN",
      arbitrationBits: 11,
      bitrate: 500000,
      elmProtocol: 6
    }
  },
  ecuSurvey: {
    requestHeaders: ["7E0", "7E1", "7E2", "7E3", "7E4", "7E5", "7E6", "7E7"],
    safeProbe: "0100",
    expectedResponseService: 0x41,
    writable: false
  },
  ecus: {
    engine: {
      id: "engine",
      label: "2AD-FHV moottorinohjaus",
      bus: "powertrainCan",
      requestHeader: "7E0",
      responseHeader: "7E8",
      writable: false,
      probes: engineProbes
    }
  }
});

export const IS220D_ENGINE_ECU_PROFILE = IS220D_DIAGNOSTIC_PROFILE.ecus.engine;

export const FULL_DIAGNOSTIC_ENGINE_HEADERS = IS220D_DIAGNOSTIC_PROFILE.ecuSurvey.requestHeaders;

export const TOYOTA_READ_DATA_PROBES = Object.freeze(
  IS220D_ENGINE_ECU_PROFILE.probes.map(probe => Object.freeze({
    ...probe,
    requestHeader: IS220D_ENGINE_ECU_PROFILE.requestHeader,
    responseHeader: IS220D_ENGINE_ECU_PROFILE.responseHeader
  }))
);

export const IS220D_INJECTOR_SCREENING_PROBES = deepFreeze(
  injectorScreeningProbes.map(probe => ({
    ...probe,
    requestHeader: IS220D_ENGINE_ECU_PROFILE.requestHeader,
    responseHeader: IS220D_ENGINE_ECU_PROFILE.responseHeader
  }))
);

export const IS220D_FIELD_DISABLED_COMMANDS = Object.freeze([
  "219C",
  "02219C0000000000"
]);

export const TOYOTA_READ_DATA_ALLOWED_COMMANDS = Object.freeze(
  [...TOYOTA_READ_DATA_PROBES, ...IS220D_INJECTOR_SCREENING_PROBES]
    .flatMap(probe => [probe.command, probe.rawCommand])
    .filter(command => !IS220D_FIELD_DISABLED_COMMANDS.includes(command))
);

export function validateDiagnosticProfile(profile = IS220D_DIAGNOSTIC_PROFILE) {
  const errors = [];
  const metricIds = new Set();
  const commandIds = new Set();
  const add = (path, message) => errors.push(`${path}: ${message}`);

  if (!Number.isInteger(profile?.schemaVersion) || profile.schemaVersion < 1) add("schemaVersion", "pitää olla positiivinen kokonaisluku");
  if (!String(profile?.profileVersion || "").trim()) add("profileVersion", "puuttuu");
  if (profile?.writable !== false) add("writable", "IS220d-profiilin pitää olla vain luku");
  if (profile?.evidencePolicy?.researchCandidatesEnabledForLiveData !== false) add("evidencePolicy", "tutkimuskandidaatteja ei saa julkaista live-arvoina");

  const surveyHeaders = profile?.ecuSurvey?.requestHeaders || [];
  if (!Array.isArray(surveyHeaders) || !surveyHeaders.length) add("ecuSurvey.requestHeaders", "osoitelista puuttuu");
  for (const [index, header] of surveyHeaders.entries()) {
    if (!HEADER_PATTERN.test(String(header || ""))) add(`ecuSurvey.requestHeaders[${index}]`, "virheellinen CAN-otsake");
  }

  for (const [ecuKey, ecu] of Object.entries(profile?.ecus || {})) {
    const base = `ecus.${ecuKey}`;
    if (ecu?.writable !== false) add(`${base}.writable`, "ECU-määrityksen pitää olla vain luku");
    if (!HEADER_PATTERN.test(String(ecu?.requestHeader || ""))) add(`${base}.requestHeader`, "virheellinen CAN-otsake");
    if (!HEADER_PATTERN.test(String(ecu?.responseHeader || ""))) add(`${base}.responseHeader`, "virheellinen CAN-otsake");
    if (!Array.isArray(ecu?.probes) || !ecu.probes.length) add(`${base}.probes`, "lukupyyntöjä ei ole määritelty");

    for (const [probeIndex, probe] of (ecu?.probes || []).entries()) {
      const path = `${base}.probes[${probeIndex}]`;
      const serviceHex = byteHex(probe?.service);
      const responseHex = byteHex(probe?.responseService);
      const identifierHex = byteHex(probe?.identifier);
      const expectedCommand = `${serviceHex}${identifierHex}`;
      const expectedRawCommand = `02${expectedCommand}0000000000`;
      if (!READ_ONLY_SERVICES.has(probe?.service)) add(`${path}.service`, "palvelu ei kuulu vain luku -sallintalistaan");
      if (probe?.writable !== false) add(`${path}.writable`, "pyynnön pitää olla vain luku");
      if (!EVIDENCE_LEVELS.has(probe?.evidence)) add(`${path}.evidence`, "tuntematon evidenssitaso");
      if (probe?.identifierHex !== identifierHex) add(`${path}.identifierHex`, `odotettiin ${identifierHex}`);
      if (probe?.command !== expectedCommand) add(`${path}.command`, `odotettiin ${expectedCommand}`);
      if (probe?.rawCommand !== expectedRawCommand) add(`${path}.rawCommand`, `odotettiin ${expectedRawCommand}`);
      if (probe?.expectedResponsePrefix !== `${responseHex}${identifierHex}`) add(`${path}.expectedResponsePrefix`, `odotettiin ${responseHex}${identifierHex}`);
      if (!HEX_PATTERN.test(String(probe?.command || "")) || String(probe?.command || "").length % 2) add(`${path}.command`, "komennon pitää olla parillinen HEX-jono");
      if (!Number.isInteger(probe?.minPayloadLength) || probe.minPayloadLength < 1) add(`${path}.minPayloadLength`, "pitää olla positiivinen kokonaisluku");
      if (!Number.isFinite(probe?.cacheMaxAgeMs) || probe.cacheMaxAgeMs < 0) add(`${path}.cacheMaxAgeMs`, "pitää olla nollaa suurempi tai yhtä suuri");
      if (commandIds.has(probe?.command)) add(`${path}.command`, "komento on määritelty kahdesti");
      commandIds.add(probe?.command);

      for (const [fieldIndex, field] of (probe?.fields || []).entries()) {
        const fieldPath = `${path}.fields[${fieldIndex}]`;
        if (!String(field?.id || "").trim()) add(`${fieldPath}.id`, "puuttuu");
        if (metricIds.has(field?.id)) add(`${fieldPath}.id`, "mittaritunnus on määritelty kahdesti");
        metricIds.add(field?.id);
        if (field?.writable !== false) add(`${fieldPath}.writable`, "kentän pitää olla vain luku");
        if (!EVIDENCE_LEVELS.has(field?.evidence)) add(`${fieldPath}.evidence`, "tuntematon evidenssitaso");
        if (!Array.isArray(field?.plausibleRange) || field.plausibleRange.length !== 2 || !field.plausibleRange.every(Number.isFinite) || field.plausibleRange[0] > field.plausibleRange[1]) {
          add(`${fieldPath}.plausibleRange`, "virheellinen min/max-alue");
        }
      }
    }
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function assertValidDiagnosticProfile(profile = IS220D_DIAGNOSTIC_PROFILE) {
  const validation = validateDiagnosticProfile(profile);
  if (!validation.valid) throw new Error(`Virheellinen IS220d-diagnostiikkaprofiili:\n${validation.errors.join("\n")}`);
  return profile;
}

export function getToyotaReadDataProbe(commandOrIdentifier) {
  const allProbes = [...TOYOTA_READ_DATA_PROBES, ...IS220D_INJECTOR_SCREENING_PROBES];
  if (Number.isInteger(commandOrIdentifier)) {
    const identifier = Number(commandOrIdentifier) & 0xff;
    return allProbes.find(probe => probe.identifier === identifier) || null;
  }
  const command = String(commandOrIdentifier || "").replace(/\s+/g, "").toUpperCase();
  return allProbes.find(probe => probe.command === command || probe.rawCommand === command) || null;
}

export function isProfileReadOnlyCommand(command) {
  const normalized = String(command || "").replace(/\s+/g, "").toUpperCase();
  return TOYOTA_READ_DATA_ALLOWED_COMMANDS.includes(normalized);
}

export function buildProfileProbeCommand(probe, queryForm = "formatted") {
  if (!probe || probe.writable !== false || !READ_ONLY_SERVICES.has(probe.service)) {
    throw new Error("Vain validoitu vain luku -profiilipyyntö voidaan rakentaa");
  }
  const command = queryForm === "raw-single-frame" ? probe.rawCommand : probe.command;
  if (!isProfileReadOnlyCommand(command)) throw new Error(`Profiilin turvallisuussallintalista esti komennon ${command || "(tyhjä)"}`);
  return command;
}

assertValidDiagnosticProfile(IS220D_DIAGNOSTIC_PROFILE);
