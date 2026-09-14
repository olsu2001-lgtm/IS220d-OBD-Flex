import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { RESPONSIVE_UI_BUILD_MARKER, patchMainForResponsiveness } from "../scripts/responsive-ui-transform.mjs";

const mainSource = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");

function functionBlock(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `missing function signature: ${signature}`);
  const nextFunction = source.indexOf("\nfunction ", start + signature.length);
  return source.slice(start, nextFunction === -1 ? source.length : nextFunction);
}

test("diagnostiikkaloki ja terminaali renderöidään erissä eikä jokaisella liikennetapahtumalla", () => {
  const patched = patchMainForResponsiveness(mainSource);
  assert.match(patched, new RegExp(RESPONSIVE_UI_BUILD_MARKER));
  assert.match(patched, /setTimeout\(\(\) => \{/);
  assert.match(patched, /}, 80\);/);

  const terminalAppend = functionBlock(patched, "function appendTerminal(text) {");
  assert.match(terminalAppend, /scheduleTerminalRender\(\);/);
  assert.doesNotMatch(terminalAppend, /terminal\.textContent|terminal\.scrollTop/);

  const diagnosticAppend = functionBlock(patched, "function appendElmDiagnosticLine(line) {");
  assert.match(diagnosticAppend, /scheduleElmDiagnosticRender\(\);/);
  assert.doesNotMatch(diagnosticAppend, /renderElmDiagnostics\(\);/);
});

test("laaja diagnostiikka luovuttaa event loopin jokaisen vaiheen jälkeen", () => {
  const patched = patchMainForResponsiveness(mainSource);
  const runner = functionBlock(patched, "async function runFullDiagnosticSteps(phase, steps, options = {}) {");
  assert.match(runner, /await yieldUiTurn\(\);/);
  assert.match(patched, /function yieldUiTurn\(\) \{\n  return new Promise\(resolve => setTimeout\(resolve, 0\)\);/);
});

test("responsiveness-transformi on idempotentti ja failaa kiinni rakenteen muuttuessa", () => {
  const once = patchMainForResponsiveness(mainSource);
  assert.equal(patchMainForResponsiveness(once), once);
  assert.throws(() => patchMainForResponsiveness('const APP_VERSION = "0.8.1";'), /appendTerminal/);
});

test("responsiveness-transformi säilyttää versionumeron myös versiopäivityksessä", () => {
  for (const version of ["0.8.1", "0.9.1", "1.2.3"]) {
    const source = mainSource.replace(/^const APP_VERSION = "\d+\.\d+\.\d+";$/m, `const APP_VERSION = "${version}";`);
    const patched = patchMainForResponsiveness(source);
    assert.equal(patched.match(/^const APP_VERSION = "[^"]+";$/gm)?.length, 1);
    assert.ok(patched.includes(`const APP_VERSION = "${version}";`));
    assert.ok(patched.includes(RESPONSIVE_UI_BUILD_MARKER));
  }
});

test("responsiveness-transformi hylkää puuttuvan tai moniselitteisen versionumeron", () => {
  const withoutVersion = mainSource.replace(/^const APP_VERSION = "\d+\.\d+\.\d+";$/m, "");
  assert.throws(() => patchMainForResponsiveness(withoutVersion), /APP_VERSION anchor/);
  assert.throws(() => patchMainForResponsiveness(`${mainSource}\nconst APP_VERSION = "9.9.9";`), /APP_VERSION anchor/);
});
