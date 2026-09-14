import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  TECHSTREAM_DATA_LIST_GAP_TARGETS,
  analyzeTechstreamDataListTrace,
  buildTechstreamDataListCaptureTemplate,
  buildTechstreamDataListGapTextReport
} from "../src/techstream-data-list-gap.js";

test("declares the three requested Techstream Data List gaps without raw command guesses", () => {
  assert.deepEqual(TECHSTREAM_DATA_LIST_GAP_TARGETS.map(item => item.label), [
    "Injection Feedback Val #1–#4",
    "Target Common Rail Pressure",
    "Target Pump SCV Current"
  ]);
  assert.equal(TECHSTREAM_DATA_LIST_GAP_TARGETS[0].channels, 4);
  assert.equal(TECHSTREAM_DATA_LIST_GAP_TARGETS[0].unit, "mm³/st");
  assert.equal(TECHSTREAM_DATA_LIST_GAP_TARGETS[1].unit, "kPa");
  assert.equal(TECHSTREAM_DATA_LIST_GAP_TARGETS[2].unit, "mA");
  for (const target of TECHSTREAM_DATA_LIST_GAP_TARGETS) {
    assert.equal(target.status, "capture-required");
    assert.equal(target.rawTransaction, null);
  }
  assert.deepEqual(TECHSTREAM_DATA_LIST_GAP_TARGETS[0].rejectedCommands, ["219C"]);
});

test("passive trace analysis finds unknown 21xx/61xx pairs but separates verified and rejected commands", () => {
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
  assert.equal(result.pairCount, 4);
  assert.equal(result.candidateCount, 1);
  assert.equal(result.candidates[0].command, "21AB");
  assert.equal(result.candidates[0].responsePrefix, "61AB");
  assert.equal(result.candidates[0].observations, 2);
  assert.equal(result.candidates[0].distinctPayloadCount, 2);
  assert.equal(result.rejected[0].command, "219C");
  assert.equal(result.rejected[0].status, "field-rejected");
  assert.equal(result.existing[0].command, "217E");
});

test("response without a preceding matching request is not promoted to a candidate", () => {
  const result = analyzeTechstreamDataListTrace("RX 7E8 06 61 AA 01 02 03 04 05");
  assert.equal(result.candidateCount, 0);
  assert.equal(result.unmatchedResponseCount, 1);
});

test("capture template names target vehicle calibration and the three Techstream values", () => {
  const template = JSON.parse(buildTechstreamDataListCaptureTemplate());
  assert.equal(template.calibrationId, "35360000");
  assert.deepEqual(template.techstreamValues.injectionFeedbackMm3PerStroke, [null, null, null, null]);
  assert.equal(template.techstreamValues.targetCommonRailPressureKpa, null);
  assert.equal(template.techstreamValues.targetPumpScvCurrentMa, null);
});

test("report preserves the rejected 219C boundary", () => {
  const analysis = analyzeTechstreamDataListTrace([
    "7E0 02 21 9C 00 00 00 00 00",
    "7E8 06 61 9C 01 02 03 04 05"
  ].join("\n"));
  const report = buildTechstreamDataListGapTextReport(analysis);
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
