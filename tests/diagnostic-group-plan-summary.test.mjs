import test from "node:test";
import assert from "node:assert/strict";
import { is220dDiagnosticGroupPlanSummariesFromRun } from "../src/ecu-survey-diagnostic.js";

test("ECU survey exposes five sanitized physical-group plan summaries", () => {
  const summaries = is220dDiagnosticGroupPlanSummariesFromRun({
    results: [
      { requestHeader: "7E0", command: "010C", validResponse: true, raw: "7E8 04 41 0C 12 34" },
      { requestHeader: "7E0", command: "010B", validResponse: true, raw: "7E8 03 41 0B 64" },
      { requestHeader: "7E0", command: "0110", validResponse: true, raw: "7E8 04 41 10 01 F4" }
    ]
  });

  assert.equal(summaries.length, 5);
  assert.deepEqual(summaries.map(item => item.id), [
    "air-intake-turbo-egr",
    "fuel-rail-injection",
    "dpnr-exhaust",
    "starting-charging-position",
    "engine-thermal-baseline"
  ]);
  const starting = summaries.find(item => item.id === "starting-charging-position");
  assert.ok(starting.summary.alreadyObserved >= 1);
  assert.equal("signals" in starting, false);
  assert.equal("commands" in starting, false);
  assert.doesNotMatch(JSON.stringify(summaries), /7E8 04 41 0C 12 34/);
});

test("physical-group plan summary fails closed to an empty list without diagnostic results", () => {
  assert.deepEqual(is220dDiagnosticGroupPlanSummariesFromRun(null), []);
  assert.deepEqual(is220dDiagnosticGroupPlanSummariesFromRun({}), []);
});
