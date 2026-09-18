export const TECHSTREAM_DATA_LIST_GAP_SCHEMA_VERSION = 2;
export const TECHSTREAM_DATA_LIST_GAP_SOURCE = "Techstream/GTS Data List evidence; passive J2534 transaction capture";

const CURRENT_PRODUCTION_COMMANDS = new Set(["212C", "217E", "217F"]);
const FIELD_REJECTED_COMMANDS = new Set(["219C"]);
const PASSIVE_READ_SERVICES = Object.freeze({
  "21": "61",
  "22": "62"
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

export const TECHSTREAM_DATA_LIST_GAP_TARGETS = deepFreeze([
  {
    id: "dpf-differential-pressure",
    label: "DPF Differential Pressure",
    componentIds: ["engine.dpnr_differential_pressure_sensor", "engine.dpnr_catalyst"],
    unit: "kPa",
    channels: 1,
    operatingState: "koeo-idle-3000rpm",
    status: "capture-required",
    dataListPath: "Powertrain / Engine and ECT / Data List / All Data",
    evidence: "Toyota/TME service information identifies DPF Differential Pressure as the DPF/DPNR pressure value to compare with MAF.",
    rawTransaction: null,
    rejectedCommands: [],
    note: "Target-vehicle field runs returned NO DATA for the current 217E hypothesis. Capture the actual Techstream transaction instead of guessing another identifier."
  },
  {
    id: "egr-lift-sensor-output",
    label: "EGR Lift Sensor Output",
    componentIds: ["engine.egr_valve", "engine.egr_position_sensor"],
    unit: "%",
    channels: 1,
    operatingState: "warm-idle-and-techstream-step-test",
    status: "capture-required",
    dataListPath: "Powertrain / Engine and ECT / Data List",
    evidence: "Toyota/TME service information uses EGR Lift Sensor Output while Control the EGR Step Position is operated in Techstream/IT2.",
    rawTransaction: null,
    rejectedCommands: [],
    note: "212C responds on the target vehicle, but response presence alone does not prove that it is EGR lift feedback. Correlate the captured bytes against Techstream's displayed lift value."
  },
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

const hexTokens = value => String(value || "").toUpperCase().match(/[0-9A-F]{2,8}/g) || [];

function timestampFromLine(line) {
  const text = String(line || "");
  const named = text.match(/(?:timestamp|time\s*stamp|ts)\s*[:=]\s*(\d+(?:\.\d+)?)/i);
  if (named) return Number(named[1]);
  const bracket = text.match(/^\s*\[(\d+(?:\.\d+)?)\]/);
  if (bracket) return Number(bracket[1]);
  const leading = text.match(/^\s*(\d+\.\d+)\s+(?:TX|RX)\b/i);
  return leading ? Number(leading[1]) : null;
}

function frameFromTokens(tokens) {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "7E0" || token === "7E8") {
      return { header: token, bytes: tokens.slice(index + 1).filter(item => item.length === 2) };
    }
    if (index + 3 < tokens.length &&
        tokens[index] === "00" && tokens[index + 1] === "00" &&
        tokens[index + 2] === "07" && (tokens[index + 3] === "E0" || tokens[index + 3] === "E8")) {
      return { header: `7${tokens[index + 3]}`, bytes: tokens.slice(index + 4).filter(item => item.length === 2) };
    }
  }
  return null;
}

function servicePosition(bytes, direction) {
  const services = direction === "request" ? Object.keys(PASSIVE_READ_SERVICES) : Object.values(PASSIVE_READ_SERVICES);
  for (let index = 0; index < bytes.length; index += 1) {
    if (!services.includes(bytes[index])) continue;
    if (index === 0) return index;
    if (index === 1 && /^0[2-7]$/.test(bytes[0])) return index;
    if (direction === "response" && index === 2 && bytes[0] === "10") return index;
  }
  return -1;
}

function identifierLength(service) {
  return service === "22" || service === "62" ? 2 : 1;
}

function parseTraceLine(line, lineNumber, directionHint = "") {
  const frame = frameFromTokens(hexTokens(line));
  if (!frame) return null;
  const direction = frame.header === "7E0" ? "request" : "response";
  if (directionHint && directionHint !== direction) return null;
  const index = servicePosition(frame.bytes, direction);
  if (index < 0) return null;
  const service = frame.bytes[index];
  const idLength = identifierLength(service);
  const idBytes = frame.bytes.slice(index + 1, index + 1 + idLength);
  if (idBytes.length !== idLength) return null;
  const identifierHex = idBytes.join("");
  const requestService = direction === "request"
    ? service
    : Object.entries(PASSIVE_READ_SERVICES).find(([, response]) => response === service)?.[0];
  if (!requestService) return null;
  const command = `${requestService}${identifierHex}`;
  const responsePrefix = `${PASSIVE_READ_SERVICES[requestService]}${identifierHex}`;
  return Object.freeze({
    lineNumber,
    header: frame.header,
    direction,
    command,
    responsePrefix,
    payload: frame.bytes.slice(index + 1 + idLength).join(""),
    timestamp: timestampFromLine(line)
  });
}

function traceEvents(traceText) {
  const lines = String(traceText || "").split(/\r?\n/).slice(0, 50000);
  const events = [];
  let contextDirection = "";
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/PassThruWriteMsgs/i.test(line)) contextDirection = "request";
    else if (/PassThruReadMsgs/i.test(line)) contextDirection = "response";
    const parsed = parseTraceLine(line, index + 1, contextDirection);
    if (parsed) {
      events.push(parsed);
      contextDirection = "";
    }
  }
  return { lines, events };
}

