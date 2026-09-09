import { VEHICLE_KEYS } from "./vehicle-profiles.js";

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
const EXPECTED_IS220D_IDENTIFIERS = Object.freeze([0x7e, 0x7f, 0x2c]);

export const VEHICLE_VIN_SIGNATURES = Object.freeze([
  Object.freeze({ vehicleKey: VEHICLE_KEYS.IS220D, prefix: "JTHBB262", source: "verified-user-vehicle" }),
  Object.freeze({ vehicleKey: VEHICLE_KEYS.CT200H, prefix: "JTHKD5BH", source: "lexus-ct200h-production-vin" })
]);

function bytesFromHexLine(line) {
  const withoutIndex = String(line || "").replace(/^\s*[0-9A-F]+\s*:\s*/i, "").trim();
  if (!withoutIndex) return [];
  const tokens = withoutIndex
    .split(/\s+/)
    .map(token => token.replace(/[^0-9A-F]/gi, "").toUpperCase())
    .filter(Boolean);
  if (tokens.length > 1 && (tokens[0].length === 3 || tokens[0].length === 8)) tokens.shift();
  const compact = tokens.length > 1
    ? tokens.filter(token => token.length % 2 === 0).join("")
    : (tokens[0] || "");
  if (!compact || compact.length % 2 !== 0 || !/^[0-9A-F]+$/.test(compact)) return [];
  return compact.match(/../g)?.map(value => Number.parseInt(value, 16)) || [];
}

function vinFromBytes(bytes) {
  if (!Array.isArray(bytes) || bytes.length < 17) return "";
  for (let start = 0; start <= bytes.length - 17; start += 1) {
    const candidate = bytes
      .slice(start, start + 17)
      .map(value => String.fromCharCode(value))
      .join("")
      .toUpperCase();
    if (VIN_PATTERN.test(candidate)) return candidate;
  }
  return "";
}

function parseIsoTpVin(lines) {
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const first = lines[lineIndex];
    if (first.length < 4 || (first[0] & 0xf0) !== 0x10) continue;
    const payloadLength = ((first[0] & 0x0f) << 8) | first[1];
    if (payloadLength < 20) continue;
    const payload = first.slice(2);
    let expectedSequence = 1;
    for (let continuationIndex = lineIndex + 1; continuationIndex < lines.length && payload.length < payloadLength; continuationIndex += 1) {
      const continuation = lines[continuationIndex];
      if (!continuation.length || (continuation[0] & 0xf0) !== 0x20) break;
      if ((continuation[0] & 0x0f) !== expectedSequence) break;
      expectedSequence = (expectedSequence + 1) & 0x0f;
      payload.push(...continuation.slice(1));
    }
    const message = payload.slice(0, payloadLength);
    const responseIndex = message.findIndex((value, index) => value === 0x49 && message[index + 1] === 0x02);
    if (responseIndex < 0 || message.length < responseIndex + 20) continue;
    const vin = vinFromBytes(message.slice(responseIndex + 3));
    if (vin) return vin;
  }
  return "";
}

function parseSegmentedVin(lines) {
  const segments = [];
  for (const bytes of lines) {
    const responseIndex = bytes.findIndex((value, index) => value === 0x49 && bytes[index + 1] === 0x02);
    if (responseIndex < 0 || !Number.isInteger(bytes[responseIndex + 2])) continue;
    segments.push({ index: bytes[responseIndex + 2], data: bytes.slice(responseIndex + 3) });
  }
  if (!segments.length) return "";
  segments.sort((left, right) => left.index - right.index);
  const data = segments.flatMap(segment => segment.data).filter(value => value !== 0x00);
  return vinFromBytes(data);
}

