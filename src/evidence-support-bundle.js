import { ecuSurveyTopologySignature } from "./ecu-survey.js";

export const EVIDENCE_SUPPORT_BUNDLE_SCHEMA_VERSION = 1;
export const EVIDENCE_SUPPORT_BUNDLE_TYPE = "is220d-obd-flex-evidence-support";

const clean = value => String(value ?? "").replace(/[\r\n\t]+/g, " ").trim();

function isoTimestamp(value) {
  if (!Number.isFinite(value)) return "";
  try { return new Date(Number(value)).toISOString(); }
  catch { return ""; }
}

function identityStatus(identity) {
  const fields = identity?.fields || {};
  const order = ["vin", "calibrationId", "calibrationVerificationNumber", "ecuName"];
  const compact = {};
  for (const key of order) {
    const field = fields[key];
    if (!field) continue;
    compact[key] = Object.freeze({
      status: clean(field.status) || "not-observed",
      responseHeader: clean(field.responseHeader),
      valuePresent: Boolean(clean(field.value)),
      expectedPresent: Boolean(clean(field.expected))
    });
  }
  return Object.freeze({
    overall: clean(identity?.overall) || "not-observed",
    fields: Object.freeze(compact)
  });
}

function compactToyota(rows) {
  return Object.freeze((Array.isArray(rows) ? rows : []).map(row => Object.freeze({
    command: clean(row?.command),
    attempted: row?.attempted === true,
    positive: row?.positive === true,
    status: clean(row?.status) || "not-attempted",
    queryForm: clean(row?.queryForm),
    responseHeaders: Object.freeze([...(row?.responseHeaders || [])].map(clean).filter(Boolean).sort()),
    attempts: Number(row?.attempts || 0)
  })));
}

function compactRun(snapshot) {
  return Object.freeze({
    runId: clean(snapshot?.runId),
    buildSha: clean(snapshot?.buildSha),
    startedAt: isoTimestamp(snapshot?.startedAt),
    endedAt: isoTimestamp(snapshot?.endedAt),
    engineState: clean(snapshot?.validation?.engineState),
    connectionStrategy: clean(snapshot?.validation?.connectionStrategy),
    topologySignature: ecuSurveyTopologySignature(snapshot) || "none",
    engine7e0To7e8: (snapshot?.nodes || []).some(node =>
      clean(node?.requestHeader) === "7E0" &&
      node?.responding === true &&
      (node?.observedResponseHeaders || []).map(clean).includes("7E8")
    ),
    identity: identityStatus(snapshot?.identity),
    currentSettingsProbeObserved: snapshot?.validation?.currentSettingsProbeObserved === true,
    currentSettingsProbePassed: snapshot?.validation?.currentSettingsProbePassed === true,
    restorationProbeObserved: snapshot?.validation?.restorationProbeObserved === true,
    restorationPassed: snapshot?.validation?.restorationPassed === true,
    cancelled: snapshot?.validation?.cancelled === true,
    internalFailure: snapshot?.validation?.internalFailure === true,
    toyota: compactToyota(snapshot?.validation?.toyota)
  });
}

function compactChecks(checks) {
  return Object.freeze((Array.isArray(checks) ? checks : []).map(item => Object.freeze({
    code: clean(item?.code),
    pass: item?.pass === true,
    label: clean(item?.label),
    detail: clean(item?.detail)
  })));
}

function compactFieldValidation(session) {
  if (!session || typeof session !== "object") return null;
  return Object.freeze({
    status: clean(session.status) || "collecting",
    readyForTechstream: session.readyForTechstream === true,
    requiredRuns: Number(session.requiredRuns || 3),
    observedRuns: Number(session.observedRuns || 0),
    buildSha: clean(session.buildSha),
    engineState: clean(session.engineState),
    topologySignature: clean(session.topologySignature),
    checks: compactChecks(session.checks),
    pendingExternal: Object.freeze([...(session.pendingExternal || [])].map(clean).filter(Boolean))
  });
}

