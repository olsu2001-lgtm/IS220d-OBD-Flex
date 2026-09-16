import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  Elm327Client,
  FakeElmTransport,
  VEHICLE_KEYS,
  CT200H_DIAGNOSTIC_PROFILE
} from "../src/core.js";
import {
  CT200H_ECU_COMPONENT_TESTS,
  buildCt200hEcuCoverageSummary
} from "../src/ct200h-ecu-component-tests.js";
import {
  resolveCt200hMetricReadGroups,
  runCt200hEcuComponentTest,
  runAllCt200hEcuComponentTests
} from "../src/ct200h-ecu-component-runtime.js";

function readyClient(vehicleKey = VEHICLE_KEYS.CT200H) {
  const transport = new FakeElmTransport();
  transport.connected = true;
  const traffic = [];
  const client = new Elm327Client(
    transport,
    event => traffic.push(event),
    () => {},
    { vehicleKey, wait: async () => {}, transportSettleMs: 0, resetSettleMs: 0, protocolSettleMs: 0, retrySettleMs: 0 }
  );
  client.connected = true;
  client.ecuConnected = true;
  return { client, transport, traffic };
}

function transmittedCommands(traffic) {
  return traffic.filter(event => event.direction === "tx").map(event => event.command);
}

test("CT component catalog covers every ECU currently declared by the vehicle profile", () => {
  const profileEcus = Object.keys(CT200H_DIAGNOSTIC_PROFILE.ecus).sort();
  const catalogEcus = [...new Set(CT200H_ECU_COMPONENT_TESTS.map(item => item.ecuId))].sort();
  assert.deepEqual(catalogEcus, profileEcus);

  const summary = buildCt200hEcuCoverageSummary();
  assert.deepEqual([...summary.ecuIds].sort(), profileEcus);
  assert.equal(summary.byEcu.engine.runnable > 0, true);
  assert.equal(summary.byEcu.hybrid.runnable > 0, true);
  assert.equal(summary.byEcu.brake.blocked > 0, true);
  assert.match(summary.scope, /undeclared.*not guessed/i);
});

test("CT resolver deduplicates all HV block metrics to one profile read", () => {
  const groups = resolveCt200hMetricReadGroups([
    "ctHvBlockVoltage01",
    "ctHvBlockVoltage02",
    "ctHvBlockDelta",
    "ctHvBlockVoltage01"
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].sourceType, "toyota-read-data");
  assert.equal(groups[0].sourceKey, "toyota:2181");
  assert.deepEqual(groups[0].metricIds, ["ctHvBlockVoltage01", "ctHvBlockVoltage02", "ctHvBlockDelta"]);
});

test("HV block-voltage component test reads only 2181 through CT profile allowlist", async () => {
  const { client, traffic } = readyClient();
  const result = await runCt200hEcuComponentTest("hybrid.block_voltages", { client, timeoutMs: 1000 });
  const tx = transmittedCommands(traffic);
  assert.equal(result.status, "complete");
  assert.ok(result.observedMetricIds.includes("ctHvBlockVoltage01"));
  assert.ok(result.observedMetricIds.includes("ctHvBlockVoltage14"));
  assert.ok(Number.isFinite(result.values.ctHvBlockDelta.value));
  assert.equal(tx.filter(command => command === "2181").length, 1);
  assert.equal(tx.includes("2101"), false);
  assert.equal(tx.includes("2187"), false);
  assert.equal(tx.includes("2195"), false);
  assert.equal(tx.includes("2198"), false);
});

test("engine EGR component test reads only selected standard Mode 01 metrics", async () => {
  const { client, traffic } = readyClient();
  const result = await runCt200hEcuComponentTest("engine.egr_feedback", { client, timeoutMs: 1000 });
  const tx = transmittedCommands(traffic).filter(command => /^01[0-9A-F]{2}$/.test(command));
  assert.equal(result.status, "complete");
  assert.deepEqual(new Set(result.observedMetricIds), new Set(["commandedEgr", "egrError"]));
  assert.deepEqual(tx, ["012C", "012D"]);
  assert.equal(transmittedCommands(traffic).some(command => /^21/.test(command)), false);
});

test("hybrid DTC component test uses production CT requests and never probes research brake ECU", async () => {
  const { client, traffic } = readyClient();
  const result = await runCt200hEcuComponentTest("hybrid.dtc_memory", { client, timeoutMs: 1000 });
  const tx = transmittedCommands(traffic);
  assert.equal(result.status, "complete");
  assert.ok(result.observedMetricIds.includes("hybrid.permanent_dtcs"));
  assert.ok(result.observedMetricIds.includes("hybrid.stored_dtcs"));
  assert.equal(tx.includes("ATSH7B0"), false);
  assert.equal(tx.includes("ATSH7E2"), true);
  assert.equal(tx.includes("0A"), true);
  assert.equal(tx.includes("13B0"), true);
});

test("research-only brake component stays visible but sends nothing", async () => {
  const { client, traffic } = readyClient();
  const result = await runCt200hEcuComponentTest("brake.dtc_candidate", { client });
  assert.equal(result.status, "blocked");
  assert.equal(result.ecuId, "brake");
  assert.match(result.note, /research-candidate/i);
  assert.deepEqual(transmittedCommands(traffic), []);
});

test("wrong vehicle or disconnected client blocks production CT component reads", async () => {
  const wrong = readyClient(VEHICLE_KEYS.IS220D);
  await assert.rejects(
    runCt200hEcuComponentTest("hybrid.block_voltages", { client: wrong.client }),
    error => error?.code === "CT200H_PROFILE_REQUIRED"
  );
  assert.deepEqual(transmittedCommands(wrong.traffic), []);

  const disconnected = readyClient();
  disconnected.client.ecuConnected = false;
  await assert.rejects(
    runCt200hEcuComponentTest("engine.coolant_temperature_sensor", { client: disconnected.client }),
    error => error?.code === "ECU_CONNECTION_REQUIRED"
  );
  assert.deepEqual(transmittedCommands(disconnected.traffic), []);
});

test("run-all returns one result for every declared CT component test and keeps brake blocked", async () => {
  const { client, traffic } = readyClient();
  const result = await runAllCt200hEcuComponentTests({ client, timeoutMs: 1000 });
  assert.equal(result.results.length, CT200H_ECU_COMPONENT_TESTS.length);
  assert.equal(result.summary.total, CT200H_ECU_COMPONENT_TESTS.length);
  assert.equal(result.results.find(item => item.testId === "brake.dtc_candidate")?.status, "blocked");
  assert.equal(transmittedCommands(traffic).includes("ATSH7B0"), false);
});

test("CT component runtime contains no direct native bridge or hard-coded Toyota command strings", () => {
  const source = readFileSync(new URL("../src/ct200h-ecu-component-runtime.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /(?:globalThis|window)\.obd|\.transport\.|\.send\(|\.command\(/);
  assert.doesNotMatch(source, /["'`](?:21C1|2101|2181|2187|2195|2198|13B0)["'`]/);
  assert.match(source, /client\.readMetricGroup/);
  assert.match(source, /client\.readToyotaProbeResponse/);
  assert.match(source, /client\.readVehicleSpecificDtcs/);
  assert.match(source, /isProfileReadOnlyCommand/);
});
