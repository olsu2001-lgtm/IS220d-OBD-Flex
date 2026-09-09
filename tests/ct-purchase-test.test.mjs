import test from "node:test";
import assert from "node:assert/strict";

import {
  CT_PURCHASE_THRESHOLDS,
  createCtPurchaseInspection,
  createCtPurchaseSample,
  parseCtReadiness,
  decodeCtPurchasePid,
  analyzeCtPurchaseInspection,
  buildCtPurchaseInspectionReport
} from "../src/ct-purchase-test.js";
import { Elm327Client } from "../src/core.js";

function liveValues(currentA, offset = 0) {
  const values = {
    ctHvCurrent: currentA,
    ctHvSoc: 58,
    ctHvDeltaSoc: 1,
    ctHvTemperature1: 31,
    ctHvTemperature2: 32,
    ctHvTemperature3: 31.5,
    ctHvTemperatureMax: 32,
    ctHvTemperatureDelta: 1,
    ctHvResistanceDelta: 0.001,
    speed: Math.abs(currentA) < 5 ? 0 : 45
  };
  for (let index = 1; index <= 14; index++) {
    values[`ctHvBlockVoltage${String(index).padStart(2, "0")}`] = 14.5 + (index === 4 ? offset : 0);
  }
  return values;
}

function completedInspection() {
  const inspection = createCtPurchaseInspection({ appVersion: "0.7.1", startedAt: 1 });
  inspection.manual = { coldStart: "normal", warningLamps: "none", brakePump: "normal", serviceHistory: "documented" };
  inspection.preflight = {
    identification: { confirmed: true, modelCode: "ZWA10" },
    readiness: parseCtReadiness("41 01 00 07 E0 00"),
    standardPids: { distanceClearKm: 500, warmupsSinceClear: 12 },
    standardDtcs: { stored: [], pending: [], permanent: [] },
    standardDtcValid: true,
    vehicleDtcs: {
      groups: [
        { id: "hybrid.permanent_dtcs", validResponse: true, codes: [] },
        { id: "hybrid.stored_dtcs", validResponse: true, codes: [] },
        { id: "brake.stored_dtcs_candidate", validResponse: true, codes: [] }
      ],
      notes: []
    },
    raw: {}
  };
  inspection.postflight = structuredClone(inspection.preflight);
  inspection.roadSegments = [{ startedAt: 1_000, endedAt: 1_000 + CT_PURCHASE_THRESHOLDS.minimumRoadDurationMs }];
  for (let index = 0; index < 3; index++) inspection.samples.push(createCtPurchaseSample({ values: liveValues(2, -0.03), valueAgesMs: {} }));
  for (let index = 0; index < 5; index++) inspection.samples.push(createCtPurchaseSample({ values: liveValues(30, -0.08), valueAgesMs: {} }));
  for (let index = 0; index < 5; index++) inspection.samples.push(createCtPurchaseSample({ values: liveValues(-22, -0.07), valueAgesMs: {} }));
  return inspection;
}

test("CT-ostotarkastus tulkitsee readinessin ja nollauksesta kertovat standardi-PIDit", () => {
  const readiness = parseCtReadiness("7E8 06 41 01 00 07 E0 00\r>");
  assert.equal(readiness.milOn, false);
  assert.equal(readiness.dtcCount, 0);
  assert.equal(readiness.supportedCount, 6);
  assert.equal(readiness.incompleteCount, 0);
  assert.equal(decodeCtPurchasePid("41 30 0C", 0x30), 12);
  assert.equal(decodeCtPurchasePid("41 31 01 F4", 0x31), 500);
  assert.equal(decodeCtPurchasePid("41 42 37 70", 0x42), 14.192);
});

test("CT-koeajon näytteet luokitellaan vain tuoreilla 14 lohkon ja virran arvoilla", () => {
  const baseline = createCtPurchaseSample({ values: liveValues(2), valueAgesMs: {} });
  const discharge = createCtPurchaseSample({ values: liveValues(31), valueAgesMs: {} });
  const charge = createCtPurchaseSample({ values: liveValues(-20), valueAgesMs: {} });
  const stale = createCtPurchaseSample({
    values: liveValues(31),
    valueAgesMs: { ctHvBlockVoltage01: CT_PURCHASE_THRESHOLDS.maximumMetricAgeMs + 1 }
  });
  assert.equal(baseline.phase, "baseline");
  assert.equal(discharge.phase, "discharge");
  assert.equal(charge.phase, "charge");
  assert.equal(stale.phase, "invalid");
});

test("täysin katettu CT-seulonta ei väitä kapasiteettia tai SOH-prosenttia", () => {
  const inspection = completedInspection();
  const analysis = analyzeCtPurchaseInspection(inspection);
  assert.equal(analysis.status, "ready");
  assert.equal(analysis.missingCoverage.length, 0);
  assert.equal(analysis.coverage.roadDuration, true);
  assert.equal(analysis.coverage.postDriveDtcScan, true);
  assert.equal(analysis.metrics.maximumLoadBlockDeltaV, 0.08);
  const report = buildCtPurchaseInspectionReport(inspection, analysis);
  assert.match(report, /ei kuntotodistus eikä HV-akun kapasiteetti-\/SOH-mittaus/i);
  assert.match(report, /Flex-seulonta/i);
  assert.doesNotMatch(report, /SOH:\s*\d/i);
});

test("P0A80 tai jarrun C1391 pysäyttää ostoseulonnan myös vajavaisella koeajolla", () => {
  const inspection = completedInspection();
  inspection.samples = inspection.samples.slice(0, 3);
  inspection.preflight.vehicleDtcs.groups[1].codes = [{ code: "P0A80" }];
  inspection.preflight.vehicleDtcs.groups[2].codes = [{ code: "C1391" }];
  const analysis = analyzeCtPurchaseInspection(inspection);
  assert.equal(analysis.status, "stop");
  assert.match(analysis.findings.map(finding => finding.title).join("\n"), /P0A80/);
  assert.match(analysis.findings.map(finding => finding.title).join("\n"), /C1391/);
  assert.equal(analysis.coverage.discharge, false);
});

test("kokeellinen jarru-DTC-luku käyttää omaa 7B0/7B8-transaktiota ja palauttaa aina 7E0-otsakkeen", async () => {
  const history = [];
  let header = "7E0";
  const transport = {
    async send(command) {
      history.push(command);
      if (command.startsWith("ATSH")) header = command.slice(4);
      if (command === "0A") return "4A 00\r>";
      if (command === "13B0" && header === "7E2") return "53 00\r>";
      if (command === "13B0" && header === "7B0") return "53 01 53 91\r>";
      return "OK\r>";
    },
    async disconnect() {}
  };
  const client = new Elm327Client(transport, () => {}, () => {}, { wait: async () => {}, vehicleKey: "ct200h" });
  const result = await client.readVehicleSpecificDtcs({ includeResearchCandidates: true });
  assert.deepEqual(result.groups.map(group => group.id), ["hybrid.permanent_dtcs", "hybrid.stored_dtcs", "brake.stored_dtcs_candidate"]);
  assert.deepEqual(result.groups.at(-1).codes.map(code => code.code), ["C1391"]);
  assert.equal(result.groups.at(-1).validatedOnCt200h, false);
  assert.equal(result.transactionIds.length, 2);
  assert.equal(history.at(-1), "ATSH7E0");
  assert.ok(history.indexOf("ATSH7B0") > history.indexOf("ATSH7E2"));
  assert.equal(history.includes("04"), false);
});
