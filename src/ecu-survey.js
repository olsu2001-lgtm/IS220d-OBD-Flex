import {
  IS220D_DIAGNOSTIC_PROFILE,
  validateDiagnosticProfile
} from "./is220d-profile.js";

export const ECU_SURVEY_SCHEMA_VERSION = 1;

export const ECU_SURVEY_EXPECTATION = Object.freeze({
  EXPECTED: "expected",
  NOT_EXPECTED: "not-expected",
  UNKNOWN: "unknown"
});

export const ECU_SURVEY_STATUS = Object.freeze({
  EXPECTED_RESPONDING: "expected-responding",
  EXPECTED_NO_RESPONSE: "expected-no-response",
  NOT_EXPECTED: "not-expected",
  UNEXPECTED_RESPONSE: "unexpected-response",
  UNMAPPED_RESPONSE: "unmapped-response",
  UNKNOWN_NOT_OBSERVED: "unknown-not-observed"
});

const SAFE_SURVEY_COMMANDS = new Set(["0100"]);
const HEADER_PATTERN = /^[0-9A-F]{3}(?:[0-9A-F]{5})?$/;
const EXPECTATION_VALUES = new Set(Object.values(ECU_SURVEY_EXPECTATION));

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

const normalizeHex = value => String(value || "").replace(/\s+/g, "").toUpperCase();

function knownEcuByRequestHeader(profile) {
  const map = new Map();
  for (const ecu of Object.values(profile?.ecus || {})) {
    const header = normalizeHex(ecu?.requestHeader);
    if (!header) continue;
    map.set(header, ecu);
  }
  return map;
}

