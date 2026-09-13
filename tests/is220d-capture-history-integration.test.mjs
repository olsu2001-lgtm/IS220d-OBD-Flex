import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const surveySource = fs.readFileSync(new URL("../src/ecu-survey-diagnostic.js", import.meta.url), "utf8");
const publisherSource = fs.readFileSync(new URL("../src/component-diagnostics-publisher.js", import.meta.url), "utf8");
const mainSource = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");

test("completed diagnostic run sends sanitized capture evidence through the BOM publisher", () => {
  assert.match(surveySource, /buildIs220dCaptureEvidenceFromDiagnosticRun\(run\)/);
  assert.match(surveySource, /captureEvidence\s*\n?\s*\}/);
  assert.match(surveySource, /publishIs220dComponentDiagnosticCoverageToUi\(componentDiagnostics,\s*\{/);
  assert.match(publisherSource, /publishIs220dCaptureHistory\(meta\.captureEvidence\)/);
});

test("capture history module is ordered after execution state and before Techstream gap UI", () => {
  const execution = publisherSource.indexOf("loadInspectionExecutionStateModule()");
  const capture = publisherSource.indexOf("loadCaptureHistoryModule()");
  const techstream = publisherSource.indexOf("loadTechstreamDataListGapModule()");
  assert.ok(execution >= 0 && capture > execution && techstream > capture);
});

test("capture-history integration does not add a second transport loop to main runtime", () => {
  assert.doesNotMatch(mainSource, /is220d-capture-history|publishIs220dCaptureHistory|saveIs220dCapture/i);
  assert.doesNotMatch(publisherSource, /\.send\s*\(|queryPid\s*\(|queryToyotaReadData\s*\(|NativeElm|transport\.send|fetch\s*\(|XMLHttpRequest|WebSocket/i);
});
