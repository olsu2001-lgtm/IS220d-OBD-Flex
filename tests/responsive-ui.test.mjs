import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { RESPONSIVE_UI_BUILD_MARKER, patchMainForResponsiveness } from "../scripts/responsive-ui-transform.mjs";

const mainSource = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");

test("diagnostiikkaloki ja terminaali renderöidään erissä eikä jokaisella liikennetapahtumalla", () => {
  const patched = patchMainForResponsiveness(mainSource);
  assert.match(patched, new RegExp(RESPONSIVE_UI_BUILD_MARKER));
  assert.match(patched, /scheduleTerminalRender\(\);/);
  assert.match(patched, /scheduleElmDiagnosticRender\(\);/);
  assert.match(patched, /setTimeout\(\(\) => \{/);
  assert.match(patched, /}, 80\);/);
  assert.doesNotMatch(patched, /function appendElmDiagnosticLine\(line\)[\s\S]*?renderElmDiagnostics\(\);\n\}/);
});

test("laaja diagnostiikka luovuttaa event loopin jokaisen vaiheen jälkeen", () => {
  const patched = patchMainForResponsiveness(mainSource);
  assert.match(patched, /await yieldUiTurn\(\);/);
  assert.match(patched, /function yieldUiTurn\(\) \{\n  return new Promise\(resolve => setTimeout\(resolve, 0\)\);/);
});

test("responsiveness-transformi on idempotentti ja failaa kiinni rakenteen muuttuessa", () => {
  const once = patchMainForResponsiveness(mainSource);
  assert.equal(patchMainForResponsiveness(once), once);
  assert.throws(() => patchMainForResponsiveness('const APP_VERSION = "0.8.1";'), /appendTerminal/);
});
