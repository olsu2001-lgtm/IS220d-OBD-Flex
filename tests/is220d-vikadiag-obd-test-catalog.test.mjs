import test from "node:test";
import assert from "node:assert/strict";

import {
  IS220D_VIKADIAG_OBD_TEST_CATALOG,
  IS220D_VIKADIAG_OBD_TEST_SOURCE,
  VIKADIAG_TEST_READINESS,
  getVikadiagObdTestCandidateByRow,
  validateVikadiagObdTestCandidate,
  summarizeVikadiagObdTestCatalog
} from "../src/is220d-vikadiag-obd-test-catalog.js";
import {
  getIs220dDiagnosticSignal,
  isProductionAuthorizedIs220dSignal
} from "../src/is220d-diagnostic-signals.js";

const READY_WITHOUT_NEW_SIGNAL = new Set([
  VIKADIAG_TEST_READINESS.IMPLEMENTED_DEDICATED,
  VIKADIAG_TEST_READINESS.READY_EXISTING_SIGNALS,
  VIKADIAG_TEST_READINESS.INDIRECT_EXISTING_SIGNALS
]);

function walk(value, visit) {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    visit(key, nested);
    if (nested && typeof nested === "object") walk(nested, visit);
  }
}

test("first Vikadiag batch maps Drive rows 2-10 exactly once", () => {
  assert.equal(IS220D_VIKADIAG_OBD_TEST_SOURCE, "Bom-kaapija / Vikadiag_kohteet");
  assert.deepEqual(
    IS220D_VIKADIAG_OBD_TEST_CATALOG.filter(item => item.sourceRow <= 10).map(item => item.sourceRow),
    [2, 3, 4, 5, 6, 7, 8, 9, 10]
  );
  assert.equal(new Set(IS220D_VIKADIAG_OBD_TEST_CATALOG.map(item => item.sourceRow)).size, IS220D_VIKADIAG_OBD_TEST_CATALOG.length);
});

test("ready candidates only reference production-authorized existing signals", () => {
  for (const candidate of IS220D_VIKADIAG_OBD_TEST_CATALOG) {
    for (const signalKey of candidate.signalKeys) {
      assert.ok(getIs220dDiagnosticSignal(signalKey), `${candidate.sourceRow}: ${signalKey} must exist`);
      if (READY_WITHOUT_NEW_SIGNAL.has(candidate.readiness)) {
        assert.equal(
          isProductionAuthorizedIs220dSignal(signalKey),
          true,
          `${candidate.sourceRow}: ${signalKey} cannot make a test ready before authorization`
        );
      }
    }
  }
});

test("catalog is transport-free and cannot smuggle raw vehicle commands", () => {
  const forbiddenKeys = new Set(["command", "commands", "rawCommand", "service", "requestHeader", "responseHeader"]);
  for (const candidate of IS220D_VIKADIAG_OBD_TEST_CATALOG) {
    walk(candidate, key => {
      assert.equal(forbiddenKeys.has(key), false, `row ${candidate.sourceRow} contains forbidden transport field ${key}`);
    });
  }
});

test("Drive active-test and forced-regeneration suggestions remain explicit exclusions", () => {
  assert.ok(getVikadiagObdTestCandidateByRow(2).excludedActions.includes("active-test"));
  assert.ok(getVikadiagObdTestCandidateByRow(3).excludedActions.includes("active-test"));
  assert.ok(getVikadiagObdTestCandidateByRow(9).excludedActions.includes("active-test"));
  assert.ok(getVikadiagObdTestCandidateByRow(9).excludedActions.includes("forced-regeneration"));
});

test("field-rejected injector feedback never becomes test evidence", () => {
  const injectors = getVikadiagObdTestCandidateByRow(8);
  assert.ok(injectors.blockedSignalKeys.includes("engine.injection_feedback_rejected"));
  assert.equal(injectors.signalKeys.includes("engine.injection_feedback_rejected"), false);
  assert.equal(getIs220dDiagnosticSignal("engine.injection_feedback_rejected").authorization, "field-rejected");
});

