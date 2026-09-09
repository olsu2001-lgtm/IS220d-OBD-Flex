const G = 9.80665;
const AIR_GAS_CONSTANT = 287.05;
const KMH_TO_MPS = 1 / 3.6;

export const POWER_TEST_SCHEMA = "lexus-power-test-v1";

export const POWER_TEST_PRESETS = Object.freeze({
  zero100: Object.freeze({ id: "zero100", label: "0–100 km/h", startKmh: 0, endKmh: 100 }),
  eighty120: Object.freeze({ id: "eighty120", label: "80–120 km/h", startKmh: 80, endKmh: 120 }),
  zero60mph: Object.freeze({ id: "zero60mph", label: "0–60 mph (96,6 km/h)", startKmh: 0, endKmh: 96.56064 }),
  sixty120: Object.freeze({ id: "sixty120", label: "60–120 km/h", startKmh: 60, endKmh: 120 }),
  custom: Object.freeze({ id: "custom", label: "Mukautettu väli", startKmh: 0, endKmh: 100 })
});

export const VEHICLE_POWER_DEFAULTS = Object.freeze({
  is220d: Object.freeze({
    vehicleKey: "is220d",
    vehicleName: "Lexus IS220d · XE20 · 2AD-FHV",
    totalMassKg: 1700,
    dragCoefficient: 0.27,
    frontalAreaM2: 2.15,
    rollingResistanceCoefficient: 0.012,
    drivetrainEfficiency: 0.85,
    referencePowerKw: 130,
    referencePowerLabel: "177 DIN hv / 130 kW",
    referenceZero100Seconds: 8.9,
    powerLabel: "moottoriteho"
  }),
  ct200h: Object.freeze({
    vehicleKey: "ct200h",
    vehicleName: "Lexus CT 200h · ZWA10 · 2ZR-FXE hybridi",
    totalMassKg: 1470,
    dragCoefficient: 0.29,
    frontalAreaM2: 2.14,
    rollingResistanceCoefficient: 0.012,
    drivetrainEfficiency: 0.88,
    referencePowerKw: 100,
    referencePowerLabel: "136 DIN hv / 100 kW järjestelmäteho",
    referenceZero100Seconds: 10.3,
    powerLabel: "järjestelmäteho"
  })
});

function finite(value, fallback = NaN) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value, decimals = 3) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values, fraction) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const position = clamp(fraction, 0, 1) * (sorted.length - 1);
  const low = Math.floor(position);
  const high = Math.ceil(position);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

function standardDeviation(values) {
  const numbers = values.filter(Number.isFinite);
  if (numbers.length < 2) return null;
  const average = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  return Math.sqrt(numbers.reduce((sum, value) => sum + (value - average) ** 2, 0) / (numbers.length - 1));
}

function circularDifference(a, b) {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}

function circularMedian(values) {
  const candidates = values.filter(Number.isFinite);
  if (!candidates.length) return null;
  return candidates.reduce((best, candidate) => {
    const cost = candidates.reduce((sum, value) => sum + circularDifference(candidate, value), 0);
    return !best || cost < best.cost ? { value: candidate, cost } : best;
  }, null).value;
}

export function vehiclePowerDefaults(vehicleKey = "is220d") {
  return { ...(VEHICLE_POWER_DEFAULTS[vehicleKey] || VEHICLE_POWER_DEFAULTS.is220d) };
}

export function resolvePowerTestSettings(input = {}) {
  const vehicleKey = input.vehicleKey === "ct200h" ? "ct200h" : "is220d";
  const defaults = vehiclePowerDefaults(vehicleKey);
  const preset = POWER_TEST_PRESETS[input.presetId] || POWER_TEST_PRESETS.zero100;
  const custom = preset.id === "custom";
  const startKmh = clamp(finite(custom ? input.startKmh : preset.startKmh, preset.startKmh), 0, 150);
  const endKmh = clamp(finite(custom ? input.endKmh : preset.endKmh, preset.endKmh), startKmh + 10, 180);
  const drivetrainLossPercent = clamp(
    finite(input.drivetrainLossPercent, (1 - defaults.drivetrainEfficiency) * 100),
    0,
    35
  );
  return Object.freeze({
    presetId: preset.id,
    label: preset.id === "custom" ? `${round(startKmh, 1)}–${round(endKmh, 1)} km/h` : preset.label,
    startKmh,
    endKmh,
    vehicleKey,
    vehicleName: String(input.vehicleName || defaults.vehicleName),
    totalMassKg: clamp(finite(input.totalMassKg, defaults.totalMassKg), 500, 3500),
    roadGradePercent: clamp(finite(input.roadGradePercent, 0), -8, 8),
    ambientTemperatureC: clamp(finite(input.ambientTemperatureC, 15), -40, 55),
    ambientPressureKpa: clamp(finite(input.ambientPressureKpa, 101.3), 80, 110),
    dragCoefficient: clamp(finite(input.dragCoefficient, defaults.dragCoefficient), 0.15, 0.8),
    frontalAreaM2: clamp(finite(input.frontalAreaM2, defaults.frontalAreaM2), 1, 4.5),
    rollingResistanceCoefficient: clamp(finite(input.rollingResistanceCoefficient, defaults.rollingResistanceCoefficient), 0.005, 0.04),
    drivetrainLossPercent,
    drivetrainEfficiency: 1 - drivetrainLossPercent / 100,
    referencePowerKw: defaults.referencePowerKw,
    referencePowerLabel: defaults.referencePowerLabel,
    referenceZero100Seconds: defaults.referenceZero100Seconds,
    powerLabel: defaults.powerLabel,
    standingRolloutKmh: 0.5
  });
}

