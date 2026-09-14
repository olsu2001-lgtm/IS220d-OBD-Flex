import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  IS220D_FUEL_INSPECTION_POINTS,
  buildIs220dFuelInspectionScope,
  buildIs220dFuelInspectionScopeHtml,
  publishIs220dFuelInspectionPoints
} from "../src/is220d-fuel-inspection-points.js";

test("fuel inspection set covers all six fuel/rail/injection BOM components", () => {
  const scope = buildIs220dFuelInspectionScope("fuel-rail-injection");
  assert.equal(scope.visible, true);
  assert.equal(scope.pointCount, 12);
  assert.equal(scope.componentCount, 6);
  assert.deepEqual([...new Set(scope.points.map(point => point.componentId))].sort(), [
    "engine.common_rail_pressure_sensor",
    "engine.fuel_filter",
    "engine.fuel_temperature_sensor",
    "engine.injection_pump",
    "engine.main_injectors",
    "engine.scv"
  ]);
});

test("fuel inspection points preserve reviewed Vikadiag source rows", () => {
  const rows = Object.fromEntries(IS220D_FUEL_INSPECTION_POINTS.map(point => [point.id, point.sourceRows]));
  assert.deepEqual(rows["fuel-filter-baseline"], [32, 145]);
  assert.deepEqual(rows["scv-physical-baseline"], [10, 336, 343]);
  assert.deepEqual(rows["pump-preconditions"], [34, 336, 343]);
  assert.deepEqual(rows["rail-sensor-koeo-plausibility"], [452]);
  assert.deepEqual(rows["fuel-temp-cold-plausibility"], [154, 256, 313]);
  assert.deepEqual(rows["injector-physical-baseline"], [8, 140, 281, 334, 344]);
  assert.ok(IS220D_FUEL_INSPECTION_POINTS.every(point => point.sourceSheet === "Vikadiag_kohteet"));
});

test("fuel model separates current verified reads from evidence gaps", () => {
  const scope = buildIs220dFuelInspectionScope("fuel-rail-injection");
  const scv = scope.points.find(point => point.id === "scv-rail-response");
  assert.equal(scv.evidenceSummary.currentWideDiagnostic, 2);
  assert.equal(scv.evidenceSummary.awaitingVerification, 1);
  const fuelTemp = scope.points.find(point => point.id === "fuel-temp-cold-plausibility");
  assert.equal(fuelTemp.evidenceSummary.currentWideDiagnostic, 0);
  assert.equal(fuelTemp.evidenceSummary.awaitingVerification, 1);
  const injectors = scope.points.find(point => point.id === "injector-system-context");
  assert.ok(injectors.evidenceSummary.currentWideDiagnostic >= 2);
  assert.ok(injectors.evidenceSummary.awaitingVerification >= 1);
});

test("field-rejected injector feedback cannot enter fuel inspection evidence", () => {
  const scope = buildIs220dFuelInspectionScope("fuel-rail-injection");
  for (const point of scope.points) {
    for (const signal of point.signals) {
      assert.notEqual(signal.authorization, "field-rejected");
      assert.equal("commands" in signal, false);
    }
  }
  assert.doesNotMatch(JSON.stringify(scope.points.map(point => point.signals)), /219C/);
});

test("fuel inspection UI makes target/duty/feedback gaps explicit instead of inventing them", () => {
  const html = buildIs220dFuelInspectionScopeHtml(buildIs220dFuelInspectionScope("fuel-rail-injection"));
  assert.match(html, /12 tarkastuspistettä/);
  assert.match(html, /Target rail pressure/);
  assert.match(html, /SCV duty/);
  assert.match(html, /sylinterikohtaista injection feedback/i);
  assert.match(html, /Vikadiag_kohteet · rivit 452/);
  assert.match(html, /odottaa varmennusta/i);
});

test("fuel inspection set does not invent fixed rail or fuel-temperature thresholds", () => {
  const text = IS220D_FUEL_INSPECTION_POINTS.map(point => `${point.instruction} ${point.expectedPattern} ${point.limitation}`).join("\n");
  assert.doesNotMatch(text, /(?:>|<|≥|≤)\s*\d/);
  assert.match(text, /lähde ei anna kiinteää numeerista toleranssia/i);
  assert.match(text, /ei yksin nimeä/i);
});

test("fuel panel is visible only for all or fuel scope", () => {
  assert.equal(buildIs220dFuelInspectionScope("all").visible, true);
  assert.equal(buildIs220dFuelInspectionScope("fuel-rail-injection").visible, true);
  const air = buildIs220dFuelInspectionScope("air-intake-turbo-egr");
  assert.equal(air.visible, false);
  assert.equal(air.pointCount, 0);
});

test("fuel inspection publisher works without browser DOM", () => {
  const scope = publishIs220dFuelInspectionPoints();
  assert.equal(scope.pointCount, 12);
  assert.equal(scope.componentCount, 6);
});

test("fuel inspection layer has no vehicle transmit or network path", () => {
  const source = fs.readFileSync(new URL("../src/is220d-fuel-inspection-points.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.send\s*\(/);
  assert.doesNotMatch(source, /\.(?:queryPid|queryToyotaReadData|queryRealtime|probeResearchIdentifier|probeSupportBitmap)\s*\(/i);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest|WebSocket|NativeElm|transport\.send/i);
});
