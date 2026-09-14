import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  IS220D_CAPTURE_CANDIDATE_STORAGE_KEY,
  IS220D_CAPTURE_CONTEXTS,
  IS220D_CAPTURE_HISTORY_STORAGE_KEY,
  buildIs220dCaptureEvidenceFromDiagnosticRun,
  buildIs220dCaptureHistoryHtml,
  clearIs220dCaptureHistory,
  compareIs220dCaptureHistory,
  publishIs220dCaptureHistory,
  readIs220dCaptureCandidate,
  readIs220dCaptureHistory,
  saveIs220dCapture,
  summarizeIs220dCaptureHistory,
  writeIs220dCaptureCandidate
} from "../src/is220d-capture-history.js";

function fakeStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    dump(key) { return values.get(key); }
  };
}

const diagnosticResult = (command, raw, validResponse = true) => ({
  command,
  raw,
  validResponse,
  requestHeader: "7E0",
  error: validResponse ? "" : "NO DATA"
});

function evidence(runId, maf, map = null) {
  const values = [{ signalKey: "engine.maf", value: maf, unit: "g/s", evidence: "vehicle-verified" }];
  const observed = ["engine.maf"];
  if (map != null) {
    values.push({ signalKey: "engine.map", value: map, unit: "kPa", evidence: "vehicle-verified" });
    observed.push("engine.map");
  }
  return {
    schemaVersion: 1,
    source: "existing-wide-diagnostic-results",
    runId,
    startedAt: 100,
    endedAt: 200,
    engineState: "running",
    observedSignalKeys: observed,
    values
  };
}

test("capture evidence keeps only current production-authorized wide-diagnostic signals", () => {
  const result = buildIs220dCaptureEvidenceFromDiagnosticRun({
    meta: { reportId: "run-1", engineRunningDeclared: true },
    startedAt: 10,
    endedAt: 20,
    results: [
      diagnosticResult("0110", "41 10 03 E8"),
      diagnosticResult("0105", "41 05 82"),
      diagnosticResult("219C", "61 9C 00 01 00 02 00 03 00 04"),
      diagnosticResult("2193", "61 93 50")
    ]
  });

  assert.equal(result.runId, "run-1");
  assert.equal(result.engineState, "running");
  assert.ok(result.observedSignalKeys.includes("engine.maf"));
  assert.ok(result.observedSignalKeys.includes("engine.coolant_temperature"));
  assert.ok(!result.observedSignalKeys.includes("engine.injection_feedback_rejected"));
  assert.ok(!result.observedSignalKeys.includes("engine.fuel_temperature_screening"));
  assert.equal(result.values.find(value => value.signalKey === "engine.maf")?.value, 10);
  assert.equal(result.values.find(value => value.signalKey === "engine.coolant_temperature")?.value, 90);
});

test("candidate persistence stores sanitized values but no raw ECU payload", () => {
  const storage = fakeStorage();
  writeIs220dCaptureCandidate({
    ...evidence("run-2", 11),
    raw: "7E8 41 10 04 4C",
    values: [{ signalKey: "engine.maf", value: 11, raw: "SECRET", sourceCommand: "0110" }]
  }, storage);
  const persisted = storage.dump(IS220D_CAPTURE_CANDIDATE_STORAGE_KEY);
  assert.ok(persisted);
  assert.doesNotMatch(persisted, /7E8|SECRET|0110/);
  const candidate = readIs220dCaptureCandidate(storage);
  assert.equal(candidate.values[0].signalKey, "engine.maf");
  assert.equal(candidate.values[0].unit, "g\/s");
});

test("one diagnostic run can belong to only one explicit capture context", () => {
  const storage = fakeStorage();
  saveIs220dCapture(evidence("same-run", 10), "running", { storage, recordedAt: 1 });
  saveIs220dCapture(evidence("same-run", 12), "warm-idle", { storage, recordedAt: 2 });
  const history = readIs220dCaptureHistory(storage);
  assert.equal(history.captures.length, 1);
  assert.equal(history.captures[0].context, "warm-idle");
  assert.equal(history.captures[0].evidence.values[0].value, 12);
});

