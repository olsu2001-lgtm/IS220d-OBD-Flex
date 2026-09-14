import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/field-validation.js", import.meta.url), "utf8");

test("field validation layer contains no adapter or vehicle transmit path", () => {
  assert.match(source, /extractFieldValidationEvidenceFromDiagnosticRun/);
  assert.match(source, /evaluateFieldValidationSession/);
  assert.match(source, /buildFieldValidationTextReport/);
  assert.doesNotMatch(source, /state\.client|globalThis\.obd|NativeElmTransport|Elm327Client|safeCommand\s*\(|runDiagnosticCommand\s*\(|\.command\s*\(/);
});


