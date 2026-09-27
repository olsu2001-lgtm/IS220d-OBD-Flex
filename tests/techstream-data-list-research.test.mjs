import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  TOYOTA_READ_DATA_ALLOWED_COMMANDS,
  IS220D_RESEARCH_READ_DATA_CANDIDATES,
  IS220D_RESEARCH_READ_ONLY_COMMANDS,
  getIs220dResearchReadDataCandidate,
  isIs220dResearchReadOnlyCommand
} from "../src/is220d-profile.js";
import {
  analyzeTechstreamResearchReadDataResponse,
  configureTechstreamDataListResearch,
  techstreamDataListResearchAvailable,
  runTechstreamDataListResearchCapture,
  evaluate21adInjectorFeedbackFamilyHypothesis,
  buildTechstreamDataListResearchReport
} from "../src/techstream-data-list-research.js";

test("21AD is isolated from the production allowlist and 219C stays blocked", () => {
  assert.equal(IS220D_RESEARCH_READ_DATA_CANDIDATES.length, 1);
  assert.equal(IS220D_RESEARCH_READ_DATA_CANDIDATES[0].command, "21AD");
  assert.equal(IS220D_RESEARCH_READ_DATA_CANDIDATES[0].targetVehicleVerified, false);
  assert.equal(IS220D_RESEARCH_READ_DATA_CANDIDATES[0].decoderAuthorized, false);
  assert.equal(TOYOTA_READ_DATA_ALLOWED_COMMANDS.includes("21AD"), false);
  assert.equal(TOYOTA_READ_DATA_ALLOWED_COMMANDS.includes("0221AD0000000000"), false);
  assert.equal(IS220D_RESEARCH_READ_ONLY_COMMANDS.includes("21AD"), true);
  assert.equal(IS220D_RESEARCH_READ_ONLY_COMMANDS.includes("0221AD0000000000"), true);
  assert.equal(IS220D_RESEARCH_READ_ONLY_COMMANDS.includes("219C"), false);
  assert.equal(isIs220dResearchReadOnlyCommand("21 AD"), true);
  assert.equal(isIs220dResearchReadOnlyCommand("219C"), false);
  assert.equal(getIs220dResearchReadDataCandidate(0xad)?.expectedResponsePrefix, "61AD");
});

test("61AD single-frame response is preserved as raw payload without decoding", () => {
  const result = analyzeTechstreamResearchReadDataResponse("7E8 06 61 AD 80 81 7F 82\r>");
  assert.equal(result.status, "positive-raw");
  assert.equal(result.positive, true);
  assert.equal(result.payloadLength, 4);
  assert.equal(result.payloadHex, "80817F82");
  assert.deepEqual(result.payloadBytes, [0x80, 0x81, 0x7f, 0x82]);
  assert.equal(result.decoderAuthorized, false);
  assert.equal(result.targetVehicleVerified, false);
});

test("61AD ISO-TP multi-frame payload is reassembled for evidence only", () => {
  const result = analyzeTechstreamResearchReadDataResponse([
    "7E8 10 0D 61 AD 01 02 03 04",
    "7E8 21 05 06 07 08 09 0A 0B"
  ].join("\r\n"));
  assert.equal(result.positive, true);
  assert.equal(result.payloadHex, "0102030405060708090A0B");
  assert.equal(result.payloadLength, 11);
});

test("1KD 21AD injector mapping is exposed only as a comparison hypothesis", () => {
  const payloadBytes = Array(25).fill(0);
  payloadBytes[17] = 65;
  payloadBytes[18] = 70;
  payloadBytes[19] = 63;
  payloadBytes[20] = 57;
  const expected = payloadBytes.slice(17, 21).map(raw => raw * 20 / 128 - 10);
  const hypothesis = evaluate21adInjectorFeedbackFamilyHypothesis(
    { payloadBytes },
    {
      injectionFeedback1: expected[0],
      injectionFeedback2: expected[1],
      injectionFeedback3: expected[2],
      injectionFeedback4: expected[3]
    }
  );
  assert.deepEqual(hypothesis.payloadLetters, ["R", "S", "T", "U"]);
  assert.deepEqual(hypothesis.byteIndexesZeroBased, [17, 18, 19, 20]);
  assert.deepEqual(hypothesis.hypothesisValuesMm3, expected);
  assert.equal(hypothesis.comparableChannelCount, 4);
  assert.equal(hypothesis.maxAbsDeltaMm3, 0);
  assert.equal(hypothesis.withinTolerance, true);
  assert.equal(hypothesis.decoderAuthorized, false);
  assert.equal(hypothesis.targetEngine, "2AD-FHV");
});

