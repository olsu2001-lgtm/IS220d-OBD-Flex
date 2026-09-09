import { ecuSurveyTopologySignature } from "./ecu-survey.js";
import { buildFieldValidationTextReport } from "./field-validation.js";
import { buildTechstreamReferenceTextReport } from "./techstream-reference-report.js";

const clean = value => String(value ?? "").replace(/[\r\n\t]+/g, " ").trim();

function repeatabilityLabel(repeatability) {
  if (!repeatability) return "not evaluated";
  if (repeatability.stable) return "stable";
  if (Number(repeatability.observedRuns || 0) < Number(repeatability.requiredRuns || 3)) return "collecting";
  return "changed";
}

function appendIdentity(lines, identity) {
  if (!identity || typeof identity !== "object") return;
  lines.push("", "Mode 09 vehicle identity:");
  lines.push(`- Overall: ${clean(identity.overall) || "not-observed"}`);
  lines.push(`- Source: ${clean(identity.source) || "unknown"}`);
  lines.push(`- Evidence source: ${clean(identity.evidenceSource) || "unknown"}`);
  for (const field of Object.values(identity.fields || {})) {
    const observed = clean(field?.value) || "-";
    const expected = clean(field?.expected);
    const suffix = [
      `field=${clean(field?.id || field?.label)}`,
      `status=${clean(field?.status) || "not-observed"}`,
      `value=${observed}`
    ];
    if (expected) suffix.push(`expected=${expected}`);
    if (field?.responseHeader) suffix.push(`response=${clean(field.responseHeader)}`);
    lines.push(`- ${suffix.join(" | ")}`);
  }
}

export function buildEcuSurveyTextReport(snapshot, historyResult = null) {
  if (!snapshot || snapshot.mode !== "read-only" || !Array.isArray(snapshot.nodes)) {
    throw new Error("Valid read-only ECU Survey snapshot is required");
  }

  const summary = snapshot.summary || {};
  const repeatability = historyResult?.repeatability || null;
  const lines = [
    "ECU SURVEY",
    `Schema: ${snapshot.schemaVersion}`,
    `Mode: ${snapshot.mode}`,
    `Profile: ${clean(snapshot.profileVersion) || "unknown"}`,
    `Safe probe: ${clean(snapshot.safeProbe) || "unknown"}`,
    `Run ID: ${clean(snapshot.runId) || "unknown"}`,
    `Build SHA: ${clean(snapshot.buildSha) || "not embedded"}`,
    `Responding headers: ${Number(summary.respondingHeaders || 0)}/${Number(summary.plannedHeaders || snapshot.nodes.length)}`,
    `Expected responding: ${Number(summary.expectedResponding || 0)}`,
    `Expected no response: ${Number(summary.expectedNoResponse || 0)}`,
    `Unexpected responses: ${Number(summary.unexpectedResponses || 0)}`,
    `Unmapped responses: ${Number(summary.unmappedResponses || 0)}`,
    `Attention count: ${Number(summary.attentionCount || 0)}`,
    `Topology signature: ${ecuSurveyTopologySignature(snapshot) || "none"}`
  ];

  if (historyResult) {
    const compatibleRuns = historyResult.comparableSnapshots?.length ?? historyResult.snapshots?.length ?? 0;
    lines.push(
      `History persisted: ${historyResult.persisted ? "yes" : "no"}`,
      `History runs: ${Number(historyResult.snapshots?.length || 0)}`,
      `Compatible history runs: ${Number(compatibleRuns)}`,
      `Repeatability: ${repeatabilityLabel(repeatability)}${repeatability ? ` (${Number(repeatability.observedRuns || 0)}/${Number(repeatability.requiredRuns || 3)} runs)` : ""}`
    );
    if (historyResult.error) lines.push(`History warning: ${clean(historyResult.error)}`);
  }

  appendIdentity(lines, snapshot.identity);
  if (historyResult?.fieldValidation) {
    lines.push("", buildFieldValidationTextReport(historyResult.fieldValidation).trimEnd());
  }
  if (historyResult?.techstreamComparison?.loaded) {
    lines.push("", buildTechstreamReferenceTextReport(historyResult.techstreamComparison).trimEnd());
  }
  lines.push("", "Nodes:");

  for (const node of snapshot.nodes) {
    const observed = (node.observedResponseHeaders || []).join(",") || "-";
    const identity = node.knownEcuId
      ? `${clean(node.knownEcuId)}${node.knownEcuLabel ? ` (${clean(node.knownEcuLabel)})` : ""}`
      : "unmapped";
    const suffix = [
      `request=${clean(node.requestHeader)}`,
      `response=${observed}`,
      `ecu=${identity}`,
      `expectation=${clean(node.expectation)}`,
      `status=${clean(node.status)}`,
      `attempts=${Number(node.attempts || 0)}`,
      `valid=${Number(node.validResponses || 0)}`
    ];
    if (node.latestError) suffix.push(`last_error=${clean(node.latestError)}`);
    lines.push(`- ${suffix.join(" | ")}`);
  }

  lines.push(
    "",
    "Interpretation boundary:",
    "- A stable response topology is repeatability evidence, not proof of ECU identity.",
    "- Mode 09 match/mismatch compares observed read-only identity data to repository vehicle evidence; mismatch is an evidence flag, not an ECU fault verdict.",
    "- The field-validation gate summarizes stored diagnostic evidence; Techstream cross-check remains independent external evidence.",
    "- Imported Techstream reference evidence uses a neutral Flex JSON schema; system names never create CAN mappings automatically.",
    "- Unmapped responders stay unidentified until independent vehicle/Techstream evidence exists.",
    "- Expected-no-response is an inspection flag, not an automatic ECU fault verdict.",
    "- This section is derived from the existing read-only diagnostic results and sends no additional vehicle command."
  );

  return `${lines.join("\n")}\n`;
}
