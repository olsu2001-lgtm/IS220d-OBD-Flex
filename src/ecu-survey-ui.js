import { ecuSurveyTopologySignature } from "./ecu-survey.js";

function repeatabilityState(repeatability) {
  const required = Math.max(1, Number(repeatability?.requiredRuns || 3));
  const observed = Math.max(0, Number(repeatability?.observedRuns || 0));
  if (repeatability?.stable) return Object.freeze({ code: "stable", label: `Vakaa ${observed}/${required}`, observed, required });
  if (observed < required) return Object.freeze({ code: "collecting", label: `Kerätään ${observed}/${required}`, observed, required });
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
  if (!identity || typeof identity !== "object") return Object.freeze({ visible: false, overallCode: "not-observed", overallLabel: "Identiteettiä ei luettu", fields: Object.freeze([]) });
  const order = ["vin", "calibrationId", "calibrationVerificationNumber", "ecuName"];
  const fields = order.map(key => identity.fields?.[key]).filter(Boolean).map(field => {
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

function fieldValidationState(session) {
  if (!session || typeof session !== "object") return Object.freeze({ visible: false });
  let code = "collecting";
  let label = `Kenttäajoja ${Number(session.observedRuns || 0)}/${Number(session.requiredRuns || 3)}`;
  if (session.status === "ready-for-techstream") {
    code = "ready";
    label = "Valmis Techstream-vertailuun";
  } else if (session.status === "needs-attention") {
    code = "attention";
    label = "Tarkista validointiehdot";
  }
  return Object.freeze({
    visible: true,
    code,
    label,
    readyForTechstream: session.readyForTechstream === true,
    observedRuns: Number(session.observedRuns || 0),
    requiredRuns: Number(session.requiredRuns || 3),
    buildSha: String(session.buildSha || ""),
    engineState: String(session.engineState || ""),
    topologySignature: String(session.topologySignature || ""),
    checks: Object.freeze((session.checks || []).map(item => Object.freeze({
      code: String(item?.code || ""),
      label: String(item?.label || ""),
      pass: item?.pass === true,
      detail: String(item?.detail || "")
    }))),
    pendingExternal: Object.freeze([...(session.pendingExternal || [])].map(String))
  });
}

function techstreamStatus(status, loaded) {
  if (!loaded) return Object.freeze({ code: "not-loaded", label: "Ei Techstream-referenssiä" });
  switch (status) {
    case "verified-mappings-observed": return Object.freeze({ code: "observed", label: "Varmennetut mappingit havaittu" });
    case "verified-mapping-discrepancy": return Object.freeze({ code: "attention", label: "Mapping-poikkeama" });
    case "incomplete-reference": return Object.freeze({ code: "incomplete", label: "Referenssi keskeneräinen" });
    case "reference-only": return Object.freeze({ code: "review", label: "Referenssi ladattu · survey puuttuu" });
    default: return Object.freeze({ code: "review", label: "Referenssi ladattu · käsintarkistus" });
  }
}

function techstreamReferenceModel(comparison) {
  const loaded = comparison?.loaded === true;
  const state = techstreamStatus(comparison?.status, loaded);
  if (!loaded) {
    return Object.freeze({
      visible: true,
      loaded: false,
      code: state.code,
      label: state.label,
      referenceId: "",
      capturedAt: "",
      systemCount: 0,
      dtcCount: 0,
      systemsWithDtcs: 0,
      verifiedMappings: 0,
      candidateMappings: 0,
      verifiedObserved: 0,
      verifiedDiscrepancies: 0,
      mappings: Object.freeze([]),
      systems: Object.freeze([]),
      unmappedFlexResponders: Object.freeze([]),
      unmappedTechstreamSystems: Object.freeze([]),
      manualReviewRequired: true
    });
  }
  return Object.freeze({
    visible: true,
    loaded: true,
    code: state.code,
    label: state.label,
    referenceId: String(comparison.reference?.referenceId || ""),
    capturedAt: String(comparison.reference?.capturedAt || ""),
    note: String(comparison.reference?.note || ""),
    systemCount: Number(comparison.systemCount || 0),
    dtcCount: Number(comparison.dtcCount || 0),
    systemsWithDtcs: Number(comparison.systemsWithDtcs || 0),
    verifiedMappings: Number(comparison.verifiedMappings || 0),
    candidateMappings: Number(comparison.candidateMappings || 0),
    verifiedObserved: Number(comparison.verifiedObserved || 0),
    verifiedDiscrepancies: Number(comparison.verifiedDiscrepancies || 0),
    mappings: Object.freeze((comparison.mappings || []).map(mapping => Object.freeze({
      requestHeader: String(mapping?.requestHeader || ""),
      responseHeader: String(mapping?.responseHeader || ""),
      systemName: String(mapping?.systemName || ""),
      evidenceLevel: String(mapping?.evidenceLevel || ""),
      evidenceNote: String(mapping?.evidenceNote || ""),
      status: String(mapping?.status || "not-observed"),
      observedResponseHeaders: Object.freeze([...(mapping?.observedResponseHeaders || [])].map(String))
    }))),
    systems: Object.freeze((comparison.reference?.systems || []).map(system => Object.freeze({
      name: String(system?.name || ""),
      dtcs: Object.freeze([...(system?.dtcs || [])].map(String)),
      note: String(system?.note || "")
    }))),
    unmappedFlexResponders: Object.freeze((comparison.unmappedFlexResponders || []).map(item => Object.freeze({
      requestHeader: String(item?.requestHeader || ""),
      responseHeaders: Object.freeze([...(item?.responseHeaders || [])].map(String)),
      knownEcuId: String(item?.knownEcuId || "")
    }))),
    unmappedTechstreamSystems: Object.freeze([...(comparison.unmappedTechstreamSystems || [])].map(String)),
    manualReviewRequired: true
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
  if (!snapshot || snapshot.mode !== "read-only" || !Array.isArray(snapshot.nodes)) return Object.freeze({ visible: false });

  const historySnapshots = Array.isArray(historyResult?.snapshots) ? historyResult.snapshots : [];
  const comparableSnapshots = Array.isArray(historyResult?.comparableSnapshots) ? historyResult.comparableSnapshots : historySnapshots;
  const comparableRunIds = new Set(comparableSnapshots.map(item => String(item?.runId || "")));
  const repeatability = repeatabilityState(historyResult?.repeatability || null);
  const nodes = snapshot.nodes.map(node => {
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
  }).sort((a, b) => a.requestHeader.localeCompare(b.requestHeader));

  const history = [...historySnapshots].slice(-5).reverse().map(item => Object.freeze({
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
    fieldValidation: fieldValidationState(historyResult?.fieldValidation),
    techstreamReference: techstreamReferenceModel(historyResult?.techstreamComparison),
    nodes: Object.freeze(nodes),
    history: Object.freeze(history)
  });
}
