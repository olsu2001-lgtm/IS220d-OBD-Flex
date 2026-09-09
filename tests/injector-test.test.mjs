import test from "node:test";
import assert from "node:assert/strict";
import {
  INJECTOR_TEST_COMMANDS,
  INJECTOR_TEST_LIMITS,
  analyzeInjectorTest,
  buildInjectorTestReport,
  buildInjectorTestAnalysisPrompt
} from "../src/injector-test.js";

function sample(sequence, feedbackMm3, overrides = {}) {
  return {
    sequence,
    timestamp: Date.parse("2026-08-18T12:00:00.000Z") + sequence * 2500,
    elapsedMs: sequence * 2500,
    values: {
      rpm: 780 + (sequence % 3) * 5,
      coolantC: 86,
      fuelTemperatureC: 42,
      railPressureMpa: 40,
      feedbackMm3,
      ...overrides
    },
    raw: {
      rpm: "7E8 04 41 0C 0C 30\r>",
      coolant: "7E8 03 41 05 7E\r>",
      fuelTemperature: "7E8 03 61 93 52\r>",
      railPressure: "7E8 03 61 96 28\r>",
      feedback: "7E8 06 61 9C 46 3C 42 38\r>"
    },
    errors: {}
  };
}

function runWith(feedbackFactory, overridesFactory = () => ({})) {
  return {
    startedAt: Date.parse("2026-08-18T12:00:00.000Z"),
    endedAt: Date.parse("2026-08-18T12:00:45.000Z"),
    cancelled: false,
    meta: { appVersion: "0.7.7", reportId: "INJECTOR-TEST", vehicle: "Lexus IS220d · XE20", adapter: "vLinker MC+" },
    samples: Array.from({ length: 12 }, (_, index) => sample(index + 1, feedbackFactory(index), overridesFactory(index)))
  };
}

test("suutintesti pysyy vain lukevassa komentojoukossa", () => {
  assert.deepEqual(INJECTOR_TEST_COMMANDS.read, ["010C", "0105", "2193", "2196", "219C"]);
  assert.equal([...INJECTOR_TEST_COMMANDS.setup, ...INJECTOR_TEST_COMMANDS.read, ...INJECTOR_TEST_COMMANDS.restore]
    .some(command => /^(04|2E|2F|31|34|36)/.test(command)), false);
});

test("lämmin vakaa mittaus tavanomaisilla korjauksilla luokitellaan normaaliksi", () => {
  const run = runWith(index => [0.3 + index / 100, -0.4, 0.2, -0.1]);
  const analysis = analyzeInjectorTest(run);
  assert.equal(analysis.status, "normal");
  assert.equal(analysis.validSampleCount, 12);
  assert.equal(analysis.conditions.coolantWarm, true);
  assert.equal(analysis.conditions.idleStable, true);
  assert.equal(analysis.statistics.cylinders[0].count, 12);
});

test("jatkuva yli 4,9 mm³ korjaus luokitellaan selkeäksi poikkeamaksi", () => {
  const run = runWith(() => [5.4, -2.2, -1.6, -1.4]);
  const analysis = analyzeInjectorTest(run);
  assert.equal(analysis.status, "abnormal");
  assert.equal(analysis.statistics.cylinders[0].beyondServiceCount, 12);
});

test("kylmä tai epävakaa mittaus jää epätäydelliseksi poikkeavista arvoista huolimatta", () => {
  const run = runWith(() => [5.4, -2.2, -1.6, -1.4], index => ({ coolantC: 58, rpm: index % 2 ? 1250 : 650 }));
  const analysis = analyzeInjectorTest(run);
  assert.equal(analysis.status, "incomplete");
  assert.equal(analysis.conditions.coolantWarm, false);
  assert.equal(analysis.conditions.idleStable, false);
});

test("tekoälyraportti sisältää rajat, raakavastaukset ja diagnoosirajoituksen", () => {
  const run = runWith(() => [0.4, -0.3, 0.2, -0.1]);
  const analysis = analyzeInjectorTest(run);
  const report = buildInjectorTestReport(run, analysis);
  const prompt = buildInjectorTestAnalysisPrompt(run, analysis);
  assert.match(report, /BEGIN LEXUS OBD FLEX INJECTOR CONDITION REPORT/);
  assert.match(report, /-3\.0…\+3\.0 mm³/);
  assert.match(report, /4\.9 mm³/);
  assert.match(report, /raw_219c/);
  assert.match(report, /7E8 06 61 9C/);
  assert.match(report, /ei yksin osoita suuttimen sisäistä tai ulkoista polttoainevuotoa/i);
  assert.match(prompt, /Älä päättele pelkästä korjausarvosta/);
  assert.equal(INJECTOR_TEST_LIMITS.minimumValidSamples, 8);
});
