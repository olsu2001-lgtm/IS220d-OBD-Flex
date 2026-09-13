import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  parseTechstreamDataListExport,
  buildTechstreamDataListExportTextReport
} from "../src/techstream-data-list-export.js";

test("imports a wide Techstream CSV export for all requested Data List values", () => {
  const csv = [
    "Time,Injection Feedback Val #1,Injection Feedback Val #2,Injection Feedback Val #3,Injection Feedback Val #4,Target Common Rail Pressure,Target Pump SCV Current",
    "0.0,0.42,-0.31,0.15,-0.26,39800,1280",
    "0.1,0.45,-0.29,0.17,-0.25,40100,1295"
  ].join("\n");
  const result = parseTechstreamDataListExport(csv);
  assert.equal(result.complete, true);
  assert.equal(result.completeTargetCount, 3);
  assert.deepEqual(result.values.injectionFeedbackMm3PerStroke, [0.45, -0.29, 0.17, -0.25]);
  assert.equal(result.values.targetCommonRailPressureKpa, 40100);
  assert.equal(result.values.targetPumpScvCurrentMa, 1295);
  assert.equal(result.transportUsed, false);
});

test("imports semicolon-separated Techstream data with decimal commas", () => {
  const csv = [
    "Injection Feedback Val #1;Injection Feedback Val #2;Injection Feedback Val #3;Injection Feedback Val #4;Target Common Rail Pressure;Target Pump SCV Current",
    "0,40;-0,30;0,20;-0,10;39800;1275"
  ].join("\n");
  const result = parseTechstreamDataListExport(csv);
  assert.deepEqual(result.values.injectionFeedbackMm3PerStroke, [0.4, -0.3, 0.2, -0.1]);
  assert.equal(result.values.targetCommonRailPressureKpa, 39800);
  assert.equal(result.values.targetPumpScvCurrentMa, 1275);
  assert.equal(result.complete, true);
});

test("imports vertical label-value text exports", () => {
  const text = [
    "Injection Feedback Val #1: 0.50",
    "Injection Feedback Val #2: -0.25",
    "Injection Feedback Val #3: 0.10",
    "Injection Feedback Val #4: -0.35",
    "Target Common Rail Pressure: 40500 kPa",
    "Target Pump SCV Current: 1310 mA"
  ].join("\n");
  const result = parseTechstreamDataListExport(text);
  assert.deepEqual(result.values.injectionFeedbackMm3PerStroke, [0.5, -0.25, 0.1, -0.35]);
  assert.equal(result.values.targetCommonRailPressureKpa, 40500);
  assert.equal(result.values.targetPumpScvCurrentMa, 1310);
  assert.equal(result.complete, true);
});

test("missing Data List columns stay explicit instead of being guessed", () => {
  const csv = [
    "Time,Injection Feedback Val #1,Target Common Rail Pressure",
    "0.0,0.25,40000"
  ].join("\n");
  const result = parseTechstreamDataListExport(csv);
  assert.equal(result.complete, false);
  assert.equal(result.injectorChannelCount, 1);
  assert.deepEqual(result.values.injectionFeedbackMm3PerStroke, [0.25, null, null, null]);
  assert.equal(result.values.targetCommonRailPressureKpa, 40000);
  assert.equal(result.values.targetPumpScvCurrentMa, null);
});

test("report contains imported values and offline provenance", () => {
  const result = parseTechstreamDataListExport([
    "Injection Feedback Val #1,Injection Feedback Val #2,Injection Feedback Val #3,Injection Feedback Val #4,Target Common Rail Pressure,Target Pump SCV Current",
    "0.1,-0.2,0.3,-0.4,41000,1350"
  ].join("\n"));
  const report = buildTechstreamDataListExportTextReport(result);
  assert.match(report, /0\.1 \/ -0\.2 \/ 0\.3 \/ -0\.4 mm³\/st/);
  assert.match(report, /Target Common Rail Pressure: 41000 kPa/);
  assert.match(report, /Target Pump SCV Current: 1350 mA/);
  assert.match(report, /offline Techstream Data List CSV\/text export/);
});

test("CSV import module is transport-free and cannot authorize vehicle commands", () => {
  const source = fs.readFileSync(new URL("../src/techstream-data-list-export.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /NativeElmTransport|NativeBleElmTransport|state\.client|safeCommand\s*\(|\.send\s*\(|ATSH|ATCRA|productionAuthorized|allowlist/i);
});
