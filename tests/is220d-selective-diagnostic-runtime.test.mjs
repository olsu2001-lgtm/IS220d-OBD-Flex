import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  Elm327Client,
  FakeElmTransport,
  VEHICLE_KEYS
} from "../src/core.js";
import {
  resolveIs220dSelectiveMetricReadGroups,
  runIs220dSelectiveDiagnostic
} from "../src/is220d-selective-diagnostic-runtime.js";

function readyClient(vehicleKey = VEHICLE_KEYS.IS220D) {
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

test("selective resolver groups only supplied Flex metric IDs and deduplicates one physical Toyota read", () => {
  const groups = resolveIs220dSelectiveMetricReadGroups([
    "dpnrInletTemperature",
    "dpnrOutletTemperature",
    "dpnrInletTemperature"
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].sourceType, "toyota-read-data");
  assert.equal(groups[0].sourceKey, "toyota:217F");
  assert.deepEqual(groups[0].metricIds, ["dpnrInletTemperature", "dpnrOutletTemperature"]);
});

test("unknown, derived and unverified Toyota metrics fail before any runtime read can be built", () => {
  assert.throws(
    () => resolveIs220dSelectiveMetricReadGroups(["futureUnknownMetric"]),
    error => error?.code === "UNKNOWN_METRIC"
  );
  assert.throws(
    () => resolveIs220dSelectiveMetricReadGroups(["boostPressure"]),
    error => error?.code === "NON_EXECUTABLE_METRIC"
  );
  assert.throws(
    () => resolveIs220dSelectiveMetricReadGroups(["toyotaFuelTemperature"]),
    error => error?.code === "NON_EXECUTABLE_METRIC"
  );
});

test("EGR selective runtime reads only the plan metric through Elm327Client and IS220d Toyota allowlist", async () => {
  const { client, traffic } = readyClient();
  const result = await runIs220dSelectiveDiagnostic("engine.egr_valve", { client, timeoutMs: 1000 });
  const tx = transmittedCommands(traffic);

  assert.equal(result.status, "complete");
  assert.deepEqual(result.requestedMetricIds, ["toyotaEgrPosition"]);
  assert.deepEqual(result.observedMetricIds, ["toyotaEgrPosition"]);
  assert.ok(Number.isFinite(result.values.toyotaEgrPosition.value));
  assert.match(result.values.toyotaEgrPosition.raw.replace(/\s/g, ""), /612C/);
  assert.equal(tx.filter(command => command === "212C").length, 1);
  assert.equal(tx.includes("217E"), false);
  assert.equal(tx.includes("217F"), false);
  assert.equal(tx.includes("2193"), false);
  assert.equal(tx.includes("2196"), false);
  assert.equal(tx.includes("21AF"), false);
  assert.equal(tx.includes("219C"), false);
});

test("main injector selective runtime reads only rail pressure and RPM instead of the wide diagnostic", async () => {
  const { client, traffic } = readyClient();
  const result = await runIs220dSelectiveDiagnostic("engine.main_injectors", { client, timeoutMs: 1000 });
  const tx = transmittedCommands(traffic);
  const obdReads = tx.filter(command => /^01[0-9A-F]{2}$/.test(command));

  assert.equal(result.status, "complete");
  assert.deepEqual(result.requestedMetricIds, ["railPressure", "rpm"]);
  assert.deepEqual(new Set(result.observedMetricIds), new Set(["railPressure", "rpm"]));
  assert.deepEqual(obdReads, ["0123", "010C"]);
  assert.equal(tx.some(command => /^21(?:7E|7F|2C|93|96|AF|9C)$/.test(command)), false);
});

test("dedicated DPNR path is preserved and generic selective runtime sends nothing for it", async () => {
  const { client, traffic } = readyClient();
  await assert.rejects(
    runIs220dSelectiveDiagnostic("engine.dpnr_differential_pressure_sensor", { client }),
    error => error?.code === "DEDICATED_RUNNER_REQUIRED" && error?.dedicatedRunner === "dpnr-guided-217e"
  );
  assert.deepEqual(transmittedCommands(traffic), []);
});

test("non-runnable component fails closed without touching transport", async () => {
  const { client, traffic } = readyClient();
  await assert.rejects(
    runIs220dSelectiveDiagnostic("engine.fuel_temperature_sensor", { client }),
    error => error?.code === "PLAN_NOT_RUNNABLE"
  );
  assert.deepEqual(transmittedCommands(traffic), []);
});

test("wrong vehicle profile or missing engine ECU connection blocks execution before transport", async () => {
  const wrongVehicle = readyClient(VEHICLE_KEYS.CT200H);
  await assert.rejects(
    runIs220dSelectiveDiagnostic("engine.egr_valve", { client: wrongVehicle.client }),
    error => error?.code === "IS220D_PROFILE_REQUIRED"
  );
  assert.deepEqual(transmittedCommands(wrongVehicle.traffic), []);

  const disconnected = readyClient();
  disconnected.client.ecuConnected = false;
  await assert.rejects(
    runIs220dSelectiveDiagnostic("engine.egr_valve", { client: disconnected.client }),
    error => error?.code === "ENGINE_ECU_REQUIRED"
  );
  assert.deepEqual(transmittedCommands(disconnected.traffic), []);
});

test("runtime execution consumes plan.metricIds only and contains no direct native/raw transport path", () => {
  const source = readFileSync(new URL("../src/is220d-selective-diagnostic-runtime.js", import.meta.url), "utf8");
  assert.match(source, /plan\.metricIds/);
  assert.doesNotMatch(source, /plan\.(?:commands|signalKeys|selectedSignals)/);
  assert.doesNotMatch(source, /(?:globalThis|window)\.obd|\.transport\.|\.send\(|\.command\(/);
  assert.doesNotMatch(source, /["'`](?:217E|217F|212C|2193|2196|21AF|219C)["'`]/);
  assert.match(source, /client\.readMetricGroup/);
  assert.match(source, /client\.readToyotaProbeResponse/);
  assert.match(source, /isProfileReadOnlyCommand/);
});
