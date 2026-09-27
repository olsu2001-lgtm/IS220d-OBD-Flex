import {
  VEHICLE_KEYS,
  getProfileResearchReadDataCandidate
} from "./vehicle-profiles.js";

export const TECHSTREAM_DATA_LIST_RESEARCH_SCHEMA_VERSION = 1;

const runtime = {
  available: () => false,
  capture: null
};

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function normalizeCommand(value) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function hexByte(value) {
  return (Number(value) & 0xff).toString(16).padStart(2, "0").toUpperCase();
}

function parseLineFrame(line) {
  const text = String(line || "")
    .replace(/>/g, " ")
    .replace(/\b(?:TX|RX)\b/gi, " ")
    .trim()
    .toUpperCase();
  if (!text || /NO DATA|STOPPED|CAN ERROR|UNABLE TO CONNECT/.test(text)) {
    return { data: [], totalLength: null };
  }

  const tokens = text.match(/[0-9A-F]+/g) || [];
  let index = 0;
  if (tokens[index] && /^(?:7E8|18DAF1[0-9A-F]{2})$/.test(tokens[index])) index += 1;
  const bytes = tokens.slice(index)
    .filter(token => token.length === 2)
    .map(token => Number.parseInt(token, 16));

  if (!bytes.length) return { data: [], totalLength: null };
  const pci = bytes[0];
  if ((pci & 0xf0) === 0x00) {
    const length = pci & 0x0f;
    return { data: bytes.slice(1, 1 + length), totalLength: length };
  }
  if ((pci & 0xf0) === 0x10 && bytes.length >= 2) {
    const totalLength = ((pci & 0x0f) << 8) | bytes[1];
    return { data: bytes.slice(2), totalLength };
  }
  if ((pci & 0xf0) === 0x20) return { data: bytes.slice(1), totalLength: null };
  return { data: bytes, totalLength: null };
}

function extractPositivePayload(raw, identifier) {
  const wanted = Number(identifier) & 0xff;
  const collected = [];
  let started = false;
  let totalLength = null;

  for (const line of String(raw || "").split(/[\r\n]+/)) {
    const frame = parseLineFrame(line);
    const bytes = frame.data;
    if (!bytes.length) continue;
    if (!started) {
      const index = bytes.findIndex((value, offset) =>
        value === 0x61 && bytes[offset + 1] === wanted
      );
      if (index < 0) continue;
      started = true;
      totalLength = Number.isInteger(frame.totalLength) ? frame.totalLength - index : null;
      collected.push(...bytes.slice(index));
    } else {
      collected.push(...bytes);
    }
    if (Number.isInteger(totalLength) && collected.length >= totalLength) break;
  }

  if (!started || collected.length < 2) return null;
  const message = Number.isInteger(totalLength) ? collected.slice(0, totalLength) : collected;
  return message.slice(2);
}

function negativeResponse(raw) {
  const compact = String(raw || "").toUpperCase();
  const match = compact.match(/(?:^|[^0-9A-F])7F[\s:,-]*21[\s:,-]*([0-9A-F]{2})(?:[^0-9A-F]|$)/);
  return match ? match[1] : "";
}

export function analyzeTechstreamResearchReadDataResponse(raw, candidate = getProfileResearchReadDataCandidate("21AD", VEHICLE_KEYS.IS220D)) {
  if (!candidate) throw new Error("Techstream-tutkimuskandidaatti puuttuu.");
  const text = String(raw || "");
  const payload = extractPositivePayload(text, candidate.identifier);
  const nrc = negativeResponse(text);
  const noData = /NO DATA/i.test(text);
  const positive = Array.isArray(payload);

  return deepFreeze({
    schemaVersion: TECHSTREAM_DATA_LIST_RESEARCH_SCHEMA_VERSION,
    candidateId: candidate.id,
    command: candidate.command,
    expectedResponsePrefix: candidate.expectedResponsePrefix,
    targetVehicleVerified: false,
    decoderAuthorized: false,
    status: positive ? "positive-raw" : nrc ? "negative-response" : noData ? "no-data" : "no-positive-response",
    positive,
    nrc,
    payloadLength: positive ? payload.length : 0,
    payloadHex: positive ? payload.map(hexByte).join("") : "",
    payloadBytes: positive ? payload : [],
    raw: text
  });
}

