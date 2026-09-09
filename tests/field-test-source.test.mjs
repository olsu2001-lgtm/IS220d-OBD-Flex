import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/field-test-ui.js", import.meta.url), "utf8");

test("Field Test Mode only drives the existing diagnostic UI and has no transport/send implementation", () => {
  assert.match(source, /diagnosticEngineState/);
  assert.match(source, /runGekoTest/);
  assert.match(source, /diagnosticButton\.click\(\)/);
  assert.match(source, /installFieldTestUi/);
  assert.doesNotMatch(source, /\.command\s*\(|safeCommand\s*\(|runDiagnosticCommand\s*\(|ATSH|ATSP|ATZ|ATMA|217E|217F|212C|02217E|02217F|02212C/);
});

test("Field Test Mode has no network, file export or automatic multi-run loop", () => {
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|navigator\.share|showSaveFilePicker|setInterval/);
  assert.doesNotMatch(source, /for\s*\([^)]*FIELD_TEST_REQUIRED_RUNS|while\s*\(/);
  assert.match(source, /Yhdistä adapteriin ensin/);
});
