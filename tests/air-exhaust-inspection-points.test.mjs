import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  IS220D_AIR_EXHAUST_INSPECTION_POINTS,
  buildIs220dAirExhaustInspectionScope,
  buildIs220dAirExhaustInspectionScopeHtml,
  publishIs220dAirExhaustInspectionPoints
} from "../src/is220d-air-exhaust-inspection-points.js";
import { IS220D_COMPONENT_INSPECTION_POINTS } from "../src/is220d-component-inspection-points.js";
import { IS220D_FUEL_INSPECTION_POINTS } from "../src/is220d-fuel-inspection-points.js";
import { IS220D_STARTING_CHARGING_INSPECTION_POINTS } from "../src/is220d-starting-charging-inspection-points.js";
import { IS220D_COMPONENT_DIAGNOSTICS } from "../src/is220d-component-diagnostics.js";

test("remaining air/exhaust set covers nine previously uncovered BOM components", () => {
  const scope = buildIs220dAirExhaustInspectionScope("all");
  assert.equal(scope.visible, true);
  assert.equal(scope.pointCount, 16);
  assert.equal(scope.componentCount, 9);
  assert.deepEqual([...new Set(scope.points.map(point => point.componentId))].sort(), [
    "engine.air_cleaner_hose",
    "engine.exhaust_fuel_addition_injector",
    "engine.exhaust_gas_temperature_sensor_1",
    "engine.exhaust_gas_temperature_sensor_2",
    "engine.intake_manifold",
    "engine.intercooler",
    "engine.turbocharger",
    "engine.vacuum_regulating_valve",
    "engine.vacuum_switching_valve"
  ]);
});

test("remaining points preserve representative reviewed Vikadiag source rows", () => {
  const rows = Object.fromEntries(IS220D_AIR_EXHAUST_INSPECTION_POINTS.map(point => [point.id, point.sourceRows]));
  assert.deepEqual(rows["turbo-preconditions"], [25, 416]);
  assert.deepEqual(rows["intercooler-leak-baseline"], [21]);
  assert.deepEqual(rows["intake-manifold-carbon-baseline"], [22, 353, 407]);
  assert.deepEqual(rows["vacuum-regulator-baseline"], [29, 455]);
  assert.deepEqual(rows["vacuum-switch-baseline"], [30, 456]);
  assert.deepEqual(rows["air-cleaner-hose-baseline"], [20, 559, 560, 561]);
  assert.deepEqual(rows["egt1-plausibility"], [6, 331, 347, 469]);
  assert.deepEqual(rows["egt2-plausibility"], [7, 331, 347, 469]);
  assert.deepEqual(rows["fifth-injector-physical-baseline"], [9, 139, 280, 333]);
});

test("air and DPNR scopes split the final inspection set by physical group", () => {
  const air = buildIs220dAirExhaustInspectionScope("air-intake-turbo-egr");
  assert.equal(air.pointCount, 12);
  assert.equal(air.componentCount, 6);
  assert.ok(air.points.every(point => point.groupId === "air-intake-turbo-egr"));
  const exhaust = buildIs220dAirExhaustInspectionScope("dpnr-exhaust");
  assert.equal(exhaust.pointCount, 4);
  assert.equal(exhaust.componentCount, 3);
  assert.ok(exhaust.points.every(point => point.groupId === "dpnr-exhaust"));
});

test("all remaining electronic evidence uses registered signals without field-rejected injector feedback", () => {
  const scope = buildIs220dAirExhaustInspectionScope("all");
  for (const point of scope.points) {
    for (const signal of point.signals) {
      assert.notEqual(signal.authorization, "field-rejected");
      assert.equal("commands" in signal, false);
    }
  }
  assert.doesNotMatch(JSON.stringify(scope.points.map(point => point.signals)), /219C/);
});

test("EGT points stay pairwise and avoid invented model-specific thresholds", () => {
  const egt1 = buildIs220dAirExhaustInspectionScope("dpnr-exhaust").points.find(point => point.id === "egt1-plausibility");
  const egt2 = buildIs220dAirExhaustInspectionScope("dpnr-exhaust").points.find(point => point.id === "egt2-plausibility");
  assert.match(egt1.expectedPattern, /verrata EGT2/i);
  assert.match(egt2.expectedPattern, /EGT1\/EGT2-parin/i);
  assert.match(egt1.limitation, /ei ole näissä lähderiveissä/i);
  assert.match(egt2.limitation, /ei ole lähderiveissä/i);
});

test("5th injector remains read-only and separate from main injector feedback", () => {
  const point = buildIs220dAirExhaustInspectionScope("dpnr-exhaust").points.find(item => item.id === "fifth-injector-exhaust-response");
  assert.match(point.limitation, /Flex ei pakota regenerointia/i);
  assert.match(point.expectedPattern, /ei nimeä suutinta/i);
  assert.ok(point.signals.some(signal => signal.key === "engine.egt_inlet"));
  assert.ok(point.signals.some(signal => signal.key === "engine.dpnr_differential_pressure"));
});

test("combined source-linked inspection layers now cover all 23 DIRECT/INDIRECT components", () => {
  const coveredIds = new Set([
    ...IS220D_COMPONENT_INSPECTION_POINTS,
    ...IS220D_FUEL_INSPECTION_POINTS,
    ...IS220D_STARTING_CHARGING_INSPECTION_POINTS,
    ...IS220D_AIR_EXHAUST_INSPECTION_POINTS
  ].map(point => point.componentId));
  const recipeIds = new Set(IS220D_COMPONENT_DIAGNOSTICS.map(component => component.id));
  assert.equal(coveredIds.size, 23);
  assert.equal(recipeIds.size, 23);
  assert.deepEqual([...coveredIds].sort(), [...recipeIds].sort());
});

test("combined inspection layers expose 50 source-linked points", () => {
  assert.equal(
    IS220D_COMPONENT_INSPECTION_POINTS.length +
    IS220D_FUEL_INSPECTION_POINTS.length +
    IS220D_STARTING_CHARGING_INSPECTION_POINTS.length +
    IS220D_AIR_EXHAUST_INSPECTION_POINTS.length,
    50
  );
});

test("air/exhaust HTML exposes source lineage and explicit evidence limitations", () => {
  const html = buildIs220dAirExhaustInspectionScopeHtml(buildIs220dAirExhaustInspectionScope("dpnr-exhaust"));
  assert.match(html, /EGT1 kylmä- ja kuormaususkottavuus/);
  assert.match(html, /5th injector -oireen EGT\/DPNR-konteksti/);
  assert.match(html, /Vikadiag_kohteet · rivit 9, 139, 280, 333, 347/);
  assert.match(html, /Flex ei pakota regenerointia/);
});

test("air/exhaust publisher works without browser DOM", () => {
  const scope = publishIs220dAirExhaustInspectionPoints();
  assert.equal(scope.pointCount, 16);
  assert.equal(scope.componentCount, 9);
});

test("air/exhaust layer has no vehicle transmit or network path", () => {
  const source = fs.readFileSync(new URL("../src/is220d-air-exhaust-inspection-points.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.send\s*\(/);
  assert.doesNotMatch(source, /\.(?:queryPid|queryToyotaReadData|queryRealtime|probeResearchIdentifier|probeSupportBitmap)\s*\(/i);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest|WebSocket|NativeElm|transport\.send/i);
});