test("every reviewed diagnostic row has a repair-manual visual extraction plan", () => {
  for (const candidate of IS220D_VIKADIAG_OBD_TEST_CATALOG) {
    assert.equal(candidate.manualVisual.required, true, `row ${candidate.sourceRow} must require a manual visual`);
    assert.equal(candidate.manualVisual.source, "Lexus IS250/220D repair manual");
    assert.ok(candidate.manualVisual.searchTerms.length > 0, `row ${candidate.sourceRow} needs manual search terms`);
    if ([2, 4, 5, 40, 45, 46].includes(candidate.sourceRow)) {
      assert.equal(candidate.manualVisual.status, "available");
      assert.match(candidate.manualVisual.assetPath, /^assets\/repair-manual\/.+\.png$/);
      assert.ok(candidate.manualVisual.visualIds.length);
    } else {
      assert.equal(candidate.manualVisual.assetPath, null);
    }
  }
});

test("DPNR row is linked to the already delivered dedicated test, not duplicated", () => {
  const dpnr = getVikadiagObdTestCandidateByRow(5);
  assert.equal(dpnr.readiness, VIKADIAG_TEST_READINESS.IMPLEMENTED_DEDICATED);
  assert.match(dpnr.existingImplementation, /0\.9\.4.*DPNR/i);
  assert.deepEqual(dpnr.signalKeys, ["engine.dpnr_differential_pressure", "engine.rpm"]);
});

test("EGR No.2 stays pending until a component-specific signal is verified", () => {
  const egr2 = getVikadiagObdTestCandidateByRow(3);
  assert.equal(egr2.readiness, VIKADIAG_TEST_READINESS.NEEDS_SIGNAL_VERIFICATION);
  assert.match(egr2.note, /ei ole vielä ajoneuvovarmennettua/i);
});

test("catalog summary distinguishes implemented, ready, indirect and pending rows", () => {
  assert.deepEqual(summarizeVikadiagObdTestCatalog(IS220D_VIKADIAG_OBD_TEST_CATALOG.filter(item => item.sourceRow <= 10)), {
    total: 9,
    implementedDedicated: 1,
    readyExistingSignals: 4,
    indirectExistingSignals: 3,
    needsSignalVerification: 1,
    blocked: 0,
    physicalOnly: 0,
    manualVisualPending: 6
  });
});



test("continuation covers each Drive row through 68 without restarting the first batch", () => {
  assert.deepEqual(IS220D_VIKADIAG_OBD_TEST_CATALOG.map(x => x.sourceRow), Array.from({ length: 67 }, (_, i) => i + 2));
});

test("physical rows cannot acquire OBD evidence, pending cam row cannot prove synchronization", () => {
  for (const row of [13, 14, 15, 26, 38]) {
    const item = getVikadiagObdTestCandidateByRow(row);
    assert.equal(item.obdRole, "physical-only");
    assert.deepEqual(item.signalKeys, []);
    assert.equal(item.readiness, VIKADIAG_TEST_READINESS.PHYSICAL_ONLY);
  }
  const cam = getVikadiagObdTestCandidateByRow(16);
  assert.equal(cam.readiness, VIKADIAG_TEST_READINESS.NEEDS_SIGNAL_VERIFICATION);
  assert.equal(cam.oe, "90919-05029");
  assert.match(cam.expectedPattern, /myös nokkasignaalin puuttuessa/);
  assert.equal(getVikadiagObdTestCandidateByRow(17).oe, "90919-05069");
});

