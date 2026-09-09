import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEvidenceSupportBundle,
  stringifyEvidenceSupportBundle
} from "../src/evidence-support-bundle.js";

function snapshot(runId, endedAt, overrides = {}) {
  return {
    schemaVersion: 1,
    mode: "read-only",
    profileVersion: "is220d-xe20-2ad-fhv-readonly-v1",
    safeProbe: "0100",
    runId,
    buildSha: "abcdef1234567890",
    startedAt: endedAt - 1000,
    endedAt,
    raw: "7E8 06 41 00 SECRET RAW CAN",
    adapterIdentity: "vLinker-MAC-SECRET",
    bluetoothAddress: "AA:BB:CC:DD:EE:FF",
    latestError: "secret diagnostic error",
    nodes: [
      {
        requestHeader: "7E0",
        responding: true,
        observedResponseHeaders: ["7E8"],
        raw: "7E8 secret raw"
      }
    ],
    identity: {
      overall: "match",
      fields: {
        vin: { status: "match", value: "JTHBB262302028787", expected: "JTHBB262302028787", responseHeader: "7E8" },
        calibrationId: { status: "match", value: "35360000", expected: "35360000", responseHeader: "7E8" },
        calibrationVerificationNumber: { status: "match", value: "01CAD67F74", expected: "01CAD67F74", responseHeader: "7E8" },
        ecuName: { status: "observed", value: "ENGINE", expected: "", responseHeader: "7E8" }
      }
    },
    validation: {
      engineState: "running",
      connectionStrategy: "current-settings-0100",
      currentSettingsProbeObserved: true,
      currentSettingsProbePassed: true,
      restorationProbeObserved: true,
      restorationPassed: true,
      cancelled: false,
      internalFailure: false,
      toyota: [
        { command: "217E", attempted: true, positive: true, status: "positive", queryForm: "217E", responseHeaders: ["7E8"], attempts: 1, raw: "secret" },
        { command: "217F", attempted: true, positive: false, status: "no-data", queryForm: "", responseHeaders: [], attempts: 2, error: "NO DATA secret" },
        { command: "212C", attempted: true, positive: true, status: "positive", queryForm: "212C", responseHeaders: ["7E8"], attempts: 1 }
      ]
    },
    ...overrides
  };
}

function historyResult() {
  const runs = [snapshot("run-1", 10000), snapshot("run-2", 20000), snapshot("run-3", 30000)];
  return {
    snapshots: runs,
    latestSnapshot: runs[2],
    fieldValidation: {
      status: "ready-for-techstream",
      readyForTechstream: true,
      requiredRuns: 3,
      observedRuns: 3,
      buildSha: "abcdef1234567890",
      engineState: "running",
      topologySignature: "7E0>7E8",
      runs,
      checks: [
        { code: "run-count", pass: true, label: "Kolme yhteensopivaa ajoa", detail: "3/3" },
        { code: "mode09", pass: true, label: "Mode 09 identiteetti täsmää", detail: "VIN/CALID/CVN match" }
      ],
      pendingExternal: ["Techstream Health Check / system inventory"]
    },
    techstreamReference: {
      schemaVersion: 1,
      source: "techstream-health-check",
      referenceId: "HC-2026-09-06",
      capturedAt: "2026-09-06T12:00:00.000Z",
      note: "Health Check transcription",
      systems: [
        { name: "Engine and ECT", dtcs: ["U0073"], note: "present" },
        { name: "ABS/VSC/TRC", dtcs: ["C0215", "U0121"], note: "present" }
      ],
      mappings: [
        { requestHeader: "7E0", responseHeader: "7E8", systemName: "Engine and ECT", evidenceLevel: "verified", evidenceNote: "independent engine mapping evidence" }
      ]
    },
    techstreamComparison: {
      loaded: true,
      status: "verified-mappings-observed",
      systemCount: 2,
      dtcCount: 3,
      systemsWithDtcs: 2,
      verifiedMappings: 1,
      candidateMappings: 0,
      verifiedObserved: 1,
      verifiedDiscrepancies: 0,
      mappings: [
        { requestHeader: "7E0", responseHeader: "7E8", systemName: "Engine and ECT", evidenceLevel: "verified", status: "observed", observedResponseHeaders: ["7E8"], evidenceNote: "should not be copied from comparison" }
      ],
      unmappedFlexResponders: [],
      unmappedTechstreamSystems: ["ABS/VSC/TRC"],
      manualReviewRequired: true
    }
  };
}

test("Evidence Support Bundle contains the three validation runs and independent Techstream evidence", () => {
  const bundle = buildEvidenceSupportBundle(historyResult(), { generatedAt: 40000 });
  assert.equal(bundle.schemaVersion, 1);
  assert.equal(bundle.bundleType, "is220d-obd-flex-evidence-support");
  assert.equal(bundle.generatedAt, "1970-01-01T00:00:40.000Z");
  assert.equal(bundle.mode, "read-only-evidence");
  assert.equal(bundle.buildSha, "abcdef1234567890");
  assert.equal(bundle.fieldValidation.readyForTechstream, true);
  assert.deepEqual(bundle.runs.map(run => run.runId), ["run-1", "run-2", "run-3"]);
  assert.equal(bundle.runs.every(run => run.engine7e0To7e8), true);
  assert.equal(bundle.runs[0].toyota.find(item => item.command === "217F").status, "no-data");
  assert.equal(bundle.techstream.reference.referenceId, "HC-2026-09-06");
  assert.equal(bundle.techstream.comparison.status, "verified-mappings-observed");
  assert.equal(bundle.techstream.comparison.verifiedObserved, 1);
});

test("Evidence Support Bundle never includes raw transport data, addresses, errors or vehicle identity values", () => {
  const json = stringifyEvidenceSupportBundle(historyResult(), { generatedAt: 40000 });
  for (const forbidden of [
    "SECRET RAW CAN",
    "vLinker-MAC-SECRET",
    "AA:BB:CC:DD:EE:FF",
    "secret diagnostic error",
    "NO DATA secret",
    "JTHBB262302028787",
    "35360000",
    "01CAD67F74",
    "ENGINE"
  ]) assert.equal(json.includes(forbidden), false, `forbidden value leaked: ${forbidden}`);
  assert.match(json, /"rawVehicleResponsesIncluded": false/);
  assert.match(json, /"vehicleIdentityValuesIncluded": false/);
  assert.match(json, /"vin": \{\n\s+"status": "match"/);
});

test("bundle falls back to the latest three stored snapshots before a complete validation group exists", () => {
  const snapshots = [
    snapshot("old", 10000),
    snapshot("one", 20000),
    snapshot("two", 30000),
    snapshot("three", 40000)
  ];
  const bundle = buildEvidenceSupportBundle({
    snapshots,
    latestSnapshot: snapshots[3],
    fieldValidation: { status: "collecting", observedRuns: 0, requiredRuns: 3, runs: [] },
    techstreamComparison: { loaded: false }
  }, { generatedAt: 50000 });
  assert.deepEqual(bundle.runs.map(run => run.runId), ["one", "two", "three"]);
  assert.equal(bundle.techstream.reference, null);
  assert.equal(bundle.techstream.comparison.loaded, false);
});
