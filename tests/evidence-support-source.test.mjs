import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const bundle = await readFile(new URL("../src/evidence-support-bundle.js", import.meta.url), "utf8");
const ui = await readFile(new URL("../src/evidence-support-ui.js", import.meta.url), "utf8");

test("evidence support bundle is a pure local evidence transform with no vehicle transmit path", () => {
  assert.match(bundle, /buildEvidenceSupportBundle/);
  assert.match(bundle, /rawVehicleResponsesIncluded: false/);
  assert.match(bundle, /vehicleIdentityValuesIncluded: false/);
  assert.doesNotMatch(bundle, /\.command\s*\(|safeCommand\s*\(|runDiagnosticCommand\s*\(|ATSH|ATSP|ATZ|ATMA|02217E|02217F|02212C/);
});

test("evidence support UI only copies local JSON and does not add network or vehicle operations", () => {
  assert.match(ui, /navigator\.clipboard\.writeText/);
  assert.match(ui, /stringifyEvidenceSupportBundle/);
  assert.doesNotMatch(ui, /fetch\s*\(|XMLHttpRequest|WebSocket|\.command\s*\(|safeCommand\s*\(|runDiagnosticCommand\s*\(|ATSH|ATSP|217E|217F|212C/);
});