export function validateEcuSurveyPlan(plan) {
  const errors = [];
  const headers = new Set();
  if (!Array.isArray(plan) || !plan.length) {
    return Object.freeze({ valid: false, errors: Object.freeze(["survey plan is empty"]) });
  }

  for (const [index, step] of plan.entries()) {
    const path = `plan[${index}]`;
    const header = normalizeHex(step?.requestHeader);
    const responseHeader = normalizeHex(step?.knownResponseHeader);
    const command = normalizeHex(step?.command);

    if (!HEADER_PATTERN.test(header)) errors.push(`${path}.requestHeader: invalid CAN header`);
    if (headers.has(header)) errors.push(`${path}.requestHeader: duplicate CAN header ${header}`);
    headers.add(header);
    if (!SAFE_SURVEY_COMMANDS.has(command)) errors.push(`${path}.command: only 0100 is allowed in ECU Survey`);
    if (step?.service !== 0x01 || step?.pid !== 0x00 || step?.expectedResponseMode !== 0x41) {
      errors.push(`${path}: ECU Survey must remain Mode 01 PID 00 read-only discovery`);
    }
    if (step?.operation !== "read-only" || step?.writable !== false) {
      errors.push(`${path}: survey step must be read-only`);
    }
    if (responseHeader && !HEADER_PATTERN.test(responseHeader)) {
      errors.push(`${path}.knownResponseHeader: invalid CAN header`);
    }
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function buildEcuSurveyPlan(profile = IS220D_DIAGNOSTIC_PROFILE) {
  const profileValidation = validateDiagnosticProfile(profile);
  if (!profileValidation.valid) {
    throw new Error(`Cannot build ECU Survey from invalid profile:\n${profileValidation.errors.join("\n")}`);
  }
  if (profile?.writable !== false || profile?.ecuSurvey?.writable !== false) {
    throw new Error("ECU Survey profile must be read-only");
  }

  const command = normalizeHex(profile?.ecuSurvey?.safeProbe);
  if (!SAFE_SURVEY_COMMANDS.has(command)) {
    throw new Error(`ECU Survey safety policy rejected command ${command || "(empty)"}`);
  }

  const known = knownEcuByRequestHeader(profile);
  const plan = (profile?.ecuSurvey?.requestHeaders || []).map((requestHeader, index) => {
    const header = normalizeHex(requestHeader);
    const ecu = known.get(header) || null;
    return {
      sequence: index + 1,
      bus: "powertrainCan",
      requestHeader: header,
      knownResponseHeader: normalizeHex(ecu?.responseHeader),
      knownEcuId: ecu?.id || "",
      knownEcuLabel: ecu?.label || "",
      command,
      service: 0x01,
      pid: 0x00,
      expectedResponseMode: Number(profile.ecuSurvey.expectedResponseService),
      operation: "read-only",
      evidence: ecu ? "profile-defined" : "survey-candidate",
      writable: false
    };
  });

  const validation = validateEcuSurveyPlan(plan);
  if (!validation.valid) throw new Error(`Invalid ECU Survey plan:\n${validation.errors.join("\n")}`);
  return deepFreeze(plan);
}

export function buildDefaultEcuExpectations(profile = IS220D_DIAGNOSTIC_PROFILE) {
  const plan = buildEcuSurveyPlan(profile);
  const expectations = Object.fromEntries(
    plan.map(step => [
      step.requestHeader,
      step.knownEcuId ? ECU_SURVEY_EXPECTATION.EXPECTED : ECU_SURVEY_EXPECTATION.UNKNOWN
    ])
  );
  return deepFreeze(expectations);
}

function resolveExpectations(plan, profile, overrides = {}) {
  const base = { ...buildDefaultEcuExpectations(profile) };
  for (const [rawHeader, expectation] of Object.entries(overrides || {})) {
    const header = normalizeHex(rawHeader);
    if (!plan.some(step => step.requestHeader === header)) {
      throw new Error(`Expectation references header outside survey plan: ${header || "(empty)"}`);
    }
    if (!EXPECTATION_VALUES.has(expectation)) {
      throw new Error(`Unknown ECU Survey expectation for ${header}: ${expectation}`);
    }
    base[header] = expectation;
  }
  return base;
}

function normalizeObservation(observation, index, planHeaders) {
  const requestHeader = normalizeHex(observation?.requestHeader);
  if (!planHeaders.has(requestHeader)) {
    throw new Error(`Observation ${index + 1} references header outside survey plan: ${requestHeader || "(empty)"}`);
  }
  const responseHeader = normalizeHex(observation?.responseHeader);
  if (responseHeader && !HEADER_PATTERN.test(responseHeader)) {
    throw new Error(`Observation ${index + 1} has invalid response header ${responseHeader}`);
  }
  const validResponse = observation?.validResponse === true || observation?.responded === true;
  return {
    requestHeader,
    responseHeader,
    validResponse,
    raw: String(observation?.raw || ""),
    error: String(observation?.error || ""),
    durationMs: Number.isFinite(observation?.durationMs) ? Math.max(0, Number(observation.durationMs)) : null,
    timestamp: Number.isFinite(observation?.timestamp) ? Number(observation.timestamp) : null
  };
}

function classifyNode(expectation, responding) {
  if (expectation === ECU_SURVEY_EXPECTATION.EXPECTED) {
    return responding ? ECU_SURVEY_STATUS.EXPECTED_RESPONDING : ECU_SURVEY_STATUS.EXPECTED_NO_RESPONSE;
  }
  if (expectation === ECU_SURVEY_EXPECTATION.NOT_EXPECTED) {
    return responding ? ECU_SURVEY_STATUS.UNEXPECTED_RESPONSE : ECU_SURVEY_STATUS.NOT_EXPECTED;
  }
  return responding ? ECU_SURVEY_STATUS.UNMAPPED_RESPONSE : ECU_SURVEY_STATUS.UNKNOWN_NOT_OBSERVED;
}

export function evaluateEcuSurvey({
  profile = IS220D_DIAGNOSTIC_PROFILE,
  observations = [],
  expectations = {},
  runId = "",
  startedAt = null,
  endedAt = null,
  adapter = null
} = {}) {
  const plan = buildEcuSurveyPlan(profile);
  const planHeaders = new Set(plan.map(step => step.requestHeader));
  const resolvedExpectations = resolveExpectations(plan, profile, expectations);
  const normalized = observations.map((observation, index) => normalizeObservation(observation, index, planHeaders));
  const observationsByHeader = new Map(plan.map(step => [step.requestHeader, []]));
  for (const observation of normalized) observationsByHeader.get(observation.requestHeader).push(observation);

  const nodes = plan.map(step => {
    const attempts = observationsByHeader.get(step.requestHeader) || [];
    const successful = attempts.filter(item => item.validResponse);
    const latest = attempts.at(-1) || null;
    const latestSuccessful = successful.at(-1) || null;
    const expectation = resolvedExpectations[step.requestHeader];
    const status = classifyNode(expectation, successful.length > 0);
    const observedResponseHeaders = [...new Set(successful.map(item => item.responseHeader).filter(Boolean))];
    return {
      requestHeader: step.requestHeader,
      knownResponseHeader: step.knownResponseHeader,
      knownEcuId: step.knownEcuId,
      knownEcuLabel: step.knownEcuLabel,
      expectation,
      status,
      responding: successful.length > 0,
      attempts: attempts.length,
      validResponses: successful.length,
      observedResponseHeaders,
      latestRaw: latestSuccessful?.raw || "",
      latestError: latest?.validResponse ? "" : latest?.error || "",
      lastDurationMs: latest?.durationMs ?? null,
      writable: false
    };
  });

  const statusCounts = Object.fromEntries(Object.values(ECU_SURVEY_STATUS).map(status => [status, 0]));
  for (const node of nodes) statusCounts[node.status] += 1;
  const respondingNodes = nodes.filter(node => node.responding);
  const summary = {
    plannedHeaders: plan.length,
    observedAttempts: normalized.length,
    respondingHeaders: respondingNodes.length,
    expectedResponding: statusCounts[ECU_SURVEY_STATUS.EXPECTED_RESPONDING],
    expectedNoResponse: statusCounts[ECU_SURVEY_STATUS.EXPECTED_NO_RESPONSE],
    notExpected: statusCounts[ECU_SURVEY_STATUS.NOT_EXPECTED],
    unexpectedResponses: statusCounts[ECU_SURVEY_STATUS.UNEXPECTED_RESPONSE],
    unmappedResponses: statusCounts[ECU_SURVEY_STATUS.UNMAPPED_RESPONSE],
    unknownNotObserved: statusCounts[ECU_SURVEY_STATUS.UNKNOWN_NOT_OBSERVED],
    attentionCount:
      statusCounts[ECU_SURVEY_STATUS.EXPECTED_NO_RESPONSE] +
      statusCounts[ECU_SURVEY_STATUS.UNEXPECTED_RESPONSE],
    discoveryCount: statusCounts[ECU_SURVEY_STATUS.UNMAPPED_RESPONSE]
  };

  return deepFreeze({
    schemaVersion: ECU_SURVEY_SCHEMA_VERSION,
    mode: "read-only",
    profileVersion: profile.profileVersion,
    vehicle: { ...profile.vehicle },
    safeProbe: profile.ecuSurvey.safeProbe,
    runId: String(runId || ""),
    startedAt: Number.isFinite(startedAt) ? Number(startedAt) : null,
    endedAt: Number.isFinite(endedAt) ? Number(endedAt) : null,
    adapter: adapter ? { ...adapter } : null,
    expectations: resolvedExpectations,
    nodes,
    summary
  });
}

export function ecuSurveyTopologySignature(snapshot) {
  if (!snapshot || snapshot.mode !== "read-only" || !Array.isArray(snapshot.nodes)) {
    throw new Error("Invalid ECU Survey snapshot");
  }
  return snapshot.nodes
    .filter(node => node.responding)
    .map(node => {
      const responseHeaders = [...(node.observedResponseHeaders || [])].sort().join(",") || "?";
      return `${node.requestHeader}>${responseHeaders}:${node.knownEcuId || "unmapped"}`;
    })
    .sort()
    .join("|");
}

export function evaluateEcuSurveyRepeatability(snapshots, requiredRuns = 3) {
  const required = Math.max(1, Math.trunc(Number(requiredRuns) || 3));
  const runs = Array.isArray(snapshots) ? snapshots : [];
  const signatures = runs.map(ecuSurveyTopologySignature);
  const recent = signatures.slice(-required);
  const stable = recent.length === required && recent.every(signature => signature === recent[0]);
  return deepFreeze({
    requiredRuns: required,
    observedRuns: runs.length,
    stable,
    topologySignature: stable ? recent[0] : "",
    recentSignatures: recent
  });
}
