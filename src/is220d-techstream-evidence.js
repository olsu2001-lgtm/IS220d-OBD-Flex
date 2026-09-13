import { parseTechstreamDataListExport } from "./techstream-data-list-export.js";

export const IS220D_TECHSTREAM_EVIDENCE_SCHEMA_VERSION = 1;
export const IS220D_TECHSTREAM_EVIDENCE_STORAGE_KEY = "lexusIs220dTechstreamDataListEvidenceV1";

const POINT_TARGETS = Object.freeze({
  "fuel-filter-rail-build": Object.freeze(["targetRail"]),
  "scv-rail-response": Object.freeze(["targetRail", "targetScv"]),
  "pump-rail-build": Object.freeze(["targetRail", "targetScv"]),
  "rail-sensor-cranking-response": Object.freeze(["targetRail"]),
  "injector-system-context": Object.freeze(["injectorFeedback"])
});

const TARGET_META = Object.freeze({
  injectorFeedback: Object.freeze({ label: "Injection Feedback #1–#4", unit: "mm³/st" }),
  targetRail: Object.freeze({ label: "Target Common Rail Pressure", unit: "kPa" }),
  targetScv: Object.freeze({ label: "Target Pump SCV Current", unit: "mA" })
});

function finite(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function emptyRecord() {
  return {
    schemaVersion: IS220D_TECHSTREAM_EVIDENCE_SCHEMA_VERSION,
    importedAt: 0,
    fileName: "",
    values: {
      injectionFeedbackMm3PerStroke: [null, null, null, null],
      targetCommonRailPressureKpa: null,
      targetPumpScvCurrentMa: null
    }
  };
}

function sanitizeRecord(value) {
  if (!value || Number(value.schemaVersion) !== IS220D_TECHSTREAM_EVIDENCE_SCHEMA_VERSION) return emptyRecord();
  const feedback = Array.isArray(value?.values?.injectionFeedbackMm3PerStroke)
    ? value.values.injectionFeedbackMm3PerStroke.slice(0, 4).map(finite)
    : [];
  while (feedback.length < 4) feedback.push(null);
  return {
    schemaVersion: IS220D_TECHSTREAM_EVIDENCE_SCHEMA_VERSION,
    importedAt: Number.isFinite(Number(value.importedAt)) ? Number(value.importedAt) : 0,
    fileName: String(value.fileName || "").slice(0, 160),
    values: {
      injectionFeedbackMm3PerStroke: feedback,
      targetCommonRailPressureKpa: finite(value?.values?.targetCommonRailPressureKpa),
      targetPumpScvCurrentMa: finite(value?.values?.targetPumpScvCurrentMa)
    }
  };
}

export function readIs220dTechstreamEvidence(storage = globalThis.localStorage) {
  try {
    return sanitizeRecord(JSON.parse(storage?.getItem(IS220D_TECHSTREAM_EVIDENCE_STORAGE_KEY) || "null"));
  } catch {
    return emptyRecord();
  }
}

export function writeIs220dTechstreamEvidence(result, {
  storage = globalThis.localStorage,
  importedAt = Date.now(),
  fileName = ""
} = {}) {
  const record = sanitizeRecord({
    schemaVersion: IS220D_TECHSTREAM_EVIDENCE_SCHEMA_VERSION,
    importedAt,
    fileName,
    values: result?.values || {}
  });
  try { storage?.setItem(IS220D_TECHSTREAM_EVIDENCE_STORAGE_KEY, JSON.stringify(record)); } catch {}
  return record;
}

export function clearIs220dTechstreamEvidence(storage = globalThis.localStorage) {
  try { storage?.removeItem(IS220D_TECHSTREAM_EVIDENCE_STORAGE_KEY); } catch {}
  return emptyRecord();
}

function availableTargets(record) {
  const feedback = record.values.injectionFeedbackMm3PerStroke;
  return {
    injectorFeedback: feedback.length === 4 && feedback.every(Number.isFinite),
    targetRail: Number.isFinite(record.values.targetCommonRailPressureKpa),
    targetScv: Number.isFinite(record.values.targetPumpScvCurrentMa)
  };
}

export function buildIs220dTechstreamEvidenceState(record = emptyRecord()) {
  const clean = sanitizeRecord(record);
  const available = availableTargets(clean);
  const points = Object.entries(POINT_TARGETS).map(([pointId, targetKeys]) => ({
    pointId,
    targets: targetKeys.map(key => ({ key, ...TARGET_META[key], available: available[key] === true })),
    availableCount: targetKeys.filter(key => available[key]).length,
    targetCount: targetKeys.length
  }));
  return Object.freeze({
    schemaVersion: IS220D_TECHSTREAM_EVIDENCE_SCHEMA_VERSION,
    importedAt: clean.importedAt,
    fileName: clean.fileName,
    values: Object.freeze({
      injectionFeedbackMm3PerStroke: Object.freeze([...clean.values.injectionFeedbackMm3PerStroke]),
      targetCommonRailPressureKpa: clean.values.targetCommonRailPressureKpa,
      targetPumpScvCurrentMa: clean.values.targetPumpScvCurrentMa
    }),
    available: Object.freeze(available),
    availableTargetCount: Object.values(available).filter(Boolean).length,
    points: Object.freeze(points.map(point => Object.freeze({ ...point, targets: Object.freeze(point.targets.map(Object.freeze)) })))
  });
}

function formatTarget(key, state) {
  if (key === "injectorFeedback") {
    const values = state.values.injectionFeedbackMm3PerStroke;
    return values.every(Number.isFinite) ? `${values.join(" / ")} mm³/st` : "–";
  }
  if (key === "targetRail") return Number.isFinite(state.values.targetCommonRailPressureKpa) ? `${state.values.targetCommonRailPressureKpa} kPa` : "–";
  if (key === "targetScv") return Number.isFinite(state.values.targetPumpScvCurrentMa) ? `${state.values.targetPumpScvCurrentMa} mA` : "–";
  return "–";
}

function renderPointEvidence(state) {
  if (typeof document === "undefined") return;
  for (const point of state.points) {
    const card = document.querySelector(`[data-bom-fuel-point="${point.pointId}"]`);
    if (!card) continue;
    card.querySelector(".bom-techstream-evidence")?.remove();
    if (!point.availableCount) continue;
    const box = document.createElement("div");
    box.className = "bom-techstream-evidence";
    const lines = point.targets
      .filter(target => target.available)
      .map(target => `<div><strong>${target.label}</strong><span>${formatTarget(target.key, state)}</span></div>`)
      .join("");
    box.innerHTML = `<small>TECHSTREAM CSV · OFFLINE-REFERENSSI</small>${lines}<p>Ei muuta Flexin live-signaalin varmennusta eikä todista saman ajon target/actual-suhdetta.</p>`;
    const execution = card.querySelector(".bom-exec-point-state");
    if (execution?.after) execution.after(box);
    else card.querySelector(".bom-fuel-point-head")?.after(box);
  }
}

function renderSummary(state) {
  if (typeof document === "undefined") return;
  const panel = document.querySelector("#bomFuelInspectionPoints");
  if (!panel) return;
  panel.querySelector(".bom-techstream-summary")?.remove();
  if (!state.availableTargetCount) return;
  const summary = document.createElement("div");
  summary.className = "bom-techstream-summary";
  const source = state.fileName ? ` · ${state.fileName}` : "";
  summary.textContent = `Techstream CSV -referenssi: ${state.availableTargetCount}/3 tavoitetta${source}`;
  panel.prepend(summary);
}

function ensureStyles() {
  if (typeof document === "undefined" || document.querySelector("#bom-techstream-evidence-styles")) return;
  const style = document.createElement("style");
  style.id = "bom-techstream-evidence-styles";
  style.textContent = `
    .bom-techstream-summary{margin:7px 0;padding:7px 8px;border:1px solid var(--info-border,var(--line));border-radius:8px;background:var(--surface-inset);color:var(--info);font-size:8px;font-weight:800}
    .bom-techstream-evidence{margin-top:6px;padding:7px;border-left:3px solid var(--info);border-radius:7px;background:var(--surface-inset);font-size:8px}
    .bom-techstream-evidence>small{display:block;margin-bottom:5px;color:var(--info);font-weight:850}.bom-techstream-evidence>div{display:flex;justify-content:space-between;gap:8px;margin-top:3px}.bom-techstream-evidence>div strong{font-size:8px}.bom-techstream-evidence>div span{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-align:right}.bom-techstream-evidence>p{margin:5px 0 0;color:var(--muted);font-size:7px;line-height:1.35}
  `;
  document.head.append(style);
}

let listenersInstalled = false;
let importListenersInstalled = false;

function persistImportedText(text, fileName, storage) {
  const result = parseTechstreamDataListExport(text);
  const candidate = buildIs220dTechstreamEvidenceState({
    schemaVersion: IS220D_TECHSTREAM_EVIDENCE_SCHEMA_VERSION,
    importedAt: Date.now(),
    fileName,
    values: result.values
  });
  if (!candidate.availableTargetCount) return null;
  writeIs220dTechstreamEvidence(result, { storage, fileName });
  return publishIs220dTechstreamEvidence(storage);
}

function installImportListeners(storage) {
  if (typeof document === "undefined" || importListenersInstalled) return;
  const root = document.querySelector("#techstreamDataListGap");
  const file = root?.querySelector('[aria-label="Techstream Data List CSV file"]');
  const textarea = root?.querySelector('[aria-label="Techstream Data List CSV text"]');
  if (!root || !file || !textarea) return;
  const buttons = [...root.querySelectorAll("button")];
  const analyze = buttons.find(button => button.textContent?.includes("Poimi Data List"));
  const clear = buttons.find(button => button.textContent?.trim() === "Tyhjennä");

  file.addEventListener("change", async () => {
    const selected = file.files?.[0];
    if (!selected) return;
    try { persistImportedText(await selected.text(), selected.name || "Techstream CSV", storage); } catch {}
  });
  analyze?.addEventListener("click", () => persistImportedText(textarea.value, "liitetty CSV/text", storage));
  clear?.addEventListener("click", () => {
    clearIs220dTechstreamEvidence(storage);
    queueMicrotask(() => publishIs220dTechstreamEvidence(storage));
  });
  importListenersInstalled = true;
}

export function publishIs220dTechstreamEvidence(storage = globalThis.localStorage) {
  const state = buildIs220dTechstreamEvidenceState(readIs220dTechstreamEvidence(storage));
  if (typeof document === "undefined") return state;
  ensureStyles();
  renderSummary(state);
  renderPointEvidence(state);
  installImportListeners(storage);
  if (!listenersInstalled) {
    listenersInstalled = true;
    document.querySelector("#bomDiagnosticRunGroup")?.addEventListener("change", () => queueMicrotask(() => publishIs220dTechstreamEvidence(storage)));
    document.querySelector("#bomGroupFilter")?.addEventListener("change", () => queueMicrotask(() => publishIs220dTechstreamEvidence(storage)));
  }
  return state;
}