function compactTechstreamReference(reference) {
  if (!reference || typeof reference !== "object") return null;
  return Object.freeze({
    schemaVersion: Number(reference.schemaVersion || 1),
    source: clean(reference.source),
    referenceId: clean(reference.referenceId),
    capturedAt: clean(reference.capturedAt),
    note: clean(reference.note),
    systems: Object.freeze((reference.systems || []).map(system => Object.freeze({
      name: clean(system?.name),
      dtcs: Object.freeze([...(system?.dtcs || [])].map(clean).filter(Boolean).sort()),
      note: clean(system?.note)
    }))),
    mappings: Object.freeze((reference.mappings || []).map(mapping => Object.freeze({
      requestHeader: clean(mapping?.requestHeader),
      responseHeader: clean(mapping?.responseHeader),
      systemName: clean(mapping?.systemName),
      evidenceLevel: clean(mapping?.evidenceLevel),
      evidenceNote: clean(mapping?.evidenceNote)
    })))
  });
}

function compactTechstreamComparison(comparison) {
  if (!comparison || comparison.loaded !== true) return Object.freeze({ loaded: false, status: "not-loaded" });
  return Object.freeze({
    loaded: true,
    status: clean(comparison.status),
    systemCount: Number(comparison.systemCount || 0),
    dtcCount: Number(comparison.dtcCount || 0),
    systemsWithDtcs: Number(comparison.systemsWithDtcs || 0),
    verifiedMappings: Number(comparison.verifiedMappings || 0),
    candidateMappings: Number(comparison.candidateMappings || 0),
    verifiedObserved: Number(comparison.verifiedObserved || 0),
    verifiedDiscrepancies: Number(comparison.verifiedDiscrepancies || 0),
    mappings: Object.freeze((comparison.mappings || []).map(mapping => Object.freeze({
      requestHeader: clean(mapping?.requestHeader),
      responseHeader: clean(mapping?.responseHeader),
      systemName: clean(mapping?.systemName),
      evidenceLevel: clean(mapping?.evidenceLevel),
      status: clean(mapping?.status),
      observedResponseHeaders: Object.freeze([...(mapping?.observedResponseHeaders || [])].map(clean).filter(Boolean).sort())
    }))),
    unmappedFlexResponders: Object.freeze((comparison.unmappedFlexResponders || []).map(item => Object.freeze({
      requestHeader: clean(item?.requestHeader),
      responseHeaders: Object.freeze([...(item?.responseHeaders || [])].map(clean).filter(Boolean).sort()),
      knownEcuId: clean(item?.knownEcuId)
    }))),
    unmappedTechstreamSystems: Object.freeze([...(comparison.unmappedTechstreamSystems || [])].map(clean).filter(Boolean).sort()),
    manualReviewRequired: comparison.manualReviewRequired !== false
  });
}

export function buildEvidenceSupportBundle(historyResult, { generatedAt = Date.now() } = {}) {
  const history = historyResult || {};
  const validation = history.fieldValidation || null;
  const sourceRuns = Array.isArray(validation?.runs) && validation.runs.length
    ? validation.runs
    : Array.isArray(history.snapshots) ? history.snapshots.slice(-3) : [];
  const runs = Object.freeze(sourceRuns.slice(-3).map(compactRun));
  const latest = history.latestSnapshot || sourceRuns[sourceRuns.length - 1] || null;
  const techstreamReference = compactTechstreamReference(history.techstreamReference);
  const techstreamComparison = compactTechstreamComparison(history.techstreamComparison);

  return Object.freeze({
    schemaVersion: EVIDENCE_SUPPORT_BUNDLE_SCHEMA_VERSION,
    bundleType: EVIDENCE_SUPPORT_BUNDLE_TYPE,
    generatedAt: isoTimestamp(generatedAt),
    mode: "read-only-evidence",
    profileVersion: clean(latest?.profileVersion),
    safeProbe: clean(latest?.safeProbe) || "0100",
    buildSha: clean(validation?.buildSha || latest?.buildSha),
    fieldValidation: compactFieldValidation(validation),
    runs,
    techstream: Object.freeze({
      reference: techstreamReference,
      comparison: techstreamComparison
    }),
    privacy: Object.freeze({
      rawVehicleResponsesIncluded: false,
      adapterIdentityIncluded: false,
      bluetoothAddressIncluded: false,
      freeFormDiagnosticErrorsIncluded: false,
      vehicleIdentityValuesIncluded: false
    })
  });
}

export function stringifyEvidenceSupportBundle(historyResult, options = {}) {
  return `${JSON.stringify(buildEvidenceSupportBundle(historyResult, options), null, 2)}\n`;
}
