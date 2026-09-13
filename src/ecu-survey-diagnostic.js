import { IS220D_DIAGNOSTIC_PROFILE } from "./is220d-profile.js";
import {
  buildEcuSurveyPlan,
  evaluateEcuSurvey
} from "./ecu-survey.js";
import { extractMode09IdentityFromDiagnosticRun } from "./mode09-identity.js";
import { extractFieldValidationEvidenceFromDiagnosticRun } from "./field-validation.js";
import { buildIs220dComponentDiagnosticCoverage } from "./is220d-component-diagnostics.js";
import { IS220D_DIAGNOSTIC_GROUPS } from "./is220d-diagnostic-groups.js";
import { buildIs220dDiagnosticGroupPlan } from "./is220d-diagnostic-plan.js";
import { buildIs220dCaptureEvidenceFromDiagnosticRun } from "./is220d-capture-history.js";
import { publishIs220dComponentDiagnosticCoverageToUi } from "./component-diagnostics-publisher.js";
import { buildImReadinessSnapshot } from "./im-readiness.js";

const normalizeHex = value => String(value || "").replace(/\s+/g, "").toUpperCase();

function runtimeBuildSha() {
  try {
    return String(globalThis.__IS220D_BUILD_SHA__ || "").trim();
  } catch {
    return "";
  }
}

export function extractCanResponseHeaders(raw) {
  const headers = new Set();
  const lines = String(raw || "").toUpperCase().split(/[\r\n]+/);
  for (const line of lines) {
    const compact = line.trim();
    if (!compact) continue;
    const match = compact.match(/^([0-9A-F]{3})(?:\s+|(?=[0-9A-F]{2}))/);
    if (!match) continue;
    const numeric = Number.parseInt(match[1], 16);
    if (numeric >= 0x700 && numeric <= 0x7ff) headers.add(match[1]);
  }
  return Object.freeze([...headers]);
}

export function ecuSurveyObservationsFromDiagnosticResults(
  results,
  profile = IS220D_DIAGNOSTIC_PROFILE
) {
  const planHeaders = new Set(buildEcuSurveyPlan(profile).map(step => step.requestHeader));
  if (!Array.isArray(results)) return Object.freeze([]);

  const observations = [];
  for (const result of results) {
    const requestHeader = normalizeHex(result?.requestHeader);
    if (result?.phase !== "ECU-osoitehaku") continue;
    if (normalizeHex(result?.command) !== "0100") continue;
    if (!planHeaders.has(requestHeader)) continue;

    const responseHeaders = extractCanResponseHeaders(result?.raw);
    observations.push({
      requestHeader,
      responseHeader: responseHeaders.length === 1 ? responseHeaders[0] : "",
      validResponse: result?.validResponse === true,
      raw: String(result?.raw || ""),
      error: String(result?.error || ""),
      durationMs: Number.isFinite(result?.durationMs) ? Number(result.durationMs) : null,
      timestamp: Number.isFinite(result?.startedAt) ? Number(result.startedAt) : null
    });
  }

  return Object.freeze(observations.map(observation => Object.freeze(observation)));
}

function latestValidCommandRaw(results, command) {
  const normalized = normalizeHex(command);
  const match = [...(Array.isArray(results) ? results : [])]
    .reverse()
    .find(result => normalizeHex(result?.command) === normalized && result?.validResponse === true && result?.raw);
  return String(match?.raw || "");
}

export function imReadinessSnapshotFromDiagnosticRun(run) {
  if (!run || !Array.isArray(run.results)) return buildImReadinessSnapshot();
  return buildImReadinessSnapshot({
    sinceClearRaw: latestValidCommandRaw(run.results, "0101"),
    driveCycleRaw: latestValidCommandRaw(run.results, "0141"),
    warmupsRaw: latestValidCommandRaw(run.results, "0130"),
    distanceRaw: latestValidCommandRaw(run.results, "0131")
  });
}

export function is220dDiagnosticGroupPlanSummariesFromRun(run) {
  if (!run || !Array.isArray(run.results)) return Object.freeze([]);
  return Object.freeze(IS220D_DIAGNOSTIC_GROUPS.map(group => {
    const plan = buildIs220dDiagnosticGroupPlan(group.id, run);
    return Object.freeze({
      id: group.id,
      shortLabel: group.shortLabel,
      summary: Object.freeze({ ...plan.summary })
    });
  }));
}

export function ecuSurveySnapshotFromDiagnosticRun(
  run,
  {
    profile = IS220D_DIAGNOSTIC_PROFILE,
    expectations = {}
  } = {}
) {
  if (!run || !Array.isArray(run.results)) throw new Error("Diagnostic run with results is required");
  const observations = ecuSurveyObservationsFromDiagnosticResults(run.results, profile);
  const meta = run.meta || {};
  const survey = evaluateEcuSurvey({
    profile,
    observations,
    expectations,
    runId: meta.reportId || "",
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    adapter: {
      family: meta.adapterFamily || "",
      profileVersion: meta.adapterProfileVersion || "",
      transport: meta.transport || "",
      transportProfile: meta.transportProfile || "",
      identity: meta.adapter || "",
      protocol: meta.protocol || ""
    }
  });
  const componentDiagnostics = buildIs220dComponentDiagnosticCoverage(run);
  const diagnosticGroupPlans = is220dDiagnosticGroupPlanSummariesFromRun(run);
  const captureEvidence = buildIs220dCaptureEvidenceFromDiagnosticRun(run);
  publishIs220dComponentDiagnosticCoverageToUi(componentDiagnostics, {
    runId: meta.reportId || "",
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    diagnosticGroupPlans,
    captureEvidence
  });

  return Object.freeze({
    ...survey,
    buildSha: runtimeBuildSha(),
    identity: extractMode09IdentityFromDiagnosticRun(run),
    validation: extractFieldValidationEvidenceFromDiagnosticRun(run),
    imReadiness: imReadinessSnapshotFromDiagnosticRun(run),
    componentDiagnostics
  });
}
