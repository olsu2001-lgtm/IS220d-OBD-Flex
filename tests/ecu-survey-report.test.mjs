import test from "node:test";
import assert from "node:assert/strict";
import { evaluateEcuSurvey } from "../src/ecu-survey.js";
import { buildEcuSurveyTextReport } from "../src/ecu-survey-report.js";

function sampleSnapshot() {
  return evaluateEcuSurvey({
    runId: "ELM-TEST-42",
    observations: [
      { requestHeader: "7E0", responseHeader: "7E8", validResponse: true, raw: "7E8 06 41 00 BE 3E B8 13" },
      { requestHeader: "7E3", responseHeader: "7EB", validResponse: true, raw: "7EB 06 41 00 00 00 00 00" },
      { requestHeader: "7E4", validResponse: false, error: "NO DATA" }
    ]
  });
}

test("ECU Survey -tekstiraportti säilyttää topologian, evidenssirajan ja vain luku -tilan", () => {
  const report = buildEcuSurveyTextReport(sampleSnapshot());
  assert.match(report, /^ECU SURVEY/m);
  assert.match(report, /Mode: read-only/);
  assert.match(report, /Safe probe: 0100/);
  assert.match(report, /Run ID: ELM-TEST-42/);
  assert.match(report, /7E0>7E8:engine/);
  assert.match(report, /7E3>7EB:unmapped/);
  assert.match(report, /request=7E0 \| response=7E8 \| ecu=engine/);
  assert.match(report, /request=7E3 \| response=7EB \| ecu=unmapped/);
  assert.match(report, /request=7E4 \| response=- \| ecu=unmapped/);
  assert.match(report, /last_error=NO DATA/);
  assert.match(report, /sends no additional vehicle command/);
});

test("ECU Survey -tekstiraportti näyttää paikallisen historian toistettavuustilan", () => {
  const snapshot = sampleSnapshot();
  const report = buildEcuSurveyTextReport(snapshot, {
    persisted: true,
    error: "",
    snapshots: [snapshot, snapshot, snapshot],
    repeatability: {
      stable: true,
      observedRuns: 3,
      requiredRuns: 3,
      topologySignature: "7E0>7E8:engine|7E3>7EB:unmapped"
    }
  });
  assert.match(report, /History persisted: yes/);
  assert.match(report, /History runs: 3/);
  assert.match(report, /Repeatability: stable \(3\/3 runs\)/);
});

test("ECU Survey -tekstiraportti erottaa vielä kerättävän historian ja tallennusvaroituksen", () => {
  const snapshot = sampleSnapshot();
  const report = buildEcuSurveyTextReport(snapshot, {
    persisted: false,
    error: "quota denied",
    snapshots: [snapshot],
    repeatability: { stable: false, observedRuns: 1, requiredRuns: 3 }
  });
  assert.match(report, /History persisted: no/);
  assert.match(report, /Repeatability: collecting \(1\/3 runs\)/);
  assert.match(report, /History warning: quota denied/);
});

test("ECU Survey -tekstiraportti hylkää väärän snapshotin", () => {
  assert.throws(() => buildEcuSurveyTextReport(null), /Valid read-only ECU Survey snapshot/);
  assert.throws(() => buildEcuSurveyTextReport({ mode: "write", nodes: [] }), /Valid read-only ECU Survey snapshot/);
});