export function normalizePowerGpsSample(raw = {}) {
  const elapsedRealtimeNanos = finite(raw.elapsedRealtimeNanos);
  const monotonicMs = Number.isFinite(elapsedRealtimeNanos) && elapsedRealtimeNanos > 0
    ? elapsedRealtimeNanos / 1e6
    : finite(raw.monotonicMs, finite(raw.timestampMs, finite(raw.timestamp)));
  const speedMps = Number.isFinite(finite(raw.speedMps))
    ? finite(raw.speedMps)
    : finite(raw.speedKmh) * KMH_TO_MPS;
  const speedKmh = speedMps * 3.6;
  const speedAccuracyMps = finite(raw.speedAccuracyMps);
  const horizontalAccuracyM = finite(raw.horizontalAccuracyM, finite(raw.accuracyM, finite(raw.accuracy)));
  const verticalAccuracyM = finite(raw.verticalAccuracyM, finite(raw.altitudeAccuracy));
  const sample = {
    monotonicMs,
    timestampMs: finite(raw.timestampMs, finite(raw.timestamp, Date.now())),
    speedMps,
    speedKmh,
    speedAvailable: raw.speedAvailable !== false,
    speedAccuracyMps,
    horizontalAccuracyM,
    altitudeM: finite(raw.altitudeM, finite(raw.altitude)),
    verticalAccuracyM,
    bearingDeg: finite(raw.bearingDeg, finite(raw.heading)),
    bearingAccuracyDeg: finite(raw.bearingAccuracyDeg),
    provider: String(raw.provider || "gps"),
    mock: Boolean(raw.mock || raw.isMock),
    sequence: finite(raw.sequence),
    obd: raw.obd && typeof raw.obd === "object" ? { ...raw.obd } : {}
  };
  sample.valid = Number.isFinite(sample.monotonicMs) && Number.isFinite(sample.speedKmh) && sample.speedKmh >= 0 && sample.speedKmh <= 350;
  return sample;
}

function interpolateCrossing(previous, current, targetKmh) {
  const speedDelta = current.speedKmh - previous.speedKmh;
  const fraction = Math.abs(speedDelta) < 1e-9 ? 1 : clamp((targetKmh - previous.speedKmh) / speedDelta, 0, 1);
  const interpolateValue = (key) => Number.isFinite(previous[key]) && Number.isFinite(current[key])
    ? previous[key] + (current[key] - previous[key]) * fraction
    : Number.isFinite(current[key]) ? current[key] : previous[key];
  return {
    monotonicMs: previous.monotonicMs + (current.monotonicMs - previous.monotonicMs) * fraction,
    timestampMs: previous.timestampMs + (current.timestampMs - previous.timestampMs) * fraction,
    speedKmh: targetKmh,
    speedMps: targetKmh * KMH_TO_MPS,
    altitudeM: interpolateValue("altitudeM"),
    bearingDeg: Number.isFinite(current.bearingDeg) ? current.bearingDeg : previous.bearingDeg,
    synthetic: true
  };
}

function splitTargets(settings) {
  const targets = [];
  if (settings.startKmh < 1) {
    for (const value of [50, 60, 80, 96.56064, 100, 120, 150]) {
      if (value > settings.startKmh && value <= settings.endKmh + 1e-6) targets.push(value);
    }
  } else {
    for (const value of [100, 120, 150]) {
      if (value > settings.startKmh && value <= settings.endKmh + 1e-6) targets.push(value);
    }
  }
  if (!targets.some(value => Math.abs(value - settings.endKmh) < 0.01)) targets.push(settings.endKmh);
  return [...new Set(targets)].sort((a, b) => a - b);
}

export function createPowerTestRun(input = {}, metadata = {}) {
  const settings = resolvePowerTestSettings(input);
  return {
    schemaVersion: POWER_TEST_SCHEMA,
    id: String(metadata.id || `power-${Date.now()}`),
    appVersion: String(metadata.appVersion || ""),
    createdAt: finite(metadata.createdAt, Date.now()),
    vehicle: settings.vehicleName,
    vehicleKey: settings.vehicleKey,
    adapter: String(metadata.adapter || "OBD ei käytössä"),
    protocol: String(metadata.protocol || "GPS-päämittaus"),
    settings,
    status: "acquiring",
    statusText: "Haetaan tarkkaa GPS-signaalia",
    samples: [],
    rejectedSamples: [],
    splits: {},
    targetSpeedsKmh: splitTargets(settings),
    qualityStreak: 0,
    stationarySinceMs: null,
    armedAtMs: null,
    startedAtMs: null,
    endedAtMs: null,
    startCrossing: null,
    endCrossing: null,
    result: null,
    warnings: [],
    abortReason: ""
  };
}

function sampleQualityProblem(sample) {
  if (!sample.valid) return "GPS-näytteestä puuttuu kelvollinen aika tai nopeus";
  if (sample.mock) return "Android merkitsi sijaintinäytteen valesijainniksi";
  if (Number.isFinite(sample.horizontalAccuracyM) && sample.horizontalAccuracyM > 35) return "GPS:n sijaintitarkkuus on yli 35 m";
  if (Number.isFinite(sample.speedAccuracyMps) && sample.speedAccuracyMps > 2.5) return "GPS:n nopeustarkkuus on yli 2,5 m/s";
  return "";
}

