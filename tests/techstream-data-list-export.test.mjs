import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  parseTechstreamDataListExport,
  buildTechstreamDataListExportTextReport
} from "../src/techstream-data-list-export.js";

test("imports existing fuel targets without changing legacy completeness", () => {
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

test("imports DPF/EGR/RPM/MAF Techstream series and preserves every correlation row", () => {
  const csv = [
    "Time,DPF Differential Pressure,EGR Lift Sensor Output,Engine Speed,MAF",
    "0.0,0.10,52.0,780,4.2",
    "1.0,1.20,48.0,1500,10.5",
    "2.0,3.40,32.0,2500,28.7"
  ].join("\n");
  const result = parseTechstreamDataListExport(csv);
  assert.equal(result.dpfEgrComplete, true);
  assert.equal(result.dpfEgrTargetCount, 2);
  assert.equal(result.sampleCount, 3);
  assert.equal(result.values.dpfDifferentialPressureKpa, 3.4);
  assert.equal(result.values.egrLiftSensorPercent, 32);
  assert.equal(result.values.engineSpeedRpm, 2500);
  assert.equal(result.values.mafGps, 28.7);
  assert.deepEqual(result.samples.map(sample => sample.timeSeconds), [0, 1, 2]);
  assert.deepEqual(result.samples.map(sample => sample.dpfDifferentialPressureKpa), [0.1, 1.2, 3.4]);
});

test("imports semicolon-separated Techstream data with decimal commas", () => {
  const csv = [
    "Time;DPF Differential Pressure;EGR Lift Position;Engine Speed;MAF",
    "0,0;0,40;55,0;800;4,5"
  ].join("\n");
  const result = parseTechstreamDataListExport(csv);
  assert.equal(result.values.dpfDifferentialPressureKpa, 0.4);
  assert.equal(result.values.egrLiftSensorPercent, 55);
  assert.equal(result.values.engineSpeedRpm, 800);
  assert.equal(result.values.mafGps, 4.5);
  assert.equal(result.sampleCount, 1);
});

test("imports vertical DPF/EGR values without fabricating a time series", () => {
  const text = [
    "DPF Differential Pressure: 0.85 kPa",
    "EGR Lift Sensor Output: 47.5 %",
    "Engine Speed: 812 rpm",
    "MAF: 4.8 g/s"
  ].join("\n");
  const result = parseTechstreamDataListExport(text);
  assert.equal(result.values.dpfDifferentialPressureKpa, 0.85);
  assert.equal(result.values.egrLiftSensorPercent, 47.5);
  assert.equal(result.values.engineSpeedRpm, 812);
  assert.equal(result.values.mafGps, 4.8);
  assert.equal(result.sampleCount, 0);
});

test("missing DPF/EGR columns stay explicit instead of being guessed", () => {
  const csv = [
    "Time,DPF Differential Pressure,Engine Speed",
    "0.0,0.25,800"
  ].join("\n");
  const result = parseTechstreamDataListExport(csv);
  assert.equal(result.dpfEgrComplete, false);
  assert.equal(result.dpfEgrTargetCount, 1);
  assert.equal(result.values.dpfDifferentialPressureKpa, 0.25);
  assert.equal(result.values.egrLiftSensorPercent, null);
});

test("report contains DPF/EGR values, sample count and offline provenance", () => {
  const result = parseTechstreamDataListExport([
    "Time,DPF Differential Pressure,EGR Lift Sensor Output,Engine Speed,MAF",
    "0.0,0.2,51,800,4.6",
    "1.0,1.1,44,1500,10.2"
  ].join("\n"));
  const report = buildTechstreamDataListExportTextReport(result);
  assert.match(report, /DPF Differential Pressure: 1\.1 kPa/);
  assert.match(report, /EGR Lift Sensor Output: 44 %/);
  assert.match(report, /Correlation samples: 2/);
  assert.match(report, /offline Techstream Data List CSV\/text export/);
});

test("CSV import core and packaged UI remain transport-free", () => {
  const core = fs.readFileSync(new URL("../src/techstream-data-list-export.js", import.meta.url), "utf8");
  const ui = fs.readFileSync(new URL("../src/techstream-data-list-gap-ui.js", import.meta.url), "utf8");
  for (const source of [core, ui]) {
    assert.doesNotMatch(source, /NativeElmTransport|NativeBleElmTransport|state\.client|safeCommand\s*\(|ATSH|ATCRA|productionAuthorized/i);
  }
  assert.match(ui, /parseTechstreamDataListExport/);
  assert.match(ui, /type = "file"/);
  assert.match(ui, /\.csv,\.txt,text\/csv,text\/plain/);
  assert.match(ui, /selected\.text\(\)/);
});
