import { evaluateEcuSurveyRepeatability } from "./ecu-survey.js";

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
    nodes: Object.freeze(snapshot.nodes.map(compactNode))
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
  return Object.freeze({
    persisted,
    error,
    snapshots,
    comparableSnapshots,
    repeatability: evaluateEcuSurveyRepeatability(comparableSnapshots, 3)
  });
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
