import test from "node:test";
import assert from "node:assert/strict";

import {
  addDpnrCleaningCapture,
  analyzeDpnrCleaningTest,
  buildDpnrCleaningTestReport,
  createDpnrCleaningTestRun,
  median,
  summarizeDpnrCleaningCapture
} from "../src/dpnr-cleaning-test.js";

function samples({ pressure = 1, rpm = 3000, maf = 40, coolant = 82, count = 6 } = {}) {
  return Array.from({ length: count }, (_, index) => ({
    timestamp: 1_700_000_000_000 + index * 1000,
    pressureKpa: Array.isArray(pressure) ? pressure[index] : pressure,
    rpm: Array.isArray(rpm) ? rpm[index] : rpm,
    mafGs: Array.isArray(maf) ? maf[index] : maf,
    coolantC: coolant,
    raw217e: `61 7E 12 ${String(index).padStart(2, "0")}`
  }));
}

function completeStage(run, stage, pressure3000, maf3000 = 40) {
  run = addDpnrCleaningCapture(run, stage, "koeo", samples({ pressure: 0.05, rpm: 0, maf: 0 }));
  run = addDpnrCleaningCapture(run, stage, "idle", samples({ pressure: 0.4, rpm: 980, maf: 8 }));
  run = addDpnrCleaningCapture(run, stage, "rpm3000", samples({ pressure: pressure3000, rpm: 3000, maf: maf3000 }));
  return run;
}

test("median handles odd and even samples", () => {
  assert.equal(median([1, 3, 2]), 2);
  assert.equal(median([1, 4, 2, 3]), 2.5);
  assert.equal(median([null, undefined, "x"]), null);
});

test("3000 rpm capture is low confidence below 25 g/s MAF", () => {
  const summary = summarizeDpnrCleaningCapture(samples({ pressure: 1.2, maf: 24.9 }), "rpm3000");
  assert.equal(summary.mafValid, false);
  assert.equal(summary.validForComparison, false);
  assert.match(summary.findings.join(" "), /alle 25 g\/s/i);
});

test("negative pressure at 3000 rpm is source-grounded abnormal finding", () => {
  const summary = summarizeDpnrCleaningCapture(samples({ pressure: -1.4, maf: 38 }), "rpm3000");
  assert.equal(summary.negativeAt3000, true);
  assert.equal(summary.validForComparison, true);
  assert.match(summary.findings.join(" "), /GSIC P1426/i);
  assert.match(summary.findings.join(" "), /letkujen järjestyksen/i);
});

test("before negative and after non-negative becomes normalized", () => {
  let run = createDpnrCleaningTestRun({ appVersion: "0.9.1" });
  run = completeStage(run, "before", -1.3);
  run = completeStage(run, "after", 1.1);
  const analysis = analyzeDpnrCleaningTest(run);
  assert.equal(analysis.completeBefore, true);
  assert.equal(analysis.completeAfter, true);
  assert.equal(analysis.status, "normalized");
  assert.match(analysis.findings.join(" "), /muuttui ei-negatiiviseksi/i);
});

test("negative pressure remaining after cleaning stays unresolved", () => {
  let run = createDpnrCleaningTestRun({ appVersion: "0.9.1" });
  run = completeStage(run, "before", -1.3);
  run = completeStage(run, "after", -0.8);
  const analysis = analyzeDpnrCleaningTest(run);
  assert.equal(analysis.status, "negative-remains");
  assert.match(analysis.findings.join(" "), /pressure pipe/i);
});

test("lower positive pressure alone is not labelled an improvement", () => {
  let run = createDpnrCleaningTestRun({ appVersion: "0.9.1" });
  run = completeStage(run, "before", 4.0);
  run = completeStage(run, "after", 2.0);
  const analysis = analyzeDpnrCleaningTest(run);
  assert.equal(analysis.status, "comparison-ready");
  assert.match(analysis.findings.join(" "), /ei tulkita automaattisesti parannukseksi/i);
});

test("report retains raw 217E evidence for both stages", () => {
  let run = createDpnrCleaningTestRun({ appVersion: "0.9.1" });
  run = completeStage(run, "before", -1.0);
  run = completeStage(run, "after", 1.0);
  const report = buildDpnrCleaningTestReport(run);
  assert.match(report, /ENNEN PUHDISTUSTA/);
  assert.match(report, /PUHDISTUKSEN JÄLKEEN/);
  assert.match(report, /Raaka 217E/);
  assert.match(report, /61 7E 12 00/);
  assert.doesNotMatch(report, /Mode 04|forced regen|Active Test/i);
});
