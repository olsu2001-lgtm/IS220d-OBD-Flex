import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  IS220D_STARTING_CHARGING_INSPECTION_POINTS,
  buildIs220dStartingChargingInspectionScope,
  buildIs220dStartingChargingInspectionScopeHtml,
  publishIs220dStartingChargingInspectionPoints
} from "../src/is220d-starting-charging-inspection-points.js";

test("starting/charging set covers alternator, starter and crank sensor with six source-linked points", () => {
  const scope = buildIs220dStartingChargingInspectionScope("starting-charging-position");
  assert.equal(scope.visible, true);
  assert.equal(scope.pointCount, 6);
  assert.equal(scope.componentCount, 3);
  assert.deepEqual([...new Set(scope.points.map(point => point.componentId))].sort(), [
    "engine.alternator",
    "engine.crank_position_sensor",
    "engine.starter"
  ]);
});

test("starting/charging points preserve reviewed Vikadiag source rows", () => {
  const rows = Object.fromEntries(IS220D_STARTING_CHARGING_INSPECTION_POINTS.map(point => [point.id, point.sourceRows]));
  assert.deepEqual(rows["alternator-physical-baseline"], [11, 350]);
  assert.deepEqual(rows["alternator-running-voltage"], [11, 350]);
  assert.deepEqual(rows["starter-permission-and-circuit"], [12, 170, 350]);
  assert.deepEqual(rows["starter-cranking-voltage-rpm"], [12, 170, 350]);
  assert.deepEqual(rows["crank-sensor-physical-baseline"], [17, 113, 268, 305, 325]);
  assert.deepEqual(rows["crank-sensor-cranking-rpm"], [113, 268, 305, 325]);
});

test("all starting/charging evidence is already production-authorized wide-diagnostic data", () => {
  const scope = buildIs220dStartingChargingInspectionScope("starting-charging-position");
  for (const point of scope.points) {
    assert.equal(point.evidenceSummary.awaitingVerification, 0);
    assert.equal(point.evidenceSummary.currentWideDiagnostic, point.evidenceSummary.signalCount);
    for (const signal of point.signals) {
      assert.equal(signal.productionAuthorized, true);
      assert.equal(signal.collectedByWideDiagnostic, true);
      assert.notEqual(signal.authorization, "field-rejected");
      assert.equal("commands" in signal, false);
    }
  }
});

test("starter point explicitly separates missing start permission from starter motor diagnosis", () => {
  const scope = buildIs220dStartingChargingInspectionScope("starting-charging-position");
  const point = scope.points.find(item => item.id === "starter-permission-and-circuit");
  assert.match(point.expectedPattern, /starttiluvan puuttumisen/i);
  assert.match(point.limitation, /kytkinpolkimen starttilupa/i);
  assert.match(point.physicalFollowUp, /kytkinstarttikytkin/i);
});

test("crank point does not claim that observed RPM proves cam/crank synchronization", () => {
  const scope = buildIs220dStartingChargingInspectionScope("starting-charging-position");
  const point = scope.points.find(item => item.id === "crank-sensor-cranking-rpm");
  assert.match(point.expectedPattern, /ei kuitenkaan yksin varmista/i);
  assert.match(point.limitation, /cam\/crank correlation/i);
});

test("alternator source range is presented as a manual-meter source check, not an automatic Flex threshold", () => {
  const point = buildIs220dStartingChargingInspectionScope("starting-charging-position").points.find(item => item.id === "alternator-running-voltage");
  assert.match(point.expectedPattern, /13–15 V/);
  assert.match(point.limitation, /lähderivin yleismittaritarkistus/i);
  assert.match(point.limitation, /ei Flexin automaattinen/i);
});

test("starting/charging HTML exposes source rows and missing start-permission signal", () => {
  const html = buildIs220dStartingChargingInspectionScopeHtml(buildIs220dStartingChargingInspectionScope("starting-charging-position"));
  assert.match(html, /6 tarkastuspistettä/);
  assert.match(html, /STARTTAUS/);
  assert.match(html, /LÄMMIN UUDELLEENKÄYNNISTYS/);
  assert.match(html, /Vikadiag_kohteet · rivit 12, 170, 350/);
  assert.match(html, /Kytkinpolkimen starttilupa/);
});

test("starting/charging panel hides outside all or its own group", () => {
  assert.equal(buildIs220dStartingChargingInspectionScope("all").visible, true);
  assert.equal(buildIs220dStartingChargingInspectionScope("starting-charging-position").visible, true);
  assert.equal(buildIs220dStartingChargingInspectionScope("fuel-rail-injection").visible, false);
});

test("starting/charging publisher works without browser DOM", () => {
  const scope = publishIs220dStartingChargingInspectionPoints();
  assert.equal(scope.pointCount, 6);
  assert.equal(scope.componentCount, 3);
});

test("starting/charging layer has no vehicle transmit or network path", () => {
  const source = fs.readFileSync(new URL("../src/is220d-starting-charging-inspection-points.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.send\s*\(/);
  assert.doesNotMatch(source, /\.(?:queryPid|queryToyotaReadData|queryRealtime|probeResearchIdentifier|probeSupportBitmap)\s*\(/i);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest|WebSocket|NativeElm|transport\.send/i);
});
