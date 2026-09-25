import { analyzeTechstreamDataListTrace } from "./techstream-data-list-gap.js";

export const DPF_EGR_CAPTURE_SCHEMA_VERSION = 1;

export const DPF_EGR_CAPTURE_PHASES = Object.freeze([
  Object.freeze({ id: "dpf-koeo", label: "DPF · KOEO", target: "dpfDifferentialPressureKpa", instruction: "Virrat ON, moottori sammuksissa. Tallenna Techstreamin DPF Differential Pressure ja 10 s J2534-jälki." }),
  Object.freeze({ id: "dpf-idle", label: "DPF · lämmin tyhjäkäynti", target: "dpfDifferentialPressureKpa", instruction: "Moottori lämmin ja tyhjäkäynti vakaa. Tallenna paine, RPM, MAF ja 15 s jälki." }),
  Object.freeze({ id: "dpf-1500", label: "DPF · 1500 rpm", target: "dpfDifferentialPressureKpa", instruction: "Pidä noin 1500 rpm ilman kuormaa. Tallenna paine, RPM, MAF ja 15 s jälki." }),
  Object.freeze({ id: "dpf-2000", label: "DPF · 2000 rpm", target: "dpfDifferentialPressureKpa", instruction: "Pidä noin 2000 rpm ilman kuormaa. Tallenna paine, RPM, MAF ja 15 s jälki." }),
  Object.freeze({ id: "dpf-2500", label: "DPF · 2500 rpm", target: "dpfDifferentialPressureKpa", instruction: "Pidä noin 2500 rpm ilman kuormaa. Tallenna paine, RPM, MAF ja 15 s jälki." }),
  Object.freeze({ id: "dpf-3000", label: "DPF · 3000 rpm", target: "dpfDifferentialPressureKpa", instruction: "Pidä noin 3000 rpm ilman kuormaa. Tallenna paine, RPM, MAF ja 15 s jälki." }),
  Object.freeze({ id: "egr-idle", label: "EGR · lämmin tyhjäkäynti", target: "egrLiftSensorPercent", instruction: "Tallenna Techstreamin EGR Lift Sensor Output ja 15 s J2534-jälki." }),
  Object.freeze({ id: "egr-step-20", label: "EGR · Techstream step 20", target: "egrLiftSensorPercent", instruction: "Techstream Control the EGR Step Position = 20. Tallenna EGR Lift Sensor Output ja 10 s jälki." }),
  Object.freeze({ id: "egr-step-40", label: "EGR · Techstream step 40", target: "egrLiftSensorPercent", instruction: "Techstream Control the EGR Step Position = 40. Tallenna EGR Lift Sensor Output ja 10 s jälki." }),
  Object.freeze({ id: "egr-step-60", label: "EGR · Techstream step 60", target: "egrLiftSensorPercent", instruction: "Techstream Control the EGR Step Position = 60. Tallenna EGR Lift Sensor Output ja 10 s jälki." }),
  Object.freeze({ id: "egr-step-80", label: "EGR · Techstream step 80", target: "egrLiftSensorPercent", instruction: "Techstream Control the EGR Step Position = 80. Tallenna EGR Lift Sensor Output ja 10 s jälki." })
]);

const TARGET_META = Object.freeze({
  dpfDifferentialPressureKpa: Object.freeze({ label: "DPF Differential Pressure", unit: "kPa", minimumRange: 0.5 }),
  egrLiftSensorPercent: Object.freeze({ label: "EGR Lift Sensor Output", unit: "%", minimumRange: 5 })
});

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function median(values) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function bytesFromHex(value) {
  const hex = String(value || "").replace(/[^0-9A-F]/gi, "").toUpperCase();
  const bytes = [];
  for (let index = 0; index + 1 < hex.length; index += 2) bytes.push(Number.parseInt(hex.slice(index, index + 2), 16));
  return bytes;
}

function featuresFromPayload(payloadHex) {
  const bytes = bytesFromHex(payloadHex);
  const features = [];
  for (let offset = 0; offset < bytes.length; offset += 1) {
    features.push({ key: `u8@${offset}`, offset, width: 1, endian: "na", value: bytes[offset] });
    if (offset + 1 < bytes.length) {
      features.push({ key: `u16be@${offset}`, offset, width: 2, endian: "be", value: bytes[offset] * 256 + bytes[offset + 1] });
      features.push({ key: `u16le@${offset}`, offset, width: 2, endian: "le", value: bytes[offset + 1] * 256 + bytes[offset] });
    }
  }
  return features;
}

