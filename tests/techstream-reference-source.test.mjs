import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const core = await readFile(new URL("../src/techstream-reference.js", import.meta.url), "utf8");
const ui = await readFile(new URL("../src/techstream-reference-ui.js", import.meta.url), "utf8");

for (const [name, source] of [["reference core", core], ["reference UI", ui]]) {
  test(`${name} contains no adapter or vehicle transmit path`, () => {
    assert.doesNotMatch(source, /state\.client|globalThis\.obd|globalThis\.bleObd|NativeElmTransport|NativeBleElmTransport|Elm327Client|safeCommand\s*\(|runDiagnosticCommand\s*\(|\.command\s*\(/);
  });
}

test("reference layer does not parse or embed proprietary Techstream files", () => {
  assert.match(core, /techstream-health-check/);
  assert.doesNotMatch(core, /\.ddb|MainMenu\.exe|Techstream\.exe|SystemSelect|HealthCheck\.xml/i);
});
