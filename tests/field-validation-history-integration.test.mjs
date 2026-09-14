import test from "node:test";
import assert from "node:assert/strict";
import { ecuSurveySnapshotFromDiagnosticRun } from "../src/ecu-survey-diagnostic.js";
import {
  loadEcuSurveyHistory,
  recordEcuSurveySnapshot,
  summarizeEcuSurveyHistory
} from "../src/ecu-survey-history.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function diagnosticRun(id, endedAt) {
  return {
    startedAt: endedAt - 1000,
    endedAt,
    cancelled: false,
    connectionStrategy: "current",
    meta: {
      reportId: id,
      engineRunningDeclared: true,
      adapterFamily: "vlinker",
      transport: "ble",
      protocol: "6"
    },
    results: [
      { phase: "Nykytila ennen nollausta", command: "0100", validResponse: true, status: "PASS" },
      { phase: "ECU-osoitehaku", command: "0100", requestHeader: "7E0", validResponse: true, status: "PASS", raw: "7E8 06 41 00 BE 3E B8 13" },
      { phase: "ECU-osoitehaku", command: "0100", requestHeader: "7E1", validResponse: false, status: "WARN", raw: "NO DATA" },
      { phase: "ECU-osoitehaku", command: "0100", requestHeader: "7E2", validResponse: false, status: "WARN", raw: "NO DATA" },
      { phase: "ECU-osoitehaku", command: "0100", requestHeader: "7E3", validResponse: false, status: "WARN", raw: "NO DATA" },
      { phase: "ECU-osoitehaku", command: "0100", requestHeader: "7E4", validResponse: false, status: "WARN", raw: "NO DATA" },
      { phase: "ECU-osoitehaku", command: "0100", requestHeader: "7E5", validResponse: false, status: "WARN", raw: "NO DATA" },
      { phase: "ECU-osoitehaku", command: "0100", requestHeader: "7E6", validResponse: false, status: "WARN", raw: "NO DATA" },
      { phase: "ECU-osoitehaku", command: "0100", requestHeader: "7E7", validResponse: false, status: "WARN", raw: "NO DATA" },
      { command: "0902", validResponse: true, raw: "7E8 10 14 49 02 01 4A 54 48\r7E8 21 42 42 32 36 32 33 30\r7E8 22 32 30 32 38 37 38 37\r>" },
      { command: "0904", validResponse: true, raw: "7E8 10 0B 49 04 01 33 35 33\r7E8 21 36 30 30 30 30\r>" },
      { command: "0906", validResponse: true, raw: "7E8 07 49 06 01 CA D6 7F 74\r>" },
      { command: "090A", validResponse: true, raw: "49 0A 01 45 4E 47 49 4E 45" },
      { phase: "Toyota Read Data · normaali ELM-muoto", command: "217E", toyotaIdentifier: 0x7e, queryForm: "formatted", validResponse: true, status: "PASS", raw: "7E8 06 61 7E 00 00 00 00" },
      { phase: "Toyota Read Data · normaali ELM-muoto", command: "217F", toyotaIdentifier: 0x7f, queryForm: "formatted", validResponse: true, status: "PASS", raw: "7E8 06 61 7F 00 00 00 00" },
      { phase: "Toyota Read Data · normaali ELM-muoto", command: "212C", toyotaIdentifier: 0x2c, queryForm: "formatted", validResponse: true, status: "PASS", raw: "7E8 03 61 2C 80" },
      { phase: "Palautus", command: "0100", requestHeader: "7E0", validResponse: true, status: "PASS", raw: "41 00 BE 3E B8 13" }
    ]
  };
}

test("three diagnostic runs become one persisted field-validation session without raw duplication", () => {
  const storage = memoryStorage();
  const previousSha = globalThis.__IS220D_BUILD_SHA__;
  globalThis.__IS220D_BUILD_SHA__ = "ABCDEF123456";
  try {
    for (let index = 1; index <= 3; index++) {
      const snapshot = ecuSurveySnapshotFromDiagnosticRun(diagnosticRun(`run-${index}`, index * 1000));
      const result = recordEcuSurveySnapshot(snapshot, storage);
      if (index < 3) assert.equal(result.fieldValidation.readyForTechstream, false);
    }
    const history = loadEcuSurveyHistory(storage);
    assert.equal(history.length, 3);
    assert.equal(history[0].buildSha, "ABCDEF123456");
    assert.equal(history[0].validation.restorationPassed, true);
    assert.equal(history[0].validation.toyotaAttemptedCount, 3);
    assert.equal(history[0].identity.overall, "match");
    const serialized = JSON.stringify(history);
    assert.doesNotMatch(serialized, /7E8 06 61 7E/);
    assert.doesNotMatch(serialized, /NO DATA/);
    const summary = summarizeEcuSurveyHistory(storage);
    assert.equal(summary.fieldValidation.status, "ready-for-techstream");
    assert.equal(summary.fieldValidation.readyForTechstream, true);
    assert.equal(summary.fieldValidation.checks.every(item => item.pass), true);
  } finally {
    if (previousSha === undefined) delete globalThis.__IS220D_BUILD_SHA__;
    else globalThis.__IS220D_BUILD_SHA__ = previousSha;
  }
});


