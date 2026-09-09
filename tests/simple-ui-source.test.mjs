import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/simple-ui.js", import.meta.url), "utf8");
const historySource = await readFile(new URL("../src/ecu-survey-history.js", import.meta.url), "utf8");

test("simple mode keeps everyday actions visible and developer tools behind advanced UI", () => {
  assert.match(source, /Normaalikäyttö/);
  assert.match(source, /DPNR-tarkistus/);
  assert.match(source, /Live-data/);
  assert.match(source, /Lisädiagnostiikka ja kehitystyökalut/);
  assert.match(source, /elmDiagnosticCard/);
  assert.match(source, /quicklynksDiagnosticCard/);
  assert.match(source, /obdPlusTraceCard/);
  assert.match(source, /nav-terminal/);
});

test("normal mode migrates once to the known IS220d CAN6 protocol and preserves later advanced choice", () => {
  assert.match(source, /PROTOCOL_OVERRIDE_KEY/);
  assert.match(source, /if \(!advancedOverride\)/);
  assert.match(source, /select\.value = "can6"/);
  assert.match(source, /setItem\(PROTOCOL_KEY, "can6"\)/);
  assert.match(source, /setItem\(PROTOCOL_OVERRIDE_KEY, "true"\)/);
  assert.match(source, /event\?\.isTrusted === false/);
  assert.match(source, /IS220d käyttää CAN 11 bit \/ 500 kbit\/s/);
});

test("simple mode shows bounded Classic wait status instead of a silent pause", () => {
  assert.match(source, /is220d:classic-transport-status/);
  assert.match(source, /Adapteri vastaa/);
  assert.match(source, /aikaraja/);
  assert.match(source, /Sovellus pysyy käytettävissä/);
});

test("simple UI is presentation-only and does not implement vehicle communication", () => {
  assert.doesNotMatch(source, /\.command\s*\(|safeCommand\s*\(|runDiagnosticCommand\s*\(|\.send\s*\(|ATSH|ATSP|ATZ|ATMA|217E|217F|212C|02217E|02217F|02212C/);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|navigator\.share/);
  assert.match(historySource, /installSimpleUi\(\)/);
});