function medianFeatures(captures) {
  const buckets = new Map();
  for (const capture of captures || []) {
    for (const feature of featuresFromPayload(capture?.payloadHex)) {
      let bucket = buckets.get(feature.key);
      if (!bucket) {
        bucket = { ...feature, values: [] };
        buckets.set(feature.key, bucket);
      }
      bucket.values.push(feature.value);
    }
  }
  return [...buckets.values()].map(bucket => Object.freeze({
    key: bucket.key,
    offset: bucket.offset,
    width: bucket.width,
    endian: bucket.endian,
    value: median(bucket.values),
    sampleCount: bucket.values.length
  }));
}

function linearFit(points) {
  const clean = points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (clean.length < 4) return null;
  const distinctX = new Set(clean.map(point => point.x)).size;
  const distinctY = new Set(clean.map(point => point.y)).size;
  if (distinctX < 3 || distinctY < 3) return null;
  const xMean = clean.reduce((sum, point) => sum + point.x, 0) / clean.length;
  const yMean = clean.reduce((sum, point) => sum + point.y, 0) / clean.length;
  const denominator = clean.reduce((sum, point) => sum + (point.x - xMean) ** 2, 0);
  if (!denominator) return null;
  const slope = clean.reduce((sum, point) => sum + (point.x - xMean) * (point.y - yMean), 0) / denominator;
  const intercept = yMean - slope * xMean;
  const predictions = clean.map(point => slope * point.x + intercept);
  const ssResidual = clean.reduce((sum, point, index) => sum + (point.y - predictions[index]) ** 2, 0);
  const ssTotal = clean.reduce((sum, point) => sum + (point.y - yMean) ** 2, 0);
  const r2 = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;
  const rmse = Math.sqrt(ssResidual / clean.length);
  const yValues = clean.map(point => point.y);
  const targetRange = Math.max(...yValues) - Math.min(...yValues);
  const normalizedRmse = targetRange > 0 ? rmse / targetRange : Infinity;
  return { slope, intercept, r2, rmse, normalizedRmse, targetRange, distinctX, distinctY, count: clean.length };
}

function candidateStrength(fit, targetKey) {
  const minRange = TARGET_META[targetKey]?.minimumRange ?? 1;
  if (!fit || fit.targetRange < minRange) return "insufficient-variation";
  if (fit.count >= 5 && fit.distinctX >= 5 && fit.distinctY >= 5 && fit.r2 >= 0.995 && fit.normalizedRmse <= 0.03) return "strong-research-candidate";
  if (fit.count >= 4 && fit.distinctX >= 4 && fit.distinctY >= 4 && fit.r2 >= 0.98 && fit.normalizedRmse <= 0.08) return "research-candidate";
  return "weak-correlation";
}

function normalizePhase(raw, index) {
  const targetValues = raw?.techstream || {};
  return Object.freeze({
    id: String(raw?.id || `phase-${index + 1}`),
    note: String(raw?.note || ""),
    techstream: Object.freeze({
      dpfDifferentialPressureKpa: finite(targetValues.dpfDifferentialPressureKpa),
      egrLiftSensorPercent: finite(targetValues.egrLiftSensorPercent),
      engineSpeedRpm: finite(targetValues.engineSpeedRpm),
      mafGps: finite(targetValues.mafGps)
    }),
    trace: String(raw?.trace || "")
  });
}

export function parseDpfEgrCaptureBundle(textOrObject) {
  let raw = textOrObject;
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { return Object.freeze({ valid: false, errors: Object.freeze(["JSON ei aukea"]), phases: Object.freeze([]) }); }
  }
  const errors = [];
  if (!raw || Number(raw.schemaVersion) !== DPF_EGR_CAPTURE_SCHEMA_VERSION) errors.push(`schemaVersion pitää olla ${DPF_EGR_CAPTURE_SCHEMA_VERSION}`);
  const phases = Array.isArray(raw?.phases) ? raw.phases.slice(0, 40).map(normalizePhase) : [];
  if (!phases.length) errors.push("phases puuttuu");
  const phaseIds = phases.map(phase => phase.id);
  if (new Set(phaseIds).size !== phaseIds.length) errors.push("phase-id:t pitää olla yksilöllisiä");
  const calibrationId = String(raw?.calibrationId || "").trim();
  if (calibrationId !== "35360000") errors.push("calibrationId pitää olla target-auton 35360000");
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    vehicle: String(raw?.vehicle || ""),
    calibrationId,
    phases: Object.freeze(phases)
  });
}

