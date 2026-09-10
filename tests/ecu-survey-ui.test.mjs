import test from "node:test";
import assert from "node:assert/strict";
import { evaluateEcuSurvey } from "../src/ecu-survey.js";
import { buildEcuSurveyUiModel } from "../src/ecu-survey-ui.js";

function snapshot(runId, observations, timestamp) {
  return evaluateEcuSurvey({
    runId,
    startedAt: timestamp,
    endedAt: timestamp + 1000,
    observations
  });
}

const engineObservation = { requestHeader: "7E0", responseHeader: "7E8", validResponse: true, raw: "7E8 06 41 00 BE 3E B8 13" };

test("ECU Survey UI model shows known engine and keeps unknown responder unmapped", () => {
  const current = snapshot("run-3", [
    engineObservation,
    { requestHeader: "7E3", responseHeader: "7EB", validResponse: true, raw: "7EB 06 41 00 00 00 00 00" }
  ], 3000);
  const model = buildEcuSurveyUiModel(current, {
    snapshots: [current],
    comparableSnapshots: [current],
    repeatability: { stable: false, observedRuns: 1, requiredRuns: 3 }
  });

  assert.equal(model.visible, true);
  assert.equal(model.respondingCount, 2);
  assert.equal(model.plannedCount, 8);
  assert.equal(model.repeatability.code, "collecting");
  assert.equal(model.repeatability.label, "Kerätään 1/3");

  const engine = model.nodes.find(node => node.requestHeader === "7E0");
  assert.equal(engine.responseHeader, "7E8");
  assert.equal(engine.ecuId, "engine");
  assert.equal(engine.stateCode, "responding");

  const unknown = model.nodes.find(node => node.requestHeader === "7E3");
  assert.equal(unknown.responseHeader, "7EB");
  assert.equal(unknown.ecuId, "");
  assert.equal(unknown.ecuLabel, "Tunnistamaton ECU");
  assert.equal(unknown.stateCode, "unmapped");
});

test("three identical compatible runs render stable repeatability", () => {
  const first = snapshot("run-1", [engineObservation], 1000);
  const second = snapshot("run-2", [engineObservation], 2000);
  const third = snapshot("run-3", [engineObservation], 3000);
  const model = buildEcuSurveyUiModel(third, {
    snapshots: [first, second, third],
    comparableSnapshots: [first, second, third],
    repeatability: { stable: true, observedRuns: 3, requiredRuns: 3 }
  });

  assert.equal(model.repeatability.code, "stable");
  assert.equal(model.repeatability.label, "Vakaa 3/3");
  assert.equal(model.history.length, 3);
  assert.equal(model.history[0].runId, "run-3");
  assert.equal(model.history.every(item => item.compatible), true);
});

test("changed topology is explicitly not presented as an ECU fault", () => {
  const current = snapshot("run-3", [engineObservation], 3000);
  const model = buildEcuSurveyUiModel(current, {
    snapshots: [current],
    comparableSnapshots: [current, current, current],
    repeatability: { stable: false, observedRuns: 3, requiredRuns: 3 }
  });

  assert.equal(model.repeatability.code, "changed");
  assert.equal(model.repeatability.label, "Topologia muuttui");
  assert.doesNotMatch(JSON.stringify(model), /fault|vika|rikki/i);
});

test("missing snapshot keeps the topology UI hidden", () => {
  assert.deepEqual(buildEcuSurveyUiModel(null), { visible: false });
});


