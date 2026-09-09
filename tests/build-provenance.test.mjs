import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ecuSurveySnapshotFromDiagnosticRun } from "../src/ecu-survey-diagnostic.js";
import { compactEcuSurveySnapshot } from "../src/ecu-survey-history.js";
import { buildEcuSurveyTextReport } from "../src/ecu-survey-report.js";
import { buildEcuSurveyUiModel } from "../src/ecu-survey-ui.js";

const EXPECTED_SHA = "abcdef123456";

test("embedded build SHA flows into survey, compact history, report and UI model", () => {
  const hadOriginal = Object.prototype.hasOwnProperty.call(globalThis, "__IS220D_BUILD_SHA__");
  const original = globalThis.__IS220D_BUILD_SHA__;
  globalThis.__IS220D_BUILD_SHA__ = EXPECTED_SHA;
  try {
    const snapshot = ecuSurveySnapshotFromDiagnosticRun({
      startedAt: 1000,
      endedAt: 2000,
      meta: { reportId: "BUILD-PROVENANCE-TEST" },
      results: []
    });
    assert.equal(snapshot.buildSha, EXPECTED_SHA);

    const compact = compactEcuSurveySnapshot(snapshot);
    assert.equal(compact.buildSha, EXPECTED_SHA);

    const report = buildEcuSurveyTextReport(snapshot);
    assert.match(report, /Build SHA: abcdef123456/);

    const model = buildEcuSurveyUiModel(compact, {
      snapshots: [compact],
      comparableSnapshots: [compact],
      repeatability: { stable: false, observedRuns: 1, requiredRuns: 3 }
    });
    assert.equal(model.buildSha, EXPECTED_SHA);
    assert.equal(model.history[0].buildSha, EXPECTED_SHA);
  } finally {
    if (hadOriginal) globalThis.__IS220D_BUILD_SHA__ = original;
    else delete globalThis.__IS220D_BUILD_SHA__;
  }
});

test("build script embeds and verifies a Git SHA instead of changing app version", async () => {
  const source = await readFile(new URL("../scripts/build-apk.mjs", import.meta.url), "utf8");
  assert.match(source, /GITHUB_SHA/);
  assert.match(source, /__IS220D_BUILD_SHA__/);
  assert.match(source, /build-info\.json/);
  assert.match(source, /IS220d_OBD-Flex-0\.6\.9-debug\.apk/);
  assert.match(source, /IS220d_OBD-Flex-0\.6\.9-release\.apk/);
});