function phaseCommandFeatures(phase) {
  const analysis = analyzeTechstreamDataListTrace(phase.trace);
  const commands = new Map();
  for (const pair of analysis.allPairs || []) {
    if (pair.fieldRejected) continue;
    commands.set(pair.command, {
      command: pair.command,
      responsePrefix: pair.responsePrefix,
      currentProductionCommand: pair.currentProductionCommand === true,
      features: medianFeatures(pair.captures)
    });
  }
  return { phase, analysis, commands };
}

export function correlateDpfEgrCaptureBundle(bundleInput, targetKey) {
  const parsed = typeof bundleInput?.valid === "boolean" ? bundleInput : parseDpfEgrCaptureBundle(bundleInput);
  const meta = TARGET_META[targetKey];
  if (!parsed.valid || !meta) {
    return Object.freeze({
      targetKey,
      targetLabel: meta?.label || targetKey,
      candidates: Object.freeze([]),
      status: "invalid",
      errors: Object.freeze(parsed.errors || ["Tuntematon target"])
    });
  }

  const phaseData = parsed.phases.map(phaseCommandFeatures);
  const buckets = new Map();
  for (const entry of phaseData) {
    const target = entry.phase.techstream[targetKey];
    if (!Number.isFinite(target)) continue;
    for (const command of entry.commands.values()) {
      for (const feature of command.features) {
        const key = `${command.command}|${feature.key}`;
        let bucket = buckets.get(key);
        if (!bucket) {
          bucket = {
            command: command.command,
            responsePrefix: command.responsePrefix,
            currentProductionCommand: command.currentProductionCommand,
            featureKey: feature.key,
            offset: feature.offset,
            width: feature.width,
            endian: feature.endian,
            points: []
          };
          buckets.set(key, bucket);
        }
        if (Number.isFinite(feature.value)) bucket.points.push({ phaseId: entry.phase.id, x: feature.value, y: target });
      }
    }
  }

  const candidates = [];
  for (const bucket of buckets.values()) {
    const fit = linearFit(bucket.points);
    if (!fit) continue;
    const strength = candidateStrength(fit, targetKey);
    candidates.push(Object.freeze({
      command: bucket.command,
      responsePrefix: bucket.responsePrefix,
      currentProductionCommand: bucket.currentProductionCommand,
      featureKey: bucket.featureKey,
      byteOffset: bucket.offset,
      widthBytes: bucket.width,
      endian: bucket.endian,
      phaseCount: fit.count,
      slope: fit.slope,
      intercept: fit.intercept,
      r2: fit.r2,
      rmse: fit.rmse,
      normalizedRmse: fit.normalizedRmse,
      targetRange: fit.targetRange,
      strength,
      formula: `value = raw * ${fit.slope.toPrecision(10)} + ${fit.intercept.toPrecision(10)}`,
      points: Object.freeze(bucket.points.map(Object.freeze))
    }));
  }

  const strengthRank = value => value === "strong-research-candidate" ? 2 : value === "research-candidate" ? 1 : 0;
  candidates.sort((a, b) => {
    const rankDifference = strengthRank(b.strength) - strengthRank(a.strength);
    if (rankDifference) return rankDifference;
    const r2Difference = b.r2 - a.r2;
    if (Math.abs(r2Difference) > 1e-9) return r2Difference;
    const errorDifference = a.normalizedRmse - b.normalizedRmse;
    if (Math.abs(errorDifference) > 1e-9) return errorDifference;
    return a.widthBytes - b.widthBytes ||
      b.phaseCount - a.phaseCount ||
      a.byteOffset - b.byteOffset ||
      a.command.localeCompare(b.command);
  });

  const usablePhases = parsed.phases.filter(phase => Number.isFinite(phase.techstream[targetKey])).length;
  const qualifiedCandidates = candidates.filter(candidate => candidate.strength === "research-candidate" || candidate.strength === "strong-research-candidate");
  const weakCandidates = candidates.filter(candidate => !qualifiedCandidates.includes(candidate));
  return Object.freeze({
    schemaVersion: DPF_EGR_CAPTURE_SCHEMA_VERSION,
    targetKey,
    targetLabel: meta.label,
    unit: meta.unit,
    usablePhases,
    qualifiedCandidateCount: qualifiedCandidates.length,
    status: usablePhases < 4 ? "need-more-phases" : qualifiedCandidates.length ? "research-candidates" : "no-correlation",
    candidates: Object.freeze(qualifiedCandidates.slice(0, 30)),
    weakCandidates: Object.freeze(weakCandidates.slice(0, 30)),
    authorizationChanged: false,
    vehicleCommandSent: false,
    productionVerified: false,
    errors: Object.freeze([])
  });
}