test("capture comparison never combines different operating states", () => {
  const storage = fakeStorage();
  saveIs220dCapture(evidence("koeo-1", 1), "koeo", { storage, recordedAt: 1 });
  saveIs220dCapture(evidence("running-1", 10), "running", { storage, recordedAt: 2 });
  saveIs220dCapture(evidence("running-2", 12), "running", { storage, recordedAt: 3 });
  const history = readIs220dCaptureHistory(storage);

  const koeo = compareIs220dCaptureHistory(history, "koeo", "all");
  assert.equal(koeo.status, "insufficient-history");
  assert.equal(koeo.compatibleCaptureCount, 1);

  const running = compareIs220dCaptureHistory(history, "running", "all");
  assert.equal(running.status, "comparable");
  assert.equal(running.compatibleCaptureCount, 2);
  assert.equal(running.values.find(value => value.signalKey === "engine.maf")?.delta, 2);
});

test("group-scoped comparison exposes only signals used by that BOM diagnostic group", () => {
  const storage = fakeStorage();
  saveIs220dCapture(evidence("run-a", 10, 100), "load", { storage, recordedAt: 1 });
  saveIs220dCapture(evidence("run-b", 13, 120), "load", { storage, recordedAt: 2 });
  const history = readIs220dCaptureHistory(storage);

  const air = compareIs220dCaptureHistory(history, "load", "air-intake-turbo-egr");
  assert.equal(air.status, "comparable");
  assert.deepEqual(air.values.map(value => value.signalKey).sort(), ["engine.maf", "engine.map"]);

  const thermal = compareIs220dCaptureHistory(history, "load", "engine-thermal-baseline");
  assert.equal(thermal.status, "no-common-values");
});

test("history summary counts explicit contexts and clear does not touch candidate", () => {
  const storage = fakeStorage();
  writeIs220dCaptureCandidate(evidence("candidate", 9), storage);
  saveIs220dCapture(evidence("a", 10), "warm-idle", { storage });
  saveIs220dCapture(evidence("b", 11), "load", { storage });
  const summary = summarizeIs220dCaptureHistory(readIs220dCaptureHistory(storage));
  assert.equal(summary.total, 2);
  assert.equal(summary.counts["warm-idle"], 1);
  assert.equal(summary.counts.load, 1);
  clearIs220dCaptureHistory(storage);
  assert.equal(storage.dump(IS220D_CAPTURE_HISTORY_STORAGE_KEY), undefined);
  assert.ok(storage.dump(IS220D_CAPTURE_CANDIDATE_STORAGE_KEY));
});

test("capture UI text states the cross-state and diagnostic-boundary rules", () => {
  const storage = fakeStorage();
  saveIs220dCapture(evidence("a", 10), "running", { storage, recordedAt: 1 });
  saveIs220dCapture(evidence("b", 12), "running", { storage, recordedAt: 2 });
  const html = buildIs220dCaptureHistoryHtml(readIs220dCaptureHistory(storage), evidence("candidate", 13), "running", "all");
  assert.match(html, /Eri käyttötilojen arvoja ei yhdistetä/);
  assert.match(html, /Muutos on numeerinen ero, ei automaattinen vikatuomio/);
  assert.match(html, /KÄYNTI/);
});

test("publisher remains usable without browser DOM", () => {
  const storage = fakeStorage();
  const state = publishIs220dCaptureHistory(evidence("run-node", 10), storage);
  assert.equal(state.candidate.runId, "run-node");
  assert.equal(state.history.captures.length, 0);
});

test("capture contexts are explicit and capture module contains no vehicle transmit or network path", () => {
  assert.deepEqual(Object.keys(IS220D_CAPTURE_CONTEXTS), ["koeo", "cranking", "running", "warm-idle", "load"]);
  const source = fs.readFileSync(new URL("../src/is220d-capture-history.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.send\s*\(/);
  assert.doesNotMatch(source, /\.(?:queryPid|queryToyotaReadData|queryRealtime|probeResearchIdentifier|probeSupportBitmap)\s*\(/i);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest|WebSocket|NativeElm|transport\.send/i);
  assert.doesNotMatch(JSON.stringify(readIs220dCaptureHistory(fakeStorage())), /219C/);
});
