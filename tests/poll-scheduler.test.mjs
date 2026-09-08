import test from "node:test";
import assert from "node:assert/strict";

import {
  AdaptivePollScheduler,
  buildAdaptivePollPlan,
  pollSourceForDefinition
} from "../src/poll-scheduler.js";
import {
  Elm327Client,
  PID_BY_ID
} from "../src/core.js";

test("pollaussuunnitelma yhdistää saman Mode 01 PIDin ja Toyota-pyynnön yhdeksi lähteeksi", () => {
  const definitions = [
    PID_BY_ID.rpm,
    PID_BY_ID.egrPositionTarget,
    PID_BY_ID.egrPositionActual,
    PID_BY_ID.egrPositionError,
    PID_BY_ID.dpnrDifferentialPressure,
    PID_BY_ID.dpnrRegenerationActive,
    PID_BY_ID.boostPressure
  ];
  const supported = new Set([
    0x0c,
    0x69,
    "dpnrDifferentialPressure",
    "dpnrRegenerationActive"
  ]);
  const plan = buildAdaptivePollPlan(definitions, supported);
  assert.deepEqual(plan.map(source => source.key), ["mode01:0C", "toyota:217E", "mode01:69"]);
  assert.deepEqual(plan.find(source => source.key === "mode01:69").metricIds, [
    "egrPositionTarget",
    "egrPositionActual",
    "egrPositionError"
  ]);
  assert.deepEqual(plan.find(source => source.key === "toyota:217E").metricIds, [
    "dpnrDifferentialPressure",
    "dpnrRegenerationActive"
  ]);
  assert.equal(plan.some(source => source.metricIds.includes("boostPressure")), false);
});

test("dynaamiset arvot saavat lämpötiloja nopeamman pollausvälin", () => {
  assert.equal(pollSourceForDefinition(PID_BY_ID.rpm).intervalMs, 250);
  assert.equal(pollSourceForDefinition(PID_BY_ID.map).intervalMs, 500);
  assert.equal(pollSourceForDefinition(PID_BY_ID.coolant).intervalMs, 5000);
  assert.equal(pollSourceForDefinition(PID_BY_ID.milOn).intervalMs, 15000);
  assert.equal(pollSourceForDefinition(PID_BY_ID.dpnrInletTemperature).intervalMs, 1400);
});

test("ajoitin on oikeudenmukainen: vanha hidas lähde ohittaa uudelleen jonotetun nopean lähteen", () => {
  let now = 1000;
  const scheduler = new AdaptivePollScheduler([PID_BY_ID.rpm, PID_BY_ID.coolant], {
    clock: () => now,
    startedAt: now,
    maximumBatchSources: 1
  });
  const first = scheduler.claimDueBatch();
  assert.equal(first[0].key, "mode01:0C");
  now = 1010;
  scheduler.recordSuccess(first[0].key, 10, now);
  const second = scheduler.claimDueBatch();
  assert.equal(second[0].key, "mode01:05");
});

test("onnistumiset laskevat vaste-EWMA:n ja adaptiivinen aikakatkaisu ei käynnisty liian aikaisin", () => {
  let now = 0;
  const scheduler = new AdaptivePollScheduler([PID_BY_ID.rpm], { clock: () => now, startedAt: now });
  assert.equal(scheduler.recommendedTimeoutMs("mode01:0C"), 2200);
  for (const duration of [100, 120, 80]) {
    const [source] = scheduler.claimDueBatch(now);
    assert.equal(source.key, "mode01:0C");
    now += duration;
    scheduler.recordSuccess(source.key, duration, now);
    now += 250;
  }
  assert.equal(scheduler.recommendedTimeoutMs("mode01:0C"), 1100);
  const snapshot = scheduler.snapshot(now);
  assert.equal(snapshot.summary.hits, 3);
  assert.equal(snapshot.summary.misses, 0);
  assert.ok(snapshot.sources[0].latencyEwmaMs > 90 && snapshot.sources[0].latencyEwmaMs < 110);
});

test("välimuistiosuma ajoitetaan mutta sitä ei lasketa fyysiseksi pyyntöyritykseksi", () => {
  const scheduler = new AdaptivePollScheduler([PID_BY_ID.dpnrDifferentialPressure], { startedAt: 0, clock: () => 0 });
  const [source] = scheduler.claimDueBatch(0);
  scheduler.recordCacheHit(source.key, 5);
  const snapshot = scheduler.snapshot(5);
  assert.equal(snapshot.summary.cacheHits, 1);
  assert.equal(snapshot.summary.attempts, 0);
  assert.equal(snapshot.sources[0].nextDueInMs, 700);
});

