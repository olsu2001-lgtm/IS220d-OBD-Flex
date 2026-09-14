import test from "node:test";
import assert from "node:assert/strict";
import {
  FIELD_TEST_REQUIRED_RUNS,
  buildFieldTestState,
  fieldTestButtonLabel,
  fieldTestStatusLabel
} from "../src/field-test-ui.js";

function run(id, buildSha, engineState) {
  return {
    mode: "read-only",
    runId: id,
    buildSha,
    validation: { engineState }
  };
}

test("Field Test Mode counts only the selected engine state on the current build", () => {
  const history = {
    snapshots: [
      run("old-build", "old", "running"),
      run("run-1", "new", "running"),
      run("run-2", "new", "running"),
      run("stopped", "new", "stopped"),
      run("auto", "new", "auto")
    ],
    fieldValidation: {
      buildSha: "new",
      engineState: "running",
      status: "collecting",
      readyForTechstream: false
    }
  };
  const state = buildFieldTestState(history, "running", "new");
  assert.equal(FIELD_TEST_REQUIRED_RUNS, 3);
  assert.equal(state.buildSha, "new");
  assert.equal(state.engineState, "running");
  assert.equal(state.observedRuns, 2);
  assert.equal(state.totalMatchingRuns, 2);
  assert.equal(state.ready, false);
  assert.equal(fieldTestButtonLabel(state), "Aja kenttäajo 3/3");
  assert.equal(fieldTestStatusLabel(state).text, "2/3 kerätty");
});

test("ready three-run group becomes explicit additional verification state", () => {
  const history = {
    snapshots: [run("1", "sha", "running"), run("2", "sha", "running"), run("3", "sha", "running")],
    fieldValidation: {
      buildSha: "sha",
      engineState: "running",
      status: "ready-for-techstream",
      readyForTechstream: true
    }
  };
  const state = buildFieldTestState(history, "running", "sha");
  assert.equal(state.observedRuns, 3);
  assert.equal(state.ready, true);
  assert.equal(state.attention, false);
  assert.equal(fieldTestStatusLabel(state).text, "3/3 valmis");
  assert.equal(fieldTestStatusLabel(state).className, "ready");
  assert.equal(fieldTestButtonLabel(state), "Aja lisävarmennusajo");
});

test("failed three-run group offers a replacement run instead of presenting validation as ready", () => {
  const history = {
    snapshots: [run("1", "sha", "stopped"), run("2", "sha", "stopped"), run("3", "sha", "stopped"), run("4", "sha", "stopped")],
    fieldValidation: {
      buildSha: "sha",
      engineState: "stopped",
      status: "needs-attention",
      readyForTechstream: false
    }
  };
  const state = buildFieldTestState(history, "stopped", "sha");
  assert.equal(state.observedRuns, 3);
  assert.equal(state.totalMatchingRuns, 4);
  assert.equal(state.ready, false);
  assert.equal(state.attention, true);
  assert.equal(fieldTestStatusLabel(state).text, "3/3 tarkistettava");
  assert.equal(fieldTestStatusLabel(state).className, "attention");
  assert.equal(fieldTestButtonLabel(state), "Aja korvaava kenttäajo");
});

test("switching engine state starts a separate visual collection group", () => {
  const history = {
    snapshots: [run("1", "sha", "running"), run("2", "sha", "running"), run("3", "sha", "running"), run("s1", "sha", "stopped")],
    fieldValidation: {
      buildSha: "sha",
      engineState: "running",
      status: "ready-for-techstream",
      readyForTechstream: true
    }
  };
  const state = buildFieldTestState(history, "stopped", "sha");
  assert.equal(state.observedRuns, 1);
  assert.equal(state.ready, false);
  assert.equal(state.attention, false);
  assert.equal(state.currentValidationStatus, "collecting");
  assert.equal(fieldTestButtonLabel(state), "Aja kenttäajo 2/3");
});


