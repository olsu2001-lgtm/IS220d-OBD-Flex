import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  IS220D_COMPONENT_INSPECTION_POINTS,
  IS220D_COMPONENT_INSPECTION_POINT_SOURCE,
  buildIs220dInspectionPointScope,
  buildIs220dInspectionPointScopeHtml,
  is220dInspectionPointsForComponent,
  publishIs220dComponentInspectionPoints
} from "../src/is220d-component-inspection-points.js";
import { getIs220dDiagnosticSignal } from "../src/is220d-diagnostic-signals.js";

test("first source-linked inspection set contains 16 points for MAP, MAF, EGR, DPNR and ECT", () => {
  const scope = buildIs220dInspectionPointScope("all");
  assert.equal(scope.source, IS220D_COMPONENT_INSPECTION_POINT_SOURCE);
  assert.equal(scope.pointCount, 16);
  assert.equal(scope.componentCount, 5);
  assert.deepEqual([...scope.componentIds].sort(), [
    "engine.coolant_temperature_sensor",
    "engine.dpnr_differential_pressure_sensor",
    "engine.egr_valve",
    "engine.maf_sensor",
    "engine.map_sensor"
  ]);
  assert.equal(new Set(IS220D_COMPONENT_INSPECTION_POINTS.map(point => point.id)).size, 16);
});

test("inspection points trace to the reviewed Vikadiag rows used for each component", () => {
  assert.deepEqual(is220dInspectionPointsForComponent("engine.map_sensor").map(point => point.sourceRows), [
    [151, 310, 328],
    [151, 253, 328],
    [310, 345, 469]
  ]);
  assert.deepEqual(is220dInspectionPointsForComponent("engine.maf_sensor").map(point => point.sourceRows), [
    [4, 277],
    [4, 277],
    [309, 327, 345]
  ]);
  assert.deepEqual(is220dInspectionPointsForComponent("engine.egr_valve").map(point => point.sourceRows), [
    [2, 147, 278],
    [278, 459, 460],
    [147, 345, 459, 460]
  ]);
  assert.deepEqual(is220dInspectionPointsForComponent("engine.dpnr_differential_pressure_sensor").map(point => point.sourceRows), [
    [5, 263, 315, 332],
    [5, 315, 469],
    [315, 332],
    [263, 315, 347]
  ]);
  assert.deepEqual(is220dInspectionPointsForComponent("engine.coolant_temperature_sensor").map(point => point.sourceRows), [
    [152, 254, 330],
    [152, 254, 330],
    [311, 330]
  ]);
  assert.ok(IS220D_COMPONENT_INSPECTION_POINTS.every(point => point.sourceSheet === "Vikadiag_kohteet"));
});

test("every inspection evidence key resolves, while field-rejected 219C cannot enter the model", () => {
  const scope = buildIs220dInspectionPointScope("all");
  for (const point of scope.points) {
    for (const signal of point.signals) {
      assert.ok(getIs220dDiagnosticSignal(signal.key));
      assert.notEqual(signal.authorization, "field-rejected");
      assert.equal("commands" in signal, false);
    }
  }
  assert.doesNotMatch(JSON.stringify(scope), /219C/);
});

test("physical-group scope filters inspection points without changing the five-group BOM model", () => {
  const air = buildIs220dInspectionPointScope("air-intake-turbo-egr");
  assert.equal(air.pointCount, 9);
  assert.equal(air.componentCount, 3);
  assert.ok(air.points.every(point => point.groupId === "air-intake-turbo-egr"));

  const dpnr = buildIs220dInspectionPointScope("dpnr-exhaust");
  assert.equal(dpnr.pointCount, 4);
  assert.deepEqual(dpnr.componentIds, ["engine.dpnr_differential_pressure_sensor"]);

  const thermal = buildIs220dInspectionPointScope("engine-thermal-baseline");
  assert.equal(thermal.pointCount, 3);
  assert.deepEqual(thermal.componentIds, ["engine.coolant_temperature_sensor"]);

  const fuel = buildIs220dInspectionPointScope("fuel-rail-injection");
  assert.equal(fuel.pointCount, 0);
  assert.equal(fuel.componentCount, 0);
});

test("inspection HTML exposes operating state, expected pattern and exact source rows", () => {
  const html = buildIs220dInspectionPointScopeHtml(buildIs220dInspectionPointScope("dpnr-exhaust"));
  assert.match(html, /DPNR-paine-eron KOEO-nollataso/);
  assert.match(html, /KOEO/);
  assert.match(html, /2500 RPM/);
  assert.match(html, /Odotettu kuvio/);
  assert.match(html, /Vikadiag_kohteet · rivit 5, 315, 469/);
  assert.match(html, /letkujen halkeamat, sulaminen, nokitukos, kondenssivesi/i);
});

test("inspection model does not invent numeric diagnostic thresholds", () => {
  const text = IS220D_COMPONENT_INSPECTION_POINTS.map(point => `${point.instruction} ${point.expectedPattern}`).join("\n");
  assert.doesNotMatch(text, /(?:>|<|≥|≤)\s*\d/);
  assert.match(text, /lähde ei anna tähän kiinteää numeerista toleranssia/i);
});

test("unknown group fails closed and unknown component returns no points", () => {
  assert.throws(() => buildIs220dInspectionPointScope("unknown-area"), /Unknown IS220d inspection-point group/);
  assert.deepEqual(is220dInspectionPointsForComponent("engine.not_real"), []);
});

test("inspection-point publisher remains usable without browser DOM", () => {
  const scope = publishIs220dComponentInspectionPoints();
  assert.equal(scope.pointCount, 16);
  assert.equal(scope.componentCount, 5);
});

test("inspection-point layer contains no vehicle transmit, command execution or network path", () => {
  const source = fs.readFileSync(new URL("../src/is220d-component-inspection-points.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.send\s*\(/);
  assert.doesNotMatch(source, /\.(?:queryPid|queryToyotaReadData|queryRealtime|probeResearchIdentifier|probeSupportBitmap)\s*\(/i);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest|WebSocket|NativeElm|transport\.send/i);
});
