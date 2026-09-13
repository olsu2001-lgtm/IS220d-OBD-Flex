import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { safeIs220dCaptureEvidenceFromDiagnosticRun } from "../src/ecu-survey-diagnostic.js";

const surveySource = fs.readFileSync(new URL("../src/ecu-survey-diagnostic.js", import.meta.url), "utf8");
const publisherSource = fs.readFileSync(new URL("../src/component-diagnostics-publisher.js", import.meta.url), "utf8");
const mainSource = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");

test("completed diagnostic run sends sanitized capture evidence through the BOM publisher", () => {
  assert.match(surveySource, /safeIs220dCaptureEvidenceFromDiagnosticRun\(run\)/);
  assert.match(surveySource, /captureEvidence\s*\n?\s*\}/);
  assert.match(surveySource, /publishIs220dComponentDiagnosticCoverageToUi\(componentDiagnostics,\s*\{/);
  assert.match(publisherSource, /publishIs220dCaptureHistory\(meta\.captureEvidence\)/);
});

test("capture extraction fails closed and cannot abort diagnostic post-processing", () => {
  const hostileResult = {
    requestHeader: "7E0",
    command: "010C",
    validResponse: true,
    get raw() {
      throw new Error("malformed runtime result");
    }
  };
  assert.doesNotThrow(() => safeIs220dCaptureEvidenceFromDiagnosticRun({
    startedAt: 1,
    endedAt: 2,
    meta: { reportId: "regression-guard" },
    results: [hostileResult]
  }));
  assert.equal(safeIs220dCaptureEvidenceFromDiagnosticRun({
    startedAt: 1,
    endedAt: 2,
    meta: { reportId: "regression-guard" },
    results: [hostileResult]
  }), null);
});

test("capture history and Techstream gap UI are independent optional branches after execution state", () => {
  const functionStart = publisherSource.indexOf("function loadTechstreamDataListGapModule()");
  const functionEnd = publisherSource.indexOf("function loadNextInspectionModule()", functionStart);
  const techstreamLoader = publisherSource.slice(functionStart, functionEnd);
  assert.ok(functionStart >= 0 && functionEnd > functionStart);
  assert.match(techstreamLoader, /loadInspectionExecutionStateModule\(\)/);
  assert.doesNotMatch(techstreamLoader, /loadCaptureHistoryModule\(\)/);
});

test("capture-history integration does not add a second transport loop to main runtime", () => {
  assert.doesNotMatch(mainSource, /is220d-capture-history|publishIs220dCaptureHistory|saveIs220dCapture/i);
  assert.doesNotMatch(publisherSource, /\.send\s*\(|queryPid\s*\(|queryToyotaReadData\s*\(|NativeElm|transport\.send|fetch\s*\(|XMLHttpRequest|WebSocket/i);
});
