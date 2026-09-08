import { IS220D_TARGET_IDENTITY_EVIDENCE } from "./vehicle-identity-evidence.js";

const HEX_BYTE = /^[0-9A-F]{2}$/;
const CAN_HEADER = /^[0-9A-F]{3}(?:[0-9A-F]{5})?$/;

const FIELD_DEFINITIONS = Object.freeze([
  Object.freeze({ id: "vin", label: "VIN", command: "0902", pid: 0x02, kind: "vin", expectedKey: "vin" }),
  Object.freeze({ id: "calibrationId", label: "Calibration ID", command: "0904", pid: 0x04, kind: "text", expectedKey: "calibrationId" }),
  Object.freeze({ id: "calibrationVerificationNumber", label: "CVN payload", command: "0906", pid: 0x06, kind: "hex", expectedKey: "calibrationVerificationNumberPayloadHex" }),
  Object.freeze({ id: "ecuName", label: "ECU name", command: "090A", pid: 0x0a, kind: "text", expectedKey: "" })
]);

const normalizeCommand = value => String(value || "").replace(/\s+/g, "").toUpperCase();
const toHex = bytes => bytes.map(byte => byte.toString(16).padStart(2, "0").toUpperCase()).join("");

function lineBytes(line) {
  const text = String(line || "").replace(/>/g, " ").trim().toUpperCase();
  if (!text || /^(SEARCHING|BUS INIT|STOPPED|NO DATA|CAN ERROR|UNABLE TO CONNECT)/.test(text)) return null;

  const parts = text.split(/\s+/).filter(Boolean);
  let header = "";
  let byteTokens = parts;
  if (parts.length && CAN_HEADER.test(parts[0])) {
    header = parts[0];
    byteTokens = parts.slice(1);
  }
  if (byteTokens.length && byteTokens.every(token => HEX_BYTE.test(token))) {
    return { header, bytes: byteTokens.map(token => Number.parseInt(token, 16)) };
  }

  const compact = text.replace(/[^0-9A-F]/g, "");
  if (!compact) return null;
  let payload = compact;
  if (compact.length >= 5 && compact.length % 2 === 1 && CAN_HEADER.test(compact.slice(0, 3))) {
    header = compact.slice(0, 3);
    payload = compact.slice(3);
  }
  if (!payload || payload.length % 2) return null;
  const bytes = payload.match(/../g)?.map(token => Number.parseInt(token, 16)) || [];
  return bytes.length ? { header, bytes } : null;
}

function collectPayloadCandidates(raw) {
  const candidates = [];
  const active = new Map();
  const lines = String(raw || "").split(/[\r\n]+/);

  for (const line of lines) {
    const parsed = lineBytes(line);
    if (!parsed?.bytes?.length) continue;
    const { header, bytes } = parsed;
    const first = bytes[0];

    if (bytes.length > 1 && first === bytes.length - 1 && bytes[1] === 0x49) {
      candidates.push({ header, payload: bytes.slice(1), complete: true });
      continue;
    }

    const frameType = first >> 4;
    if (frameType === 0x0) {
      const length = first & 0x0f;
      if (length > 0 && length <= 7 && bytes.length >= length + 1) {
        candidates.push({ header, payload: bytes.slice(1, 1 + length), complete: true });
        continue;
      }
    }

    if (frameType === 0x1 && bytes.length >= 3) {
      const totalLength = ((first & 0x0f) << 8) | bytes[1];
      if (totalLength >= 8 && totalLength <= 64) {
        active.set(header, { totalLength, payload: bytes.slice(2), nextSequence: 1 });
        const state = active.get(header);
        if (state.payload.length >= totalLength) {
          candidates.push({ header, payload: state.payload.slice(0, totalLength), complete: true });
          active.delete(header);
        }
        continue;
      }
    }

    if (frameType === 0x2 && active.has(header)) {
      const state = active.get(header);
      const sequence = first & 0x0f;
      if (sequence !== (state.nextSequence & 0x0f)) {
        active.delete(header);
        continue;
      }
      state.nextSequence += 1;
      state.payload.push(...bytes.slice(1));
      if (state.payload.length >= state.totalLength) {
        candidates.push({ header, payload: state.payload.slice(0, state.totalLength), complete: true });
        active.delete(header);
      }
      continue;
    }

    candidates.push({ header, payload: bytes, complete: true });
  }

  return Object.freeze(candidates.map(candidate => Object.freeze({
    header: candidate.header,
    payload: Object.freeze([...candidate.payload]),
    complete: candidate.complete
  })));
}

