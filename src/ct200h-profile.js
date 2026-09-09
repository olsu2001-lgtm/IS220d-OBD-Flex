/**
 * Declarative read-only profile for Lexus CT 200h (ZWA10/A10).
 *
 * The CT uses Toyota's third-generation hybrid diagnostic layout. The
 * traction-battery ECU is addressed through 7E2 and normally answers on 7EA.
 * Every command below is a read operation. No Active Test, routine-control,
 * coding, clearing or other write command belongs to this profile.
 */

const HEADER_PATTERN = /^[0-9A-F]{3}(?:[0-9A-F]{5})?$/;
const HEX_PATTERN = /^[0-9A-F]+$/;
const READ_ONLY_SERVICES = new Set([0x0a, 0x13, 0x21]);
const EVIDENCE_LEVELS = new Set(["techstream-derived", "protocol-derived", "research-candidate"]);

const byteHex = value => (Number(value) & 0xff).toString(16).padStart(2, "0").toUpperCase();

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

const metric = (id, valueKey, label, unit, decimals, plausibleRange) => ({
  id,
  valueKey,
  label,
  unit,
  decimals,
  plausibleRange,
  evidence: "protocol-derived",
  writable: false
});

const blockVoltageFields = Array.from({ length: 14 }, (_, index) =>
  metric(
    `ctHvBlockVoltage${String(index + 1).padStart(2, "0")}`,
    `blockVoltage${String(index + 1).padStart(2, "0")}V`,
    `HV-akun lohkojännite V${String(index + 1).padStart(2, "0")}`,
    "V",
    3,
    [10, 20]
  )
);

const internalResistanceFields = Array.from({ length: 14 }, (_, index) =>
  metric(
    `ctHvInternalResistance${String(index + 1).padStart(2, "0")}`,
    `internalResistance${String(index + 1).padStart(2, "0")}Ohm`,
    `HV-akun sisäinen vastus R${String(index + 1).padStart(2, "0")}`,
    "Ω",
    3,
    [0.001, 0.255]
  )
);

