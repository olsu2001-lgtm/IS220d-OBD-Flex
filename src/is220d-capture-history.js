import { decodeIs220dDiagnosticSignalResult } from "./is220d-component-assessment.js";
import { IS220D_DIAGNOSTIC_SIGNALS, getIs220dDiagnosticSignal } from "./is220d-diagnostic-signals.js";
import { getIs220dDiagnosticGroup, is220dDiagnosticComponentsForGroup } from "./is220d-diagnostic-groups.js";

export const IS220D_CAPTURE_HISTORY_SCHEMA_VERSION = 1;
export const IS220D_CAPTURE_HISTORY_STORAGE_KEY = "lexusIs220dCaptureHistoryV1";
export const IS220D_CAPTURE_CANDIDATE_STORAGE_KEY = "lexusIs220dLatestCaptureCandidateV1";
export const IS220D_CAPTURE_HISTORY_LIMIT = 40;

export const IS220D_CAPTURE_CONTEXTS = Object.freeze({
  koeo: Object.freeze({ label: "KOEO", description: "Virrat päällä, moottori sammuksissa" }),
  cranking: Object.freeze({ label: "STARTTAUS", description: "Starttauksen aikana" }),
  running: Object.freeze({ label: "KÄYNTI", description: "Moottori käy, tarkempi tila määrittelemättä" }),
  "warm-idle": Object.freeze({ label: "LÄMMIN TYHJÄKÄYNTI", description: "Moottori lämmin ja vakaa tyhjäkäynti" }),
  load: Object.freeze({ label: "KUORMITUS", description: "Moottori kuormitettuna / ajossa" })
});

