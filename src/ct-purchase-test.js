/**
 * Lexus CT 200h purchase inspection.
 *
 * These are transparent Flex screening bands, not Lexus/Toyota fault limits.
 * The result deliberately has no capacity/SOH percentage: OBD block balance,
 * temperatures and DTCs cannot prove the remaining battery capacity.
 */

export const CT_PURCHASE_THRESHOLDS = Object.freeze({
  maximumMetricAgeMs: 2200,
  minimumRoadDurationMs: 10 * 60 * 1000,
  baselineCurrentAbsMaxA: 5,
  dischargeCurrentMinA: 20,
  chargeCurrentMaxA: -15,
  minimumSamples: Object.freeze({ baseline: 3, discharge: 5, charge: 5 }),
  blockDeltaAttentionV: 0.2,
  blockDeltaStrongConcernV: 0.3,
  resistanceSpreadAttentionOhm: 0.003,
  temperatureAttentionC: 50,
  temperatureStrongConcernC: 55,
  temperatureSpreadAttentionC: 8,
  recentClearDistanceKm: 100,
  recentClearWarmups: 5
});

const PHASE_LABELS = Object.freeze({
  baseline: "paikallaan / pieni virta",
  discharge: "purku / kiihdytys",
  charge: "lataus / regenerointi",
  transition: "siirtymä",
  invalid: "hylätty näyte"
});

const MONITORS = Object.freeze([
  ["misfire", "Sytytyskatkokset", 1, 0, 1, 4],
  ["fuel", "Polttoainejärjestelmä", 1, 1, 1, 5],
  ["components", "Kattavat komponentit", 1, 2, 1, 6],
  ["catalyst", "Katalysaattori", 2, 0, 3, 0],
  ["heatedCatalyst", "Lämmitetty katalysaattori", 2, 1, 3, 1],
  ["evap", "Haihtumispäästöt", 2, 2, 3, 2],
  ["secondaryAir", "Toisioilma", 2, 3, 3, 3],
  ["acRefrigerant", "A/C-kylmäaine", 2, 4, 3, 4],
  ["oxygenSensor", "Happianturi", 2, 5, 3, 5],
  ["oxygenHeater", "Happianturin lämmitin", 2, 6, 3, 6],
  ["egr", "EGR/VVT", 2, 7, 3, 7]
]);

const finite = value => Number.isFinite(Number(value));
const number = value => finite(value) ? Number(value) : null;
const compactHex = value => String(value || "").replace(/[^0-9a-f]/gi, "").toUpperCase();
const rounded = (value, decimals = 3) => finite(value) ? Number(Number(value).toFixed(decimals)) : null;
const formatNumber = (value, decimals = 1, fallback = "–") => finite(value)
  ? Number(value).toFixed(decimals).replace(".", ",")
  : fallback;

function modePidBytes(raw, mode, pid) {
  const target = `${Number(mode).toString(16).padStart(2, "0")}${Number(pid).toString(16).padStart(2, "0")}`.toUpperCase();
  for (const line of String(raw || "").replace(/>/g, "\n").split(/[\r\n]+/)) {
    const hex = compactHex(line);
    const index = hex.indexOf(target);
    if (index < 0) continue;
    return hex.slice(index + target.length).match(/../g)?.map(byte => Number.parseInt(byte, 16)) || [];
  }
  return null;
}

export function parseCtReadiness(raw) {
  const bytes = modePidBytes(raw, 0x41, 0x01);
  if (!bytes || bytes.length < 4) return null;
  const monitors = MONITORS.map(([id, label, supportByte, supportBit, incompleteByte, incompleteBit]) => ({
    id,
    label,
    supported: Boolean(bytes[supportByte] & (1 << supportBit)),
    complete: !(bytes[incompleteByte] & (1 << incompleteBit))
  })).filter(monitor => monitor.supported);
  return Object.freeze({
    milOn: Boolean(bytes[0] & 0x80),
    dtcCount: bytes[0] & 0x7f,
    ignitionType: bytes[1] & 0x08 ? "compression" : "spark",
    monitors: Object.freeze(monitors.map(Object.freeze)),
    supportedCount: monitors.length,
    incompleteCount: monitors.filter(monitor => !monitor.complete).length,
    raw: String(raw || "")
  });
}

