import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  DPF_EGR_CAPTURE_PHASES,
  analyzeDpfEgrCaptureBundle,
  buildDpfEgrCaptureTemplate,
  parseDpfEgrCaptureBundle
} from "../src/dpf-egr-capture-analysis.js";

function trace(commandHex, payloadHex) {
  const id = commandHex.slice(2);
  const responseService = commandHex.startsWith("22") ? "62" : "61";
  const requestLength = commandHex.startsWith("22") ? "03" : "02";
  return [
    `TX 7E0 ${requestLength} ${commandHex.match(/../g).join(" ")} 00 00 00 00`,
    `RX 7E8 07 ${responseService} ${id.match(/../g).join(" ")} ${payloadHex.match(/../g).join(" ")}`
  ].join("\n");
}

test("capture template describes DPF RPM phases and EGR Techstream step phases", () => {
  const template = JSON.parse(buildDpfEgrCaptureTemplate());
  assert.equal(template.schemaVersion, 1);
  assert.equal(template.calibrationId, "35360000");
  assert.ok(template.phases.some(phase => phase.id === "dpf-koeo"));
  assert.ok(template.phases.some(phase => phase.id === "dpf-3000"));
  assert.ok(template.phases.some(phase => phase.id === "egr-step-80"));
  assert.match(template.warning, /does not authorize/i);
  assert.ok(DPF_EGR_CAPTURE_PHASES.length >= 10);
});

test("linear research correlation finds a synthetic 16-bit BE DPF channel", () => {
  const pressureValues = [0, 0.8, 2.1, 4.0, 6.2, 9.0];
  const rawValues = pressureValues.map(value => Math.round((value + 5) / 0.01));
  const phases = pressureValues.map((value, index) => ({
    id: `dpf-${index}`,
    techstream: { dpfDifferentialPressureKpa: value },
    trace: trace("21A1", rawValues[index].toString(16).padStart(4, "0").toUpperCase() + "55")
  }));
  const result = analyzeDpfEgrCaptureBundle({
    schemaVersion: 1,
    vehicle: "Lexus IS220d / 2AD-FHV",
    calibrationId: "35360000",
    phases
  });
  assert.equal(result.dpf.status, "research-candidates");
  const best = result.dpf.candidates[0];
  assert.equal(best.command, "21A1");
  assert.equal(best.featureKey, "u16be@0");
  assert.equal(best.strength, "strong-research-candidate");
  assert.ok(best.r2 > 0.999);
  assert.ok(Math.abs(best.slope - 0.01) < 0.0001);
  assert.ok(Math.abs(best.intercept + 5) < 0.05);
  assert.equal(result.productionVerified, false);
  assert.equal(result.authorizationChanged, false);
});

test("linear research correlation finds a synthetic EGR byte without promoting it", () => {
  const lift = [10, 25, 40, 55, 70, 85];
  const phases = lift.map((value, index) => {
    const raw = Math.round(value * 255 / 100);
    return {
      id: `egr-${index}`,
      techstream: { egrLiftSensorPercent: value },
      trace: trace("21B2", raw.toString(16).padStart(2, "0").toUpperCase() + "99AA")
    };
  });
  const result = analyzeDpfEgrCaptureBundle({ schemaVersion: 1, phases });
  const best = result.egr.candidates[0];
  assert.equal(best.command, "21B2");
  assert.equal(best.featureKey, "u8@0");
  assert.ok(best.r2 > 0.999);
  assert.equal(result.egr.productionVerified, false);
  assert.equal(result.egr.vehicleCommandSent, false);
});

test("constant target values do not produce a false decoder candidate", () => {
  const phases = Array.from({ length: 6 }, (_, index) => ({
    id: `idle-${index}`,
    techstream: { dpfDifferentialPressureKpa: 0.5 },
    trace: trace("21A1", (100 + index).toString(16).padStart(4, "0") + "00")
  }));
  const result = analyzeDpfEgrCaptureBundle({ schemaVersion: 1, phases });
  assert.equal(result.dpf.candidates.length, 0);
  assert.equal(result.dpf.status, "no-correlation");
});

test("invalid bundles fail closed", () => {
  const parsed = parseDpfEgrCaptureBundle("{bad json");
  assert.equal(parsed.valid, false);
  const result = analyzeDpfEgrCaptureBundle(parsed);
  assert.equal(result.dpf.status, "invalid");
  assert.equal(result.egr.status, "invalid");
});

test("capture correlation module has no vehicle transport or authorization path", () => {
  const source = fs.readFileSync(new URL("../src/dpf-egr-capture-analysis.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /NativeElm|NativeBle|state\.client|safeCommand\s*\(|ATSH|ATCRA|\.send\s*\(|productionAuthorized|TOYOTA_READ_DATA_ALLOWED_COMMANDS/i);
  assert.match(source, /authorizationChanged:\s*false/);
  assert.match(source, /vehicleCommandSent:\s*false/);
  assert.match(source, /productionVerified:\s*false/);
});