const ENGINE_REQUEST_HEADERS = new Set(["", "7DF", "7E0"]);
const CURRENT_SIGNAL_KEYS = new Set(IS220D_DIAGNOSTIC_SIGNALS
  .filter(signal => signal.productionAuthorized === true && signal.collectedByWideDiagnostic === true && signal.authorization !== "field-rejected")
  .map(signal => signal.key));

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function normalizeHex(value) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function finite(value) {
  if (value == null || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanString(value, max = 160) {
  return String(value || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
}

function engineStateFromRun(run) {
  const declared = run?.meta?.engineRunningDeclared;
  if (declared === true) return "running";
  if (declared === false) return "stopped";
  return "auto";
}

function emptyEvidence() {
  return {
    schemaVersion: IS220D_CAPTURE_HISTORY_SCHEMA_VERSION,
    source: "existing-wide-diagnostic-results",
    runId: "",
    startedAt: 0,
    endedAt: 0,
    engineState: "auto",
    observedSignalKeys: [],
    values: []
  };
}

function sanitizeSignalValue(value) {
  const signalKey = cleanString(value?.signalKey, 96);
  const signal = getIs220dDiagnosticSignal(signalKey);
  const numeric = finite(value?.value);
  if (!signal || !CURRENT_SIGNAL_KEYS.has(signalKey) || numeric == null) return null;
  return {
    signalKey,
    value: numeric,
    unit: signal.unit || "",
    evidence: signal.evidence || ""
  };
}

export function sanitizeIs220dCaptureEvidence(value) {
  if (!value || Number(value.schemaVersion) !== IS220D_CAPTURE_HISTORY_SCHEMA_VERSION) return deepFreeze(emptyEvidence());
  const observed = [...new Set((Array.isArray(value.observedSignalKeys) ? value.observedSignalKeys : [])
    .map(key => cleanString(key, 96))
    .filter(key => CURRENT_SIGNAL_KEYS.has(key)))];
  const byKey = new Map();
  for (const candidate of Array.isArray(value.values) ? value.values : []) {
    const clean = sanitizeSignalValue(candidate);
    if (clean) byKey.set(clean.signalKey, clean);
  }
  return deepFreeze({
    schemaVersion: IS220D_CAPTURE_HISTORY_SCHEMA_VERSION,
    source: "existing-wide-diagnostic-results",
    runId: cleanString(value.runId, 160),
    startedAt: Number.isFinite(Number(value.startedAt)) ? Number(value.startedAt) : 0,
    endedAt: Number.isFinite(Number(value.endedAt)) ? Number(value.endedAt) : 0,
    engineState: ["running", "stopped", "auto"].includes(value.engineState) ? value.engineState : "auto",
    observedSignalKeys: observed,
    values: [...byKey.values()]
  });
}

/**
 * Extracts only sanitized named-signal evidence from a diagnostic run that has
 * already completed. This function cannot create or transmit a vehicle request.
 */
export function buildIs220dCaptureEvidenceFromDiagnosticRun(run) {
  const results = Array.isArray(run?.results) ? run.results : [];
  const engineResults = results.filter(result => ENGINE_REQUEST_HEADERS.has(normalizeHex(result?.requestHeader)));
  const observedSignalKeys = [];
  const values = [];

  for (const signal of IS220D_DIAGNOSTIC_SIGNALS) {
    if (!CURRENT_SIGNAL_KEYS.has(signal.key)) continue;
    const commands = new Set(signal.commands.map(normalizeHex));
    const matching = engineResults.filter(result => commands.has(normalizeHex(result?.command)) && result?.validResponse === true);
    if (!matching.length) continue;
    observedSignalKeys.push(signal.key);
    const decoded = [...matching].reverse()
      .map(result => decodeIs220dDiagnosticSignalResult(signal.key, result))
      .find(Boolean);
    if (decoded) {
      values.push({
        signalKey: signal.key,
        value: decoded.value,
        unit: signal.unit || "",
        evidence: signal.evidence || ""
      });
    }
  }

  return sanitizeIs220dCaptureEvidence({
    schemaVersion: IS220D_CAPTURE_HISTORY_SCHEMA_VERSION,
    runId: run?.meta?.reportId || "",
    startedAt: run?.startedAt,
    endedAt: run?.endedAt,
    engineState: engineStateFromRun(run),
    observedSignalKeys,
    values
  });
}

function emptyHistory() {
  return { schemaVersion: IS220D_CAPTURE_HISTORY_SCHEMA_VERSION, captures: [] };
}

function sanitizeCapture(value) {
  const context = cleanString(value?.context, 32);
  if (!IS220D_CAPTURE_CONTEXTS[context]) return null;
  const evidence = sanitizeIs220dCaptureEvidence(value?.evidence);
  if (!evidence.runId && !evidence.startedAt) return null;
  if (!evidence.observedSignalKeys.length && !evidence.values.length) return null;
  return {
    id: cleanString(value?.id, 180) || evidence.runId || `run-${evidence.startedAt}`,
    context,
    recordedAt: Number.isFinite(Number(value?.recordedAt)) ? Number(value.recordedAt) : 0,
    evidence
  };
}

function sanitizeHistory(value) {
  if (!value || Number(value.schemaVersion) !== IS220D_CAPTURE_HISTORY_SCHEMA_VERSION || !Array.isArray(value.captures)) return emptyHistory();
  const captures = [];
  const seenRuns = new Set();
  for (const candidate of [...value.captures].reverse()) {
    const clean = sanitizeCapture(candidate);
    if (!clean) continue;
    const runKey = clean.evidence.runId || `run-${clean.evidence.startedAt}`;
    if (seenRuns.has(runKey)) continue;
    seenRuns.add(runKey);
    captures.push(clean);
    if (captures.length >= IS220D_CAPTURE_HISTORY_LIMIT) break;
  }
  captures.reverse();
  return { schemaVersion: IS220D_CAPTURE_HISTORY_SCHEMA_VERSION, captures };
}

export function readIs220dCaptureHistory(storage = globalThis.localStorage) {
  try {
    return deepFreeze(sanitizeHistory(JSON.parse(storage?.getItem(IS220D_CAPTURE_HISTORY_STORAGE_KEY) || "null")));
  } catch {
    return deepFreeze(emptyHistory());
  }
}

export function writeIs220dCaptureCandidate(evidence, storage = globalThis.localStorage) {
  const clean = sanitizeIs220dCaptureEvidence(evidence);
  if (!clean.runId && !clean.startedAt) return clean;
  try { storage?.setItem(IS220D_CAPTURE_CANDIDATE_STORAGE_KEY, JSON.stringify(clean)); } catch {}
  return clean;
}

export function readIs220dCaptureCandidate(storage = globalThis.localStorage) {
  try {
    return sanitizeIs220dCaptureEvidence(JSON.parse(storage?.getItem(IS220D_CAPTURE_CANDIDATE_STORAGE_KEY) || "null"));
  } catch {
    return deepFreeze(emptyEvidence());
  }
}

export function saveIs220dCapture(evidence, context, {
  storage = globalThis.localStorage,
  recordedAt = Date.now()
} = {}) {
  const cleanContext = cleanString(context, 32);
  if (!IS220D_CAPTURE_CONTEXTS[cleanContext]) throw new Error(`Unknown IS220d capture context: ${cleanContext}`);
  const cleanEvidence = sanitizeIs220dCaptureEvidence(evidence);
  if (!cleanEvidence.runId && !cleanEvidence.startedAt) throw new Error("Capture evidence has no run identity");
  if (!cleanEvidence.observedSignalKeys.length && !cleanEvidence.values.length) throw new Error("Capture evidence contains no observed signals");
  const runKey = cleanEvidence.runId || `run-${cleanEvidence.startedAt}`;
  const history = readIs220dCaptureHistory(storage);
  const captures = history.captures.filter(item => (item.evidence.runId || `run-${item.evidence.startedAt}`) !== runKey);
  captures.push({
    id: runKey,
    context: cleanContext,
    recordedAt: Number(recordedAt) || 0,
    evidence: cleanEvidence
  });
  const cleanHistory = sanitizeHistory({ schemaVersion: IS220D_CAPTURE_HISTORY_SCHEMA_VERSION, captures });
  try { storage?.setItem(IS220D_CAPTURE_HISTORY_STORAGE_KEY, JSON.stringify(cleanHistory)); } catch {}
  return deepFreeze(cleanHistory);
}

export function clearIs220dCaptureHistory(storage = globalThis.localStorage) {
  try { storage?.removeItem(IS220D_CAPTURE_HISTORY_STORAGE_KEY); } catch {}
  return deepFreeze(emptyHistory());
}

function groupSignalKeys(groupId) {
  const normalized = String(groupId || "all");
  if (normalized === "all") return new Set(CURRENT_SIGNAL_KEYS);
  if (!getIs220dDiagnosticGroup(normalized)) throw new Error(`Unknown IS220d capture group: ${normalized}`);
  const keys = new Set();
  for (const component of is220dDiagnosticComponentsForGroup(normalized)) {
    for (const group of component.signalGroups || []) {
      for (const key of group) if (CURRENT_SIGNAL_KEYS.has(key)) keys.add(key);
    }
  }
  return keys;
}

function valueMap(capture) {
  return new Map((capture?.evidence?.values || []).map(value => [value.signalKey, value]));
}

export function compareIs220dCaptureHistory(history, context, groupId = "all") {
  const cleanContext = cleanString(context, 32);
  if (!IS220D_CAPTURE_CONTEXTS[cleanContext]) throw new Error(`Unknown IS220d capture context: ${cleanContext}`);
  const cleanHistory = sanitizeHistory(history);
  const compatible = cleanHistory.captures.filter(capture => capture.context === cleanContext);
  const selected = compatible.slice(-2);
  if (selected.length < 2) {
    return deepFreeze({
      status: "insufficient-history",
      context: cleanContext,
      groupId: String(groupId || "all"),
      compatibleCaptureCount: compatible.length,
      previous: selected[0] || null,
      current: selected[1] || selected[0] || null,
      values: []
    });
  }

  const allowedKeys = groupSignalKeys(groupId);
  const previous = selected[0];
  const current = selected[1];
  const before = valueMap(previous);
  const after = valueMap(current);
  const values = [];
  for (const key of allowedKeys) {
    const left = before.get(key);
    const right = after.get(key);
    if (!left || !right) continue;
    values.push({
      signalKey: key,
      label: getIs220dDiagnosticSignal(key)?.label || key,
      unit: right.unit || left.unit || "",
      previous: left.value,
      current: right.value,
      delta: right.value - left.value
    });
  }
  values.sort((a, b) => a.signalKey.localeCompare(b.signalKey));
  return deepFreeze({
    status: values.length ? "comparable" : "no-common-values",
    context: cleanContext,
    groupId: String(groupId || "all"),
    compatibleCaptureCount: compatible.length,
    previous,
    current,
    values
  });
}

export function summarizeIs220dCaptureHistory(history) {
  const clean = sanitizeHistory(history);
  const counts = Object.fromEntries(Object.keys(IS220D_CAPTURE_CONTEXTS).map(key => [key, 0]));
  for (const capture of clean.captures) counts[capture.context]++;
  return deepFreeze({
    total: clean.captures.length,
    counts,
    latest: clean.captures.at(-1) || null
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "–";
  const decimals = Math.abs(numeric) >= 100 ? 0 : Math.abs(numeric) >= 10 ? 1 : 2;
  return numeric.toFixed(decimals);
}

function formatTime(value) {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) return "";
  try {
    return new Intl.DateTimeFormat("fi-FI", { dateStyle: "short", timeStyle: "short" }).format(new Date(Number(value)));
  } catch {
    return "";
  }
}

export function buildIs220dCaptureHistoryHtml(history, candidate, context = "", groupId = "all") {
  const cleanHistory = sanitizeHistory(history);
  const cleanCandidate = sanitizeIs220dCaptureEvidence(candidate);
  const summary = summarizeIs220dCaptureHistory(cleanHistory);
  const candidateLabel = cleanCandidate.runId || cleanCandidate.startedAt
    ? `Viimeisin ajo: ${escapeHtml(cleanCandidate.runId || `run-${cleanCandidate.startedAt}`)} · signaaleja ${cleanCandidate.observedSignalKeys.length} · arvoja ${cleanCandidate.values.length}`
    : "Viimeisintä tallennettavaa diagnoosia ei ole vielä saatavilla.";
  const chips = Object.entries(IS220D_CAPTURE_CONTEXTS)
    .map(([key, meta]) => `<span>${escapeHtml(meta.label)} ${Number(summary.counts[key] || 0)}</span>`)
    .join("");
  let comparisonHtml = '<div class="bom-capture-empty">Valitse käyttötila. Vertailu tehdään vain saman käyttötilan captureiden välillä.</div>';
  if (IS220D_CAPTURE_CONTEXTS[context]) {
    const comparison = compareIs220dCaptureHistory(cleanHistory, context, groupId);
    if (comparison.status === "insufficient-history") {
      comparisonHtml = `<div class="bom-capture-empty">${escapeHtml(IS220D_CAPTURE_CONTEXTS[context].label)}: tarvitaan vähintään kaksi erillistä ajoa vertailuun (${comparison.compatibleCaptureCount}/2).</div>`;
    } else if (comparison.status === "no-common-values") {
      comparisonHtml = '<div class="bom-capture-empty">Kahdessa viimeisessä saman tilan ajossa ei ole yhteisiä purettuja arvoja tällä tarkastusalueella.</div>';
    } else {
      const rows = comparison.values.map(value => `<tr><td>${escapeHtml(value.label)}</td><td>${formatValue(value.previous)} ${escapeHtml(value.unit)}</td><td>${formatValue(value.current)} ${escapeHtml(value.unit)}</td><td>${value.delta >= 0 ? "+" : ""}${formatValue(value.delta)} ${escapeHtml(value.unit)}</td></tr>`).join("");
      comparisonHtml = `<div class="bom-capture-compare-head">Saman käyttötilan kaksi viimeisintä ajoa · ${escapeHtml(formatTime(comparison.previous.evidence.endedAt || comparison.previous.recordedAt))} → ${escapeHtml(formatTime(comparison.current.evidence.endedAt || comparison.current.recordedAt))}</div><div class="bom-capture-table-wrap"><table><thead><tr><th>Signaali</th><th>Edellinen</th><th>Nykyinen</th><th>Muutos</th></tr></thead><tbody>${rows}</tbody></table></div><small>Muutos on numeerinen ero, ei automaattinen vikatuomio.</small>`;
    }
  }
  return `<div class="bom-capture-head"><div><strong>Käyttötilakohtaiset capturet</strong><span>${summary.total} tallennettua ajoa</span></div><small>Eri käyttötilojen arvoja ei yhdistetä samaksi mittaushetkeksi.</small></div><div class="bom-capture-candidate">${candidateLabel}</div><div class="bom-capture-chips">${chips}</div>${comparisonHtml}`;
}

let latestEvidence = null;
let latestRunIdentity = "";
let listenersInstalled = false;

function selectedGroupId() {
  if (typeof document === "undefined") return "all";
  const value = String(document.querySelector("#bomDiagnosticRunGroup")?.value || "all");
  return value === "all" || getIs220dDiagnosticGroup(value) ? value : "all";
}

function ensureStyles() {
  if (typeof document === "undefined" || document.querySelector("#bom-capture-history-styles")) return;
  const style = document.createElement("style");
  style.id = "bom-capture-history-styles";
  style.textContent = `
    .bom-capture-history{margin-top:10px;padding:9px;border:1px solid var(--line);border-radius:10px;background:var(--surface-inset)}
    .bom-capture-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.bom-capture-head>div{display:flex;flex-direction:column;gap:3px}.bom-capture-head strong{font-size:10px}.bom-capture-head span,.bom-capture-head small{color:var(--muted);font-size:8px;line-height:1.35}.bom-capture-head small{max-width:50%;text-align:right}
    .bom-capture-controls{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;margin-top:8px}.bom-capture-controls select{min-width:0}.bom-capture-controls button{padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text-strong);font-size:8px;font-weight:800}.bom-capture-controls .danger{grid-column:1/-1;color:var(--warning)}
    .bom-capture-candidate,.bom-capture-empty,.bom-capture-compare-head{margin-top:7px;color:var(--muted);font-size:8px;line-height:1.4}.bom-capture-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px}.bom-capture-chips span{padding:3px 5px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:7px;font-weight:800}
    .bom-capture-table-wrap{overflow:auto;margin-top:6px}.bom-capture-table-wrap table{width:100%;border-collapse:collapse;font-size:8px}.bom-capture-table-wrap th,.bom-capture-table-wrap td{padding:5px;border-bottom:1px solid var(--line-soft);text-align:right;white-space:nowrap}.bom-capture-table-wrap th:first-child,.bom-capture-table-wrap td:first-child{text-align:left}.bom-capture-history>small{display:block;margin-top:5px;color:var(--muted);font-size:7px}
  `;
  document.head.append(style);
}

function ensurePanel() {
  if (typeof document === "undefined") return null;
  let panel = document.querySelector("#bomCaptureHistory");
  if (panel) return panel;
  const guided = document.querySelector("#bomGuidedSession");
  if (!guided) return null;
  ensureStyles();
  panel = document.createElement("div");
  panel.id = "bomCaptureHistory";
  panel.className = "bom-capture-history";
  panel.innerHTML = `<div id="bomCaptureHistoryBody"></div><div class="bom-capture-controls"><select id="bomCaptureContext"><option value="">Valitse käyttötila…</option>${Object.entries(IS220D_CAPTURE_CONTEXTS).map(([key, meta]) => `<option value="${key}">${escapeHtml(meta.label)} · ${escapeHtml(meta.description)}</option>`).join("")}</select><button id="bomSaveCapture" type="button">Tallenna viimeisin ajo</button><button id="bomClearCaptureHistory" class="danger" type="button">Tyhjennä capture-historia</button></div>`;
  guided.append(panel);
  return panel;
}

function render(storage = globalThis.localStorage) {
  if (typeof document === "undefined") return null;
  const panel = ensurePanel();
  if (!panel) return null;
  const context = String(panel.querySelector("#bomCaptureContext")?.value || "");
  const candidate = latestEvidence || readIs220dCaptureCandidate(storage);
  const body = panel.querySelector("#bomCaptureHistoryBody");
  if (body) body.innerHTML = buildIs220dCaptureHistoryHtml(readIs220dCaptureHistory(storage), candidate, context, selectedGroupId());
  const save = panel.querySelector("#bomSaveCapture");
  if (save) save.disabled = !IS220D_CAPTURE_CONTEXTS[context] || (!candidate.runId && !candidate.startedAt) || (!candidate.observedSignalKeys.length && !candidate.values.length);
  return { history: readIs220dCaptureHistory(storage), candidate, context };
}

function installListeners(storage) {
  if (typeof document === "undefined" || listenersInstalled) return;
  const panel = ensurePanel();
  if (!panel) return;
  panel.querySelector("#bomCaptureContext")?.addEventListener("change", () => render(storage));
  panel.querySelector("#bomSaveCapture")?.addEventListener("click", () => {
    const context = String(panel.querySelector("#bomCaptureContext")?.value || "");
    const candidate = latestEvidence || readIs220dCaptureCandidate(storage);
    try { saveIs220dCapture(candidate, context, { storage }); } catch {}
    render(storage);
  });
  panel.querySelector("#bomClearCaptureHistory")?.addEventListener("click", () => {
    clearIs220dCaptureHistory(storage);
    render(storage);
  });
  const rerender = () => globalThis.queueMicrotask?.(() => render(storage));
  document.querySelector("#bomDiagnosticRunGroup")?.addEventListener("change", rerender);
  document.querySelector("#bomGroupFilter")?.addEventListener("change", rerender);
  listenersInstalled = true;
}

export function publishIs220dCaptureHistory(evidence, storage = globalThis.localStorage) {
  const clean = evidence ? writeIs220dCaptureCandidate(evidence, storage) : readIs220dCaptureCandidate(storage);
  const runIdentity = clean.runId || (clean.startedAt ? `run-${clean.startedAt}` : "");
  if (runIdentity && runIdentity !== latestRunIdentity) {
    latestRunIdentity = runIdentity;
    latestEvidence = clean;
    if (typeof document !== "undefined") {
      const select = document.querySelector("#bomCaptureContext");
      if (select) select.value = "";
    }
  } else if (runIdentity) {
    latestEvidence = clean;
  }
  if (typeof document === "undefined") {
    return deepFreeze({ history: readIs220dCaptureHistory(storage), candidate: clean });
  }
  ensurePanel();
  installListeners(storage);
  return render(storage);
}
