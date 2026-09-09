import test from "node:test";
import assert from "node:assert/strict";
import { ecuSurveySnapshotFromDiagnosticRun } from "../src/ecu-survey-diagnostic.js";
import { compactEcuSurveySnapshot } from "../src/ecu-survey-history.js";
import { buildEcuSurveyTextReport } from "../src/ecu-survey-report.js";
import { buildEcuSurveyUiModel } from "../src/ecu-survey-ui.js";

function identityDiagnosticRun() {
  return {
    startedAt: 1000,
    endedAt: 2000,
    meta: { reportId: "ELM-MODE09-TEST" },
    results: [
      { phase: "ECU-osoitehaku", command: "0100", requestHeader: "7E0", validResponse: true, raw: "7E8 06 41 00 BE 3E B8 13" },
      { phase: "Laaja luku-OBD", command: "0902", validResponse: true, raw: "7E8 10 14 49 02 01 4A 54 48\r7E8 21 42 42 32 36 32 33 30\r7E8 22 32 30 32 38 37 38 37\r>" },
      { phase: "Laaja luku-OBD", command: "0904", validResponse: true, raw: "7E8 10 0B 49 04 01 33 35 33\r7E8 21 36 30 30 30 30\r>" },
      { phase: "Laaja luku-OBD", command: "0906", validResponse: true, raw: "7E8 07 49 06 01 CA D6 7F 74\r>" },
      { phase: "Laaja luku-OBD", command: "090A", validResponse: true, raw: "49 0A 01 45 4E 47 49 4E 45" }
    ]
  };
}

test("ECU Survey snapshot attaches identity parsed only from already collected Mode 09 results", () => {
  const snapshot = ecuSurveySnapshotFromDiagnosticRun(identityDiagnosticRun());
  assert.equal(snapshot.identity.source, "existing-wide-diagnostic-mode09");
  assert.equal(snapshot.identity.overall, "match");
  assert.equal(snapshot.identity.fields.vin.value, "JTHBB262302028787");
  assert.equal(snapshot.identity.fields.calibrationId.value, "35360000");
  assert.equal(snapshot.identity.fields.calibrationVerificationNumber.value, "01CAD67F74");
  assert.equal(snapshot.identity.fields.ecuName.value, "ENGINE");
});

test("compact survey history preserves decoded identity evidence but no Mode 09 raw/error payload", () => {
  const snapshot = ecuSurveySnapshotFromDiagnosticRun(identityDiagnosticRun());
  const compact = compactEcuSurveySnapshot(snapshot);
  assert.equal(compact.identity.overall, "match");
  assert.equal(compact.identity.fields.vin.value, "JTHBB262302028787");
  assert.equal(compact.identity.fields.vin.status, "match");
  assert.deepEqual(compact.validation.toyota.map(row => row.command), ["217E", "217F", "212C"]);
  assert.equal(compact.validation.toyota.every(row => !("raw" in row) && !("error" in row)), true);
  const json = JSON.stringify(compact);
  assert.doesNotMatch(json, /10 14 49 02|secret raw|"error"|"raw"|"latestRaw"/i);
});

test("survey text report includes Mode 09 evidence match without adding raw payload", () => {
  const snapshot = ecuSurveySnapshotFromDiagnosticRun(identityDiagnosticRun());
  const report = buildEcuSurveyTextReport(snapshot);
  assert.match(report, /Mode 09 vehicle identity:/);
  assert.match(report, /Overall: match/);
  assert.match(report, /field=vin \| status=match \| value=JTHBB262302028787 \| expected=JTHBB262302028787/);
  assert.match(report, /field=calibrationId \| status=match \| value=35360000/);
  assert.match(report, /field=calibrationVerificationNumber \| status=match \| value=01CAD67F74/);
  assert.doesNotMatch(report, /10 14 49 02/);
});

test("survey UI model exposes identity evidence statuses as evidence, not fault language", () => {
  const snapshot = ecuSurveySnapshotFromDiagnosticRun(identityDiagnosticRun());
  const compact = compactEcuSurveySnapshot(snapshot);
  const model = buildEcuSurveyUiModel(snapshot, { snapshots: [compact], comparableSnapshots: [compact], repeatability: { stable: false, observedRuns: 1, requiredRuns: 3 } });
  assert.equal(model.identity.visible, true);
  assert.equal(model.identity.overallCode, "match");
  assert.equal(model.identity.fields.find(field => field.id === "vin").stateLabel, "Täsmää");
  assert.doesNotMatch(JSON.stringify(model.identity), /vika|fault|rikki/i);
});
