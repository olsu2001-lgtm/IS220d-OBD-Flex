import test from "node:test";
import assert from "node:assert/strict";
import {
  IS220D_REPAIR_MANUAL_CHASSIS_VISUAL_CANDIDATES,
  getIs220dRepairManualChassisVisualCandidate,
  getIs220dRepairManualChassisVisualCandidateByRow
} from "../src/is220d-repair-manual-visual-candidates-chassis.js";
import { getIs220dRepairManualVisuals } from "../src/is220d-repair-manual-visuals.js";

const EXPECTED_ROWS = [13, 14, 15, 39, 41, 42, 43, 44, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60];

test("chassis manual-image continuation contains twenty-two exact reviewed mappings", () => {
  assert.equal(IS220D_REPAIR_MANUAL_CHASSIS_VISUAL_CANDIDATES.length, 22);
  assert.deepEqual(
    IS220D_REPAIR_MANUAL_CHASSIS_VISUAL_CANDIDATES.map(item => item.sourceRow).sort((a, b) => a - b),
    EXPECTED_ROWS
  );
  assert.equal(new Set(IS220D_REPAIR_MANUAL_CHASSIS_VISUAL_CANDIDATES.map(item => item.sourceRow)).size, 22);
  assert.equal(new Set(IS220D_REPAIR_MANUAL_CHASSIS_VISUAL_CANDIDATES.map(item => item.componentId)).size, 22);
});

test("chassis source records retain exact RM0150 provenance without pretending packaging", () => {
  for (const item of IS220D_REPAIR_MANUAL_CHASSIS_VISUAL_CANDIDATES) {
    assert.ok(["2AD-FHV", "vehicle-common"].includes(item.manualScope));
    assert.equal(item.status, "source-identified");
    assert.match(item.sourceImagePath, /^rm0150\/repair2\/img\/[a-z0-9]+\.png$/);
    assert.match(item.manualReference, /^rm0150\/repair2\/html\/contents\/rm[a-z0-9]+\.html$/);
    assert.match(item.sourceImageSha256, /^[a-f0-9]{64}$/);
    assert.match(item.sourceHtmlSha256, /^[a-f0-9]{64}$/);
    assert.equal(item.targetAssetPath, `assets/repair-manual/${item.sourceImagePath.split("/").at(-1)}`);
    assert.equal(Object.isFrozen(item), true);
    assert.deepEqual(getIs220dRepairManualVisuals(item.componentId), []);
  }
});

test("engine-specific drivetrain figures are explicitly scoped to 2AD-FHV", () => {
  for (const row of [13, 14, 15]) {
    assert.equal(getIs220dRepairManualChassisVisualCandidateByRow(row)?.manualScope, "2AD-FHV");
  }
  for (const row of EXPECTED_ROWS.filter(row => ![13, 14, 15].includes(row))) {
    assert.equal(getIs220dRepairManualChassisVisualCandidateByRow(row)?.manualScope, "vehicle-common");
  }
});

test("shared suspension figures map only to labels actually supported by the manual drawing", () => {
  assert.equal(getIs220dRepairManualChassisVisualCandidate("chassis.front_lower_ball_joints")?.sourceImagePath, "rm0150/repair2/img/c125074e03.png");
  assert.equal(getIs220dRepairManualChassisVisualCandidate("chassis.front_lower_arms")?.sourceImagePath, "rm0150/repair2/img/c125074e03.png");
  const stabilizer = getIs220dRepairManualChassisVisualCandidate("chassis.front_stabilizer_links_bushes");
  assert.equal(stabilizer?.sourceImagePath, "rm0150/repair2/img/c125074e03.png");
  assert.match(stabilizer?.caption || "", /ei nimeä vakaajan runkopuslaa/i);
  assert.equal(getIs220dRepairManualChassisVisualCandidate("chassis.front_shocks")?.sourceImagePath, "rm0150/repair2/img/c128188e02.png");
  assert.equal(getIs220dRepairManualChassisVisualCandidate("chassis.front_suspension_supports")?.sourceImagePath, "rm0150/repair2/img/c128188e02.png");
  assert.equal(getIs220dRepairManualChassisVisualCandidate("chassis.rear_shocks")?.sourceImagePath, "rm0150/repair2/img/c117331e02.png");
  assert.equal(getIs220dRepairManualChassisVisualCandidate("chassis.rear_springs")?.sourceImagePath, "rm0150/repair2/img/c117331e02.png");
  assert.equal(getIs220dRepairManualChassisVisualCandidate("chassis.rear_links_arms")?.sourceImagePath, "rm0150/repair2/img/c125841e01.png");
  assert.equal(getIs220dRepairManualChassisVisualCandidate("drivetrain.rear_hubs")?.sourceImagePath, "rm0150/repair2/img/c125841e01.png");
});

test("front and rear brake candidates preserve distinct component drawings", () => {
  assert.equal(getIs220dRepairManualChassisVisualCandidate("brakes.front_pads_discs")?.sourceImagePath, "rm0150/repair2/img/c110259e04.png");
  assert.equal(getIs220dRepairManualChassisVisualCandidate("brakes.front_calipers")?.sourceImagePath, "rm0150/repair2/img/c110260e06.png");
  assert.equal(getIs220dRepairManualChassisVisualCandidate("brakes.front_caliper_slides")?.sourceImagePath, "rm0150/repair2/img/c110260e06.png");
  assert.equal(getIs220dRepairManualChassisVisualCandidate("brakes.rear_caliper_slides")?.sourceImagePath, "rm0150/repair2/img/c110251e01.png");
  assert.equal(getIs220dRepairManualChassisVisualCandidate("brakes.booster_vacuum_hoses")?.sourceImagePath, "rm0150/repair2/img/c105676e14.png");
});

test("steering and hub mappings remain source-only orientation aids", () => {
  assert.equal(getIs220dRepairManualChassisVisualCandidate("drivetrain.front_hubs")?.sourceImagePath, "rm0150/repair2/img/c127362e02.png");
  assert.equal(getIs220dRepairManualChassisVisualCandidate("steering.eps_rack")?.sourceImagePath, "rm0150/repair2/img/c131885e01.png");
  assert.equal(getIs220dRepairManualChassisVisualCandidate("steering.tie_rods")?.sourceImagePath, "rm0150/repair2/img/c107878e02.png");
  for (const item of IS220D_REPAIR_MANUAL_CHASSIS_VISUAL_CANDIDATES) {
    assert.equal("signalKeys" in item, false);
    assert.equal("readiness" in item, false);
    assert.equal("command" in item, false);
    assert.equal("threshold" in item, false);
  }
});
