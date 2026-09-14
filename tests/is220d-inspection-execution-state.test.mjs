import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  IS220D_ALL_INSPECTION_POINTS,
  IS220D_INSPECTION_EXECUTION_STATUSES,
  IS220D_INSPECTION_PROGRESS_STORAGE_KEY,
  buildIs220dInspectionExecutionState,
  buildIs220dInspectionExecutionSummaryHtml,
  clearIs220dInspectionPointProgress,
  readIs220dInspectionPointProgress,
  writeIs220dInspectionPointFinding
} from "../src/is220d-inspection-execution-state.js";
import { buildIs220dTechstreamEvidenceState } from "../src/is220d-techstream-evidence.js";

function fakeStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    dump(key) { return values.get(key); }
  };
}

function coverageWithSignalStates(states = {}) {
  return {
    applicable: true,
    components: [{
      id: "test.component",
      groupEvidence: [{
        signals: Object.entries(states).map(([signalKey, state]) => ({
          signalKey,
          attempted: state.attempted === true || state.observed === true,
          observed: state.observed === true,
          attempts: state.attempted === true || state.observed === true ? 1 : 0
        }))
      }]
    }]
  };
}

function pointState(state, id) {
  const point = state.points.find(item => item.id === id);
  assert.ok(point, `missing point ${id}`);
  return point;
}

test("execution layer covers all 50 reviewed inspection points and 23 BOM components", () => {
  assert.equal(IS220D_ALL_INSPECTION_POINTS.length, 50);
  assert.equal(new Set(IS220D_ALL_INSPECTION_POINTS.map(point => point.id)).size, 50);
  assert.equal(new Set(IS220D_ALL_INSPECTION_POINTS.map(point => point.componentId)).size, 23);
  assert.ok(IS220D_ALL_INSPECTION_POINTS.every(point => point.groupId));
});

test("physical points require explicit user confirmation instead of being inferred from OBD", () => {
  const state = buildIs220dInspectionExecutionState(coverageWithSignalStates({
    "engine.maf": { observed: true }
  }));
  const point = pointState(state, "maf-physical-baseline");
  assert.equal(point.status, "requires-physical-confirmation");
  assert.equal(point.statusLabel, "VAATII FYYSISEN VARMISTUKSEN");
  assert.equal(point.finding, "");
});

test("manual physical finding persists and converts the point to collected evidence", () => {
  const storage = fakeStorage();
  writeIs220dInspectionPointFinding("maf-physical-baseline", "deviation-found", { storage, now: 1234 });
  const progress = readIs220dInspectionPointProgress(storage);
  assert.deepEqual(progress.items["maf-physical-baseline"], { finding: "deviation-found", updatedAt: 1234 });
  const state = buildIs220dInspectionExecutionState(null, progress);
  const point = pointState(state, "maf-physical-baseline");
  assert.equal(point.status, "evidence-collected");
  assert.equal(point.findingLabel, "POIKKEAMA HAVAITTU");
  assert.equal(state.summary.deviationsFound, 1);
});

test("physical progress accepts only physical points and known findings", () => {
  const storage = fakeStorage();
  assert.throws(() => writeIs220dInspectionPointFinding("map-load-response", "checked-normal", { storage }), /does not accept manual physical confirmation/);
  assert.throws(() => writeIs220dInspectionPointFinding("maf-physical-baseline", "unknown", { storage }), /Invalid IS220d inspection finding/);
  assert.throws(() => writeIs220dInspectionPointFinding("not-a-point", "checked-normal", { storage }), /Unknown IS220d inspection point/);
});

test("a point backed only by an unverified signal waits for verification", () => {
  const state = buildIs220dInspectionExecutionState(coverageWithSignalStates());
  const point = pointState(state, "fuel-temp-cold-plausibility");
  assert.equal(point.status, "awaiting-verified-signal");
  assert.deepEqual(point.evidence.awaitingSignalKeys, ["engine.fuel_temperature_screening"]);
});

test("electronic point becomes partial when only part of its authorized evidence is observed", () => {
  const state = buildIs220dInspectionExecutionState(coverageWithSignalStates({
    "engine.map": { observed: true },
    "engine.maf": { attempted: true },
    "engine.rpm": { attempted: false }
  }));
  const point = pointState(state, "map-load-response");
  assert.equal(point.status, "partial");
  assert.equal(point.evidence.authorizedSignals, 3);
  assert.equal(point.evidence.observedAuthorized, 1);
  assert.equal(point.evidence.attemptedAuthorized, 2);
});

test("offline Techstream reference can only advance an electronic point to partial", () => {
  const reference = buildIs220dTechstreamEvidenceState({
    schemaVersion: 1,
    importedAt: 10,
    fileName: "idle.csv",
    values: {
      injectionFeedbackMm3PerStroke: [0.4, -0.3, 0.2, -0.1],
      targetCommonRailPressureKpa: 39800,
      targetPumpScvCurrentMa: 1275
    }
  });
  const state = buildIs220dInspectionExecutionState(coverageWithSignalStates(), undefined, "fuel-rail-injection", reference);
  const scv = pointState(state, "scv-rail-response");
  const injector = pointState(state, "injector-system-context");
  assert.equal(scv.status, "partial");
  assert.equal(injector.status, "partial");
  assert.equal(scv.evidence.offlineReferenceAvailable, true);
  assert.deepEqual(scv.evidence.offlineReferenceTargetKeys, ["targetRail", "targetScv"]);
  assert.match(scv.reason, /offline-referenssi/);
  assert.notEqual(scv.status, "evidence-collected");
  assert.notEqual(injector.status, "evidence-collected");
  assert.equal(state.summary.offlineReferencePoints, 5);
});

