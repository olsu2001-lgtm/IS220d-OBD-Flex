import { IS220D_DIAGNOSTIC_GROUPS, getIs220dDiagnosticGroup } from "./is220d-diagnostic-groups.js";
import { buildIs220dDiagnosticGroupPlan } from "./is220d-diagnostic-plan.js";
import { getIs220dDiagnosticSignal } from "./is220d-diagnostic-signals.js";

const STATE_META = Object.freeze({
  "key-on": Object.freeze({ label: "Virrat päällä · moottori sammuksissa (KOEO)", shortLabel: "KOEO", order: 1 }),
  cranking: Object.freeze({ label: "Starttauksen aikana", shortLabel: "STARTTAUS", order: 2 }),
  running: Object.freeze({ label: "Moottori käy", shortLabel: "KÄYNTI", order: 3 }),
  "warm-idle": Object.freeze({ label: "Lämmin vakaa tyhjäkäynti", shortLabel: "LÄMMIN TYHJÄKÄYNTI", order: 4 })
});

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

function plansForScope(groupId) {
  if (groupId === "all") return IS220D_DIAGNOSTIC_GROUPS.map(group => buildIs220dDiagnosticGroupPlan(group.id, {}));
  if (!getIs220dDiagnosticGroup(groupId)) throw new Error(`Unknown IS220d operating-state group: ${groupId}`);
  return [buildIs220dDiagnosticGroupPlan(groupId, {})];
}

/**
 * Describes the operating states supported by the production-authorized signals
 * that the existing wide diagnostic can actually collect for a BOM scope.
 * This is guidance only and cannot create or authorize a vehicle request.
 */
export function buildIs220dOperatingStateGuidance(groupId = "all") {
  const normalizedId = String(groupId || "all");
  const signalByKey = new Map();
  for (const plan of plansForScope(normalizedId)) {
    for (const planned of plan.signals) {
      if (!planned.productionAuthorized || !planned.collectedByWideDiagnostic) continue;
      const signal = getIs220dDiagnosticSignal(planned.signalKey);
      if (!signal) continue;
      signalByKey.set(signal.key, signal);
    }
  }

  const stateMap = new Map();
  for (const signal of signalByKey.values()) {
    for (const state of signal.operatingStates || []) {
      const meta = STATE_META[state];
      if (!meta) continue;
      const entry = stateMap.get(state) || { state, ...meta, signals: [] };
      if (!entry.signals.some(item => item.key === signal.key)) {
        entry.signals.push({ key: signal.key, label: signal.label, evidence: signal.evidence });
      }
      stateMap.set(state, entry);
    }
  }

  const states = [...stateMap.values()]
    .map(entry => deepFreeze({ ...entry, signalCount: entry.signals.length }))
    .sort((a, b) => a.order - b.order);
  const primary = [...states].sort((a, b) => {
    const count = b.signalCount - a.signalCount;
    if (count) return count;
    const preference = { running: 0, "key-on": 1, cranking: 2, "warm-idle": 3 };
    return (preference[a.state] ?? 9) - (preference[b.state] ?? 9);
  })[0] || null;

  return deepFreeze({
    groupId: normalizedId,
    signalCount: signalByKey.size,
    states,
    primaryState: primary?.state || null,
    primaryLabel: primary?.label || "",
    requiresMultipleCaptures: states.length > 1
  });
}

