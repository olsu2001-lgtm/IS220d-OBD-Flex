export const RELEASE_READINESS_SCHEMA_VERSION = 1;
import { APP_VERSION } from "./app-version.js";
export const RELEASE_READINESS_TARGET_VERSION = APP_VERSION;

const clean = value => String(value ?? "").replace(/[\r\n\t]+/g, " ").trim();

function check(code, label, pass, detail = "") {
  return Object.freeze({
    code,
    label,
    pass: Boolean(pass),
    detail: clean(detail)
  });
}

function verifiedEngineMappingObserved(comparison) {
  return (comparison?.mappings || []).some(mapping =>
    clean(mapping?.evidenceLevel).toLowerCase() === "verified" &&
    clean(mapping?.requestHeader).toUpperCase() === "7E0" &&
    clean(mapping?.responseHeader).toUpperCase() === "7E8" &&
    clean(mapping?.status).toLowerCase() === "observed"
  );
}

function warningsFromComparison(comparison) {
  if (!comparison?.loaded) return Object.freeze([]);
  const warnings = [];
  const candidates = Number(comparison.candidateMappings || 0);
  const unmappedFlex = Array.isArray(comparison.unmappedFlexResponders) ? comparison.unmappedFlexResponders.length : 0;
  const unmappedTechstream = Array.isArray(comparison.unmappedTechstreamSystems) ? comparison.unmappedTechstreamSystems.length : 0;
  if (candidates) warnings.push(`${candidates} candidate-tason CAN-mappausta vaatii edelleen manuaalisen evidenssiarvion.`);
  if (unmappedFlex) warnings.push(`${unmappedFlex} Flex-vastaajaa ei ole sidottu Techstream-järjestelmään.`);
  if (unmappedTechstream) warnings.push(`${unmappedTechstream} Techstream-järjestelmää ei ole sidottu Flexin CAN-solmuun.`);
  return Object.freeze(warnings);
}

export function evaluateReleaseReadiness({ fieldValidation = null, techstreamComparison = null } = {}) {
  const field = fieldValidation && typeof fieldValidation === "object" ? fieldValidation : null;
  const techstream = techstreamComparison && typeof techstreamComparison === "object"
    ? techstreamComparison
    : { loaded: false, status: "not-loaded" };

  const fieldReady = field?.readyForTechstream === true;
  const techstreamLoaded = techstream?.loaded === true;
  const verifiedMappings = Number(techstream?.verifiedMappings || 0);
  const verifiedObserved = Number(techstream?.verifiedObserved || 0);
  const verifiedDiscrepancies = Number(techstream?.verifiedDiscrepancies || 0);
  const hasVerifiedMapping = techstreamLoaded && verifiedMappings > 0;
  const allVerifiedMappingsObserved = hasVerifiedMapping &&
    verifiedDiscrepancies === 0 &&
    verifiedObserved === verifiedMappings;
  const engineMappingObserved = techstreamLoaded && verifiedEngineMappingObserved(techstream);

  const checks = Object.freeze([
    check(
      "field-validation",
      "Kolmen ajon kenttävalidointi",
      fieldReady,
      field ? `${Number(field.observedRuns || 0)}/${Number(field.requiredRuns || 3)} · ${clean(field.status) || "unknown"}` : "kenttävalidointia ei ole"
    ),
    check(
      "techstream-reference",
      "Techstream-reference ladattu",
      techstreamLoaded,
      techstreamLoaded ? clean(techstream.status) || "loaded" : "reference puuttuu"
    ),
    check(
      "verified-mapping",
      "Vähintään yksi verified CAN-mappaus",
      hasVerifiedMapping,
      techstreamLoaded ? `${verifiedMappings} verified` : "Techstream-reference puuttuu"
    ),
    check(
      "engine-mapping",
      "Engine 7E0 → 7E8 varmennettu Techstream-ristiinvertailulla",
      engineMappingObserved,
      engineMappingObserved ? "verified + observed" : "verified 7E0 → 7E8 -osuma puuttuu"
    ),
    check(
      "verified-consistency",
      "Kaikki verified-mappaukset havaittu ilman ristiriitaa",
      allVerifiedMappingsObserved,
      hasVerifiedMapping
        ? `${verifiedObserved}/${verifiedMappings} observed · discrepancies=${verifiedDiscrepancies}`
        : "verified-mappauksia ei ole"
    )
  ]);

  let status = "collecting-field-evidence";
  if (field && fieldReady !== true && clean(field.status) === "needs-attention") {
    status = "field-evidence-needs-attention";
  } else if (fieldReady && !techstreamLoaded) {
    status = "awaiting-techstream";
  } else if (fieldReady && techstreamLoaded && (!hasVerifiedMapping || !engineMappingObserved || !allVerifiedMappingsObserved)) {
    status = "techstream-needs-attention";
  } else if (fieldReady && techstreamLoaded && hasVerifiedMapping && engineMappingObserved && allVerifiedMappingsObserved) {
    status = "ready-for-release-review";
  }

  const blockers = Object.freeze(checks.filter(item => !item.pass).map(item => item.code));
  return Object.freeze({
    schemaVersion: RELEASE_READINESS_SCHEMA_VERSION,
    targetVersion: RELEASE_READINESS_TARGET_VERSION,
    status,
    readyForReleaseReview: status === "ready-for-release-review",
    releaseApproved: false,
    manualReviewRequired: true,
    fieldStatus: clean(field?.status) || "not-observed",
    techstreamStatus: clean(techstream?.status) || "not-loaded",
    checks,
    blockers,
    warnings: warningsFromComparison(techstream),
    writable: false
  });
}

export function buildReleaseReadinessTextReport(value) {
  const readiness = value?.schemaVersion === RELEASE_READINESS_SCHEMA_VERSION && Array.isArray(value?.checks)
    ? value
    : evaluateReleaseReadiness(value || {});
  const lines = [
    "IS220d OBD FLEX RELEASE READINESS",
    `Schema: ${RELEASE_READINESS_SCHEMA_VERSION}`,
    `Target version: ${RELEASE_READINESS_TARGET_VERSION}`,
    `Status: ${readiness.status}`,
    `Ready for release review: ${readiness.readyForReleaseReview ? "yes" : "no"}`,
    "Release approved automatically: no",
    "Manual review required: yes",
    "",
    "Checks:"
  ];
  for (const item of readiness.checks || []) {
    lines.push(`- ${item.pass ? "PASS" : "PENDING"} | ${item.code} | ${item.label} | ${item.detail}`);
  }
  if (readiness.warnings?.length) {
    lines.push("", "Warnings:");
    for (const warning of readiness.warnings) lines.push(`- ${warning}`);
  }
  lines.push(
    "",
    "Evidence boundary:",
    "- This report evaluates already stored read-only evidence only.",
    "- It sends no vehicle command and creates no CAN mapping automatically.",
    "- Candidate mappings never satisfy a verified release gate."
  );
  return `${lines.join("\n")}\n`;
}

