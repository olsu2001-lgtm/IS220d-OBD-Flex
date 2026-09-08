import { evaluateEcuSurveyRepeatability } from "./ecu-survey.js";
import { installEcuSurveyUi, notifyEcuSurveyUi } from "./ecu-survey-ui-runtime.js";

export const ECU_SURVEY_HISTORY_KEY = "is220d-obd:ecu-survey-history:v1";
export const ECU_SURVEY_HISTORY_LIMIT = 10;

function compactNode(node) {
  return {
    requestHeader: String(node?.requestHeader || ""),
    knownResponseHeader: String(node?.knownResponseHeader || ""),
    knownEcuId: String(node?.knownEcuId || ""),
    expectation: String(node?.expectation || "unknown"),
    status: String(node?.status || "unknown-not-observed"),
    responding: node?.responding === true,
    observedResponseHeaders: Object.freeze([...(node?.observedResponseHeaders || [])].map(String).sort()),
    attempts: Number(node?.attempts || 0),
    validResponses: Number(node?.validResponses || 0),
    writable: false
  };
}

function compactIdentityField(field) {
  if (!field || typeof field !== "object") return null;
  return Object.freeze({
    id: String(field.id || ""),
    label: String(field.label || ""),
    value: String(field.value || ""),
    expected: String(field.expected || ""),
    status: String(field.status || "not-observed"),
    responseHeader: String(field.responseHeader || ""),
    writable: false
  });
}

function compactIdentity(identity) {
  if (!identity || typeof identity !== "object") return null;
  const fields = {};
  for (const [key, field] of Object.entries(identity.fields || {})) {
    const compact = compactIdentityField(field);
    if (compact) fields[key] = compact;
  }
  return Object.freeze({
    schemaVersion: Number(identity.schemaVersion || 1),
    source: String(identity.source || ""),
    evidenceSource: String(identity.evidenceSource || ""),
    overall: String(identity.overall || "not-observed"),
    writable: false,
    fields: Object.freeze(fields)
  });
}

export function compactEcuSurveySnapshot(snapshot) {
  if (!snapshot || snapshot.mode !== "read-only" || !Array.isArray(snapshot.nodes)) {
    throw new Error("Valid read-only ECU Survey snapshot is required");
  }
  return Object.freeze({
    schemaVersion: Number(snapshot.schemaVersion || 1),
    mode: "read-only",
    profileVersion: String(snapshot.profileVersion || ""),
    safeProbe: String(snapshot.safeProbe || "0100"),
    runId: String(snapshot.runId || ""),
    startedAt: Number.isFinite(snapshot.startedAt) ? Number(snapshot.startedAt) : null,
    endedAt: Number.isFinite(snapshot.endedAt) ? Number(snapshot.endedAt) : null,
    nodes: Object.freeze(snapshot.nodes.map(compactNode)),
    identity: compactIdentity(snapshot.identity)
  });
}

function chronologicalValue(snapshot) {
  if (Number.isFinite(snapshot?.endedAt)) return Number(snapshot.endedAt);
  if (Number.isFinite(snapshot?.startedAt)) return Number(snapshot.startedAt);
  return 0;
}

function resolveStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function compatibleWith(snapshot, reference) {
  return snapshot?.mode === "read-only" &&
    Number(snapshot?.schemaVersion) === Number(reference?.schemaVersion) &&
    String(snapshot?.profileVersion || "") === String(reference?.profileVersion || "") &&
    String(snapshot?.safeProbe || "") === String(reference?.safeProbe || "");
}

export function normalizeEcuSurveyHistory(value, limit = ECU_SURVEY_HISTORY_LIMIT) {
  const max = Math.max(1, Math.trunc(Number(limit) || ECU_SURVEY_HISTORY_LIMIT));
  const snapshots = Array.isArray(value) ? value : [];
  const byIdentity = new Map();
  let anonymous = 0;
  for (const candidate of snapshots) {
    try {
      const compact = compactEcuSurveySnapshot(candidate);
      const identity = compact.runId || `anonymous:${chronologicalValue(compact)}:${anonymous++}`;
      byIdentity.set(identity, compact);
    } catch {}
  }
  return Object.freeze(
    [...byIdentity.values()]
      .sort((a, b) => chronologicalValue(a) - chronologicalValue(b))
      .slice(-max)
  );
}

function parseStoredHistory(storage) {
  if (!storage?.getItem) return Object.freeze([]);
  const raw = storage.getItem(ECU_SURVEY_HISTORY_KEY);
  if (!raw) return Object.freeze([]);
  try {
    return normalizeEcuSurveyHistory(JSON.parse(raw));
  } catch {
    return Object.freeze([]);
  }
}

export function loadEcuSurveyHistory(storage = undefined) {
  try {
    return parseStoredHistory(resolveStorage(storage));
  } catch {
    return Object.freeze([]);
  }
}

export function summarizeEcuSurveyHistory(storage = undefined) {
  const snapshots = loadEcuSurveyHistory(storage);
  const latestSnapshot = snapshots.length ? snapshots[snapshots.length - 1] : null;
  const comparableSnapshots = latestSnapshot
    ? Object.freeze(snapshots.filter(item => compatibleWith(item, latestSnapshot)))
    : Object.freeze([]);
  return Object.freeze({
    snapshots,
    latestSnapshot,
    comparableSnapshots,
    repeatability: evaluateEcuSurveyRepeatability(comparableSnapshots, 3)
  });
}

export function recordEcuSurveySnapshot(snapshot, storage = undefined) {
  const compact = compactEcuSurveySnapshot(snapshot);
  const targetStorage = resolveStorage(storage);
  const previous = loadEcuSurveyHistory(targetStorage);
  const snapshots = normalizeEcuSurveyHistory([...previous, compact]);
  const comparableSnapshots = Object.freeze(snapshots.filter(item => compatibleWith(item, compact)));
  let persisted = false;
  let error = "";
  try {
    if (!targetStorage?.setItem) throw new Error("localStorage unavailable");
    targetStorage.setItem(ECU_SURVEY_HISTORY_KEY, JSON.stringify(snapshots));
    persisted = true;
  } catch (caught) {
    error = caught?.message || String(caught);
  }
  const result = Object.freeze({
    persisted,
    error,
    snapshots,
    comparableSnapshots,
    repeatability: evaluateEcuSurveyRepeatability(comparableSnapshots, 3)
  });
  notifyEcuSurveyUi(snapshot, result);
  return result;
}

export function clearEcuSurveyHistory(storage = undefined) {
  try {
    const targetStorage = resolveStorage(storage);
    if (!targetStorage?.removeItem) return false;
    targetStorage.removeItem(ECU_SURVEY_HISTORY_KEY);
    return true;
  } catch {
    return false;
  }
}

if (typeof document !== "undefined") {
  installEcuSurveyUi({ loadHistory: () => summarizeEcuSurveyHistory() });
}