export function buildIs220dOperatingStateGuidanceHtml(guidance, declaredState = "auto") {
  if (!guidance?.states?.length) return '<div class="bom-state-empty">Nykyisille varmennetuille signaaleille ei ole toimintatilaohjetta.</div>';
  const declared = String(declaredState || "auto");
  const compatibleState = declared === "running" ? "running" : declared === "stopped" ? "key-on" : null;
  const compatible = compatibleState ? guidance.states.some(item => item.state === compatibleState) : null;
  const currentText = declared === "running"
    ? `Valittu ajo: moottori käy${compatible ? " · sopii tämän alueen signaaleille" : ""}`
    : declared === "stopped"
      ? `Valittu ajo: moottori ei käy / KOEO${compatible ? " · sopii tämän alueen signaaleille" : ""}`
      : "Valittu ajo: tila päätellään kierrosluvusta automaattisesti";
  const cards = guidance.states.map(item => `<div class="bom-state-card${item.state === guidance.primaryState ? " primary" : ""}">
      <strong>${escapeHtml(item.shortLabel)}</strong><span>${escapeHtml(item.label)}</span><small>${item.signalCount} nykytestin varmennettua signaalia</small>
    </div>`).join("");
  const multi = guidance.requiresMultipleCaptures
    ? "Eri toimintatilat täydentävät toisiaan. KOEO- ja käyntivertailu kannattaa tarvittaessa tallentaa erillisinä ajoina."
    : "Yksi toimintatila kattaa tämän alueen nykyisen varmennetun signaalijoukon.";
  return `<div class="bom-state-head"><strong>Toimintatilat</strong><span>${guidance.signalCount} nykytestin signaalia</span></div>
    <div class="bom-state-grid">${cards}</div>
    <div class="bom-state-current">${escapeHtml(currentText)}</div>
    <div class="bom-state-note">${escapeHtml(multi)}</div>`;
}

function ensureStyles() {
  if (typeof document === "undefined" || document.querySelector("#bom-operating-state-styles")) return;
  const style = document.createElement("style");
  style.id = "bom-operating-state-styles";
  style.textContent = `
    .bom-operating-state { margin-top:9px; padding-top:9px; border-top:1px solid var(--line-soft); }
    .bom-state-head { display:flex; justify-content:space-between; gap:10px; align-items:center; }
    .bom-state-head strong { color:var(--text-strong); font-size:10px; }
    .bom-state-head span { color:var(--muted); font-size:8px; }
    .bom-state-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:5px; margin-top:7px; }
    .bom-state-card { display:flex; flex-direction:column; gap:2px; padding:7px; border:1px solid var(--line); border-radius:8px; background:var(--surface); }
    .bom-state-card.primary { border-color:var(--info-border); }
    .bom-state-card strong { color:var(--info); font-size:7px; letter-spacing:.04em; }
    .bom-state-card span { color:var(--text-strong); font-size:9px; line-height:1.35; }
    .bom-state-card small { color:var(--muted); font-size:7px; line-height:1.3; }
    .bom-state-current { margin-top:7px; color:var(--text-strong); font-size:9px; }
    .bom-state-note,.bom-state-empty { margin-top:5px; color:var(--muted); font-size:8px; line-height:1.4; }
  `;
  document.head.append(style);
}

function selectedGroupId() {
  const value = String(document.querySelector("#bomDiagnosticRunGroup")?.value || "all");
  return value === "all" || getIs220dDiagnosticGroup(value) ? value : "all";
}

function render() {
  if (typeof document === "undefined") return null;
  const target = document.querySelector("#bomOperatingStateGuidance");
  if (!target) return null;
  const guidance = buildIs220dOperatingStateGuidance(selectedGroupId());
  const declaredState = document.querySelector("#bomDiagnosticEngineState")?.value || "auto";
  target.innerHTML = buildIs220dOperatingStateGuidanceHtml(guidance, declaredState);
  return guidance;
}

function ensurePanel() {
  if (typeof document === "undefined") return null;
  const existing = document.querySelector("#bomOperatingStateGuidance");
  if (existing) return existing;
  const guided = document.querySelector("#bomGuidedSession");
  if (!guided) return null;
  ensureStyles();
  const panel = document.createElement("div");
  panel.id = "bomOperatingStateGuidance";
  panel.className = "bom-operating-state";
  guided.append(panel);
  document.querySelector("#bomDiagnosticRunGroup")?.addEventListener("change", render);
  document.querySelector("#bomGroupFilter")?.addEventListener("change", () => globalThis.queueMicrotask?.(render));
  document.querySelector("#bomDiagnosticEngineState")?.addEventListener("change", render);
  render();
  return panel;
}

export function publishIs220dOperatingStateGuidance() {
  ensurePanel();
  return typeof document === "undefined" ? buildIs220dOperatingStateGuidance("all") : render();
}

ensurePanel();