test("continuation has traceable evidence, source rows and unclaimed manual visuals", () => {
  for (const item of IS220D_VIKADIAG_OBD_TEST_CATALOG.filter(x => x.sourceRow >= 11)) {
    assert.equal(validateVikadiagObdTestCandidate(item), item);
    assert.equal(item.source.spreadsheetId, "1cbzE3tsPLfsKKbEI7XUASR1eGzu9JplqbcyXNCv_EH8");
    assert.equal(item.source.sheet, "Vikadiag_kohteet");
    if ([40, 45, 46].includes(item.sourceRow)) {
      assert.equal(item.manualVisual.status, "available");
      assert.equal(item.manualVisual.figureReviewed, true);
      assert.match(item.manualVisual.manualReference, /rm0150\/repair2\/html\/contents\/rm/);
      assert.match(item.manualVisual.imageSourcePath, /\.png$/);
    } else {
      assert.equal(item.manualVisual.status, "pending-extract");
      assert.equal(item.manualVisual.manualReference, null);
    }
    assert.ok(item.manualVisual.targetViews.includes("inspection diagram"));
    assert.deepEqual(item.signalEvidence.map(x => x.key), item.signalKeys);
    for (const evidence of item.signalEvidence) {
      assert.equal(evidence.evidence, getIs220dDiagnosticSignal(evidence.key).evidence);
      assert.equal(evidence.evidence, "vehicle-verified");
    }
    assert.ok(Object.isFrozen(item));
    assert.ok(Object.isFrozen(item.recipes));
  }
});

test("review validator fails closed on unsafe or misleading metadata", () => {
  const copy = row => structuredClone(getVikadiagObdTestCandidateByRow(row));
  let bad = copy(13); bad.signalKeys = ["engine.rpm"];
  assert.throws(() => validateVikadiagObdTestCandidate(bad), /Physical-only/);
  bad = copy(16); bad.missingSignals = [];
  assert.throws(() => validateVikadiagObdTestCandidate(bad), /evidence gap/);
  bad = copy(18); bad.source.row = 19;
  assert.throws(() => validateVikadiagObdTestCandidate(bad), /provenance/);
  bad = copy(18); bad.recipes[1].signalKeys.push("engine.injection_feedback_rejected");
  assert.throws(() => validateVikadiagObdTestCandidate(bad), /outside reviewed evidence/);
  bad = copy(18); bad.recipes[1].rawCommand = "219C";
  assert.throws(() => validateVikadiagObdTestCandidate(bad), /Forbidden catalog field/);
  bad = copy(18); bad.recipes[1].passThreshold = 1;
  assert.throws(() => validateVikadiagObdTestCandidate(bad), /Forbidden catalog field/);
});


test("reused inspection points exist and retain the same component identity", async () => {
  const { IS220D_ALL_INSPECTION_POINTS } = await import("../src/is220d-inspection-execution-state.js");
  const points = new Map(IS220D_ALL_INSPECTION_POINTS.map(point => [point.id, point]));
  for (const item of IS220D_VIKADIAG_OBD_TEST_CATALOG.filter(x => x.sourceRow >= 11)) {
    for (const ref of item.existingInspectionPoints) {
      assert.equal(points.get(ref.pointId)?.componentId, item.componentId, ref.pointId);
    }
    if (item.existingInspectionPoints.length) assert.deepEqual(item.recipes, [], "do not duplicate an existing guided point");
  }
});

test("second continuation preserves uncertain vacuum identity and excluded actuation", () => {
  const filter = getVikadiagObdTestCandidateByRow(31);
  assert.equal(filter.readiness, VIKADIAG_TEST_READINESS.NEEDS_SIGNAL_VERIFICATION);
  assert.equal(filter.source.sourceConfidence, "Epävarma");
  assert.match(filter.expectedPattern, /ei ole mahdollinen/);
  for (const row of [28, 29, 30, 34]) {
    assert.ok(getVikadiagObdTestCandidateByRow(row).excludedActions.includes("active-test"));
  }
  for (const row of [32, 33, 34, 35, 36, 37]) {
    const item = getVikadiagObdTestCandidateByRow(row);
    assert.equal(item.obdRole, "indirect");
    assert.deepEqual(item.signalKeys, ["engine.rail_pressure_obd", "engine.rpm"]);
    assert.ok(item.missingSignals.length);
  }
  assert.match(getVikadiagObdTestCandidateByRow(35).limitations.join(" "), /ei vuotoa provosoivaa/i);
});

