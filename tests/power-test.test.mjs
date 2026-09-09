import test from "node:test";
import assert from "node:assert/strict";
import {
  POWER_TEST_SCHEMA,
  VEHICLE_POWER_DEFAULTS,
  NativePowerGpsSource,
  analyzePowerTestRun,
  buildPowerTestReport,
  comparePowerTestRuns,
  createPowerTestRun,
  ingestPowerTestSample,
  normalizePowerGpsSample,
  powerTestToCsv,
  resolvePowerTestSettings
} from "../src/power-test.js";

function gps(monotonicMs, speedKmh, extra = {}) {
  return {
    elapsedRealtimeNanos: monotonicMs * 1e6,
    timestampMs: 1_800_000_000_000 + monotonicMs,
    speedMps: speedKmh / 3.6,
    speedAccuracyMps: 0.2,
    horizontalAccuracyM: 4,
    altitudeM: 20,
    verticalAccuracyM: 5,
    bearingDeg: 90,
    bearingAccuracyDeg: 3,
    provider: "gps",
    ...extra
  };
}

function completeZero100({ durationSeconds = 10, frequencyHz = 10, vehicleKey = "is220d" } = {}) {
  const run = createPowerTestRun({ presetId: "zero100", vehicleKey }, { appVersion: "0.7.3", id: `run-${durationSeconds}-${frequencyHz}` });
  const stepMs = 1000 / frequencyHz;
  for (let time = 1000; time <= 6000; time += stepMs) {
    ingestPowerTestSample(run, gps(time, 0), { speed: 0, rpm: 800, load: 20 });
  }
  assert.equal(run.status, "armed");
  const startMs = 6100;
  for (let index = 0; index <= Math.ceil(durationSeconds * frequencyHz) + 2; index++) {
    const elapsedSeconds = index / frequencyHz;
    const speedKmh = Math.min(103, elapsedSeconds / durationSeconds * 100);
    ingestPowerTestSample(run, gps(startMs + index * stepMs, speedKmh), {
      speed: Math.round(speedKmh),
      rpm: 900 + speedKmh * 30,
      load: 85,
      pedal: 95,
      maf: 20 + speedKmh * 0.8
    });
  }
  assert.equal(run.status, "complete");
  return run;
}

test("tehotestin ajoneuvo-oletukset säilyttävät IS220d- ja CT-järjestelmävertailun erillään", () => {
  assert.equal(VEHICLE_POWER_DEFAULTS.is220d.referencePowerKw, 130);
  assert.equal(VEHICLE_POWER_DEFAULTS.is220d.referenceZero100Seconds, 8.9);
  assert.equal(VEHICLE_POWER_DEFAULTS.ct200h.referencePowerKw, 100);
  assert.equal(VEHICLE_POWER_DEFAULTS.ct200h.referenceZero100Seconds, 10.3);
  assert.equal(resolvePowerTestSettings({ vehicleKey: "ct200h" }).powerLabel, "järjestelmäteho");
});

test("Androidin monotoniaika ja GPS-nopeus normalisoidaan ilman sijaintikoordinaatteja", () => {
  const sample = normalizePowerGpsSample(gps(12345, 72, { latitude: 60.1, longitude: 22.3 }));
  assert.equal(sample.monotonicMs, 12345);
  assert.equal(sample.speedKmh, 72);
  assert.equal(sample.horizontalAccuracyM, 4);
  assert.equal("latitude" in sample, false);
  assert.equal("longitude" in sample, false);
});

test("0–100-ajanotto virittyy paikallaan ja interpoloi väliajat", () => {
  const run = completeZero100({ durationSeconds: 10, frequencyHz: 10 });
  assert.equal(run.schemaVersion, POWER_TEST_SCHEMA);
  assert.ok(Math.abs(run.result.elapsedSeconds - 9.95) < 0.08, `aika ${run.result.elapsedSeconds}`);
  const targets = run.result.splits.map(split => Math.round(split.targetKmh));
  assert.deepEqual(targets, [50, 60, 80, 97, 100]);
  assert.ok(Math.abs(run.result.splits.find(split => split.targetKmh === 50).elapsedSeconds - 4.95) < 0.08);
  assert.equal(run.result.quality.confidence, "high");
  assert.equal(run.result.valid, true);
});

