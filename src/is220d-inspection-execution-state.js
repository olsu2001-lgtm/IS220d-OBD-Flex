import { IS220D_COMPONENT_INSPECTION_POINTS } from "./is220d-component-inspection-points.js";
import { IS220D_FUEL_INSPECTION_POINTS } from "./is220d-fuel-inspection-points.js";
import { IS220D_STARTING_CHARGING_INSPECTION_POINTS } from "./is220d-starting-charging-inspection-points.js";
import { IS220D_AIR_EXHAUST_INSPECTION_POINTS } from "./is220d-air-exhaust-inspection-points.js";
import { getIs220dDiagnosticGroupForComponent } from "./is220d-diagnostic-groups.js";
import { getIs220dDiagnosticSignal } from "./is220d-diagnostic-signals.js";
import {
  buildIs220dTechstreamEvidenceState,
  readIs220dTechstreamEvidence
} from "./is220d-techstream-evidence.js";

export const IS220D_INSPECTION_EXECUTION_SCHEMA_VERSION = 1;
export const IS220D_INSPECTION_PROGRESS_STORAGE_KEY = "lexusIs220dInspectionPointProgressV1";

export const IS220D_INSPECTION_EXECUTION_STATUSES = Object.freeze({
  "not-started": "EI ALOITETTU",
  partial: "OSITTAIN",
  "evidence-collected": "EVIDENSSI KERÄTTY",
  "requires-physical-confirmation": "VAATII FYYSISEN VARMISTUKSEN",
  "awaiting-verified-signal": "ODOTTAA VARMENNETTUA SIGNAALIA"
});

