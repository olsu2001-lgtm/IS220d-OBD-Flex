import test from "node:test";
import assert from "node:assert/strict";

import {
  Elm327Client,
  FakeElmTransport,
  PID_BY_ID,
  VEHICLE_KEYS
} from "../src/core.js";

async function createConnectedIs220dVlinkerClient() {
  const transport = new FakeElmTransport();
  await transport.connect();
  const client = new Elm327Client(
    transport,
    () => {},
    () => {},
    {
      vehicleKey: VEHICLE_KEYS.IS220D,
      wait: async () => {},
      transportSettleMs: 0,
      resetSettleMs: 0,
      protocolSettleMs: 0,
      retrySettleMs: 0
    }
  );

  const connection = await client.initializeConnected({
    ok: true,
    name: "vLinker MC-Android",
    address: "FAKE:VLINKER",
    transport: "classic"
  }, "can6");

  assert.equal(connection.ecuConnected, true);
  assert.equal(client.adapterProfile.vlinker, true);
  assert.equal(client.vehicleKey, VEHICLE_KEYS.IS220D);
  return { client, transport };
}

test("connected IS220d vLinker discovers the approved 217E DPNR live metric", async () => {
  const { client } = await createConnectedIs220dVlinkerClient();
  const supported = await client.readSupportedPids();

  assert.equal(supported.has("dpnrDifferentialPressure"), true);
  assert.equal(supported.has("dpnrSulfurRegenerationState"), true);
  assert.equal(supported.has("dpnrPmRegenerationState"), true);
  assert.equal(supported.has("dpnrRegenerationActive"), true);
});

test("217E metric group returns decoded pressure with positive raw evidence", async () => {
  const { client } = await createConnectedIs220dVlinkerClient();
  await client.readSupportedPids();

  const definitions = [
    PID_BY_ID.dpnrDifferentialPressure,
    PID_BY_ID.dpnrSulfurRegenerationState,
    PID_BY_ID.dpnrPmRegenerationState,
    PID_BY_ID.dpnrRegenerationActive
  ];
  assert.ok(definitions.every(Boolean));

  const result = await client.readMetricGroup(definitions, 5000);
  const pressure = result.results.find(item => item.definition.id === "dpnrDifferentialPressure");

  assert.equal(result.command, "217E");
  assert.match(String(result.raw), /61\s*7E/i);
  assert.ok(Number.isFinite(pressure?.value));
  assert.ok(Number.isFinite(result.updatedAt));
  assert.equal(result.missingMetricIds.length, 0);
});

test("217E live pipeline remains read-only and does not use rejected injector feedback", async () => {
  const { client } = await createConnectedIs220dVlinkerClient();
  await client.readSupportedPids();
  const result = await client.readMetricGroup([PID_BY_ID.dpnrDifferentialPressure], 5000);

  assert.equal(result.command, "217E");
  assert.notEqual(result.command, "219C");
  assert.doesNotMatch(result.command, /^04$/);
});
