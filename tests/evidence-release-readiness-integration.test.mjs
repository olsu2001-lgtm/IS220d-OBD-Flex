import { APP_VERSION } from "../src/app-version.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildEvidenceSupportBundle,
  stringifyEvidenceSupportBundle
} from "../src/evidence-support-bundle.js";

function history({ fieldReady = false, techstreamLoaded = false } = {}) {
  const fieldValidation = {
    status: fieldReady ? "ready-for-techstream" : "collecting",
    readyForTechstream: fieldReady,
    requiredRuns: 3,
    observedRuns: fieldReady ? 3 : 0,
    buildSha: "abcdef123456",
    runs: []
  };
  const techstreamComparison = techstreamLoaded
    ? {
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
        manualReviewRequired: true
      }
    : { loaded: false, status: "not-loaded" };
  return {
    snapshots: [],
    latestSnapshot: null,
    fieldValidation,
    techstreamComparison
  };
}

test("Evidence Support Bundle exposes the current version readiness state without approving a release", () => {
  const collecting = buildEvidenceSupportBundle(history(), { generatedAt: 1000 });
  assert.equal(collecting.releaseReadiness.targetVersion, APP_VERSION);
  assert.equal(collecting.releaseReadiness.status, "collecting-field-evidence");
  assert.equal(collecting.releaseReadiness.readyForReleaseReview, false);
  assert.equal(collecting.releaseReadiness.releaseApproved, false);

  const ready = buildEvidenceSupportBundle(history({ fieldReady: true, techstreamLoaded: true }), { generatedAt: 1000 });
  assert.equal(ready.releaseReadiness.status, "ready-for-release-review");
  assert.equal(ready.releaseReadiness.readyForReleaseReview, true);
  assert.equal(ready.releaseReadiness.releaseApproved, false);
  assert.equal(ready.releaseReadiness.checks.every(item => item.pass), true);
});

test("release readiness addition preserves the evidence bundle privacy boundary", () => {
  const value = history({ fieldReady: true, techstreamLoaded: true });
  value.secretRaw = "7E8 06 61 7E SECRET";
  value.adapterIdentity = "SECRET VLINKER ID";
  value.bluetoothAddress = "AA:BB:CC:DD:EE:FF";
  const json = stringifyEvidenceSupportBundle(value, { generatedAt: 1000 });
  assert.equal(json.includes("SECRET"), false);
  assert.equal(json.includes("AA:BB:CC:DD:EE:FF"), false);
  assert.match(json, /"releaseApproved": false/);
  assert.match(json, /"rawVehicleResponsesIncluded": false/);
});

test("Evidence Support UI only evaluates stored evidence and contains no vehicle transport path", async () => {
  const source = await readFile(new URL("../src/evidence-support-ui.js", import.meta.url), "utf8");
  assert.match(source, /buildEvidenceSupportBundle/);
  assert.match(source, /releaseReadiness/);
  assert.doesNotMatch(source, /\.command\s*\(|safeCommand\s*\(|runDiagnosticCommand\s*\(|sendBinary\s*\(|ATSH|ATSP|ATZ|ATMA|217E|217F|212C|02217E|02217F|02212C/);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket/);
});

