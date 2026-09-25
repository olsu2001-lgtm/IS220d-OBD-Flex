import test from "node:test";
import assert from "node:assert/strict";
import { Elm327Client, TOYOTA_READ_DATA_PROBES } from "../src/core.js";
import { readEngineComparison } from "../src/engine-comparison-read.js";

function fixture(reply, vehicleKey = "is220d") {
  const sent = [];
  const client = new Elm327Client({ async send(command) { sent.push(command); return await reply(command); }, async disconnect() {} }, () => {}, () => {}, { wait: async () => {}, vehicleKey });
  client.connected = true;
  return { client, sent };
}
const probe = TOYOTA_READ_DATA_PROBES.find(p => p.command === "217E");
test("generic ELM discovers existing live values through exact raw fallback", async () => {
  const { client, sent } = fixture(c => c.startsWith("AT") ? "OK>" : c === "0100" ? "41 00 00 10 00 00>" : c === probe.rawCommand ? "7E8 06 61 7E 0A 04 02 00>" : c === "212C" ? "61 2C 00>" : "NO DATA>");
  const supported = await client.readSupportedPids();
  assert.ok(supported.has("dpnrDifferentialPressure"));
  assert.ok(supported.has("toyotaEgrPosition"));
  assert.ok(!supported.has("dpnrInletTemperature"));
  assert.equal(client.toyotaQueryForms.get("217E"), "raw-single-frame");
  client.toyotaResponseCache.clear();
  assert.ok((await client.readToyotaProbeResponse(probe)).decoded.complete);
  assert.equal(sent.filter(c => c === probe.rawCommand).length, 2);
  assert.ok(!sent.includes("219C"));
  assert.ok(client.discoveryDiagnostics.some(d => d.command === "217F" && d.error));
});
test("optional support page failure preserves first page but truncated first page fails", async () => {
  const { client } = fixture(c => c === "0100" ? "41 00 00 10 00 01>" : "NO DATA>", "auto");
  assert.ok((await client.readSupportedPids()).has(0x0c));
  assert.equal(client.discoveryDiagnostics[0].command, "0120");
  const bad = fixture(() => "41 00 00>", "auto").client;
  await assert.rejects(bad.readSupportedPids(), /puutteellinen/);
  assert.equal(bad.ecuConnected, false);
});
test("raw fallback restores adapter atomically before queued standard read", async () => {
  const { client, sent } = fixture(c => c.startsWith("AT") ? "OK>" : c === probe.rawCommand ? "61 7E 0A 04 02 00>" : "41 0C 10 00>");
  await Promise.all([client.readIs220dRawLiveProbe(probe), client.command("010C")]);
  assert.deepEqual(sent.slice(-6), ["ATCAF1", "ATCFC1", "ATH0", "ATS0", "ATCRA", "010C"]);
});
test("setup failure restores adapter and restoration failure blocks subsequent reads", async () => {
  const a = fixture(c => { if (c === "ATH1") throw new Error("setup failed"); return "OK>"; });
  await assert.rejects(a.client.readIs220dRawLiveProbe(probe), /setup failed/);
  assert.deepEqual(a.sent.slice(-5), ["ATCAF1", "ATCFC1", "ATH0", "ATS0", "ATCRA"]);
  const b = fixture(c => { if (c === "ATCAF1") throw new Error("restore failed"); return c.startsWith("AT") ? "OK>" : "NO DATA>"; });
  await assert.rejects(b.client.readIs220dRawLiveProbe(probe), { code: "ELM_RESTORE_FAILED" });
  const count = b.sent.length;
  await assert.rejects(b.client.command("010C"), { code: "ELM_RESTORE_FAILED" });
  assert.equal(b.sent.length, count);
});
test("raw fallback rejects unapproved probes and other vehicle profiles", async () => {
  const { client, sent } = fixture(() => "OK>");
  await assert.rejects(client.readIs220dRawLiveProbe({ command: "219C", rawCommand: "02219C0000000000" }));
  client.setVehicleKey("ct200h");
  await assert.rejects(client.readIs220dRawLiveProbe(probe));
  assert.deepEqual(sent, []);
});
test("explicit comparison reads only three existing queries and keeps absent values null", async () => {
  const { client, sent } = fixture(c => c.startsWith("AT") ? "OK>" : ({ "2193": "61 93 50>", "21AF": "61 AF 03 B6>" }[c] || "NO DATA>"));
  const results = await readEngineComparison(client);
  assert.deepEqual(sent.filter(c => !c.startsWith("AT")), ["2193", "2196", "21AF"]);
  assert.deepEqual(results.map(r => r.fields[0].value), [40, null, 5]);
  assert.equal(results[0].fields[0].status, "vertailtava Techstreamiin");
  assert.equal(results[1].fieldOutcome, "field-no-response");
  assert.match(results[1].evidence, /field-observed-no-response/);
  assert.equal(results[1].fields[0].status, "ECU ei palauttanut tietoa");
  assert.equal(client.toyotaLiveMetricIds.size, 0);
  const count = sent.length;
  client.binaryQuicklynks = true;
  await assert.rejects(readEngineComparison(client));
  assert.equal(sent.length, count);
});
