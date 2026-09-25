import {
  classifyAdapterDevice,
  summarizeAdapterCapabilities,
  formatAdapterCapabilitySummary,
  redactBluetoothAddress
} from "./adapter-profile.js";
import {
  IS220D_DIAGNOSTIC_PROFILE,
  IS220D_ENGINE_ECU_PROFILE,
  FULL_DIAGNOSTIC_ENGINE_HEADERS,
  TOYOTA_READ_DATA_PROBES,
  IS220D_INJECTOR_SCREENING_PROBES,
  TOYOTA_READ_DATA_ALLOWED_COMMANDS,
  getToyotaReadDataProbe
} from "./is220d-profile.js";
import {
  CT200H_DIAGNOSTIC_PROFILE,
  CT200H_HYBRID_ECU_PROFILE,
  CT200H_READ_DATA_PROBES,
  CT200H_LIVE_DATA_PROBES,
  CT200H_DTC_REQUESTS,
  validateCt200hDiagnosticProfile
} from "./ct200h-profile.js";
import {
  VEHICLE_KEYS,
  VEHICLE_PROFILES,
  ALL_PROFILE_READ_ONLY_COMMANDS,
  getVehicleProfile,
  getVehicleReadDataProbes,
  getVehicleDtcRequests,
  getProfileReadDataProbe,
  isProfileReadOnlyCommand,
  metricSupportsVehicle,
  vehicleDisplayName
} from "./vehicle-profiles.js";
import {
  parseDiagnosticNegativeResponse,
  classifyDiagnosticResponse
} from "./diagnostic-response.js";

export {
  IS220D_DIAGNOSTIC_PROFILE,
  IS220D_ENGINE_ECU_PROFILE,
  FULL_DIAGNOSTIC_ENGINE_HEADERS,
  TOYOTA_READ_DATA_PROBES,
  IS220D_INJECTOR_SCREENING_PROBES,
  TOYOTA_READ_DATA_ALLOWED_COMMANDS,
  getToyotaReadDataProbe
} from "./is220d-profile.js";
export {
  CT200H_DIAGNOSTIC_PROFILE,
  CT200H_HYBRID_ECU_PROFILE,
  CT200H_READ_DATA_PROBES,
  CT200H_LIVE_DATA_PROBES,
  CT200H_DTC_REQUESTS,
  CT200H_READ_ONLY_ALLOWED_COMMANDS,
  getCt200hReadDataProbe,
  validateCt200hDiagnosticProfile
} from "./ct200h-profile.js";
export {
  VEHICLE_KEYS,
  VEHICLE_PROFILES,
  ALL_READ_DATA_PROBES,
  ALL_PROFILE_READ_ONLY_COMMANDS,
  getVehicleProfile,
  getVehicleReadDataProbes,
  getVehicleDtcRequests,
  getProfileReadDataProbe,
  isProfileReadOnlyCommand,
  metricSupportsVehicle,
  vehicleDisplayName
} from "./vehicle-profiles.js";
export {
  parseDiagnosticNegativeResponse,
  classifyDiagnosticResponse,
  diagnosticNrcDefinition
} from "./diagnostic-response.js";
export {
  ReplayElmTransport,
  ReplayTransportError,
  replayScenarioFromFixture
} from "./replay-transport.js";

export const SPP_UUID = "00001101-0000-1000-8000-00805F9B34FB";
export const QUICKLYNKS_LIVE_QUERY_HEX = "0D410C0D848005857F8182048683";
export const QUICKLYNKS_RESEARCH_INTERVAL_MS = 10000;
export const QUICKLYNKS_RESEARCH_TIMEOUT_MS = 750;
export const QUICKLYNKS_RESEARCH_INITIAL_DELAY_MS = 4000;
export const QUICKLYNKS_PRODUCTION_TIMEOUT_MS = 900;
export const QUICKLYNKS_PRODUCTION_PAUSE_MS = 60000;
export const QUICKLYNKS_OPTIONAL_STANDARD_INTERVAL_MS = 1200;
export const QUICKLYNKS_OPTIONAL_STANDARD_TIMEOUT_MS = 750;
export const QUICKLYNKS_OPTIONAL_STANDARD_RETRY_MS = 120000;

export const FULL_DIAGNOSTIC_SCRIPT_VERSION = "elm-can-readonly-v6-multivehicle";
export const QUICKLYNKS_WIDE_DIAGNOSTIC_SCRIPT_VERSION = "quicklynks-ble-readonly-v2";
export const QUICKLYNKS_WIDE_DIAGNOSTIC_ROUNDS = 3;
export const QUICKLYNKS_WIDE_DIAGNOSTIC_TIMEOUT_MS = 3000;
export const QUICKLYNKS_SUPPORT_BITMAP_TIMEOUT_MS = 3000;

export const ELM_ERROR_TOKENS = [
  "NO DATA",
  "UNABLE TO CONNECT",
  "BUS INIT: ERROR",
  "BUS INIT ERROR",
  "STOPPED",
  "CAN ERROR",
  "BUFFER FULL",
  "LV RESET"
];

const DTC_DESCRIPTIONS = {
  P0087: "Polttoainekiskon tai järjestelmän paine liian alhainen",
  P0093: "Polttoainejärjestelmässä havaittu suuri vuoto",
  P0100: "Ilmamassamittarin virtapiirin toimintahäiriö",
  P0101: "Ilmamassamittarin alue tai suorituskyky",
  P0115: "Jäähdytysnesteen lämpötila-anturin virtapiiri",
  P0190: "Polttoainekiskon paineanturin virtapiiri",
  P0191: "Polttoainekiskon paineanturin alue tai suorituskyky",
  P0299: "Ahtopaine liian alhainen",
  P0400: "Pakokaasun takaisinkierrätyksen toimintahäiriö",
  P0401: "Pakokaasun takaisinkierrätyksen virtaus liian pieni",
  P0402: "Pakokaasun takaisinkierrätyksen virtaus liian suuri",
  P0405: "EGR-anturin A signaali liian alhainen",
  P0300: "Satunnainen tai usean sylinterin sytytyskatkos",
  P0301: "Sylinterin 1 sytytyskatkos",
  P0302: "Sylinterin 2 sytytyskatkos",
  P0303: "Sylinterin 3 sytytyskatkos",
  P0304: "Sylinterin 4 sytytyskatkos",
  P0A80: "Vaihda hybridiakun kokonaisuus – varmista ensin lohkojännitteet ja vikakoodin INF-lisäkoodi",
  P3000: "Hybridijärjestelmän akun ohjaus ilmoittaa viasta – lue myös muut hybridiohjaimet",
  P2002: "Hiukkassuodattimen tehokkuus alle raja-arvon",
  P2463: "Hiukkassuodattimeen kertynyt liikaa nokea",
  C1252: "Jarrutehostimen pumpun moottorin käyntiaika poikkeava",
  C1253: "Jarrutehostimen pumpun moottorin rele-/virtapiiri",
  C1256: "Jarrutehostimen paineakun paine liian alhainen",
  C1391: "Jarrutehostimen paineakun painevuoto"
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const hexByte = value => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0").toUpperCase();
const hexWord = value => {
  const n = clamp(Math.round(value), 0, 65535);
  return `${hexByte(n >> 8)}${hexByte(n & 0xff)}`;
};

export function createDiagnosticReportId(kind = "DIAG", timestamp = Date.now(), randomValue = Math.random()) {
  const prefix = String(kind || "DIAG").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 4) || "DIAG";
  const date = new Date(Number(timestamp) || Date.now()).toISOString().replace(/[-:.TZ]/g, "").slice(0, 17);
  const random = Math.floor(Math.abs(Number(randomValue) || 0) * 0x1000000)
    .toString(16)
    .toUpperCase()
    .padStart(6, "0")
    .slice(-6);
  return `${prefix}-${date}-${random}`;
}