function sampleGoodForArming(sample) {
  return sample.valid && !sample.mock &&
    (!Number.isFinite(sample.horizontalAccuracyM) || sample.horizontalAccuracyM <= 20) &&
    (!Number.isFinite(sample.speedAccuracyMps) || sample.speedAccuracyMps <= 1.2);
}

function addObdSnapshot(sample, obd = {}) {
  const numeric = {};
  for (const [key, value] of Object.entries(obd || {})) {
    const number = Number(value);
    if (Number.isFinite(number)) numeric[key] = number;
  }
  sample.obd = { ...sample.obd, ...numeric };
}

function startRunAtCrossing(run, crossing) {
  run.status = "running";
  run.statusText = `Mittaus käynnissä · tavoite ${round(run.settings.endKmh, 1)} km/h`;
  run.startCrossing = crossing;
  run.startedAtMs = crossing.monotonicMs;
  run.splits = {};
}

function abortRun(run, reason) {
  run.status = "aborted";
  run.statusText = "Mittaus keskeytyi";
  run.abortReason = String(reason || "Mittaus keskeytettiin");
  run.endedAtMs = run.samples.at(-1)?.monotonicMs || null;
}

export function cancelPowerTestRun(run, reason = "Käyttäjä keskeytti testin") {
  if (!run || ["complete", "aborted"].includes(run.status)) return run;
  abortRun(run, reason);
  return run;
}

export function ingestPowerTestSample(run, rawSample, obdSnapshot = {}) {
  if (!run || ["complete", "aborted"].includes(run.status)) return { type: "ignored", run };
  const sample = normalizePowerGpsSample(rawSample);
  addObdSnapshot(sample, obdSnapshot);
  const previousAll = run.samples.at(-1);
  if (previousAll && sample.monotonicMs <= previousAll.monotonicMs) return { type: "duplicate", run };
  const problem = !sample.speedAvailable && run.status === "running"
    ? "GPS ei ilmoittanut nopeutta käynnissä olevan vedon aikana"
    : sampleQualityProblem(sample);
  if (problem) {
    run.rejectedSamples.push({ ...sample, reason: problem });
    if (run.rejectedSamples.length > 100) run.rejectedSamples.shift();
    if (sample.mock) abortRun(run, problem);
    return { type: sample.mock ? "aborted" : "rejected", reason: problem, run };
  }
  run.samples.push(sample);
  const previous = run.samples.at(-2);
  run.qualityStreak = sampleGoodForArming(sample) ? run.qualityStreak + 1 : 0;

  if (run.status === "acquiring") {
    if (run.qualityStreak >= 3) {
      run.status = "ready";
      run.statusText = run.settings.startKmh < 1 ? "Pysähdy ja odota automaattista viritystä" : `Hidasta alle ${round(run.settings.startKmh - 3, 0)} km/h`;
      return { type: "ready", run };
    }
    return { type: "sample", run };
  }

  if (run.status === "ready") {
    if (run.settings.startKmh < 1) {
      if (sample.speedKmh <= 2.5) {
        run.stationarySinceMs ??= sample.monotonicMs;
        if (sample.monotonicMs - run.stationarySinceMs >= 1200) {
          run.status = "armed";
          run.armedAtMs = sample.monotonicMs;
          run.statusText = "VALMIS · lähde liikkeelle, ajanotto alkaa automaattisesti";
          return { type: "armed", run };
        }
      } else {
        run.stationarySinceMs = null;
      }
    } else if (sample.speedKmh <= run.settings.startKmh - 3) {
      run.status = "armed";
      run.armedAtMs = sample.monotonicMs;
      run.statusText = `VALMIS · ajanotto alkaa nopeudessa ${round(run.settings.startKmh, 0)} km/h`;
      return { type: "armed", run };
    }
    return { type: "sample", run };
  }

  if (run.status === "armed" && previous) {
    const target = run.settings.startKmh < 1 ? run.settings.standingRolloutKmh : run.settings.startKmh;
    if (previous.speedKmh <= target && sample.speedKmh > target) {
      const crossing = interpolateCrossing(previous, sample, target);
      crossing.reportedStartKmh = run.settings.startKmh;
      startRunAtCrossing(run, crossing);
      return { type: "started", crossing, run };
    }
    return { type: "sample", run };
  }

  if (run.status === "running" && previous) {
    const elapsedMs = sample.monotonicMs - run.startedAtMs;
    if (elapsedMs > 90000) {
      abortRun(run, "Tavoitenopeutta ei saavutettu 90 sekunnissa");
      return { type: "aborted", reason: run.abortReason, run };
    }
    if (run.settings.startKmh >= 20 && sample.speedKmh < run.settings.startKmh - 8) {
      abortRun(run, "Nopeus laski lähtörajan alle ennen tavoitenopeutta");
      return { type: "aborted", reason: run.abortReason, run };
    }
    for (const target of run.targetSpeedsKmh) {
      const key = target.toFixed(3);
      if (run.splits[key] || previous.speedKmh > target || sample.speedKmh < target) continue;
      const crossing = interpolateCrossing(previous, sample, target);
      run.splits[key] = {
        targetKmh: target,
        crossing,
        elapsedSeconds: (crossing.monotonicMs - run.startedAtMs) / 1000
      };
    }
    if (previous.speedKmh <= run.settings.endKmh && sample.speedKmh >= run.settings.endKmh) {
      const key = run.settings.endKmh.toFixed(3);
      const crossing = run.splits[key]?.crossing || interpolateCrossing(previous, sample, run.settings.endKmh);
      run.endCrossing = crossing;
      run.endedAtMs = crossing.monotonicMs;
      run.status = "complete";
      run.result = analyzePowerTestRun(run);
      run.statusText = run.result.valid ? "Mittaus valmis" : "Mittaus valmis · laatu ei riitä tehoarvioon";
      return { type: "complete", result: run.result, run };
    }
  }
  return { type: "sample", run };
}

