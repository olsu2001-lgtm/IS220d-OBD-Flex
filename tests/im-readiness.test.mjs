import test from "node:test";
import assert from "node:assert/strict";
import {
  parseImReadiness,
  parseWarmupsSinceDtcClear,
  parseDistanceSinceDtcClear,
  buildImReadinessSnapshot,
  buildImReadinessTextReport
} from "../src/im-readiness.js";

test("decodes diesel readiness with compression ignition monitor map", () => {
  const parsed = parseImReadiness("7E8 06 41 01 82 1F EB C0", 0x01);
  assert.equal(parsed.ignitionType, "compression");
  assert.equal(parsed.milOn, true);
  assert.equal(parsed.dtcCount, 2);
  assert.equal(parsed.supportedCount, 9);
  assert.equal(parsed.incompleteCount, 3);
  assert.equal(parsed.ready, false);
  assert.equal(parsed.monitors.find(item => item.id === "misfire").complete, false);
  assert.equal(parsed.monitors.find(item => item.id === "pm_filter").complete, false);
  assert.equal(parsed.monitors.find(item => item.id === "egr_vvt").complete, false);
  assert.equal(parsed.monitors.find(item => item.id === "boost_pressure").complete, true);
  assert.equal(parsed.monitors.some(item => item.id === "catalyst"), false);
});

test("decodes spark ignition readiness separately", () => {
  const parsed = parseImReadiness("41 01 00 07 A5 20", 0x01);
  assert.equal(parsed.ignitionType, "spark");
  assert.equal(parsed.milOn, false);
  assert.equal(parsed.dtcCount, 0);
  assert.deepEqual(parsed.monitors.map(item => item.id), [
    "misfire",
    "fuel_system",
    "comprehensive_components",
    "catalyst",
    "evap",
    "oxygen_sensor",
    "egr_vvt"
  ]);
  assert.equal(parsed.monitors.find(item => item.id === "oxygen_sensor").complete, false);
});

test("PID 41 uses identical readiness bit layout but does not expose MIL/DTC count", () => {
  const parsed = parseImReadiness("41 41 00 0F EB 40", 0x41);
  assert.equal(parsed.scope, "this-drive-cycle");
  assert.equal(parsed.ignitionType, "compression");
  assert.equal(parsed.milOn, null);
  assert.equal(parsed.dtcCount, null);
  assert.equal(parsed.monitors.find(item => item.id === "pm_filter").complete, false);
  assert.equal(parsed.incompleteCount, 1);
});

test("warmups and distance since clear decode standard PIDs", () => {
  assert.equal(parseWarmupsSinceDtcClear("41 30 07"), 7);
  assert.equal(parseDistanceSinceDtcClear("7E8 04 41 31 01 F4"), 500);
});

test("snapshot stays available when current-drive-cycle PID is unsupported", () => {
  const snapshot = buildImReadinessSnapshot({
    sinceClearRaw: "41 01 00 0F EB 00",
    driveCycleRaw: "NO DATA",
    warmupsRaw: "41 30 05",
    distanceRaw: "41 31 00 64"
  });
  assert.equal(snapshot.overall, "ready");
  assert.equal(snapshot.sinceClear.ready, true);
  assert.equal(snapshot.driveCycle, null);
  assert.equal(snapshot.warmupsSinceClear, 5);
  assert.equal(snapshot.distanceSinceClearKm, 100);
});

test("text report identifies diesel readiness and does not invent unsupported monitors", () => {
  const snapshot = buildImReadinessSnapshot({
    sinceClearRaw: "41 01 00 0F EB 40",
    driveCycleRaw: "41 41 00 0F EB 00",
    warmupsRaw: "41 30 08",
    distanceRaw: "41 31 00 C8"
  });
  const report = buildImReadinessTextReport(snapshot, { vehicle: "Lexus IS220d", timestamp: 0 });
  assert.match(report, /puristussytytys \/ diesel/);
  assert.match(report, /PM-\/hiukkassuodatin/);
  assert.match(report, /Matka DTC-poiston jälkeen: 200 km/);
  assert.doesNotMatch(report, /Lämmitetty katalysaattori/);
  assert.doesNotMatch(report, /raakavaste|7E8|0101|0141/i);
});
