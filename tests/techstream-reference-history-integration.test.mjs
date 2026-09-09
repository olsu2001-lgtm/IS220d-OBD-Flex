import test from "node:test";
import assert from "node:assert/strict";
import { evaluateEcuSurvey } from "../src/ecu-survey.js";
import {
  recordEcuSurveySnapshot,
  summarizeEcuSurveyHistory
} from "../src/ecu-survey-history.js";
import { buildEcuSurveyTextReport } from "../src/ecu-survey-report.js";
import { buildEcuSurveyUiModel } from "../src/ecu-survey-ui.js";
import { saveTechstreamReference } from "../src/techstream-reference.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function reference() {
  return {
    schemaVersion: 1,
    source: "techstream-health-check",
    referenceId: "TS-TEST-1",
    capturedAt: "2026-09-06T12:00:00+03:00",
    systems: [
      { name: "Engine system", dtcs: [] },
      { name: "Skid control system", dtcs: ["C0215", "U0073"] }
    ],
    mappings: [{
      requestHeader: "7E0",
      responseHeader: "7E8",
      systemName: "Engine system",
      evidenceLevel: "verified",
      evidenceNote: "Repeated survey plus Mode 09 engine evidence"
    }]
  };
}

function survey() {
  return evaluateEcuSurvey({
    runId: "survey-1",
    startedAt: 1000,
    endedAt: 2000,
    observations: [{ requestHeader: "7E0", responseHeader: "7E8", validResponse: true }]
  });
}

test("persisted Techstream reference is compared with latest survey without modifying survey history", () => {
  const storage = memoryStorage();
  const before = recordEcuSurveySnapshot(survey(), storage);
  assert.equal(before.techstreamComparison.loaded, false);
  const historyBeforeReference = JSON.stringify(before.snapshots);

  assert.equal(saveTechstreamReference(reference(), storage).saved, true);
  const summary = summarizeEcuSurveyHistory(storage);
  assert.equal(summary.techstreamComparison.loaded, true);
  assert.equal(summary.techstreamComparison.status, "verified-mappings-observed");
  assert.equal(summary.techstreamComparison.verifiedObserved, 1);
  assert.equal(summary.techstreamComparison.systemCount, 2);
  assert.equal(summary.techstreamComparison.dtcCount, 2);
  assert.equal(JSON.stringify(summary.snapshots), historyBeforeReference);

  const model = buildEcuSurveyUiModel(summary.latestSnapshot, summary);
  assert.equal(model.techstreamReference.loaded, true);
  assert.equal(model.techstreamReference.code, "observed");
  assert.equal(model.techstreamReference.verifiedObserved, 1);
  assert.deepEqual(model.techstreamReference.systems[1].dtcs, ["C0215", "U0073"]);
});

test("survey text report appends neutral Techstream comparison when reference is loaded", () => {
  const storage = memoryStorage();
  recordEcuSurveySnapshot(survey(), storage);
  saveTechstreamReference(reference(), storage);
  const summary = summarizeEcuSurveyHistory(storage);
  const report = buildEcuSurveyTextReport(summary.latestSnapshot, summary);
  assert.match(report, /TECHSTREAM REFERENCE/);
  assert.match(report, /Reference ID: TS-TEST-1/);
  assert.match(report, /Skid control system \| dtc=C0215,U0073/);
  assert.match(report, /System names never create CAN mappings automatically/);
});