test("NO DATA and NRC remain non-positive research outcomes", () => {
  assert.equal(analyzeTechstreamResearchReadDataResponse("NO DATA\r>").status, "no-data");
  const negative = analyzeTechstreamResearchReadDataResponse("7E8 03 7F 21 12\r>");
  assert.equal(negative.status, "negative-response");
  assert.equal(negative.nrc, "12");
  assert.equal(negative.positive, false);
});

test("research capture requires explicit availability and returns raw evidence", async () => {
  configureTechstreamDataListResearch({
    available: () => true,
    capture: async candidate => ({
      raw: `7E8 06 61 ${candidate.identifierHex} 80 81 7F 82\r>`,
      responseClass: "positive-response",
      researchReadOnly: true,
      transactionId: "ECU-RESEARCH-0001",
      error: ""
    })
  });
  try {
    assert.equal(techstreamDataListResearchAvailable(), true);
    const result = await runTechstreamDataListResearchCapture("21AD");
    assert.equal(result.positive, true);
    assert.equal(result.payloadHex, "80817F82");
    assert.equal(result.transactionId, "ECU-RESEARCH-0001");
    assert.equal(result.responseClass, "positive-response");
    assert.equal(result.researchReadOnly, true);
    await assert.rejects(() => runTechstreamDataListResearchCapture("219C"), /tutkimussallintalista/i);
  } finally {
    configureTechstreamDataListResearch({});
  }
});

test("research capture fails closed when transport cannot prove research-only gating", async () => {
  configureTechstreamDataListResearch({
    available: () => true,
    capture: async () => ({
      raw: "7E8 06 61 AD 80 81 7F 82\r>",
      responseClass: "positive-response",
      transactionId: "ECU-UNMARKED",
      researchReadOnly: false
    })
  });
  try {
    await assert.rejects(
      () => runTechstreamDataListResearchCapture("21AD"),
      /ei vahvistanut research-only-gatea/i
    );
  } finally {
    configureTechstreamDataListResearch({});
  }
});

test("research report keeps Techstream reference values separate from raw 61AD data", () => {
  const result = analyzeTechstreamResearchReadDataResponse("61 AD 80 81 7F 82");
  const report = buildTechstreamDataListResearchReport(result, {
    injectionFeedback1: "-0,5",
    injectionFeedback2: "0.25",
    injectionFeedback3: "1.0",
    injectionFeedback4: "-0.75",
    targetCommonRailPressureKpa: "35000",
    targetPumpScvCurrentMa: "900"
  });
  assert.match(report, /Kandidaatti: 21AD -> 61AD/);
  assert.match(report, /Payload HEX: 80817F82/);
  assert.match(report, /-0.5 \/ 0.25 \/ 1 \/ -0.75 mm³\/st/);
  assert.match(report, /Dekoodaus: EI HYVÄKSYTTY/);
  assert.match(report, /Research-only transport: EI \/ EI TIETOA/);
});

test("runtime transport keeps research opt-in explicit", () => {
  const core = fs.readFileSync(new URL("../src/core.js", import.meta.url), "utf8");
  const main = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(core, /allowResearchReadOnly = false/);
  assert.match(core, /isProfileResearchReadOnlyCommand/);
  assert.match(main, /allowResearchReadOnly: true/);
  assert.match(main, /command !== "21AD"/);
  assert.doesNotMatch(main, /command !== "219C"/);
});