export function analyzeTechstreamDataListTrace(traceText) {
  const { lines, events } = traceEvents(traceText);
  const pending = new Map();
  const aggregates = new Map();
  const unmatchedResponses = [];

  for (const parsed of events) {
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
        firstResponseLine: parsed.lineNumber,
        captures: []
      };
      aggregates.set(parsed.command, aggregate);
    }
    aggregate.observations += 1;
    aggregate.payloadLengths.add(parsed.payload.length / 2);
    if (parsed.payload) aggregate.payloads.add(parsed.payload);
    aggregate.captures.push(Object.freeze({
      requestLine: request.lineNumber,
      responseLine: parsed.lineNumber,
      requestTimestamp: request.timestamp,
      responseTimestamp: parsed.timestamp,
      payloadHex: parsed.payload
    }));
  }

  const allPairs = [...aggregates.values()].map(item => {
    const fieldRejected = FIELD_REJECTED_COMMANDS.has(item.command);
    const currentProductionCommand = CURRENT_PRODUCTION_COMMANDS.has(item.command);
    return Object.freeze({
      command: item.command,
      responsePrefix: item.responsePrefix,
      observations: item.observations,
      payloadLengths: Object.freeze([...item.payloadLengths].sort((a, b) => a - b)),
      distinctPayloadCount: item.payloads.size,
      firstRequestLine: item.firstRequestLine,
      firstResponseLine: item.firstResponseLine,
      captures: Object.freeze(item.captures),
      fieldRejected,
      currentProductionCommand,
      alreadyVerified: currentProductionCommand,
      status: fieldRejected ? "field-rejected" : currentProductionCommand ? "current-production" : "capture-candidate"
    });
  }).sort((a, b) => b.observations - a.observations || b.distinctPayloadCount - a.distinctPayloadCount || a.command.localeCompare(b.command));

  const candidates = allPairs.filter(item => item.status === "capture-candidate");
  const rejected = allPairs.filter(item => item.status === "field-rejected");
  const existing = allPairs.filter(item => item.status === "current-production");
  return deepFreeze({
    schemaVersion: TECHSTREAM_DATA_LIST_GAP_SCHEMA_VERSION,
    source: TECHSTREAM_DATA_LIST_GAP_SOURCE,
    lineCount: lines.length,
    eventCount: events.length,
    pairCount: allPairs.reduce((sum, item) => sum + item.observations, 0),
    candidateCount: candidates.length,
    candidates,
    rejected,
    existing,
    allPairs,
    unmatchedResponseCount: unmatchedResponses.length,
    authorizationChanged: false,
    vehicleCommandSent: false
  });
}

export function buildTechstreamDataListCaptureTemplate() {
  return JSON.stringify({
    schemaVersion: TECHSTREAM_DATA_LIST_GAP_SCHEMA_VERSION,
    vehicle: "Lexus IS220d / 2AD-FHV",
    calibrationId: "35360000",
    state: "warm-idle",
    techstreamValues: {
      dpfDifferentialPressureKpa: null,
      egrLiftSensorPercent: null,
      engineSpeedRpm: null,
      mafGps: null,
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
    "Primary targets: DPF Differential Pressure | EGR Lift Sensor Output",
    "Context: Engine Speed | MAF",
    "Secondary targets: Injection Feedback Val #1-#4 | Target Common Rail Pressure | Target Pump SCV Current",
    "Policy: passive trace analysis only; no vehicle command is authorized or transmitted",
    `Trace pairs: ${traceAnalysis.pairCount}`,
    `New read candidates: ${traceAnalysis.candidateCount}`
  ];
  for (const item of traceAnalysis.candidates) lines.push(`- ${item.command} -> ${item.responsePrefix} | observations=${item.observations} | payload_bytes=${item.payloadLengths.join("/") || "-"} | distinct=${item.distinctPayloadCount}`);
  for (const item of traceAnalysis.existing) lines.push(`- CURRENT ${item.command} -> ${item.responsePrefix} | observed in passive trace; current allowlist status is not proof of target-value semantics`);
  for (const item of traceAnalysis.rejected) lines.push(`- BLOCKED ${item.command} -> ${item.responsePrefix} | field-rejected; does not become a candidate`);
  lines.push("Next gate: correlate response bytes with simultaneously displayed Techstream values over multiple operating states, repeat on the target vehicle, then review a separate profile/allowlist change.");
  return `${lines.join("\n")}\n`;
}
