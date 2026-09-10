import test from "node:test";
import assert from "node:assert/strict";
import {
  ECU_SURVEY_EXPECTATION,
  ECU_SURVEY_STATUS,
  buildDefaultEcuExpectations,
  buildEcuSurveyPlan,
  ecuSurveyTopologySignature,
  evaluateEcuSurvey,
  evaluateEcuSurveyRepeatability,
  validateEcuSurveyPlan
} from "../src/ecu-survey.js";
import { IS220D_DIAGNOSTIC_PROFILE } from "../src/is220d-profile.js";

test("ECU Survey käyttää vain nykyisen profiilin 7E0–7E7 Mode 01 PID 00 -lukusuunnitelmaa", () => {
  const plan = buildEcuSurveyPlan();
  assert.equal(plan.length, 8);
  assert.deepEqual(plan.map(step => step.requestHeader), ["7E0", "7E1", "7E2", "7E3", "7E4", "7E5", "7E6", "7E7"]);
  assert.equal(plan.every(step => step.command === "0100"), true);
  assert.equal(plan.every(step => step.service === 0x01 && step.pid === 0x00 && step.expectedResponseMode === 0x41), true);
  assert.equal(plan.every(step => step.operation === "read-only" && step.writable === false), true);
  assert.equal(plan[0].knownEcuId, "engine");
  assert.equal(plan[0].knownResponseHeader, "7E8");
  assert.equal(plan.slice(1).every(step => step.knownEcuId === "" && step.knownResponseHeader === ""), true);
});

test("ECU Survey fail-closed hylkää kirjoittavan tai muun kuin 0100-suunnitelman", () => {
  const plan = buildEcuSurveyPlan().map(step => ({ ...step }));
  plan[1].command = "04";
  plan[2].writable = true;
  plan[3].operation = "write";
  const validation = validateEcuSurveyPlan(plan);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /only 0100 is allowed/);
  assert.match(validation.errors.join("\n"), /must be read-only/);
});

test("oletusodotus merkitsee vain profiilissa nimetyn moottori-ECU:n odotetuksi", () => {
  const expectations = buildDefaultEcuExpectations();
  assert.equal(expectations["7E0"], ECU_SURVEY_EXPECTATION.EXPECTED);
  for (const header of ["7E1", "7E2", "7E3", "7E4", "7E5", "7E6", "7E7"]) {
    assert.equal(expectations[header], ECU_SURVEY_EXPECTATION.UNKNOWN);
  }
});

test("survey erottaa odotetun vastaajan, puuttuvan odotetun ECU:n ja tuntemattoman vastaajan", () => {
  const snapshot = evaluateEcuSurvey({
    observations: [
      { requestHeader: "7E0", responseHeader: "7E8", validResponse: true, raw: "41 00 BE 3E B8 13", durationMs: 42 },
      { requestHeader: "7E3", responseHeader: "7EB", validResponse: true, raw: "41 00 00 00 00 00", durationMs: 55 }
    ]
  });

  const engine = snapshot.nodes.find(node => node.requestHeader === "7E0");
  const unmapped = snapshot.nodes.find(node => node.requestHeader === "7E3");
  assert.equal(engine.status, ECU_SURVEY_STATUS.EXPECTED_RESPONDING);
  assert.equal(engine.knownEcuId, "engine");
  assert.equal(unmapped.status, ECU_SURVEY_STATUS.UNMAPPED_RESPONSE);
  assert.equal(unmapped.knownEcuId, "");
  assert.equal(snapshot.summary.respondingHeaders, 2);
  assert.equal(snapshot.summary.discoveryCount, 1);
  assert.equal(snapshot.summary.attentionCount, 0);
});

test("odotettu mutta vastaamaton ECU nostetaan huomioksi ilman automaattista vikapäätelmää", () => {
  const snapshot = evaluateEcuSurvey({ observations: [] });
  const engine = snapshot.nodes.find(node => node.requestHeader === "7E0");
  assert.equal(engine.status, ECU_SURVEY_STATUS.EXPECTED_NO_RESPONSE);
  assert.equal(engine.responding, false);
  assert.equal(snapshot.summary.expectedNoResponse, 1);
  assert.equal(snapshot.summary.attentionCount, 1);
});

test("varustetieto voi merkitä osoitteen ei-odotetuksi ja erottaa poikkeavan vastauksen", () => {
  const quiet = evaluateEcuSurvey({
    expectations: { "7E4": ECU_SURVEY_EXPECTATION.NOT_EXPECTED }
  });
  assert.equal(quiet.nodes.find(node => node.requestHeader === "7E4").status, ECU_SURVEY_STATUS.NOT_EXPECTED);

  const responding = evaluateEcuSurvey({
    expectations: { "7E4": ECU_SURVEY_EXPECTATION.NOT_EXPECTED },
    observations: [{ requestHeader: "7E4", responseHeader: "7EC", validResponse: true }]
  });
  assert.equal(responding.nodes.find(node => node.requestHeader === "7E4").status, ECU_SURVEY_STATUS.UNEXPECTED_RESPONSE);
  assert.equal(responding.summary.attentionCount, 2); // 7E0 puuttuu + 7E4 vastaa vastoin odotusta.
});

test("survey ei hyväksy havaintoja profiilin 7E0–7E7-suunnitelman ulkopuolelta", () => {
  assert.throws(
    () => evaluateEcuSurvey({ observations: [{ requestHeader: "700", validResponse: true }] }),
    /outside survey plan/
  );
});

test("topologia hyväksytään toistettavaksi vasta kolmesta identtisestä survey-ajosta", () => {
  const makeSnapshot = () => evaluateEcuSurvey({
    observations: [
      { requestHeader: "7E0", responseHeader: "7E8", validResponse: true },
      { requestHeader: "7E3", responseHeader: "7EB", validResponse: true }
    ]
  });
  const one = makeSnapshot();
  const two = makeSnapshot();
  const three = makeSnapshot();
  assert.match(ecuSurveyTopologySignature(one), /7E0>7E8:engine/);
  assert.equal(evaluateEcuSurveyRepeatability([one, two]).stable, false);
  const repeatability = evaluateEcuSurveyRepeatability([one, two, three]);
  assert.equal(repeatability.stable, true);
  assert.equal(repeatability.observedRuns, 3);
  assert.equal(repeatability.topologySignature, ecuSurveyTopologySignature(one));
});

test("muuttuva vastaajatopologia ei läpäise kolmen ajon toistettavuusporttia", () => {
  const baseline = evaluateEcuSurvey({
    observations: [{ requestHeader: "7E0", responseHeader: "7E8", validResponse: true }]
  });
  const changed = evaluateEcuSurvey({
    observations: [
      { requestHeader: "7E0", responseHeader: "7E8", validResponse: true },
      { requestHeader: "7E2", responseHeader: "7EA", validResponse: true }
    ]
  });
  assert.equal(evaluateEcuSurveyRepeatability([baseline, baseline, changed]).stable, false);
});

test("profiilin survey-pyyntöä ei voi vaihtaa hiljaa muuhun palveluun", () => {
  const profile = structuredClone(IS220D_DIAGNOSTIC_PROFILE);
  profile.ecuSurvey.safeProbe = "0902";
  assert.throws(() => buildEcuSurveyPlan(profile), /safety policy rejected command 0902/);
});


