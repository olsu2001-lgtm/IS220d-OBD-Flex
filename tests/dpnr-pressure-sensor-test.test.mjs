import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assessDpnrPressureSensorTest,
  buildDpnrPressureSensorTestReport,
  medianDpnrTestValue,
  parseDpnrTestNumber,
  summarizeDpnrPressureSensorSamples
} from "../src/dpnr-pressure-sensor-test.js";
import {
  DPNR_PRESSURE_SENSOR_BUILD_MARKER,
  patchMainForDpnrPressureSensorTest
} from "../scripts/dpnr-pressure-sensor-main-transform.mjs";
import { patchMainForImReadiness } from "../scripts/im-readiness-main-transform.mjs";
import { patchMainForResponsiveness } from "../scripts/responsive-ui-transform.mjs";
import { patchMainForVLinkerRecovery } from "../scripts/vlinker-recovery-main-transform.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mainSource = fs.readFileSync(path.join(root, "src", "main.js"), "utf8");
const sensorSource = fs.readFileSync(path.join(root, "src", "dpnr-pressure-sensor-test.js"), "utf8");

function completeRun({ koeo = 0.1, idle = 0.7, rpm3000 = 3.4 } = {}) {
  return {
    phases: {
      koeo: { pressureMedianKpa: koeo, pressureMinKpa: koeo, pressureMaxKpa: koeo, rpmMedian: 0, sampleCount: 5, raw217eLast: "617E KOEO" },
      idle: { pressureMedianKpa: idle, pressureMinKpa: idle, pressureMaxKpa: idle, rpmMedian: 850, sampleCount: 6, raw217eLast: "617E IDLE" },
      rpm3000: { pressureMedianKpa: rpm3000, pressureMinKpa: rpm3000, pressureMaxKpa: rpm3000, rpmMedian: 3000, sampleCount: 6, raw217eLast: "617E 3000" }
    }
  };
}

test("DPF/DPNR sensor test number parsing and sample summary are deterministic", () => {
  assert.equal(parseDpnrTestNumber("-1,25 kPa"), -1.25);
  assert.equal(medianDpnrTestValue([3, 1, 2]), 2);
  const summary = summarizeDpnrPressureSensorSamples([
    { timestamp: 1, pressureKpa: 0.5, rpm: 2950, coolantC: 83, raw217e: "A" },
    { timestamp: 2, pressureKpa: 0.9, rpm: 3000, coolantC: 84, raw217e: "B" },
    { timestamp: 3, pressureKpa: 1.3, rpm: 3050, coolantC: 84, raw217e: "C" }
  ], "rpm3000");
  assert.equal(summary.pressureMedianKpa, 0.9);
  assert.equal(summary.rpmMedian, 3000);
  assert.equal(summary.raw217eLast, "C");
});

test("test remains incomplete until KOEO, idle and 3000 rpm are all measured", () => {
  const assessment = assessDpnrPressureSensorTest({ phases: { koeo: { pressureMedianKpa: 0.2 } } });
  assert.equal(assessment.status, "incomplete");
  assert.match(assessment.message, /kaikki kolme/i);
  assert.equal(assessDpnrPressureSensorTest(completeRun({ koeo: null, idle: null, rpm3000: null })).status, "incomplete");
});

test("negative 3000 rpm differential pressure is a GSIC P1426 strong deviation", () => {
  const assessment = assessDpnrPressureSensorTest(completeRun({ koeo: 0.1, idle: -0.2, rpm3000: -1.1 }));
  assert.equal(assessment.status, "strong-deviation");
  assert.match(assessment.message, /GSIC P1426/i);
  assert.match(assessment.message, /paineletku/i);
});

test("non-negative three-state result is evidence observed, not a fabricated sensor pass", () => {
  const assessment = assessDpnrPressureSensorTest(completeRun());
  assert.equal(assessment.status, "observed");
  assert.equal(assessment.rpm3000DeltaFromKoeoKpa, 3.3);
  assert.doesNotMatch(`${assessment.label} ${assessment.message}`, /anturi (?:on )?ehjä|PASS|hyväksytty/i);
  assert.match(assessment.message, /ei yksin todista anturia ehjäksi/i);
});

test("report preserves raw 217E evidence, deltas and read-only interpretation boundary", () => {
  const report = buildDpnrPressureSensorTestReport(completeRun());
  assert.match(report, /DPF\/DPNR paine-eroanturin toimintatarkistus/);
  assert.match(report, /Toyota 217E \+ OBD RPM · vain luku/);
  assert.match(report, /617E KOEO/);
  assert.match(report, /3000 rpm − KOEO/);
  assert.match(report, /ei keksi.*kPa-hyväksymisrajaa/i);
  assert.match(report, /ei suorita Active Testiä/i);
  assert.match(report, /ECU-kirjoituksia/i);
});

test("sensor test starts existing DPNR live UI when needed but implements no transport commands", () => {
  for (const forbidden of [".send(", "sendCommand(", "ATSH", "ATSP", "02217E", "Mode 04", "clearDtc", "regenerate("]) {
    assert.equal(sensorSource.includes(forbidden), false, `sensor UI must not contain transport token ${forbidden}`);
  }
  assert.match(sensorSource, /collectDpnrTestPhase\(phase, status\)/);
});

test("APK build transform imports sensor test and auto-starts read-only live only with engine ECU connected", () => {
  const transformed = patchMainForDpnrPressureSensorTest(
    patchMainForVLinkerRecovery(
      patchMainForResponsiveness(
        patchMainForImReadiness(mainSource)
      )
    )
  );
  assert.match(transformed, /import "\.\/dpnr-pressure-sensor-test\.js";/);
  assert.match(transformed, new RegExp(DPNR_PRESSURE_SENSOR_BUILD_MARKER));
  assert.equal((transformed.match(/dpnr-pressure-sensor-test\.js/g) || []).length, 1);
  assert.match(transformed, /state\.vehicleKey === VEHICLE_KEYS\.IS220D/);
  assert.match(transformed, /state\.connected/);
  assert.match(transformed, /state\.ecuConnected/);
  assert.match(transformed, /!state\.liveActive/);
  assert.match(transformed, /!state\.quicklynks/);
  assert.match(transformed, /void startLive\(\)/);
  assert.equal(patchMainForDpnrPressureSensorTest(transformed), transformed);
});

test("DPNR pressure sensor build transform fails closed if required main anchors change", () => {
  assert.throws(
    () => patchMainForDpnrPressureSensorTest("console.log('no app version import')"),
    /anchor missing|ambiguous/i
  );
  assert.throws(
    () => patchMainForDpnrPressureSensorTest(mainSource.replace('  if (name === "dpnr") requestAnimationFrame(renderDpnrMonitor);', "")),
    /DPNR page navigation anchor missing|ambiguous/i
  );
});