const hybridProbes = [
  {
    id: "hybrid.state_of_charge",
    service: 0x21,
    responseService: 0x61,
    identifier: 0x01,
    identifierHex: "01",
    command: "2101",
    rawCommand: "0221010000000000",
    expectedResponsePrefix: "6101",
    label: "HV-akun varaustila",
    decoder: "toyota-zwa10-2101-v1",
    minPayloadLength: 22,
    cacheMaxAgeMs: 650,
    evidence: "protocol-derived",
    writable: false,
    fields: [
      metric("ctHvSoc", "stateOfChargePercent", "HV-akun varaustila", "%", 1, [0, 100])
    ]
  },
  {
    id: "hybrid.block_voltages",
    service: 0x21,
    responseService: 0x61,
    identifier: 0x81,
    identifierHex: "81",
    command: "2181",
    rawCommand: "0221810000000000",
    expectedResponsePrefix: "6181",
    label: "HV-akun 14 lohkojännitettä",
    decoder: "toyota-zwa10-2181-v1",
    minPayloadLength: 28,
    cacheMaxAgeMs: 650,
    evidence: "protocol-derived",
    writable: false,
    fields: [
      ...blockVoltageFields,
      metric("ctHvPackVoltage", "packVoltageV", "HV-akun lohkoista laskettu jännite", "V", 1, [140, 280]),
      metric("ctHvBlockMin", "blockMinimumV", "HV-akun pienin lohkojännite", "V", 3, [10, 20]),
      metric("ctHvBlockMax", "blockMaximumV", "HV-akun suurin lohkojännite", "V", 3, [10, 20]),
      metric("ctHvBlockDelta", "blockDeltaV", "HV-akun lohkojännitteiden ero", "V", 3, [0, 5]),
      metric("ctHvBlockMinIndex", "blockMinimumIndex", "Pienimmän HV-lohkon numero", "", 0, [1, 14]),
      metric("ctHvBlockMaxIndex", "blockMaximumIndex", "Suurimman HV-lohkon numero", "", 0, [1, 14])
    ]
  },
  {
    id: "hybrid.battery_temperatures",
    service: 0x21,
    responseService: 0x61,
    identifier: 0x87,
    identifierHex: "87",
    command: "2187",
    rawCommand: "0221870000000000",
    expectedResponsePrefix: "6187",
    label: "HV-akun imuilma ja lämpöanturit TB1–TB3",
    decoder: "toyota-zwa10-2187-v1",
    minPayloadLength: 8,
    cacheMaxAgeMs: 1600,
    evidence: "protocol-derived",
    writable: false,
    fields: [
      metric("ctHvIntakeTemperature", "intakeTemperatureC", "HV-akun jäähdytysilman lämpötila", "°C", 1, [-40, 100]),
      metric("ctHvTemperature1", "temperature1C", "HV-akun lämpötila TB1", "°C", 1, [-40, 100]),
      metric("ctHvTemperature2", "temperature2C", "HV-akun lämpötila TB2", "°C", 1, [-40, 100]),
      metric("ctHvTemperature3", "temperature3C", "HV-akun lämpötila TB3", "°C", 1, [-40, 100]),
      metric("ctHvTemperatureMin", "temperatureMinimumC", "HV-akun pienin lämpötila", "°C", 1, [-40, 100]),
      metric("ctHvTemperatureMax", "temperatureMaximumC", "HV-akun suurin lämpötila", "°C", 1, [-40, 100]),
      metric("ctHvTemperatureDelta", "temperatureDeltaC", "HV-akun lämpötilaero", "°C", 1, [0, 80])
    ]
  },
  {
    id: "hybrid.internal_resistance",
    service: 0x21,
    responseService: 0x61,
    identifier: 0x95,
    identifierHex: "95",
    command: "2195",
    rawCommand: "0221950000000000",
    expectedResponsePrefix: "6195",
    label: "HV-akun 14 lohkon sisäiset vastukset",
    decoder: "toyota-zwa10-2195-v1",
    minPayloadLength: 14,
    cacheMaxAgeMs: 5000,
    evidence: "protocol-derived",
    writable: false,
    fields: [
      ...internalResistanceFields,
      metric("ctHvResistanceMin", "internalResistanceMinimumOhm", "HV-akun pienin sisäinen vastus", "Ω", 3, [0.001, 0.255]),
      metric("ctHvResistanceMax", "internalResistanceMaximumOhm", "HV-akun suurin sisäinen vastus", "Ω", 3, [0.001, 0.255]),
      metric("ctHvResistanceDelta", "internalResistanceDeltaOhm", "HV-akun vastusten ero", "Ω", 3, [0, 0.254])
    ]
  },
  {
    id: "hybrid.current_and_limits",
    service: 0x21,
    responseService: 0x61,
    identifier: 0x98,
    identifierHex: "98",
    command: "2198",
    rawCommand: "0221980000000000",
    expectedResponsePrefix: "6198",
    label: "HV-akun virta, tehorajat ja SOC-hajonta",
    decoder: "toyota-zwa10-2198-v1",
    minPayloadLength: 8,
    cacheMaxAgeMs: 650,
    evidence: "protocol-derived",
    writable: false,
    fields: [
      metric("ctHvCurrent", "batteryCurrentA", "HV-akun virta (plus = purkaus)", "A", 1, [-350, 350]),
      metric("ctHvChargeLimit", "chargeControlKw", "HV-akun latauksen tehoraja", "kW", 1, [-64, 64]),
      metric("ctHvDischargeLimit", "dischargeControlKw", "HV-akun purkauksen tehoraja", "kW", 1, [-64, 64]),
      metric("ctHvDeltaSoc", "deltaSocPercent", "HV-akun SOC-hajonta", "%", 1, [0, 100]),
      metric("ctHvSocAfterIgnition", "socAfterIgnitionPercent", "HV-akun SOC virtojen kytkennän jälkeen", "%", 1, [0, 100]),
      metric("ctHvSocMax", "socMaximumPercent", "HV-akun suurin SOC", "%", 1, [0, 100]),
      metric("ctHvSocMin", "socMinimumPercent", "HV-akun pienin SOC", "%", 1, [0, 100])
    ]
  }
];