export function configureTechstreamDataListResearch(adapter = {}) {
  runtime.available = typeof adapter.available === "function" ? adapter.available : () => false;
  runtime.capture = typeof adapter.capture === "function" ? adapter.capture : null;
}

export function techstreamDataListResearchAvailable() {
  try {
    return Boolean(runtime.capture && runtime.available());
  } catch {
    return false;
  }
}

export async function runTechstreamDataListResearchCapture(command = "21AD") {
  const normalized = normalizeCommand(command);
  const candidate = getProfileResearchReadDataCandidate(normalized, VEHICLE_KEYS.IS220D);
  if (!candidate) throw new Error(`Tutkimussallintalista esti pyynnön ${normalized || "(tyhjä)"}.`);
  if (!techstreamDataListResearchAvailable()) {
    throw new Error("21AD-tutkimuskoe vaatii yhdistetyn IS220d-moottori-ECU:n ja vapaan ASCII ELM/vLinker -yhteyden.");
  }

  const capturedAt = Date.now();
  const transportResult = await runtime.capture(candidate);
  const raw = String(transportResult?.raw || "");
  const analysis = analyzeTechstreamResearchReadDataResponse(raw, candidate);

  return deepFreeze({
    ...analysis,
    capturedAt,
    transactionId: String(transportResult?.transactionId || ""),
    responseClass: String(transportResult?.responseClass || ""),
    researchReadOnly: transportResult?.researchReadOnly === true,
    transportError: String(transportResult?.error || ""),
    evidenceScope: candidate.evidenceScope,
    requestHeader: candidate.requestHeader,
    responseHeader: candidate.responseHeader
  });
}

function referenceNumber(value) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

export function evaluate21adInjectorFeedbackFamilyHypothesis(result = null, reference = {}, toleranceMm3 = 0.35) {
  const payload = Array.isArray(result?.payloadBytes) ? result.payloadBytes : [];
  const rawBytes = payload.length >= 21 ? payload.slice(17, 21) : [];
  const hypothesisValues = rawBytes.length === 4
    ? rawBytes.map(raw => raw * 20 / 128 - 10)
    : [];
  const referenceValues = [1, 2, 3, 4].map(index => referenceNumber(reference[`injectionFeedback${index}`]));
  const deltas = hypothesisValues.length === 4
    ? hypothesisValues.map((value, index) =>
        referenceValues[index] == null ? null : value - referenceValues[index]
      )
    : [];
  const comparable = deltas.filter(Number.isFinite);
  const maxAbsDeltaMm3 = comparable.length ? Math.max(...comparable.map(value => Math.abs(value))) : null;
  const tolerance = Math.max(0, Number(toleranceMm3) || 0);

  return deepFreeze({
    sourceFamily: "Toyota 1KD-FTV community reverse-engineering",
    targetEngine: "2AD-FHV",
    targetCalibration: "35360000",
    byteIndexesZeroBased: [17, 18, 19, 20],
    payloadLetters: ["R", "S", "T", "U"],
    formula: "raw * 20 / 128 - 10",
    hypothesisValuesMm3: hypothesisValues,
    referenceValuesMm3: referenceValues,
    deltasMm3: deltas,
    comparableChannelCount: comparable.length,
    maxAbsDeltaMm3,
    toleranceMm3: tolerance,
    withinTolerance: comparable.length === 4 && maxAbsDeltaMm3 <= tolerance,
    decoderAuthorized: false,
    interpretation: comparable.length === 4
      ? "Korrelaatiotulos on tutkimusevidenssiä; se ei yksin hyväksy 2AD-FHV-dekooderia."
      : "Syötä samalta hetkeltä kaikki neljä Techstream Injection Feedback -arvoa korrelaatiota varten."
  });
}