export function decodeCtPurchasePid(raw, pid) {
  const id = Number(pid) & 0xff;
  const bytes = modePidBytes(raw, 0x41, id);
  if (!bytes?.length) return null;
  const word = bytes.length >= 2 ? bytes[0] * 256 + bytes[1] : null;
  const decoders = {
    0x05: () => bytes[0] - 40,
    0x06: () => (bytes[0] - 128) * 100 / 128,
    0x07: () => (bytes[0] - 128) * 100 / 128,
    0x0c: () => word / 4,
    0x2c: () => bytes[0] * 100 / 255,
    0x2d: () => (bytes[0] - 128) * 100 / 128,
    0x30: () => bytes[0],
    0x31: () => word,
    0x42: () => word / 1000,
    0x4d: () => word,
    0x4e: () => word
  };
  const value = decoders[id]?.();
  return finite(value) ? Number(value) : null;
}

export function createCtPurchaseInspection({
  appVersion = "",
  startedAt = Date.now(),
  candidate = {},
  adapter = {},
  manual = {}
} = {}) {
  return {
    schemaVersion: 1,
    kind: "lexus-ct200h-purchase-inspection",
    id: `CTPI-${new Date(startedAt).toISOString().replace(/[-:.TZ]/g, "").slice(0, 17)}`,
    appVersion,
    vehicleKey: "ct200h",
    startedAt,
    endedAt: null,
    candidate: {
      modelYear: String(candidate.modelYear || ""),
      odometerKm: String(candidate.odometerKm || ""),
      vinOrRegistration: String(candidate.vinOrRegistration || ""),
      note: String(candidate.note || "")
    },
    adapter: { ...adapter },
    manual: {
      coldStart: manual.coldStart || "not_checked",
      warningLamps: manual.warningLamps || "not_checked",
      brakePump: manual.brakePump || "not_checked",
      serviceHistory: manual.serviceHistory || "not_checked"
    },
    preflight: null,
    postflight: null,
    roadSegments: [],
    samples: [],
    rawEvents: []
  };
}

export function classifyCtPurchaseSample(values = {}, valueAgesMs = {}, thresholds = CT_PURCHASE_THRESHOLDS) {
  const blockIds = Array.from({ length: 14 }, (_, index) => `ctHvBlockVoltage${String(index + 1).padStart(2, "0")}`);
  const requiredIds = [...blockIds, "ctHvCurrent"];
  const missing = requiredIds.filter(id => !finite(values[id]));
  const stale = requiredIds.filter(id => finite(valueAgesMs[id]) && Number(valueAgesMs[id]) > thresholds.maximumMetricAgeMs);
  if (missing.length || stale.length) return Object.freeze({ phase: "invalid", missing: Object.freeze(missing), stale: Object.freeze(stale) });
  const currentA = Number(values.ctHvCurrent);
  const speedKmh = number(values.speed);
  let phase = "transition";
  if (Math.abs(currentA) <= thresholds.baselineCurrentAbsMaxA && (speedKmh == null || speedKmh <= 3)) phase = "baseline";
  else if (currentA >= thresholds.dischargeCurrentMinA) phase = "discharge";
  else if (currentA <= thresholds.chargeCurrentMaxA) phase = "charge";
  return Object.freeze({ phase, missing: Object.freeze([]), stale: Object.freeze([]) });
}

export function createCtPurchaseSample({ timestamp = Date.now(), values = {}, valueAgesMs = {}, raw = {} } = {}) {
  const classification = classifyCtPurchaseSample(values, valueAgesMs);
  const blocks = Array.from({ length: 14 }, (_, index) => number(values[`ctHvBlockVoltage${String(index + 1).padStart(2, "0")}`]));
  const finiteBlocks = blocks.filter(finite).map(Number);
  const blockMinimumV = finiteBlocks.length === 14 ? Math.min(...finiteBlocks) : null;
  const blockMaximumV = finiteBlocks.length === 14 ? Math.max(...finiteBlocks) : null;
  return {
    timestamp,
    phase: classification.phase,
    blockVoltagesV: blocks,
    blockMinimumV,
    blockMaximumV,
    blockDeltaV: finite(blockMinimumV) && finite(blockMaximumV) ? blockMaximumV - blockMinimumV : null,
    blockMinimumIndex: finite(blockMinimumV) ? blocks.findIndex(value => value === blockMinimumV) + 1 : null,
    currentA: number(values.ctHvCurrent),
    socPercent: number(values.ctHvSoc),
    deltaSocPercent: number(values.ctHvDeltaSoc),
    temperaturesC: [values.ctHvTemperature1, values.ctHvTemperature2, values.ctHvTemperature3].map(number),
    temperatureMaximumC: number(values.ctHvTemperatureMax),
    temperatureDeltaC: number(values.ctHvTemperatureDelta),
    resistanceDeltaOhm: number(values.ctHvResistanceDelta),
    speedKmh: number(values.speed),
    rpm: number(values.rpm),
    valueAgesMs: { ...valueAgesMs },
    rejectedBecause: classification.phase === "invalid" ? { missing: [...classification.missing], stale: [...classification.stale] } : null,
    raw: { ...raw }
  };
}

