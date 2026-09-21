import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  TECHSTREAM_DATA_LIST_GAP_TARGETS,
  analyzeTechstreamDataListTrace,
  buildTechstreamDataListCaptureTemplate,
  buildTechstreamDataListGapTextReport
} from "../src/techstream-data-list-gap.js";

test("declares DPF and EGR as primary Techstream capture targets without raw-command guesses", () => {
  const labels = TECHSTREAM_DATA_LIST_GAP_TARGETS.map(item => item.label);
  assert.deepEqual(labels.slice(0, 2), ["DPF Differential Pressure", "EGR Lift Sensor Output"]);
  assert.equal(TECHSTREAM_DATA_LIST_GAP_TARGETS[0].unit, "kPa");
  assert.equal(TECHSTREAM_DATA_LIST_GAP_TARGETS[1].unit, "%");
  for (const target of TECHSTREAM_DATA_LIST_GAP_TARGETS) {
    assert.equal(target.status, "capture-required");
    assert.equal(target.rawTransaction, null);
  }
  assert.deepEqual(TECHSTREAM_DATA_LIST_GAP_TARGETS.find(item => item.id === "injector-feedback-1-4").rejectedCommands, ["219C"]);
});

test("passive trace analysis finds unknown 21xx/61xx pairs but separates current and rejected commands", () => {
  const trace = [
    "TX 7E0 02 21 AB 00 00 00 00 00",
    "RX 7E8 06 61 AB 01 02 03 04 05",
    "TX 7E0 02 21 AB 00 00 00 00 00",
    "RX 7E8 06 61 AB 01 02 03 04 06",
    "TX 7E0 02 21 9C 00 00 00 00 00",
    "RX 7E8 06 61 9C 10 11 12 13 14",
    "TX 7E0 02 21 7E 00 00 00 00 00",
    "RX 7E8 06 61 7E AA BB CC DD EE"
  ].join("\n");
  const result = analyzeTechstreamDataListTrace(trace);
  assert.equal(result.authorizationChanged, false);
  assert.equal(result.vehicleCommandSent, false);
  assert.equal(result.pairCount, 4);
  assert.equal(result.candidateCount, 1);
  assert.equal(result.candidates[0].command, "21AB");
  assert.equal(result.candidates[0].responsePrefix, "61AB");
  assert.equal(result.candidates[0].observations, 2);
  assert.equal(result.candidates[0].distinctPayloadCount, 2);
  assert.equal(result.candidates[0].captures.length, 2);
  assert.equal(result.rejected[0].command, "219C");
  assert.equal(result.rejected[0].status, "field-rejected");
  assert.equal(result.existing[0].command, "217E");
  assert.equal(result.existing[0].status, "current-production");
});

test("passive parser accepts J2534-style 4-byte CAN identifiers and read/write context", () => {
  const trace = [
    "PassThruWriteMsgs(ChannelID=1)",
    "data = { 00 00 07 E0 02 21 A1 00 00 00 00 00 }",
    "PassThruReadMsgs(ChannelID=1)",
    "time stamp = 1200 data = { 00 00 07 E8 06 61 A1 12 34 56 78 9A }"
  ].join("\n");
  const result = analyzeTechstreamDataListTrace(trace);
  assert.equal(result.candidateCount, 1);
  assert.equal(result.candidates[0].command, "21A1");
  assert.equal(result.candidates[0].captures[0].payloadHex, "123456789A");
});

test("passive parser catalogs UDS 22/62 reads without authorizing them", () => {
  const result = analyzeTechstreamDataListTrace([
    "TX 7E0 03 22 F1 90 00 00 00 00",
    "RX 7E8 07 62 F1 90 41 42 43 44"
  ].join("\n"));
  assert.equal(result.candidates[0].command, "22F190");
  assert.equal(result.candidates[0].responsePrefix, "62F190");
  assert.equal(result.authorizationChanged, false);
});

test("response without a preceding matching request is not promoted to a candidate", () => {
  const result = analyzeTechstreamDataListTrace("RX 7E8 06 61 AA 01 02 03 04 05");
  assert.equal(result.candidateCount, 0);
  assert.equal(result.unmatchedResponseCount, 1);
});

test("capture template names DPF/EGR reference values and target calibration", () => {
  const template = JSON.parse(buildTechstreamDataListCaptureTemplate());
  assert.equal(template.calibrationId, "35360000");
  assert.equal(template.techstreamValues.dpfDifferentialPressureKpa, null);
  assert.equal(template.techstreamValues.egrLiftSensorPercent, null);
  assert.equal(template.techstreamValues.engineSpeedRpm, null);
  assert.equal(template.techstreamValues.mafGps, null);
});

test("report preserves current-command uncertainty and rejected 219C boundary", () => {
  const analysis = analyzeTechstreamDataListTrace([
    "7E0 02 21 2C 00 00 00 00 00",
    "7E8 03 61 2C 10 00 00 00 00",
    "7E0 02 21 9C 00 00 00 00 00",
    "7E8 06 61 9C 01 02 03 04 05"
  ].join("\n"));
  const report = buildTechstreamDataListGapTextReport(analysis);
  assert.match(report, /CURRENT 212C/);
  assert.match(report, /not proof of target-value semantics/);
  assert.match(report, /BLOCKED 219C/);
  assert.match(report, /no vehicle command is authorized or transmitted/);
});

test("capture modules contain no vehicle transport path", () => {
  const core = fs.readFileSync(new URL("../src/techstream-data-list-gap.js", import.meta.url), "utf8");
  const ui = fs.readFileSync(new URL("../src/techstream-data-list-gap-ui.js", import.meta.url), "utf8");
  for (const source of [core, ui]) {
    assert.doesNotMatch(source, /state\.client|safeCommand\s*\(|\.send\s*\(|\.command\s*\(|NativeElmTransport|ATSH|ATCRA/i);
  }
});


test("passive parser reassembles ISO-TP multi-frame Data List responses", () => {
  const trace = [
    "TX 7E0 02 21 A1 00 00 00 00 00",
    "RX 7E8 10 0A 61 A1 01 02 03 04",
    "RX 7E8 21 05 06 07 08 00 00 00"
  ].join("\n");
  const result = analyzeTechstreamDataListTrace(trace);
  assert.equal(result.pairCount, 1);
  assert.equal(result.candidateCount, 1);
  assert.equal(result.candidates[0].command, "21A1");
  assert.equal(result.candidates[0].captures[0].payloadHex, "0102030405060708");
  assert.deepEqual(result.candidates[0].payloadLengths, [8]);
  assert.equal(result.isoTpIncompleteCount, 0);
  assert.equal(result.isoTpSequenceErrorCount, 0);
});

test("broken ISO-TP sequence fails closed instead of correlating a partial response", () => {
  const trace = [
    "TX 7E0 02 21 A1 00 00 00 00 00",
    "RX 7E8 10 0A 61 A1 01 02 03 04",
    "RX 7E8 22 05 06 07 08 00 00 00"
  ].join("\n");
  const result = analyzeTechstreamDataListTrace(trace);
  assert.equal(result.pairCount, 0);
  assert.equal(result.candidateCount, 0);
  assert.equal(result.isoTpSequenceErrorCount, 1);
});