const identificationProbe = {
  id: "hybrid.model_identification",
  service: 0x21,
  responseService: 0x61,
  identifier: 0xc1,
  identifierHex: "C1",
  command: "21C1",
  rawCommand: "0221C10000000000",
  expectedResponsePrefix: "61C1",
  label: "Hybridiohjaimen malli- ja moottoritunniste",
  decoder: "toyota-zwa10-21c1-v1",
  minPayloadLength: 7,
  cacheMaxAgeMs: 60000,
  evidence: "techstream-derived",
  writable: false,
  fields: []
};

export const CT200H_DIAGNOSTIC_PROFILE = deepFreeze({
  schemaVersion: 1,
  profileVersion: "ct200h-zwa10-gen3-hybrid-readonly-v2",
  key: "ct200h",
  vehicle: {
    make: "Lexus",
    model: "CT 200h",
    platform: "ZWA10/A10",
    modelYears: "2011–2022",
    engine: "2ZR-FXE",
    powertrain: "Toyota Hybrid System · NiMH 201,6 V · 14 lohkoa / 28 moduulia",
    market: "Europe",
    displayName: "Lexus CT 200h · ZWA10",
    shortName: "CT 200h"
  },
  evidencePolicy: {
    publishMinimum: "protocol-derived",
    unknownValuesRemainRaw: true,
    researchCandidatesEnabledForLiveData: false,
    requiresVehiclePayloadValidation: true
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
  battery: {
    chemistry: "NiMH",
    nominalVoltageV: 201.6,
    moduleCount: 28,
    blockCount: 14,
    modulesPerBlock: 2
  },
  ecuSurvey: {
    requestHeaders: ["7E0", "7E1", "7E2", "7E3", "7E4", "7E5", "7E6", "7E7"],
    safeProbe: "0100",
    expectedResponseService: 0x41,
    writable: false
  },
  detection: {
    requiredModelToken: "ZWA10",
    probe: identificationProbe,
    fallbackProbe: hybridProbes.find(probe => probe.command === "2181"),
    fallbackMeansGen3HybridOnly: true,
    writable: false
  },
  ecus: {
    engine: {
      id: "engine",
      label: "2ZR-FXE moottorinohjaus",
      bus: "powertrainCan",
      requestHeader: "7E0",
      responseHeader: "7E8",
      writable: false,
      probes: []
    },
    hybrid: {
      id: "hybrid",
      label: "Hybrid Vehicle Control / Battery Smart Unit",
      bus: "powertrainCan",
      requestHeader: "7E2",
      responseHeader: "7EA",
      writable: false,
      identificationProbes: [identificationProbe],
      probes: hybridProbes,
      dtcRequests: [
        {
          id: "hybrid.permanent_dtcs",
          command: "0A",
          service: 0x0a,
          responseService: 0x4a,
          responseTag: "4A",
          label: "Hybridiohjaimen pysyvät vikakoodit",
          writable: false,
          evidence: "protocol-derived"
        },
        {
          id: "hybrid.stored_dtcs",
          command: "13B0",
          service: 0x13,
          responseService: 0x53,
          responseTag: "53",
          label: "Hybridiohjaimen tallennetut vikakoodit",
          writable: false,
          evidence: "protocol-derived"
        }
      ]
    },
    brake: {
      id: "brake",
      label: "Skid Control / Brake Booster",
      bus: "powertrainCan",
      requestHeader: "7B0",
      responseHeader: "7B8",
      writable: false,
      coverage: "research-candidate",
      validatedOnCt200h: false,
      dtcRequests: [
        {
          id: "brake.stored_dtcs_candidate",
          command: "13B0",
          service: 0x13,
          responseService: 0x53,
          responseTag: "53",
          label: "Jarru-/luistonesto-ohjaimen tallennetut vikakoodit (kokeellinen kattavuusluku)",
          writable: false,
          evidence: "research-candidate",
          validatedOnCt200h: false
        }
      ]
    }
  }
});

export const CT200H_HYBRID_ECU_PROFILE = CT200H_DIAGNOSTIC_PROFILE.ecus.hybrid;

export const CT200H_READ_DATA_PROBES = Object.freeze([
  ...CT200H_HYBRID_ECU_PROFILE.identificationProbes,
  ...CT200H_HYBRID_ECU_PROFILE.probes
].map(probe => Object.freeze({
  ...probe,
  vehicleKey: CT200H_DIAGNOSTIC_PROFILE.key,
  requestHeader: CT200H_HYBRID_ECU_PROFILE.requestHeader,
  responseHeader: CT200H_HYBRID_ECU_PROFILE.responseHeader
})));

export const CT200H_LIVE_DATA_PROBES = Object.freeze(
  CT200H_READ_DATA_PROBES.filter(probe => probe.fields.length > 0)
);

export const CT200H_DTC_REQUESTS = Object.freeze(
  Object.values(CT200H_DIAGNOSTIC_PROFILE.ecus).flatMap(ecu =>
    (ecu.dtcRequests || []).map(request => Object.freeze({
      ...request,
      vehicleKey: CT200H_DIAGNOSTIC_PROFILE.key,
      ecuId: ecu.id,
      requestHeader: ecu.requestHeader,
      responseHeader: ecu.responseHeader
    }))
  )
);

export const CT200H_READ_ONLY_ALLOWED_COMMANDS = Object.freeze([
  ...CT200H_READ_DATA_PROBES.flatMap(probe => [probe.command, probe.rawCommand]),
  ...CT200H_DTC_REQUESTS.map(request => request.command)
]);

export function getCt200hReadDataProbe(commandOrIdentifier) {
  if (Number.isInteger(commandOrIdentifier)) {
    const identifier = Number(commandOrIdentifier) & 0xff;
    return CT200H_READ_DATA_PROBES.find(probe => probe.identifier === identifier) || null;
  }
  const command = String(commandOrIdentifier || "").replace(/\s+/g, "").toUpperCase();
  return CT200H_READ_DATA_PROBES.find(probe => probe.command === command || probe.rawCommand === command) || null;
}

export function validateCt200hDiagnosticProfile(profile = CT200H_DIAGNOSTIC_PROFILE) {
  const errors = [];
  const metricIds = new Set();
  const commandIds = new Set();
  const add = (path, message) => errors.push(`${path}: ${message}`);

  if (!Number.isInteger(profile?.schemaVersion) || profile.schemaVersion < 1) add("schemaVersion", "pitää olla positiivinen kokonaisluku");
  if (profile?.key !== "ct200h") add("key", "odotettiin ct200h");
  if (profile?.writable !== false) add("writable", "CT 200h -profiilin pitää olla vain luku");
  if (profile?.battery?.blockCount !== 14 || profile?.battery?.moduleCount !== 28) add("battery", "ZWA10-profiilin pitää määrittää 14 lohkoa ja 28 moduulia");
  if (profile?.evidencePolicy?.researchCandidatesEnabledForLiveData !== false) add("evidencePolicy", "tutkimuskandidaatteja ei saa julkaista live-arvoina");

  for (const [ecuKey, ecu] of Object.entries(profile?.ecus || {})) {
    const base = `ecus.${ecuKey}`;
    if (ecu?.writable !== false) add(`${base}.writable`, "ECU-määrityksen pitää olla vain luku");
    if (!HEADER_PATTERN.test(String(ecu?.requestHeader || ""))) add(`${base}.requestHeader`, "virheellinen CAN-otsake");
    if (!HEADER_PATTERN.test(String(ecu?.responseHeader || ""))) add(`${base}.responseHeader`, "virheellinen CAN-otsake");
  }

  const probes = [
    ...(profile?.ecus?.hybrid?.identificationProbes || []),
    ...(profile?.ecus?.hybrid?.probes || [])
  ];
  for (const [probeIndex, probe] of probes.entries()) {
    const path = `ecus.hybrid.probes[${probeIndex}]`;
    const identifierHex = byteHex(probe?.identifier);
    const expectedCommand = `${byteHex(probe?.service)}${identifierHex}`;
    if (probe?.writable !== false) add(`${path}.writable`, "pyynnön pitää olla vain luku");
    if (!READ_ONLY_SERVICES.has(probe?.service)) add(`${path}.service`, "palvelu ei kuulu vain luku -sallintalistaan");
    if (!EVIDENCE_LEVELS.has(probe?.evidence)) add(`${path}.evidence`, "tuntematon evidenssitaso");
    if (probe?.command !== expectedCommand) add(`${path}.command`, `odotettiin ${expectedCommand}`);
    if (probe?.rawCommand !== `02${expectedCommand}0000000000`) add(`${path}.rawCommand`, "virheellinen ISO-TP-yksikehys");
    if (probe?.expectedResponsePrefix !== `${byteHex(probe?.responseService)}${identifierHex}`) add(`${path}.expectedResponsePrefix`, "virheellinen positiivisen vastauksen alku");
    if (!HEX_PATTERN.test(String(probe?.command || "")) || probe.command.length % 2) add(`${path}.command`, "komennon pitää olla parillinen HEX-jono");
    if (!Number.isInteger(probe?.minPayloadLength) || probe.minPayloadLength < 1) add(`${path}.minPayloadLength`, "pitää olla positiivinen kokonaisluku");
    if (commandIds.has(probe?.command)) add(`${path}.command`, "komento on määritelty kahdesti");
    commandIds.add(probe?.command);
    for (const [fieldIndex, field] of (probe?.fields || []).entries()) {
      const fieldPath = `${path}.fields[${fieldIndex}]`;
      if (metricIds.has(field?.id)) add(`${fieldPath}.id`, "mittaritunnus on määritelty kahdesti");
      metricIds.add(field?.id);
      if (field?.writable !== false) add(`${fieldPath}.writable`, "kentän pitää olla vain luku");
      if (!EVIDENCE_LEVELS.has(field?.evidence)) add(`${fieldPath}.evidence`, "tuntematon evidenssitaso");
      if (!Array.isArray(field?.plausibleRange) || field.plausibleRange.length !== 2 || !field.plausibleRange.every(Number.isFinite) || field.plausibleRange[0] > field.plausibleRange[1]) {
        add(`${fieldPath}.plausibleRange`, "virheellinen min/max-alue");
      }
    }
  }

  for (const [ecuKey, ecu] of Object.entries(profile?.ecus || {})) {
    for (const [index, request] of (ecu?.dtcRequests || []).entries()) {
      const path = `ecus.${ecuKey}.dtcRequests[${index}]`;
      if (request?.writable !== false) add(`${path}.writable`, "vikakoodipyynnön pitää olla vain luku");
      if (!READ_ONLY_SERVICES.has(request?.service)) add(`${path}.service`, "vikakoodipalvelu ei kuulu vain luku -sallintalistaan");
      if (!EVIDENCE_LEVELS.has(request?.evidence)) add(`${path}.evidence`, "tuntematon evidenssitaso");
      if (!HEX_PATTERN.test(String(request?.command || "")) || request.command.length % 2) add(`${path}.command`, "komennon pitää olla parillinen HEX-jono");
    }
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function assertValidCt200hDiagnosticProfile(profile = CT200H_DIAGNOSTIC_PROFILE) {
  const validation = validateCt200hDiagnosticProfile(profile);
  if (!validation.valid) throw new Error(`Virheellinen CT 200h -diagnostiikkaprofiili:\n${validation.errors.join("\n")}`);
  return profile;
}

assertValidCt200hDiagnosticProfile(CT200H_DIAGNOSTIC_PROFILE);
