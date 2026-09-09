import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFieldValidationTextReport,
  evaluateFieldValidationSession,
  extractFieldValidationEvidenceFromDiagnosticRun
} from "../src/field-validation.js";

function nodes(extraResponder = false) {
  const result = [];
  for (let index = 0; index < 8; index++) {
    const requestHeader = `7E${index.toString(16).toUpperCase()}`;
    const engine = index === 0;
    const extra = extraResponder && index === 3;
    result.push({
      requestHeader,
      knownEcuId: engine ? "engine" : "",
      responding: engine || extra,
      observedResponseHeaders: engine ? ["7E8"] : extra ? ["7EB"] : []
    });
  }
  return result;
}

function validation(overrides = {}) {
  return {
    schemaVersion: 1,
    engineState: "running",
    connectionStrategy: "current",
    currentSettingsProbeObserved: true,
    currentSettingsProbePassed: true,
    restorationProbeObserved: true,
    restorationPassed: true,
    cancelled: false,
    internalFailure: false,
    toyota: [
      { command: "217E", attempted: true, positive: true, status: "positive" },
      { command: "217F", attempted: true, positive: true, status: "positive" },
      { command: "212C", attempted: true, positive: true, status: "positive" }
    ],
    ...overrides
  };
}

function snapshot(id, endedAt, overrides = {}) {
  return {
    schemaVersion: 1,
    mode: "read-only",
    profileVersion: "is220d-xe20-2ad-fhv-readonly-v1",
    safeProbe: "0100",
    runId: id,
    buildSha: "ABCDEF123456",
    startedAt: endedAt - 1000,
    endedAt,
    nodes: nodes(Boolean(overrides.extraResponder)),
    identity: { overall: "match" },
    validation: validation(overrides.validation || {})
  };
}

test("three clean same-build runs become ready for Techstream cross-check", () => {
  const session = evaluateFieldValidationSession([
    snapshot("run-1", 1000),
    snapshot("run-2", 2000),
    snapshot("run-3", 3000)
  ]);
  assert.equal(session.status, "ready-for-techstream");
  assert.equal(session.readyForTechstream, true);
  assert.equal(session.observedRuns, 3);
  assert.equal(session.buildSha, "ABCDEF123456");
  assert.equal(session.engineState, "running");
  assert.equal(session.checks.every(item => item.pass), true);
  assert.match(session.topologySignature, /7E0>7E8:engine/);
});

test("different build SHA starts a new validation group", () => {
  const third = snapshot("run-3", 3000);
  third.buildSha = "999999999999";
  const session = evaluateFieldValidationSession([
    snapshot("run-1", 1000),
    snapshot("run-2", 2000),
    third
  ]);
  assert.equal(session.status, "collecting");
  assert.equal(session.observedRuns, 1);
  assert.equal(session.readyForTechstream, false);
});

test("changed topology blocks the clean validation gate", () => {
  const session = evaluateFieldValidationSession([
    snapshot("run-1", 1000),
    snapshot("run-2", 2000),
    snapshot("run-3", 3000, { extraResponder: true })
  ]);
  assert.equal(session.status, "needs-attention");
  assert.equal(session.readyForTechstream, false);
  assert.equal(session.checks.find(item => item.code === "topology").pass, false);
});

test("auto engine state and failed restoration remain explicit pending checks", () => {
  const runs = [1, 2, 3].map(index => snapshot(`run-${index}`, index * 1000, {
    validation: { engineState: "auto", restorationPassed: false }
  }));
  const session = evaluateFieldValidationSession(runs);
  assert.equal(session.status, "needs-attention");
  assert.equal(session.checks.find(item => item.code === "vehicle-state").pass, false);
  assert.equal(session.checks.find(item => item.code === "restoration").pass, false);
});

test("field validation extractor summarizes existing run results only", () => {
  const evidence = extractFieldValidationEvidenceFromDiagnosticRun({
    connectionStrategy: "current",
    cancelled: false,
    meta: { engineRunningDeclared: true },
    results: [
      { phase: "Nykytila ennen nollausta", command: "0100", validResponse: true, status: "PASS" },
      { phase: "Toyota Read Data · normaali ELM-muoto", command: "217E", toyotaIdentifier: 0x7e, queryForm: "formatted", validResponse: true, status: "PASS", raw: "7E8 06 61 7E 00 00 00 00" },
      { phase: "Toyota Read Data · normaali ELM-muoto", command: "217F", toyotaIdentifier: 0x7f, queryForm: "formatted", validResponse: false, status: "WARN", raw: "NO DATA" },
      { phase: "Toyota Read Data · normaali ELM-muoto", command: "212C", toyotaIdentifier: 0x2c, queryForm: "formatted", validResponse: false, status: "WARN", timeout: true, raw: "" },
      { phase: "Palautus", command: "0100", validResponse: true, status: "PASS" }
    ]
  });
  assert.equal(evidence.engineState, "running");
  assert.equal(evidence.connectionStrategy, "current");
  assert.equal(evidence.currentSettingsProbePassed, true);
  assert.equal(evidence.restorationPassed, true);
  assert.equal(evidence.toyotaAttemptedCount, 3);
  assert.equal(evidence.toyotaPositiveCount, 1);
  assert.equal(evidence.toyota[0].status, "positive");
  assert.deepEqual(evidence.toyota[0].responseHeaders, ["7E8"]);
  assert.equal(evidence.toyota[1].status, "no-data");
  assert.equal(evidence.toyota[2].status, "timeout");
});

test("validation text report is compact and contains no raw response copy", () => {
  const session = evaluateFieldValidationSession([
    snapshot("run-1", 1000),
    snapshot("run-2", 2000),
    snapshot("run-3", 3000)
  ]);
  const report = buildFieldValidationTextReport(session);
  assert.match(report, /Ready for Techstream cross-check: yes/);
  assert.match(report, /Build SHA: ABCDEF123456/);
  assert.match(report, /217E:positive/);
  assert.doesNotMatch(report, /7E8 06 61 7E/);
});