function sampleAtBoundary(crossing, source = {}) {
  return {
    ...source,
    ...crossing,
    speedKmh: crossing.speedKmh,
    speedMps: crossing.speedKmh * KMH_TO_MPS,
    synthetic: true
  };
}

function analysisSeries(run) {
  if (!run.startCrossing || !run.endCrossing) return [];
  const inner = run.samples.filter(sample => sample.monotonicMs > run.startCrossing.monotonicMs && sample.monotonicMs < run.endCrossing.monotonicMs);
  const beforeStart = [...run.samples].reverse().find(sample => sample.monotonicMs <= run.startCrossing.monotonicMs) || {};
  const afterEnd = run.samples.find(sample => sample.monotonicMs >= run.endCrossing.monotonicMs) || {};
  return [sampleAtBoundary(run.startCrossing, beforeStart), ...inner, sampleAtBoundary(run.endCrossing, afterEnd)];
}

function environmentalModel(settings) {
  const theta = Math.atan(settings.roadGradePercent / 100);
  const airDensityKgM3 = settings.ambientPressureKpa * 1000 /
    (AIR_GAS_CONSTANT * (settings.ambientTemperatureC + 273.15));
  return {
    theta,
    airDensityKgM3,
    cdaM2: settings.dragCoefficient * settings.frontalAreaM2
  };
}

function segmentEnergy(previous, current, settings, environment) {
  const durationSeconds = (current.monotonicMs - previous.monotonicMs) / 1000;
  if (!(durationSeconds > 0)) return null;
  const v0 = previous.speedKmh * KMH_TO_MPS;
  const v1 = current.speedKmh * KMH_TO_MPS;
  const averageSpeed = (v0 + v1) / 2;
  const distanceM = averageSpeed * durationSeconds;
  const kineticJ = 0.5 * settings.totalMassKg * (v1 ** 2 - v0 ** 2);
  const rollingJ = settings.totalMassKg * G * settings.rollingResistanceCoefficient * Math.cos(environment.theta) * distanceM;
  const gradeJ = settings.totalMassKg * G * Math.sin(environment.theta) * distanceM;
  const dragJ = 0.5 * environment.airDensityKgM3 * environment.cdaM2 * averageSpeed ** 3 * durationSeconds;
  return {
    durationSeconds,
    distanceM,
    kineticJ,
    rollingJ,
    gradeJ,
    dragJ,
    totalJ: kineticJ + rollingJ + gradeJ + dragJ
  };
}

function robustPeakPowerKw(series, settings, environment) {
  if (series.length < 3) return null;
  const cumulative = [{ time: series[0].monotonicMs, energyJ: 0 }];
  let total = 0;
  for (let index = 1; index < series.length; index++) {
    const segment = segmentEnergy(series[index - 1], series[index], settings, environment);
    if (!segment) continue;
    total += segment.totalJ;
    cumulative.push({ time: series[index].monotonicMs, energyJ: total });
  }
  const windows = [];
  for (let end = 1; end < cumulative.length; end++) {
    let bestStart = -1;
    let bestDifference = Infinity;
    for (let start = end - 1; start >= 0; start--) {
      const duration = cumulative[end].time - cumulative[start].time;
      if (duration < 700) continue;
      if (duration > 1800) break;
      const difference = Math.abs(duration - 1000);
      if (difference < bestDifference) {
        bestDifference = difference;
        bestStart = start;
      }
    }
    if (bestStart < 0) continue;
    const durationSeconds = (cumulative[end].time - cumulative[bestStart].time) / 1000;
    const powerKw = (cumulative[end].energyJ - cumulative[bestStart].energyJ) / durationSeconds / 1000;
    if (Number.isFinite(powerKw) && powerKw > 0) windows.push(powerKw);
  }
  return percentile(windows, 0.9);
}

function qualityMetrics(series) {
  const real = series.filter(sample => !sample.synthetic);
  const gaps = [];
  for (let index = 1; index < series.length; index++) gaps.push(series[index].monotonicMs - series[index - 1].monotonicMs);
  const durationSeconds = (series.at(-1).monotonicMs - series[0].monotonicMs) / 1000;
  const sampleRateHz = real.length > 1 && durationSeconds > 0 ? (real.length - 1) / durationSeconds : 0;
  const bearings = real
    .filter(sample => sample.speedKmh >= 20 && Number.isFinite(sample.bearingDeg) && (!Number.isFinite(sample.bearingAccuracyDeg) || sample.bearingAccuracyDeg <= 25))
    .map(sample => sample.bearingDeg);
  const centralBearing = circularMedian(bearings);
  const maximumBearingDeviationDeg = Number.isFinite(centralBearing)
    ? Math.max(0, ...bearings.map(value => circularDifference(value, centralBearing)))
    : null;
  const obdSpeedDifferences = real
    .filter(sample => Number.isFinite(sample.obd?.speed))
    .map(sample => Math.abs(sample.speedKmh - sample.obd.speed));
  return {
    acceptedSamples: real.length,
    sampleRateHz,
    maximumGapMs: gaps.length ? Math.max(...gaps) : null,
    medianGapMs: median(gaps),
    medianHorizontalAccuracyM: median(real.map(sample => sample.horizontalAccuracyM)),
    medianSpeedAccuracyMps: median(real.map(sample => sample.speedAccuracyMps)),
    maximumBearingDeviationDeg,
    medianObdGpsDifferenceKmh: median(obdSpeedDifferences),
    obdComparisonSamples: obdSpeedDifferences.length,
    speedNoiseKmh: standardDeviation(real.slice(0, Math.min(5, real.length)).map(sample => sample.speedKmh))
  };
}

