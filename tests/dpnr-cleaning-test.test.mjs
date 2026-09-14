import test from "node:test";
import assert from "node:assert/strict";

import {
  assessDpnrCleaningPhase,
  buildDpnrCleaningReport,
  compareDpnrCleaningRuns,
  median,
  parseFlexNumber,
  summarizeDpnrCleaningSamples
} from "../src/dpnr-cleaning-test.js";

test("parseFlexNumber accepts Finnish decimal comma and units", () => {
  assert.equal(parseFlexNumber("-1,23 kPa"), -1.23);
  assert.equal(parseFlexNumber("2998 rpm"), 2998);
  assert.ok(Number.isNaN(parseFlexNumber("–")));
});

test("median and sample summary are deterministic", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 3]), 2);
  const summary = summarizeDpnrCleaningSamples([
    { timestamp: 1, pressureKpa: -1.5, rpm: 2980, coolantC: 85, raw217e: "A" },
    { timestamp: 2, pressureKpa: -1.0, rpm: 3000, coolantC: 86, raw217e: "B" },
    { timestamp: 3, pressureKpa: -0.5, rpm: 3020, coolantC: 86, raw217e: "C" }
  ], "rpm3000");
  assert.equal(summary.sampleCount, 3);
  assert.equal(summary.pressureMedianKpa, -1);
  assert.equal(summary.rpmMedian, 3000);
  assert.equal(summary.raw217eLast, "C");
});

test("negative 3000 rpm DPNR pressure is surfaced as GSIC deviation", () => {
  const assessment = assessDpnrCleaningPhase("rpm3000", { pressureMedianKpa: -0.8 });
  assert.equal(assessment.status, "strong-deviation");
  assert.match(assessment.message, /GSIC P1426/i);
});

test("KOEO is recorded without inventing a numeric pass threshold", () => {
  const assessment = assessDpnrCleaningPhase("koeo", { pressureMedianKpa: 0.4 });
  assert.equal(assessment.status, "observed");
  assert.match(assessment.message, /ei aseta.*hyväksymisrajaa/i);
});

test("before negative and after non-negative 3000 rpm is reported as improvement", () => {
  const comparison = compareDpnrCleaningRuns(
    { phases: { koeo: { pressureMedianKpa: -0.5 }, rpm3000: { pressureMedianKpa: -1.2 } } },
    { phases: { koeo: { pressureMedianKpa: -0.1 }, rpm3000: { pressureMedianKpa: 1.1 } } }
  );
  assert.equal(comparison.outcome, "improved");
  assert.equal(comparison.delta3000Kpa, 2.3);
  assert.equal(comparison.koeoAbsoluteMovedTowardZero, true);
});

test("report preserves read-only scope and both measurement rounds", () => {
  const record = {
    before: { phases: { koeo: { pressureMedianKpa: -0.4, sampleCount: 4 }, rpm3000: { pressureMedianKpa: -1.0, sampleCount: 5 } } },
    after: { phases: { koeo: { pressureMedianKpa: 0.0, sampleCount: 4 }, rpm3000: { pressureMedianKpa: 1.2, sampleCount: 5 } } }
  };
  const report = buildDpnrCleaningReport(record);
  assert.match(report, /ENNEN PUHDISTUSTA/);
  assert.match(report, /PUHDISTUKSEN JÄLKEEN/);
  assert.match(report, /Toyota 217E \+ OBD RPM · vain luku/);
  assert.match(report, /ei suorita DPF-regenerointia/i);
});
