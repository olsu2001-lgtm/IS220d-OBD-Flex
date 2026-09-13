import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  IS220D_TECHSTREAM_EVIDENCE_STORAGE_KEY,
  buildIs220dTechstreamEvidenceState,
  clearIs220dTechstreamEvidence,
  readIs220dTechstreamEvidence,
  writeIs220dTechstreamEvidence
} from "../src/is220d-techstream-evidence.js";

function fakeStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    dump(key) { return values.get(key); }
  };
}

const imported = {
  values: {
    injectionFeedbackMm3PerStroke: [0.4, -0.3, 0.2, -0.1],
    targetCommonRailPressureKpa: 39800,
    targetPumpScvCurrentMa: 1275
  }
};

test("stores only sanitized Techstream Data List values and provenance", () => {
  const storage = fakeStorage();
  writeIs220dTechstreamEvidence(imported, { storage, importedAt: 1234, fileName: "idle.csv" });
  const record = readIs220dTechstreamEvidence(storage);
  assert.equal(record.importedAt, 1234);
  assert.equal(record.fileName, "idle.csv");
  assert.deepEqual(record.values.injectionFeedbackMm3PerStroke, [0.4, -0.3, 0.2, -0.1]);
  assert.equal(record.values.targetCommonRailPressureKpa, 39800);
  assert.equal(record.values.targetPumpScvCurrentMa, 1275);
  assert.ok(storage.dump(IS220D_TECHSTREAM_EVIDENCE_STORAGE_KEY));
});

test("maps imported values only to relevant fuel inspection points", () => {
  const state = buildIs220dTechstreamEvidenceState({
    schemaVersion: 1,
    importedAt: 1,
    fileName: "idle.csv",
    values: imported.values
  });
  assert.equal(state.availableTargetCount, 3);
  assert.equal(state.points.find(point => point.pointId === "injector-system-context").availableCount, 1);
  assert.equal(state.points.find(point => point.pointId === "scv-rail-response").availableCount, 2);
  assert.equal(state.points.find(point => point.pointId === "pump-rail-build").availableCount, 2);
  assert.equal(state.points.find(point => point.pointId === "rail-sensor-cranking-response").availableCount, 1);
});

test("partial CSV remains partial reference evidence and does not fabricate values", () => {
  const state = buildIs220dTechstreamEvidenceState({
    schemaVersion: 1,
    values: {
      injectionFeedbackMm3PerStroke: [0.2, null, null, null],
      targetCommonRailPressureKpa: 40100,
      targetPumpScvCurrentMa: null
    }
  });
  assert.equal(state.availableTargetCount, 1);
  assert.equal(state.available.injectorFeedback, false);
  assert.equal(state.available.targetRail, true);
  assert.equal(state.available.targetScv, false);
});

test("clear removes persisted Techstream evidence", () => {
  const storage = fakeStorage();
  writeIs220dTechstreamEvidence(imported, { storage });
  clearIs220dTechstreamEvidence(storage);
  assert.equal(storage.dump(IS220D_TECHSTREAM_EVIDENCE_STORAGE_KEY), undefined);
  assert.equal(readIs220dTechstreamEvidence(storage).importedAt, 0);
});

test("Techstream evidence overlay contains no vehicle transport or command authorization path", () => {
  const source = fs.readFileSync(new URL("../src/is220d-techstream-evidence.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.send\s*\(|NativeElm|NativeBle|ATSH|ATCRA|productionAuthorized|allowlist|queryToyotaReadData|219C/i);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket/);
});