export function normalizeVin(value) {
  const normalized = String(value || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return VIN_PATTERN.test(normalized) ? normalized : "";
}

export function parseObdVin(raw) {
  const cleaned = String(raw || "")
    .replace(/\u0000/g, "")
    .replace(/>/g, "")
    .replace(/SEARCHING\.{0,3}/gi, "")
    .replace(/\r/g, "\n");
  const lines = cleaned
    .split(/\n+/)
    .map(bytesFromHexLine)
    .filter(bytes => bytes.length);
  if (!lines.length) return "";

  const isoTpVin = parseIsoTpVin(lines.map(bytes => [...bytes]));
  if (isoTpVin) return isoTpVin;

  const segmentedVin = parseSegmentedVin(lines);
  if (segmentedVin) return segmentedVin;

  const flat = lines.flat();
  const responseIndex = flat.findIndex((value, index) => value === 0x49 && flat[index + 1] === 0x02);
  return responseIndex >= 0 ? vinFromBytes(flat.slice(responseIndex + 3)) : "";
}

export function vehicleKeyFromVin(vin) {
  const normalized = normalizeVin(vin);
  return VEHICLE_VIN_SIGNATURES.find(signature => normalized.startsWith(signature.prefix))?.vehicleKey || "";
}

function completeIs220dIdentifiers(results) {
  const completed = new Set(
    (Array.isArray(results) ? results : [])
      .filter(result => result?.complete)
      .map(result => Number(result.identifier) & 0xff)
  );
  return EXPECTED_IS220D_IDENTIFIERS.filter(identifier => completed.has(identifier));
}

export function classifyConnectedVehicle({ vin = "", vinRaw = "", ctIdentity = null, isProbeResults = [] } = {}) {
  const normalizedVin = normalizeVin(vin) || parseObdVin(vinRaw);
  const vinVehicleKey = vehicleKeyFromVin(normalizedVin);
  const ctConfirmed = Boolean(ctIdentity?.complete && ctIdentity?.values?.zwa10Confirmed);
  const isIdentifiers = completeIs220dIdentifiers(isProbeResults);
  const isProfileConfirmed = isIdentifiers.length === EXPECTED_IS220D_IDENTIFIERS.length;
  const evidence = [];

  if (normalizedVin) evidence.push(`VIN ${normalizedVin}`);
  if (ctConfirmed) evidence.push(`hybridiohjaimen mallitunniste ${ctIdentity.values.modelCode || "ZWA10"}`);
  if (isIdentifiers.length) evidence.push(`2AD-FHV-lukuvastaukset ${isIdentifiers.map(value => value.toString(16).padStart(2, "0").toUpperCase()).join("/")} (${isIdentifiers.length}/3)`);

  const detectedKeys = new Set([
    vinVehicleKey,
    ctConfirmed ? VEHICLE_KEYS.CT200H : "",
    isProfileConfirmed && !ctConfirmed ? VEHICLE_KEYS.IS220D : ""
  ].filter(Boolean));

  if (detectedKeys.size > 1) {
    return Object.freeze({
      status: "conflict",
      vehicleKey: "",
      confidence: "conflict",
      vin: normalizedVin,
      modelCode: ctIdentity?.values?.modelCode || "",
      engineCode: ctIdentity?.values?.engineCode || "",
      evidence: Object.freeze(evidence),
      message: `Auton tunnistetiedot ovat ristiriidassa (${evidence.join("; ")}). Profiilia ei vaihdettu automaattisesti.`
    });
  }

  const vehicleKey = [...detectedKeys][0] || "";
  if (vehicleKey === VEHICLE_KEYS.CT200H) {
    const confirmedByBoth = vinVehicleKey === VEHICLE_KEYS.CT200H && ctConfirmed;
    return Object.freeze({
      status: "detected",
      vehicleKey,
      confidence: confirmedByBoth ? "confirmed" : "high",
      vin: normalizedVin,
      modelCode: ctIdentity?.values?.modelCode || "ZWA10",
      engineCode: ctIdentity?.values?.engineCode || "2ZR-FXE",
      evidence: Object.freeze(evidence),
      message: `Lexus CT 200h tunnistettu ${confirmedByBoth ? "varmasti" : "vahvalla näytöllä"} · ZWA10 · 2ZR-FXE${normalizedVin ? ` · VIN ${normalizedVin}` : ""}`
    });
  }

  if (vehicleKey === VEHICLE_KEYS.IS220D) {
    const confirmedByBoth = vinVehicleKey === VEHICLE_KEYS.IS220D && isProfileConfirmed;
    const identifiedVehicle = Boolean(vinVehicleKey);
    return Object.freeze({
      status: "detected",
      vehicleKey,
      confidence: confirmedByBoth ? "confirmed" : "high",
      vin: normalizedVin,
      modelCode: "XE20",
      engineCode: "2AD-FHV",
      evidence: Object.freeze(evidence),
      message: confirmedByBoth
        ? `Lexus IS220d tunnistettu varmasti · XE20 · 2AD-FHV · VIN ${normalizedVin}`
        : identifiedVehicle
          ? `Lexus IS220d tunnistettu vahvalla VIN-näytöllä · XE20 · 2AD-FHV · VIN ${normalizedVin}`
          : "2AD-FHV-lukuprofiili tunnistettu vahvalla näytöllä (3/3); käytetään Lexus IS220d XE20 -profiilia"
    });
  }

  return Object.freeze({
    status: "unknown",
    vehicleKey: "",
    confidence: "unknown",
    vin: normalizedVin,
    modelCode: "",
    engineCode: "",
    evidence: Object.freeze(evidence),
    message: normalizedVin
      ? `VIN ${normalizedVin} luettiin, mutta se ei vastaa sovelluksen varmennettuja IS220d- tai CT 200h -tunnisteita.`
      : "Automaattinen tunnistus ei saanut riittävää VIN-, ZWA10- tai 2AD-FHV-näyttöä."
  });
}