export function cleanElmResponse(raw, command = "") {
  if (raw == null) return "";
  const normalizedCommand = String(command).replace(/\s+/g, "").toUpperCase();
  return String(raw)
    .replace(/\u0000/g, "")
    .replace(/>/g, "")
    .replace(/SEARCHING\.{0,3}/gi, "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => line.replace(/\s+/g, "").toUpperCase() !== normalizedCommand)
    .join("\n")
    .trim();
}

export function detectElmError(cleaned) {
  const text = String(cleaned || "").toUpperCase();
  if (text === "?") return "ELM327 ei tunnistanut komentoa";
  const token = ELM_ERROR_TOKENS.find(item => text.includes(item));
  if (!token) return null;
  const messages = {
    "NO DATA": "Ohjainlaite ei palauttanut tietoa",
    "UNABLE TO CONNECT": "ELM327 ei saanut yhteyttä auton ECUun",
    "BUS INIT: ERROR": "Ajoneuvoväylän alustus epäonnistui",
    "BUS INIT ERROR": "Ajoneuvoväylän alustus epäonnistui",
    "STOPPED": "Komento keskeytyi",
    "CAN ERROR": "CAN-väylävirhe",
    "BUFFER FULL": "ELM327:n puskuri täyttyi",
    "LV RESET": "Adapteri nollautui liian matalan jännitteen vuoksi"
  };
  return messages[token] || token;
}

export function hexLines(cleaned) {
  return String(cleaned || "")
    .split(/\n+/)
    .map(line => {
      const tokens = line.trim().split(/\s+/).map(token => token.replace(/[^0-9a-f]/gi, "").toUpperCase()).filter(Boolean);
      if (tokens.length > 1) {
        if ((tokens[0].length === 3 || tokens[0].length === 8) && tokens[1].length === 2) tokens.shift();
        return tokens.filter(token => token.length % 2 === 0).join("");
      }
      let compact = (tokens[0] || "").toUpperCase();
      if (compact.length % 2 === 1 && compact.length >= 5) compact = compact.slice(3);
      return compact;
    })
    .filter(line => line.length >= 2 && line.length % 2 === 0);
}

function findModePidBytes(raw, responseMode, pid) {
  const prefix = `${hexByte(responseMode)}${hexByte(pid)}`;
  for (const line of hexLines(raw)) {
    const index = line.indexOf(prefix);
    if (index < 0) continue;
    const data = line.slice(index + prefix.length);
    const bytes = [];
    for (let i = 0; i + 1 < data.length; i += 2) bytes.push(parseInt(data.slice(i, i + 2), 16));
    return bytes;
  }
  return null;
}

export function hasModePidResponse(raw, responseMode, pid) {
  return findModePidBytes(raw, responseMode, pid) !== null;
}

export function extractToyotaReadDataPayloadDetails(raw, identifier = 0x7e) {
  const expectedService = 0x61;
  const expectedIdentifier = Number(identifier) & 0xff;
  const lines = hexLines(cleanElmResponse(raw));
  const payload = [];
  let collecting = false;
  let expectedPayloadLength = null;
  let transport = "unknown";
  let expectedSequence = null;
  let sequenceError = false;

  for (const line of lines) {
    const bytes = [];
    for (let index = 0; index + 1 < line.length; index += 2) {
      bytes.push(Number.parseInt(line.slice(index, index + 2), 16));
    }
    const prefixIndex = bytes.findIndex((value, index) =>
      value === expectedService && bytes[index + 1] === expectedIdentifier
    );
    if (prefixIndex >= 0) {
      collecting = true;
      const firstByte = bytes[0];
      if ((firstByte & 0xf0) === 0x00 && prefixIndex >= 1) {
        expectedPayloadLength = Math.max(0, (firstByte & 0x0f) - 2);
        transport = "iso-tp-single-frame";
      } else if ((firstByte & 0xf0) === 0x10 && bytes.length >= 2 && prefixIndex >= 2) {
        expectedPayloadLength = Math.max(0, (((firstByte & 0x0f) << 8) | bytes[1]) - 2);
        transport = "iso-tp-multi-frame";
        expectedSequence = 1;
      } else {
        transport = "elm-formatted";
      }
      payload.push(...bytes.slice(prefixIndex + 2));
    } else if (collecting && (bytes[0] & 0xf0) === 0x20) {
      if (expectedSequence != null) {
        const observedSequence = bytes[0] & 0x0f;
        if (observedSequence !== expectedSequence) sequenceError = true;
        expectedSequence = (observedSequence + 1) & 0x0f;
      }
      payload.push(...bytes.slice(1));
    }
    if (expectedPayloadLength != null && payload.length >= expectedPayloadLength) {
      const completePayload = payload.slice(0, expectedPayloadLength);
      return Object.freeze({
        payload: Object.freeze(completePayload),
        expectedPayloadLength,
        observedPayloadLength: payload.length,
        transport,
        transportComplete: !sequenceError,
        sequenceError
      });
    }
  }

  if (!collecting) return null;
  return Object.freeze({
    payload: Object.freeze([...payload]),
    expectedPayloadLength,
    observedPayloadLength: payload.length,
    transport,
    transportComplete: expectedPayloadLength == null ? !sequenceError : payload.length >= expectedPayloadLength && !sequenceError,
    sequenceError
  });
}

export function extractToyotaReadDataPayload(raw, identifier = 0x7e) {
  const details = extractToyotaReadDataPayloadDetails(raw, identifier);
  return details ? [...details.payload] : null;
}

export function hasToyotaReadDataResponse(raw, identifier = 0x7e) {
  return extractToyotaReadDataPayload(raw, identifier) !== null;
}

export function parseToyotaNegativeResponse(raw) {
  const negative = parseDiagnosticNegativeResponse(raw, 0x21);
  return negative ? { code: negative.code, description: negative.description } : null;
}

const DPNR_STATE_NAMES = Object.freeze(["Standby", "Ready", "Operate", "Complete"]);

function ctWord(payload, offset) {
  if (!Number.isInteger(payload?.[offset]) || !Number.isInteger(payload?.[offset + 1])) return NaN;
  return payload[offset] * 256 + payload[offset + 1];
}

function printableAscii(payload, start, length) {
  return payload
    .slice(start, start + length)
    .filter(value => value >= 0x20 && value <= 0x7e)
    .map(value => String.fromCharCode(value))
    .join("")
    .trim();
}

function decodeCt200hReadData(base, payloadDetails) {
  const payload = payloadDetails.payload;
  const id = base.identifier;
  const complete = minimum => payloadDetails.transportComplete && payload.length >= minimum;

  if (id === 0xc1) {
    if (!complete(7)) return base;
    const modelCode = printableAscii(payload, 0, 7);
    const engineCode = printableAscii(payload, 7, 6);
    const destination = printableAscii(payload, 15, 1);
    return {
      ...base,
      complete: true,
      values: {
        modelCode,
        engineCode,
        destination,
        zwa10Confirmed: /ZWA10/i.test(modelCode)
      }
    };
  }

  if (id === 0x01) {
    if (!complete(22)) return base;
    return {
      ...base,
      complete: true,
      values: { stateOfChargePercent: payload[21] * 20 / 51 }
    };
  }

  if (id === 0x81) {
    if (!complete(28)) return base;
    const blockVoltages = Array.from({ length: 14 }, (_, index) =>
      ctWord(payload, index * 2) * 79.99 / 65535
    );
    const minimumV = Math.min(...blockVoltages);
    const maximumV = Math.max(...blockVoltages);
    const values = {
      packVoltageV: blockVoltages.reduce((sum, value) => sum + value, 0),
      blockMinimumV: minimumV,
      blockMaximumV: maximumV,
      blockDeltaV: maximumV - minimumV,
      blockMinimumIndex: blockVoltages.indexOf(minimumV) + 1,
      blockMaximumIndex: blockVoltages.indexOf(maximumV) + 1
    };
    blockVoltages.forEach((value, index) => {
      values[`blockVoltage${String(index + 1).padStart(2, "0")}V`] = value;
    });
    return { ...base, complete: true, values };
  }

  if (id === 0x87) {
    if (!complete(8)) return base;
    const temperatures = Array.from({ length: 4 }, (_, index) =>
      ctWord(payload, index * 2) * 255.9 / 65535 - 50
    );
    const batteryTemperatures = temperatures.slice(1);
    const minimumC = Math.min(...batteryTemperatures);
    const maximumC = Math.max(...batteryTemperatures);
    return {
      ...base,
      complete: true,
      values: {
        intakeTemperatureC: temperatures[0],
        temperature1C: temperatures[1],
        temperature2C: temperatures[2],
        temperature3C: temperatures[3],
        temperatureMinimumC: minimumC,
        temperatureMaximumC: maximumC,
        temperatureDeltaC: maximumC - minimumC
      }
    };
  }

  if (id === 0x95) {
    if (!complete(14)) return base;
    const resistances = payload.slice(0, 14).map(value => value / 1000);
    const minimumOhm = Math.min(...resistances);
    const maximumOhm = Math.max(...resistances);
    const values = {
      internalResistanceMinimumOhm: minimumOhm,
      internalResistanceMaximumOhm: maximumOhm,
      internalResistanceDeltaOhm: maximumOhm - minimumOhm
    };
    resistances.forEach((value, index) => {
      values[`internalResistance${String(index + 1).padStart(2, "0")}Ohm`] = value;
    });
    return { ...base, complete: true, values };
  }

  if (id === 0x98) {
    if (!complete(8)) return base;
    return {
      ...base,
      complete: true,
      values: {
        batteryCurrentA: ctWord(payload, 0) / 100 - 327.68,
        chargeControlKw: payload[2] / 2 - 64,
        dischargeControlKw: payload[3] / 2 - 64,
        deltaSocPercent: payload[4] / 2,
        socAfterIgnitionPercent: payload[5] / 2,
        socMaximumPercent: payload[6] / 2,
        socMinimumPercent: payload[7] / 2
      }
    };
  }

  return base;
}

export function decodeToyotaReadDataResponse(raw, identifier = 0x7e, vehicleKey = VEHICLE_KEYS.IS220D) {
  const id = Number(identifier) & 0xff;
  const payloadDetails = extractToyotaReadDataPayloadDetails(raw, id);
  if (payloadDetails == null) return null;
  const payload = payloadDetails.payload;
  const base = {
    identifier: id,
    identifierHex: hexByte(id),
    payloadHex: payload.map(hexByte).join(""),
    payloadLength: payload.length,
    expectedPayloadLength: payloadDetails.expectedPayloadLength,
    transport: payloadDetails.transport,
    transportComplete: payloadDetails.transportComplete,
    sequenceError: payloadDetails.sequenceError,
    complete: false,
    values: {},
    vehicleKey
  };

  if (vehicleKey === VEHICLE_KEYS.CT200H) return decodeCt200hReadData(base, payloadDetails);

  if (id === 0x7e) {
    if (!payloadDetails.transportComplete || payload.length < 4) return base;
    const pressureRaw = payload[0] * 256 + payload[1];
    const sulfurState = payload[2];
    const pmState = payload[3];
    return {
      ...base,
      complete: true,
      values: {
        dpnrDifferentialPressureKpa: pressureRaw * 0.0039 - 5,
        sulfurRegenerationState: sulfurState,
        sulfurRegenerationStateName: DPNR_STATE_NAMES[sulfurState] || `Unknown (${sulfurState})`,
        pmRegenerationState: pmState,
        pmRegenerationStateName: DPNR_STATE_NAMES[pmState] || `Unknown (${pmState})`,
        regenerationActive: sulfurState === 2 || pmState === 2
      }
    };
  }

  if (id === 0x7f) {
    if (!payloadDetails.transportComplete || payload.length < 4) return base;
    return {
      ...base,
      complete: true,
      values: {
        dpnrInletTemperatureC: (payload[0] * 256 + payload[1]) * 0.625,
        dpnrOutletTemperatureC: (payload[2] * 256 + payload[3]) * 0.625
      }
    };
  }

  if (id === 0x2c) {
    if (!payloadDetails.transportComplete || payload.length < 1) return base;
    return {
      ...base,
      complete: true,
      values: { egrPositionPercent: payload[0] * 100 / 255 }
    };
  }

  if (id === 0x93) {
    if (!payloadDetails.transportComplete || payload.length < 1) return base;
    return {
      ...base,
      complete: true,
      values: { fuelTemperatureC: payload[0] - 40 }
    };
  }

  if (id === 0x96) {
    if (!payloadDetails.transportComplete || payload.length < 1) return base;
    return {
      ...base,
      complete: true,
      values: { railPressureMpa: payload[0] }
    };
  }

  if (id === 0x9c) {
    if (!payloadDetails.transportComplete || payload.length < 4) return base;
    const feedback = payload.slice(0, 4).map(value => value * 10 / 64 - 10);
    return {
      ...base,
      complete: true,
      values: {
        injectionFeedback1Mm3: feedback[0],
        injectionFeedback2Mm3: feedback[1],
        injectionFeedback3Mm3: feedback[2],
        injectionFeedback4Mm3: feedback[3]
      }
    };
  }

  if (id === 0xaf) {
    if (!payloadDetails.transportComplete || payload.length < 2) return base;
    return {
      ...base,
      complete: true,
      values: { injectionTimingDegCa: (payload[0] * 256 + payload[1] - 900) / 10 }
    };
  }

  return base;
}

function formatToyotaReadDataValues(decoded) {
  if (!decoded) return "positiivinen vastaus puuttui";
  if (!decoded.complete) return `positiivinen vastaus löytyi, mutta data jäi lyhyeksi (${decoded.payloadLength} tavua)`;
  const values = decoded.values || {};
  if (decoded.identifier === 0x7e) {
    return `DPNR-paine-ero ${values.dpnrDifferentialPressureKpa.toFixed(2)} kPa; S ${values.sulfurRegenerationStateName}; PM ${values.pmRegenerationStateName}`;
  }
  if (decoded.identifier === 0x7f) {
    return `DPNR-tulolämpö ${values.dpnrInletTemperatureC.toFixed(1)} °C; lähtölämpö ${values.dpnrOutletTemperatureC.toFixed(1)} °C`;
  }
  if (decoded.identifier === 0x2c) {
    return `EGR-asento ${values.egrPositionPercent.toFixed(1)} %`;
  }
  if (decoded.identifier === 0x93) return `polttoainelämpö ${values.fuelTemperatureC.toFixed(0)} °C`;
  if (decoded.identifier === 0x96) return `rail-paine ${values.railPressureMpa.toFixed(0)} MPa`;
  if (decoded.identifier === 0x9c) {
    return `suutinkorjaukset ${[1, 2, 3, 4].map(index => values[`injectionFeedback${index}Mm3`].toFixed(2)).join(" / ")} mm³`;
  }
  if (decoded.identifier === 0xaf) return `ruiskutusajoitus ${values.injectionTimingDegCa.toFixed(1)} °CA`;
  if (decoded.vehicleKey === VEHICLE_KEYS.CT200H) {
    if (decoded.identifier === 0xc1) return `malli ${values.modelCode || "ei tulkittavissa"}${values.engineCode ? `; moottori ${values.engineCode}` : ""}`;
    if (decoded.identifier === 0x01) return `HV SOC ${values.stateOfChargePercent.toFixed(1)} %`;
    if (decoded.identifier === 0x81) return `14 lohkoa; ${values.blockMinimumV.toFixed(3)}–${values.blockMaximumV.toFixed(3)} V; ero ${values.blockDeltaV.toFixed(3)} V; yhteensä ${values.packVoltageV.toFixed(1)} V`;
    if (decoded.identifier === 0x87) return `TB1–TB3 ${values.temperature1C.toFixed(1)} / ${values.temperature2C.toFixed(1)} / ${values.temperature3C.toFixed(1)} °C`;
    if (decoded.identifier === 0x95) return `R01–R14 ${values.internalResistanceMinimumOhm.toFixed(3)}–${values.internalResistanceMaximumOhm.toFixed(3)} Ω`;
    if (decoded.identifier === 0x98) return `HV-virta ${values.batteryCurrentA.toFixed(1)} A; SOC-hajonta ${values.deltaSocPercent.toFixed(1)} %`;
  }
  return `positiivinen 61 ${decoded.identifierHex} -vastaus löytyi`;
}

export function decodeDtcBytes(a, b) {
  if ((a | b) === 0) return null;
  const system = ["P", "C", "B", "U"][(a & 0xc0) >> 6];
  const first = (a & 0x30) >> 4;
  return `${system}${first}${(a & 0x0f).toString(16).toUpperCase()}${b.toString(16).padStart(2, "0").toUpperCase()}`;
}

export function parseDtcResponse(raw, responseMode) {
  const header = hexByte(responseMode);
  const codes = [];
  const seen = new Set();
  for (const line of hexLines(raw)) {
    const start = line.indexOf(header);
    if (start < 0) continue;
    const payload = line.slice(start + 2);
    for (let i = 0; i + 3 < payload.length; i += 4) {
      const code = decodeDtcBytes(parseInt(payload.slice(i, i + 2), 16), parseInt(payload.slice(i + 2, i + 4), 16));
      if (code && !seen.has(code)) {
        seen.add(code);
        codes.push({ code, description: DTC_DESCRIPTIONS[code] || "Yleinen EOBD-vikakoodi – tarkka diagnoosi vaatii lisätutkimusta" });
      }
    }
  }
  return codes;
}

export function parseCountedDtcResponse(raw, responseMode, source = "Hybridiohjain") {
  const service = Number(responseMode) & 0xff;
  const lines = hexLines(cleanElmResponse(raw));
  let payload = [];
  let collecting = false;
  let expectedLength = null;

  for (const line of lines) {
    const bytes = line.match(/../g)?.map(value => Number.parseInt(value, 16)) || [];
    const serviceIndex = bytes.indexOf(service);
    if (serviceIndex >= 0) {
      collecting = true;
      payload.push(...bytes.slice(serviceIndex + 1));
      if (payload.length) expectedLength = 1 + payload[0] * 2;
    } else if (collecting && (bytes[0] & 0xf0) === 0x20) {
      payload.push(...bytes.slice(1));
    }
    if (expectedLength != null && payload.length >= expectedLength) break;
  }

  if (!payload.length) return [];
  const count = Math.min(payload[0], Math.floor((payload.length - 1) / 2));
  const codes = [];
  const seen = new Set();
  for (let index = 0; index < count; index++) {
    const code = decodeDtcBytes(payload[1 + index * 2], payload[2 + index * 2]);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    codes.push({
      code,
      description: DTC_DESCRIPTIONS[code] || "Lexus-hybridijärjestelmän vikakoodi – tarkka diagnoosi vaatii korjausohjeen ja mahdollisen INF-lisäkoodin",
      source
    });
  }
  return codes;
}

export function parseMilStatus(raw) {
  const bytes = findModePidBytes(raw, 0x41, 0x01);
  if (!bytes?.length) return null;
  return { milOn: Boolean(bytes[0] & 0x80), count: bytes[0] & 0x7f };
}

const byteAt = (bytes, offset = 0) => Number.isInteger(bytes?.[offset]) ? bytes[offset] : NaN;
const wordAt = (bytes, offset = 0) => {
  const high = byteAt(bytes, offset);
  const low = byteAt(bytes, offset + 1);
  return Number.isFinite(high) && Number.isFinite(low) ? high * 256 + low : NaN;
};

const decoders = {
  percentA: bytes => byteAt(bytes) * 100 / 255,
  percentAt: (bytes, offset) => byteAt(bytes, offset) * 100 / 255,
  signedPercentA: bytes => (byteAt(bytes) - 128) * 100 / 128,
  signedPercentAt: (bytes, offset) => (byteAt(bytes, offset) - 128) * 100 / 128,
  tempA: bytes => byteAt(bytes) - 40,
  tempAt: (bytes, offset) => byteAt(bytes, offset) - 40,
  wideTempAt: (bytes, offset) => wordAt(bytes, offset) / 10 - 40,
  widePressureAt: (bytes, offset) => wordAt(bytes, offset) * 10,
  boostPressureAt: (bytes, offset) => wordAt(bytes, offset) / 32,
  exhaustPressureAt: (bytes, offset) => wordAt(bytes, offset) / 100,
  word: bytes => wordAt(bytes),
  wordAt
};

export const PID_DEFINITIONS = [
  { id: "load", pid: 0x04, name: "Moottorin kuormitus", short: "Kuorma", unit: "%", decimals: 0, decode: decoders.percentA },
  { id: "coolant", pid: 0x05, name: "Jäähdytysneste", short: "Neste", unit: "°C", decimals: 0, decode: decoders.tempA },
  { id: "rpm", pid: 0x0c, name: "Moottorin kierrosluku", short: "RPM", unit: "rpm", decimals: 0, decode: bytes => decoders.word(bytes) / 4 },
  { id: "speed", pid: 0x0d, name: "Ajonopeus", short: "Nopeus", unit: "km/h", decimals: 0, decode: bytes => bytes[0] },
  { id: "adapterVoltage", pid: null, name: "Adapterin käyttöjännite (Quicklynks)", short: "Adapterijännite", unit: "V", decimals: 2, adapterOnly: true },
  { id: "quicklynksField80", pid: null, name: "Quicklynks-kenttä 80 (tulkinta avoin)", short: "QL 80", unit: "", decimals: 1, adapterOnly: true },
  { id: "quicklynksTripDistance", pid: null, name: "Quicklynks-ajomatka", short: "QL matka", unit: "km", decimals: 0, adapterOnly: true },
  { id: "quicklynksRuntime", pid: null, name: "Quicklynks-käyntiaika", short: "QL käyntiaika", unit: "s", decimals: 0, adapterOnly: true },
  { id: "map", pid: 0x0b, name: "Imusarjapaine (MAP)", short: "MAP", unit: "kPa abs", decimals: 0, decode: bytes => bytes[0] },
  { id: "intakeTemp", pid: 0x0f, name: "Imuilman lämpötila", short: "Imuilma", unit: "°C", decimals: 0, decode: decoders.tempA },
  { id: "maf", pid: 0x10, name: "Ilmamassa (MAF)", short: "MAF", unit: "g/s", decimals: 2, decode: bytes => decoders.word(bytes) / 100 },
  { id: "throttle", pid: 0x11, name: "Kaasuläpän asento", short: "Kaasuläppä", unit: "%", decimals: 0, decode: decoders.percentA },
  { id: "runtime", pid: 0x1f, name: "Moottorin käyntiaika", short: "Käyntiaika", unit: "s", decimals: 0, decode: decoders.word },
  { id: "distanceMil", pid: 0x21, name: "Matka MIL-valon jälkeen", short: "MIL-matka", unit: "km", decimals: 0, decode: decoders.word },
  { id: "railPressure", pid: 0x23, name: "Polttoainekiskon paine", short: "Rail", unit: "kPa", decimals: 0, decode: bytes => decoders.word(bytes) * 10 },
  { id: "lambdaB1S1", pid: 0x24, name: "Lambda B1S1", short: "Lambda", unit: "lambda", decimals: 3, standardAdvanced: true, quicklynksOptional: true, decode: bytes => wordAt(bytes, 0) * 2 / 65535 },
  { id: "commandedEgr", pid: 0x2c, name: "Pyydetty EGR", short: "EGR pyyntö", unit: "%", decimals: 0, quicklynksOptional: true, decode: decoders.percentA },
  { id: "egrError", pid: 0x2d, name: "EGR-poikkeama", short: "EGR virhe", unit: "%", decimals: 0, quicklynksOptional: true, decode: decoders.signedPercentA },
  { id: "distanceClear", pid: 0x31, name: "Matka koodien nollauksesta", short: "Nollauksesta", unit: "km", decimals: 0, decode: decoders.word },
  { id: "barometricPressure", pid: 0x33, name: "Ilmanpaine", short: "Ilmanpaine", unit: "kPa abs", decimals: 0, decode: bytes => bytes[0] },
  { id: "boostPressure", pid: null, name: "Ahtopaine (johdettu)", short: "Ahtopaine", unit: "kPa", decimals: 0, derived: true },
  { id: "voltage", pid: 0x42, name: "Ohjainlaitteen jännite", short: "ECU-jännite", unit: "V", decimals: 3, decode: bytes => decoders.word(bytes) / 1000 },
  { id: "pedal", pid: 0x49, name: "Kaasupolkimen asento D", short: "Kaasupoljin D", unit: "%", decimals: 0, decode: decoders.percentA },
  { id: "pedalE", pid: 0x4a, name: "Kaasupolkimen asento E", short: "Kaasupoljin E", unit: "%", decimals: 0, decode: decoders.percentA },
  { id: "commandedThrottle", pid: 0x4c, name: "Pyydetty kaasuläppätoimilaite", short: "Kaasuläppäpyyntö", unit: "%", decimals: 0, decode: decoders.percentA },
  { id: "milOn", pid: 0x01, name: "Moottorin vikavalo (MIL)", short: "MIL", unit: "", decimals: 0, format: "onOff", decode: bytes => (bytes[0] & 0x80 ? 1 : 0) },
  { id: "dtcCount", pid: 0x01, name: "ECU:n ilmoittama vikakoodimäärä", short: "DTC-määrä", unit: "kpl", decimals: 0, decode: bytes => bytes[0] & 0x7f },
  { id: "fuelRate", pid: 0x5e, name: "Polttoainevirta", short: "Polttoaine", unit: "l/h", decimals: 1, decode: bytes => decoders.word(bytes) / 20 },
  { id: "oilTemp", pid: 0x5c, name: "Moottoriöljyn lämpötila", short: "Öljy", unit: "°C", decimals: 0, decode: decoders.tempA },
  { id: "injectionTiming", pid: 0x5d, name: "Ruiskutusajoitus", short: "Ruiskutusajoitus", unit: "°", decimals: 2, standardAdvanced: true, quicklynksOptional: true, decode: bytes => wordAt(bytes, 0) / 128 - 210 },
  { id: "egrPositionTarget", pid: 0x69, name: "EGR A tavoite", short: "EGR tavoite", unit: "%", decimals: 1, standardAdvanced: true, quicklynksOptional: true, decode: bytes => decoders.percentAt(bytes, 1) },
  { id: "egrPositionActual", pid: 0x69, name: "EGR A toteutunut", short: "EGR toteutunut", unit: "%", decimals: 1, standardAdvanced: true, quicklynksOptional: true, decode: bytes => decoders.percentAt(bytes, 2) },
  { id: "egrPositionError", pid: 0x69, name: "EGR A poikkeama", short: "EGR poikkeama", unit: "%", decimals: 1, standardAdvanced: true, quicklynksOptional: true, decode: bytes => decoders.signedPercentAt(bytes, 3) },
  { id: "railPressureTarget", pid: 0x6d, name: "Rail-paineen tavoite A", short: "Rail tavoite", unit: "kPa", decimals: 0, standardAdvanced: true, quicklynksOptional: true, decode: bytes => decoders.widePressureAt(bytes, 1) },
  { id: "railPressureActual", pid: 0x6d, name: "Rail-paineen toteuma A", short: "Rail toteuma", unit: "kPa", decimals: 0, standardAdvanced: true, quicklynksOptional: true, decode: bytes => decoders.widePressureAt(bytes, 3) },
  { id: "fuelRailTemperature", pid: 0x6d, name: "Polttoaineen lämpötila A", short: "Polttoainelämpö", unit: "°C", decimals: 0, standardAdvanced: true, quicklynksOptional: true, decode: bytes => decoders.tempAt(bytes, 5) },
  { id: "boostPressureTarget", pid: 0x70, name: "Ahtopaineen tavoite A", short: "Ahto tavoite", unit: "kPa", decimals: 1, standardAdvanced: true, quicklynksOptional: true, decode: bytes => decoders.boostPressureAt(bytes, 1) },
  { id: "boostPressureActual", pid: 0x70, name: "Ahtopaineen toteuma A", short: "Ahto toteuma", unit: "kPa", decimals: 1, standardAdvanced: true, quicklynksOptional: true, decode: bytes => decoders.boostPressureAt(bytes, 3) },
  { id: "vgtPositionTarget", pid: 0x71, name: "VGT-asennon tavoite A", short: "VGT tavoite", unit: "%", decimals: 1, standardAdvanced: true, quicklynksOptional: true, decode: bytes => decoders.percentAt(bytes, 1) },
  { id: "vgtPositionActual", pid: 0x71, name: "VGT-asennon toteuma A", short: "VGT toteuma", unit: "%", decimals: 1, standardAdvanced: true, quicklynksOptional: true, decode: bytes => decoders.percentAt(bytes, 2) },
  { id: "exhaustPressureB1", pid: 0x73, name: "Pakopaine B1", short: "Pakopaine", unit: "kPa", decimals: 2, standardAdvanced: true, quicklynksOptional: true, decode: bytes => decoders.exhaustPressureAt(bytes, 1) },
  { id: "catalystTemperatureB1S1", pid: 0x3c, name: "Katalysaattorin lämpö B1S1", short: "Kat lämpö 1", unit: "°C", decimals: 1, standardAdvanced: true, quicklynksOptional: true, decode: bytes => decoders.wideTempAt(bytes, 0) },
  { id: "catalystTemperatureB1S2", pid: 0x3e, name: "Katalysaattorin lämpö B1S2", short: "Kat lämpö 2", unit: "°C", decimals: 1, standardAdvanced: true, quicklynksOptional: true, decode: bytes => decoders.wideTempAt(bytes, 0) },
  { id: "exhaustTemperatureB1S1", pid: 0x78, name: "Pakokaasulämpö B1S1", short: "EGT 1", unit: "°C", decimals: 1, standardAdvanced: true, quicklynksOptional: true, decode: bytes => decoders.wideTempAt(bytes, 1) },
  { id: "exhaustTemperatureB1S2", pid: 0x78, name: "Pakokaasulämpö B1S2", short: "EGT 2", unit: "°C", decimals: 1, standardAdvanced: true, quicklynksOptional: true, decode: bytes => decoders.wideTempAt(bytes, 3) },
  { id: "exhaustTemperatureB1S3", pid: 0x78, name: "Pakokaasulämpö B1S3", short: "EGT 3", unit: "°C", decimals: 1, standardAdvanced: true, quicklynksOptional: true, decode: bytes => decoders.wideTempAt(bytes, 5) },
  { id: "exhaustTemperatureB1S4", pid: 0x78, name: "Pakokaasulämpö B1S4", short: "EGT 4", unit: "°C", decimals: 1, standardAdvanced: true, quicklynksOptional: true, decode: bytes => decoders.wideTempAt(bytes, 7) },
  { id: "dpfDifferentialPressure", pid: 0x7a, name: "DPF-paine-ero B1", short: "DPF paine-ero", unit: "kPa", decimals: 2, standardAdvanced: true, quicklynksOptional: true, decode: bytes => decoders.exhaustPressureAt(bytes, 1) },
  { id: "dpfInletPressure", pid: 0x7a, name: "DPF-tulopaine B1", short: "DPF tulopaine", unit: "kPa", decimals: 2, standardAdvanced: true, quicklynksOptional: true, decode: bytes => decoders.exhaustPressureAt(bytes, 3) },
  { id: "dpfOutletPressure", pid: 0x7a, name: "DPF-lähtöpaine B1", short: "DPF lähtöpaine", unit: "kPa", decimals: 2, standardAdvanced: true, quicklynksOptional: true, decode: bytes => decoders.exhaustPressureAt(bytes, 5) },
  { id: "dpfInletTemperature", pid: 0x7c, name: "DPF-tulolämpö B1", short: "DPF tulo °C", unit: "°C", decimals: 1, standardAdvanced: true, quicklynksOptional: true, decode: bytes => decoders.wideTempAt(bytes, 1) },
  { id: "dpfOutletTemperature", pid: 0x7c, name: "DPF-lähtölämpö B1", short: "DPF lähtö °C", unit: "°C", decimals: 1, standardAdvanced: true, quicklynksOptional: true, decode: bytes => decoders.wideTempAt(bytes, 3) },
  { id: "particulateMassConcentration", pid: 0x86, name: "Hiukkasmassapitoisuus B1", short: "PM-pitoisuus", unit: "mg/m³", decimals: 2, standardAdvanced: true, decode: bytes => wordAt(bytes, 1) / 80 },
  { id: "dpfRegenerationActive", pid: 0x8b, name: "DPF-regenerointi käynnissä", short: "DPF-poltto", unit: "", decimals: 0, format: "onOff", standardAdvanced: true, quicklynksOptional: true, decode: bytes => (byteAt(bytes, 1) & 0x03) ? 1 : 0 },
  { id: "dpfActiveRegeneration", pid: 0x8b, name: "DPF-aktiivipoltto", short: "Aktiivipoltto", unit: "", decimals: 0, format: "onOff", standardAdvanced: true, quicklynksOptional: true, decode: bytes => (byteAt(bytes, 1) & 0x02) ? 1 : 0 },
  { id: "dpfRegenerationTrigger", pid: 0x8b, name: "DPF-polttoon johtava kuormitus", short: "DPF kuormitus", unit: "%", decimals: 1, standardAdvanced: true, quicklynksOptional: true, decode: bytes => decoders.percentAt(bytes, 2) },
  { id: "dpfAverageRegenerationTime", pid: 0x8b, name: "DPF-polttojen keskimääräinen väli", short: "DPF aikaväli", unit: "h", decimals: 2, standardAdvanced: true, quicklynksOptional: true, decode: bytes => wordAt(bytes, 3) / 3600 },
  { id: "dpfAverageRegenerationDistance", pid: 0x8b, name: "DPF-polttojen keskimatka", short: "DPF matkaväli", unit: "km", decimals: 0, standardAdvanced: true, quicklynksOptional: true, decode: bytes => wordAt(bytes, 5) },
  { id: "dieselLambdaB1S1", pid: 0x8c, name: "Diesel-lambda B1S1", short: "Diesel lambda", unit: "lambda", decimals: 3, standardAdvanced: true, quicklynksOptional: true, decode: bytes => wordAt(bytes, 9) / 8192 },
  { id: "oxygenConcentrationB1S1", pid: 0x8c, name: "Happipitoisuus B1S1", short: "O₂ B1S1", unit: "%", decimals: 2, standardAdvanced: true, quicklynksOptional: true, decode: bytes => wordAt(bytes, 1) * 10 / 65536 },
  { id: "pmSensorRegenerating", pid: 0x8f, name: "PM-anturi regeneroi B1", short: "PM-anturin poltto", unit: "", decimals: 0, format: "onOff", standardAdvanced: true, quicklynksOptional: true, decode: bytes => (byteAt(bytes, 1) & 0x02) ? 1 : 0 },
  { id: "pmSensorDpfLoad", pid: 0x8f, name: "PM-anturin DPF-kuormitus B1", short: "PM DPF-kuorma", unit: "%", decimals: 2, standardAdvanced: true, quicklynksOptional: true, decode: bytes => wordAt(bytes, 2) / 100 },
  { id: "dpnrDifferentialPressure", pid: null, name: "DPNR-paine-ero (Techstream)", short: "DPNR paine-ero", unit: "kPa", decimals: 2, vehicleKey: "is220d", toyotaReadData: true, toyotaIdentifier: 0x7e, toyotaCommand: "217E", toyotaValueKey: "dpnrDifferentialPressureKpa" },
  { id: "dpnrSulfurRegenerationState", pid: null, name: "DPNR-rikkiregeneroinnin tila", short: "DPNR S-tila", unit: "", decimals: 0, format: "dpnrState", vehicleKey: "is220d", toyotaReadData: true, toyotaIdentifier: 0x7e, toyotaCommand: "217E", toyotaValueKey: "sulfurRegenerationState" },
  { id: "dpnrPmRegenerationState", pid: null, name: "DPNR-PM-regeneroinnin tila", short: "DPNR PM-tila", unit: "", decimals: 0, format: "dpnrState", vehicleKey: "is220d", toyotaReadData: true, toyotaIdentifier: 0x7e, toyotaCommand: "217E", toyotaValueKey: "pmRegenerationState" },
  { id: "dpnrRegenerationActive", pid: null, name: "DPNR-regenerointi käynnissä", short: "DPNR-poltto", unit: "", decimals: 0, format: "onOff", vehicleKey: "is220d", toyotaReadData: true, toyotaIdentifier: 0x7e, toyotaCommand: "217E", toyotaValueKey: "regenerationActive" },
  { id: "dpnrInletTemperature", pid: null, name: "Pakolämpö ennen DPNR:ää", short: "DPNR tulo °C", unit: "°C", decimals: 1, vehicleKey: "is220d", toyotaReadData: true, toyotaIdentifier: 0x7f, toyotaCommand: "217F", toyotaValueKey: "dpnrInletTemperatureC" },
  { id: "dpnrOutletTemperature", pid: null, name: "Pakolämpö DPNR:n jälkeen", short: "DPNR lähtö °C", unit: "°C", decimals: 1, vehicleKey: "is220d", toyotaReadData: true, toyotaIdentifier: 0x7f, toyotaCommand: "217F", toyotaValueKey: "dpnrOutletTemperatureC" },
  { id: "toyotaEgrPosition", pid: null, name: "EGR-venttiilin asento (Techstream)", short: "EGR TS", unit: "%", decimals: 1, vehicleKey: "is220d", toyotaReadData: true, toyotaIdentifier: 0x2c, toyotaCommand: "212C", toyotaValueKey: "egrPositionPercent" },
  { id: "toyotaFuelTemperature", pid: null, name: "Polttoaineen lämpötila (Techstream)", short: "Polttoainelämpö TS", unit: "°C", decimals: 0, vehicleKey: "is220d", toyotaReadData: true },
  { id: "toyotaRailPressure", pid: null, name: "Common rail -paine (Techstream)", short: "Rail TS", unit: "MPa", decimals: 0, vehicleKey: "is220d", toyotaReadData: true },
  { id: "injectionFeedback1", pid: null, name: "Suutinkorjaus 1 (Techstream)", short: "Suutinkorjaus 1", unit: "mm³", decimals: 2, vehicleKey: "is220d", toyotaReadData: true },
  { id: "injectionFeedback2", pid: null, name: "Suutinkorjaus 2 (Techstream)", short: "Suutinkorjaus 2", unit: "mm³", decimals: 2, vehicleKey: "is220d", toyotaReadData: true },
  { id: "injectionFeedback3", pid: null, name: "Suutinkorjaus 3 (Techstream)", short: "Suutinkorjaus 3", unit: "mm³", decimals: 2, vehicleKey: "is220d", toyotaReadData: true },
  { id: "injectionFeedback4", pid: null, name: "Suutinkorjaus 4 (Techstream)", short: "Suutinkorjaus 4", unit: "mm³", decimals: 2, vehicleKey: "is220d", toyotaReadData: true },
  { id: "toyotaInjectionTiming", pid: null, name: "Ruiskutusajoitus (Techstream)", short: "Ruiskutusajoitus TS", unit: "°CA", decimals: 1, vehicleKey: "is220d", toyotaReadData: true },
  ...CT200H_LIVE_DATA_PROBES.flatMap(probe => probe.fields.map(field => ({
    id: field.id,
    pid: null,
    name: field.label,
    short: field.label.replace(/^HV-akun\s+/i, "HV ").slice(0, 28),
    unit: field.unit,
    decimals: field.decimals,
    vehicleKey: VEHICLE_KEYS.CT200H,
    evidence: field.evidence,
    toyotaReadData: true,
    toyotaIdentifier: probe.identifier,
    toyotaCommand: probe.command,
    toyotaValueKey: field.valueKey
  }))),
  { id: "ctHvPackPower", pid: null, name: "HV-akun teho (plus = purkaus)", short: "HV teho", unit: "kW", decimals: 1, vehicleKey: VEHICLE_KEYS.CT200H, derived: true }
];

export const PID_BY_ID = Object.fromEntries(PID_DEFINITIONS.map(def => [def.id, def]));
export const TOYOTA_LIVE_METRIC_IDS = Object.freeze(
  PID_DEFINITIONS.filter(def => def.vehicleKey === VEHICLE_KEYS.IS220D && def.toyotaCommand && def.toyotaValueKey).map(def => def.id)
);
export const CT200H_LIVE_METRIC_IDS = Object.freeze(
  PID_DEFINITIONS.filter(def => def.vehicleKey === VEHICLE_KEYS.CT200H && def.toyotaCommand && def.toyotaValueKey).map(def => def.id)
);
export const PID_BY_HEX = Object.fromEntries(
  PID_DEFINITIONS.filter(def => Number.isInteger(def.pid)).map(def => [hexByte(def.pid), def])
);

function optionalStandardPid(pid, label, intervalMs, minDataLength, maxDataLength = minDataLength) {
  return Object.freeze({ pid, pidHex: hexByte(pid), label, intervalMs, minDataLength, maxDataLength });
}

export const QUICKLYNKS_OPTIONAL_STANDARD_PIDS = Object.freeze([
  optionalStandardPid(0x24, "Lambda B1S1", 5000, 4),
  optionalStandardPid(0x2c, "Pyydetty EGR", 4000, 1),
  optionalStandardPid(0x2d, "EGR-poikkeama", 4000, 1),
  optionalStandardPid(0x3c, "Katalysaattorin lämpö B1S1", 8000, 2),
  optionalStandardPid(0x3e, "Katalysaattorin lämpö B1S2", 8000, 2),
  optionalStandardPid(0x5d, "Ruiskutusajoitus", 4000, 2),
  optionalStandardPid(0x69, "EGR A tavoite/toteuma", 4000, 4, 7),
  optionalStandardPid(0x6d, "Rail A tavoite/toteuma/lämpö", 3000, 6),
  optionalStandardPid(0x70, "Ahtopaine A tavoite/toteuma", 3000, 5),
  optionalStandardPid(0x71, "VGT A tavoite/toteuma", 4000, 3, 7),
  optionalStandardPid(0x73, "Pakopaine B1", 5000, 3, 5),
  optionalStandardPid(0x78, "Pakokaasulämpötilat B1", 5000, 3, 9),
  optionalStandardPid(0x7a, "DPF-paineet B1", 5000, 3, 7),
  optionalStandardPid(0x7c, "DPF-lämpötilat B1", 5000, 3, 5),
  optionalStandardPid(0x8b, "DPF-regeneroinnin tila", 5000, 7),
  optionalStandardPid(0x8c, "Diesel-lambda ja happipitoisuus", 5000, 3, 17),
  optionalStandardPid(0x8f, "PM-anturin tila ja DPF-kuormitus", 15000, 4)
]);

const QUICKLYNKS_OPTIONAL_STANDARD_PID_BY_ID = new Map(
  QUICKLYNKS_OPTIONAL_STANDARD_PIDS.map(item => [item.pid, item])
);
const QUICKLYNKS_OPTIONAL_DEFINITIONS_BY_PID = new Map(
  QUICKLYNKS_OPTIONAL_STANDARD_PIDS.map(item => [
    item.pid,
    PID_DEFINITIONS.filter(def => def.pid === item.pid && def.quicklynksOptional)
  ])
);

export function buildQuicklynksOptionalStandardQuery(pidOrConfig) {
  const pid = typeof pidOrConfig === "object" ? Number(pidOrConfig?.pid) : Number(pidOrConfig);
  const config = QUICKLYNKS_OPTIONAL_STANDARD_PID_BY_ID.get(pid);
  if (!config) throw new Error(`Quicklynksin valinnainen standardi-PID ei kuulu sallittuun listaan: ${pidOrConfig}`);
  return `0241${config.pidHex}`;
}

export function parseQuicklynksOptionalStandardResponse(pidOrConfig, raw) {
  const pid = typeof pidOrConfig === "object" ? Number(pidOrConfig?.pid) : Number(pidOrConfig);
  const config = QUICKLYNKS_OPTIONAL_STANDARD_PID_BY_ID.get(pid);
  if (!config) throw new Error(`Tuntematon Quicklynksin valinnainen standardi-PID: ${pidOrConfig}`);
  const definitions = QUICKLYNKS_OPTIONAL_DEFINITIONS_BY_PID.get(pid) || [];
  const events = [];
  const buffer = new QuicklynksFrameBuffer(event => events.push(event));
  const frames = buffer.push(String(raw || ""));
  const requestHex = buildQuicklynksOptionalStandardQuery(config);
  const frame = frames.find(candidate => {
    const dataLength = candidate.length - 2;
    const isEmptySentinel = dataLength === 1 && candidate[2] === 0x00;
    return candidate[1] === 0x41 &&
      candidate[0] !== 0x13 &&
      dataLength >= config.minDataLength &&
      dataLength <= config.maxDataLength &&
      !isEmptySentinel &&
      bytesToHex(candidate) !== requestHex;
  });
  if (!frame) {
    const invalid = events.find(event => event.type === "invalid");
    throw new Error(invalid?.message || `Quicklynks ei palauttanut PIDille ${config.pidHex} hyväksyttävää lyhyttä 41-payload-kehystä`);
  }
  const data = frame.slice(2);
  const values = {};
  for (const definition of definitions) {
    let value = NaN;
    try {
      value = definition.decode(data);
    } catch {}
    if (Number.isFinite(value)) values[definition.id] = value;
  }
  if (!Object.keys(values).length) {
    throw new Error(`Quicklynksin 41 ${config.pidHex} -vastauksessa ei ollut riittävää standardihyötydataa`);
  }
  return {
    pid,
    pidHex: config.pidHex,
    label: config.label,
    rawHex: bytesToHex(frame),
    dataHex: bytesToHex(data),
    pendingHex: buffer.pendingHex(),
    values
  };
}

function productionField(identifier, byteLength, targets, decode = null) {
  return Object.freeze({
    identifier,
    identifierHex: hexByte(identifier),
    byteLength,
    targets: Array.isArray(targets) ? targets : [targets],
    decode
  });
}

export const QUICKLYNKS_PRODUCTION_GROUPS = Object.freeze([
  Object.freeze({
    id: "fast",
    intervalMs: 2000,
    fields: Object.freeze([
      productionField(0x0b, 1, "map"),
      productionField(0x10, 2, "maf"),
      productionField(0x23, 2, "railPressure"),
      productionField(0x49, 1, "pedal"),
      productionField(0x4a, 1, "pedalE"),
      productionField(0x4c, 1, "commandedThrottle")
    ])
  }),
  Object.freeze({
    id: "slow",
    intervalMs: 15000,
    fields: Object.freeze([
      productionField(0x01, 4, ["milOn", "dtcCount"], bytes => ({
        milOn: bytes[0] & 0x80 ? 1 : 0,
        dtcCount: bytes[0] & 0x7f
      })),
      productionField(0x0f, 1, "intakeTemp"),
      productionField(0x1f, 2, "runtime"),
      productionField(0x31, 2, "distanceClear"),
      productionField(0x33, 1, "barometricPressure"),
      productionField(0x42, 2, "voltage")
    ])
  })
]);

const QUICKLYNKS_PRODUCTION_GROUP_BY_ID = new Map(
  QUICKLYNKS_PRODUCTION_GROUPS.map(group => [group.id, group])
);
const QUICKLYNKS_PRODUCTION_GROUP_BY_METRIC = new Map(
  QUICKLYNKS_PRODUCTION_GROUPS.flatMap(group =>
    group.fields.flatMap(field => field.targets.map(target => [target, group]))
  )
);

function resolveQuicklynksProductionGroup(groupOrId) {
  const id = typeof groupOrId === "object" ? groupOrId?.id : String(groupOrId || "");
  const group = QUICKLYNKS_PRODUCTION_GROUP_BY_ID.get(id);
  if (!group) throw new Error(`Tuntematon Quicklynks-tuotantoryhmä: ${id || "(tyhjä)"}`);
  return group;
}

export function buildQuicklynksProductionQuery(groupOrId) {
  const group = resolveQuicklynksProductionGroup(groupOrId);
  return `${hexByte(1 + group.fields.length)}41${group.fields.map(field => field.identifierHex).join("")}`;
}

export function parseQuicklynksProductionResponse(groupOrId, raw) {
  const group = resolveQuicklynksProductionGroup(groupOrId);
  const events = [];
  const buffer = new QuicklynksFrameBuffer(event => events.push(event));
  const frames = buffer.push(String(raw || ""));
  const frame = frames.find(candidate => candidate[1] === 0x41);
  if (!frame) {
    const invalid = events.find(event => event.type === "invalid");
    throw new Error(invalid?.message || "Quicklynks-tuotantoryhmä ei palauttanut täydellistä 41-kehystä");
  }

  const payload = frame.slice(2);
  const expectedLength = group.fields.reduce((sum, field) => sum + field.byteLength, 0);
  if (payload.length !== expectedLength) {
    throw new Error(`Quicklynks-${group.id}-ryhmän hyötydatan pituus ${payload.length}, odotettu ${expectedLength}`);
  }

  const values = {};
  let offset = 0;
  for (const field of group.fields) {
    const bytes = payload.slice(offset, offset + field.byteLength);
    offset += field.byteLength;
    const decoded = field.decode
      ? field.decode(bytes)
      : { [field.targets[0]]: PID_BY_ID[field.targets[0]]?.decode?.(bytes) };
    for (const [id, value] of Object.entries(decoded || {})) {
      if (!field.targets.includes(id) || !Number.isFinite(value)) {
        throw new Error(`Quicklynks-${group.id}-ryhmän ${field.identifierHex}-kenttää ei voitu tulkita`);
      }
      values[id] = value;
    }
  }

  return {
    groupId: group.id,
    rawHex: bytesToHex(frame),
    payloadHex: bytesToHex(payload),
    pendingHex: buffer.pendingHex(),
    values
  };
}

export function decodePidResponse(pid, raw) {
  const def = typeof pid === "string" ? PID_BY_ID[pid] || PID_BY_HEX[pid.toUpperCase()] : PID_DEFINITIONS.find(item => item.pid === pid);
  if (!def) throw new Error(`Tuntematon PID: ${pid}`);
  if (!Number.isInteger(def.pid) || typeof def.decode !== "function") return null;
  const bytes = findModePidBytes(raw, 0x41, def.pid);
  if (!bytes) return null;
  try {
    const value = def.decode(bytes);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function parseSupportedPids(raw, rangeStart = 0x00) {
  const bytes = findModePidBytes(raw, 0x41, rangeStart);
  if (!bytes || bytes.length < 4) return new Set();
  const supported = new Set();
  for (let bit = 0; bit < 32; bit++) {
    if (bytes[Math.floor(bit / 8)] & (1 << (7 - (bit % 8)))) supported.add(rangeStart + bit + 1);
  }
  return supported;
}

export function isSafeTerminalCommand(command) {
  const normalized = String(command || "").replace(/\s+/g, "").toUpperCase();
  if (/^AT[A-Z0-9@]*$/.test(normalized)) return true;
  if (ALL_PROFILE_READ_ONLY_COMMANDS.includes(normalized)) return true;
  return /^(01|02|03|07|09|0A)[0-9A-F]*$/.test(normalized);
}

function diagnosticRawText(value, limit = 12000) {
  const raw = String(value || "");
  if (raw.length <= limit) return { text: raw, originalLength: raw.length, truncated: false };
  return {
    text: `${raw.slice(0, limit)}\n[... ${raw.length - limit} merkkiä rajattu raportista ...]`,
    originalLength: raw.length,
    truncated: true
  };
}

function diagnosticEscaped(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
}

function diagnosticTsv(value) {
  const text = String(value ?? "");
  return /[\t\r\n"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function evaluateFullDiagnosticStep(step, raw = "", error = "") {
  const command = String(step?.command || "").replace(/\s+/g, "").toUpperCase();
  const cleaned = cleanElmResponse(raw, command);
  const expected = step?.expected || "optional";
  const errorText = String(error || "");
  const inferredService = Number.isInteger(step?.requestService)
    ? step.requestService
    : expected === "toyota217e" || expected === "toyotaReadData"
      ? 0x21
      : /^(01|02|03|07|09|0A)/.test(command)
        ? Number.parseInt(command.slice(0, 2), 16)
        : null;
  const diagnosticOutcome = classifyDiagnosticResponse({
    raw,
    error: errorText,
    expectedService: inferredService,
    positivePrefix: step?.positivePrefix || ""
  });
  const timeout = diagnosticOutcome.kind === "timeout" || /aikakatka|timeout/i.test(errorText);
  const unsupported = diagnosticOutcome.kind === "adapter-unsupported" || cleaned === "?" || /ei tunnistanut komentoa/i.test(errorText);
  let status = "WARN";
  let interpretation = errorText || cleaned || "Tyhjä vastaus";
  let validResponse = false;

  if (expected === "identity") {
    validResponse = /(?:ELM|OBD|STN|SCANTOOL)/i.test(cleaned);
    status = validResponse ? "PASS" : "FAIL";
    interpretation = validResponse ? "Adapteri vastasi tunnistekyselyyn" : interpretation;
  } else if (expected === "ok") {
    validResponse = /(?:^|\n)OK(?:$|\n)/i.test(cleaned);
    status = validResponse ? "PASS" : unsupported ? "WARN" : "FAIL";
    interpretation = validResponse ? "ELM327 hyväksyi asetuksen" : interpretation;
  } else if (expected === "modePid") {
    validResponse = hasModePidResponse(raw, step.responseMode ?? 0x41, step.pid ?? 0x00);
    status = validResponse ? "PASS" : "FAIL";
    interpretation = validResponse
      ? `Kelvollinen ${hexByte(step.responseMode ?? 0x41)} ${hexByte(step.pid ?? 0x00)} -vastaus löytyi`
      : interpretation;
  } else if (expected === "toyota217e" || expected === "toyotaReadData") {
    const identifier = Number.isInteger(step?.toyotaIdentifier) ? step.toyotaIdentifier : 0x7e;
    const decodedToyota = decodeToyotaReadDataResponse(raw, identifier, step?.vehicleKey || VEHICLE_KEYS.IS220D);
    const negativeDiagnostic = diagnosticOutcome.negativeResponse || parseDiagnosticNegativeResponse(raw, 0x21);
    const negativeToyota = negativeDiagnostic
      ? { code: negativeDiagnostic.code, description: negativeDiagnostic.description }
      : null;
    validResponse = decodedToyota?.complete === true;
    status = validResponse ? "PASS" : "WARN";
    interpretation = validResponse
      ? `Kelvollinen Toyota 61 ${hexByte(identifier)} -vastaus: ${formatToyotaReadDataValues(decodedToyota)}`
      : decodedToyota
        ? `Toyota 61 ${hexByte(identifier)} -vastaus alkoi, mutta hyötykuorma jäi vajaaksi (${decodedToyota.payloadLength} tavua)`
        : negativeToyota
          ? `Toyota ECU vastasi kielteisesti 7F 21 ${negativeToyota.code}: ${negativeToyota.description}`
          : diagnosticOutcome.description || interpretation;
    if (timeout && !validResponse) status = "FAIL";
    return {
      status,
      interpretation,
      validResponse,
      timeout,
      unsupported,
      cleaned,
      decodedToyota,
      negativeToyota,
      negativeDiagnostic,
      responseClass: validResponse
        ? "positive-response"
        : decodedToyota
          ? "truncated-positive-response"
          : diagnosticOutcome.kind,
      retryable: Boolean(diagnosticOutcome.retryable)
    };
  } else if (expected === "monitor") {
    const monitorText = cleaned
      .replace(/STOPPED/gi, "")
      .replace(/[^0-9A-F\s\n]/gi, "")
      .trim();
    validResponse = /[0-9A-F]{3,8}\s+[0-9A-F]{2}/i.test(monitorText);
    status = validResponse ? "PASS" : "WARN";
    interpretation = validResponse
      ? "Passiivisessa kuuntelussa havaittiin CAN-kehyksiä"
      : "Passiivisessa kuuntelussa ei havaittu tunnistettavia CAN-kehyksiä";
  } else if (expected === "stopMonitor") {
    validResponse = /STOPPED|>/i.test(String(raw || ""));
    status = validResponse || unsupported ? "PASS" : "WARN";
    interpretation = validResponse
      ? "CAN-kuuntelu pysähtyi"
      : unsupported
        ? "Adapteri oli jo palannut komentotilaan"
        : interpretation;
  } else if (expected === "readOnly") {
    const responseMode = Number.isInteger(step?.responseMode) ? step.responseMode : null;
    validResponse = responseMode == null
      ? Boolean(cleaned && !detectElmError(cleaned) && cleaned !== "?")
      : hexLines(cleaned).some(line => line.includes(hexByte(responseMode)));
    status = validResponse ? "PASS" : "WARN";
    interpretation = validResponse ? "Lukuoperaatio palautti ECU-dataa" : interpretation;
  } else {
    validResponse = Boolean(cleaned && !detectElmError(cleaned) && cleaned !== "?");
    status = validResponse ? "PASS" : "WARN";
    if (validResponse) interpretation = "Komento palautti vastauksen";
  }

  if (step?.optional && status === "FAIL") status = "WARN";
  if (timeout && expected !== "monitor") status = "FAIL";
  return {
    status,
    interpretation,
    validResponse,
    timeout,
    unsupported,
    cleaned,
    negativeDiagnostic: diagnosticOutcome.negativeResponse,
    responseClass: validResponse ? "positive-response" : diagnosticOutcome.kind,
    retryable: Boolean(diagnosticOutcome.retryable)
  };
}

function diagnosticToyotaIdentifier(result) {
  if (Number.isInteger(result?.toyotaIdentifier)) return result.toyotaIdentifier & 0xff;
  const command = String(result?.command || "").replace(/\s+/g, "").toUpperCase();
  const probe = getProfileReadDataProbe(command, result?.vehicleKey || "");
  return probe?.identifier ?? null;
}

export function summarizeFullDiagnostic(run = {}) {
  const results = Array.isArray(run.results) ? run.results : [];
  const vehicleKey = getVehicleProfile(run?.meta?.vehicleKey) ? run.meta.vehicleKey : "";
  const diagnosticProbes = getVehicleReadDataProbes(vehicleKey);
  const adapterCapabilities = summarizeAdapterCapabilities(results, run.meta || {});
  const findCommands = command => results.filter(result => result.command === command);
  const passed = results.filter(result => result.status === "PASS").length;
  const warned = results.filter(result => result.status === "WARN").length;
  const failed = results.filter(result => result.status === "FAIL").length;
  const skipped = results.filter(result => result.status === "SKIP").length;
  const adapterResponded = findCommands("ATI").some(result => result.validResponse);
  const tryProtocol6Accepted = findCommands("ATTP6").some(result => result.status === "PASS");
  const setProtocol6Accepted = findCommands("ATSP6").some(result => result.status === "PASS");
  const protocol6Accepted = tryProtocol6Accepted || setProtocol6Accepted;
  const validObdResponses = results.filter(result => result.expected === "modePid" && result.validResponse);
  const firstWorkingResponse = validObdResponses[0] || null;
  const workingStrategy = firstWorkingResponse?.connectionStrategy || run.connectionStrategy || "";
  const currentSettingsResponded = validObdResponses.some(result => result.connectionStrategy === "current");
  const broadcastResponded = validObdResponses.some(result => result.requestHeader === "7DF");
  const directHeaders = [...new Set(validObdResponses.map(result => result.requestHeader).filter(header => header && header !== "7DF"))];
  const engineHeader = directHeaders.includes("7E0") ? "7E0" : directHeaders[0] || (broadcastResponded ? "7DF" : "");
  const monitorSawFrames = results.some(result => result.expected === "monitor" && result.validResponse);
  const toyotaProbeSummaries = diagnosticProbes.map(probe => {
    const attempts = results.filter(result =>
      (result.expected === "toyota217e" || result.expected === "toyotaReadData") &&
      diagnosticToyotaIdentifier(result) === probe.identifier
    );
    const positive = attempts.find(result => result.validResponse) || null;
    const decoded = positive?.decodedToyota || (positive ? decodeToyotaReadDataResponse(positive.raw, probe.identifier, vehicleKey) : null);
    const negativeResponses = attempts.map(result => result.negativeToyota).filter(Boolean);
    return {
      identifier: probe.identifier,
      identifierHex: probe.identifierHex,
      command: probe.command,
      label: probe.label,
      attempts: attempts.length,
      responded: Boolean(positive),
      decoded,
      queryForms: [...new Set(attempts.map(result => result.queryForm || result.connectionStrategy).filter(Boolean))],
      negativeResponses
    };
  });
  const toyotaResponded = toyotaProbeSummaries.some(item => item.responded);
  const toyotaAllResponded = toyotaProbeSummaries.every(item => item.responded);
  const toyotaResponseCount = toyotaProbeSummaries.filter(item => item.responded).length;
  const timeouts = results.filter(result => result.timeout).length;
  const unsupportedCommands = results.filter(result => result.unsupported).map(result => result.command);
  const negativeResponses = results.map(result => result.negativeDiagnostic).filter(Boolean);
  const truncatedPositiveResponses = results.filter(result => result.responseClass === "truncated-positive-response").length;
  const responseClassCounts = Object.fromEntries(
    [...new Set(results.map(result => result.responseClass).filter(Boolean))]
      .sort()
      .map(responseClass => [responseClass, results.filter(result => result.responseClass === responseClass).length])
  );
  const atcs = [...findCommands("ATCS")].reverse().find(result => result.raw)?.cleaned || "";
  const protocolDescriptions = [...new Set(findCommands("ATDP").map(result => result.cleaned).filter(Boolean))];
  const protocolNumbers = [...new Set(findCommands("ATDPN").map(result => result.cleaned).filter(Boolean))];
  const rpmResult = results.find(result => result.command === "010C" && result.validResponse);
  const rpmBytes = rpmResult ? findModePidBytes(rpmResult.raw, 0x41, 0x0c) : null;
  const observedRpm = rpmBytes?.length >= 2 ? (rpmBytes[0] * 256 + rpmBytes[1]) / 4 : null;
  const engineRunningObserved = Number.isFinite(observedRpm) ? observedRpm > 0 : null;
  const engineRunningDeclared = run.meta?.engineRunningDeclared === true
    ? true
    : run.meta?.engineRunningDeclared === false
      ? false
      : run.meta?.engineRunning === true
        ? true
        : run.meta?.engineRunning === false
          ? false
          : null;
  const engineRunning = engineRunningObserved ?? engineRunningDeclared;
  const findings = [];

  findings.push(adapterResponded
    ? "Bluetooth-kuljetus ja ELM-komentoyhteys varmistuivat ATI-vastauksella."
    : "ATI ei palauttanut tunnistettavaa adapterivastausta; vika on ennen ECU-kyselyitä.");
  if (adapterCapabilities.vlinkerDetected) {
    findings.push(`vLinker MC / MC+ tunnistettiin adapterin nimestä tai identiteettivastauksesta. ${formatAdapterCapabilitySummary(adapterCapabilities)}.`);
  }
  if (adapterCapabilities.stnSupported) {
    findings.push(`STN-yhteensopiva ydin vastasi: ${adapterCapabilities.stnIdentity || adapterCapabilities.stnDeviceId}.`);
  }
  findings.push(protocol6Accepted
    ? `Adapteri hyväksyi ISO 15765-4 CAN 11/500 -protokollakomennon (${[tryProtocol6Accepted ? "ATTP6" : "", setProtocol6Accepted ? "ATSP6" : ""].filter(Boolean).join(" ja ")}).`
    : "ATTP6- tai ATSP6-asetusta ei saatu varmennetusti hyväksytyksi.");
  if (validObdResponses.length) {
    findings.push(`Kelvollisia Mode 01 -vastauksia löytyi ${validObdResponses.length}; ECU-yhteys toimii ainakin testin osassa.`);
    findings.push(currentSettingsResponded
      ? "Ensimmäinen 41 00 -vastaus saatiin adapterin nykyisillä asetuksilla ennen ELM-nollausta."
      : `Ensimmäisen 41 00 -vastauksen yhteyspolku: ${workingStrategy || "ei yksilöity"}.`);
    if (run.searchStoppedOnFirstResponse) findings.push("Vaihtoehtoisten yhteyspolkujen haku pysäytettiin ensimmäiseen kelvolliseen 41 00 -vastaukseen.");
    if (broadcastResponded) findings.push("Yleisosoite 7DF palautti kelvollista ECU-dataa.");
    if (directHeaders.length) findings.push(`Suorista pyyntöosoitteista vastasivat: ${directHeaders.join(", ")}.`);
  } else {
    findings.push("Yhdestäkään yleis- tai suorasta Mode 01 -kyselystä ei löytynyt kelvollista 41-vastausta.");
    findings.push(monitorSawFrames
      ? "Passiivinen CAN-vastaanotto näki kehyksiä, joten vastaanottopolku toimii ainakin osittain."
      : "Passiivinen kuuntelu ei nähnyt kehyksiä; tulos ei yksin erota hiljaista DLC3-väylää adapterin CAN-vastaanotto-ongelmasta.");
  }
  for (const probe of toyotaProbeSummaries) {
    if (probe.responded) {
      findings.push(`Toyota ${probe.command} palautti 61 ${probe.identifierHex} -vastauksen: ${formatToyotaReadDataValues(probe.decoded)}.`);
    } else if (probe.attempts) {
      const negative = probe.negativeResponses[0];
      findings.push(negative
        ? `Toyota ${probe.command} tavoitti ECU:n, mutta vastaus oli 7F 21 ${negative.code}: ${negative.description}.`
        : `Toyota ${probe.command} ei palauttanut positiivista 61 ${probe.identifierHex} -vastausta ${probe.attempts} yrityksellä.`);
    }
  }
  if (atcs) findings.push(`ATCS palautti arvon "${atcs}"; se kirjataan faktana ilman kloonikohtaista virhelaskuritulkintaa.`);
  if (timeouts) findings.push(`Aikakatkaisuja tapahtui ${timeouts}; osittaiset vastaukset ovat vaihekohtaisissa tiedoissa.`);
  if (negativeResponses.length) findings.push(`ECU palautti ${negativeResponses.length} standardoitua kielteistä vastausta; NRC-palvelu, koodi ja luokka on eroteltu vaihekohtaisesti.`);
  if (truncatedPositiveResponses) findings.push(`Vajaita positiivisia ISO-TP-vastauksia havaittiin ${truncatedPositiveResponses}; niitä ei hyväksytty mittausarvoiksi.`);
  if (unsupportedCommands.length) findings.push(`Adapteri ei tunnistanut näitä valinnaisia komentoja: ${[...new Set(unsupportedCommands)].join(", ")}.`);

  return {
    passed,
    warned,
    failed,
    skipped,
    adapterResponded,
    protocol6Accepted,
    tryProtocol6Accepted,
    setProtocol6Accepted,
    currentSettingsResponded,
    workingStrategy,
    searchStoppedOnFirstResponse: Boolean(run.searchStoppedOnFirstResponse),
    validObdResponseCount: validObdResponses.length,
    broadcastResponded,
    directHeaders,
    engineHeader,
    monitorSawFrames,
    toyotaResponded,
    toyotaAllResponded,
    toyotaResponseCount,
    toyotaProbeSummaries,
    timeouts,
    negativeResponseCount: negativeResponses.length,
    truncatedPositiveResponses,
    responseClassCounts,
    unsupportedCommands: [...new Set(unsupportedCommands)],
    atcs,
    protocolDescriptions,
    protocolNumbers,
    observedRpm,
    engineRunningObserved,
    engineRunningDeclared,
    engineRunning,
    adapterCapabilities,
    findings
  };
}

export function buildFullDiagnosticReport(run = {}) {
  const results = Array.isArray(run.results) ? run.results : [];
  const summary = run.summary || summarizeFullDiagnostic(run);
  const adapterCapabilities = summary.adapterCapabilities || summarizeAdapterCapabilities(results, run.meta || {});
  const meta = run.meta || {};
  const vehicleKey = getVehicleProfile(meta.vehicleKey) ? meta.vehicleKey : "";
  const vehicleProfile = getVehicleProfile(vehicleKey);
  const diagnosticProbes = getVehicleReadDataProbes(vehicleKey);
  const durationMs = Math.max(0, Number(run.endedAt || Date.now()) - Number(run.startedAt || Date.now()));
  const lines = [
    "===== BEGIN LEXUS OBD FLEX FULL DIAGNOSTIC REPORT =====",
    "Raporttityyppi: Laaja ELM/CAN-diagnostiikka",
    `Raporttitunnus: ${meta.reportId || "ei tietoa"}`,
    `Raporttimuoto: ${FULL_DIAGNOSTIC_SCRIPT_VERSION}`,
    `Sovellus: Lexus OBD Flex ${meta.appVersion || "tuntematon"}`,
    `Ajoneuvoprofiili: ${vehicleProfile?.profileVersion || "tunnistamaton / yleinen EOBD"}`,
    `Profiilin skeema: ${vehicleProfile?.schemaVersion || "ei käytössä"}`,
    `Julkaistavan arvon vähimmäisevidenssi: ${vehicleProfile?.evidencePolicy?.publishMinimum || "ei ajoneuvokohtaista profiilia"}`,
    `Profiili vain luku: ${vehicleProfile ? (vehicleProfile.writable === false ? "kyllä" : "ei") : "ei ajoneuvokohtaista profiilia"}`,
    `Aloitus: ${new Date(run.startedAt || Date.now()).toISOString()}`,
    `Lopetus: ${new Date(run.endedAt || Date.now()).toISOString()}`,
    `Kesto_ms: ${durationMs}`,
    `Keskeytetty: ${run.cancelled ? "kyllä" : "ei"}`,
    `Ajoneuvo: ${meta.vehicle || vehicleProfile?.vehicle?.displayName || "Yleinen EOBD / tunnistamaton Lexus"}`,
    `Moottorin tila, käyttäjän ilmoitus: ${summary.engineRunningDeclared === true ? "käy" : summary.engineRunningDeclared === false ? "ei käy" : "automaattinen / ei ilmoitettu"}`,
    `Moottorin tila, kierrosluvusta havaittu: ${summary.engineRunningObserved === true ? "käy" : summary.engineRunningObserved === false ? "ei käy" : "ei voitu päätellä"}`,
    `Havaittu kierrosluku: ${Number.isFinite(summary.observedRpm) ? `${summary.observedRpm} rpm` : "ei tietoa"}`,
    `Moottori käynnissä testissä: ${summary.engineRunning === true ? "kyllä" : summary.engineRunning === false ? "ei" : "ei voitu varmistaa"}`,
    `Käyttäjän huomio: ${meta.note || "–"}`,
    `Laite: ${meta.device || "ei tietoa"}`,
    `Bluetooth-osoite: ${meta.includeSensitiveIdentifiers ? (meta.address || "ei tietoa") : redactBluetoothAddress(meta.address)}`,
    `Yhteystapa: ${meta.transport || "ei tietoa"}`,
    `Kuljetusprofiili: ${meta.transportProfile || adapterCapabilities.transportProfile || "ei tietoa"}`,
    `Adapteriperhe: ${meta.adapterFamily || adapterCapabilities.adapterFamily || "ei tietoa"}`,
    `vLinker-profiili: ${adapterCapabilities.vlinkerDetected ? (meta.adapterProfileVersion || adapterCapabilities.profileVersion) : "ei käytössä"}`,
    `Valittu protokolla ennen testiä: ${meta.selectedProtocol || "ei tietoa"}`,
    `Adapteri ennen testiä: ${meta.adapter || "ei tietoa"}`,
    `Protokolla ennen testiä: ${meta.protocol || "ei tietoa"}`,
    `Yhdistämisessä toiminut yhteyspolku: ${meta.initialConnectionStrategy || "ei tietoa"}`,
    `Selainympäristö: ${meta.userAgent || "ei tietoa"}`,
    "",
    "YHTEENVETO",
    `PASS=${summary.passed} WARN=${summary.warned} FAIL=${summary.failed} SKIP=${summary.skipped}`,
    `ELM vastasi: ${summary.adapterResponded ? "kyllä" : "ei"}`,
    `vLinker tunnistettiin: ${adapterCapabilities.vlinkerDetected ? "kyllä" : "ei"}`,
    `Adapterin ATI: ${adapterCapabilities.identity || "ei tietoa"}`,
    `STI: ${adapterCapabilities.stnIdentity || "ei tuettu / ei tietoa"}`,
    `STDI: ${adapterCapabilities.stnDeviceId || "ei tuettu / ei tietoa"}`,
    `OBD-jännite: ${adapterCapabilities.voltageText || "ei tietoa"}`,
    `Adapterin capability-probet: ${adapterCapabilities.successfulCommands.join(", ") || "ei onnistuneita"}`,
    `ATTP6 hyväksyttiin: ${summary.tryProtocol6Accepted ? "kyllä" : "ei"}`,
    `ATSP6 hyväksyttiin: ${summary.setProtocol6Accepted ? "kyllä" : "ei"}`,
    `Nykyiset asetukset vastasivat ennen nollausta: ${summary.currentSettingsResponded ? "kyllä" : "ei"}`,
    `Ensimmäisen kelvollisen vastauksen yhteyspolku: ${summary.workingStrategy || "ei löytynyt"}`,
    `Yhteyshaku pysäytettiin ensimmäiseen 41 00 -vastaukseen: ${summary.searchStoppedOnFirstResponse ? "kyllä" : "ei"}`,
    `Kelvollisia OBD-vastauksia: ${summary.validObdResponseCount}`,
    `7DF vastasi: ${summary.broadcastResponded ? "kyllä" : "ei"}`,
    `Suorat vastaavat osoitteet: ${summary.directHeaders.join(", ") || "ei löytynyt"}`,
    `Valittu palautusosoite: ${summary.engineHeader || "7DF"}`,
    `CAN-kuuntelu näki kehyksiä: ${summary.monitorSawFrames ? "kyllä" : "ei"}`,
    `Toyota Read Data -vastauksia: ${summary.toyotaResponseCount}/${diagnosticProbes.length}`,
    ...summary.toyotaProbeSummaries.map(item => `Toyota ${item.command} / 61 ${item.identifierHex} löytyi: ${item.responded ? "kyllä" : "ei / ei ajettu"}`),
    ...summary.toyotaProbeSummaries.filter(item => item.responded).map(item =>
      `Toyota ${item.command} tulkinta: ${formatToyotaReadDataValues(item.decoded)}`
    ),
    `Aikakatkaisuja: ${summary.timeouts}`,
    `Kielteisiä ECU-vastauksia: ${summary.negativeResponseCount || 0}`,
    `Vajaita positiivisia vastauksia: ${summary.truncatedPositiveResponses || 0}`,
    `Vastausluokat: ${Object.entries(summary.responseClassCounts || {}).map(([key, value]) => `${key}=${value}`).join(" ") || "ei luokiteltuja"}`,
    `ATDP-havainnot: ${summary.protocolDescriptions.join(" | ") || "ei tietoa"}`,
    `ATDPN-havainnot: ${summary.protocolNumbers.join(" | ") || "ei tietoa"}`,
    `ATCS-havainto: ${summary.atcs || "ei tietoa"}`,
    "",
    "AUTOMAATTISET HAVAINNOT",
    ...summary.findings.map((finding, index) => `${index + 1}. ${finding}`),
    "",
    "VAIHEKOHTAISET TULOKSET"
  ];

  for (const result of results) {
    const raw = diagnosticRawText(result.raw);
    lines.push(
      "",
      `#${String(result.sequence || 0).padStart(3, "0")} [${result.status || "WARN"}] ${result.phase || "Muu"} · ${result.label || result.command || "vaihe"}`,
      `Komento: ${result.command || "(sisäinen vaihe)"}`,
      `Pyyntöosoite: ${result.requestHeader || "–"}`,
      `Yhteyspolku: ${result.connectionStrategy || "–"}`,
      `Toyota-kyselymuoto: ${result.queryForm || "–"}`,
      `Profiilipyyntö: ${result.profileProbeId || "–"}`,
      `Evidenssitaso: ${result.evidence || "–"}`,
      `Dekooderi: ${result.decoder || "–"}`,
      `Toyota-tunniste: ${Number.isInteger(result.toyotaIdentifier) ? hexByte(result.toyotaIdentifier) : "–"}`,
      `Toyota-purettu-data: ${result.decodedToyota ? JSON.stringify(result.decodedToyota) : "–"}`,
      `Vastausluokka: ${result.responseClass || "–"}`,
      `NRC-palvelu: ${result.negativeDiagnostic?.serviceHex || "–"}`,
      `NRC-koodi: ${result.negativeDiagnostic?.code || "–"}`,
      `NRC-luokka: ${result.negativeDiagnostic?.category || "–"}`,
      `Uudelleenyritys mahdollinen: ${result.retryable ? "kyllä" : "ei"}`,
      `Aikakatkaisu_ms: ${result.timeoutMs ?? "–"}`,
      `Kesto_ms: ${result.durationMs ?? "–"}`,
      `Tulkinta: ${result.interpretation || "–"}`,
      `Virhe: ${result.error || "–"}`,
      `Raakavastauksen_pituus: ${raw.originalLength}${raw.truncated ? " (raportissa rajattu)" : ""}`,
      "RAW_BEGIN",
      raw.text || "(tyhjä)",
      "RAW_END"
    );
  }

  lines.push(
    "",
    "KONELUETTAVA TSV",
    ["sequence", "status", "phase", "label", "command", "request_header", "connection_strategy", "query_form", "profile_probe_id", "evidence", "decoder", "toyota_identifier", "toyota_decoded_json", "response_class", "nrc_service", "nrc_code", "nrc_category", "retryable", "expected", "timeout_ms", "duration_ms", "valid_response", "timed_out", "unsupported", "interpretation", "error", "raw_escaped"].join("\t")
  );
  for (const result of results) {
    lines.push([
      result.sequence,
      result.status,
      result.phase,
      result.label,
      result.command,
      result.requestHeader,
      result.connectionStrategy,
      result.queryForm,
      result.profileProbeId,
      result.evidence,
      result.decoder,
      Number.isInteger(result.toyotaIdentifier) ? hexByte(result.toyotaIdentifier) : "",
      result.decodedToyota ? JSON.stringify(result.decodedToyota) : "",
      result.responseClass,
      result.negativeDiagnostic?.serviceHex,
      result.negativeDiagnostic?.code,
      result.negativeDiagnostic?.category,
      result.retryable ? "yes" : "no",
      result.expected,
      result.timeoutMs,
      result.durationMs,
      result.validResponse ? "yes" : "no",
      result.timeout ? "yes" : "no",
      result.unsupported ? "yes" : "no",
      result.interpretation,
      result.error,
      diagnosticEscaped(diagnosticRawText(result.raw).text)
    ].map(diagnosticTsv).join("\t"));
  }
  lines.push("===== END LEXUS OBD FLEX FULL DIAGNOSTIC REPORT =====");
  return lines.join("\n");
}

export function buildFullDiagnosticAnalysisPrompt(run = {}) {
  const summary = run.summary || summarizeFullDiagnostic(run);
  return [
    "Analysoi liitteenä oleva Lexus OBD Flexin automaattinen diagnostiikkaraportti.",
    "Käy läpi kaikki vaiheet ja raakavastaukset. Erottele varmennetut havainnot, todennäköiset selitykset ja epävarmuudet.",
    "Arvioi erikseen vLinker MC / MC+ -tunnistus, ATI/STI/STDI-identiteetit, kuljetusprofiili, OBD-jännite ja adapterin turvallisten capability-probejen tulokset.",
    "Älä päättele ATCS-arvosta yksin fyysistä CAN-vikaa, koska halvat ELM327-kloonit voivat toteuttaa sen puutteellisesti.",
    "Vertaa Toyota 217E-, 217F- ja 212C-kyselyiden normaalia, 7E8-suodatettua ja raakaa ISO-TP-lukuprofiilia. Päättele erikseen, hyväksyykö adapteri Toyota Read Data 21 -kyselyt ja vastaako 2AD-FHV:n moottori-ECU.",
    "Toyota-arvojen varmennetut kaavat ovat: 217E paine raw16 × 0,0039 − 5 kPa ja kaksi tilatavua; 217F lämpötilat raw16 × 0,625 °C; 212C EGR raw8 × 100/255 %.",
    "Tavoite on päättää, mitä Flexin ohjelmistossa pitää muuttaa seuraavaksi ilman uusia käsin syötettäviä terminaalikomentoketjuja.",
    `Automaattiyhteenveto: ELM=${summary.adapterResponded ? "OK" : "EI"}, vLinker=${summary.adapterCapabilities.vlinkerDetected ? "KYLLÄ" : "EI"}, ST-ydin=${summary.adapterCapabilities.stnSupported ? "KYLLÄ" : "EI"}, OBD-vastauksia=${summary.validObdResponseCount}, Toyota-vastauksia=${summary.toyotaResponseCount}/${summary.toyotaProbeSummaries.length}, suorat osoitteet=${summary.directHeaders.join(",") || "ei löytynyt"}, aikakatkaisuja=${summary.timeouts}.`
  ].join("\n");
}

export function bytesToHex(bytes) {
  return [...(bytes || [])]
    .map(value => Number(value).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export function hexToBytes(value) {
  const compact = String(value ?? "").replace(/\s+/g, "").toUpperCase();
  if (!compact || compact.length % 2 !== 0 || /[^0-9A-F]/.test(compact)) {
    throw new Error("HEX-data on tyhjä, pariton tai sisältää virheellisiä merkkejä");
  }
  const bytes = [];
  for (let index = 0; index < compact.length; index += 2) {
    bytes.push(Number.parseInt(compact.slice(index, index + 2), 16));
  }
  return bytes;
}

function quicklynksHasIncompleteTail(bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const followingLength = bytes[offset];
    if (followingLength === 0) return false;
    const totalLength = followingLength + 1;
    if (bytes.length - offset < totalLength) return true;
    offset += totalLength;
  }
  return false;
}

export function normalizeQuicklynksNotificationChunks(notificationHex, fallbackHex = "") {
  const rawChunks = Array.isArray(notificationHex)
    ? notificationHex.map(value => String(value || "").trim()).filter(Boolean)
    : String(notificationHex || "").split("|").map(value => value.trim()).filter(Boolean);
  if (!rawChunks.length) {
    const normalizedHex = String(fallbackHex || "").replace(/\s+/g, "").toUpperCase();
    return { normalizedHex, rawChunks: [], rawChunkCount: 0, continuationMarkersStripped: 0, usedNotificationChunks: false };
  }

  const assembled = [];
  let continuationMarkersStripped = 0;
  for (const rawChunk of rawChunks) {
    let bytes;
    try {
      bytes = hexToBytes(rawChunk);
    } catch {
      continue;
    }
    if (assembled.length && quicklynksHasIncompleteTail(assembled) && bytes[0] === 0xff) {
      bytes = bytes.slice(1);
      continuationMarkersStripped += 1;
    }
    assembled.push(...bytes);
  }
  return {
    normalizedHex: bytesToHex(assembled) || String(fallbackHex || "").replace(/\s+/g, "").toUpperCase(),
    rawChunks,
    rawChunkCount: rawChunks.length,
    continuationMarkersStripped,
    usedNotificationChunks: true
  };
}

function researchProbe(identifier, group, candidateLabel, options = {}) {
  return Object.freeze({
    identifier,
    identifierHex: hexByte(identifier),
    group,
    candidateLabel,
    requestService: options.requestService ?? 0x01,
    queryType: options.queryType ?? 0x41,
    queryTypeHex: hexByte(options.queryType ?? 0x41),
    responseType: options.responseType ?? 0x41,
    responseTypeHex: hexByte(options.responseType ?? 0x41)
  });
}

const VERIFIED_QUERY_SPLIT_PROBES = [
  [0x0c, "RPM-kenttä varmennetusta koontikyselystä"],
  [0x0d, "nopeuskenttä varmennetusta koontikyselystä"],
  [0x84, "Quicklynks-ajomatkaksi varmennettu kenttä 84"],
  [0x80, "tulkinnaltaan avoin Quicklynks-kenttä 80"],
  [0x05, "jäähdytysnestekenttä varmennetusta koontikyselystä"],
  [0x85, "tulkitsematon kenttä 85 varmennetusta koontikyselystä"],
  [0x7f, "adapterin käyttöjännitteeksi varmennettu kenttä 7F"],
  [0x81, "tulkitsematon kenttä 81 varmennetusta koontikyselystä"],
  [0x82, "tulkitsematon kenttä 82 varmennetusta koontikyselystä"],
  [0x04, "kuormituskenttä varmennetusta koontikyselystä"],
  [0x86, "moottorin käyntiajaksi varmennettu Quicklynks-kenttä 86"],
  [0x83, "tulkitsematon kenttä 83 varmennetusta koontikyselystä"]
].map(([identifier, label]) => researchProbe(identifier, "verified_query_split", label));

const STANDARD_READ_CANDIDATE_PROBES = [
  [0x00, "Mode 01 tuettujen PIDien bittikartta 01–20"],
  [0x20, "Mode 01 tuettujen PIDien bittikartta 21–40"],
  [0x40, "Mode 01 tuettujen PIDien bittikartta 41–60"],
  [0x01, "monitor status / MIL -ehdokas"],
  [0x0b, "MAP-ehdokas"],
  [0x0f, "imuilman lämpötila -ehdokas"],
  [0x10, "MAF-ehdokas"],
  [0x11, "kaasuläpän asento -ehdokas"],
  [0x1f, "moottorin käyntiaika -ehdokas"],
  [0x21, "matka MIL-valon jälkeen -ehdokas"],
  [0x23, "polttoainekiskon paine -ehdokas"],
  [0x2c, "pyydetty EGR -ehdokas"],
  [0x2d, "EGR-poikkeama -ehdokas"],
  [0x31, "matka koodien nollauksesta -ehdokas"],
  [0x33, "ilmanpaine -ehdokas"],
  [0x42, "ohjainlaitteen jännite -ehdokas"],
  [0x43, "absoluuttinen kuormitus -ehdokas"],
  [0x45, "suhteellinen kaasuläpän asento -ehdokas"],
  [0x46, "ulkoilman lämpötila -ehdokas"],
  [0x47, "kaasuläpän asento B -ehdokas"],
  [0x48, "kaasuläpän asento C -ehdokas"],
  [0x49, "kaasupolkimen asento D -ehdokas"],
  [0x4a, "kaasupolkimen asento E -ehdokas"],
  [0x4b, "kaasupolkimen asento F -ehdokas"],
  [0x4c, "pyydetty kaasuläppätoimilaite -ehdokas"],
  [0x59, "absoluuttinen polttoainekiskon paine -ehdokas"],
  [0x5a, "suhteellinen kaasupolkimen asento -ehdokas"],
  [0x5c, "moottoriöljyn lämpötila -ehdokas"],
  [0x5d, "ruiskutusajoitus -ehdokas"],
  [0x5e, "polttoainevirta -ehdokas"]
].map(([identifier, label]) => researchProbe(identifier, "standard_read_candidate", label));

const AFTERTREATMENT_STANDARD_CANDIDATE_PROBES = [
  [0x78, "pakokaasulämpötilan tietoryhmä 1 -ehdokas (Mode 01 PID 78)"],
  [0x79, "pakokaasulämpötilan tietoryhmä 2 -ehdokas (Mode 01 PID 79)"],
  [0x7a, "dieselhiukkassuodattimen painetietoryhmä 1 -ehdokas (Mode 01 PID 7A)"],
  [0x7b, "dieselhiukkassuodattimen painetietoryhmä 2 -ehdokas (Mode 01 PID 7B)"],
  [0x7c, "dieselhiukkassuodattimen lämpötilatietoryhmä -ehdokas (Mode 01 PID 7C)"]
].map(([identifier, label]) => researchProbe(identifier, "aftertreatment_standard_candidate", label));

const DIESEL_STANDARD_CANDIDATE_PROBES = [
  [0x69, "EGR A tavoite-, toteuma- ja poikkeamatietoryhmä (Mode 01 PID 69)"],
  [0x6d, "rail-paineen tavoite-, toteuma- ja lämpötilatietoryhmä (Mode 01 PID 6D)"],
  [0x70, "ahtopaineen tavoite- ja toteumatietoryhmä (Mode 01 PID 70)"],
  [0x71, "VGT-asennon tavoite- ja toteumatietoryhmä (Mode 01 PID 71)"],
  [0x73, "pakopainetietoryhmä (Mode 01 PID 73)"],
  [0x8b, "DPF-regeneroinnin tila- ja kuormitustietoryhmä (Mode 01 PID 8B)"],
  [0x8c, "diesel-lambda- ja happipitoisuustietoryhmä (Mode 01 PID 8C)"],
  [0x8f, "PM-anturin tila- ja DPF-kuormitustietoryhmä (Mode 01 PID 8F)"]
].map(([identifier, label]) => researchProbe(identifier, "diesel_standard_candidate", label));

export const QUICKLYNKS_RESEARCH_PROBES = Object.freeze([
  ...AFTERTREATMENT_STANDARD_CANDIDATE_PROBES,
  ...DIESEL_STANDARD_CANDIDATE_PROBES,
  ...VERIFIED_QUERY_SPLIT_PROBES,
  ...STANDARD_READ_CANDIDATE_PROBES
]);

export const QUICKLYNKS_SUPPORT_BITMAP_PROBES = Object.freeze([
  [0x00, "PID-tukibittikandidaatti 01–20"],
  [0x20, "PID-tukibittikandidaatti 21–40"],
  [0x40, "PID-tukibittikandidaatti 41–60"],
  [0x60, "PID-tukibittikandidaatti 61–80"],
  [0x80, "PID-tukibittikandidaatti 81–A0"],
  [0xa0, "PID-tukibittikandidaatti A1–C0"]
].map(([identifier, label]) => Object.freeze({
  identifier,
  identifierHex: hexByte(identifier),
  label,
  category: "support-bitmap",
  queryType: 0x41,
  queryTypeHex: "41",
  responseType: 0x41,
  responseTypeHex: "41",
  minDataLength: 4,
  maxDataLength: 4
})));

const QUICKLYNKS_SUPPORT_BITMAP_BY_ID = new Map(
  QUICKLYNKS_SUPPORT_BITMAP_PROBES.map(probe => [probe.identifier, probe])
);

function resolveQuicklynksSupportBitmapProbe(probeOrIdentifier) {
  const identifier = typeof probeOrIdentifier === "object"
    ? Number(probeOrIdentifier?.identifier)
    : Number(probeOrIdentifier);
  const probe = QUICKLYNKS_SUPPORT_BITMAP_BY_ID.get(identifier);
  if (!probe) throw new Error(`Quicklynks-tukibittikysely ei kuulu sallittuun listaan: ${probeOrIdentifier}`);
  return probe;
}

export function buildQuicklynksSupportBitmapQuery(probeOrIdentifier) {
  const probe = resolveQuicklynksSupportBitmapProbe(probeOrIdentifier);
  return `0241${probe.identifierHex}`;
}

function supportedPidsFromQuicklynksBitmap(basePid, payloadHex) {
  const bytes = hexToBytes(payloadHex);
  if (bytes.length !== 4) return [];
  const supported = [];
  for (let bit = 0; bit < 32; bit++) {
    if (bytes[Math.floor(bit / 8)] & (1 << (7 - bit % 8))) supported.push(basePid + bit + 1);
  }
  return supported;
}

const QUICKLYNKS_WIDE_DIAGNOSTIC_REQUIREMENTS = Object.freeze([
  [0x0c, "Kierrosluku (kontrolli)", 2, 2, "control"],
  [0x05, "Jäähdytysneste (kontrolli)", 1, 1, "control"],
  [0x0b, "MAP (kontrolli)", 1, 1, "control"],
  [0x10, "MAF (kontrolli)", 2, 2, "control"],
  [0x2c, "Pyydetty EGR", 1, 1, "egr"],
  [0x2d, "EGR-poikkeama", 1, 1, "egr"],
  [0x69, "EGR A tavoite, toteuma ja poikkeama", 4, 7, "egr"],
  [0x73, "Pakopaine B1", 3, 5, "aftertreatment"],
  [0x78, "Pakokaasulämpötilat B1", 3, 9, "aftertreatment"],
  [0x79, "Pakokaasulämpötilat B2", 3, 9, "aftertreatment"],
  [0x7a, "DPF-paineet B1", 3, 7, "dpf"],
  [0x7b, "DPF-paineet B2", 3, 7, "dpf"],
  [0x7c, "DPF-lämpötilat B1", 3, 5, "dpf"],
  [0x8b, "DPF-regeneroinnin tila", 7, 7, "dpf"],
  [0x8f, "PM-anturin tila ja DPF-kuormitus", 4, 4, "dpf"]
]);

export const QUICKLYNKS_WIDE_DIAGNOSTIC_PROBES = Object.freeze(
  QUICKLYNKS_WIDE_DIAGNOSTIC_REQUIREMENTS.map(([identifier, label, minDataLength, maxDataLength, category]) => {
    const probe = QUICKLYNKS_RESEARCH_PROBES.find(candidate => candidate.identifier === identifier && candidate.queryType === 0x41);
    if (!probe) throw new Error(`Quicklynks-laajan diagnostiikan sallittu PID puuttuu tutkimuslistasta: ${hexByte(identifier)}`);
    return Object.freeze({ ...probe, label, minDataLength, maxDataLength, category });
  })
);

const researchProbeKey = probe => `${probe.queryTypeHex}:${probe.identifierHex}`;
const QUICKLYNKS_RESEARCH_PROBE_BY_KEY = new Map(
  QUICKLYNKS_RESEARCH_PROBES.map(probe => [researchProbeKey(probe), probe])
);
const QUICKLYNKS_STANDARD_RESEARCH_PROBE_BY_ID = new Map(
  QUICKLYNKS_RESEARCH_PROBES
    .filter(probe => probe.queryType === 0x41)
    .map(probe => [probe.identifier, probe])
);

function resolveQuicklynksResearchProbe(probeOrIdentifier) {
  if (typeof probeOrIdentifier === "object" && probeOrIdentifier) {
    const identifierHex = hexByte(Number(probeOrIdentifier.identifier));
    const queryTypeHex = hexByte(Number(probeOrIdentifier.queryType ?? 0x41));
    const probe = QUICKLYNKS_RESEARCH_PROBE_BY_KEY.get(`${queryTypeHex}:${identifierHex}`);
    if (probe) return probe;
  } else {
    const probe = QUICKLYNKS_STANDARD_RESEARCH_PROBE_BY_ID.get(Number(probeOrIdentifier));
    if (probe) return probe;
  }
  throw new Error(`Quicklynks-tutkimustunniste ei kuulu vain luku -sallittujen listaan: ${probeOrIdentifier}`);
}

export function buildQuicklynksResearchQuery(probeOrIdentifier) {
  const probe = resolveQuicklynksResearchProbe(probeOrIdentifier);
  return `02${probe.queryTypeHex}${probe.identifierHex}`;
}

export function parseQuicklynksResearchResponse(raw) {
  const events = [];
  const buffer = new QuicklynksFrameBuffer(event => events.push(event));
  const frames = buffer.push(String(raw || ""));
  const invalid = events.find(event => event.type === "invalid");
  return {
    frames: frames.map(frame => ({
      rawHex: bytesToHex(frame),
      followingLength: frame[0],
      responseTypeHex: frame.length > 1 ? hexByte(frame[1]) : "",
      payloadHex: frame.length > 2 ? bytesToHex(frame.slice(2)) : ""
    })),
    pendingHex: buffer.pendingHex(),
    error: invalid?.message || ""
  };
}

export function createQuicklynksResearchState(startedAt = Date.now()) {
  return {
    schemaVersion: 6,
    planId: "quicklynks-read41-payload-v6-no-active-test",
    mode: "read_only",
    startedAt,
    endedAt: null,
    completedAt: null,
    nextProbeIndex: 0,
    nextProbeAt: startedAt + QUICKLYNKS_RESEARCH_INITIAL_DELAY_MS,
    intervalMs: QUICKLYNKS_RESEARCH_INTERVAL_MS,
    timeoutMs: QUICKLYNKS_RESEARCH_TIMEOUT_MS,
    totalProbes: QUICKLYNKS_RESEARCH_PROBES.length,
    events: []
  };
}

export function evaluateQuicklynksWideDiagnosticEvent(probe, event = {}) {
  const normalization = normalizeQuicklynksNotificationChunks(event.notificationHex, event.responseHex);
  const responseHex = normalization.normalizedHex;
  const parsed = parseQuicklynksResearchResponse(responseHex);
  const expectedPid = hexByte(probe.identifier);
  const expectedType = hexByte(probe.responseType ?? 0x41);
  const observedFrame = parsed.frames.find(frame =>
    frame.responseTypeHex === expectedType &&
    frame.followingLength !== 0x13 &&
    frame.rawHex !== String(event.requestHex || "")
  );
  const candidate = parsed.frames.find(frame => {
    const payload = String(frame.payloadHex || "");
    const dataLength = payload.length / 2;
    return frame.responseTypeHex === expectedType &&
      frame.followingLength !== 0x13 &&
      payload !== "" &&
      payload !== "00" &&
      dataLength >= probe.minDataLength &&
      dataLength <= probe.maxDataLength &&
      frame.rawHex !== String(event.requestHex || "");
  });
  const validResponse = Boolean(candidate);
  const timeout = event.outcome === "timeout" || /aikakatka|timeout/i.test(String(event.error || ""));
  const disconnected = event.outcome === "disconnected" || /ei ollut käytettävissä|katkennut/i.test(String(event.error || ""));
  const notificationCount = Number.isInteger(event.notificationCount)
    ? event.notificationCount
    : normalization.rawChunkCount || null;
  const fragmented = Number.isInteger(notificationCount) ? notificationCount > 1 : null;
  const combinedFrames = parsed.frames.length > 1;
  const observedDataHex = String(observedFrame?.payloadHex || "");
  const observedDataLength = observedDataHex.length / 2;
  const allZeroPayload = observedDataLength > 0 && /^0+$/.test(observedDataHex);
  const emptySentinel = observedDataHex === "" || observedDataHex === "00";
  const overlongPayload = observedDataLength > Number(probe.maxDataLength || 0);
  const shortPayload = observedDataLength > 0 && observedDataLength < Number(probe.minDataLength || 0);
  const artifact = !validResponse && Boolean(observedFrame) && (overlongPayload || (allZeroPayload && observedDataLength > 1));
  const unsupported = !validResponse && !timeout && !disconnected && (emptySentinel || shortPayload || artifact || Boolean(responseHex));
  let status = validResponse ? "PASS" : timeout || disconnected ? "FAIL" : "WARN";
  let interpretation = validResponse
    ? `Kelvollinen PIDin ${expectedPid} payload-only 41 -vastaus, ${candidate.payloadHex.length / 2} datatavua`
    : artifact
      ? `PID ${expectedPid}: ylipitkä${allZeroPayload ? " nollatäytteinen" : ""} firmware-artefakti (${observedDataLength} datatavua), käsitellään ei-tuettuna`
      : emptySentinel
        ? `PID ${expectedPid}: tyhjä Quicklynks-vastaus, käsitellään ei-tuettuna`
        : shortPayload
          ? `PID ${expectedPid}: liian lyhyt payload (${observedDataLength} datatavua), käsitellään ei-tuettuna`
          : event.error || parsed.error || `Kelvollista PIDin ${expectedPid} payload-only 41 -vastausta ei löytynyt`;
  if (!validResponse && responseHex && !interpretation) interpretation = "Raakavastaus ei täyttänyt PID-, pituus- tai kehysvaatimusta";
  return {
    status,
    interpretation,
    validResponse,
    timeout,
    disconnected,
    fragmented,
    combinedFrames,
    frameCount: parsed.frames.length,
    pendingHex: parsed.pendingHex,
    validFrameHex: candidate?.rawHex || "",
    dataHex: candidate?.payloadHex || "",
    observedFrameHex: observedFrame?.rawHex || "",
    observedDataHex,
    artifact,
    unsupported,
    supportState: validResponse ? "supported-candidate" : artifact ? "firmware-artifact" : unsupported ? "not-supported" : timeout ? "timeout" : disconnected ? "disconnected" : "invalid",
    normalizedResponseHex: responseHex,
    continuationMarkersStripped: normalization.continuationMarkersStripped
  };
}

export function evaluateQuicklynksSupportBitmapEvent(probeOrIdentifier, event = {}) {
  const probe = resolveQuicklynksSupportBitmapProbe(probeOrIdentifier);
  const normalization = normalizeQuicklynksNotificationChunks(event.notificationHex, event.responseHex);
  const parsed = parseQuicklynksResearchResponse(normalization.normalizedHex);
  const requestHex = String(event.requestHex || buildQuicklynksSupportBitmapQuery(probe));
  const observedFrame = parsed.frames.find(frame =>
    frame.responseTypeHex === "41" && frame.followingLength !== 0x13 && frame.rawHex !== requestHex
  );
  const payloadHex = String(observedFrame?.payloadHex || "");
  const payloadLength = payloadHex.length / 2;
  const exactBitmap = payloadLength === 4;
  const advertisedPidNumbers = exactBitmap
    ? supportedPidsFromQuicklynksBitmap(probe.identifier, payloadHex)
    : [];
  const advertisedPids = advertisedPidNumbers.map(hexByte);
  const timeout = event.outcome === "timeout" || /aikakatka|timeout/i.test(String(event.error || ""));
  const disconnected = event.outcome === "disconnected" || /ei ollut käytettävissä|katkennut/i.test(String(event.error || ""));
  const allZeroPayload = payloadLength > 0 && /^0+$/.test(payloadHex);
  const artifact = Boolean(observedFrame) && !exactBitmap && (payloadLength > 4 || allZeroPayload);
  const empty = !observedFrame || payloadLength === 0 || payloadHex === "00";
  const validBitmap = exactBitmap;
  const status = validBitmap ? "PASS" : disconnected ? "FAIL" : "WARN";
  const interpretation = validBitmap
    ? advertisedPids.length
      ? `Quicklynks palautti 4 tavun tukibittikandidaatin: ${advertisedPids.join(", ")}`
      : "Quicklynks palautti tyhjän 4 tavun tukibittikandidaatin"
    : artifact
      ? `Ylipitkä${allZeroPayload ? " nollatäytteinen" : ""} firmware-artefakti (${payloadLength} datatavua), ei tukibittikartta`
      : timeout
        ? "Tukibittikandidaatin kysely aikakatkaistiin"
        : empty
          ? "Tyhjä Quicklynks-vastaus, ei tukibittikarttaa"
          : `Vastauksen pituus ${payloadLength} datatavua, odotettiin täsmälleen 4`;
  const notificationCount = Number.isInteger(event.notificationCount)
    ? event.notificationCount
    : normalization.rawChunkCount || null;
  return {
    status,
    interpretation,
    validResponse: validBitmap,
    validBitmap,
    timeout,
    disconnected,
    fragmented: Number.isInteger(notificationCount) ? notificationCount > 1 : null,
    combinedFrames: parsed.frames.length > 1,
    frameCount: parsed.frames.length,
    pendingHex: parsed.pendingHex,
    validFrameHex: validBitmap ? observedFrame.rawHex : "",
    dataHex: validBitmap ? payloadHex : "",
    observedFrameHex: observedFrame?.rawHex || "",
    observedDataHex: payloadHex,
    advertisedPids,
    nextRangeAdvertised: advertisedPidNumbers.includes(probe.identifier + 0x20),
    artifact,
    unsupported: !validBitmap && !timeout && !disconnected,
    supportState: validBitmap ? "bitmap-candidate" : artifact ? "firmware-artifact" : timeout ? "timeout" : disconnected ? "disconnected" : "not-supported",
    normalizedResponseHex: normalization.normalizedHex,
    continuationMarkersStripped: normalization.continuationMarkersStripped
  };
}

export function summarizeQuicklynksWideDiagnostic(run = {}) {
  const results = Array.isArray(run.results) ? run.results : [];
  const supportResults = Array.isArray(run.supportResults) ? run.supportResults : [];
  const allResults = [...supportResults, ...results];
  const passed = allResults.filter(result => result.status === "PASS").length;
  const warned = allResults.filter(result => result.status === "WARN").length;
  const failed = allResults.filter(result => result.status === "FAIL").length;
  const validResponses = results.filter(result => result.validResponse);
  const validSupportBitmaps = supportResults.filter(result => result.validBitmap);
  const timeouts = allResults.filter(result => result.timeout).length;
  const disconnected = allResults.filter(result => result.disconnected).length;
  const fragmented = allResults.filter(result => result.fragmented === true).length;
  const combinedFrames = allResults.filter(result => result.combinedFrames).length;
  const artifacts = allResults.filter(result => result.artifact).length;
  const unsupported = allResults.filter(result => result.unsupported).length;
  const continuationMarkersStripped = allResults.reduce((sum, result) => sum + Number(result.continuationMarkersStripped || 0), 0);
  const byPid = QUICKLYNKS_WIDE_DIAGNOSTIC_PROBES.map(probe => {
    const attempts = results.filter(result => result.identifierHex === probe.identifierHex);
    const responses = attempts.filter(result => result.validResponse);
    return {
      pidHex: probe.identifierHex,
      label: probe.label,
      category: probe.category,
      attempts: attempts.length,
      responses: responses.length,
      payloadVariants: new Set(responses.map(result => result.dataHex).filter(Boolean)).size,
      repeatable: attempts.length === QUICKLYNKS_WIDE_DIAGNOSTIC_ROUNDS && responses.length === QUICKLYNKS_WIDE_DIAGNOSTIC_ROUNDS
    };
  });
  const supportedPids = byPid.filter(item => item.responses > 0).map(item => item.pidHex);
  const repeatablePids = byPid.filter(item => item.repeatable).map(item => item.pidHex);
  const dpfEgrPids = byPid.filter(item => item.category !== "control" && item.responses > 0).map(item => item.pidHex);
  const rpmResult = validResponses.find(result => result.identifierHex === "0C" && /^[0-9A-F]{4}$/i.test(String(result.dataHex || "")));
  const rpmFromPid = rpmResult ? Number.parseInt(rpmResult.dataHex, 16) / 4 : null;
  const observedRpm = Number.isFinite(run.meta?.observedRpm)
    ? Number(run.meta.observedRpm)
    : Number.isFinite(rpmFromPid)
      ? rpmFromPid
      : null;
  const engineRunningObserved = Number.isFinite(observedRpm) ? observedRpm > 0 : null;
  const engineRunningDeclared = run.meta?.engineRunningDeclared === true
    ? true
    : run.meta?.engineRunningDeclared === false
      ? false
      : null;
  const engineRunning = engineRunningObserved ?? engineRunningDeclared;
  const findings = [
    validSupportBitmaps.length
      ? `Quicklynks palautti ${validSupportBitmaps.length}/${supportResults.length} täsmälleen nelitavuisista tukibittikandidaateista. Niitä ei tulkita suoraan ECU:n ilmoitukseksi ennen adapterivertailua.`
      : `Quicklynks ei palauttanut yhtään täsmälleen nelitavuista tukibittikandidaattia (${supportResults.length} kyselyä).`,
    validResponses.length
      ? `Quicklynks palautti ${validResponses.length}/${results.length} kelvollista PID-vastausta.`
      : "Quicklynks ei palauttanut yhtään pituus- ja PID-tarkistettua yksittäistä 41-vastausta.",
    dpfEgrPids.length
      ? `DPF/EGR-kandidaateista vastasivat PIDit ${dpfEgrPids.join(", ")}. Arvot pitää vielä verrata Techstreamiin ennen tuotantokäyttöä.`
      : "Yksikään DPF/EGR-kandidaatti ei vielä läpäissyt vastaustarkistusta.",
    repeatablePids.length
      ? `Kaikilla kolmella kierroksella vastasivat PIDit ${repeatablePids.join(", ")}.`
      : "Yksikään PID ei vastannut kelvollisesti kaikilla suoritetuilla kierroksilla.",
    artifacts
      ? `${artifacts} ylipitkää tai nollatäytteistä firmware-artefaktia luokiteltiin ei-tuetuksi eikä mittausarvoksi.`
      : "Ylipitkiä tai nollatäytteisiä firmware-artefakteja ei havaittu.",
    `Testi lähetti vain ${QUICKLYNKS_SUPPORT_BITMAP_PROBES.length} ennalta sallittua tukibittikandidaattia ja ${QUICKLYNKS_WIDE_DIAGNOSTIC_PROBES.length * QUICKLYNKS_WIDE_DIAGNOSTIC_ROUNDS} yksittäistä Quicklynksin 02 41 PID -lukukyselyä; ELM-ASCII-, Toyota 21xx-, Active Test-, kirjoitus- ja poistokomentoja ei lähetetty.`
  ];
  return {
    passed,
    warned,
    failed,
    total: allResults.length,
    pidAttemptCount: results.length,
    supportAttemptCount: supportResults.length,
    validResponseCount: validResponses.length,
    validSupportBitmapCount: validSupportBitmaps.length,
    timeouts,
    disconnected,
    fragmented,
    combinedFrames,
    artifacts,
    unsupported,
    continuationMarkersStripped,
    supportBitmaps: supportResults.map(result => ({
      pidHex: result.identifierHex,
      label: result.label,
      validBitmap: Boolean(result.validBitmap),
      bitmapHex: result.dataHex || "",
      advertisedPids: result.advertisedPids || [],
      nextRangeAdvertised: Boolean(result.nextRangeAdvertised),
      supportState: result.supportState || "unknown"
    })),
    byPid,
    supportedPids,
    repeatablePids,
    dpfEgrPids,
    observedRpm,
    engineRunningObserved,
    engineRunningDeclared,
    engineRunning,
    findings
  };
}

export function buildQuicklynksWideDiagnosticReport(run = {}) {
  const results = Array.isArray(run.results) ? run.results : [];
  const supportResults = Array.isArray(run.supportResults) ? run.supportResults : [];
  const phaseResults = [...supportResults, ...results].sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
  const summary = run.summary || summarizeQuicklynksWideDiagnostic(run);
  const meta = run.meta || {};
  const durationMs = Math.max(0, Number(run.endedAt || Date.now()) - Number(run.startedAt || Date.now()));
  const ble = meta.bleDiagnostics || {};
  const baseline = meta.baseline || {};
  const lines = [
    "===== BEGIN LEXUS OBD FLEX QUICKLYNKS WIDE DIAGNOSTIC REPORT =====",
    "Raporttityyppi: Laaja Quicklynks BLE -diagnostiikka",
    `Raporttitunnus: ${meta.reportId || "ei tietoa"}`,
    `Raporttimuoto: ${QUICKLYNKS_WIDE_DIAGNOSTIC_SCRIPT_VERSION}`,
    `Sovellus: Lexus OBD Flex ${meta.appVersion || "tuntematon"}`,
    `Aloitus: ${new Date(run.startedAt || Date.now()).toISOString()}`,
    `Lopetus: ${new Date(run.endedAt || Date.now()).toISOString()}`,
    `Kesto_ms: ${durationMs}`,
    `Keskeytetty: ${run.cancelled ? "kyllä" : "ei"}`,
    `Ajoneuvo: ${meta.vehicle || "Lexus · yleinen EOBD"}`,
    `Moottorin tila, käyttäjän ilmoitus: ${summary.engineRunningDeclared === true ? "käy" : summary.engineRunningDeclared === false ? "ei käy" : "automaattinen / ei ilmoitettu"}`,
    `Moottorin tila, Quicklynks-RPM:stä havaittu: ${summary.engineRunningObserved === true ? "käy" : summary.engineRunningObserved === false ? "ei käy" : "ei voitu päätellä"}`,
    `Havaittu kierrosluku: ${Number.isFinite(summary.observedRpm) ? `${summary.observedRpm} rpm` : "ei tietoa"}`,
    `Moottori käynnissä testissä: ${summary.engineRunning === true ? "kyllä" : summary.engineRunning === false ? "ei" : "ei voitu varmistaa"}`,
    `Käyttäjän huomio: ${meta.note || "–"}`,
    `Laite: ${meta.device || "ei tietoa"}`,
    `Bluetooth-osoite: ${meta.address || "ei tietoa"}`,
    `Yhteystapa: ${meta.transport || "Bluetooth LE"}`,
    `Adapteri: ${meta.adapter || "Quicklynks BK-BLE-1.0"}`,
    `Protokolla: ${meta.protocol || "Quicklynks FFF0/FFF6 · binääri"}`,
    `GATT UUID:t: ${ble.gattUuids || "ei tietoa"}`,
    `TX UUID: ${ble.writeUuid || "ei tietoa"}`,
    `RX/Notify UUID: ${ble.notifyUuid || "ei tietoa"}`,
    `Notification käytössä: ${ble.notificationEnabled === true ? "kyllä" : ble.notificationEnabled === false ? "ei" : "ei tietoa"}`,
    `CCCD: ${ble.cccdValue || "ei tietoa"}`,
    `Android API: ${ble.sdk ?? "ei tietoa"}`,
    `Varmennetun mittarikehyksen tila: ${baseline.status || "ei ajettu"}`,
    `Varmennetun mittarikehyksen kesto_ms: ${baseline.durationMs ?? "ei tietoa"}`,
    `Varmennetun mittarikehyksen RAW: ${baseline.rawHex || "ei tietoa"}`,
    `Varmennetun mittarikehyksen virhe: ${baseline.error || "–"}`,
    `Selainympäristö: ${meta.userAgent || "ei tietoa"}`,
    "",
    "TURVALLISUUSRAJAUS",
    "Vain ennalta sallittu Quicklynks FFF0/FFF6 -binäärikuljetus, kuusi lukittua 02 41 PID -tukibittikandidaattia ja yksittäiset 02 41 PID -lukukyselyt.",
    "Ei ELM-ASCII-komentoja, Toyota 21xx -kyselyjä, Mode 04 -poistoa, Active Testejä, ECU-kirjoituksia tai pakotettua regenerointia.",
    "",
    "YHTEENVETO",
    `PASS=${summary.passed} WARN=${summary.warned} FAIL=${summary.failed}`,
    `Kelvollisia PID-vastauksia: ${summary.validResponseCount}/${summary.pidAttemptCount}`,
    `Nelitavuisia tukibittikandidaatteja: ${summary.validSupportBitmapCount}/${summary.supportAttemptCount}`,
    `Aikakatkaisuja: ${summary.timeouts}`,
    `Yhteyskatkoja: ${summary.disconnected}`,
    `Useasta BLE-ilmoituksesta kootut vastaukset: ${summary.fragmented}`,
    `Poistettuja FF-jatkomerkkejä: ${summary.continuationMarkersStripped}`,
    `Firmware-artefakteja: ${summary.artifacts}`,
    `Ei-tuetuiksi luokiteltuja tuloksia: ${summary.unsupported}`,
    `Useita kehyksiä sisältäneet vastaukset: ${summary.combinedFrames}`,
    `Vastanneet PIDit: ${summary.supportedPids.join(", ") || "ei löytynyt"}`,
    `Kolmella kierroksella vastanneet PIDit: ${summary.repeatablePids.join(", ") || "ei löytynyt"}`,
    `Vastanneet DPF/EGR-kandidaatit: ${summary.dpfEgrPids.join(", ") || "ei löytynyt"}`,
    "",
    "AUTOMAATTISET HAVAINNOT",
    ...summary.findings.map((finding, index) => `${index + 1}. ${finding}`),
    "",
    "PID-TUKIBITTIKANDIDAATIT",
    "Huomio: Quicklynksin 41-kuori voi palauttaa adapterin omaa dataa. Nelitavuinen bittikartta on tutkimuskandidaatti, ei vielä varmistettu ECU:n Mode 01 -tukikartta.",
    ...summary.supportBitmaps.map(item => `PID ${item.pidHex} · ${item.label}: ${item.validBitmap ? `bitmap ${item.bitmapHex || "00000000"} · ilmoitetut PIDit ${item.advertisedPids.join(", ") || "ei yhtään"} · jatkoalue ${item.nextRangeAdvertised ? "kyllä" : "ei"}` : `ei kelvollista bittikarttaa · ${item.supportState}`}`),
    "",
    "PID-KOHTAINEN TOISTETTAVUUS",
    ...summary.byPid.map(item => `PID ${item.pidHex} · ${item.label}: ${item.responses}/${item.attempts} kelvollista · payload-muunnoksia ${item.payloadVariants} · kaikki kierrokset ${item.repeatable ? "kyllä" : "ei"}`),
    "",
    "VAIHEKOHTAISET TULOKSET"
  ];

  for (const result of phaseResults) {
    const raw = diagnosticRawText(result.responseHex);
    const chunks = diagnosticRawText(result.notificationHex || "");
    lines.push(
      "",
      `#${String(result.sequence || 0).padStart(3, "0")} [${result.status || "WARN"}] ${result.testKind === "support-bitmap" ? "Tukibittikartoitus" : `Kierros ${result.round || "–"}`} · PID ${result.identifierHex || "–"} · ${result.label || result.candidateLabel || "kandidaatti"}`,
      `Kysely: ${result.requestHex || "–"}`,
      `Kesto_ms: ${result.durationMs ?? "–"}`,
      `Tulos: ${result.outcome || "–"}`,
      `Tulkinta: ${result.interpretation || "–"}`,
      `Virhe: ${result.error || "–"}`,
      `Kehyksiä: ${result.frameCount ?? "–"}`,
      `BLE-ilmoituksia: ${result.notificationCount ?? "ei tietoa"}`,
      `Pirstoutunut useaan BLE-ilmoitukseen: ${result.fragmented === true ? "kyllä" : result.fragmented === false ? "ei" : "ei tietoa"}`,
      `Yhdistettyjä kehyksiä: ${result.combinedFrames ? "kyllä" : "ei"}`,
      `Tukitila: ${result.supportState || "ei tietoa"}`,
      `Firmware-artefakti: ${result.artifact ? "kyllä" : "ei"}`,
      `Poistettuja FF-jatkomerkkejä: ${result.continuationMarkersStripped ?? 0}`,
      `Normalisoitu vastaus: ${result.normalizedResponseHex || result.responseHex || "–"}`,
      `Hyväksytty kehys: ${result.validFrameHex || "–"}`,
      `Payload-only-hyötydata: ${result.dataHex || "–"}`,
      `Tukibittien ilmoittamat PIDit: ${(result.advertisedPids || []).join(", ") || "–"}`,
      `Puskuriin jäänyt HEX: ${result.pendingHex || "–"}`,
      `Raakavastauksen_pituus: ${raw.originalLength}${raw.truncated ? " (raportissa rajattu)" : ""}`,
      "RAW_BEGIN",
      raw.text || "(tyhjä)",
      "RAW_END",
      `BLE-ilmoituspalojen_pituus: ${chunks.originalLength}${chunks.truncated ? " (raportissa rajattu)" : ""}`,
      "NOTIFICATION_CHUNKS_BEGIN",
      chunks.text || "(ei tietoa)",
      "NOTIFICATION_CHUNKS_END"
    );
  }

  lines.push(
    "",
    "KONELUETTAVA TSV",
    ["sequence", "test_kind", "round", "status", "pid", "category", "label", "request_hex", "duration_ms", "outcome", "valid_response", "valid_bitmap", "support_state", "firmware_artifact", "timed_out", "disconnected", "frame_count", "notification_count", "fragmented", "combined_frames", "continuation_markers_stripped", "advertised_pids", "valid_frame_hex", "data_hex", "observed_data_hex", "pending_hex", "interpretation", "error", "normalized_response_hex", "response_hex", "notification_hex"].join("\t")
  );
  for (const result of phaseResults) {
    lines.push([
      result.sequence,
      result.testKind || "pid",
      result.round,
      result.status,
      result.identifierHex,
      result.category,
      result.label || result.candidateLabel,
      result.requestHex,
      result.durationMs,
      result.outcome,
      result.validResponse ? "yes" : "no",
      result.validBitmap ? "yes" : "no",
      result.supportState,
      result.artifact ? "yes" : "no",
      result.timeout ? "yes" : "no",
      result.disconnected ? "yes" : "no",
      result.frameCount,
      result.notificationCount,
      result.fragmented === true ? "yes" : result.fragmented === false ? "no" : "unknown",
      result.combinedFrames ? "yes" : "no",
      result.continuationMarkersStripped,
      (result.advertisedPids || []).join(","),
      result.validFrameHex,
      result.dataHex,
      result.observedDataHex,
      result.pendingHex,
      result.interpretation,
      result.error,
      result.normalizedResponseHex,
      diagnosticEscaped(diagnosticRawText(result.responseHex).text),
      diagnosticEscaped(diagnosticRawText(result.notificationHex).text)
    ].map(diagnosticTsv).join("\t"));
  }
  lines.push("===== END LEXUS OBD FLEX QUICKLYNKS WIDE DIAGNOSTIC REPORT =====");
  return lines.join("\n");
}

export function buildQuicklynksWideDiagnosticAnalysisPrompt(run = {}) {
  const summary = run.summary || summarizeQuicklynksWideDiagnostic(run);
  return [
    "Analysoi liitteenä oleva Lexus OBD Flexin laaja Quicklynks BLE -diagnostiikkaraportti.",
    "Tarkista ensin kuusi PID-tukibittikandidaattia ja sen jälkeen jokaisen varsinaisen PIDin kolme kierrosta, täydet raakavastaukset, BLE-ilmoituspalat, vastaustyyppi, payload-pituus ja toistettavuus.",
    "Quicklynksin varmennetussa yksittäisvastausmuodossa PID ei toistu vastauksessa: rakenne on [pituus] [41] [payload].",
    "FF-tavu GATT-jatkopalan alussa on poistettu vain silloin, kun edellinen looginen kehys oli kesken; alkuperäiset notification_hex-palat säilyvät raportissa.",
    "Erota täsmälleen nelitavuiset tukibittikandidaatit, varmasti tuettu standardi Mode 01 -data, adapterin oma payload-kuori, aikakatkaisut sekä ylipitkät/nollatäytteiset firmware-artefaktit.",
    "Älä pidä Quicklynksin tukibittikandidaattia yksin todisteena ECU:n tuesta, koska adapteri voi muodostaa 41-kuoren itse.",
    "Älä nimeä Toyota DPNR -arvoksi mitään, mitä raportin standardi-PID ja myöhempi Techstream-vertailu eivät varmista.",
    "Tavoite on päättää, voidaanko seuraavaan Flex-versioon lisätä varmennettu DPF/EGR-live-data vai pitääkö Quicklynksin raw-CAN-komentoa tutkia lisää.",
    `Automaattiyhteenveto: tukibittikandidaatit=${summary.validSupportBitmapCount}/${summary.supportAttemptCount}, kelvolliset PID-vastaukset=${summary.validResponseCount}/${summary.pidAttemptCount}, vastanneet PIDit=${summary.supportedPids.join(",") || "ei löytynyt"}, DPF/EGR=${summary.dpfEgrPids.join(",") || "ei löytynyt"}, artefaktit=${summary.artifacts}, aikakatkaisut=${summary.timeouts}.`
  ].join("\n");
}

export class QuicklynksFrameBuffer {
  constructor(onEvent = () => {}) {
    this.buffer = [];
    this.onEvent = onEvent;
  }

  push(chunk) {
    let incoming;
    try {
      incoming = typeof chunk === "string" ? hexToBytes(chunk) : [...(chunk || [])].map(value => Number(value) & 0xff);
    } catch (error) {
      this.onEvent({ type: "invalid", message: `Virheellinen RX HEX hylättiin: ${error.message}`, raw: String(chunk ?? "") });
      return [];
    }
    if (!incoming.length) {
      this.onEvent({ type: "invalid", message: "Tyhjä RX-ilmoitus hylättiin", raw: "" });
      return [];
    }
    this.buffer.push(...incoming);
    const frames = [];
    while (this.buffer.length) {
      const followingLength = this.buffer[0];
      if (followingLength === 0) {
        const dropped = this.buffer.shift();
        this.onEvent({ type: "invalid", message: "Virheellinen Quicklynks-kehys hylättiin: pituustavu oli 00", raw: bytesToHex([dropped]) });
        continue;
      }
      const totalLength = followingLength + 1;
      if (this.buffer.length < totalLength) {
        this.onEvent({
          type: "partial",
          message: `Pirstoutunut kehys: odotetaan ${totalLength - this.buffer.length} tavua`,
          raw: bytesToHex(this.buffer)
        });
        break;
      }
      const frame = this.buffer.splice(0, totalLength);
      frames.push(frame);
      this.onEvent({
        type: "frame",
        message: `Kehys valmis: ${followingLength} hyötytavua, yhteensä ${totalLength} tavua`,
        raw: bytesToHex(frame)
      });
    }
    return frames;
  }

  pendingHex() {
    return bytesToHex(this.buffer);
  }

  reset() {
    this.buffer.length = 0;
  }
}

export function parseQuicklynksRealtimeFrame(frame) {
  const bytes = typeof frame === "string" ? hexToBytes(frame) : [...(frame || [])].map(value => Number(value) & 0xff);
  const rawHex = bytesToHex(bytes);
  if (!bytes.length || bytes[0] + 1 !== bytes.length) {
    throw new Error(`Quicklynks-kehyksen pituus ei täsmää: ${rawHex || "(tyhjä)"}`);
  }
  if (bytes[1] !== 0x41) {
    return { type: "unknown", responseType: bytes[1], rawHex, unknownHex: bytesToHex(bytes.slice(2)) };
  }
  if (bytes.length < 20) {
    throw new Error(`Quicklynks-kehys on liian lyhyt täydelle mittaridatalle: ${rawHex}`);
  }
  const rpmWord = bytes[2] * 256 + bytes[3];
  const voltageWord = bytes[11] * 256 + bytes[12];
  const unmappedFields = {
    "85": bytesToHex(bytes.slice(9, 11)),
    "81": bytesToHex(bytes.slice(13, 15)),
    "82": bytesToHex(bytes.slice(15, 16)),
    "83": bytesToHex(bytes.slice(19, 20))
  };
  return {
    type: "realtime",
    responseType: bytes[1],
    rpm: rpmWord / 4,
    speed: bytes[4],
    quicklynksTripDistance: bytes[5] * 256 + bytes[6],
    quicklynksField80: bytes[7] / 10,
    coolant: bytes[8] - 40,
    adapterVoltage: voltageWord / 100,
    load: bytes[16] * 100 / 255,
    quicklynksRuntime: bytes[17] * 256 + bytes[18],
    rawHex,
    unmappedFields,
    unknownHex: ["85", "81", "82", "83"].map(id => `${id}:${unmappedFields[id]}`).join(" ")
  };
}

export class NativeElmTransport {
  constructor(nativeBridge = globalThis.obd) {
    this.bridge = nativeBridge;
  }

  available() { return Boolean(this.bridge?.pairedDevices && this.bridge?.connect && this.bridge?.send); }

  async pairedDevices() {
    if (!this.available()) return [];
    const result = this.bridge.pairedDevices();
    try {
      return JSON.parse(result || "[]").map(device => ({ ...device, transport: "classic" }));
    } catch {
      return [];
    }
  }

  async connect(address) {
    if (!this.available()) throw new Error("Androidin Bluetooth-silta ei ole käytettävissä");
    const result = String(this.bridge.connect(address));
    let parsed;
    try { parsed = JSON.parse(result); } catch { throw new Error(result || "Bluetooth-yhteys epäonnistui"); }
    if (!parsed.ok) throw new Error(parsed.error || "Bluetooth-yhteys epäonnistui");
    return { ...parsed, transport: parsed.transport || "classic" };
  }

  async send(command, timeoutMs = 2500) {
    if (!this.available()) throw new Error("Androidin Bluetooth-silta ei ole käytettävissä");
    const raw = String(this.bridge.send(String(command), Number(timeoutMs)));
    if (raw.startsWith("__ERROR__")) throw new Error(raw.slice(9));
    if (raw.startsWith("__TIMEOUT__")) {
      const error = new Error(`Aikakatkaisu: ${command}`);
      error.partialRaw = raw.slice(11);
      throw error;
    }
    return raw;
  }

  async disconnect() { if (this.available()) this.bridge.disconnect(); }
  isConnected() { return Boolean(this.available() && this.bridge.isConnected()); }

  async exportCsv(filename, content, mimeType = "text/csv") {
    if (!this.available() || !this.bridge.exportCsv) return null;
    const result = String(this.bridge.exportCsv(filename, content, mimeType));
    if (result.startsWith("__ERROR__")) throw new Error(result.slice(9));
    return result;
  }

  async shareCsv(uri, prompt, title = "Lexus OBD koeajodatan analyysi", mimeType = "text/csv") {
    if (!this.available() || !this.bridge.shareCsv) return null;
    const result = String(this.bridge.shareCsv(String(uri), String(prompt), String(title), String(mimeType)));
    if (result.startsWith("__ERROR__")) throw new Error(result.slice(9));
    return result;
  }
}

export class NativeBleElmTransport extends NativeElmTransport {
  constructor(nativeBridge = globalThis.bleObd) {
    super(nativeBridge);
    this.connectionEvents = [];
  }

  available() {
    return Boolean(this.bridge?.scanDevices && this.bridge?.connect && this.bridge?.send);
  }

  async scanDevices(timeoutMs = 4000) {
    if (!this.available()) return [];
    const result = String(this.bridge.scanDevices(Number(timeoutMs)));
    if (result.startsWith("__ERROR__")) throw new Error(result.slice(9));
    try {
      return JSON.parse(result || "[]").map(device => ({ ...device, transport: "ble" }));
    } catch {
      throw new Error("BLE-laitelistan vastausta ei voitu tulkita");
    }
  }

  addConnectionEvent(message) {
    this.connectionEvents.push(`${new Date().toISOString()} ${message}`);
    if (this.connectionEvents.length > 160) this.connectionEvents.splice(0, this.connectionEvents.length - 160);
  }

  async connect(address) {
    if (!this.available()) throw new Error("Androidin BLE-silta ei ole käytettävissä");
    this.bridge.disconnect?.();
    await delay(220);
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt++) {
      this.addConnectionEvent(`GATT-yhteysyritys ${attempt}/2 osoitteeseen ${address}`);
      const result = String(this.bridge.connect(address));
      let parsed;
      try { parsed = JSON.parse(result); } catch { parsed = { ok: false, error: result || "BLE-yhteys epäonnistui" }; }
      if (parsed.ok) {
        this.addConnectionEvent(`GATT valmis: ${parsed.transportProfile || "tuntematon profiili"}`);
        await delay(150);
        let negotiated = {};
        try {
          const diagnostics = await this.diagnostics();
          negotiated = {
            payloadSize: diagnostics.payloadSize,
            writeType: diagnostics.writeType,
            cccdValue: diagnostics.cccdValue,
            notificationEnabled: diagnostics.notificationEnabled,
            transportProfile: diagnostics.transportProfile || parsed.transportProfile,
            gattUuids: diagnostics.gattUuids || parsed.gattUuids,
            writeUuid: diagnostics.writeUuid || parsed.writeUuid,
            notifyUuid: diagnostics.notifyUuid || parsed.notifyUuid
          };
        } catch {}
        return { ...parsed, ...negotiated, transport: "ble" };
      }
      lastError = new Error(parsed.error || "BLE-yhteys epäonnistui");
      this.addConnectionEvent(`GATT-yritys ${attempt} epäonnistui: ${lastError.message}`);
      const retryable = /GATT|133|8|19|62|aikakatka|katkesi|connect/i.test(lastError.message);
      if (attempt === 2 || !retryable) break;
      this.bridge.disconnect?.();
      this.addConnectionEvent("Vanha GATT suljettu; hallittu uudelleenyhdistäminen 700 ms kuluttua");
      await delay(700);
    }
    throw lastError || new Error("BLE-yhteys epäonnistui");
  }

  async sendBinary(hex, timeoutMs = 2200) {
    if (!this.available()) throw new Error("Androidin BLE-silta ei ole käytettävissä");
    const raw = String(this.bridge.send(String(hex), Number(timeoutMs)));
    if (raw.startsWith("__ERROR__")) throw new Error(raw.slice(9));
    if (raw.startsWith("__TIMEOUT__")) {
      const error = new Error("Quicklynks-kysely aikakatkaistiin");
      const rawPartialHex = raw.slice(11);
      let notificationHex = "";
      try { notificationHex = (await this.diagnostics()).responseChunksHex || ""; } catch {}
      const normalization = normalizeQuicklynksNotificationChunks(notificationHex, rawPartialHex);
      error.partialHex = normalization.normalizedHex;
      error.rawPartialHex = rawPartialHex;
      error.continuationMarkersStripped = normalization.continuationMarkersStripped;
      this.addConnectionEvent(`Aikakatkaisu; osittainen RX ${error.partialHex || "(tyhjä)"}`);
      throw error;
    }
    let notificationHex = "";
    try { notificationHex = (await this.diagnostics()).responseChunksHex || ""; } catch {}
    const normalization = normalizeQuicklynksNotificationChunks(notificationHex, raw);
    if (normalization.continuationMarkersStripped) {
      this.addConnectionEvent(`Koottu ${normalization.rawChunkCount} BLE-palaa; poistettu ${normalization.continuationMarkersStripped} FF-jatkomerkkiä`);
    }
    return normalization.normalizedHex || raw;
  }

  async disconnect() {
    this.addConnectionEvent("GATT-yhteyden hallittu sulkeminen");
    await super.disconnect();
  }

  async diagnostics() {
    if (!this.bridge?.diagnostics) return { nativeDiagnostics: false };
    const result = String(this.bridge.diagnostics());
    if (result.startsWith("__ERROR__")) throw new Error(result.slice(9));
    try {
      return { nativeDiagnostics: true, ...JSON.parse(result || "{}"), connectionEvents: [...this.connectionEvents] };
    } catch {
      throw new Error("BLE-diagnostiikan vastausta ei voitu tulkita");
    }
  }
}

export class QuicklynksClient {
  constructor(transport, onTraffic = () => {}, onDiagnostic = () => {}) {
    this.transport = transport;
    this.onTraffic = onTraffic;
    this.onDiagnostic = onDiagnostic;
    this.queue = Promise.resolve();
    this.connected = false;
    this.binaryQuicklynks = true;
    this.adapterIdentity = "Quicklynks BK-BLE-1.0";
    this.protocolIdentity = "Quicklynks-binääriprotokolla";
    this.supportedPids = new Set([
      0x04,
      0x05,
      0x0c,
      0x0d,
      ...QUICKLYNKS_PRODUCTION_GROUPS.flatMap(group => group.fields.map(field => field.identifier)),
      "adapterVoltage",
      "quicklynksField80",
      "quicklynksTripDistance",
      "quicklynksRuntime",
      "boostPressure"
    ]);
    this.lastRealtime = null;
    this.lastRealtimeAt = 0;
    this.frameBuffer = new QuicklynksFrameBuffer(event => this.onDiagnostic(event));
    this.productionValues = {};
    this.productionGroupState = new Map(
      QUICKLYNKS_PRODUCTION_GROUPS.map(group => [group.id, {
        nextAt: 0,
        pausedUntil: 0,
        consecutiveFailures: 0,
        lastError: ""
      }])
    );
    this.optionalStandardCursor = 0;
    this.optionalStandardNextAt = 0;
    this.optionalStandardState = new Map(
      QUICKLYNKS_OPTIONAL_STANDARD_PIDS.map(config => [config.pid, {
        nextAt: 0,
        supported: false,
        consecutiveFailures: 0,
        lastError: ""
      }])
    );
  }

  enqueue(task) {
    const next = this.queue.catch(() => {}).then(task);
    this.queue = next.catch(() => {});
    return next;
  }

  adoptConnection(transportInfo) {
    if (!transportInfo?.binaryProtocol) {
      throw new Error("FFF0/FFF6 Quicklynks-binääriprofiilia ei tunnistettu");
    }
    this.connected = true;
    this.productionValues = {};
    for (const groupState of this.productionGroupState.values()) {
      groupState.nextAt = 0;
      groupState.pausedUntil = 0;
      groupState.consecutiveFailures = 0;
      groupState.lastError = "";
    }
    this.optionalStandardCursor = 0;
    this.optionalStandardNextAt = 0;
    for (const optionalState of this.optionalStandardState.values()) {
      optionalState.nextAt = 0;
      optionalState.supported = false;
      optionalState.consecutiveFailures = 0;
      optionalState.lastError = "";
    }
    this.adapterIdentity = transportInfo.name === "OBD" ? "Quicklynks BK-BLE-1.0 · OBD" : (transportInfo.name || this.adapterIdentity);
    return {
      ...transportInfo,
      adapter: this.adapterIdentity,
      protocol: this.protocolIdentity
    };
  }

  async disconnect() {
    this.connected = false;
    this.frameBuffer.reset();
    this.lastRealtime = null;
    this.productionValues = {};
    this.optionalStandardNextAt = 0;
    await this.transport.disconnect();
  }

  async readSupportedPids() {
    return new Set(this.supportedPids);
  }

  async queryRealtime(timeout = 2200) {
    return this.enqueue(async () => {
      if (!this.connected || !this.transport.isConnected()) throw new Error("Quicklynks BLE -yhteys on katkennut");
      const timestamp = Date.now();
      this.onTraffic({ direction: "tx", command: QUICKLYNKS_LIVE_QUERY_HEX, hex: QUICKLYNKS_LIVE_QUERY_HEX, timestamp, binary: true });
      let raw;
      try {
        raw = await this.transport.sendBinary(QUICKLYNKS_LIVE_QUERY_HEX, timeout);
      } catch (error) {
        if (error.partialHex) this.frameBuffer.push(error.partialHex);
        this.onDiagnostic({ type: "timeout", message: error.message, raw: error.partialHex || "" });
        throw error;
      }
      this.onTraffic({ direction: "rx", command: QUICKLYNKS_LIVE_QUERY_HEX, raw, cleaned: raw, hex: raw, timestamp: Date.now(), binary: true });
      const frames = this.frameBuffer.push(raw);
      let parsedRealtime = null;
      for (const frame of frames) {
        try {
          const parsed = parseQuicklynksRealtimeFrame(frame);
          if (parsed.type === "realtime") {
            parsedRealtime = parsed;
            this.onDiagnostic({
              type: "parsed",
              message: `Jäsennys: RPM ${parsed.rpm} rpm, nopeus ${parsed.speed} km/h, neste ${parsed.coolant} °C, adapterijännite ${parsed.adapterVoltage.toFixed(2)} V, kuorma ${parsed.load.toFixed(1)} %, Quicklynks-kenttä 80 ${parsed.quicklynksField80.toFixed(1)}, ajomatka ${parsed.quicklynksTripDistance} km, käyntiaika ${parsed.quicklynksRuntime} s; tulkitsematta ${parsed.unknownHex || "(ei kenttää)"}`,
              raw: parsed.rawHex
            });
          } else {
            this.onDiagnostic({ type: "unknown", message: `Tuntematon vastaustyyppi ${hexByte(parsed.responseType)}`, raw: parsed.rawHex });
          }
        } catch (error) {
          this.onDiagnostic({ type: "invalid", message: `Virheellinen kehys hylättiin: ${error.message}`, raw: bytesToHex(frame) });
        }
      }
      if (!parsedRealtime) {
        throw new Error(`Täydellistä 41-tyypin Quicklynks-kehystä ei saatu${this.frameBuffer.pendingHex() ? `; puskurissa ${this.frameBuffer.pendingHex()}` : ""}`);
      }
      this.lastRealtime = parsedRealtime;
      this.lastRealtimeAt = Date.now();
      return parsedRealtime;
    });
  }

  async queryProductionGroup(groupOrId, timeout = QUICKLYNKS_PRODUCTION_TIMEOUT_MS) {
    const group = resolveQuicklynksProductionGroup(groupOrId);
    const requestHex = buildQuicklynksProductionQuery(group);
    const groupState = this.productionGroupState.get(group.id);

    return this.enqueue(async () => {
      if (!this.connected || !this.transport.isConnected()) {
        throw new Error("Quicklynks BLE -yhteys on katkennut");
      }

      const timestamp = Date.now();
      groupState.nextAt = timestamp + group.intervalMs;
      this.onTraffic({
        direction: "tx",
        command: requestHex,
        hex: requestHex,
        timestamp,
        binary: true,
        production: true,
        group: group.id
      });

      try {
        const raw = await this.transport.sendBinary(requestHex, timeout);
        this.onTraffic({
          direction: "rx",
          command: requestHex,
          raw,
          cleaned: raw,
          hex: raw,
          timestamp: Date.now(),
          binary: true,
          production: true,
          group: group.id
        });
        const parsed = parseQuicklynksProductionResponse(group, raw);
        const updatedAt = Date.now();
        for (const [id, value] of Object.entries(parsed.values)) {
          this.productionValues[id] = {
            value,
            raw: parsed.rawHex,
            updatedAt,
            source: `Quicklynks Mode 01 · ${group.id}`
          };
        }
        groupState.consecutiveFailures = 0;
        groupState.lastError = "";
        groupState.pausedUntil = 0;
        this.onDiagnostic({
          type: "production",
          message: `Quicklynks-${group.id}-ryhmä: ${Object.keys(parsed.values).join(", ")}`,
          raw: parsed.rawHex
        });
        return parsed;
      } catch (error) {
        groupState.consecutiveFailures += 1;
        groupState.lastError = error.message || String(error);
        if (groupState.consecutiveFailures >= 2) {
          groupState.pausedUntil = Date.now() + QUICKLYNKS_PRODUCTION_PAUSE_MS;
          groupState.nextAt = groupState.pausedUntil;
        }
        this.onDiagnostic({
          type: "production",
          message: `Quicklynks-${group.id}-ryhmä epäonnistui ${groupState.consecutiveFailures}/2${groupState.pausedUntil ? " · ryhmä tauolle 60 s" : ""}: ${groupState.lastError}`,
          raw: error.partialHex || requestHex
        });
        throw error;
      }
    });
  }

  async readPid(definition) {
    const fieldById = new Map([
      ["load", "load"],
      ["coolant", "coolant"],
      ["rpm", "rpm"],
      ["speed", "speed"],
      ["adapterVoltage", "adapterVoltage"],
      ["quicklynksField80", "quicklynksField80"],
      ["quicklynksTripDistance", "quicklynksTripDistance"],
      ["quicklynksRuntime", "quicklynksRuntime"]
    ]);
    const field = fieldById.get(definition.id);
    if (field) {
      if (!this.lastRealtime || Date.now() - this.lastRealtimeAt > 350) await this.queryRealtime();
      return {
        value: this.lastRealtime[field],
        raw: this.lastRealtime.rawHex,
        unknownHex: this.lastRealtime.unknownHex,
        updatedAt: this.lastRealtimeAt,
        ageMs: Math.max(0, Date.now() - this.lastRealtimeAt),
        source: definition.id === "quicklynksField80"
          ? "Quicklynks-kenttä 80 · merkitys ja yksikkö avoin"
          : "Quicklynks-mittarikehys"
      };
    }

    const group = QUICKLYNKS_PRODUCTION_GROUP_BY_METRIC.get(definition.id);
    if (!group) return { value: null, raw: "" };
    const groupState = this.productionGroupState.get(group.id);
    const now = Date.now();
    let warning = "";
    if (now >= groupState.nextAt && now >= groupState.pausedUntil) {
      try {
        await this.queryProductionGroup(group);
      } catch (error) {
        warning = `Quicklynks-${group.id}-ryhmä: ${error.message || String(error)}`;
      }
    }

    const cached = this.productionValues[definition.id];
    if (!cached) {
      if (warning) throw new Error(warning);
      return { value: null, raw: "", warning: groupState.lastError || "" };
    }
    return {
      ...cached,
      ageMs: Math.max(0, Date.now() - cached.updatedAt),
      warning
    };
  }

  async pollOptionalStandardMetrics(timeout = QUICKLYNKS_OPTIONAL_STANDARD_TIMEOUT_MS) {
    const now = Date.now();
    if (!this.connected || !this.transport.isConnected()) return null;
    if (now < this.optionalStandardNextAt) return null;

    let config = null;
    for (let offset = 0; offset < QUICKLYNKS_OPTIONAL_STANDARD_PIDS.length; offset++) {
      const index = (this.optionalStandardCursor + offset) % QUICKLYNKS_OPTIONAL_STANDARD_PIDS.length;
      const candidate = QUICKLYNKS_OPTIONAL_STANDARD_PIDS[index];
      const candidateState = this.optionalStandardState.get(candidate.pid);
      if (now >= Number(candidateState?.nextAt || 0)) {
        config = candidate;
        this.optionalStandardCursor = (index + 1) % QUICKLYNKS_OPTIONAL_STANDARD_PIDS.length;
        break;
      }
    }
    if (!config) return null;

    this.optionalStandardNextAt = now + QUICKLYNKS_OPTIONAL_STANDARD_INTERVAL_MS;
    const requestHex = buildQuicklynksOptionalStandardQuery(config);
    const optionalState = this.optionalStandardState.get(config.pid);

    return this.enqueue(async () => {
      const timestamp = Date.now();
      this.onTraffic({
        direction: "tx",
        command: requestHex,
        hex: requestHex,
        timestamp,
        binary: true,
        optionalStandard: true,
        group: `std-${config.pidHex}`
      });
      try {
        const raw = await this.transport.sendBinary(requestHex, timeout);
        this.onTraffic({
          direction: "rx",
          command: requestHex,
          raw,
          cleaned: raw,
          hex: raw,
          timestamp: Date.now(),
          binary: true,
          optionalStandard: true,
          group: `std-${config.pidHex}`
        });
        const parsed = parseQuicklynksOptionalStandardResponse(config, raw);
        const updatedAt = Date.now();
        const wasSupported = optionalState.supported;
        optionalState.supported = true;
        optionalState.consecutiveFailures = 0;
        optionalState.lastError = "";
        optionalState.nextAt = updatedAt + config.intervalMs;
        const results = Object.entries(parsed.values).map(([id, value]) => ({
          definition: PID_BY_ID[id],
          value,
          raw: parsed.rawHex,
          updatedAt,
          ageMs: 0,
          source: `Quicklynks standardi Mode 01 PID ${config.pidHex}`
        })).filter(result => result.definition);
        for (const result of results) this.supportedPids.add(result.definition.id);
        this.onDiagnostic({
          type: "optional-standard",
          message: `Standardi diesel-PID ${config.pidHex} (${config.label}): ${results.map(result => result.definition.short).join(", ")}`,
          raw: parsed.rawHex
        });
        return {
          pid: config.pid,
          pidHex: config.pidHex,
          label: config.label,
          discovered: !wasSupported,
          results,
          warning: ""
        };
      } catch (error) {
        optionalState.consecutiveFailures += 1;
        optionalState.lastError = error.message || String(error);
        optionalState.nextAt = Date.now() + QUICKLYNKS_OPTIONAL_STANDARD_RETRY_MS;
        this.onDiagnostic({
          type: "optional-standard",
          message: `Standardi diesel-PID ${config.pidHex} (${config.label}) ei tuottanut hyväksyttävää vastausta; uusi yritys myöhemmin: ${optionalState.lastError}`,
          raw: error.partialHex || requestHex
        });
        return {
          pid: config.pid,
          pidHex: config.pidHex,
          label: config.label,
          discovered: false,
          results: [],
          warning: optionalState.lastError
        };
      }
    });
  }

  async probeSupportBitmap(probeOrIdentifier, timeout = QUICKLYNKS_SUPPORT_BITMAP_TIMEOUT_MS) {
    const probe = resolveQuicklynksSupportBitmapProbe(probeOrIdentifier);
    const requestHex = buildQuicklynksSupportBitmapQuery(probe);

    return this.enqueue(async () => {
      const timestamp = Date.now();
      const event = {
        timestamp,
        identifier: probe.identifier,
        identifierHex: probe.identifierHex,
        group: "support_bitmap_candidate",
        candidateLabel: probe.label,
        requestServiceHex: "01",
        queryTypeHex: "41",
        expectedResponseTypeHex: "41",
        requestHex,
        responseHex: "",
        durationMs: 0,
        outcome: "error",
        frameCount: 0,
        responseTypeHex: "",
        payloadHex: "",
        pendingHex: "",
        error: ""
      };

      if (!this.connected || !this.transport.isConnected()) {
        event.outcome = "disconnected";
        event.error = "Quicklynks BLE -yhteys ei ollut käytettävissä tukibittikyselylle";
        return event;
      }

      this.onTraffic({
        direction: "tx",
        command: requestHex,
        hex: requestHex,
        timestamp,
        binary: true,
        research: true,
        supportBitmap: true
      });

      try {
        event.responseHex = await this.transport.sendBinary(requestHex, timeout);
      } catch (error) {
        event.responseHex = String(error.partialHex || "");
        event.error = error.message || String(error);
        event.outcome = /aikakatka|timeout/i.test(event.error) ? "timeout" : "error";
      }
      event.durationMs = Date.now() - timestamp;

      if (event.responseHex) {
        this.onTraffic({
          direction: "rx",
          command: requestHex,
          raw: event.responseHex,
          cleaned: event.responseHex,
          hex: event.responseHex,
          timestamp: Date.now(),
          binary: true,
          research: true,
          supportBitmap: true
        });
        const parsed = parseQuicklynksResearchResponse(event.responseHex);
        event.frameCount = parsed.frames.length;
        event.responseTypeHex = parsed.frames.map(frame => frame.responseTypeHex).filter(Boolean).join("|");
        event.payloadHex = parsed.frames.map(frame => frame.payloadHex).filter(Boolean).join("|");
        event.pendingHex = parsed.pendingHex;
        if (!event.error && parsed.frames.length) event.outcome = "response";
        else if (!event.error) {
          event.outcome = "invalid";
          event.error = parsed.error || `Tukibittikandidaatille ${probe.identifierHex} ei saatu täydellistä kehystä`;
        }
      }

      this.onDiagnostic({
        type: "support-bitmap",
        message: `Tukibittikandidaatti ${probe.identifierHex}: ${event.outcome}${event.error ? ` · ${event.error}` : ""}`,
        raw: event.responseHex || requestHex
      });
      return event;
    });
  }

  async probeResearchIdentifier(probeOrIdentifier, timeout = QUICKLYNKS_RESEARCH_TIMEOUT_MS) {
    const probe = resolveQuicklynksResearchProbe(probeOrIdentifier);
    const requestHex = buildQuicklynksResearchQuery(probe);

    return this.enqueue(async () => {
      const timestamp = Date.now();
      const event = {
        timestamp,
        identifier: probe.identifier,
        identifierHex: probe.identifierHex,
        group: probe.group,
        candidateLabel: probe.candidateLabel,
        requestServiceHex: hexByte(probe.requestService),
        queryTypeHex: probe.queryTypeHex,
        expectedResponseTypeHex: probe.responseTypeHex,
        requestHex,
        responseHex: "",
        durationMs: 0,
        outcome: "error",
        frameCount: 0,
        responseTypeHex: "",
        payloadHex: "",
        pendingHex: "",
        error: ""
      };

      if (!this.connected || !this.transport.isConnected()) {
        event.outcome = "disconnected";
        event.error = "Quicklynks BLE -yhteys ei ollut käytettävissä tutkimuspyynnölle";
        this.onDiagnostic({
          type: "research",
          message: `PID-tutkimus ${probe.identifierHex}: ei yhteyttä; pyyntöä ei lähetetty`,
          raw: requestHex
        });
        return event;
      }

      this.onTraffic({
        direction: "tx",
        command: requestHex,
        hex: requestHex,
        timestamp,
        binary: true,
        research: true
      });

      try {
        event.responseHex = await this.transport.sendBinary(requestHex, timeout);
      } catch (error) {
        event.responseHex = String(error.partialHex || "");
        event.error = error.message || String(error);
        event.outcome = /aikakatka|timeout/i.test(event.error) ? "timeout" : "error";
      }
      event.durationMs = Date.now() - timestamp;

      if (event.responseHex) {
        this.onTraffic({
          direction: "rx",
          command: requestHex,
          raw: event.responseHex,
          cleaned: event.responseHex,
          hex: event.responseHex,
          timestamp: Date.now(),
          binary: true,
          research: true
        });
        const parsed = parseQuicklynksResearchResponse(event.responseHex);
        event.frameCount = parsed.frames.length;
        event.responseTypeHex = parsed.frames.map(frame => frame.responseTypeHex).filter(Boolean).join("|");
        event.payloadHex = parsed.frames.map(frame => frame.payloadHex).filter(Boolean).join("|");
        event.pendingHex = parsed.pendingHex;
        const expected = parsed.frames.find(frame =>
          frame.responseTypeHex === probe.responseTypeHex &&
          frame.followingLength !== 0x13 &&
          frame.payloadHex !== "" &&
          frame.payloadHex !== "00" &&
          frame.rawHex !== requestHex
        );
        if (!event.error && expected) event.outcome = "response";
        else if (!event.error) {
          event.outcome = "invalid";
          event.error = parsed.error || `PIDille ${probe.identifierHex} ei saatu hyväksyttävää lyhyttä ${probe.responseTypeHex}-payload-vastausta`;
        }
      }

      const resultText = event.outcome === "response"
        ? `${event.frameCount} kehystä · tyyppi ${event.responseTypeHex || "ei tyyppiä"} · hyötydata ${event.payloadHex || "(tyhjä)"}`
        : `${event.outcome}${event.error ? ` · ${event.error}` : ""}`;
      this.onDiagnostic({
        type: "research",
        message: `PID-tutkimus ${probe.identifierHex}: ${resultText}`,
        raw: event.responseHex || requestHex
      });
      return event;
    });
  }

  async command() {
    throw new Error("Quicklynks-binääriprotokolla käyttää vain varmennettua mittarikehystä; ELM327-komentoa ei lähetetty");
  }
}

function bitmapForRange(supported, start) {
  const bytes = [0, 0, 0, 0];
  for (let bit = 0; bit < 32; bit++) {
    if (supported.has(start + bit + 1)) bytes[Math.floor(bit / 8)] |= 1 << (7 - bit % 8);
  }
  return bytes.map(hexByte).join("");
}

export class FakeElmTransport {
  constructor() {
    this.connected = false;
    this.startTime = Date.now();
    this.supported = new Set([0x01, ...PID_DEFINITIONS.map(def => def.pid).filter(Number.isInteger), 0x20, 0x40, 0x60]);
    this.currentHeader = "7E0";
  }

  available() { return true; }
  async pairedDevices() { return [{ name: "Simulaattori", address: "FAKE:IS220D", simulated: true }]; }
  async connect() { this.connected = true; this.startTime = Date.now(); this.currentHeader = "7E0"; await delay(180); return { ok: true, name: "Lexus-simulaattori", address: "FAKE:IS220D" }; }
  async disconnect() { this.connected = false; }
  isConnected() { return this.connected; }
  async exportCsv() { return "SIMULOITU"; }

  async send(command) {
    if (!this.connected) throw new Error("Simulaattori ei ole yhdistetty");
    await delay(25 + Math.random() * 35);
    const cmd = String(command).replace(/\s+/g, "").toUpperCase();
    if (cmd === "ATZ") return "ELM327 v2.1\r>";
    if (cmd === "ATI") return "ELM327 v2.1 (LEXUS FLEX SIM)\r>";
    if (cmd === "ATDP") return "AUTO, ISO 15765-4 (CAN 11/500)\r>";
    if (cmd.startsWith("ATSH") && cmd.length >= 7) {
      this.currentHeader = cmd.slice(4);
      return "OK\r>";
    }
    if (cmd.startsWith("AT")) return "OK\r>";
    if (cmd === "0101") return "41 01 81 07 A0 01\r>";
    if (cmd === "03") return "43 04 01 00 00\r>";
    if (cmd === "07") return "47 00 87 00 00\r>";
    if (cmd === "0A") return "4A 00 00\r>";
    if (cmd === "13B0") return "53 00\r>";
    if (cmd === "0902" && this.currentHeader === "7E0") {
      return "7E8 10 14 49 02 01 4A 54 48\r7E8 21 42 42 32 36 32 33 30\r7E8 22 32 30 32 38 37 38 37\r>";
    }
    if (cmd === "21C1" && this.currentHeader === "7E2") return "NO DATA\r>";
    if (cmd === "2101" && this.currentHeader === "7E2") return `61 01 ${Array(21).fill("00").join(" ")} 99\r>`;
    if (cmd === "2181") {
      const blocks = Array.from({ length: 14 }, (_, index) => hexWord(11790 + (index % 5) * 9)).flatMap(word => word.match(/../g));
      return `61 81 ${blocks.join(" ")}\r>`;
    }
    if (cmd === "2187") {
      const temperatures = [24.5, 31.1, 32.0, 31.6].flatMap(value => hexWord((value + 50) * 256).match(/../g));
      return `61 87 ${temperatures.join(" ")}\r>`;
    }
    if (cmd === "2195") return `61 95 ${Array.from({ length: 14 }, (_, index) => hexByte(24 + index % 3)).join(" ")}\r>`;
    if (cmd === "2198") {
      const currentA = Math.sin((Date.now() - this.startTime) / 1000 * 0.72) * 35;
      return `61 98 ${hexWord((currentA + 327.68) * 100).match(/../g).join(" ")} 4E B2 04 78 7C 74\r>`;
    }
    if (cmd === "217E" && this.currentHeader === "7E0") return "61 7E 0A 04 02 00\r>";
    if (cmd === "217F" && this.currentHeader === "7E0") return "61 7F 01 00 01 20\r>";
    if (cmd === "212C" && this.currentHeader === "7E0") return "61 2C 80\r>";
    if (cmd === "04") return "44\r>";
    if (cmd === "0202") return "42 02 04 01\r>";
    if (/^01(00|20|40|60)$/.test(cmd)) {
      const start = parseInt(cmd.slice(2), 16);
      return `41 ${cmd.slice(2)} ${bitmapForRange(this.supported, start).match(/../g).join(" ")}\r>`;
    }
    if (/^01[0-9A-F]{2}$/.test(cmd)) return this.fakePid(parseInt(cmd.slice(2), 16));
    return "NO DATA\r>";
  }

  fakePid(pid) {
    const t = (Date.now() - this.startTime) / 1000;
    const wave = Math.sin(t * 0.72);
    const rpm = 820 + Math.max(0, wave) * 2100 + Math.sin(t * 2.1) * 55;
    const speed = Math.max(0, (rpm - 800) / 34);
    const coolant = Math.min(88, 58 + t / 18);
    const maf = 8.2 + rpm / 115 + Math.max(0, wave) * 22;
    const map = 99 + Math.max(0, wave) * 92;
    const rail = 31000 + Math.max(0, wave) * 105000;
    const fuelRate = 0.8 + Math.max(0, wave) * 7.4;
    const values = {
      0x04: [hexByte(32 + Math.max(0, wave) * 160)],
      0x05: [hexByte(coolant + 40)],
      0x06: [hexByte(128 + Math.sin(t * 0.2) * 4)],
      0x07: [hexByte(128 + Math.sin(t * 0.08) * 3)],
      0x0b: [hexByte(map)],
      0x0c: hexWord(rpm * 4).match(/../g),
      0x0d: [hexByte(speed)],
      0x0f: [hexByte(27 + 40)],
      0x10: hexWord(maf * 100).match(/../g),
      0x11: [hexByte(18 + Math.max(0, wave) * 95)],
      0x1f: hexWord(t).match(/../g),
      0x21: ["00", "00"],
      0x23: hexWord(rail / 10).match(/../g),
      0x2c: [hexByte(45 - Math.max(0, wave) * 28)],
      0x2d: [hexByte(128 + Math.sin(t * .3) * 5)],
      0x30: ["0C"],
      0x31: ["01", "D4"],
      0x33: ["65"],
      0x42: hexWord(14.18 * 1000).match(/../g),
      0x49: [hexByte(18 + Math.max(0, wave) * 95)],
      0x4a: [hexByte(28 + Math.max(0, wave) * 105)],
      0x4c: [hexByte(50 + Math.max(0, wave) * 100)],
      0x4d: ["00", "00"],
      0x4e: ["05", "A0"],
      0x5c: [hexByte(Math.min(94, 52 + t / 22) + 40)],
      0x5e: hexWord(fuelRate * 20).match(/../g)
    };
    const bytes = values[pid];
    if (!bytes) return "NO DATA\r>";
    return `41 ${hexByte(pid)} ${bytes.join(" ")}\r>`;
  }
}

const ELM_PROFILE_SETUP_COMMANDS = new Set([
  "ATSP6",
  "ATTP6",
  "ATCAF0",
  "ATCAF1",
  "ATCFC0",
  "ATCFC1",
  "ATAL",
  "ATH0",
  "ATH1",
  "ATS0",
  "ATS1",
  "ATAT1",
  "ATAT2",
  "ATST32",
  "ATSTFF"
]);

function normalizeElmCommand(command) {
  return String(command || "").replace(/\s+/g, "").toUpperCase();
}

function validateEcuHeader(header, label) {
  const normalized = normalizeElmCommand(header);
  if (!/^[0-9A-F]{3}(?:[0-9A-F]{5})?$/.test(normalized)) throw new Error(`${label} on virheellinen: ${normalized || "(tyhjä)"}`);
  return normalized;
}

export class Elm327Client {
  constructor(transport, onTraffic = () => {}, onState = () => {}, options = {}) {
    this.transport = transport;
    this.onTraffic = onTraffic;
    this.onState = onState;
    this.wait = typeof options.wait === "function" ? options.wait : delay;
    this.timing = {
      transportSettleMs: options.transportSettleMs ?? 1800,
      resetSettleMs: options.resetSettleMs ?? 1800,
      protocolSettleMs: options.protocolSettleMs ?? 900,
      retrySettleMs: options.retrySettleMs ?? 2500
    };
    this.queue = Promise.resolve();
    this.connected = false;
    this.ecuConnected = false;
    this.ecuProbeRaw = "";
    this.ecuError = "";
    this.adapterIdentity = "";
    this.adapterProfile = classifyAdapterDevice({ name: "", transport: "classic" });
    this.transportInfo = {};
    this.protocolIdentity = "";
    this.connectionStrategy = "";
    this.supportedPids = new Set();
    this.pidResponseCache = new Map();
    this.toyotaLiveMetricIds = new Set();
    this.toyotaResponseCache = new Map();
    this.toyotaQueryForms = new Map();
    this.discoveryDiagnostics = [];
    this.elmRestoreFailed = false;
    this.ecuTransactionSequence = 0;
    this.vehicleKey = options.vehicleKey === VEHICLE_KEYS.AUTO
      ? VEHICLE_KEYS.AUTO
      : getVehicleProfile(options.vehicleKey)
        ? options.vehicleKey
        : VEHICLE_KEYS.IS220D;
  }

  setVehicleKey(vehicleKey) {
    const normalized = String(vehicleKey || "").toLowerCase();
    this.vehicleKey = getVehicleProfile(normalized) ? normalized : VEHICLE_KEYS.AUTO;
    this.toyotaLiveMetricIds.clear();
    this.toyotaResponseCache.clear();
    this.toyotaQueryForms.clear();
    this.discoveryDiagnostics = [];
    return this.vehicleKey;
  }

  enqueue(task) {
    const next = this.queue.catch(() => {}).then(task);
    this.queue = next.catch(() => {});
    return next;
  }

  async connect(address, protocol = "auto") {
    const transportInfo = await this.transport.connect(address);
    this.onState({ stage: "bluetooth", status: "connected", message: "Bluetooth-yhteys muodostettu", transportInfo });
    await this.wait(Math.max(0, Number(this.timing.transportSettleMs) || 0));
    return this.initializeConnected(transportInfo, protocol);
  }

  async initializeConnected(transportInfo, protocol = "auto") {
    this.elmRestoreFailed = false;
    this.transportInfo = { ...(transportInfo || {}) };
    this.connected = true;
    this.ecuConnected = false;
    this.ecuProbeRaw = "";
    this.ecuError = "";
    this.connectionStrategy = "";
    this.pidResponseCache.clear();
    this.toyotaLiveMetricIds.clear();
    this.toyotaResponseCache.clear();
    try {
      this.onState({ stage: "elm", status: "testing", message: "Tarkistetaan ELM327 muuttamatta nykyisiä asetuksia" });
      let resetApplied = false;
      try {
        this.adapterIdentity = cleanElmResponse(await this.command("ATI", 5000), "ATI").split("\n")[0] || "ELM327";
      } catch (identityError) {
        this.onState({ stage: "elm", status: "testing", message: `ATI ei vastannut (${identityError.message}); tehdään hidas ELM-nollaus` });
        const resetRaw = await this.command("ATZ", 6000);
        resetApplied = true;
        await this.wait(Math.max(0, Number(this.timing.resetSettleMs) || 0));
        this.adapterIdentity = cleanElmResponse(resetRaw, "ATZ").split("\n")[0] ||
          cleanElmResponse(await this.command("ATI", 5000), "ATI").split("\n")[0] || "ELM327";
      }
      this.onState({ stage: "elm", status: "connected", message: this.adapterIdentity });
      this.adapterProfile = classifyAdapterDevice({
        name: transportInfo?.name || this.adapterIdentity,
        address: transportInfo?.address || "",
        transport: transportInfo?.transport || (transportInfo?.transportProfile ? "ble" : "classic")
      });

      let ecu = await this.tryEngineEcuProbe(
        "Testataan 0100 ensin adapterin nykyisillä asetuksilla",
        "current",
        12000
      );

      if (!ecu.connected) {
        this.onState({ stage: "ecu", status: "retry", message: "Nykyiset asetukset eivät vastanneet; aloitetaan klooniturvallinen hidas alustus" });
        if (!resetApplied) {
          await this.command("ATZ", 6000);
          await this.wait(Math.max(0, Number(this.timing.resetSettleMs) || 0));
        }
        await this.configureCloneSafeBase();
        ecu = await this.probeEngineEcu(protocol);
      }

      if (ecu.connected) await this.configureLiveDefaults();
      try {
        this.protocolIdentity = cleanElmResponse(await this.command("ATDP", 3500), "ATDP").split("\n")[0] || "Tuntematon";
      } catch {
        this.protocolIdentity = protocol === "can6" ? "ISO 15765-4 CAN 11/500 (pakotettu)" : "Automaattinen";
      }
      return {
        ...(transportInfo || {}),
        adapter: this.adapterIdentity,
        adapterProfile: this.adapterProfile,
        protocol: this.protocolIdentity,
        ecuConnected: ecu.connected,
        ecuProbeRaw: ecu.raw,
        ecuError: ecu.error,
        connectionStrategy: this.connectionStrategy,
        supportedPids: new Set(ecu.supportedPids || [])
      };
    } catch (error) {
      this.onState({ stage: "elm", status: "error", message: error.message });
      await this.disconnect();
      throw error;
    }
  }

  async configureCloneSafeBase() {
    await this.command("ATE0");
    await this.command("ATL0");
    await this.command("ATS0");
    await this.command("ATH0");
    await this.command("ATAT2");
    await this.command("ATSTFF");
  }

  async configureLiveDefaults() {
    for (const command of ["ATE0", "ATL0", "ATS0", "ATH0", "ATAT1", "ATST32"]) {
      try { await this.command(command); } catch {}
    }
  }

  async tryEngineEcuProbe(label, strategy, timeoutMs = 15000) {
    this.onState({ stage: "ecu", status: "testing", message: label, strategy });
    try {
      const raw = await this.command("0100", timeoutMs);
      if (!hasModePidResponse(raw, 0x41, 0x00)) {
        const error = new Error("ECU:n 0100-vastauksesta ei löytynyt 41 00 -tukibittikarttaa");
        error.raw = raw;
        throw error;
      }
      const supportedPids = parseSupportedPids(raw, 0x00);
      this.ecuConnected = true;
      this.ecuProbeRaw = raw;
      this.ecuError = "";
      this.supportedPids = new Set(supportedPids);
      this.connectionStrategy = strategy;
      this.onState({ stage: "ecu", status: "connected", message: `Moottori-ECU vastasi 0100-kyselyyn (${supportedPids.size} tukibittiä) · ${strategy}`, strategy });
      return { connected: true, raw, error: "", supportedPids, strategy };
    } catch (error) {
      return {
        connected: false,
        raw: error.raw || error.partialRaw || "",
        error: error.message,
        supportedPids: new Set(),
        strategy
      };
    }
  }

  async tryEngineEcuSeries({ label, strategy, attempts, timeoutMs, retrySettleMs = this.timing.retrySettleMs }) {
    let last = { connected: false, raw: "", error: "ECU ei vastannut", supportedPids: new Set(), strategy };
    for (let attempt = 1; attempt <= attempts; attempt++) {
      last = await this.tryEngineEcuProbe(`${label} · yritys ${attempt}/${attempts}`, strategy, timeoutMs);
      if (last.connected) return last;
      if (attempt < attempts) {
        this.onState({ stage: "ecu", status: "retry", message: `${label} ei vastannut; odotetaan ennen yritystä ${attempt + 1}/${attempts}`, strategy });
        await this.wait(Math.max(0, Number(retrySettleMs) || 0));
      }
    }
    return last;
  }

  async tryProtocolCommand(command, label) {
    this.onState({ stage: "ecu", status: "retry", message: label });
    try {
      await this.command(command, 5000);
      await this.wait(Math.max(0, Number(this.timing.protocolSettleMs) || 0));
      return true;
    } catch (error) {
      this.onState({ stage: "ecu", status: "retry", message: `${command} ei onnistunut (${error.message}); jatketaan seuraavaan polkuun` });
      return false;
    }
  }

  async probeEngineEcu(protocol = "auto") {
    let last = { connected: false, raw: "", error: "ECU ei vastannut", supportedPids: new Set(), strategy: "" };

    if (protocol === "auto" && await this.tryProtocolCommand("ATSP0", "Käynnistetään pitkä automaattinen protokollahaku ilman otsake- tai vastaanottosuodatinta")) {
      await this.command("ATAT2");
      last = await this.tryEngineEcuSeries({
        label: "Automaattinen protokollahaku",
        strategy: "auto-sp0",
        attempts: 4,
        timeoutMs: 20000
      });
      if (last.connected) return last;
    }

    if (await this.tryProtocolCommand("ATTP6", "Kokeillaan CAN 11/500 -protokollaa väliaikaisesti komennolla ATTP6")) {
      await this.command("ATAT2");
      last = await this.tryEngineEcuSeries({
        label: "Väliaikainen CAN 11/500",
        strategy: "try-can6",
        attempts: 2,
        timeoutMs: 15000,
        retrySettleMs: 1800
      });
      if (last.connected) return last;
    }

    if (await this.tryProtocolCommand("ATSP6", "Pakotetaan CAN 11/500 komennolla ATSP6")) {
      await this.command("ATAT1");
      last = await this.tryEngineEcuSeries({
        label: "Pakotettu CAN 11/500",
        strategy: "forced-can6",
        attempts: 2,
        timeoutMs: 15000,
        retrySettleMs: 1800
      });
      if (last.connected) return last;
    }

    this.ecuConnected = false;
    this.ecuProbeRaw = last.raw || "";
    this.ecuError = last.error || "ECU ei vastannut yhteenkään yhteyspolkuun";
    this.connectionStrategy = "none";
    this.onState({ stage: "ecu", status: "error", message: this.ecuError, raw: this.ecuProbeRaw });
    return {
      connected: false,
      raw: this.ecuProbeRaw,
      error: this.ecuError,
      supportedPids: new Set(),
      strategy: "none"
    };
  }

  async disconnect() {
    this.connected = false;
    this.ecuConnected = false;
    this.supportedPids.clear();
    this.pidResponseCache.clear();
    this.toyotaLiveMetricIds.clear();
    this.toyotaResponseCache.clear();
    await this.transport.disconnect();
  }

  async transmitQueuedCommand(cmd, timeout = 2500, transactionId = "") {
    if (this.elmRestoreFailed) {
      const error = new Error("ELM-asetusten palautus epäonnistui; yhdistä uudelleen");
      error.code = "ELM_RESTORE_FAILED";
      throw error;
    }
    const command = normalizeElmCommand(cmd);
    this.onTraffic({ direction: "tx", command, transactionId, timestamp: Date.now() });
    let raw;
    try {
      raw = await this.transport.send(command, timeout);
    } catch (error) {
      const partialRaw = error?.partialRaw || "";
      this.onTraffic({ direction: "rx", command, transactionId, raw: partialRaw, cleaned: cleanElmResponse(partialRaw, command), error: error.message, timestamp: Date.now() });
      throw error;
    }
    const cleaned = cleanElmResponse(raw, command);
    this.onTraffic({ direction: "rx", command, transactionId, raw, cleaned, timestamp: Date.now() });
    const error = detectElmError(cleaned);
    if (error) {
      const commandError = new Error(`${error} (${command})`);
      commandError.raw = raw;
      throw commandError;
    }
    return raw;
  }

  command(command, timeout = 2500) {
    const cmd = normalizeElmCommand(command);
    return this.enqueue(() => this.transmitQueuedCommand(cmd, timeout));
  }

  readVehicleIdentification({ timeoutMs = 9000 } = {}) {
    const safeTimeoutMs = Math.max(1000, Math.min(20000, Number(timeoutMs) || 9000));
    const transactionId = `VIN-${String(++this.ecuTransactionSequence).padStart(5, "0")}`;
    return this.enqueue(async () => {
      try {
        try { await this.transmitQueuedCommand("ATCRA", 3500, transactionId); } catch {}
        await this.transmitQueuedCommand("ATSH7E0", 4500, transactionId);
        return await this.transmitQueuedCommand("0902", safeTimeoutMs, transactionId);
      } finally {
        try { await this.transmitQueuedCommand("ATCRA", 3500, transactionId); } catch {}
        try { await this.transmitQueuedCommand("ATSH7E0", 4500, transactionId); } catch {}
      }
    });
  }

  runReadOnlyEcuTransaction({
    requestHeader,
    responseHeader = "",
    setupCommands = [],
    restoreSetupCommands = [],
    requests = [],
    clearResponseFilter = true,
    cleanupResponseFilter = true,
    continueOnReadError = false,
    label = "Lexus read-only ECU",
    profileKey = this.vehicleKey,
    restoreRequestHeader = ""
  } = {}) {
    const txHeader = validateEcuHeader(requestHeader, "ECU-pyyntöotsake");
    const rxHeader = responseHeader ? validateEcuHeader(responseHeader, "ECU-vastausotsake") : "";
    const restoreHeader = restoreRequestHeader
      ? validateEcuHeader(restoreRequestHeader, "ECU-palautusotsake")
      : profileKey === VEHICLE_KEYS.CT200H && txHeader !== "7E0"
        ? "7E0"
        : "";
    const setup = setupCommands.map(normalizeElmCommand);
    const restoreSetup = restoreSetupCommands.map(normalizeElmCommand);
    for (const command of [...setup, ...restoreSetup]) {
      if (!ELM_PROFILE_SETUP_COMMANDS.has(command)) throw new Error(`ECU-transaktion turvallisuussallintalista esti asetuskomennon ${command || "(tyhjä)"}`);
    }
    if (!Array.isArray(requests) || !requests.length) throw new Error("ECU-transaktiossa pitää olla vähintään yksi lukupyyntö");
    const normalizedRequests = requests.map(request => {
      const descriptor = typeof request === "string" ? { command: request } : { ...(request || {}) };
      const command = normalizeElmCommand(descriptor.command);
      if (!isProfileReadOnlyCommand(command, profileKey)) throw new Error(`ECU-transaktion turvallisuussallintalista esti pyynnön ${command || "(tyhjä)"}`);
      return {
        ...descriptor,
        command,
        timeoutMs: Math.max(1, Number(descriptor.timeoutMs) || 5000)
      };
    });

    const transactionId = `ECU-${String(++this.ecuTransactionSequence).padStart(5, "0")}`;
    return this.enqueue(async () => {
      const startedAt = Date.now();
      const responses = [];
      try {
        for (const command of setup) await this.transmitQueuedCommand(command, 4500, transactionId);
        if (clearResponseFilter && !rxHeader) {
          try { await this.transmitQueuedCommand("ATCRA", 3500, transactionId); } catch {}
        }
        await this.transmitQueuedCommand(`ATSH${txHeader}`, 4500, transactionId);
        if (rxHeader) await this.transmitQueuedCommand(`ATCRA${rxHeader}`, 4500, transactionId);
        for (const request of normalizedRequests) {
          const requestStartedAt = Date.now();
          try {
            const raw = await this.transmitQueuedCommand(request.command, request.timeoutMs, transactionId);
            responses.push(Object.freeze({
              command: request.command,
              raw,
              error: "",
              responseClass: classifyDiagnosticResponse({ raw, expectedService: request.service }).kind,
              durationMs: Math.max(0, Date.now() - requestStartedAt),
              requestHeader: txHeader,
              responseHeader: rxHeader,
              transactionId
            }));
          } catch (error) {
            const raw = error?.raw || error?.partialRaw || "";
            const outcome = classifyDiagnosticResponse({ raw, error: error?.message || String(error), expectedService: request.service });
            responses.push(Object.freeze({
              command: request.command,
              raw,
              error: error?.message || String(error),
              responseClass: outcome.kind,
              durationMs: Math.max(0, Date.now() - requestStartedAt),
              requestHeader: txHeader,
              responseHeader: rxHeader,
              transactionId
            }));
            if (!continueOnReadError || outcome.kind === "disconnected") throw error;
          }
        }
      } catch (error) {
        error.transactionId = transactionId;
        error.requestHeader = txHeader;
        error.responseHeader = rxHeader;
        throw error;
      } finally {
        let restoreError = null;
        for (const command of restoreSetup) {
          try { await this.transmitQueuedCommand(command, 3500, transactionId); }
          catch (error) { restoreError ||= error; }
        }
        if (rxHeader && cleanupResponseFilter) {
          try { await this.transmitQueuedCommand("ATCRA", 3500, transactionId); }
          catch (error) { if (restoreSetup.length) restoreError ||= error; }
        }
        if (restoreHeader && restoreHeader !== txHeader) {
          try { await this.transmitQueuedCommand(`ATSH${restoreHeader}`, 4500, transactionId); } catch {}
        }
        if (restoreError) {
          this.elmRestoreFailed = true;
          this.ecuConnected = false;
          const error = new Error(`ELM-asetusten palautus epäonnistui; yhdistä uudelleen: ${restoreError.message}`);
          error.code = "ELM_RESTORE_FAILED";
          throw error;
        }
      }
      return Object.freeze({
        transactionId,
        label,
        requestHeader: txHeader,
        responseHeader: rxHeader,
        restoredRequestHeader: restoreHeader,
        startedAt,
        endedAt: Date.now(),
        responses: Object.freeze(responses)
      });
    });
  }

  async readSupportedPids() {
    const all = new Set();
    this.discoveryDiagnostics = [];
    let start = 0x00;
    for (let range = 0; range < 6; range++) {
      let raw;
      try {
        raw = await this.command(`01${hexByte(start)}`, 3200);
        if ((findModePidBytes(raw, 0x41, start)?.length || 0) < 4) {
          throw new Error(`01${hexByte(start)}: puutteellinen tukibittivastaus`);
        }
      } catch (error) {
        this.discoveryDiagnostics.push({ command: `01${hexByte(start)}`, error: error.message });
        if (start === 0x00 || /socket|closed|disconnect|katke|suljettu/i.test(error.message)) throw error;
        break;
      }
      const supported = parseSupportedPids(raw, start);
      supported.forEach(pid => all.add(pid));
      const next = start + 0x20;
      if (!supported.has(next)) break;
      start = next;
    }
    if (getVehicleProfile(this.vehicleKey)) {
      try {
        const toyotaMetricIds = await this.discoverToyotaLiveMetrics();
        toyotaMetricIds.forEach(id => all.add(id));
      } catch (error) {
        this.discoveryDiagnostics.push({ command: "Toyota-live", error: error.message });
        if (error.code === "ELM_RESTORE_FAILED" || /socket|closed|disconnect|katke|suljettu/i.test(error.message)) throw error;
      }
    }
    this.supportedPids = all;
    this.ecuConnected = true;
    return all;
  }

  async discoverToyotaLiveMetrics() {
    const discovered = new Set();
    this.toyotaLiveMetricIds.clear();
    this.toyotaResponseCache.clear();
    this.toyotaQueryForms.clear();
    const profile = getVehicleProfile(this.vehicleKey);
    const probes = getVehicleReadDataProbes(this.vehicleKey, { liveOnly: true });
    if (!profile || !probes.length) return discovered;
    const requestHeader = probes[0].requestHeader;
    const transaction = await this.runReadOnlyEcuTransaction({
      requestHeader,
      setupCommands: ["ATSP6", "ATCAF1", "ATCFC1", "ATAL", "ATH0", "ATS0"],
      requests: probes.map(probe => ({
        command: probe.command,
        service: probe.service,
        timeoutMs: 6000
      })),
      continueOnReadError: true,
      label: `${profile.profileVersion} · Toyota-livearvojen tunnistus`,
      profileKey: this.vehicleKey
    });

    for (let result of transaction.responses) {
      const probe = getProfileReadDataProbe(result.command, this.vehicleKey);
      if (!probe) continue;
      let queryForm = "formatted";
      let decoded = !result.error && decodeToyotaReadDataResponse(result.raw, probe.identifier, this.vehicleKey);
      if (!decoded?.complete && this.vehicleKey === VEHICLE_KEYS.IS220D) {
        this.discoveryDiagnostics.push({ command: probe.command, queryForm: "formatted", raw: result.raw, error: result.error || "Puutteellinen vastaus" });
        const fallback = await this.readIs220dRawLiveProbe(probe, 6000);
        queryForm = "raw-single-frame";
        result = fallback.responses[0];
        decoded = !result?.error && decodeToyotaReadDataResponse(result?.raw, probe.identifier, this.vehicleKey);
        if (decoded?.complete) this.toyotaQueryForms.set(probe.command, "raw-single-frame");
      }
      this.discoveryDiagnostics.push({ command: probe.command, queryForm,
        raw: result?.raw || "", complete: Boolean(decoded?.complete), error: result?.error || (!decoded?.complete ? "Puutteellinen vastaus" : "") });
      if (!decoded?.complete) continue;
      this.toyotaResponseCache.set(probe.command, {
        raw: result.raw,
        decoded,
        updatedAt: Date.now(),
        error: "",
        transactionId: result.transactionId || transaction.transactionId
      });
      for (const definition of PID_DEFINITIONS) {
        if (!metricSupportsVehicle(definition, this.vehicleKey)) continue;
        if (definition.toyotaCommand !== probe.command || !definition.toyotaValueKey) continue;
        const value = decoded.values?.[definition.toyotaValueKey];
        if (value == null) continue;
        try { this.validateToyotaMetricValue(probe, definition, Number(value)); discovered.add(definition.id); }
        catch (error) { this.discoveryDiagnostics.push({ command: probe.command, metricId: definition.id, error: error.message }); }
      }
    }
    this.toyotaLiveMetricIds = discovered;
    return new Set(discovered);
  }

  async readVehicleSpecificDtcs({ includeResearchCandidates = false } = {}) {
    const requests = getVehicleDtcRequests(this.vehicleKey).filter(request =>
      includeResearchCandidates || request.evidence !== "research-candidate"
    );
    if (!requests.length) return Object.freeze({ vehicleKey: this.vehicleKey, groups: Object.freeze([]), notes: Object.freeze([]), transactionIds: Object.freeze([]), transactionId: "" });
    const requestSets = new Map();
    for (const request of requests) {
      const key = `${request.requestHeader}/${request.responseHeader || ""}`;
      if (!requestSets.has(key)) requestSets.set(key, []);
      requestSets.get(key).push(request);
    }
    const transactions = [];
    for (const groupedRequests of requestSets.values()) {
      transactions.push(await this.runReadOnlyEcuTransaction({
        requestHeader: groupedRequests[0].requestHeader,
        responseHeader: groupedRequests[0].responseHeader,
        setupCommands: transactions.length ? [] : ["ATSP6", "ATCAF1", "ATCFC1", "ATAL", "ATH0", "ATS0"],
        requests: groupedRequests.map(request => ({
          command: request.command,
          service: request.service,
          timeoutMs: 7000
        })),
        continueOnReadError: true,
        label: `${vehicleDisplayName(this.vehicleKey)} · ${groupedRequests[0].ecuId || "ECU"} vikakoodit`,
        profileKey: this.vehicleKey
      }));
    }
    const groups = [];
    const notes = [];
    for (const transaction of transactions) {
      const groupedRequests = requests.filter(request =>
        request.requestHeader === transaction.requestHeader && (request.responseHeader || "") === transaction.responseHeader
      );
      for (const [index, request] of groupedRequests.entries()) {
        const response = transaction.responses[index];
        const outcome = response && !response.error
          ? classifyDiagnosticResponse({ raw: response.raw, positivePrefix: hexByte(request.responseService) })
          : null;
        if (!response || response.error || outcome?.kind !== "positive-response") {
          notes.push(`${request.label}: ${response?.error || outcome?.description || "kelvollinen vastaus puuttui"}`);
          continue;
        }
        groups.push(Object.freeze({
          id: request.id,
          ecuId: request.ecuId,
          label: request.label,
          command: request.command,
          requestHeader: request.requestHeader,
          responseHeader: request.responseHeader,
          evidence: request.evidence,
          validatedOnCt200h: request.validatedOnCt200h !== false,
          validResponse: true,
          codes: Object.freeze(parseCountedDtcResponse(response.raw, request.responseService, request.label)),
          raw: response.raw,
          transactionId: transaction.transactionId
        }));
      }
    }
    const transactionIds = Object.freeze(transactions.map(transaction => transaction.transactionId));
    return Object.freeze({
      vehicleKey: this.vehicleKey,
      groups: Object.freeze(groups),
      notes: Object.freeze(notes),
      transactionIds,
      transactionId: transactionIds[0] || ""
    });
  }

  async readToyotaProbeResponse(probe, timeoutMs = 5000) {
    if (!probe || !isProfileReadOnlyCommand(probe.command, this.vehicleKey)) {
      throw new Error(`Toyota-livearvon turvallisuussallintalista esti komennon ${probe?.command || "(tyhjä)"}`);
    }
    const now = Date.now();
    let entry = this.toyotaResponseCache.get(probe.command);
    const fromCache = Boolean(entry && now - entry.updatedAt < probe.cacheMaxAgeMs);
    if (!fromCache) {
      try {
        const transaction = this.toyotaQueryForms.get(probe.command) === "raw-single-frame"
          ? await this.readIs220dRawLiveProbe(probe, timeoutMs)
          : await this.runReadOnlyEcuTransaction({
          requestHeader: probe.requestHeader,
          requests: [{ command: probe.command, service: probe.service, timeoutMs: Math.max(1, Number(timeoutMs) || 5000) }],
          label: `${probe.id} · live-luku`,
          profileKey: this.vehicleKey
        });
        const raw = transaction.responses[0]?.raw || "";
        const decoded = decodeToyotaReadDataResponse(raw, probe.identifier, this.vehicleKey);
        if (!decoded?.complete) {
          const decodeError = new Error(`Toyota ${probe.command} -vastaus jäi lyhyeksi tai puuttui`);
          decodeError.raw = raw;
          decodeError.transactionId = transaction.transactionId;
          throw decodeError;
        }
        entry = { raw, decoded, updatedAt: Date.now(), error: "", transactionId: transaction.transactionId };
      } catch (error) {
        entry = {
          raw: error.raw || error.partialRaw || "",
          decoded: null,
          updatedAt: Date.now(),
          error: error.message || String(error),
          code: error.code || "",
          transactionId: error.transactionId || ""
        };
      }
      this.toyotaResponseCache.set(probe.command, entry);
    }
    if (entry.error) {
      const error = new Error(entry.error);
      error.code = entry.code;
      error.raw = entry.raw || "";
      error.transactionId = entry.transactionId || "";
      throw error;
    }
    return { ...entry, fromCache };
  }

  async readIs220dRawLiveProbe(probe, timeoutMs = 5000) {
    const verified = getVehicleReadDataProbes(this.vehicleKey, { liveOnly: true }).find(item => item.command === probe?.command);
    if (this.vehicleKey !== VEHICLE_KEYS.IS220D || !verified?.rawCommand || verified.rawCommand !== probe.rawCommand) {
      throw new Error("Raaka live-varapyyntö ei kuulu IS220d-tuotantoprofiiliin");
    }
    return this.runReadOnlyEcuTransaction({
      requestHeader: verified.requestHeader, responseHeader: verified.responseHeader,
      setupCommands: ["ATSP6", "ATCAF0", "ATCFC0", "ATAL", "ATH1", "ATS1"],
      restoreSetupCommands: ["ATCAF1", "ATCFC1", "ATH0", "ATS0"],
      requests: [{ command: verified.rawCommand, service: verified.service, timeoutMs }],
      continueOnReadError: true, profileKey: this.vehicleKey, label: `${verified.command} · raaka live-varapyyntö`
    });
  }

  validateToyotaMetricValue(probe, definition, value) {
    if (!Number.isFinite(value)) throw new Error(`Toyota ${probe.command} ei sisältänyt arvoa ${definition.toyotaValueKey}`);
    const field = probe.fields.find(candidate => candidate.valueKey === definition.toyotaValueKey);
    const range = field?.plausibleRange;
    if (Array.isArray(range) && range.length === 2 && (value < range[0] || value > range[1])) {
      const error = new Error(`Toyota ${probe.command} palautti arvon ${value}, joka on mittarin ${definition.id} järkevyysalueen ${range[0]}…${range[1]} ulkopuolella`);
      error.code = "IMPLAUSIBLE_VALUE";
      error.metricId = definition.id;
      error.value = value;
      error.plausibleRange = [...range];
      throw error;
    }
    return value;
  }

  async readToyotaLiveMetric(definition, timeoutMs = 5000) {
    if (!this.toyotaLiveMetricIds.has(definition.id)) {
      throw new Error(`Toyota-livearvoa ${definition.id} ei ole varmennettu tällä yhteydellä`);
    }
    const command = String(definition.toyotaCommand || "").toUpperCase();
    const probe = getProfileReadDataProbe(command, this.vehicleKey);
    if (!probe || !isProfileReadOnlyCommand(command, this.vehicleKey)) {
      throw new Error(`Toyota-livearvon turvallisuussallintalista esti komennon ${command || "(tyhjä)"}`);
    }
    const entry = await this.readToyotaProbeResponse(probe, timeoutMs);
    const rawValue = entry.decoded?.values?.[definition.toyotaValueKey];
    const value = rawValue == null ? NaN : Number(rawValue);
    try {
      this.validateToyotaMetricValue(probe, definition, value);
    } catch (error) {
      error.raw = entry.raw || "";
      error.transactionId = entry.transactionId || "";
      throw error;
    }
    return { value, raw: entry.raw, updatedAt: entry.updatedAt, transactionId: entry.transactionId || "", source: `Toyota ${command} · ${vehicleDisplayName(this.vehicleKey)}` };
  }

  async readMetricGroup(definitions, timeoutMs = null) {
    const group = Array.isArray(definitions) ? definitions.filter(Boolean) : [];
    if (!group.length) throw new Error("Mittariryhmä on tyhjä");
    const first = group[0];

    if (first.toyotaCommand) {
      const command = String(first.toyotaCommand).replace(/\s+/g, "").toUpperCase();
      if (group.some(definition => String(definition.toyotaCommand || "").replace(/\s+/g, "").toUpperCase() !== command)) {
        throw new Error("Toyota-mittariryhmässä on useita eri lukupyyntöjä");
      }
      for (const definition of group) {
        if (!this.toyotaLiveMetricIds.has(definition.id)) throw new Error(`Toyota-livearvoa ${definition.id} ei ole varmennettu tällä yhteydellä`);
      }
      const probe = getProfileReadDataProbe(command, this.vehicleKey);
      if (!probe) throw new Error(`Toyota-mittariryhmän turvallisuussallintalista esti komennon ${command || "(tyhjä)"}`);
      const entry = await this.readToyotaProbeResponse(probe, timeoutMs ?? 5000);
      let results;
      try {
        results = group.map(definition => {
          const rawValue = entry.decoded?.values?.[definition.toyotaValueKey];
          const value = rawValue == null ? NaN : Number(rawValue);
          this.validateToyotaMetricValue(probe, definition, value);
          return Object.freeze({
            definition,
            value,
            raw: entry.raw,
            updatedAt: entry.updatedAt,
            transactionId: entry.transactionId || "",
            source: `Toyota ${command} · ${vehicleDisplayName(this.vehicleKey)}`
          });
        });
      } catch (error) {
        error.raw = entry.raw || "";
        error.transactionId = entry.transactionId || "";
        throw error;
      }
      return Object.freeze({
        command,
        updatedAt: entry.updatedAt,
        raw: entry.raw,
        transportAttempted: !entry.fromCache,
        results: Object.freeze(results),
        missingMetricIds: Object.freeze([])
      });
    }

    if (!Number.isInteger(first.pid) || group.some(definition => definition.pid !== first.pid)) {
      throw new Error("Mode 01 -mittariryhmässä on useita eri PID-lähteitä");
    }
    const command = `01${hexByte(first.pid)}`;
    const raw = await this.command(command, Math.max(1, Number(timeoutMs) || 2200));
    const updatedAt = Date.now();
    this.pidResponseCache.set(first.pid, { raw, updatedAt });
    const results = [];
    const missingMetricIds = [];
    for (const definition of group) {
      const value = decodePidResponse(definition.id, raw);
      if (!Number.isFinite(value)) {
        missingMetricIds.push(definition.id);
        continue;
      }
      results.push(Object.freeze({ definition, value, raw, updatedAt, source: `Mode 01 ${hexByte(first.pid)}` }));
    }
    if (!results.length) {
      const decodeError = new Error(`Mode 01 ${hexByte(first.pid)} -vastaus ei sisältänyt yhtään ryhmän arvoa`);
      decodeError.raw = raw;
      throw decodeError;
    }
    return Object.freeze({
      command,
      updatedAt,
      raw,
      transportAttempted: true,
      results: Object.freeze(results),
      missingMetricIds: Object.freeze(missingMetricIds)
    });
  }

  async readPid(definition) {
    if (definition?.toyotaCommand) return this.readToyotaLiveMetric(definition);
    const now = Date.now();
    const cached = this.pidResponseCache.get(definition.pid);
    let raw;
    if (cached && now - cached.updatedAt <= 250) {
      raw = cached.raw;
    } else {
      raw = await this.command(`01${hexByte(definition.pid)}`, 2200);
      this.pidResponseCache.set(definition.pid, { raw, updatedAt: Date.now() });
    }
    return { value: decodePidResponse(definition.id, raw), raw };
  }
}

function isQuicklynksSession(session) {
  return /quicklynks/i.test(`${session?.adapter || ""} ${session?.protocol || ""}`);
}

const flex036QuicklynksMetricCache = new WeakMap();

function hasFlex036QuicklynksMetrics(session) {
  if (!session || typeof session !== "object") return false;
  if (flex036QuicklynksMetricCache.has(session)) return flex036QuicklynksMetricCache.get(session);
  const result = Boolean(session?.samples?.some(sample =>
    sample?.values && (
      Object.hasOwn(sample.values, "adapterVoltage") ||
      Object.hasOwn(sample.values, "quicklynksField80")
    )
  ));
  flex036QuicklynksMetricCache.set(session, result);
  return result;
}

export function sessionMetricValue(session, sample, id) {
  const quicklynks = isQuicklynksSession(session);
  const values = sample?.values || {};
  if (id === "fuelRate" && quicklynks) return undefined;
  if (id === "voltage" && quicklynks && !hasFlex036QuicklynksMetrics(session)) return undefined;
  if (id === "adapterVoltage" && quicklynks) return values.adapterVoltage ?? values.voltage;
  if (id === "quicklynksField80" && quicklynks) {
    return values.quicklynksField80 ?? values.adapterMaf ?? values.fuelRate;
  }
  const direct = values[id];
  if (direct != null) return direct;
  return undefined;
}

export function sessionMetricAgeMs(session, sample, id) {
  const ages = sample?.valueAgesMs || {};
  const quicklynks = isQuicklynksSession(session);
  if (id === "adapterVoltage" && quicklynks) return ages.adapterVoltage ?? ages.voltage;
  if (id === "quicklynksField80" && quicklynks) {
    return ages.quicklynksField80 ?? ages.adapterMaf ?? ages.fuelRate;
  }
  const age = ages[id];
  return Number.isFinite(age) ? age : undefined;
}

export function sessionToCsv(session) {
  const definitions = PID_DEFINITIONS.filter(def =>
    session.samples?.some(sample => sessionMetricValue(session, sample, def.id) != null)
  );
  const header = [
    "schema_version",
    "app_version",
    "vehicle",
    "vehicle_key",
    "vehicle_profile_version",
    "adapter",
    "protocol",
    "session_started_at",
    "session_ended_at",
    "session_note",
    "timestamp",
    "elapsed_ms",
    "sample_gap_ms",
    "poll_source_count",
    "poll_attempts",
    "poll_hits",
    "poll_cache_hits",
    "poll_misses",
    "poll_loss_percent",
    "poll_max_miss_streak",
    "poll_latency_ewma_ms",
    ...definitions.flatMap(def => [def.id, `${def.id}_unit`, `${def.id}_age_ms`]),
    "marker",
    "connection",
    "error"
  ];
  const markerMap = new Map((session.markers || []).map(marker => [marker.timestamp, marker.label || "Tapahtuma"]));
  const rows = [header];
  let previousTimestamp = null;
  for (const sample of session.samples || []) {
    const marker = sample.marker || markerMap.get(sample.timestamp) || "";
    const poll = sample.pollQuality || {};
    const row = [
      session.schemaVersion || 3,
      session.appVersion || "0.4.3",
      session.vehicle || "Lexus IS220d 2008 · 2AD-FHV",
      session.vehicleKey || "is220d",
      session.vehicleProfileVersion || "legacy",
      session.adapter || "",
      session.protocol || "",
      new Date(session.startedAt).toISOString(),
      session.endedAt ? new Date(session.endedAt).toISOString() : "",
      session.note || "",
      new Date(sample.timestamp).toISOString(),
      sample.timestamp - session.startedAt,
      previousTimestamp == null ? "" : sample.timestamp - previousTimestamp,
      poll.sourceCount ?? "",
      poll.attempts ?? "",
      poll.hits ?? "",
      poll.cacheHits ?? "",
      poll.misses ?? "",
      Number.isFinite(poll.lossPercent) ? finnishCsvNumber(poll.lossPercent) : "",
      poll.maxMissStreak ?? "",
      Number.isFinite(poll.latencyEwmaMs) ? finnishCsvNumber(poll.latencyEwmaMs) : "",
      ...definitions.flatMap(def => [
        finnishCsvNumber(sessionMetricValue(session, sample, def.id)),
        def.unit,
        sessionMetricAgeMs(session, sample, def.id) ?? ""
      ]),
      marker,
      sample.connected === false ? "disconnected" : "connected",
      sample.error || ""
    ];
    rows.push(row);
    previousTimestamp = sample.timestamp;
  }
  return `\uFEFF${rows.map(row => row.map(csvCell).join(";")).join("\r\n")}`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function finnishCsvNumber(value) {
  if (!Number.isFinite(value)) return "";
  return String(value).replace(".", ",");
}

function firstQuicklynksRawHex(sample) {
  const values = Object.values(sample?.raw || {})
    .map(value => String(value || "").replace(/\s+/g, "").toUpperCase())
    .filter(value => value && /^[0-9A-F]+$/.test(value) && value.length % 2 === 0);
  return values[0] || "";
}

export function sessionToQuicklynksResearchCsv(session) {
  const research = session?.quicklynksResearch;
  const events = research?.events || [];
  const definitions = PID_DEFINITIONS.filter(def =>
    session.samples?.some(sample => sessionMetricValue(session, sample, def.id) != null) ||
    events.some(event => Number.isFinite(sessionMetricValue(session, { values: event?.context?.values || {} }, def.id)))
  );
  const header = [
    "research_schema_version",
    "app_version",
    "vehicle",
    "vehicle_key",
    "vehicle_profile_version",
    "adapter",
    "protocol",
    "session_started_at",
    "session_ended_at",
    "record_type",
    "timestamp",
    "elapsed_ms",
    "sample_gap_ms",
    "probe_sequence",
    "probe_group",
    "identifier_hex",
    "request_service_hex",
    "quicklynks_query_type_hex",
    "expected_response_type_hex",
    "candidate_label",
    "request_hex",
    "outcome",
    "duration_ms",
    "response_hex",
    "response_frame_count",
    "response_type_hex",
    "payload_hex",
    "pending_hex",
    ...definitions.flatMap(def => [def.id, `${def.id}_unit`, `${def.id}_age_ms`]),
    "live_frame_hex",
    "marker",
    "connection",
    "error"
  ];

  const common = [
    research?.schemaVersion || 6,
    session.appVersion || "0.4.3",
    session.vehicle || "Lexus IS220d 2008 · 2AD-FHV",
    session.vehicleKey || "is220d",
    session.vehicleProfileVersion || "legacy",
    session.adapter || "",
    session.protocol || "",
    new Date(session.startedAt).toISOString(),
    session.endedAt ? new Date(session.endedAt).toISOString() : ""
  ];
  const markerMap = new Map((session.markers || []).map(marker => [marker.timestamp, marker.label || "Tapahtuma"]));
  const records = [];
  let previousSampleTimestamp = null;

  for (const sample of session.samples || []) {
    const timestamp = sample.timestamp;
    const marker = sample.marker || markerMap.get(timestamp) || "";
    records.push({
      timestamp,
      order: 0,
      row: [
        ...common,
        "sample",
        new Date(timestamp).toISOString(),
        timestamp - session.startedAt,
        previousSampleTimestamp == null ? "" : timestamp - previousSampleTimestamp,
        "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
        ...definitions.flatMap(def => [
          finnishCsvNumber(sessionMetricValue(session, sample, def.id)),
          def.unit,
          sessionMetricAgeMs(session, sample, def.id) ?? ""
        ]),
        firstQuicklynksRawHex(sample),
        marker,
        sample.connected === false ? "disconnected" : "connected",
        sample.error || ""
      ]
    });
    previousSampleTimestamp = timestamp;
  }

  for (const [index, event] of events.entries()) {
    const timestamp = event.timestamp || session.startedAt;
    const values = event.context?.values || {};
    const contextSample = {
      values,
      valueAgesMs: event.context?.valueAgesMs || {}
    };
    records.push({
      timestamp,
      order: 1,
      row: [
        ...common,
        "pid_probe",
        new Date(timestamp).toISOString(),
        timestamp - session.startedAt,
        "",
        event.sequence || index + 1,
        event.group || "",
        event.identifierHex || "",
        event.requestServiceHex || "",
        event.queryTypeHex || "",
        event.expectedResponseTypeHex || "",
        event.candidateLabel || "",
        event.requestHex || "",
        event.outcome || "",
        event.durationMs ?? "",
        event.responseHex || "",
        event.frameCount ?? "",
        event.responseTypeHex || "",
        event.payloadHex || "",
        event.pendingHex || "",
        ...definitions.flatMap(def => [
          finnishCsvNumber(sessionMetricValue(session, contextSample, def.id)),
          def.unit,
          sessionMetricAgeMs(session, contextSample, def.id) ?? ""
        ]),
        event.context?.liveFrameHex || "",
        "",
        event.context?.connected === false ? "disconnected" : "connected",
        event.error || ""
      ]
    });
  }

  records.sort((a, b) => a.timestamp - b.timestamp || a.order - b.order);
  const rows = [header, ...records.map(record => record.row)];
  return `\uFEFF${rows.map(row => row.map(csvCell).join(";")).join("\r\n")}`;
}

export function calculateSessionStats(session) {
  const result = {};
  for (const def of PID_DEFINITIONS) {
    const values = (session.samples || []).map(sample => sessionMetricValue(session, sample, def.id)).filter(Number.isFinite);
    if (!values.length) continue;
    result[def.id] = {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((sum, value) => sum + value, 0) / values.length
    };
  }
  return result;
}

export function buildAiAnalysisPrompt(session) {
  const samples = session.samples || [];
  const ctSession = session.vehicleKey === VEHICLE_KEYS.CT200H || /CT\s*200h|ZWA10/i.test(session.vehicle || "");
  const available = PID_DEFINITIONS.filter(def =>
    samples.some(sample => Number.isFinite(sessionMetricValue(session, sample, def.id)))
  );
  const gaps = samples.slice(1).map((sample, index) => sample.timestamp - samples[index].timestamp);
  const maxGap = gaps.length ? Math.max(...gaps) : 0;
  const errors = samples.filter(sample => sample.error).length;
  const disconnects = samples.filter(sample => sample.connected === false).length;
  const pollSnapshots = samples.map(sample => sample.pollQuality).filter(Boolean);
  const lastPoll = pollSnapshots[pollSnapshots.length - 1] || session.pollingSummary || null;
  const markers = (session.markers || []).map(marker =>
    `- ${new Date(marker.timestamp).toISOString()}: ${marker.label || "Tapahtuma"}`
  );
  const started = new Date(session.startedAt).toISOString();
  const ended = session.endedAt ? new Date(session.endedAt).toISOString() : "ei tallennettu";
  const durationSeconds = Math.max(0, Math.round(((session.endedAt || session.startedAt) - session.startedAt) / 1000));

  return [
    "Analysoi liitteenä oleva Lexus OBD Flex -koeajo-CSV mahdollisten vikojen ja jatkotutkimustarpeiden löytämiseksi.",
    "",
    "Ajoneuvo ja tallennus:",
    `- Auto: ${session.vehicle || "Lexus IS220d 2008 · 2AD-FHV, 2,2 D-CAT"}`,
    `- Adapteri: ${session.adapter || "ei tietoa"}`,
    `- Protokolla: ${session.protocol || "ei tietoa"}`,
    `- Aikaväli: ${started} – ${ended}`,
    `- Kesto: ${durationSeconds} s; näytteitä: ${samples.length}`,
    `- Tallennusvirheitä: ${errors}; disconnected-rivejä: ${disconnects}; pisin näyteväli: ${maxGap} ms`,
    lastPoll
      ? `- Pollauksen laatu lopussa: onnistuneet ${lastPoll.hits || 0}/${lastPoll.attempts || 0}; välimuistiosumat ${lastPoll.cacheHits || 0}; mittauskato ${Number(lastPoll.lossPercent || 0).toFixed(1)} %; pisin peräkkäinen kato ${lastPoll.maxMissStreak || 0}; EWMA-vaste ${Number.isFinite(lastPoll.latencyEwmaMs) ? `${Math.round(lastPoll.latencyEwmaMs)} ms` : "ei tietoa"}.`
      : "- Pollauksen laatumetadataa ei ole (vanha tallenne tai Quicklynksin erillinen binääriajoitus).",
    `- Kuljettajan kuvaus/oire: ${session.note || "ei annettu"}`,
    "",
    `CSV:n mittarit: ${available.map(def => `${def.id} = ${def.name} (${def.unit})`).join(", ") || "ei mittareita"}.`,
    "Tyhjä arvo tarkoittaa puuttuvaa mittausta, ei nollaa. sample_gap_ms kertoo näytteiden välisen ajan ja jokaisen mittarin *_age_ms kertoo arvon iän kyseisellä näyterivillä. poll_* -sarakkeet kuvaavat lähdekohtaista pyyntömäärää, mittauskatoa, pisintä katoputkea ja vasteajan EWMA-arvoa.",
    isQuicklynksSession(session)
      ? "quicklynksField80 on Quicklynksin koontikehyksen kenttä 80. Sen merkitystä, yksikköä tai muunnosta ei ole varmennettu: se ei ole standardin PID 10 MAF eikä polttoainevirta. adapterVoltage on adapterin mittaama käyttöjännite ja voltage on erillinen ECU:n standardi-PID 42."
      : "fuelRate on standardin Mode 01 PID 5E vain silloin, kun sarake on mukana. Älä päättele puuttuvaa mittaria nollaksi.",
    ctSession
      ? "ctHvPackVoltage on 14 mitatun lohkojännitteen summa ja ctHvPackPower on johdettu jännite × virta; positiivinen ctHvCurrent/ctHvPackPower tarkoittaa purkausta. Käytä lähdearvojen ikäsarakkeita ennen hetkellisten erojen tulkintaa."
      : "boostPressure on johdettu arvo MAP − ilmanpaine, ei ECU:n ahtopainepyyntö. Käytä lähdearvojen ikäsarakkeita ennen hetkellisten erojen tulkintaa.",
    ctSession
      ? "CT-mittarit ctHvBlockVoltage01–14, ctHvInternalResistance01–14 ja TB1–TB3 tulevat vain lukevista 7E2/7EA Toyota Mode 21 -vastauksista. Quicklynks-polku ei tue näitä valmistajakohtaisia kyselyitä. Älä päättele akun kapasiteettia yhdestä jännite- tai vastusnäytteestä."
      : "DPF-, pakokaasulämpö-, EGR-, rail-, turbo- ja lambda-arvot ovat standardoituja Mode 01 -arvoja vain silloin, kun vastaava sarake on mukana. Quicklynks-polku ei lähetä Toyota Read Data 21 -kyselyitä, joten dpnr*-, toyota*- ja injectionFeedback1–4-arvoja ei saada tällä adapterilla.",
    ctSession
      ? "CSV ei sisällä hybridivian INF-lisäkoodeja, eristysvastusta, akun kapasiteettitestiä eikä Active Test -tuloksia. Älä suosittele akuston tai moduulin vaihtoa ilman vikakoodeja, kuormitettua vertailumittausta ja Lexus-korjausohjeen vahvistusta."
      : "CSV ei sisällä DPNR-noki-/tuhkamassaa, Toyota-kohtaisia suuttimien korjauksia, IMV/SCV-arvoja, Exhaust Fuel Addition Injector -palautetta tai 5. suuttimen tilaa. Niihin tarvitaan myöhemmin varmennettu RAW/CAN-, ELM327- tai J2534/Techstream-yhteys.",
    "",
    "Tee analyysi näin:",
    "1. Tarkista ensin datan eheys, näytekatkot, puuttuvat arvot ja epäuskottavat mittaukset.",
    "2. Kuvaa ajotilanteet nopeuden, kierrosluvun ja kuormituksen perusteella sekä tutki erikseen tapahtumamerkkien ympäristö.",
    "3. Etsi poikkeavat vaihtelut ja signaalien väliset yhteydet. Erottele havainto, mahdollinen selitys ja epävarmuus.",
    ctSession
      ? "4. Arvioi lohkojännitteiden eroa kuorman ja SOC:n suhteen, lämpötilojen tasaisuutta, sisäisten vastusten hajontaa sekä lataus-/purkausvirtaa. Älä väitä akkuvikaa, jota mitatut sarakkeet eivät tue."
      : "4. Arvioi, viittaako data jäähdytys-, lataus-, ilmanotto/EGR-, polttoaine-, D-CAT/DPNR- tai voimansiirto-ongelmaan. Älä väitä vikaa, jota mitatut sarakkeet eivät tue.",
    "5. Anna priorisoitu johtopäätös: todennäköinen / mahdollinen / ei näyttöä tästä aineistosta.",
    "6. Ehdota seuraavat turvalliset mittaukset ja kerro täsmällisesti, mitä lisä-PIDejä tai Techstream-arvoja tarvitaan päätelmän vahvistamiseen.",
    "7. Nosta mahdollinen ajon keskeyttämistä vaativa löydös selvästi esiin. Älä ehdota osien vaihtoa pelkän korrelaation perusteella.",
    "",
    markers.length ? `Tapahtumamerkit:\n${markers.join("\n")}` : "Tapahtumamerkkejä ei ole."
  ].join("\n");
}

export function buildQuicklynksResearchAiPrompt(session) {
  const research = session?.quicklynksResearch || {};
  const events = research.events || [];
  const responses = events.filter(event => event.outcome === "response").length;
  const timeouts = events.filter(event => event.outcome === "timeout").length;
  const completed = Math.min(research.nextProbeIndex || events.length, research.totalProbes || QUICKLYNKS_RESEARCH_PROBES.length);

  return [
    buildAiAnalysisPrompt(session),
    "",
    "Quicklynks PID -tutkimuskerros:",
    `- Tutkimusviennin skeema: ${research.schemaVersion || 6}; suunnitelma: ${research.planId || "quicklynks-read41-payload-v6-no-active-test"}.`,
    `- Suoritettu ${completed}/${research.totalProbes || QUICKLYNKS_RESEARCH_PROBES.length} vain luku -koetta; vastauksia ${responses}; aikakatkaisuja ${timeouts}.`,
    "- Samassa tiedostossa record_type=sample on tavallinen koeajonäyte ja record_type=pid_probe on erillinen raakapyyntö–vastauskoe.",
    "- Tutkimuspyyntö on aina täsmälleen pituustavu 02 + Quicklynks-tyyppi 41 + yksi ennalta sallittu tunniste. Mode 22-, Toyota Read Data 21-, Active Test-, vikakoodien poisto- tai muita kirjoituskomentoja ei ole lähetetty.",
    "- Quicklynksin yksittäisvastaus on payload-only-muodossa: [pituus][41][arvotavut]. Vastaus ei toista pyydettyä tunnistetta. Sarjan pyyntö ja vastaus yhdistetään, koska sovellus sallii vain yhden keskeneräisen binäärikyselyn kerrallaan.",
    "- probe_group=verified_query_split tarkoittaa vain, että tunniste esiintyy aiemmin varmennetussa Quicklynksin koontikyselyssä. Se ei yksin varmista kentän merkitystä.",
    "- probe_group=standard_read_candidate ja candidate_label ovat tutkimushypoteeseja standardin Mode 01 -tunnisteiden perusteella. outcome=response ei vielä todista, että ECU tukee nimettyä arvoa tai että hyötydatan asteikko tunnetaan.",
    "- probe_group=aftertreatment_standard_candidate sisältää tunnisteet 78–7C. Ne ovat standardiin perustuvia pakokaasulämpötila- ja hiukkassuodatinehdokkaita, eivät Lexus/Techstream DPNR PM/S -tiloja. Raakavastausta ei saa nimetä EGT- tai painearvoksi ennen rakenteen ja muunnoksen varmennusta.",
    "- probe_group=diesel_standard_candidate sisältää standardoidut dieselryhmät 69, 6D, 70, 71, 73, 8B, 8C ja 8F. PID 86 jätetään Quicklynksissä vain sen varmennetuksi omaksi käyntiaikakentäksi eikä sitä tulkita standardin hiukkasmassapitoisuudeksi. Ryhmät eivät anna Toyota-kohtaisia suuttimien korjaus-, noki-/tuhka-, IMV/SCV- tai 5. suuttimen arvoja.",
    "- response_hex, response_type_hex ja payload_hex ovat tutkimusriveillä raakadataa. payload_hex sisältää vain 41-tyypin jälkeiset arvotavut; siihen ei sisälly pyydettyä tunnistetta. Älä keksi raakavastaukselle yksikköä tai kaavaa.",
    "- Quicklynksin virheellisesti käyttäytynyt 60-tukibittikysely on poistettu tämän koeajotallennuksen automaattisesta 55 PIDin jonosta. Erillinen käyttäjän käynnistämä 0.6.1-laaja diagnostiikka voi kokeilla sitä kerran tukibittikandidaattina ja luokittelee artefaktit ei-tuetuiksi.",
    "- Tiedosto on puolipiste-eroteltu ja desimaaliluvuissa käytetään pilkkua, jotta suomalainen Excel ei muuta esimerkiksi 12,44 voltin arvoa päivämääräksi.",
    "",
    "Tutki PID-kerros näin:",
    "1. Tarkista pyyntöjen ja payload-only-vastausten kehysten pituudet sekä erittele timeout, invalid, error ja response toisistaan. Jatkuva 13 41 -koontikehys ei ole yksittäiskyselyn vastaus.",
    "2. Vertaa verified_query_split-tunnisteiden yksittäisvastauksia sample-rivien live_frame_hex-kehykseen ja lähimpiin RPM-, nopeus-, lämpötila-, kuormitus- ja jännitearvoihin.",
    "3. Listaa tunnisteet, joiden hyötydatan pituus ja vaihtelu sopivat hypoteesiin, mutta merkitse tulos ehdokkaaksi – ei varmennetuksi PIDiksi.",
    "4. Listaa tunnisteet, joita ei pidä vielä ottaa tuotantolokitukseen, ja kerro mikä toinen ajotilanne tai Techstream-vertailu tarvitaan.",
    "5. Älä päättele aikakatkaisusta yksin, ettei arvoa tueta: adapteri, ECU-tila ja tutkimuspyynnön kuorimuoto voivat myös selittää tuloksen.",
    "",
    "Anna lopuksi kaksi erillistä yhteenvetoa: A) auton koeajodatan mahdolliset viat ja B) Quicklynks-tunnisteiden tutkimustulos."
  ].join("\n");
}

export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
