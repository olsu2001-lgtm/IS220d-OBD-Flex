import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/mode09-identity.js", import.meta.url), "utf8");
const evidence = await readFile(new URL("../src/vehicle-identity-evidence.js", import.meta.url), "utf8");

test("Mode 09 identity layer parses diagnostic results but has no transport/send path", () => {
  assert.match(source, /existing-wide-diagnostic-mode09/);
  assert.match(source, /0902/);
  assert.match(source, /0904/);
  assert.match(source, /0906/);
  assert.match(source, /090A/);
  assert.doesNotMatch(source, /\.command\s*\(|safeCommand\s*\(|runDiagnosticCommand\s*\(|executeFullDiagnosticStep\s*\(|ATSH|ATSP|ATZ/);
});

test("target identity constants remain documentation evidence and read-only", () => {
  assert.match(evidence, /JTHBB262302028787/);
  assert.match(evidence, /35360000/);
  assert.match(evidence, /01CAD67F74/);
  assert.match(evidence, /docs\/VEHICLE_EVIDENCE\.md/);
  assert.match(evidence, /writable:\s*false/);
});