test("reviewed identity stays tied to the source PNC and OE, not a similar component", () => {
  const expected = [
    [11,"27020","27060-26030"], [12,"28100","28100-0R010"],
    [13,"31410","31420-53020"], [14,"37100","37100-53081"], [15,"37230","37230-30181"],
    [16,"11301K","90919-05029"], [17,"11401G","90919-05069"],
    [18,"17700","17700-26350"], [19,"17801","17801-26010"],
    [21,"17940D","17940-26010"], [22,"17111","17101-26110"], [23,"17177","17171-26010"],
    [25,"17201","17201-26011"], [29,"25819","25819-0R011"], [30,"25860","25860-0R010"],
    [31,"23265C","90917-11036"], [33,"23930","23930-26010"], [34,"22100","22100-0R031"],
    [37,"23122B","23769-26020"], [38,"13614A","13614-26010"]
  ];
  for (const [row,pnc,oe] of expected) {
    const item = getVikadiagObdTestCandidateByRow(row);
    assert.equal(item.pnc,pnc); assert.equal(item.oe,oe);
  }
});

test("brake and suspension rows 39-53 remain physical-only without fake ABS coverage", () => {
  for (let row = 39; row <= 53; row++) {
    const item = getVikadiagObdTestCandidateByRow(row);
    assert.equal(item.obdRole, "physical-only");
    assert.equal(item.readiness, VIKADIAG_TEST_READINESS.PHYSICAL_ONLY);
    assert.deepEqual(item.signalKeys, []);
    assert.deepEqual(item.signalEvidence, []);
    assert.equal(item.source.reviewedAt, "2026-09-15");
    assert.equal(item.source.range, `A${row}:O${row}`);
    assert.equal(item.recipes.length, 1);
    assert.equal(item.recipes[0].kind, "physical");
    assert.deepEqual(item.recipes[0].signalKeys, []);
    assert.ok(item.sourcePhysicalText);
  }
});

test("manual-grounded parking brake distinction does not silently rewrite Drive evidence", () => {
  const rear = getVikadiagObdTestCandidateByRow(46);
  assert.match(rear.sourcePhysicalText, /käsijarrumekanismin/);
  assert.match(rear.testMethod, /seisontajarrukengät erillisenä/);
  assert.match(rear.sourceClarification.manualSection, /rm000000v5v006x/);
  assert.equal(rear.manualVisual.imageSourcePath, "rm0150/repair2/img/c124896e02.png");
  assert.equal(getVikadiagObdTestCandidateByRow(40).manualVisual.imageSourcePath, "rm0150/repair2/img/c109132.png");
  assert.equal(rear.manualVisual.assetPath, "assets/repair-manual/c124896e02.png");
});

test("lower-arm OE shorthand retains independently read side and date evidence", () => {
  const arms = getVikadiagObdTestCandidateByRow(50);
  assert.equal(arms.oe, "48620-53020/30290; 48640-53020/30290");
  assert.deepEqual(arms.partEvidence.variants.map(v => [v.sourceRow, v.side, v.oe]), [
    [2846, "RH", "48620-53020"], [2847, "RH", "48620-30290"],
    [2860, "LH", "48640-53020"], [2861, "LH", "48640-30290"]
  ]);
  assert.equal(arms.partEvidence.status, "bom-identified-not-order-approved");
});

test("rows 54-68 distinguish physical coverage from pending ABS and EPS evidence", () => {
  for (const row of [54, 55, 56, 60, 63]) {
    const item = getVikadiagObdTestCandidateByRow(row);
    assert.equal(item.obdRole, "physical-only");
    assert.deepEqual(item.signalKeys, []);
    assert.equal(item.recipes.length, 1);
  }
  for (const row of [57, 58, 59]) {
    const item = getVikadiagObdTestCandidateByRow(row);
    assert.equal(item.obdRole, "indirect");
    assert.equal(item.readiness, VIKADIAG_TEST_READINESS.NEEDS_SIGNAL_VERIFICATION);
    assert.ok(item.missingSignals.length);
  }
  for (const row of [57, 58]) {
    const item = getVikadiagObdTestCandidateByRow(row);
    assert.deepEqual(item.signalKeys, []);
    assert.deepEqual(item.recipes.map(r => r.kind), ["physical"]);
  }
  assert.deepEqual(getVikadiagObdTestCandidateByRow(59).signalKeys, ["engine.ecu_voltage"]);
});

