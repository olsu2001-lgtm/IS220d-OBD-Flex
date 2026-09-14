import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("component diagnostics publisher attaches Techstream CSV evidence after import UI", () => {
  const publisher = fs.readFileSync(new URL("../src/component-diagnostics-publisher.js", import.meta.url), "utf8");
  assert.match(publisher, /publishIs220dTechstreamEvidence/);
  assert.match(publisher, /publishTechstreamDataListGapUi\(\)/);
  assert.match(publisher, /then\(\(\) => publishIs220dTechstreamEvidence\(\)\)/);
});

test("Techstream evidence stays explicitly offline reference evidence", () => {
  const source = fs.readFileSync(new URL("../src/is220d-techstream-evidence.js", import.meta.url), "utf8");
  assert.match(source, /OFFLINE-REFERENSSI/);
  assert.match(source, /Ei muuta Flexin live-signaalin varmennusta/);
  assert.doesNotMatch(source, /productionAuthorized\s*=|authorization\s*=|commands\s*:/);
});
