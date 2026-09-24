export const TECHSTREAM_DATA_LIST_EXPORT_SCHEMA_VERSION = 2;

const TARGETS = Object.freeze([
  Object.freeze({ key: "injector1", aliases: ["injection feedback val #1", "injection feedback val 1", "inj feedback val 1", "inj feedback val #1"] }),
  Object.freeze({ key: "injector2", aliases: ["injection feedback val #2", "injection feedback val 2", "inj feedback val 2", "inj feedback val #2"] }),
  Object.freeze({ key: "injector3", aliases: ["injection feedback val #3", "injection feedback val 3", "inj feedback val 3", "inj feedback val #3"] }),
  Object.freeze({ key: "injector4", aliases: ["injection feedback val #4", "injection feedback val 4", "inj feedback val 4", "inj feedback val #4"] }),
  Object.freeze({ key: "targetRail", aliases: ["target common rail pressure", "target rail pressure"] }),
  Object.freeze({ key: "targetScv", aliases: ["target pump scv current"] }),
  Object.freeze({ key: "dpfDifferentialPressure", aliases: ["dpf differential pressure", "dpnr differential pressure"] }),
  Object.freeze({ key: "egrLiftSensor", aliases: ["egr lift sensor output", "egr lift position"] }),
  Object.freeze({ key: "engineSpeed", aliases: ["engine speed", "engine rpm"] }),
  Object.freeze({ key: "maf", aliases: ["mass air flow", "maf"] })
]);

const TIME_ALIASES = Object.freeze(["time", "time (s)", "elapsed time", "elapsed", "timestamp"]);
const normalize = value => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function parseNumber(value) {
  const text = String(value ?? "").replace(/\u00a0/g, " ").trim();
  const match = text.match(/[-+]?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const number = Number(match[0].replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function targetForCell(cell) {
  const text = normalize(cell);
  for (const target of TARGETS) {
    if (target.aliases.some(alias => text === alias || text.includes(alias))) return target;
  }
  return null;
}

function timeColumnForCell(cell) {
  const text = normalize(cell);
  return TIME_ALIASES.includes(text) || TIME_ALIASES.some(alias => text.startsWith(`${alias} `) || text.startsWith(`${alias}(`));
}

function splitDelimited(line, delimiter) {
  const cells = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) { cells.push(value.trim()); value = ""; }
    else value += char;
  }
  cells.push(value.trim());
  return cells;
}

function detectDelimiter(line) {
  const candidates = ["\t", ";", ","];
  return candidates.map(delimiter => ({ delimiter, count: splitDelimited(line, delimiter).length })).sort((a, b) => b.count - a.count)[0];
}

function emptyValues() {
  return {
    injectionFeedbackMm3PerStroke: [null, null, null, null],
    targetCommonRailPressureKpa: null,
    targetPumpScvCurrentMa: null,
    dpfDifferentialPressureKpa: null,
    egrLiftSensorPercent: null,
    engineSpeedRpm: null,
    mafGps: null
  };
}

function assignValue(values, key, value) {
  if (!Number.isFinite(value)) return;
  if (key.startsWith("injector")) values.injectionFeedbackMm3PerStroke[Number(key.slice(-1)) - 1] = value;
  else if (key === "targetRail") values.targetCommonRailPressureKpa = value;
  else if (key === "targetScv") values.targetPumpScvCurrentMa = value;
  else if (key === "dpfDifferentialPressure") values.dpfDifferentialPressureKpa = value;
  else if (key === "egrLiftSensor") values.egrLiftSensorPercent = value;
  else if (key === "engineSpeed") values.engineSpeedRpm = value;
  else if (key === "maf") values.mafGps = value;
}

function sampleFieldForKey(key) {
  if (key === "targetRail") return "targetCommonRailPressureKpa";
  if (key === "targetScv") return "targetPumpScvCurrentMa";
  if (key === "dpfDifferentialPressure") return "dpfDifferentialPressureKpa";
  if (key === "egrLiftSensor") return "egrLiftSensorPercent";
  if (key === "engineSpeed") return "engineSpeedRpm";
  if (key === "maf") return "mafGps";
  if (key.startsWith("injector")) return `injectionFeedback${key.slice(-1)}Mm3PerStroke`;
  return "";
}

function parseVertical(lines, values, evidence) {
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const normalized = normalize(line);
    for (const target of TARGETS) {
      const alias = target.aliases.find(item => normalized.includes(item));
      if (!alias) continue;
      const rawIndex = normalized.indexOf(alias);
      const after = normalized.slice(rawIndex + alias.length);
      const value = parseNumber(after);
      if (value == null) continue;
      assignValue(values, target.key, value);
      evidence.push(Object.freeze({ source: "label-value-line", line: lineIndex + 1, key: target.key, value }));
    }
  }
}

