import { APP_VERSION } from "../src/app-version.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  RELEASE_READINESS_SCHEMA_VERSION,
  RELEASE_READINESS_TARGET_VERSION,
  buildReleaseReadinessTextReport,
  evaluateReleaseReadiness
} from "../src/release-readiness.js";

function fieldValidation(overrides = {}) {
  return {
    status: "ready-for-techstream",
    readyForTechstream: true,
    observedRuns: 3,
    requiredRuns: 3,
    ...overrides
  };
}

function techstreamComparison(overrides = {}) {
  return {
    loaded: true,
    status: "verified-mappings-observed",
    verifiedMappings: 1,
    candidateMappings: 0,
    verifiedObserved: 1,
    verifiedDiscrepancies: 0,
    mappings: [{
      requestHeader: "7E0",
      responseHeader: "7E8",
      systemName: "Engine system",
      evidenceLevel: "verified",
      status: "observed"
    }],
    unmappedFlexResponders: [],
    unmappedTechstreamSystems: [],
    manualReviewRequired: true,
    ...overrides
  };
}

test("release readiness remains collecting until the three-run field gate passes", () => {
  const result = evaluateReleaseReadiness({
    fieldValidation: fieldValidation({
      status: "collecting",
      readyForTechstream: false,
      observedRuns: 1
    }),
    techstreamComparison: techstreamComparison()
  });
  assert.equal(result.schemaVersion, RELEASE_READINESS_SCHEMA_VERSION);
  assert.equal(result.targetVersion, RELEASE_READINESS_TARGET_VERSION);
  assert.equal(result.status, "collecting-field-evidence");
  assert.equal(result.readyForReleaseReview, false);
  assert.deepEqual(result.blockers, ["field-validation"]);
  assert.equal(result.releaseApproved, false);
  assert.equal(result.manualReviewRequired, true);
});

test("field validation ready without Techstream evidence becomes awaiting-techstream", () => {
  const result = evaluateReleaseReadiness({
    fieldValidation: fieldValidation(),
    techstreamComparison: { loaded: false, status: "not-loaded" }
  });
  assert.equal(result.status, "awaiting-techstream");
  assert.equal(result.readyForReleaseReview, false);
  assert.equal(result.checks.find(item => item.code === "field-validation").pass, true);
  assert.equal(result.checks.find(item => item.code === "techstream-reference").pass, false);
});

test("candidate mapping never satisfies the verified release gate", () => {
  const result = evaluateReleaseReadiness({
    fieldValidation: fieldValidation(),
    techstreamComparison: techstreamComparison({
      status: "manual-review",
      verifiedMappings: 0,
      candidateMappings: 1,
      verifiedObserved: 0,
      mappings: [{
        requestHeader: "7E0",
        responseHeader: "7E8",
        systemName: "Engine system",
        evidenceLevel: "candidate",
        status: "observed"
      }]
    })
  });
  assert.equal(result.status, "techstream-needs-attention");
  assert.equal(result.checks.find(item => item.code === "verified-mapping").pass, false);
  assert.equal(result.checks.find(item => item.code === "engine-mapping").pass, false);
  assert.equal(result.warnings.some(item => /candidate-tason/.test(item)), true);
});

test("verified mapping discrepancy blocks release review", () => {
  const result = evaluateReleaseReadiness({
    fieldValidation: fieldValidation(),
    techstreamComparison: techstreamComparison({
      status: "verified-mapping-discrepancy",
      verifiedObserved: 0,
      verifiedDiscrepancies: 1,
      mappings: [{
        requestHeader: "7E0",
        responseHeader: "7E8",
        systemName: "Engine system",
        evidenceLevel: "verified",
        status: "different-response"
      }]
    })
  });
  assert.equal(result.status, "techstream-needs-attention");
  assert.equal(result.readyForReleaseReview, false);
  assert.equal(result.checks.find(item => item.code === "verified-consistency").pass, false);
  assert.equal(result.checks.find(item => item.code === "engine-mapping").pass, false);
});

test("matching field and explicit verified 7E0 to 7E8 evidence becomes ready only for release review", () => {
  const result = evaluateReleaseReadiness({
    fieldValidation: fieldValidation(),
    techstreamComparison: techstreamComparison()
  });
  assert.equal(result.status, "ready-for-release-review");
  assert.equal(result.readyForReleaseReview, true);
  assert.equal(result.releaseApproved, false);
  assert.equal(result.checks.every(item => item.pass), true);
  assert.deepEqual(result.blockers, []);
});

test("unmapped systems stay warnings and do not silently create mappings", () => {
  const result = evaluateReleaseReadiness({
    fieldValidation: fieldValidation(),
    techstreamComparison: techstreamComparison({
      unmappedFlexResponders: [{ requestHeader: "7E3", responseHeaders: ["7EB"] }],
      unmappedTechstreamSystems: ["Skid control system", "Airbag system"]
    })
  });
  assert.equal(result.status, "ready-for-release-review");
  assert.equal(result.warnings.length, 2);
  assert.match(result.warnings.join("\n"), /Flex-vastaajaa/);
  assert.match(result.warnings.join("\n"), /Techstream-järjestelmää/);
});

test("release readiness text report is compact, review-only and contains no raw transport payload", () => {
  const readiness = evaluateReleaseReadiness({
    fieldValidation: fieldValidation(),
    techstreamComparison: techstreamComparison()
  });
  const report = buildReleaseReadinessTextReport(readiness);
  assert.ok(report.split("\n").includes(`Target version: ${APP_VERSION}`));
  assert.match(report, /Ready for release review: yes/);
  assert.match(report, /Release approved automatically: no/);
  assert.match(report, /Candidate mappings never satisfy a verified release gate/);
  assert.doesNotMatch(report, /7E8\s+06\s+61\s+7E|ATSH|ATSP|ATZ|217E|217F|212C|0902/i);
});

