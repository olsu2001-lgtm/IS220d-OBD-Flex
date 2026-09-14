import test from "node:test";
import assert from "node:assert/strict";
import {
  DPNR_CLEANING_STAGES,
  decodeDpnrCleaningSample,
  summarizeDpnrCleaningStage,
  compareDpnrCleaningRuns,
  buildDpnrCleaningReport
} from "../src/dpnr-cleaning-test.js";

function sample(rpm, pressureKpa, regenerationActive = false) {
  return { rpm, pressureKpa, regenerationActive };
}

function stage(stageId, rpm, pressureKpa, regenerationActive = false) {
  return summarizeDpnrCleaningStage(stageId, [
    sample(rpm - 5, pressureKpa - 0.02, regenerationActive),
    sample(rpm, pressureKpa, regenerationActive),
    sample(rpm + 5, pressureKpa + 0.02, regenerationActive)
  ]);
}

function run(koeo, idle, rpm3000) {
  return { schemaVersion: 1, stages: { koeo, idle, rpm3000 } };
}

test("DPNR-puhdistustestin kolme vaihetta ovat GSIC-järjestyksessä", () => {
  assert.deepEqual(DPNR_CLEANING_STAGES.map(item => item.id), ["koeo", "idle", "rpm3000"]);
  assert.equal(DPNR_CLEANING_STAGES[0].rpmMax, 50);
  assert.equal(DPNR_CLEANING_STAGES[2].rpmMin, 2700);
  assert.equal(DPNR_CLEANING_STAGES[2].rpmMax, 3300);
});

test("217E ja 010C puretaan samaan DPNR-näytteeseen", () => {
  const decoded = decodeDpnrCleaningSample({
    rpmRaw: "41 0C 2E E0",
    dpnrRaw: "61 7E 05 02 00 00"
  });
  assert.equal(decoded.rpm, 3000);
  assert.ok(Math.abs(decoded.pressureKpa) < 0.01);
  assert.equal(decoded.regenerationActive, false);
  assert.equal(decoded.complete, true);
});

test("vaihe käyttää mediaania ja hylkää väärän kierroslukuolosuhteen", () => {
  const valid = summarizeDpnrCleaningStage("rpm3000", [
    sample(2990, 1.8), sample(3000, 2.0), sample(3010, 2.2)
  ]);
  assert.equal(valid.rpm, 3000);
  assert.equal(valid.pressureKpa, 2);
  assert.equal(valid.conditionOk, true);

  const invalid = summarizeDpnrCleaningStage("rpm3000", [
    sample(1500, 1), sample(1510, 1.1), sample(1520, 1.2)
  ]);
  assert.equal(invalid.conditionOk, false);
});

test("ennen/jälkeen tunnistaa negatiivisen 3000 rpm -lukeman korjaantumisen", () => {
  const before = run(stage("koeo", 0, -0.4), stage("idle", 900, -0.8), stage("rpm3000", 3000, -2.2));
  const after = run(stage("koeo", 0, -0.05), stage("idle", 900, 0.4), stage("rpm3000", 3000, 2.1));
  const comparison = compareDpnrCleaningRuns(before, after);
  assert.equal(comparison.complete, true);
  assert.ok(comparison.findings.some(item => item.includes("negatiivinen paine-ero muuttui")));
  assert.ok(comparison.findings.some(item => item.includes("lähemmäs nollaa")));
  assert.ok(comparison.findings.some(item => item.includes("kasvaa tyhjäkäynniltä")));
});

test("jälkeen jäävä negatiivinen 3000 rpm -arvo tuottaa GSIC-havainnon", () => {
  const before = run(stage("koeo", 0, -0.2), stage("idle", 900, -0.6), stage("rpm3000", 3000, -1.8));
  const after = run(stage("koeo", 0, -0.1), stage("idle", 900, -0.5), stage("rpm3000", 3000, -1.2));
  const comparison = compareDpnrCleaningRuns(before, after);
  assert.ok(comparison.findings.some(item => item.includes("edelleen negatiivinen")));
  assert.ok(comparison.findings.some(item => item.includes("transmitting pipe")));
});

test("raportti ei keksi DPNR:n tukkeutumiselle kPa-raja-arvoa", () => {
  const before = run(stage("koeo", 0, -0.3), stage("idle", 900, 0.2), stage("rpm3000", 3000, 1.5));
  const after = run(stage("koeo", 0, -0.1), stage("idle", 900, 0.3), stage("rpm3000", 3000, 1.8));
  const report = buildDpnrCleaningReport({ before, after, appVersion: "0.9.0", createdAt: 0 });
  assert.match(report, /ENNEN/);
  assert.match(report, /JÄLKEEN/);
  assert.match(report, /GSIC P1426\/P2002/);
  assert.match(report, /ei päättele DPNR:n tukkeutumisastetta keksityllä kPa-raja-arvolla/);
});