function qualityAssessment(metrics, run) {
  let score = 100;
  const warnings = [];
  if (metrics.sampleRateHz < 1.5) { score -= 40; warnings.push("GPS-näytetaajuus jäi alle 1,5 Hz:n"); }
  else if (metrics.sampleRateHz < 4) { score -= 20; warnings.push("GPS-näytetaajuus jäi alle 4 Hz:n"); }
  if (Number.isFinite(metrics.maximumGapMs) && metrics.maximumGapMs > 2000) { score -= 35; warnings.push("GPS-näytteiden väli ylitti 2,0 s"); }
  else if (Number.isFinite(metrics.maximumGapMs) && metrics.maximumGapMs > 900) { score -= 15; warnings.push("GPS-näytteiden väli ylitti 0,9 s"); }
  if (Number.isFinite(metrics.medianSpeedAccuracyMps) && metrics.medianSpeedAccuracyMps > 1.2) { score -= 30; warnings.push("GPS:n mediaaninopeustarkkuus oli heikko"); }
  else if (Number.isFinite(metrics.medianSpeedAccuracyMps) && metrics.medianSpeedAccuracyMps > 0.6) { score -= 12; warnings.push("GPS:n nopeustarkkuus oli vain kohtalainen"); }
  if (Number.isFinite(metrics.medianHorizontalAccuracyM) && metrics.medianHorizontalAccuracyM > 20) { score -= 25; warnings.push("GPS:n sijaintitarkkuus oli yli 20 m"); }
  else if (Number.isFinite(metrics.medianHorizontalAccuracyM) && metrics.medianHorizontalAccuracyM > 10) { score -= 10; warnings.push("GPS:n sijaintitarkkuus oli yli 10 m"); }
  if (Number.isFinite(metrics.maximumBearingDeviationDeg) && metrics.maximumBearingDeviationDeg > 25) { score -= 35; warnings.push("Ajolinja kääntyi yli 25° testin aikana"); }
  else if (Number.isFinite(metrics.maximumBearingDeviationDeg) && metrics.maximumBearingDeviationDeg > 12) { score -= 15; warnings.push("Ajolinja ei ollut täysin suora"); }
  if (metrics.obdComparisonSamples >= 3 && Number.isFinite(metrics.medianObdGpsDifferenceKmh) && metrics.medianObdGpsDifferenceKmh > 8) {
    score -= 15;
    warnings.push("OBD- ja GPS-nopeuden mediaaniero ylitti 8 km/h");
  }
  if (run.rejectedSamples.length > 3) { score -= Math.min(15, run.rejectedSamples.length); warnings.push(`${run.rejectedSamples.length} GPS-näytettä hylättiin`); }
  score = clamp(score, 0, 100);
  const confidence = score >= 85 ? "high" : score >= 65 ? "medium" : "low";
  const confidenceText = confidence === "high" ? "hyvä" : confidence === "medium" ? "kohtalainen" : "heikko";
  const valid = score >= 65 && metrics.sampleRateHz >= 1.5 && metrics.acceptedSamples >= 4 && Number.isFinite(metrics.maximumGapMs) && metrics.maximumGapMs <= 2000;
  return { score, confidence, confidenceText, valid, warnings };
}

function obdSummary(series) {
  const keys = ["speed", "rpm", "load", "pedal", "pedalE", "maf", "map", "boostPressure", "barometricPressure", "ctHvSoc", "ctHvCurrent", "ctHvPackPower", "ctHvPackVoltage", "ctHvBlockDelta", "ctHvTemperatureMax"];
  const result = {};
  for (const key of keys) {
    const values = series.map(sample => finite(sample.obd?.[key])).filter(Number.isFinite);
    if (!values.length) continue;
    result[key] = {
      samples: values.length,
      minimum: Math.min(...values),
      maximum: Math.max(...values),
      average: values.reduce((sum, value) => sum + value, 0) / values.length
    };
  }
  return result;
}