function parseWideTable(lines, values, evidence, samples) {
  for (let headerIndex = 0; headerIndex < lines.length; headerIndex += 1) {
    const detected = detectDelimiter(lines[headerIndex]);
    if (!detected || detected.count < 2) continue;
    const headers = splitDelimited(lines[headerIndex], detected.delimiter);
    const mapped = headers.map(targetForCell);
    const timeColumn = headers.findIndex(timeColumnForCell);
    if (!mapped.some(Boolean)) continue;

    for (let rowIndex = headerIndex + 1; rowIndex < lines.length; rowIndex += 1) {
      const row = splitDelimited(lines[rowIndex], detected.delimiter);
      if (row.length < 2) continue;
      const sample = {
        sourceLine: rowIndex + 1,
        timeSeconds: timeColumn >= 0 ? parseNumber(row[timeColumn]) : null
      };
      let any = false;
      let correlationValue = false;
      for (let column = 0; column < mapped.length; column += 1) {
        const target = mapped[column];
        if (!target) continue;
        const value = parseNumber(row[column]);
        if (value == null) continue;
        assignValue(values, target.key, value);
        evidence.push(Object.freeze({ source: "wide-table", line: rowIndex + 1, column: column + 1, key: target.key, value }));
        const field = sampleFieldForKey(target.key);
        if (field) sample[field] = value;
        if (["dpfDifferentialPressure", "egrLiftSensor", "engineSpeed", "maf"].includes(target.key)) correlationValue = true;
        any = true;
      }
      if (any && correlationValue) samples.push(Object.freeze(sample));
    }
    return;
  }
}

export function parseTechstreamDataListExport(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n").slice(0, 50000);
  const values = emptyValues();
  const evidence = [];
  const samples = [];
  parseVertical(lines, values, evidence);
  parseWideTable(lines, values, evidence, samples);
  const injectorCount = values.injectionFeedbackMm3PerStroke.filter(Number.isFinite).length;
  const completeTargets = (injectorCount === 4 ? 1 : 0) + (Number.isFinite(values.targetCommonRailPressureKpa) ? 1 : 0) + (Number.isFinite(values.targetPumpScvCurrentMa) ? 1 : 0);
  const dpfEgrTargetCount = (Number.isFinite(values.dpfDifferentialPressureKpa) ? 1 : 0) + (Number.isFinite(values.egrLiftSensorPercent) ? 1 : 0);
  return Object.freeze({
    schemaVersion: TECHSTREAM_DATA_LIST_EXPORT_SCHEMA_VERSION,
    lineCount: lines.length,
    values: Object.freeze({
      injectionFeedbackMm3PerStroke: Object.freeze([...values.injectionFeedbackMm3PerStroke]),
      targetCommonRailPressureKpa: values.targetCommonRailPressureKpa,
      targetPumpScvCurrentMa: values.targetPumpScvCurrentMa,
      dpfDifferentialPressureKpa: values.dpfDifferentialPressureKpa,
      egrLiftSensorPercent: values.egrLiftSensorPercent,
      engineSpeedRpm: values.engineSpeedRpm,
      mafGps: values.mafGps
    }),
    samples: Object.freeze(samples),
    sampleCount: samples.length,
    injectorChannelCount: injectorCount,
    completeTargetCount: completeTargets,
    complete: completeTargets === 3,
    dpfEgrTargetCount,
    dpfEgrComplete: dpfEgrTargetCount === 2,
    evidence: Object.freeze(evidence),
    transportUsed: false
  });
}

export function buildTechstreamDataListExportTextReport(result) {
  const feedback = result?.values?.injectionFeedbackMm3PerStroke || [null, null, null, null];
  const format = value => Number.isFinite(value) ? String(value) : "–";
  return [
    "===== TECHSTREAM DATA LIST EXPORT =====",
    `DPF Differential Pressure: ${format(result?.values?.dpfDifferentialPressureKpa)} kPa`,
    `EGR Lift Sensor Output: ${format(result?.values?.egrLiftSensorPercent)} %`,
    `Engine Speed: ${format(result?.values?.engineSpeedRpm)} rpm`,
    `MAF: ${format(result?.values?.mafGps)} g/s`,
    `Correlation samples: ${Number(result?.sampleCount || 0)}`,
    `Injection Feedback Val #1–#4: ${feedback.map(format).join(" / ")} mm³/st`,
    `Target Common Rail Pressure: ${format(result?.values?.targetCommonRailPressureKpa)} kPa`,
    `Target Pump SCV Current: ${format(result?.values?.targetPumpScvCurrentMa)} mA`,
    `Fuel coverage: ${Number(result?.completeTargetCount || 0)}/3 targets`,
    `DPF/EGR coverage: ${Number(result?.dpfEgrTargetCount || 0)}/2 targets`,
    "Source: offline Techstream Data List CSV/text export; no vehicle command sent by Flex"
  ].join("\n") + "\n";
}
