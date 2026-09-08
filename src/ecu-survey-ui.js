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
      timestamp: snapshotTimestamp(item),
      respondingCount: snapshotRespondingCount(item),
      plannedCount: Array.isArray(item?.nodes) ? item.nodes.length : 0,
      topologySignature: ecuSurveyTopologySignature(item) || "none",
      compatible: comparableRunIds.has(String(item?.runId || ""))
    }));

  return Object.freeze({
    visible: true,
    runId: String(snapshot.runId || ""),
    timestamp: snapshotTimestamp(snapshot),
    profileVersion: String(snapshot.profileVersion || ""),
    safeProbe: String(snapshot.safeProbe || "0100"),
    respondingCount: nodes.filter(node => node.responding).length,
    plannedCount: nodes.length,
    repeatability,
    totalHistoryRuns: historySnapshots.length,
    compatibleHistoryRuns: comparableSnapshots.length,
    topologySignature: ecuSurveyTopologySignature(snapshot) || "none",
    nodes: Object.freeze(nodes),
    history: Object.freeze(history)
  });
}
