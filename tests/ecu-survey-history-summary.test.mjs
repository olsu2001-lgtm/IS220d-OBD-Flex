import test from "node:test";
import assert from "node:assert/strict";
import { evaluateEcuSurvey } from "../src/ecu-survey.js";
import {
  ECU_SURVEY_HISTORY_KEY,
  recordEcuSurveySnapshot,
  summarizeEcuSurveyHistory
} from "../src/ecu-survey-history.js";

function memoryStorage() {
  const data = new Map();
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
    dump: () => data.get(ECU_SURVEY_HISTORY_KEY) || ""
  };
}

function snapshot(runId, responseHeader, timestamp) {
  return evaluateEcuSurvey({
    runId,
    startedAt: timestamp,
    endedAt: timestamp + 10,
    observations: [
      { requestHeader: "7E0", responseHeader, validResponse: true, raw: `${responseHeader} 06 41 00 BE 3E B8 13` }
    ]
  });
}

test("summarizeEcuSurveyHistory returns latest persisted snapshot and repeatability", () => {
  const storage = memoryStorage();
  recordEcuSurveySnapshot(snapshot("a", "7E8", 100), storage);
  recordEcuSurveySnapshot(snapshot("b", "7E8", 200), storage);
  recordEcuSurveySnapshot(snapshot("c", "7E8", 300), storage);

  const summary = summarizeEcuSurveyHistory(storage);
  assert.equal(summary.snapshots.length, 3);
  assert.equal(summary.latestSnapshot.runId, "c");
  assert.equal(summary.comparableSnapshots.length, 3);
  assert.equal(summary.repeatability.stable, true);
  assert.match(storage.dump(), /"runId":"c"/);
});

test("summary compares only the latest compatible survey profile", () => {
  const storage = memoryStorage();
  const first = snapshot("a", "7E8", 100);
  recordEcuSurveySnapshot(first, storage);

  const incompatible = {
    ...snapshot("b", "7E8", 200),
    profileVersion: "future-profile-v2"
  };
  recordEcuSurveySnapshot(incompatible, storage);

  const summary = summarizeEcuSurveyHistory(storage);
  assert.equal(summary.latestSnapshot.profileVersion, "future-profile-v2");
  assert.equal(summary.comparableSnapshots.length, 1);
  assert.equal(summary.repeatability.stable, false);
  assert.equal(summary.repeatability.observedRuns, 1);
});