test("virhepolku käyttää response pending-, retryable- ja ei-uusittavaa backoffia", () => {
  const pending = new AdaptivePollScheduler([PID_BY_ID.rpm], { startedAt: 0, clock: () => 0 });
  pending.claimDueBatch(0);
  assert.equal(pending.recordFailure("mode01:0C", { responseClass: "response-pending", retryable: true }, 50, 10), 250);

  const retryable = new AdaptivePollScheduler([PID_BY_ID.rpm], { startedAt: 0, clock: () => 0 });
  retryable.claimDueBatch(0);
  assert.equal(retryable.recordFailure("mode01:0C", { responseClass: "timeout", retryable: true }, 2200, 10), 500);
  retryable.claimDueBatch(510);
  assert.equal(retryable.recordFailure("mode01:0C", { responseClass: "timeout", retryable: true }, 2200, 520), 1000);
  assert.equal(retryable.recommendedTimeoutMs("mode01:0C"), 2200);
  retryable.claimDueBatch(1520);
  retryable.recordSuccess("mode01:0C", 90, 1610);
  assert.equal(retryable.recommendedTimeoutMs("mode01:0C"), 2200);

  const refused = new AdaptivePollScheduler([PID_BY_ID.rpm], { startedAt: 0, clock: () => 0 });
  refused.claimDueBatch(0);
  assert.equal(refused.recordFailure("mode01:0C", { responseClass: "negative-response", retryable: false }, 100, 10), 5000);
  const summary = retryable.snapshot(1610).summary;
  assert.equal(summary.attempts, 3);
  assert.equal(summary.hits, 1);
  assert.equal(summary.misses, 2);
  assert.ok(Math.abs(summary.lossPercent - 66.6667) < 0.001);
  assert.equal(summary.maxMissStreak, 2);
});

test("Elm327 lukee saman Mode 01 PIDin kerran ja jakaa vastauksen kaikille mittareille", async () => {
  const commands = [];
  const client = new Elm327Client({
    async send(command) {
      commands.push(command);
      return "7E8 06 41 69 00 80 7F 00\r>";
    },
    async disconnect() {}
  }, () => {}, () => {}, { wait: async () => {} });
  const group = await client.readMetricGroup([
    PID_BY_ID.egrPositionTarget,
    PID_BY_ID.egrPositionActual,
    PID_BY_ID.egrPositionError
  ], 1400);
  assert.deepEqual(commands, ["0169"]);
  assert.equal(group.results.length, 3);
  assert.deepEqual(group.results.map(result => result.definition.id), [
    "egrPositionTarget",
    "egrPositionActual",
    "egrPositionError"
  ]);
});

test("Elm327 lukee Toyota 217E -ryhmän kerran, validoi arvot ja säilyttää atomisen otsakkeen", async () => {
  const commands = [];
  const client = new Elm327Client({
    async send(command) {
      commands.push(command);
      if (command.startsWith("AT")) return "OK\r>";
      if (command === "217E") return "7E8 06 61 7E 0A 04 02 00\r>";
      return "NO DATA\r>";
    },
    async disconnect() {}
  }, () => {}, () => {}, { wait: async () => {} });
  client.toyotaLiveMetricIds = new Set([
    "dpnrDifferentialPressure",
    "dpnrSulfurRegenerationState",
    "dpnrPmRegenerationState",
    "dpnrRegenerationActive"
  ]);
  const group = await client.readMetricGroup([
    PID_BY_ID.dpnrDifferentialPressure,
    PID_BY_ID.dpnrSulfurRegenerationState,
    PID_BY_ID.dpnrPmRegenerationState,
    PID_BY_ID.dpnrRegenerationActive
  ], 3000);
  assert.deepEqual(commands, ["ATCRA", "ATSH7E0", "217E"]);
  assert.equal(group.results.length, 4);
  assert.equal(group.results.find(result => result.definition.id === "dpnrRegenerationActive").value, 1);
  assert.ok(group.results.find(result => result.definition.id === "dpnrDifferentialPressure").value > 4);
});

test("Toyota-profiilin järkevyysraja estää vioittuneen live-arvon julkaisemisen", async () => {
  const client = new Elm327Client({
    async send(command) {
      if (command.startsWith("AT")) return "OK\r>";
      if (command === "217F") return "7E8 06 61 7F FF FF 00 01\r>";
      return "NO DATA\r>";
    },
    async disconnect() {}
  }, () => {}, () => {}, { wait: async () => {} });
  client.toyotaLiveMetricIds = new Set(["dpnrInletTemperature", "dpnrOutletTemperature"]);
  await assert.rejects(
    client.readMetricGroup([PID_BY_ID.dpnrInletTemperature, PID_BY_ID.dpnrOutletTemperature], 3000),
    error => {
      assert.equal(error.code, "IMPLAUSIBLE_VALUE");
      assert.equal(error.metricId, "dpnrInletTemperature");
      assert.match(error.message, /järkevyysalueen -40…1200 ulkopuolella/);
      assert.match(error.raw, /61 7F/);
      return true;
    }
  );
});
