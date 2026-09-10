import test from "node:test";
import assert from "node:assert/strict";
import {
  ecuSurveyObservationsFromDiagnosticResults,
  ecuSurveySnapshotFromDiagnosticRun,
  extractCanResponseHeaders
} from "../src/ecu-survey-diagnostic.js";
import { ECU_SURVEY_STATUS } from "../src/ecu-survey.js";

test("CAN-vastausotsakkeet poimitaan vain 0x700–0x7FF-alueen rivinaluista", () => {
  assert.deepEqual(
    extractCanResponseHeaders("SEARCHING...\r7E8 06 41 00 BE 3E B8 13\r7EA06410000000000\r>"),
    ["7E8", "7EA"]
  );
  assert.deepEqual(extractCanResponseHeaders("41 00 BE 3E B8 13\r>"), []);
});

test("vain ECU-osoitehaun 0100-tulokset muunnetaan survey-havainnoiksi", () => {
  const observations = ecuSurveyObservationsFromDiagnosticResults([
    {
      phase: "ECU-osoitehaku",
      command: "0100",
      requestHeader: "7E0",
      validResponse: true,
      raw: "7E8 06 41 00 BE 3E B8 13\r>",
      durationMs: 40,
      startedAt: 1000
    },
    {
      phase: "Vastaanottosuodatin",
      command: "0100",
      requestHeader: "7E0",
      validResponse: true,
      raw: "7E8 06 41 00 BE 3E B8 13\r>"
    },
    {
      phase: "ECU-osoitehaku",
      command: "010C",
      requestHeader: "7E0",
      validResponse: true,
      raw: "7E8 04 41 0C 10 00\r>"
    },
    {
      phase: "ECU-osoitehaku",
      command: "0100",
      requestHeader: "700",
      validResponse: true,
      raw: "708 06 41 00 00 00 00 00\r>"
    }
  ]);

  assert.equal(observations.length, 1);
  assert.equal(observations[0].requestHeader, "7E0");
  assert.equal(observations[0].responseHeader, "7E8");
  assert.equal(observations[0].validResponse, true);
  assert.equal(observations[0].durationMs, 40);
});

test("laajan diagnostiikan nykyinen 7E0–7E7-haku voidaan arvioida survey-snapshotiksi ilman uutta liikennettä", () => {
  const run = {
    startedAt: 1000,
    endedAt: 2000,
    meta: {
      reportId: "ELM-TEST-1",
      adapterFamily: "vlinker-mc-or-mc-plus",
      adapterProfileVersion: "vlinker-mc-plus-v1",
      transport: "Bluetooth Classic / SPP",
      adapter: "ELM327 v2.2",
      protocol: "ISO 15765-4 (CAN 11/500)"
    },
    results: [
      {
        phase: "ECU-osoitehaku",
        command: "0100",
        requestHeader: "7E0",
        validResponse: true,
        raw: "7E8 06 41 00 BE 3E B8 13\r>",
        durationMs: 44,
        startedAt: 1100
      },
      {
        phase: "ECU-osoitehaku",
        command: "0100",
        requestHeader: "7E1",
        validResponse: false,
        raw: "NO DATA\r>",
        error: "NO DATA",
        durationMs: 7000,
        startedAt: 1200
      },
      {
        phase: "ECU-osoitehaku",
        command: "0100",
        requestHeader: "7E3",
        validResponse: true,
        raw: "7EB 06 41 00 00 00 00 00\r>",
        durationMs: 52,
        startedAt: 1300
      }
    ]
  };

  const snapshot = ecuSurveySnapshotFromDiagnosticRun(run);
  assert.equal(snapshot.runId, "ELM-TEST-1");
  assert.equal(snapshot.adapter.family, "vlinker-mc-or-mc-plus");
  assert.equal(snapshot.summary.respondingHeaders, 2);
  assert.equal(snapshot.nodes.find(node => node.requestHeader === "7E0").status, ECU_SURVEY_STATUS.EXPECTED_RESPONDING);
  assert.equal(snapshot.nodes.find(node => node.requestHeader === "7E3").status, ECU_SURVEY_STATUS.UNMAPPED_RESPONSE);
  assert.equal(snapshot.nodes.find(node => node.requestHeader === "7E1").status, ECU_SURVEY_STATUS.UNKNOWN_NOT_OBSERVED);
});

test("usean CAN-otsakkeen raakavaste jätetään ilman yhtä arvattua responseHeaderia", () => {
  const observations = ecuSurveyObservationsFromDiagnosticResults([
    {
      phase: "ECU-osoitehaku",
      command: "0100",
      requestHeader: "7E2",
      validResponse: true,
      raw: "7EA 06 41 00 00 00 00 00\r7EB 06 41 00 00 00 00 00\r>"
    }
  ]);
  assert.equal(observations[0].responseHeader, "");
  assert.equal(observations[0].validResponse, true);
});