test("80–120-ajanotto alkaa ja päättyy rajanopeuden interpoloituun ylitykseen", () => {
  const run = createPowerTestRun({ presetId: "eighty120", vehicleKey: "is220d" }, { appVersion: "0.7.3" });
  for (const [time, speed] of [[0, 60], [200, 65], [400, 70], [600, 75], [800, 79], [1000, 83], [1200, 90], [1400, 100], [1600, 110], [1800, 121]]) {
    ingestPowerTestSample(run, gps(time + 1000, speed), { speed: Math.round(speed), rpm: 2200 + speed * 8, load: 90 });
  }
  assert.equal(run.status, "complete");
  assert.ok(Math.abs(run.result.elapsedSeconds - 0.95) < 0.05, `aika ${run.result.elapsedSeconds}`);
  assert.deepEqual(run.result.splits.map(split => split.targetKmh), [100, 120]);
});

test("tehoarvio raportoi pyörä- ja häviökorjatun tehon eri lukuina", () => {
  const run = completeZero100({ durationSeconds: 9, frequencyHz: 10 });
  const result = analyzePowerTestRun(run);
  assert.ok(result.averageWheelPowerKw > 0);
  assert.ok(result.peakWheelPowerKw > result.averageWheelPowerKw);
  assert.ok(result.peakSystemPowerKw > result.peakWheelPowerKw);
  assert.ok(result.referencePowerPercent > 0);
  assert.ok(result.environment.dragEnergyKj > 0);
  assert.match(result.warnings.join(" "), /dynamometrimittausta/);
});

test("heikko 1 Hz GPS jää matalan luottamuksen tulokseksi", () => {
  const run = completeZero100({ durationSeconds: 12, frequencyHz: 1 });
  assert.equal(run.result.quality.confidence, "low");
  assert.equal(run.result.valid, false);
  assert.match(run.result.quality.warnings.join(" "), /näytetaajuus/);
});

test("valesijaintinäyte pysäyttää tehotestin", () => {
  const run = createPowerTestRun({ presetId: "zero100", vehicleKey: "is220d" });
  const event = ingestPowerTestSample(run, gps(1000, 0, { mock: true }));
  assert.equal(event.type, "aborted");
  assert.equal(run.status, "aborted");
  assert.match(run.abortReason, /valesijainniksi/);
});

test("raportti ja CSV säilyttävät laadun, oletukset ja raakadatan mutta eivät reittiä", () => {
  const run = completeZero100({ durationSeconds: 10, frequencyHz: 5, vehicleKey: "ct200h" });
  const report = buildPowerTestReport(run);
  const csv = powerTestToCsv(run);
  assert.match(report, /BEGIN LEXUS OBD FLEX POWER TEST REPORT/);
  assert.match(report, /Raporttimuoto: lexus-power-test-v1/);
  assert.match(report, /KIIHTYVYYS/);
  assert.match(report, /TEHOARVIO/);
  assert.match(report, /järjestelmätehoarvio/);
  assert.match(report, /GPS_SAMPLE_TSV_BEGIN/);
  assert.doesNotMatch(report, /latitude|longitude|60\.1|22\.3/i);
  assert.match(csv, /gps_speed_kmh/);
  assert.match(csv, /estimated_peak_system_kw/);
  assert.doesNotMatch(csv, /latitude|longitude/i);
});

test("vertailu käyttää vain saman ajoneuvon ja saman testivälin aiempia vetoja", () => {
  const first = completeZero100({ durationSeconds: 10, frequencyHz: 5 });
  const second = completeZero100({ durationSeconds: 11, frequencyHz: 5 });
  const ct = completeZero100({ durationSeconds: 12, frequencyHz: 5, vehicleKey: "ct200h" });
  const comparison = comparePowerTestRuns([first, second, ct], second);
  assert.equal(comparison.count, 1);
  assert.ok(comparison.bestSeconds < 10.1);
});

test("natiivi GPS-lähde tyhjentää Android-jonon ja pysähtyy", async () => {
  let stopped = 0;
  const bridge = {
    start: () => "OK",
    drainSamples: () => JSON.stringify([gps(1000, 10)]),
    stop: () => { stopped++; },
    getLastError: () => ""
  };
  const source = new NativePowerGpsSource(bridge, null);
  const samples = [];
  const info = await source.start(sample => samples.push(sample));
  source.drainNative();
  source.stop();
  assert.equal(info.source, "android-location-gps");
  assert.equal(samples.length, 1);
  assert.ok(stopped >= 1);
});