export function analyzePowerTestRun(run) {
  const series = analysisSeries(run);
  if (series.length < 2) return { valid: false, quality: { score: 0, confidence: "low", confidenceText: "heikko" }, warnings: ["Mittauksen alku- tai loppuraja puuttuu"] };
  const settings = run.settings;
  const environment = environmentalModel(settings);
  const segments = [];
  for (let index = 1; index < series.length; index++) {
    const segment = segmentEnergy(series[index - 1], series[index], settings, environment);
    if (segment) segments.push(segment);
  }
  const totals = segments.reduce((sum, segment) => ({
    durationSeconds: sum.durationSeconds + segment.durationSeconds,
    distanceM: sum.distanceM + segment.distanceM,
    kineticJ: sum.kineticJ + segment.kineticJ,
    rollingJ: sum.rollingJ + segment.rollingJ,
    gradeJ: sum.gradeJ + segment.gradeJ,
    dragJ: sum.dragJ + segment.dragJ,
    totalJ: sum.totalJ + segment.totalJ
  }), { durationSeconds: 0, distanceM: 0, kineticJ: 0, rollingJ: 0, gradeJ: 0, dragJ: 0, totalJ: 0 });
  const averageWheelPowerKw = totals.durationSeconds > 0 ? totals.totalJ / totals.durationSeconds / 1000 : null;
  const peakWheelPowerKw = robustPeakPowerKw(series, settings, environment);
  const averageSystemPowerKw = Number.isFinite(averageWheelPowerKw) ? averageWheelPowerKw / settings.drivetrainEfficiency : null;
  const peakSystemPowerKw = Number.isFinite(peakWheelPowerKw) ? peakWheelPowerKw / settings.drivetrainEfficiency : null;
  const metrics = qualityMetrics(series);
  const quality = qualityAssessment(metrics, run);
  const elapsedSeconds = totals.durationSeconds;
  const splits = Object.values(run.splits)
    .sort((a, b) => a.targetKmh - b.targetKmh)
    .map(split => ({ targetKmh: split.targetKmh, elapsedSeconds: split.elapsedSeconds }));
  const exactZero100 = settings.startKmh < 1 && Math.abs(settings.endKmh - 100) < 0.1;
  const baselineTimeDifferencePercent = exactZero100
    ? (elapsedSeconds / settings.referenceZero100Seconds - 1) * 100
    : null;
  const referencePowerPercent = Number.isFinite(peakSystemPowerKw)
    ? peakSystemPowerKw / settings.referencePowerKw * 100
    : null;
  const warnings = [...quality.warnings];
  if (Math.abs(settings.roadGradePercent) > 1) warnings.push("Tieprosentti vaikuttaa tehoarvioon voimakkaasti");
  if (settings.startKmh < 1) warnings.push(`Ajanotto käyttää ${settings.standingRolloutKmh.toFixed(1).replace(".", ",")} km/h GPS-lähtökynnystä`);
  warnings.push("Tehoarvio ei korvaa dynamometrimittausta");
  return {
    valid: quality.valid,
    elapsedSeconds,
    distanceM: totals.distanceM,
    splits,
    averageWheelPowerKw,
    peakWheelPowerKw,
    averageSystemPowerKw,
    peakSystemPowerKw,
    averageWheelPowerHp: Number.isFinite(averageWheelPowerKw) ? averageWheelPowerKw * 1.359621617 : null,
    peakWheelPowerHp: Number.isFinite(peakWheelPowerKw) ? peakWheelPowerKw * 1.359621617 : null,
    averageSystemPowerHp: Number.isFinite(averageSystemPowerKw) ? averageSystemPowerKw * 1.359621617 : null,
    peakSystemPowerHp: Number.isFinite(peakSystemPowerKw) ? peakSystemPowerKw * 1.359621617 : null,
    referencePowerPercent,
    baselineTimeDifferencePercent,
    quality: { ...quality, metrics },
    environment: {
      airDensityKgM3: environment.airDensityKgM3,
      cdaM2: environment.cdaM2,
      kineticEnergyKj: totals.kineticJ / 1000,
      rollingEnergyKj: totals.rollingJ / 1000,
      gradeEnergyKj: totals.gradeJ / 1000,
      dragEnergyKj: totals.dragJ / 1000
    },
    obd: obdSummary(series),
    warnings
  };
}

function fi(value, decimals = 1) {
  return Number.isFinite(value) ? Number(value).toFixed(decimals).replace(".", ",") : "ei saatavilla";
}

function confidenceLabel(result) {
  return `${result.quality.confidenceText} (${Math.round(result.quality.score)}/100)`;
}

