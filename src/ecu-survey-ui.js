import { ecuSurveyTopologySignature } from "./ecu-survey.js";

function repeatabilityState(repeatability) {
  const required = Math.max(1, Number(repeatability?.requiredRuns || 3));
  const observed = Math.max(0, Number(repeatability?.observedRuns || 0));
  if (repeatability?.stable) {
    return Object.freeze({ code: "stable", label: `Vakaa ${observed}/${required}`, observed, required });
  }
  if (observed < required) {
    return Object.freeze({ code: "collecting", label: `Kerätään ${observed}/${required}`, observed, required });
  }
  return Object.freeze({ code: "changed", label: "Topologia muuttui", observed, required });
}

function nodeUiState(node) {
  switch (node?.status) {
    case "expected-responding": return Object.freeze({ code: "responding", label: "Vastaa" });
    case "expected-no-response": return Object.freeze({ code: "attention", label: "Ei vastausta" });
    case "unmapped-response": return Object.freeze({ code: "unmapped", label: "Tuntematon vastaaja" });
    case "unexpected-response": return Object.freeze({ code: "attention", label: "Odottamaton vastaaja" });
    case "not-expected": return Object.freeze({ code: "muted", label: "Ei odotettu" });
    default: return Object.freeze({ code: "muted", label: "Ei havaittu" });
  }
}

function identityUiState(status) {
  switch (status) {
    case "match": return Object.freeze({ code: "match", label: "Täsmää" });
    case "mismatch": return Object.freeze({ code: "mismatch", label: "Poikkeaa" });
    case "observed": return Object.freeze({ code: "observed", label: "Havaittu" });
    case "parse-error": return Object.freeze({ code: "parse-error", label: "Ei voitu purkaa" });
    default: return Object.freeze({ code: "not-observed", label: "Ei luettu" });
  }
}

function identityOverallState(overall) {
  switch (overall) {
    case "match": return Object.freeze({ code: "match", label: "Ajoneuvo täsmää evidenssiin" });
    case "mismatch": return Object.freeze({ code: "mismatch", label: "Identiteettitiedoissa poikkeama" });
    case "partial": return Object.freeze({ code: "partial", label: "Identiteetti osittain luettu" });
    default: return Object.freeze({ code: "not-observed", label: "Identiteettiä ei luettu" });
  }
}

function identityModel(identity) {
  if (!identity || typeof identity !== "object") {
    return Object.freeze({ visible: false, overallCode: "not-observed", overallLabel: "Identiteettiä ei luettu", fields: Object.freeze([]) });
  }
  const order = ["vin", "calibrationId", "calibrationVerificationNumber", "ecuName"];
  const fields = order
    .map(key => identity.fields?.[key])
    .filter(Boolean)
    .map(field => {
      const state = identityUiState(field.status);
      return Object.freeze({
        id: String(field.id || ""),
        label: String(field.label || field.id || ""),
        value: String(field.value || ""),
        expected: String(field.expected || ""),
        responseHeader: String(field.responseHeader || ""),
        stateCode: state.code,
        stateLabel: state.label
      });
    });
  const overall = identityOverallState(identity.overall);
  return Object.freeze({
    visible: fields.length > 0,
    overallCode: overall.code,
    overallLabel: overall.label,
    source: String(identity.source || ""),
    evidenceSource: String(identity.evidenceSource || ""),
    fields: Object.freeze(fields)
  });
}

function snapshotTimestamp(snapshot) {
  if (Number.isFinite(snapshot?.endedAt)) return Number(snapshot.endedAt);
  if (Number.isFinite(snapshot?.startedAt)) return Number(snapshot.startedAt);
  return null;
}

function snapshotRespondingCount(snapshot) {
  return (snapshot?.nodes || []).filter(node => node?.responding === true).length;
}

export function buildEcuSurveyUiModel(snapshot, historyResult = null) {
  if (!snapshot || snapshot.mode !== "read-only" || !Array.isArray(snapshot.nodes)) {
    return Object.freeze({ visible: false });
  }

  const historySnapshots = Array.isArray(historyResult?.snapshots) ? historyResult.snapshots : [];
  const comparableSnapshots = Array.isArray(historyResult?.comparableSnapshots) ? historyResult.comparableSnapshots : historySnapshots;
  const comparableRunIds = new Set(comparableSnapshots.map(item => String(item?.runId || "")));
  const repeatability = repeatabilityState(historyResult?.repeatability || null);
  const nodes = snapshot.nodes
    .map(node => {
      const observedResponseHeaders = [...(node?.observedResponseHeaders || [])].map(String).sort();
      const state = nodeUiState(node);
      return Object.freeze({
        requestHeader: String(node?.requestHeader || ""),
        responseHeader: observedResponseHeaders.join(", ") || "–",
        ecuId: String(node?.knownEcuId || ""),
        ecuLabel: String(node?.knownEcuLabel || node?.knownEcuId || "Tunnistamaton ECU"),
        expectation: String(node?.expectation || "unknown"),
        responding: node?.responding === true,
        stateCode: state.code,
        stateLabel: state.label
      });
    })
    .sort((a, b) => a.requestHeader.localeCompare(b.requestHeader));

  const history = [...historySnapshots]
    .slice(-5)
    .reverse()
    .map(item => Object.freeze({
      runId: String(item?.runId || ""),
      buildSha: String(item?.buildSha || ""),
      timestamp: snapshotTimestamp(item),
      respondingCount: snapshotRespondingCount(item),
      plannedCount: Array.isArray(item?.nodes) ? item.nodes.length : 0,
      topologySignature: ecuSurveyTopologySignature(item) || "none",
      compatible: comparableRunIds.has(String(item?.runId || "")),
      identityOverall: String(item?.identity?.overall || "not-observed")
    }));

  return Object.freeze({
    visible: true,
    runId: String(snapshot.runId || ""),
    buildSha: String(snapshot.buildSha || ""),
    timestamp: snapshotTimestamp(snapshot),
    profileVersion: String(snapshot.profileVersion || ""),
    safeProbe: String(snapshot.safeProbe || "0100"),
    respondingCount: nodes.filter(node => node.responding).length,
    plannedCount: nodes.length,
    repeatability,
    totalHistoryRuns: historySnapshots.length,
    compatibleHistoryRuns: comparableSnapshots.length,
    topologySignature: ecuSurveyTopologySignature(snapshot) || "none",
    identity: identityModel(snapshot.identity),
    nodes: Object.freeze(nodes),
    history: Object.freeze(history)
  });
}
