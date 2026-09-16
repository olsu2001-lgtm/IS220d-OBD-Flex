import test from "node:test";
import assert from "node:assert/strict";
import { collectDpnrTestPhase, isFreshDpnrTestSample } from "../src/dpnr-test-live.js";

function rig(overrides = {}) {
  let time = 10000, starts = 0;
  const options = {
    now: () => time,
    wait: async ms => { time += ms; },
    adapter: {
      available: () => true, running: () => true,
      start: () => { starts++; },
      read: () => ({ pressureKpa: 0.0023, rpm: 0, coolantC: 80,
        timestamp: Math.floor(time / 600) * 600, rpmUpdatedAt: time,
        raw217e: "61 7E 05 02 00 00" }),
      ...overrides
    }
  };
  return { options, starts: () => starts, time: () => time };
}
const koeo = { id: "koeo", label: "KOEO", durationMs: 5000, rpmMax: 80 };
const idle = { id: "idle", label: "Tyhjäkäynti", durationMs: 5000, rpmMin: 500, rpmMax: 1600 };

test("legacy live path can start live and collect distinct decoded ECU updates, including unchanged values", async () => {
  const r = rig();
  const samples = await collectDpnrTestPhase(koeo, {}, r.options);
  assert.equal(r.starts(), 1);
  assert.ok(samples.length > 2 && samples.length < 15);
  assert.equal(new Set(samples.map(s => s.timestamp)).size, samples.length);
  assert.equal(samples[0].pressureKpa, 0.0023, "retain decoder precision, not display rounding");
});

test("dedicated capture path does not require generic live polling and KOEO tolerates missing Mode 01 RPM", async () => {
  let captures = 0;
  const r = rig({
    running: () => false,
    start: () => { throw new Error("generic live must not be started"); },
    capture: async () => {
      captures += 1;
      return {
        pressureKpa: 0.12,
        rpm: NaN,
        rpmUpdatedAt: NaN,
        coolantC: NaN,
        timestamp: 10000 + captures * 600,
        raw217e: "7E8 06 61 7E 05 20 00 00"
      };
    }
  });
  const samples = await collectDpnrTestPhase(koeo, {}, r.options);
  assert.equal(r.starts(), 0);
  assert.ok(captures >= 2);
  assert.ok(samples.length >= 2);
  assert.ok(samples.every(sample => sample.raw217e.includes("61 7E")));
});

test("frozen display, echoed request and missing pressure never become a saved measurement", async () => {
  for (const change of [s => ({ ...s, timestamp: 10000 }),
    s => ({ ...s, raw217e: "217E" }), s => ({ ...s, pressureKpa: null })]) {
    const r = rig(); const original = r.options.adapter.read;
    r.options.adapter.read = () => change(original());
    await assert.rejects(collectDpnrTestPhase(koeo, {}, r.options));
  }
});

test("running-engine phases still require fresh RPM evidence", async () => {
  for (const change of [s => ({ ...s, rpm: undefined }), s => ({ ...s, rpmUpdatedAt: 0 })]) {
    const r = rig(); const original = r.options.adapter.read;
    r.options.adapter.read = () => change({ ...original(), rpm: 850 });
    await assert.rejects(collectDpnrTestPhase(idle, {}, r.options));
  }
});

test("freshness expires with wall clock even if the UI stops repainting", () => {
  const s = { pressureKpa: 0, timestamp: 10000, raw217e: "617E05020000" };
  assert.equal(isFreshDpnrTestSample(s, 10000), true);
  assert.equal(isFreshDpnrTestSample(s, 12501), false);
  assert.equal(isFreshDpnrTestSample(s, 9999), false);
});

test("disconnect, stop, navigation/profile change and leaving the RPM range discard legacy capture", async () => {
  for (const kind of ["available", "running", "rpm"]) {
    const r = rig(); const original = r.options.adapter.read;
    if (kind === "rpm") r.options.adapter.read = () => ({ ...original(), rpm: r.time() > 12000 ? 900 : 0 });
    else r.options.adapter[kind] = () => r.time() <= 12000;
    await assert.rejects(collectDpnrTestPhase(koeo, {}, r.options), /keskeytyi|kierrosluku/);
  }
});

test("slow supported-PID discovery is allowed, concurrent capture is refused, failures release lock", async () => {
  const r = rig(); const original = r.options.adapter.read;
  r.options.adapter.read = () => r.time() < 30000 ? null : original();
  const pending = collectDpnrTestPhase(koeo, {}, r.options);
  await assert.rejects(collectDpnrTestPhase(koeo, {}, r.options), /Toinen/);
  assert.ok((await pending).length > 1);
  assert.ok(r.time() >= 35000);
  await assert.rejects(collectDpnrTestPhase(koeo, {}, rig({ available: () => false }).options), /Yhdistä/);
  assert.ok((await collectDpnrTestPhase(koeo, {}, rig().options)).length > 1);
});