export function buildPowerTestReport(run) {
  const result = run?.result || analyzePowerTestRun(run || {});
  const settings = run.settings;
  const lines = [
    "BEGIN LEXUS OBD FLEX POWER TEST REPORT",
    `Raporttimuoto: ${POWER_TEST_SCHEMA}`,
    `Flex-versio: ${run.appVersion || "tuntematon"}`,
    `Raporttitunnus: ${run.id}`,
    `Aika: ${new Date(run.createdAt).toISOString()}`,
    `Ajoneuvo: ${run.vehicle}`,
    `Testi: ${settings.label}`,
    `Tila: ${result.valid ? "hyväksytty vertailuun" : "mittaus valmis, tehoarvion laatu riittämätön"}`,
    "",
    "KIIHTYVYYS",
    `Kokonaisaika: ${fi(result.elapsedSeconds, 3)} s`,
    `Arvioitu matka: ${fi(result.distanceM, 1)} m`,
    ...result.splits.map(split => `${fi(settings.startKmh, 1)}–${fi(split.targetKmh, split.targetKmh % 1 ? 1 : 0)} km/h: ${fi(split.elapsedSeconds, 3)} s`),
    Number.isFinite(result.baselineTimeDifferencePercent)
      ? `Ero Lexus-vertailuaikaan ${fi(settings.referenceZero100Seconds, 1)} s: ${result.baselineTimeDifferencePercent >= 0 ? "+" : ""}${fi(result.baselineTimeDifferencePercent, 1)} %`
      : "Virallista vertailuaikaa ei sovelleta tälle nopeusvälille",
    "",
    "TEHOARVIO",
    `Keskimääräinen vetopyöräteho: ${fi(result.averageWheelPowerKw, 1)} kW / ${fi(result.averageWheelPowerHp, 0)} hv`,
    `Robusti GPS-huipputehon arvio vetopyöriltä: ${fi(result.peakWheelPowerKw, 1)} kW / ${fi(result.peakWheelPowerHp, 0)} hv`,
    `Häviökorjattu ${settings.powerLabel}arvio: ${fi(result.peakSystemPowerKw, 1)} kW / ${fi(result.peakSystemPowerHp, 0)} hv`,
    `Arvio suhteessa vertailutehoon ${settings.referencePowerLabel}: ${fi(result.referencePowerPercent, 1)} %`,
    "Tehoarvio on ajodynamiikkamalli, ei dynamometrin mittaustulos eikä todistus moottorin kunnosta.",
    "",
    "MITTAUSLAATU",
    `Luottamus: ${confidenceLabel(result)}`,
    `Hyväksyttyjä GPS-näytteitä: ${result.quality.metrics.acceptedSamples}`,
    `GPS-näytetaajuus: ${fi(result.quality.metrics.sampleRateHz, 2)} Hz`,
    `Suurin näyteväli: ${fi(result.quality.metrics.maximumGapMs, 0)} ms`,
    `Mediaani nopeustarkkuus: ${fi(result.quality.metrics.medianSpeedAccuracyMps, 2)} m/s`,
    `Mediaani sijaintitarkkuus: ${fi(result.quality.metrics.medianHorizontalAccuracyM, 1)} m`,
    `Suurin suunnan poikkeama: ${fi(result.quality.metrics.maximumBearingDeviationDeg, 1)}°`,
    `OBD–GPS-mediaaniero: ${fi(result.quality.metrics.medianObdGpsDifferenceKmh, 1)} km/h (${result.quality.metrics.obdComparisonSamples} vertailunäytettä)`,
    `Hylättyjä GPS-näytteitä: ${run.rejectedSamples.length}`,
    "",
    "MALLIN ASETUKSET",
    `Kokonaismassa: ${fi(settings.totalMassKg, 0)} kg`,
    `Tien pituuskaltevuus: ${fi(settings.roadGradePercent, 2)} %`,
    `Ulkolämpötila: ${fi(settings.ambientTemperatureC, 1)} °C`,
    `Ilmanpaine: ${fi(settings.ambientPressureKpa, 1)} kPa`,
    `Ilmantiheys: ${fi(result.environment.airDensityKgM3, 3)} kg/m³`,
    `Cd × otsapinta-ala: ${fi(result.environment.cdaM2, 3)} m²`,
    `Vierintävastuskerroin: ${fi(settings.rollingResistanceCoefficient, 3)}`,
    `Voimansiirtohäviöoletus: ${fi(settings.drivetrainLossPercent, 1)} %`,
    "",
    "OBD-YHTEENVETO"
  ];
  const obdEntries = Object.entries(result.obd || {});
  if (!obdEntries.length) lines.push("OBD-livearvoja ei ollut käytettävissä; GPS-ajanotto toimii silti.");
  for (const [key, summary] of obdEntries) {
    lines.push(`${key}: min ${fi(summary.minimum, 2)} · max ${fi(summary.maximum, 2)} · ka ${fi(summary.average, 2)} · n=${summary.samples}`);
  }
  lines.push("", "HUOMAUTUKSET");
  for (const warning of result.warnings || []) lines.push(`- ${warning}`);
  lines.push("", "GPS_SAMPLE_TSV_BEGIN");
  lines.push("time_s\tgps_kmh\tspeed_accuracy_mps\thorizontal_accuracy_m\taltitude_m\tbearing_deg\tobd_kmh\trpm\tload_pct\tpedal_pct\tmaf_gps\tct_hv_kw");
  const origin = run.startCrossing?.monotonicMs || run.samples[0]?.monotonicMs || 0;
  for (const sample of run.samples) {
    if (sample.monotonicMs < origin - 3000 || sample.monotonicMs > (run.endCrossing?.monotonicMs || Infinity) + 1000) continue;
    lines.push([
      fi((sample.monotonicMs - origin) / 1000, 3),
      fi(sample.speedKmh, 3),
      fi(sample.speedAccuracyMps, 3),
      fi(sample.horizontalAccuracyM, 2),
      fi(sample.altitudeM, 2),
      fi(sample.bearingDeg, 2),
      fi(sample.obd?.speed, 2),
      fi(sample.obd?.rpm, 0),
      fi(sample.obd?.load, 1),
      fi(sample.obd?.pedal, 1),
      fi(sample.obd?.maf, 2),
      fi(sample.obd?.ctHvPackPower, 2)
    ].join("\t"));
  }
  lines.push("GPS_SAMPLE_TSV_END", "END LEXUS OBD FLEX POWER TEST REPORT");
  return lines.join("\n");
}

