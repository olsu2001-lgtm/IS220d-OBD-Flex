import test from "node:test";
import assert from "node:assert/strict";
import { evaluateEcuSurvey } from "../src/ecu-survey.js";
import {
  ECU_SURVEY_HISTORY_KEY,
  ECU_SURVEY_HISTORY_LIMIT,
  clearEcuSurveyHistory,
  compactEcuSurveySnapshot,
  loadEcuSurveyHistory,
  normalizeEcuSurveyHistory,
  recordEcuSurveySnapshot
} from "../src/ecu-survey-history.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function snapshot(runId, endedAt, extraHeader = "") {
  const observations = [
    { requestHeader: "7E0", responseHeader: "7E8", validResponse: true, raw: "secret raw engine" }
  ];
  if (extraHeader) observations.push({ requestHeader: extraHeader, responseHeader: "7EB", validResponse: true, raw: "secret raw extra" });
  return evaluateEcuSurvey({ runId, startedAt: endedAt - 1000, endedAt, observations });
}

test("historia tallentaa vain kompaktin topologian eikä raakavasteita tai adapteritietoja", () => {
  const original = snapshot("run-1", 1000, "7E3");
  const compact = compactEcuSurveySnapshot(original);
  assert.equal(compact.runId, "run-1");
  assert.equal(compact.nodes.length, 8);
  assert.equal("latestRaw" in compact.nodes[0], false);
  assert.equal("latestError" in compact.nodes[0], false);
  assert.equal("adapter" in compact, false);
  assert.equal(JSON.stringify(compact).includes("secret raw"), false);
});

test("kolme identtistä tallennettua ajoa täyttää toistettavuusportin", () => {
  const storage = memoryStorage();
  let result;
  result = recordEcuSurveySnapshot(snapshot("run-1", 1000), storage);
  assert.equal(result.repeatability.stable, false);
  result = recordEcuSurveySnapshot(snapshot("run-2", 2000), storage);
  assert.equal(result.repeatability.stable, false);
  result = recordEcuSurveySnapshot(snapshot("run-3", 3000), storage);
  assert.equal(result.persisted, true);
  assert.equal(result.repeatability.stable, true);
  assert.equal(result.repeatability.observedRuns, 3);
  assert.match(result.repeatability.topologySignature, /7E0>7E8:engine/);
});

test("muuttuva kolmas topologia ei täytä toistettavuusporttia", () => {
  const storage = memoryStorage();
  recordEcuSurveySnapshot(snapshot("run-1", 1000), storage);
  recordEcuSurveySnapshot(snapshot("run-2", 2000), storage);
  const result = recordEcuSurveySnapshot(snapshot("run-3", 3000, "7E3"), storage);
  assert.equal(result.repeatability.stable, false);
});

test("historia deduplikoi runId:n, järjestää ajan mukaan ja rajautuu viimeiseen kymmeneen", () => {
  const input = [];
  for (let index = 12; index >= 1; index--) input.push(snapshot(`run-${index}`, index * 1000));
  input.push(snapshot("run-12", 99999));
  const history = normalizeEcuSurveyHistory(input);
  assert.equal(history.length, ECU_SURVEY_HISTORY_LIMIT);
  assert.equal(history[0].runId, "run-3");
  assert.equal(history.at(-1).runId, "run-12");
});

test("rikkinäinen localStorage-data failaa tyhjään historiaan eikä kaada diagnostiikkaa", () => {
  const storage = memoryStorage();
  storage.setItem(ECU_SURVEY_HISTORY_KEY, "{not-json");
  assert.deepEqual(loadEcuSurveyHistory(storage), []);
  const result = recordEcuSurveySnapshot(snapshot("run-ok", 1000), storage);
  assert.equal(result.persisted, true);
  assert.equal(result.snapshots.length, 1);
});

test("localStorage-kirjoitusvirhe palautetaan tilana mutta snapshot on silti käytettävissä", () => {
  const storage = {
    getItem() { return null; },
    setItem() { throw new Error("quota denied"); },
    removeItem() { throw new Error("blocked"); }
  };
  const result = recordEcuSurveySnapshot(snapshot("run-1", 1000), storage);
  assert.equal(result.persisted, false);
  assert.match(result.error, /quota denied/);
  assert.equal(result.snapshots.length, 1);
  assert.equal(clearEcuSurveyHistory(storage), false);
});

test("historia voidaan tyhjentää", () => {
  const storage = memoryStorage();
  recordEcuSurveySnapshot(snapshot("run-1", 1000), storage);
  assert.equal(loadEcuSurveyHistory(storage).length, 1);
  assert.equal(clearEcuSurveyHistory(storage), true);
  assert.equal(loadEcuSurveyHistory(storage).length, 0);
});