test("cooling and belt recipes use only existing temperature or voltage context", () => {
  for (const row of [61, 62, 64, 65, 66, 67, 68]) {
    const item = getVikadiagObdTestCandidateByRow(row);
    assert.equal(item.obdRole, "indirect");
    assert.equal(item.readiness, "indirect-existing-signals");
    assert.deepEqual(item.signalKeys, [[64, 65].includes(row) ? "engine.ecu_voltage" : "engine.coolant_temperature"]);
    assert.deepEqual(item.recipes.map(r => r.kind), ["physical", "cross-check"]);
    assert.deepEqual(item.recipes[0].signalKeys, []);
    assert.doesNotMatch(item.recipes[0].instruction, /ECT|ECU-jännite/);
    assert.deepEqual(item.recipes[1].signalKeys, item.signalKeys);
    assert.equal(item.manualVisual.status, "pending-extract");
  }
});

test("fan actuation and unsafe source procedures stay outside executable recipes", () => {
  const fan = getVikadiagObdTestCandidateByRow(67);
  assert.match(fan.sourceObdText, /active test/i);
  assert.ok(fan.excludedActions.includes("active-test"));
  assert.ok(fan.excludedActions.includes("ecu-write"));
  assert.equal(fan.missingSignals.length, 2);
  assert.doesNotMatch(fan.recipes.map(r => r.instruction).join(" "), /active test|suora syöttö/i);
  const belt = getVikadiagObdTestCandidateByRow(65);
  assert.match(belt.sourcePhysicalText, /Suihkepullotesti/);
  assert.doesNotMatch(belt.recipes.map(r => r.instruction).join(" "), /suihkepullo/i);
  assert.match(getVikadiagObdTestCandidateByRow(68).limitations.join(" "), /kuumaa korkkia ei avata/);
});

test("new row identities remain exact live Drive evidence including grouped OE values", () => {
  const expected = [[39,"47028","47028-53020"],[40,"44610","44610-53290"],[41,"44730/44750/44773","44730-28010; 44750-53150; 44750-53130"],[42,"04465/43512","04465-53040; 43512-30310"],[43,"47730/47750","47730-53060; 47750-53060"],[44,"47715A/47715D/47769","47715-22070; 47715-52190; 47769-50010"],[45,"04466/42431","04466-22190; 42431-30290"],[46,"47730B/47750A","47830-53070; 47850-53070"],[47,"47814/47769A/47775D","47814-30300; 47879-30300; 47875-30340"],[48,"43330K/43340A","43330-39625; 43340-39505"],[49,"48610/48630","48610-59065; 48630-59065"],[50,"48620/48640","48620-53020/30290; 48640-53020/30290"],[51,"48510/48520","48510-80359; 48520-59395"],[52,"48680","48680-53030"],[53,"48810/48820B/48815","48810-53010; 48820-53010; 48815-30570"],[54,"48530/48540","48530-80416; 48530-80416"],[55,"48231A/48231B","48231-53231"],[56,"48705/48706B/48710A/48720A/48730F/48740F","48705-53020; 48706-53020; 48710-53020; 48730-30090; 48740-30110"],[57,"43501C/43502C","43550-30020; 43560-30010"],[58,"42450A/42450B","42410-30020"],[59,"44200","44200-53130"],[60,"45460/45470/45503","45463-30130; 45464-30060; 45503-30070"],[61,"16100","16100-29495"],[62,"16271/16272A","16271-26010; 16272-26010"],[63,"16603/16604","16603-0R010; 16604-26011"],[64,"16620","16620-0R010"],[65,"16361A","90916-W2014"],[66,"16400","16400-26400"],[67,"16361/16363","16361-26110; 16363-26060; 16363-26070"],[68,"16470/16471","16470-26110; 16475-28120; 16475-51010"]];
  for (const [row, pnc, oe] of expected) {
    const item = getVikadiagObdTestCandidateByRow(row);
    assert.equal(item.pnc, pnc);
    assert.equal(item.oe, oe);
    assert.equal(item.source.row, row);
    assert.equal(item.source.range, `A${row}:O${row}`);
  }
});
