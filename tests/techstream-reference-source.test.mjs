import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const core = await readFile(new URL("../src/techstream-reference.js", import.meta.url), "utf8");
const builder = await readFile(new URL("../src/techstream-reference-builder.js", import.meta.url), "utf8");
const ui = await readFile(new URL("../src/techstream-reference-ui.js", import.meta.url), "utf8");

for (const [name, source] of [["reference core", core], ["guided builder", builder], ["reference UI", ui]]) {
  test(`${name} contains no adapter or vehicle transmit path`, () => {
    assert.doesNotMatch(source, /state\.client|globalThis\.obd|globalThis\.bleObd|NativeElmTransport|NativeBleElmTransport|Elm327Client|safeCommand\s*\(|runDiagnosticCommand\s*\(|\.command\s*\(/);
  });
  test(`${name} contains no network path`, () => {
    assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
  });
}

test("reference layer does not parse or embed proprietary Techstream files", () => {
  assert.match(core, /techstream-health-check/);
  assert.doesNotMatch(`${core}\n${builder}\n${ui}`, /\.ddb|MainMenu\.exe|Techstream\.exe|SystemSelect|HealthCheck\.xml/i);
});

test("guided builder delegates final acceptance to the canonical Techstream schema", () => {
  assert.match(builder, /normalizeTechstreamReference\(candidate\)/);
  assert.match(builder, /parts\.length === 5 \? parts\[3\] : "candidate"/);
  assert.doesNotMatch(builder, /systemName.*7E0|Engine system.*responseHeader|Skid.*7E[0-9A-F]/i);
});

test("guided UI keeps raw JSON as an advanced fallback and does not auto-verify mappings", () => {
  assert.match(ui, /JSON-editori · lisäasetukset/);
  assert.match(ui, /Tällainen 4-kenttäinen rivi tallentuu aina candidate-tasolle/);
  assert.doesNotMatch(ui, /evidenceLevel\s*[:=]\s*["']verified["']/);
});
