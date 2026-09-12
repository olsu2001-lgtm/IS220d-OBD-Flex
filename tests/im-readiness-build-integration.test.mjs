import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { patchMainForImReadiness } from "../scripts/im-readiness-main-transform.mjs";
import { imReadinessSnapshotFromDiagnosticRun } from "../src/ecu-survey-diagnostic.js";

test("main transform adds four standard I/M readiness reads exactly once", () => {
  const source = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  const patched = patchMainForImReadiness(source);
  for (const command of ["0101", "0141", "0130", "0131"]) {
    const matches = patched.match(new RegExp(`diagnosticModeStep\\(\\"${command}\\"`, "g")) || [];
    assert.equal(matches.length, 1, `${command} must appear once in the wide diagnostic mode-step list`);
  }
  assert.match(patched, /I\/M readiness · tämä ajosykli/);
});

test("main transform is idempotent", () => {
  const source = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  const once = patchMainForImReadiness(source);
  assert.equal(patchMainForImReadiness(once), once);
});

test("ECU survey extracts readiness only from valid diagnostic results", () => {
  const run = {
    results: [
      { command: "0101", validResponse: false, raw: "41 01 80 0F EB FF" },
      { command: "0101", validResponse: true, raw: "41 01 00 0F EB 40" },
      { command: "0141", validResponse: true, raw: "41 41 00 0F EB 00" },
      { command: "0130", validResponse: true, raw: "41 30 06" },
      { command: "0131", validResponse: true, raw: "41 31 01 2C" }
    ]
  };
  const snapshot = imReadinessSnapshotFromDiagnosticRun(run);
  assert.equal(snapshot.overall, "not-ready");
  assert.equal(snapshot.sinceClear.ignitionType, "compression");
  assert.equal(snapshot.sinceClear.incompleteCount, 1);
  assert.equal(snapshot.driveCycle.incompleteCount, 0);
  assert.equal(snapshot.warmupsSinceClear, 6);
  assert.equal(snapshot.distanceSinceClearKm, 300);
});

test("I/M integration stays on standard Mode 01 reads only", () => {
  const transform = fs.readFileSync(new URL("../scripts/im-readiness-main-transform.mjs", import.meta.url), "utf8");
  assert.match(transform, /0101/);
  assert.match(transform, /0141/);
  assert.match(transform, /0130/);
  assert.match(transform, /0131/);
  assert.doesNotMatch(transform, /21[0-9A-F]{2}|ATSH|ATCRA|04\b/i);
});