test("complete live evidence still controls evidence-collected status when offline reference also exists", () => {
  const reference = buildIs220dTechstreamEvidenceState({
    schemaVersion: 1,
    values: {
      injectionFeedbackMm3PerStroke: [0.4, -0.3, 0.2, -0.1],
      targetCommonRailPressureKpa: 39800,
      targetPumpScvCurrentMa: 1275
    }
  });
  const state = buildIs220dInspectionExecutionState(coverageWithSignalStates({
    "engine.rail_pressure_obd": { observed: true },
    "engine.rpm": { observed: true },
    "engine.fuel_temperature_screening": { observed: false }
  }), undefined, "fuel-rail-injection", reference);
  const point = pointState(state, "fuel-filter-rail-build");
  assert.equal(point.status, "evidence-collected");
  assert.equal(point.evidence.offlineReferenceAvailable, true);
});

test("electronic point reports evidence collected only when every authorized signal is observed", () => {
  const state = buildIs220dInspectionExecutionState(coverageWithSignalStates({
    "engine.map": { observed: true },
    "engine.maf": { observed: true },
    "engine.rpm": { observed: true }
  }));
  const point = pointState(state, "map-load-response");
  assert.equal(point.status, "evidence-collected");
  assert.equal(point.evidence.observedAuthorized, 3);
});

test("an attempted signal without a valid response counts as partial execution", () => {
  const state = buildIs220dInspectionExecutionState(coverageWithSignalStates({
    "engine.rail_pressure_obd": { attempted: true }
  }));
  const point = pointState(state, "rail-sensor-cranking-response");
  assert.equal(point.status, "partial");
  assert.equal(point.evidence.observedAuthorized, 0);
  assert.equal(point.evidence.attemptedAuthorized, 1);
});

test("group scope keeps execution state aligned with physical diagnostic groups", () => {
  const fuel = buildIs220dInspectionExecutionState(null, undefined, "fuel-rail-injection");
  assert.equal(fuel.pointCount, 12);
  assert.equal(fuel.componentCount, 6);
  assert.ok(fuel.points.every(point => point.groupId === "fuel-rail-injection"));

  const start = buildIs220dInspectionExecutionState(null, undefined, "starting-charging-position");
  assert.equal(start.pointCount, 6);
  assert.equal(start.componentCount, 3);
});

test("summary exposes the five user-facing execution states", () => {
  assert.deepEqual(Object.values(IS220D_INSPECTION_EXECUTION_STATUSES), [
    "EI ALOITETTU",
    "OSITTAIN",
    "EVIDENSSI KERÄTTY",
    "VAATII FYYSISEN VARMISTUKSEN",
    "ODOTTAA VARMENNETTUA SIGNAALIA"
  ]);
  const html = buildIs220dInspectionExecutionSummaryHtml(buildIs220dInspectionExecutionState(null));
  assert.match(html, /Tarkastuspisteiden suoritus/);
  assert.match(html, /EVIDENSSI/);
  assert.match(html, /OSITTAIN/);
  assert.match(html, /FYYSINEN/);
  assert.match(html, /ODOTTAA SIGNAALIA/);
  assert.match(html, /EI ALOITETTU/);
});

test("progress storage rejects stale or malformed entries and can be cleared", () => {
  const storage = fakeStorage();
  storage.setItem(IS220D_INSPECTION_PROGRESS_STORAGE_KEY, JSON.stringify({
    schemaVersion: 1,
    items: {
      "maf-physical-baseline": { finding: "checked-normal", updatedAt: 9 },
      "map-load-response": { finding: "checked-normal", updatedAt: 10 },
      "unknown-point": { finding: "deviation-found", updatedAt: 11 },
      "egr-mechanical-baseline": { finding: "bad-value", updatedAt: 12 }
    }
  }));
  const progress = readIs220dInspectionPointProgress(storage);
  assert.deepEqual(Object.keys(progress.items), ["maf-physical-baseline"]);
  assert.equal(clearIs220dInspectionPointProgress(storage).items && Object.keys(clearIs220dInspectionPointProgress(storage).items).length, 0);
  assert.equal(storage.dump(IS220D_INSPECTION_PROGRESS_STORAGE_KEY), undefined);
});

test("execution-state layer contains no vehicle transmit or network path", () => {
  const source = fs.readFileSync(new URL("../src/is220d-inspection-execution-state.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.send\s*\(/);
  assert.doesNotMatch(source, /\.(?:queryPid|queryToyotaReadData|queryRealtime|probeResearchIdentifier|probeSupportBitmap)\s*\(/i);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest|WebSocket|NativeElm|transport\.send/i);
  assert.doesNotMatch(JSON.stringify(IS220D_ALL_INSPECTION_POINTS), /219C/);
});
