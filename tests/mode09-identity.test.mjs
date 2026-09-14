import test from "node:test";
import assert from "node:assert/strict";
import {
  extractMode09Body,
  extractMode09IdentityFromDiagnosticRun
} from "../src/mode09-identity.js";

const run = {
  results: [
    {
      command: "0902",
      validResponse: true,
      raw: "7E8 10 14 49 02 01 4A 54 48\r7E8 21 42 42 32 36 32 33 30\r7E8 22 32 30 32 38 37 38 37\r>"
    },
    {
      command: "0904",
      validResponse: true,
      raw: "7E8 10 0B 49 04 01 33 35 33\r7E8 21 36 30 30 30 30\r>"
    },
    {
      command: "0906",
      validResponse: true,
      raw: "7E8 07 49 06 01 CA D6 7F 74\r>"
    },
    {
      command: "090A",
      validResponse: true,
      raw: "49 0A 01 45 4E 47 49 4E 45"
    }
  ]
};

test("Mode 09 parser reassembles ISO-TP VIN and matches repository vehicle evidence", () => {
  const identity = extractMode09IdentityFromDiagnosticRun(run);
  assert.equal(identity.overall, "match");
  assert.equal(identity.writable, false);
  assert.equal(identity.fields.vin.value, "JTHBB262302028787");
  assert.equal(identity.fields.vin.expected, "JTHBB262302028787");
  assert.equal(identity.fields.vin.status, "match");
  assert.equal(identity.fields.calibrationId.value, "35360000");
  assert.equal(identity.fields.calibrationId.status, "match");
  assert.equal(identity.fields.calibrationVerificationNumber.value, "01CAD67F74");
  assert.equal(identity.fields.calibrationVerificationNumber.status, "match");
  assert.equal(identity.fields.ecuName.value, "ENGINE");
  assert.equal(identity.fields.ecuName.status, "observed");
});

test("extractMode09Body preserves response CAN header and application body", () => {
  const parsed = extractMode09Body(run.results[0].raw, 0x02);
  assert.equal(parsed.header, "7E8");
  assert.equal(parsed.body[0], 0x01);
  assert.equal(parsed.body.length, 18);
});

test("mismatching vehicle identity is reported but not rewritten", () => {
  const mismatchRun = {
    results: [{
      command: "0902",
      validResponse: true,
      raw: "7E8 10 14 49 02 01 4A 54 48\r7E8 21 42 42 32 36 32 33 30\r7E8 22 32 30 32 38 37 38 38\r>"
    }]
  };
  const identity = extractMode09IdentityFromDiagnosticRun(mismatchRun);
  assert.equal(identity.overall, "mismatch");
  assert.equal(identity.fields.vin.value, "JTHBB262302028788");
  assert.equal(identity.fields.vin.expected, "JTHBB262302028787");
  assert.equal(identity.fields.vin.status, "mismatch");
});

test("truncated ISO-TP identity response fails closed as parse-error", () => {
  const truncated = {
    results: [{
      command: "0902",
      validResponse: true,
      raw: "7E8 10 14 49 02 01 4A 54 48\r7E8 21 42 42 32\r>"
    }]
  };
  const identity = extractMode09IdentityFromDiagnosticRun(truncated);
  assert.equal(identity.overall, "partial");
  assert.equal(identity.fields.vin.value, "");
  assert.equal(identity.fields.vin.status, "parse-error");
});

test("NO DATA identity result remains not-observed", () => {
  const missing = extractMode09IdentityFromDiagnosticRun({
    results: [{ command: "0902", validResponse: false, raw: "NO DATA\r>", error: "NO DATA" }]
  });
  assert.equal(missing.overall, "not-observed");
  assert.equal(missing.fields.vin.status, "not-observed");
  assert.equal(missing.fields.vin.error, "NO DATA");
});