export function analyzeDpfEgrCaptureBundle(bundleInput) {
  const parsed = typeof bundleInput?.valid === "boolean" ? bundleInput : parseDpfEgrCaptureBundle(bundleInput);
  return Object.freeze({
    schemaVersion: DPF_EGR_CAPTURE_SCHEMA_VERSION,
    bundle: parsed,
    dpf: correlateDpfEgrCaptureBundle(parsed, "dpfDifferentialPressureKpa"),
    egr: correlateDpfEgrCaptureBundle(parsed, "egrLiftSensorPercent"),
    authorizationChanged: false,
    vehicleCommandSent: false,
    productionVerified: false
  });
}

export function buildDpfEgrCaptureTemplate() {
  const phases = DPF_EGR_CAPTURE_PHASES.map(phase => ({
    id: phase.id,
    note: phase.instruction,
    techstream: {
      dpfDifferentialPressureKpa: phase.target === "dpfDifferentialPressureKpa" ? null : null,
      egrLiftSensorPercent: phase.target === "egrLiftSensorPercent" ? null : null,
      engineSpeedRpm: null,
      mafGps: null
    },
    trace: ""
  }));
  return JSON.stringify({
    schemaVersion: DPF_EGR_CAPTURE_SCHEMA_VERSION,
    vehicle: "Lexus IS220d / 2AD-FHV",
    calibrationId: "35360000",
    warning: "Research evidence only. This bundle does not authorize a vehicle command or production decoder.",
    phases
  }, null, 2);
}

function lineForCandidate(candidate, unit) {
  return `${candidate.command} ${candidate.featureKey} | n=${candidate.phaseCount} | R2=${candidate.r2.toFixed(5)} | RMSE=${candidate.rmse.toFixed(4)} ${unit} | ${candidate.formula} | ${candidate.strength}`;
}

export function buildDpfEgrCaptureReport(result = analyzeDpfEgrCaptureBundle({})) {
  const lines = [
    "===== LEXUS IS220D DPF/EGR PASSIVE CAPTURE ANALYSIS =====",
    `Schema: ${DPF_EGR_CAPTURE_SCHEMA_VERSION}`,
    `Bundle valid: ${result.bundle?.valid ? "yes" : "no"}`,
    `Vehicle: ${result.bundle?.vehicle || "unknown"}`,
    `Calibration: ${result.bundle?.calibrationId || "unknown"}`,
    "Policy: passive Techstream/J2534 evidence only; no vehicle command sent; no automatic allowlist/profile change",
    "",
    `DPF Differential Pressure: ${result.dpf?.status || "unknown"} · phases=${result.dpf?.usablePhases || 0}`
  ];
  for (const candidate of (result.dpf?.candidates || []).slice(0, 10)) lines.push(`  ${lineForCandidate(candidate, "kPa")}`);
  lines.push("", `EGR Lift Sensor Output: ${result.egr?.status || "unknown"} · phases=${result.egr?.usablePhases || 0}`);
  for (const candidate of (result.egr?.candidates || []).slice(0, 10)) lines.push(`  ${lineForCandidate(candidate, "%")}`);
  lines.push("", "Promotion gate: candidate must be reviewed against raw target-vehicle captures and then reproduced by Flex against Techstream in matching operating states before production publication.");
  return `${lines.join("\n")}\n`;
}
