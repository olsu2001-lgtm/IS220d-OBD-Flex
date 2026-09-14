export const TECHSTREAM_DATA_LIST_GAP_SCHEMA_VERSION = 1;
export const TECHSTREAM_DATA_LIST_GAP_SOURCE = "Techstream/GTS Data List evidence; raw transaction pending target capture";

const VERIFIED_PRODUCTION_COMMANDS = new Set(["212C", "217E", "217F"]);
const FIELD_REJECTED_COMMANDS = new Set(["219C"]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

export const TECHSTREAM_DATA_LIST_GAP_TARGETS = deepFreeze([
  {
    id: "injector-feedback-1-4",
    label: "Injection Feedback Val #1–#4",
    componentIds: ["engine.main_injectors"],
    unit: "mm³/st",
    channels: 4,
    operatingState: "warm-idle",
    status: "capture-required",
    dataListPath: "Powertrain / Engine and ECT / Data List",
    evidence: "Techstream Data List item name confirmed for Toyota diesel diagnostics and IS220d field evidence.",
    rawTransaction: null,
    rejectedCommands: ["219C"],
    note: "219C returned NO DATA in three repeatable runs on calibration 35360000 and must not be reused without an independent Techstream transaction capture."
  },
  {
    id: "target-common-rail-pressure",
    label: "Target Common Rail Pressure",
    componentIds: ["engine.common_rail_pressure_sensor", "engine.scv", "engine.injection_pump", "engine.fuel_filter", "engine.main_injectors"],
    unit: "kPa",
    channels: 1,
    operatingState: "cranking-running",
    status: "capture-required",
    dataListPath: "Powertrain / Engine and ECT / Data List",
    evidence: "Techstream/GTS Data List item name confirmed; Toyota diesel service information evaluates target pressure against actual rail pressure.",
    rawTransaction: null,
    rejectedCommands: [],
    note: "Existing 2196 is an unverified actual-rail screening candidate. It is not assumed to be Target Common Rail Pressure."
  },
  {
    id: "target-pump-scv-current",
    label: "Target Pump SCV Current",
    componentIds: ["engine.scv", "engine.injection_pump"],
    unit: "mA",
    channels: 1,
    operatingState: "running",
    status: "capture-required",
    dataListPath: "Powertrain / Engine and ECT / Data List",
    evidence: "Techstream/GTS Data List item name confirmed; Toyota diesel service information uses it with actual and target rail pressure for SCV diagnosis.",
    rawTransaction: null,
    rejectedCommands: [],
    note: "No 2AD-FHV raw request or decoder is authorized until a matching target-vehicle Techstream/J2534 capture is reviewed."
  }
]);

const cleanHex = value => String(value || "").replace(/[^0-9A-F]/gi, "").toUpperCase();

function bytesAfterHeader(line, header) {
  const upper = String(line || "").toUpperCase();
  const index = upper.indexOf(header);
  if (index < 0) return [];
  const tail = upper.slice(index + header.length);
  const tokens = tail.match(/(?:^|[^0-9A-F])([0-9A-F]{2})(?=$|[^0-9A-F])/g) || [];
  return tokens.map(token => token.replace(/[^0-9A-F]/g, "")).filter(token => token.length === 2);
}

function serviceIndex(bytes, service, direction) {
  for (let index = 0; index < bytes.length - 1; index += 1) {
    if (bytes[index] !== service) continue;
    if (index === 0) return index;
    if (direction === "request" && index === 1 && /^0[2-7]$/.test(bytes[0])) return index;
    if (direction === "response" && index === 1 && /^0[2-7]$/.test(bytes[0])) return index;
    if (direction === "response" && index === 2 && bytes[0] === "10") return index;
  }
  return -1;
}

function parseTraceLine(line, lineNumber) {
  const upper = String(line || "").toUpperCase();
  const headerMatch = upper.match(/\b(7E0|7E8)\b/);
  if (!headerMatch) return null;
  const header = headerMatch[1];
  const bytes = bytesAfterHeader(upper, header);
  const direction = header === "7E0" ? "request" : "response";
  const service = direction === "request" ? "21" : "61";
  const index = serviceIndex(bytes, service, direction);
  if (index < 0 || !bytes[index + 1]) return null;
  const id = bytes[index + 1];
  const command = `21${id}`;
  return Object.freeze({
    lineNumber,
    header,
    direction,
    command,
    responsePrefix: `61${id}`,
    payload: bytes.slice(index + 2).join("")
  });
}

export function analyzeTechstreamDataListTrace(traceText) {
  const lines = String(traceText || "").split(/\r?\n/).slice(0, 10000);
  const pending = new Map();
  const aggregates = new Map();
  const unmatchedResponses = [];

  for (let index = 0; index < lines.length; index += 1) {
    const parsed = parseTraceLine(lines[index], index + 1);
    if (!parsed) continue;
    if (parsed.direction === "request") {
      pending.set(parsed.command, parsed);
      continue;
    }
    const request = pending.get(parsed.command);
    if (!request) {
      unmatchedResponses.push(parsed);
      continue;
    }
    pending.delete(parsed.command);
    let aggregate = aggregates.get(parsed.command);
    if (!aggregate) {
      aggregate = {
        command: parsed.command,
        responsePrefix: parsed.responsePrefix,
        observations: 0,
        payloadLengths: new Set(),
        payloads: new Set(),
        firstRequestLine: request.lineNumber,
        firstResponseLine: parsed.lineNumber
      };
      aggregates.set(parsed.command, aggregate);
    }
    aggregate.observations += 1;
    aggregate.payloadLengths.add(parsed.payload.length / 2);
    if (parsed.payload) aggregate.payloads.add(parsed.payload);
  }

  const allPairs = [...aggregates.values()].map(item => {
    const fieldRejected = FIELD_REJECTED_COMMANDS.has(item.command);
    const alreadyVerified = VERIFIED_PRODUCTION_COMMANDS.has(item.command);
    return Object.freeze({
      command: item.command,
      responsePrefix: item.responsePrefix,
      observations: item.observations,
      payloadLengths: Object.freeze([...item.payloadLengths].sort((a, b) => a - b)),
      distinctPayloadCount: item.payloads.size,
      firstRequestLine: item.firstRequestLine,
      firstResponseLine: item.firstResponseLine,
      fieldRejected,
      alreadyVerified,
      status: fieldRejected ? "field-rejected" : alreadyVerified ? "already-verified" : "capture-candidate"
    });
  }).sort((a, b) => b.observations - a.observations || b.distinctPayloadCount - a.distinctPayloadCount || a.command.localeCompare(b.command));

  const candidates = allPairs.filter(item => item.status === "capture-candidate");
  const rejected = allPairs.filter(item => item.status === "field-rejected");
  const existing = allPairs.filter(item => item.status === "already-verified");
  return deepFreeze({
    schemaVersion: TECHSTREAM_DATA_LIST_GAP_SCHEMA_VERSION,
    source: TECHSTREAM_DATA_LIST_GAP_SOURCE,
    lineCount: lines.length,
    pairCount: allPairs.reduce((sum, item) => sum + item.observations, 0),
    candidateCount: candidates.length,
    candidates,
    rejected,
    existing,
    unmatchedResponseCount: unmatchedResponses.length,
    authorizationChanged: false
  });
}

export function buildTechstreamDataListCaptureTemplate() {
  return JSON.stringify({
    schemaVersion: TECHSTREAM_DATA_LIST_GAP_SCHEMA_VERSION,
    vehicle: "Lexus IS220d / 2AD-FHV",
    calibrationId: "35360000",
    state: "warm-idle",
    techstreamValues: {
      injectionFeedbackMm3PerStroke: [null, null, null, null],
      targetCommonRailPressureKpa: null,
      targetPumpScvCurrentMa: null
    },
    trace: "Paste matching 7E0/7E8 Techstream or J2534 read traffic here"
  }, null, 2);
}

export function buildTechstreamDataListGapTextReport(traceAnalysis = analyzeTechstreamDataListTrace("")) {
  const lines = [
    "===== TECHSTREAM DATA LIST GAP CAPTURE =====",
    `Schema: ${TECHSTREAM_DATA_LIST_GAP_SCHEMA_VERSION}`,
    "Vehicle: Lexus IS220d / 2AD-FHV",
    "Targets: Injection Feedback Val #1-#4 | Target Common Rail Pressure | Target Pump SCV Current",
    "Policy: passive trace analysis only; no vehicle command is authorized or transmitted",
    `Trace pairs: ${traceAnalysis.pairCount}`,
    `New 21xx candidates: ${traceAnalysis.candidateCount}`
  ];
  for (const item of traceAnalysis.candidates) lines.push(`- ${item.command} -> ${item.responsePrefix} | observations=${item.observations} | payload_bytes=${item.payloadLengths.join("/") || "-"} | distinct=${item.distinctPayloadCount}`);
  for (const item of traceAnalysis.rejected) lines.push(`- BLOCKED ${item.command} -> ${item.responsePrefix} | field-rejected; does not become a candidate`);
  lines.push("Next gate: correlate a candidate response with the simultaneously displayed Techstream value, derive the byte layout, repeat on the target vehicle, then review a separate allowlist change.");
  return `${lines.join("\n")}\n`;
}