function percentile(values, p) {
  const sorted = values.filter(finite).map(Number).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function summarizePhase(samples, phase) {
  const selected = samples.filter(sample => sample.phase === phase);
  const deltas = selected.map(sample => sample.blockDeltaV).filter(finite);
  const currents = selected.map(sample => sample.currentA).filter(finite).map(Number);
  const minimumCounts = new Map();
  for (const sample of selected) {
    if (!Number.isInteger(sample.blockMinimumIndex)) continue;
    minimumCounts.set(sample.blockMinimumIndex, (minimumCounts.get(sample.blockMinimumIndex) || 0) + 1);
  }
  const dominant = [...minimumCounts.entries()].sort((a, b) => b[1] - a[1])[0] || [null, 0];
  return Object.freeze({
    phase,
    label: PHASE_LABELS[phase],
    sampleCount: selected.length,
    maximumBlockDeltaV: rounded(deltas.length ? Math.max(...deltas) : null),
    p95BlockDeltaV: rounded(percentile(deltas, 0.95)),
    minimumCurrentA: rounded(currents.length ? Math.min(...currents) : null, 1),
    maximumCurrentA: rounded(currents.length ? Math.max(...currents) : null, 1),
    dominantMinimumBlock: dominant[0],
    dominantMinimumShare: selected.length ? rounded(dominant[1] / selected.length, 2) : 0
  });
}

function collectDtcs(inspection) {
  const result = [];
  for (const [stage, snapshot] of [["ennen koeajoa", inspection.preflight], ["koeajon jälkeen", inspection.postflight]]) {
    for (const [source, codes] of Object.entries(snapshot?.standardDtcs || {})) {
      for (const item of codes || []) result.push({ code: String(item.code || item), source: `${stage} · ${source}` });
    }
    for (const group of snapshot?.vehicleDtcs?.groups || []) {
      for (const item of group.codes || []) result.push({ code: String(item.code || item), source: `${stage} · ${group.id || group.label}` });
    }
  }
  const seen = new Set();
  return result.filter(item => item.code && !seen.has(`${item.source}:${item.code}`) && seen.add(`${item.source}:${item.code}`));
}

function groupCoverage(inspection, prefix, stage = "preflight") {
  const groups = inspection?.[stage]?.vehicleDtcs?.groups || [];
  const requiredIds = prefix === "hybrid."
    ? ["hybrid.permanent_dtcs", "hybrid.stored_dtcs"]
    : prefix === "brake."
      ? ["brake.stored_dtcs_candidate"]
      : [];
  return requiredIds.length > 0 && requiredIds.every(id => groups.some(group => group.id === id && group.validResponse === true));
}

export function analyzeCtPurchaseInspection(inspection, thresholds = CT_PURCHASE_THRESHOLDS) {
  const samples = inspection?.samples || [];
  const phases = Object.freeze({
    baseline: summarizePhase(samples, "baseline"),
    discharge: summarizePhase(samples, "discharge"),
    charge: summarizePhase(samples, "charge")
  });
  const findings = [];
  const add = (severity, code, title, detail) => findings.push(Object.freeze({ severity, code, title, detail }));
  const identification = inspection.preflight?.identification || {};
  const readiness = inspection.postflight?.readiness || inspection.preflight?.readiness || null;
  const pids = inspection.preflight?.standardPids || {};
  const dtcs = collectDtcs(inspection);
  const dtcCodes = new Set(dtcs.map(item => item.code.toUpperCase()));

  for (const code of ["P0A80", "P3000"]) {
    if (dtcCodes.has(code)) add("stop", `dtc-${code}`, `${code} löytyi`, "Hybridijärjestelmän vikakoodi vaatii Lexus-korjausohjeen mukaisen diagnoosin ja mahdollisen INF-lisäkoodin ennen kauppaa.");
  }
  for (const code of ["C1391", "C1252", "C1253", "C1256"]) {
    if (dtcCodes.has(code)) add("stop", `dtc-${code}`, `${code} löytyi jarrujärjestelmästä`, "CT 200h:n jarrutehostin-/pumppujärjestelmä pitää tutkia ammattilaisella ennen kauppaa.");
  }
  if (dtcCodes.has("P0401")) add("attention", "dtc-P0401", "P0401 / EGR-virtaus", "Selvitä EGR-järjestelmä ja kylmäkäynnin mahdollinen ravistus ennen kauppaa.");
  if (["P0300", "P0301", "P0302", "P0303", "P0304"].some(code => dtcCodes.has(code))) {
    add("stop", "dtc-misfire", "Sytytyskatkoskoodeja löytyi", "Moottorin syy pitää selvittää ennen kauppaa; pelkkä koodien nollaus ei ole hyväksyttävä varmistus.");
  }

  const loadSamples = [...samples.filter(sample => sample.phase === "discharge"), ...samples.filter(sample => sample.phase === "charge")];
  const maxLoadDelta = loadSamples.map(sample => sample.blockDeltaV).filter(finite).reduce((max, value) => Math.max(max, Number(value)), -Infinity);
  const weakCounts = new Map();
  for (const sample of loadSamples) {
    if (Number.isInteger(sample.blockMinimumIndex)) weakCounts.set(sample.blockMinimumIndex, (weakCounts.get(sample.blockMinimumIndex) || 0) + 1);
  }
  const dominantWeak = [...weakCounts.entries()].sort((a, b) => b[1] - a[1])[0] || [null, 0];
  const persistentWeakShare = loadSamples.length ? dominantWeak[1] / loadSamples.length : 0;
  if (Number.isFinite(maxLoadDelta) && maxLoadDelta >= thresholds.blockDeltaStrongConcernV && persistentWeakShare >= 0.5 && loadSamples.length >= 6) {
    add("stop", "hv-block-persistent", "Sama HV-lohko jää kuormituksessa toistuvasti alimmaksi", `Flex-seulonta: suurin lohkoero ${formatNumber(maxLoadDelta, 3)} V ja lohko ${dominantWeak[0]} oli alin ${Math.round(persistentWeakShare * 100)} % kuormitusnäytteistä. Tämä ei yksin määrää akkuremonttia, mutta vaatii lisätestin.`);
  } else if (Number.isFinite(maxLoadDelta) && maxLoadDelta >= thresholds.blockDeltaAttentionV) {
    add("attention", "hv-block-delta", "HV-lohkojen kuormitusero vaatii huomiota", `Flex-seulonta: suurin kuormituksessa nähty ero ${formatNumber(maxLoadDelta, 3)} V. Raja ei ole Lexuksen vikakoodiraja.`);
  }

  const hybridSnapshot = inspection.preflight?.hybridSnapshot || {};
  const temperatureMax = [...samples.map(sample => sample.temperatureMaximumC), hybridSnapshot.ctHvTemperatureMax].filter(finite).reduce((max, value) => Math.max(max, Number(value)), -Infinity);
  const temperatureSpread = [...samples.map(sample => sample.temperatureDeltaC), hybridSnapshot.ctHvTemperatureDelta].filter(finite).reduce((max, value) => Math.max(max, Number(value)), -Infinity);
  const resistanceSpread = [...samples.map(sample => sample.resistanceDeltaOhm), hybridSnapshot.ctHvResistanceDelta].filter(finite).reduce((max, value) => Math.max(max, Number(value)), -Infinity);
  if (Number.isFinite(temperatureMax) && temperatureMax >= thresholds.temperatureStrongConcernC) add("stop", "hv-hot", "HV-akku kävi erittäin kuumana", `Suurin nähty akun lämpötila ${formatNumber(temperatureMax, 1)} °C. Tarkista jäähdytys, puhallin ja akku ammattilaisella.`);
  else if ((Number.isFinite(temperatureMax) && temperatureMax >= thresholds.temperatureAttentionC) || (Number.isFinite(temperatureSpread) && temperatureSpread >= thresholds.temperatureSpreadAttentionC)) add("attention", "hv-temperature", "HV-akun lämpötilat vaativat huomiota", `Maksimi ${formatNumber(temperatureMax, 1)} °C, anturien suurin ero ${formatNumber(temperatureSpread, 1)} °C.`);
  if (Number.isFinite(resistanceSpread) && resistanceSpread >= thresholds.resistanceSpreadAttentionOhm) add("attention", "hv-resistance", "HV-lohkojen vastusarvoissa on hajontaa", `Flex-seulonta: suurin nähty R01–R14-hajonta ${formatNumber(resistanceSpread, 3)} Ω. Arvo ei ole Lexuksen korjausraja.`);

  if (readiness?.incompleteCount > 0) add("attention", "readiness", "Päästövalmius ei ole valmis", `${readiness.incompleteCount}/${readiness.supportedCount} tuetusta monitorista on keskeneräinen; vikakoodit on voitu nollata tai ajoa ei ole kertynyt riittävästi.`);
  if (finite(pids.distanceClearKm) && Number(pids.distanceClearKm) < thresholds.recentClearDistanceKm) add("attention", "recent-clear-distance", "Vikakoodien nollauksesta on vähän ajomatkaa", `${formatNumber(pids.distanceClearKm, 0)} km nollauksesta. Pyydä syy ja tarkista uudelleen koeajon jälkeen.`);
  if (finite(pids.warmupsSinceClear) && Number(pids.warmupsSinceClear) < thresholds.recentClearWarmups) add("attention", "recent-clear-warmups", "Nollauksen jälkeen on vähän lämpenemiskertoja", `${formatNumber(pids.warmupsSinceClear, 0)} lämpenemiskertaa. Tämä heikentää vikakooditarkastuksen kattavuutta.`);
  if (finite(pids.controlModuleVoltageV) && (Number(pids.controlModuleVoltageV) < 11.8 || Number(pids.controlModuleVoltageV) > 15.5)) add("attention", "module-voltage", "Ohjainlaitteen käyttöjännite on poikkeava", `${formatNumber(pids.controlModuleVoltageV, 2)} V esitarkastuksessa. Mittaus ei yksin ole 12 V akun kuormitustesti.`);
  const combinedTrim = finite(pids.shortFuelTrimPercent) && finite(pids.longFuelTrimPercent)
    ? Number(pids.shortFuelTrimPercent) + Number(pids.longFuelTrimPercent)
    : null;
  if (finite(combinedTrim) && Math.abs(combinedTrim) >= 20) add("attention", "fuel-trim", "Polttoainekorjaukset ovat suuret tässä hetkessä", `STFT + LTFT = ${formatNumber(combinedTrim, 1)} %. Arvioi vain moottorin käydessä ja varmista imu-, polttoaine- ja pakopuoli ennen osapäätelmää.`);

  const manual = inspection.manual || {};
  if (manual.coldStart === "rough") add("stop", "cold-start", "Kylmäkäynnistyksessä ravistusta tai kolinaa", "Selvitä EGR-, imusarja-, sytytys- ja mahdollinen moottorivaurioriski ennen kauppaa.");
  if (manual.warningLamps === "present") add("stop", "warning-lamps", "Varoitusvaloja jäi palamaan", "Lue kaikki ohjainlaitteet Techstreamillä ennen kauppaa.");
  if (manual.brakePump === "frequent") add("stop", "brake-pump", "Jarrupumppu käy poikkeavan usein tai äänekkäästi", "Jarrutehostin-/pumppuyksikkö pitää tutkia ennen kauppaa.");
  if (manual.serviceHistory === "none") add("attention", "history", "Huoltohistoriaa ei saatu", "Varmista huollot, kampanjat ja korjaukset VIN-tunnuksella.");

  const roadDurationMs = (inspection.roadSegments || []).reduce((total, segment) =>
    total + Math.max(0, Number(segment.endedAt || segment.startedAt) - Number(segment.startedAt || 0)), 0
  );
  const postDriveDtcScan = inspection.postflight?.standardDtcValid === true && groupCoverage(inspection, "hybrid.", "postflight");
  const coverage = Object.freeze({
    zwa10Identification: identification.confirmed === true,
    standardDtcScan: inspection.preflight?.standardDtcValid === true,
    hybridDtcScan: groupCoverage(inspection, "hybrid."),
    brakeDtcScan: groupCoverage(inspection, "brake."),
    readiness: Boolean(readiness),
    baseline: phases.baseline.sampleCount >= thresholds.minimumSamples.baseline,
    discharge: phases.discharge.sampleCount >= thresholds.minimumSamples.discharge,
    charge: phases.charge.sampleCount >= thresholds.minimumSamples.charge,
    roadDuration: roadDurationMs >= thresholds.minimumRoadDurationMs,
    postDriveDtcScan,
    coldStart: ![undefined, "not_checked"].includes(manual.coldStart),
    warningLamps: ![undefined, "not_checked"].includes(manual.warningLamps),
    brakePump: ![undefined, "not_checked"].includes(manual.brakePump)
  });
  const missing = Object.entries(coverage).filter(([, complete]) => !complete).map(([key]) => key);
  if (!coverage.brakeDtcScan) add("coverage", "brake-coverage", "Jarru-ECU:n vikakoodit eivät varmistuneet", "Flexin kokeellinen 7B0/7B8-luku ei saanut kelvollista vastausta. Tämä ei tarkoita, ettei koodeja ole; tee Techstream Health Check.");
  if (!coverage.discharge || !coverage.charge) add("coverage", "load-coverage", "HV-akun kaksisuuntainen kuormituskoe jäi vajaaksi", "Raportti ei voi antaa valmista ostoseulontatulosta ilman sekä purku- että regenerointinäytteitä.");
  if (!coverage.roadDuration) add("coverage", "duration-coverage", "Koeajo jäi alle 10 minuutin", `Hyväksyttyä testijaksoa kertyi ${Math.floor(roadDurationMs / 60000)} min ${Math.floor(roadDurationMs / 1000) % 60} s. P0A80:n kaltaisen uudelleen ilmestyvän vian seulonta vaatii riittävän ajon.`);
  if (!coverage.postDriveDtcScan) add("coverage", "post-dtc-coverage", "Koeajon jälkeinen vikakoodien uusintaluku puuttuu", "Moottorin ja hybridiohjaimen koodit pitää lukea uudelleen koeajon jälkeen.");
  if (!coverage.zwa10Identification) add("coverage", "identity-coverage", "ZWA10-tunnistus puuttuu", "CT-profiilia ei ole vahvistettu hybridiohjaimen mallitunnisteesta.");

  const hasStop = findings.some(finding => finding.severity === "stop");
  const hasAttention = findings.some(finding => finding.severity === "attention");
  const status = hasStop ? "stop" : missing.length ? "incomplete" : hasAttention ? "attention" : "ready";
  const statusText = {
    stop: "KESKEYTÄ KAUPPA JA TUTKI",
    incomplete: "TESTI KESKEN / KATTAVUUS PUUTTUU",
    attention: "HUOMIOITA – SELVITÄ ENNEN KAUPPAA",
    ready: "EI SELKEÄÄ POIKKEAMAA TÄSSÄ SEULONNASSA"
  }[status];
  return Object.freeze({
    status,
    statusText,
    coverage,
    missingCoverage: Object.freeze(missing),
    phases,
    dtcs: Object.freeze(dtcs.map(Object.freeze)),
    metrics: Object.freeze({
      maximumLoadBlockDeltaV: rounded(Number.isFinite(maxLoadDelta) ? maxLoadDelta : null),
      dominantWeakBlock: dominantWeak[0],
      dominantWeakShare: rounded(persistentWeakShare, 2),
      maximumTemperatureC: rounded(Number.isFinite(temperatureMax) ? temperatureMax : null, 1),
      maximumTemperatureSpreadC: rounded(Number.isFinite(temperatureSpread) ? temperatureSpread : null, 1),
      maximumResistanceSpreadOhm: rounded(Number.isFinite(resistanceSpread) ? resistanceSpread : null),
      roadDurationMs
    }),
    findings: Object.freeze(findings)
  });
}

export function buildCtPurchaseInspectionReport(inspection, analysis = analyzeCtPurchaseInspection(inspection)) {
  const line = (label, value) => `${label}: ${value ?? "–"}`;
  const coverageLabels = {
    zwa10Identification: "ZWA10-mallitunnistus",
    standardDtcScan: "Moottorin tallennetut, odottavat ja pysyvät koodit",
    hybridDtcScan: "Hybridiohjaimen pysyvät ja tallennetut koodit",
    brakeDtcScan: "Jarru-/luistonesto-ohjaimen kokeellinen DTC-luku",
    readiness: "Päästövalmius / MIL-tila",
    baseline: "HV-näytteet paikallaan",
    discharge: "HV-näytteet purkukuormalla",
    charge: "HV-näytteet regeneroinnissa",
    roadDuration: "Vähintään 10 minuutin koeajo",
    postDriveDtcScan: "Moottorin ja hybridiohjaimen koodien uusintaluku",
    coldStart: "Kylmäkäynnistyshavainto",
    warningLamps: "Varoitusvalohavainto",
    brakePump: "Jarrupumpun havainto"
  };
  const manualLabels = {
    not_checked: "ei tarkistettu",
    normal: "normaali havainto",
    rough: "ravistusta / kolinaa",
    none: "ei havaittu / ei saatu",
    present: "varoitusvalo palaa",
    frequent: "käy usein, pitkään tai äänekkäästi",
    documented: "dokumentoitu",
    partial: "osittainen"
  };
  const coverageLines = Object.entries(analysis.coverage).map(([key, complete]) => `- ${complete ? "OK" : "PUUTTUU"} · ${coverageLabels[key] || key}`);
  const findingLines = analysis.findings.length
    ? analysis.findings.map(finding => `- ${finding.severity.toUpperCase()} · ${finding.title}: ${finding.detail}`)
    : ["- Ei kirjattuja poikkeamia."];
  const phaseLines = Object.values(analysis.phases).map(phase =>
    `- ${phase.label}: ${phase.sampleCount} näytettä; delta max ${formatNumber(phase.maximumBlockDeltaV, 3)} V; p95 ${formatNumber(phase.p95BlockDeltaV, 3)} V; virta ${formatNumber(phase.minimumCurrentA, 1)}…${formatNumber(phase.maximumCurrentA, 1)} A; toistuva alin lohko ${phase.dominantMinimumBlock || "–"}`
  );
  const raw = {
    preflight: inspection.preflight?.raw || {},
    postflight: inspection.postflight?.raw || {}
  };
  const pids = inspection.preflight?.standardPids || {};
  const readiness = inspection.preflight?.readiness;
  const snapshot = inspection.preflight?.hybridSnapshot || {};
  const brakeGroup = inspection.preflight?.vehicleDtcs?.groups?.find(group => group.id === "brake.stored_dtcs_candidate");
  const incompleteMonitors = readiness?.monitors?.filter(monitor => !monitor.complete).map(monitor => monitor.label) || [];
  return [
    `Lexus OBD Flex ${inspection.appVersion || ""} · CT 200h ostotarkastus`,
    line("Raporttitunnus", inspection.id),
    line("Aloitettu", new Date(inspection.startedAt).toLocaleString("fi-FI")),
    line("Päätetty", inspection.endedAt ? new Date(inspection.endedAt).toLocaleString("fi-FI") : "ei päätetty"),
    line("Tulos", analysis.statusText),
    "",
    "RAJAUS",
    "Tämä on OBD-pohjainen ostoseulonta, ei kuntotodistus eikä HV-akun kapasiteetti-/SOH-mittaus. Flexin delta-, lämpö- ja vastusrajat ovat läpinäkyviä seulontarajoja, eivät Lexuksen vikakoodirajoja. Turvallisuuskriittinen jarrujärjestelmä varmistetaan tarvittaessa Techstream Health Checkillä ja ammattilaisen tarkastuksella.",
    `Flex-seulonta: lohkoeron huomioraja ${formatNumber(CT_PURCHASE_THRESHOLDS.blockDeltaAttentionV, 3)} V, vahvan huolen raja ${formatNumber(CT_PURCHASE_THRESHOLDS.blockDeltaStrongConcernV, 3)} V; nämä eivät ole OEM-korjausrajoja.`,
    "",
    "KOHDE",
    line("Vuosimalli", inspection.candidate?.modelYear || "ei kirjattu"),
    line("Mittarilukema", inspection.candidate?.odometerKm ? `${inspection.candidate.odometerKm} km` : "ei kirjattu"),
    line("VIN / rekisteri", inspection.candidate?.vinOrRegistration || "ei kirjattu"),
    line("Huomio", inspection.candidate?.note || "ei kirjattu"),
    line("Adapteri", inspection.adapter?.identity || "ei kirjattu"),
    "",
    "KATTAVUUS",
    ...coverageLines,
    "",
    "MANUAALISET HAVAINNOT",
    line("Kylmäkäynnistys", manualLabels[inspection.manual?.coldStart] || inspection.manual?.coldStart),
    line("Varoitusvalot", manualLabels[inspection.manual?.warningLamps] || inspection.manual?.warningLamps),
    line("Jarrupumpun toiminta", manualLabels[inspection.manual?.brakePump] || inspection.manual?.brakePump),
    line("Huoltohistoria", manualLabels[inspection.manual?.serviceHistory] || inspection.manual?.serviceHistory),
    "",
    "ESITARKASTUKSEN ARVOT",
    line("Hybridiohjaimen tunnistus", inspection.preflight?.identification?.confirmed ? `${inspection.preflight.identification.modelCode || "ZWA10"} / ${inspection.preflight.identification.engineCode || "moottoritunnus puuttuu"}` : "ei vahvistunut"),
    line("MIL", readiness ? (readiness.milOn ? `päällä · ECU ilmoittaa ${readiness.dtcCount} koodia` : `pois · ECU ilmoittaa ${readiness.dtcCount} koodia`) : "ei vastausta"),
    line("Readiness", readiness ? `${readiness.incompleteCount}/${readiness.supportedCount} tuetusta monitorista kesken${incompleteMonitors.length ? ` · ${incompleteMonitors.join(", ")}` : ""}` : "ei vastausta"),
    line("Jäähdytysneste", `${formatNumber(pids.coolantC, 0)} °C`),
    line("Moottorin kierrosluku", `${formatNumber(pids.rpm, 0)} rpm`),
    line("STFT / LTFT", `${formatNumber(pids.shortFuelTrimPercent, 1)} / ${formatNumber(pids.longFuelTrimPercent, 1)} %`),
    line("Pyydetty EGR / EGR-poikkeama", `${formatNumber(pids.commandedEgrPercent, 1)} / ${formatNumber(pids.egrErrorPercent, 1)} %`),
    line("Nollauksesta", `${formatNumber(pids.distanceClearKm, 0)} km · ${formatNumber(pids.warmupsSinceClear, 0)} lämpenemiskertaa · ${formatNumber(pids.minutesSinceClear, 0)} min`),
    line("Ohjainlaitteen jännite", `${formatNumber(pids.controlModuleVoltageV, 2)} V (ei 12 V akun kuormitustesti)`),
    line("HV SOC / Delta SOC", `${formatNumber(snapshot.ctHvSoc, 1)} / ${formatNumber(snapshot.ctHvDeltaSoc, 1)} %`),
    line("HV-lohkoero esitarkastuksessa", `${formatNumber(snapshot.ctHvBlockDelta, 3)} V`),
    line("HV-akun lämpö maksimi / ero", `${formatNumber(snapshot.ctHvTemperatureMax, 1)} / ${formatNumber(snapshot.ctHvTemperatureDelta, 1)} °C`),
    line("HV-vastusten hajonta", `${formatNumber(snapshot.ctHvResistanceDelta, 3)} Ω`),
    line("Jarru-ECU 7B0/7B8", brakeGroup?.validResponse ? `kelvollinen vastaus · ${brakeGroup.codes?.length || 0} tulkittua koodia` : "ei varmistunut – Techstream Health Check tarvitaan"),
    "",
    "KOEAJON HV-NÄYTTEET",
    line("Hyväksytty testikesto", `${Math.floor((analysis.metrics.roadDurationMs || 0) / 60000)} min ${Math.floor((analysis.metrics.roadDurationMs || 0) / 1000) % 60} s`),
    ...phaseLines,
    line("Kuormituksen suurin lohkoero", `${formatNumber(analysis.metrics.maximumLoadBlockDeltaV, 3)} V`),
    line("Toistuva alin lohko", analysis.metrics.dominantWeakBlock || "–"),
    line("Suurin akun lämpö", `${formatNumber(analysis.metrics.maximumTemperatureC, 1)} °C`),
    line("Suurin R01–R14-hajonta", `${formatNumber(analysis.metrics.maximumResistanceSpreadOhm, 3)} Ω`),
    "",
    "VIKAKOODIT",
    ...(analysis.dtcs.length ? analysis.dtcs.map(item => `- ${item.code} · ${item.source}`) : ["- Kelvollisissa vastauksissa ei tulkittuja koodeja."]),
    "",
    "HAVAINNOT",
    ...findingLines,
    "",
    "RAAKAVASTAUKSET (todentamista varten)",
    JSON.stringify(raw, null, 2),
    "",
    "NÄYTEYHTEENVETO (raakadata säilytetään raportin JSON-osassa)",
    JSON.stringify(inspection.samples || [], null, 2)
  ].join("\n");
}

export function buildCtPurchaseInspectionAnalysisPrompt(inspection, analysis = analyzeCtPurchaseInspection(inspection)) {
  return [
    "Analysoi liitteenä oleva Lexus CT 200h -ostotarkastusraportti.",
    `Flexin oma luokitus: ${analysis.statusText}.`,
    "Erota mitatut havainnot, puuttuva kattavuus ja tulkinnat toisistaan.",
    "Älä päättele HV-akun kapasiteettia tai SOH-prosenttia lohkojännitteistä.",
    "Nosta P0A80/P3000-, C1391/C1252/C1253/C1256-, P0401- ja sytytyskatkoslöydökset sekä readiness/nollausepäilyt erikseen.",
    "Kerro lopuksi, mitkä asiat on varmistettava Techstreamillä tai korjaamolla ennen kauppaa."
  ].join(" ");
}