export function buildTechstreamDataListResearchReport(result = null, reference = {}) {
  const feedback = [1, 2, 3, 4].map(index => referenceNumber(reference[`injectionFeedback${index}`]));
  const hypothesis = evaluate21adInjectorFeedbackFamilyHypothesis(result, reference);
  const hypothesisText = hypothesis.hypothesisValuesMm3.length === 4
    ? hypothesis.hypothesisValuesMm3.map(value => value.toFixed(3)).join(" / ")
    : "–";
  const deltaText = hypothesis.deltasMm3.length === 4
    ? hypothesis.deltasMm3.map(value => Number.isFinite(value) ? value.toFixed(3) : "–").join(" / ")
    : "–";
  const lines = [
    "===== BEGIN LEXUS IS220D TECHSTREAM DATA LIST RESEARCH =====",
    `Schema: ${TECHSTREAM_DATA_LIST_RESEARCH_SCHEMA_VERSION}`,
    "Ajoneuvo: Lexus IS220d / 2AD-FHV",
    "Kalibraatio: 35360000",
    "Tila: tutkimuskandidaatti · vain luku · ei tuotantoallowlistissa",
    "Kandidaatti: 21AD -> 61AD",
    "Evidenssirajaus: Toyota/Denso-dieselperheen vertailuhavainto; 2AD-FHV ei vielä varmennettu",
    "Dekoodaus: EI HYVÄKSYTTY — raakadata säilytetään ilman engineering-arvotulkintaa",
    "",
    `Capture-status: ${result?.status || "ei ajettu"}`,
    `Transaction ID: ${result?.transactionId || "–"}`,
    `Response class: ${result?.responseClass || "–"}`,
    `Research-only transport: ${result?.researchReadOnly === true ? "KYLLÄ" : "EI / EI TIETOA"}`,
    `NRC: ${result?.nrc || "–"}`,
    `Payload length: ${Number(result?.payloadLength || 0)} B`,
    `Payload HEX: ${result?.payloadHex || "–"}`,
    `Transport error: ${result?.transportError || "–"}`,
    "",
    `Techstream Injection Feedback #1–#4: ${feedback.map(value => value == null ? "–" : value).join(" / ")} mm³/st`,
    `Techstream Target Common Rail Pressure: ${referenceNumber(reference.targetCommonRailPressureKpa) ?? "–"} kPa`,
    `Techstream Target Pump SCV Current: ${referenceNumber(reference.targetPumpScvCurrentMa) ?? "–"} mA`,
    "",
    "1KD-perheen 21AD-hypoteesi (EI 2AD-dekoodaus):",
    "IF1–IF4 tavut: payload R/S/T/U = indeksit 17/18/19/20 (0-based)",
    "Kaava: raw × 20/128 − 10 mm³/st",
    `Hypoteesiarvot: ${hypothesisText} mm³/st`,
    `Erot Techstreamiin: ${deltaText} mm³/st`,
    `Vertailukanavia: ${hypothesis.comparableChannelCount}/4 · max |ero| ${hypothesis.maxAbsDeltaMm3 == null ? "–" : hypothesis.maxAbsDeltaMm3.toFixed(3)} mm³/st`,
    `0,35 mm³/st toleranssin sisällä: ${hypothesis.withinTolerance ? "KYLLÄ" : "EI / EI RIITTÄVÄÄ DATAA"}`,
    "Tulkinta: korrelaatio on vain kenttäevidenssiä. decoderAuthorized=false kunnes 2AD-FHV/35360000 varmennus on tehty.",
    "",
    "Raakavastaus:",
    String(result?.raw || "–"),
    "===== END LEXUS IS220D TECHSTREAM DATA LIST RESEARCH ====="
  ];
  return lines.join("\n");
}
