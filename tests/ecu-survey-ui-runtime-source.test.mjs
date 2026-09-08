import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const runtime = await readFile(new URL("../src/ecu-survey-ui-runtime.js", import.meta.url), "utf8");
const history = await readFile(new URL("../src/ecu-survey-history.js", import.meta.url), "utf8");

test("ECU Survey UI runtime is DOM/local-history only and contains no vehicle command path", () => {
  assert.match(runtime, /buildEcuSurveyUiModel/);
  assert.match(runtime, /diagnosticSummary/);
  assert.match(runtime, /is220d:ecu-survey-history-updated/);
  assert.doesNotMatch(runtime, /\.command\s*\(|safeCommand\s*\(|runDiagnosticCommand\s*\(|ATSH|ATSP|217E|217F|212C|0100/);
});

test("history module installs and notifies the UI without changing the survey transport boundary", () => {
  assert.match(history, /installEcuSurveyUi/);
  assert.match(history, /notifyEcuSurveyUi\(snapshot, result\)/);
  assert.doesNotMatch(history, /\.command\s*\(|safeCommand\s*\(|ATSH|ATSP|217E|217F|212C/);
});