export function powerTestToCsv(run) {
  const result = run.result || analyzePowerTestRun(run);
  const origin = run.startCrossing?.monotonicMs || run.samples[0]?.monotonicMs || 0;
  const header = [
    "schema_version", "run_id", "vehicle_key", "test", "time_s", "gps_speed_kmh", "speed_accuracy_mps",
    "horizontal_accuracy_m", "altitude_m", "bearing_deg", "obd_speed_kmh", "rpm", "load_pct", "pedal_pct",
    "maf_g_s", "ct_hv_power_kw", "result_seconds", "estimated_peak_wheel_kw", "estimated_peak_system_kw", "quality_score"
  ];
  const escape = value => {
    const text = value == null || Number.isNaN(value) ? "" : String(value);
    return /[;\r\n"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows = run.samples.map(sample => [
    POWER_TEST_SCHEMA, run.id, run.vehicleKey, run.settings.label,
    round((sample.monotonicMs - origin) / 1000, 3), round(sample.speedKmh, 3), round(sample.speedAccuracyMps, 3),
    round(sample.horizontalAccuracyM, 2), round(sample.altitudeM, 2), round(sample.bearingDeg, 2),
    round(sample.obd?.speed, 2), round(sample.obd?.rpm, 0), round(sample.obd?.load, 1), round(sample.obd?.pedal, 1),
    round(sample.obd?.maf, 2), round(sample.obd?.ctHvPackPower, 2), round(result.elapsedSeconds, 3),
    round(result.peakWheelPowerKw, 2), round(result.peakSystemPowerKw, 2), round(result.quality?.score, 0)
  ].map(escape).join(";"));
  return [header.join(";"), ...rows].join("\r\n");
}

export function buildPowerTestAnalysisPrompt(run) {
  const result = run.result || analyzePowerTestRun(run);
  return [
    `Analysoi Lexus OBD Flex ${run.appVersion || ""} -tehotesti ajoneuvolle ${run.vehicle}.`,
    `Testi oli ${run.settings.label}, tulos ${fi(result.elapsedSeconds, 3)} s ja mittauslaatu ${confidenceLabel(result)}.`,
    "Erottele kiihtyvyysaika, toistettavuus, GPS/OBD-mittauslaatu ja ajodynamiikkamallin tehoarvio.",
    "Älä käsittele laskettua tehoa dynamometrimittauksena tai varmana moottorin kuntoprosenttina.",
    "Tarkista erityisesti massa, tieprosentti, GPS-näytetaajuus, nopeustarkkuus, näytekatkot, ajolinjan suoruus ja OBD–GPS-ero ennen johtopäätöstä.",
    `Vertailuarvo on ${run.settings.referencePowerLabel}${run.settings.presetId === "zero100" ? ` ja valmistajan 0–100-aika ${fi(run.settings.referenceZero100Seconds, 1)} s` : ""}.`
  ].join("\n");
}

export function comparePowerTestRuns(runs = [], currentRun = null) {
  const completed = runs.filter(run => run?.status === "complete" && run?.result && (!currentRun || run.id !== currentRun.id));
  const matching = currentRun
    ? completed.filter(run => run.vehicleKey === currentRun.vehicleKey && run.settings?.presetId === currentRun.settings?.presetId)
    : completed;
  const times = matching.map(run => run.result.elapsedSeconds).filter(Number.isFinite);
  const powers = matching.map(run => run.result.peakSystemPowerKw).filter(Number.isFinite);
  return {
    count: matching.length,
    bestSeconds: times.length ? Math.min(...times) : null,
    averageSeconds: times.length ? times.reduce((sum, value) => sum + value, 0) / times.length : null,
    timeSpreadSeconds: times.length >= 2 ? Math.max(...times) - Math.min(...times) : null,
    averagePeakSystemPowerKw: powers.length ? powers.reduce((sum, value) => sum + value, 0) / powers.length : null
  };
}

export class NativePowerGpsSource {
  constructor(nativeBridge = globalThis.powerGps, geolocation = globalThis.navigator?.geolocation) {
    this.bridge = nativeBridge;
    this.geolocation = geolocation;
    this.timer = null;
    this.watchId = null;
    this.handler = null;
    this.errorHandler = null;
  }

  nativeAvailable() {
    return Boolean(this.bridge?.start && this.bridge?.drainSamples && this.bridge?.stop);
  }

  async start(handler, errorHandler = () => {}) {
    this.stop();
    this.handler = handler;
    this.errorHandler = errorHandler;
    if (this.nativeAvailable()) {
      const response = String(this.bridge.start());
      if (response.startsWith("__ERROR__")) throw new Error(response.slice(9));
      this.timer = setInterval(() => this.drainNative(), 80);
      return { source: "android-location-gps", highAccuracy: true };
    }
    if (!this.geolocation?.watchPosition) throw new Error("Puhelimen GPS-silta ei ole käytettävissä");
    this.watchId = this.geolocation.watchPosition(position => {
      const coords = position.coords || {};
      handler({
        monotonicMs: performance.now(),
        timestampMs: position.timestamp,
        speedMps: coords.speed,
        horizontalAccuracyM: coords.accuracy,
        altitudeM: coords.altitude,
        verticalAccuracyM: coords.altitudeAccuracy,
        bearingDeg: coords.heading,
        provider: "web-geolocation"
      });
    }, error => errorHandler(new Error(error?.message || "GPS-virhe")), {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000
    });
    return { source: "web-geolocation", highAccuracy: true };
  }

  drainNative() {
    if (!this.nativeAvailable()) return;
    try {
      const raw = String(this.bridge.drainSamples() || "[]");
      if (raw.startsWith("__ERROR__")) throw new Error(raw.slice(9));
      const samples = JSON.parse(raw);
      for (const sample of Array.isArray(samples) ? samples : []) this.handler?.(sample);
      const error = String(this.bridge.getLastError?.() || "");
      if (error) this.errorHandler?.(new Error(error));
    } catch (error) {
      this.errorHandler?.(error);
    }
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    if (this.watchId != null && this.geolocation?.clearWatch) this.geolocation.clearWatch(this.watchId);
    this.watchId = null;
    if (this.nativeAvailable()) this.bridge.stop();
  }
}
