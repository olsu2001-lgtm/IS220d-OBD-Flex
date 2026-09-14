export const TECHSTREAM_DATA_LIST_EXPORT_SCHEMA_VERSION = 1;

const TARGETS = Object.freeze([
  Object.freeze({ key: "injector1", aliases: ["injection feedback val #1", "injection feedback val 1", "inj feedback val 1", "inj feedback val #1"] }),
  Object.freeze({ key: "injector2", aliases: ["injection feedback val #2", "injection feedback val 2", "inj feedback val 2", "inj feedback val #2"] }),
  Object.freeze({ key: "injector3", aliases: ["injection feedback val #3", "injection feedback val 3", "inj feedback val 3", "inj feedback val #3"] }),
  Object.freeze({ key: "injector4", aliases: ["injection feedback val #4", "injection feedback val 4", "inj feedback val 4", "inj feedback val #4"] }),
  Object.freeze({ key: "targetRail", aliases: ["target common rail pressure", "target rail pressure"] }),
  Object.freeze({ key: "targetScv", aliases: ["target pump scv current"] })
]);

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
    if (target.aliases.some(alias => text.includes(alias))) return target;
  }
  return null;
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
  return { injectionFeedbackMm3PerStroke: [null, null, null, null], targetCommonRailPressureKpa: null, targetPumpScvCurrentMa: null };
}

function assignValue(values, key, value) {
  if (!Number.isFinite(value)) return;
  if (key.startsWith("injector")) values.injectionFeedbackMm3PerStroke[Number(key.slice(-1)) - 1] = value;
  else if (key === "targetRail") values.targetCommonRailPressureKpa = value;
  else if (key === "targetScv") values.targetPumpScvCurrentMa = value;
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

function parseWideTable(lines, values, evidence) {
  for (let headerIndex = 0; headerIndex < lines.length; headerIndex += 1) {
    const detected = detectDelimiter(lines[headerIndex]);
    if (!detected || detected.count < 2) continue;
    const headers = splitDelimited(lines[headerIndex], detected.delimiter);
    const mapped = headers.map(targetForCell);
    if (!mapped.some(Boolean)) continue;
    for (let rowIndex = headerIndex + 1; rowIndex < lines.length; rowIndex += 1) {
      const row = splitDelimited(lines[rowIndex], detected.delimiter);
      if (row.length < 2) continue;
      let any = false;
      for (let column = 0; column < mapped.length; column += 1) {
        const target = mapped[column];
        if (!target) continue;
        const value = parseNumber(row[column]);
        if (value == null) continue;
        assignValue(values, target.key, value);
        evidence.push(Object.freeze({ source: "wide-table", line: rowIndex + 1, column: column + 1, key: target.key, value }));
        any = true;
      }
      if (any) continue;
    }
    return;
  }
}

export function parseTechstreamDataListExport(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n").slice(0, 20000);
  const values = emptyValues();
  const evidence = [];
  parseVertical(lines, values, evidence);
  parseWideTable(lines, values, evidence);
  const injectorCount = values.injectionFeedbackMm3PerStroke.filter(Number.isFinite).length;
  const completeTargets = (injectorCount === 4 ? 1 : 0) + (Number.isFinite(values.targetCommonRailPressureKpa) ? 1 : 0) + (Number.isFinite(values.targetPumpScvCurrentMa) ? 1 : 0);
  return Object.freeze({
    schemaVersion: TECHSTREAM_DATA_LIST_EXPORT_SCHEMA_VERSION,
    lineCount: lines.length,
    values: Object.freeze({
      injectionFeedbackMm3PerStroke: Object.freeze([...values.injectionFeedbackMm3PerStroke]),
      targetCommonRailPressureKpa: values.targetCommonRailPressureKpa,
      targetPumpScvCurrentMa: values.targetPumpScvCurrentMa
    }),
    injectorChannelCount: injectorCount,
    completeTargetCount: completeTargets,
    complete: completeTargets === 3,
    evidence: Object.freeze(evidence),
    transportUsed: false
  });
}

export function buildTechstreamDataListExportTextReport(result) {
  const feedback = result?.values?.injectionFeedbackMm3PerStroke || [null, null, null, null];
  const format = value => Number.isFinite(value) ? String(value) : "–";
  return [
    "===== TECHSTREAM DATA LIST EXPORT =====",
    `Injection Feedback Val #1–#4: ${feedback.map(format).join(" / ")} mm³/st`,
    `Target Common Rail Pressure: ${format(result?.values?.targetCommonRailPressureKpa)} kPa`,
    `Target Pump SCV Current: ${format(result?.values?.targetPumpScvCurrentMa)} mA`,
    `Coverage: ${Number(result?.completeTargetCount || 0)}/3 targets`,
    "Source: offline Techstream Data List CSV/text export; no vehicle command sent by Flex"
  ].join("\n") + "\n";
}