export function extractMode09Body(raw, pid) {
  const identifier = Number(pid) & 0xff;
  for (const candidate of collectPayloadCandidates(raw)) {
    const payload = candidate.payload;
    for (let index = 0; index + 1 < payload.length; index++) {
      if (payload[index] !== 0x49 || payload[index + 1] !== identifier) continue;
      return Object.freeze({
        header: candidate.header,
        body: Object.freeze(payload.slice(index + 2)),
        payload: Object.freeze([...payload])
      });
    }
  }
  return null;
}

function trimAsciiBytes(bytes) {
  const copy = [...bytes];
  while (copy.length && (copy[copy.length - 1] === 0x00 || copy[copy.length - 1] === 0x20)) copy.pop();
  while (copy.length && (copy[0] === 0x00 || copy[0] === 0x20)) copy.shift();
  return copy;
}

function decodeMode09Text(body) {
  let bytes = [...body];
  if (bytes.length > 1 && bytes[0] >= 1 && bytes[0] <= 9) bytes = bytes.slice(1);
  bytes = trimAsciiBytes(bytes);
  if (!bytes.length) return null;
  if (!bytes.every(byte => byte >= 0x20 && byte <= 0x7e)) return null;
  return String.fromCharCode(...bytes).trim();
}

function decodeField(definition, parsed) {
  if (!parsed) return null;
  if (definition.kind === "hex") return toHex(parsed.body);
  const text = decodeMode09Text(parsed.body);
  if (!text) return null;
  if (definition.kind === "vin" && !/^[A-HJ-NPR-Z0-9]{17}$/.test(text)) return null;
  return text;
}

function fieldStatus(value, expected, parserObserved) {
  if (!parserObserved) return value ? "observed" : "not-observed";
  if (!value) return "parse-error";
  if (!expected) return "observed";
  return value === expected ? "match" : "mismatch";
}

function latestResultForCommand(results, command) {
  const matching = (Array.isArray(results) ? results : []).filter(result => normalizeCommand(result?.command) === command);
  const valid = [...matching].reverse().find(result => result?.validResponse === true);
  return valid || matching[matching.length - 1] || null;
}

export function extractMode09IdentityFromDiagnosticRun(
  run,
  evidence = IS220D_TARGET_IDENTITY_EVIDENCE
) {
  const fields = {};
  for (const definition of FIELD_DEFINITIONS) {
    const result = latestResultForCommand(run?.results, definition.command);
    const raw = String(result?.raw || result?.cleaned || "");
    const parsed = result?.validResponse === true ? extractMode09Body(raw, definition.pid) : null;
    const value = decodeField(definition, parsed);
    const expected = definition.expectedKey ? String(evidence?.[definition.expectedKey] || "") : "";
    fields[definition.id] = Object.freeze({
      id: definition.id,
      label: definition.label,
      command: definition.command,
      responseHeader: String(parsed?.header || ""),
      value: value || "",
      expected,
      status: fieldStatus(value, expected, Boolean(parsed)),
      validResponse: result?.validResponse === true,
      error: String(result?.error || "")
    });
  }

  const expectedFields = [fields.vin, fields.calibrationId, fields.calibrationVerificationNumber];
  const observedExpected = expectedFields.filter(field => ["match", "mismatch"].includes(field.status));
  const anyObserved = Object.values(fields).some(field => field.status !== "not-observed");
  const overall = expectedFields.some(field => field.status === "mismatch")
    ? "mismatch"
    : expectedFields.every(field => field.status === "match")
      ? "match"
      : anyObserved || observedExpected.length
        ? "partial"
        : "not-observed";

  return Object.freeze({
    schemaVersion: 1,
    source: "existing-wide-diagnostic-mode09",
    evidenceSource: String(evidence?.source || ""),
    writable: false,
    overall,
    fields: Object.freeze(fields)
  });
}

export const MODE09_IDENTITY_FIELDS = FIELD_DEFINITIONS;