const MANUAL_FINDINGS = new Set(["checked-normal", "deviation-found"]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizePoint(point, family) {
  const groupId = String(point.groupId || getIs220dDiagnosticGroupForComponent(point.componentId)?.id || "");
  return {
    id: point.id,
    componentId: point.componentId,
    label: point.label,
    kind: point.kind,
    groupId,
    operatingStates: Object.freeze([...(point.operatingStates || [])]),
    signalKeys: Object.freeze([...(point.signalKeys || [])]),
    sourceRows: Object.freeze([...(point.sourceRows || [])]),
    family,
    requiresPhysicalConfirmation: point.kind === "physical" || (point.operatingStates || []).includes("physical")
  };
}

const ALL_POINTS = [
  ...IS220D_COMPONENT_INSPECTION_POINTS.map(point => normalizePoint(point, "core")),
  ...IS220D_FUEL_INSPECTION_POINTS.map(point => normalizePoint(point, "fuel")),
  ...IS220D_STARTING_CHARGING_INSPECTION_POINTS.map(point => normalizePoint(point, "starting-charging")),
  ...IS220D_AIR_EXHAUST_INSPECTION_POINTS.map(point => normalizePoint(point, "air-exhaust"))
];

const pointIds = new Set();
for (const point of ALL_POINTS) {
  if (pointIds.has(point.id)) throw new Error(`Duplicate IS220d inspection execution point id: ${point.id}`);
  pointIds.add(point.id);
  if (!point.groupId) throw new Error(`Inspection execution point ${point.id} has no diagnostic group`);
  for (const key of point.signalKeys) {
    const signal = getIs220dDiagnosticSignal(key);
    if (!signal) throw new Error(`Inspection execution point ${point.id} references unknown signal ${key}`);
    if (signal.authorization === "field-rejected") throw new Error(`Field-rejected signal cannot enter inspection execution point ${point.id}`);
  }
}

export const IS220D_ALL_INSPECTION_POINTS = deepFreeze(ALL_POINTS);
const POINT_BY_ID = new Map(IS220D_ALL_INSPECTION_POINTS.map(point => [point.id, point]));

function emptyProgress() {
  return { schemaVersion: IS220D_INSPECTION_EXECUTION_SCHEMA_VERSION, items: {} };
}

function sanitizeProgress(parsed) {
  if (!parsed || parsed.schemaVersion !== IS220D_INSPECTION_EXECUTION_SCHEMA_VERSION || typeof parsed.items !== "object" || Array.isArray(parsed.items)) return emptyProgress();
  const items = {};
  for (const [id, value] of Object.entries(parsed.items)) {
    const point = POINT_BY_ID.get(id);
    if (!point?.requiresPhysicalConfirmation || !MANUAL_FINDINGS.has(value?.finding)) continue;
    items[id] = {
      finding: value.finding,
      updatedAt: Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : 0
    };
  }
  return { schemaVersion: IS220D_INSPECTION_EXECUTION_SCHEMA_VERSION, items };
}

export function readIs220dInspectionPointProgress(storage = globalThis.localStorage) {
  try {
    return sanitizeProgress(JSON.parse(storage?.getItem(IS220D_INSPECTION_PROGRESS_STORAGE_KEY) || "null"));
  } catch {
    return emptyProgress();
  }
}

export function writeIs220dInspectionPointFinding(pointId, finding, {
  storage = globalThis.localStorage,
  now = Date.now()
} = {}) {
  const id = String(pointId || "");
  const point = POINT_BY_ID.get(id);
  if (!point) throw new Error(`Unknown IS220d inspection point: ${id}`);
  if (!point.requiresPhysicalConfirmation) throw new Error(`Inspection point ${id} does not accept manual physical confirmation`);
  const progress = readIs220dInspectionPointProgress(storage);
  if (finding == null || finding === "") delete progress.items[id];
  else {
    if (!MANUAL_FINDINGS.has(finding)) throw new Error(`Invalid IS220d inspection finding: ${finding}`);
    progress.items[id] = { finding, updatedAt: Number(now) || 0 };
  }
  try { storage?.setItem(IS220D_INSPECTION_PROGRESS_STORAGE_KEY, JSON.stringify(progress)); } catch {}
  return progress;
}

export function clearIs220dInspectionPointProgress(storage = globalThis.localStorage) {
  try { storage?.removeItem(IS220D_INSPECTION_PROGRESS_STORAGE_KEY); } catch {}
  return emptyProgress();
}

function mergedSignalStates(coverage) {
  const states = new Map();
  for (const component of coverage?.components || []) {
    for (const group of component?.groupEvidence || []) {
      for (const state of group?.signals || []) {
        const key = String(state?.signalKey || "");
        if (!key) continue;
        const previous = states.get(key) || { attempted: false, observed: false, attempts: 0 };
        states.set(key, {
          attempted: previous.attempted || state?.attempted === true,
          observed: previous.observed || state?.observed === true,
          attempts: Math.max(previous.attempts, Number(state?.attempts || 0))
        });
      }
    }
  }
  return states;
}

function referenceByPoint(referenceEvidence) {
  const map = new Map();
  for (const point of referenceEvidence?.points || []) {
    if (!POINT_BY_ID.has(point?.pointId)) continue;
    const availableTargets = (point.targets || []).filter(target => target?.available === true);
    if (!availableTargets.length) continue;
    map.set(point.pointId, {
      availableCount: availableTargets.length,
      targetCount: Number(point.targetCount || point.targets?.length || availableTargets.length),
      targetKeys: availableTargets.map(target => String(target.key || "")).filter(Boolean)
    });
  }
  return map;
}

function evaluatePoint(point, signalStates, progress, references) {
  const signals = point.signalKeys.map(key => {
    const definition = getIs220dDiagnosticSignal(key);
    const state = signalStates.get(key) || { attempted: false, observed: false, attempts: 0 };
    return {
      key,
      label: definition.label,
      productionAuthorized: definition.productionAuthorized === true,
      collectedByWideDiagnostic: definition.collectedByWideDiagnostic === true,
      authorization: definition.authorization,
      evidence: definition.evidence,
      attempted: state.attempted === true,
      observed: state.observed === true,
      attempts: Number(state.attempts || 0)
    };
  });
  const authorized = signals.filter(signal => signal.productionAuthorized);
  const observed = authorized.filter(signal => signal.observed);
  const attempted = authorized.filter(signal => signal.attempted);
  const awaiting = signals.filter(signal => !signal.productionAuthorized);
  const manual = progress?.items?.[point.id] || null;
  const reference = references.get(point.id) || null;
  const hasReference = Number(reference?.availableCount || 0) > 0;

  let status = "not-started";
  let reason = "Pisteelle ei ole vielä kerätty sallittua sähköistä evidenssiä.";

  if (point.requiresPhysicalConfirmation && !manual) {
    status = "requires-physical-confirmation";
    reason = "Piste sisältää fyysisen tarkastuksen, jota Flex ei voi päätellä OBD-datasta.";
  } else if (point.requiresPhysicalConfirmation && manual) {
    status = "evidence-collected";
    reason = manual.finding === "deviation-found"
      ? "Fyysinen tarkastus on kuitattu ja siinä havaittiin poikkeama."
      : "Fyysinen tarkastus on kuitattu ilman kirjattua poikkeamaa.";
  } else if (authorized.length > 0 && observed.length === authorized.length) {
    status = "evidence-collected";
    reason = `Kaikki pisteen nykyiset sallitut live-signaalit havaittiin (${observed.length}/${authorized.length}).`;
  } else if (hasReference || observed.length > 0 || attempted.length > 0) {
    status = "partial";
    const liveText = `Live-evidenssi ${observed.length}/${authorized.length}; ${attempted.length} signaalia yritettiin.`;
    const referenceText = hasReference
      ? ` Techstream CSV -offline-referenssi saatavilla ${reference.availableCount}/${reference.targetCount}, mutta sitä ei käsitellä saman ajon live-mittauksena.`
      : "";
    reason = `${liveText}${referenceText}`;
  } else if (authorized.length === 0 && awaiting.length > 0) {
    status = "awaiting-verified-signal";
    reason = "Pisteen sähköinen evidenssi riippuu vain signaalista, jota ei ole vielä hyväksytty tuotantolukuun.";
  }

  return deepFreeze({
    ...point,
    status,
    statusLabel: IS220D_INSPECTION_EXECUTION_STATUSES[status],
    reason,
    finding: manual?.finding || "",
    findingLabel: manual?.finding === "deviation-found" ? "POIKKEAMA HAVAITTU" : manual?.finding === "checked-normal" ? "EI KIRJATTUA POIKKEAMAA" : "",
    updatedAt: Number(manual?.updatedAt || 0),
    signals: deepFreeze(signals),
    evidence: deepFreeze({
      totalSignals: signals.length,
      authorizedSignals: authorized.length,
      observedAuthorized: observed.length,
      attemptedAuthorized: attempted.length,
      awaitingVerification: awaiting.length,
      awaitingSignalKeys: Object.freeze(awaiting.map(signal => signal.key)),
      observedSignalKeys: Object.freeze(observed.map(signal => signal.key)),
      offlineReferenceAvailable: hasReference,
      offlineReferenceAvailableCount: Number(reference?.availableCount || 0),
      offlineReferenceTargetCount: Number(reference?.targetCount || 0),
      offlineReferenceTargetKeys: Object.freeze([...(reference?.targetKeys || [])])
    })
  });
}

export function buildIs220dInspectionExecutionState(coverage, progress = emptyProgress(), groupId = "all", referenceEvidence = null) {
  const normalizedGroup = String(groupId || "all");
  const signalStates = mergedSignalStates(coverage);
  const references = referenceByPoint(referenceEvidence);
  const points = IS220D_ALL_INSPECTION_POINTS
    .filter(point => normalizedGroup === "all" || point.groupId === normalizedGroup)
    .map(point => evaluatePoint(point, signalStates, progress, references));
  const count = status => points.filter(point => point.status === status).length;
  return deepFreeze({
    schemaVersion: IS220D_INSPECTION_EXECUTION_SCHEMA_VERSION,
    groupId: normalizedGroup,
    pointCount: points.length,
    componentCount: new Set(points.map(point => point.componentId)).size,
    points,
    summary: {
      total: points.length,
      notStarted: count("not-started"),
      partial: count("partial"),
      evidenceCollected: count("evidence-collected"),
      requiresPhysicalConfirmation: count("requires-physical-confirmation"),
      awaitingVerifiedSignal: count("awaiting-verified-signal"),
      offlineReferencePoints: points.filter(point => point.evidence.offlineReferenceAvailable).length,
      deviationsFound: points.filter(point => point.finding === "deviation-found").length
    }
  });
}

function statusClass(status) {
  return ({
    "not-started": "idle",
    partial: "partial",
    "evidence-collected": "done",
    "requires-physical-confirmation": "physical",
    "awaiting-verified-signal": "waiting"
  })[status] || "idle";
}

export function buildIs220dInspectionExecutionSummaryHtml(state) {
  const summary = state?.summary || {};
  return `<div class="bom-exec-summary-head"><div><strong>Tarkastuspisteiden suoritus</strong><span>${Number(state?.pointCount || 0)} pistettä · ${Number(state?.componentCount || 0)} komponenttia</span></div><small>Tilat muodostuvat kerätystä read-only-datasta, fyysisistä kuittauksista ja erikseen merkitystä offline-referenssistä.</small></div><div class="bom-exec-summary-grid"><span class="done">EVIDENSSI ${Number(summary.evidenceCollected || 0)}</span><span class="partial">OSITTAIN ${Number(summary.partial || 0)}</span><span class="physical">FYYSINEN ${Number(summary.requiresPhysicalConfirmation || 0)}</span><span class="waiting">ODOTTAA SIGNAALIA ${Number(summary.awaitingVerifiedSignal || 0)}</span><span class="idle">EI ALOITETTU ${Number(summary.notStarted || 0)}</span>${Number(summary.offlineReferencePoints || 0) ? `<span class="reference">TECHSTREAM REF ${Number(summary.offlineReferencePoints || 0)}</span>` : ""}${Number(summary.deviationsFound || 0) ? `<span class="deviation">POIKKEAMIA ${Number(summary.deviationsFound || 0)}</span>` : ""}</div>`;
}

const CARD_SELECTORS = [
  id => `[data-bom-point="${id}"]`,
  id => `[data-bom-fuel-point="${id}"]`,
  id => `[data-bom-start-point="${id}"]`,
  id => `[data-bom-ae-point="${id}"]`
];

let latestCoverage = null;

function selectedGroupId() {
  if (typeof document === "undefined") return "all";
  const value = String(document.querySelector("#bomDiagnosticRunGroup")?.value || "all");
  return value || "all";
}

function findPointCard(id) {
  for (const selector of CARD_SELECTORS) {
    const element = document.querySelector(selector(id));
    if (element) return element;
  }
  return null;
}

function renderPointState(point) {
  const card = findPointCard(point.id);
  if (!card) return;
  card.querySelector(".bom-exec-point-state")?.remove();
  const box = document.createElement("div");
  box.className = `bom-exec-point-state ${statusClass(point.status)}`;
  const awaiting = point.evidence.awaitingSignalKeys.length
    ? `<div class="bom-exec-awaiting">Odottaa: ${escapeHtml(point.evidence.awaitingSignalKeys.join(", "))}</div>`
    : "";
  const reference = point.evidence.offlineReferenceAvailable
    ? `<div class="bom-exec-reference">Techstream-ref: ${escapeHtml(point.evidence.offlineReferenceTargetKeys.join(", "))}</div>`
    : "";
  const finding = point.findingLabel ? `<span class="bom-exec-finding">${escapeHtml(point.findingLabel)}</span>` : "";
  const actions = point.requiresPhysicalConfirmation
    ? `<div class="bom-exec-actions"><button type="button" data-bom-point-action="checked-normal" data-point-id="${escapeHtml(point.id)}">Tarkastettu</button><button type="button" data-bom-point-action="deviation-found" data-point-id="${escapeHtml(point.id)}">Poikkeama</button>${point.finding ? `<button type="button" data-bom-point-action="clear" data-point-id="${escapeHtml(point.id)}">Nollaa</button>` : ""}</div>`
    : "";
  box.innerHTML = `<div class="bom-exec-state-line"><strong>${escapeHtml(point.statusLabel)}</strong>${finding}</div><div class="bom-exec-reason">${escapeHtml(point.reason)}</div>${awaiting}${reference}${actions}`;
  const head = card.firstElementChild;
  if (head?.after) head.after(box);
  else card.prepend(box);
}

function ensureStyles() {
  if (typeof document === "undefined" || document.querySelector("#bom-inspection-execution-styles")) return;
  const style = document.createElement("style");
  style.id = "bom-inspection-execution-styles";
  style.textContent = `
    .bom-inspection-execution{margin-top:10px;padding:9px;border:1px solid var(--line);border-radius:10px;background:var(--surface-inset)}
    .bom-exec-summary-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.bom-exec-summary-head>div{display:flex;flex-direction:column;gap:3px}.bom-exec-summary-head strong{font-size:10px}.bom-exec-summary-head span,.bom-exec-summary-head small{color:var(--muted);font-size:8px;line-height:1.35}.bom-exec-summary-head small{max-width:48%;text-align:right}
    .bom-exec-summary-grid{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}.bom-exec-summary-grid span,.bom-exec-point-state strong,.bom-exec-finding{display:inline-flex;padding:3px 6px;border:1px solid var(--line);border-radius:999px;font-size:7px;font-weight:800;letter-spacing:.02em}
    .bom-exec-point-state{margin:7px 0 0;padding:7px;border:1px solid var(--line-soft);border-radius:8px;background:var(--surface-inset)}.bom-exec-state-line{display:flex;align-items:center;gap:5px;flex-wrap:wrap}.bom-exec-reason,.bom-exec-awaiting,.bom-exec-reference{margin-top:4px;color:var(--muted);font-size:8px;line-height:1.35}.bom-exec-awaiting,.bom-exec-reference{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.bom-exec-reference{color:var(--info)}
    .bom-exec-actions{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.bom-exec-actions button{padding:5px 7px;border:1px solid var(--line);border-radius:7px;background:var(--surface);color:var(--text-strong);font-size:8px;font-weight:800}.bom-exec-actions button:active{transform:translateY(1px)}
    .bom-exec-point-state.done strong,.bom-exec-summary-grid .done{border-color:var(--success-border);color:var(--success)}.bom-exec-point-state.partial strong,.bom-exec-summary-grid .partial{border-color:var(--warning-border);color:var(--warning)}.bom-exec-point-state.physical strong,.bom-exec-summary-grid .physical,.bom-exec-summary-grid .reference{color:var(--info)}.bom-exec-point-state.waiting strong,.bom-exec-summary-grid .waiting{color:var(--muted)}.bom-exec-summary-grid .deviation,.bom-exec-finding{border-color:var(--warning-border);color:var(--warning)}
  `;
  document.head.append(style);
}

function currentReferenceEvidence() {
  return buildIs220dTechstreamEvidenceState(readIs220dTechstreamEvidence());
}

function currentState() {
  return buildIs220dInspectionExecutionState(latestCoverage, readIs220dInspectionPointProgress(), selectedGroupId(), currentReferenceEvidence());
}

function render() {
  if (typeof document === "undefined") return buildIs220dInspectionExecutionState(latestCoverage, readIs220dInspectionPointProgress(), "all", currentReferenceEvidence());
  ensureStyles();
  const state = currentState();
  const target = document.querySelector("#bomInspectionExecutionState");
  if (target) target.innerHTML = buildIs220dInspectionExecutionSummaryHtml(state);
  for (const point of state.points) renderPointState(point);
  return state;
}

function handleAction(event) {
  const button = event.target?.closest?.("[data-bom-point-action][data-point-id]");
  if (!button) return;
  const pointId = String(button.dataset.pointId || "");
  const action = String(button.dataset.bomPointAction || "");
  writeIs220dInspectionPointFinding(pointId, action === "clear" ? null : action);
  render();
}

function ensurePanel() {
  if (typeof document === "undefined") return null;
  const existing = document.querySelector("#bomInspectionExecutionState");
  if (existing) return existing;
  const guided = document.querySelector("#bomGuidedSession");
  if (!guided) return null;
  ensureStyles();
  const panel = document.createElement("div");
  panel.id = "bomInspectionExecutionState";
  panel.className = "bom-inspection-execution";
  guided.prepend(panel);
  guided.addEventListener("click", handleAction);
  const rerender = () => globalThis.queueMicrotask?.(render);
  document.querySelector("#bomDiagnosticRunGroup")?.addEventListener("change", rerender);
  document.querySelector("#bomGroupFilter")?.addEventListener("change", rerender);
  document.addEventListener("is220d-techstream-evidence-changed", rerender);
  return panel;
}

export function publishIs220dInspectionExecutionState(coverage) {
  latestCoverage = coverage || null;
  ensurePanel();
  return render();
}

ensurePanel();