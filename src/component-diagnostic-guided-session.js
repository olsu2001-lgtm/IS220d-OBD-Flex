import {
  IS220D_DIAGNOSTIC_GROUPS,
  getIs220dDiagnosticGroup,
  is220dDiagnosticComponentsForGroup
} from "./is220d-diagnostic-groups.js";
import { IS220D_COMPONENT_DIAGNOSTICS } from "./is220d-component-diagnostics.js";
import { buildIs220dDiagnosticGroupPlan } from "./is220d-diagnostic-plan.js";

const STORAGE_KEY = "lexusIs220dBomGuidedSessionV1";
const ASSESSED_STATUSES = new Set(["normal-pattern", "deviation", "strong-deviation", "inconclusive"]);
const GAP_STATES = new Set(["not-authorized", "not-in-current-wide-diagnostic", "field-rejected"]);

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

function normalizePlanSummary(summary) {
  const integer = key => Math.max(0, Number.parseInt(summary?.[key], 10) || 0);
  return deepFreeze({
    componentCount: integer("componentCount"),
    coveredComponents: integer("coveredComponents"),
    selectedSignalCount: integer("selectedSignalCount"),
    alreadyObserved: integer("alreadyObserved"),
    availableInCurrentWideDiagnostic: integer("availableInCurrentWideDiagnostic"),
    notInCurrentWideDiagnostic: integer("notInCurrentWideDiagnostic"),
    notAuthorized: integer("notAuthorized"),
    fieldRejected: integer("fieldRejected")
  });
}

function planSummaryForGroup(groupId, planSummaries) {
  const supplied = (Array.isArray(planSummaries) ? planSummaries : []).find(item => item?.id === groupId)?.summary;
  if (supplied) return normalizePlanSummary(supplied);
  return normalizePlanSummary(buildIs220dDiagnosticGroupPlan(groupId, {}).summary);
}

function coverageSummary(componentIds, coverage) {
  const ids = new Set(componentIds);
  const components = (Array.isArray(coverage?.components) ? coverage.components : []).filter(component => ids.has(component.id));
  return deepFreeze({
    available: Boolean(coverage?.applicable),
    total: componentIds.length,
    observed: components.filter(component => component.status === "observed").length,
    partial: components.filter(component => component.status === "partial").length,
    unavailable: components.filter(component => component.status === "unavailable").length,
    assessed: components.filter(component => ASSESSED_STATUSES.has(component?.assessment?.status)).length,
    strongDeviation: components.filter(component => component?.assessment?.status === "strong-deviation").length
  });
}

function gapLabel(state) {
  if (state === "not-authorized") return "ODOTTAA VARMENNETTUA SIGNAALIA";
  if (state === "not-in-current-wide-diagnostic") return "EI NYKYISESSÄ LAAJASSA TESTISSÄ";
  if (state === "field-rejected") return "KENTÄSSÄ HYLÄTTY";
  return String(state || "").toUpperCase();
}

function buildGroupSession(group, coverage, planSummaries) {
  const components = is220dDiagnosticComponentsForGroup(group.id);
  const baselinePlan = buildIs220dDiagnosticGroupPlan(group.id, {});
  const gaps = baselinePlan.signals
    .filter(signal => GAP_STATES.has(signal.planState))
    .map(signal => deepFreeze({
      signalKey: signal.signalKey,
      label: signal.label,
      state: signal.planState,
      stateLabel: gapLabel(signal.planState),
      evidence: signal.evidence
    }));

  return deepFreeze({
    id: group.id,
    label: group.label,
    shortLabel: group.shortLabel,
    physicalFocus: group.physicalFocus,
    componentCount: components.length,
    components: components.map(component => deepFreeze({
      id: component.id,
      label: component.label,
      diagnosticClass: component.diagnosticClass,
      pnc: component.pnc,
      oe: component.oe
    })),
    coverage: coverageSummary(group.componentIds, coverage),
    planSummary: planSummaryForGroup(group.id, planSummaries),
    gaps
  });
}

/**
 * Builds a sanitized workshop-session model. The model contains no raw ECU
 * responses and no executable command list. Execution remains delegated to the
 * existing profile-authorized wide diagnostic.
 */
export function buildIs220dGuidedDiagnosticSession(groupId = "all", {
  coverage = null,
  planSummaries = []
} = {}) {
  const normalizedId = String(groupId || "all");
  if (normalizedId === "all") {
    const groups = IS220D_DIAGNOSTIC_GROUPS.map(group => buildGroupSession(group, coverage, planSummaries));
    return deepFreeze({
      id: "all",
      label: "Koko BOM-komponenttidiagnoosi",
      shortLabel: "Kaikki alueet",
      physicalFocus: "Kaikki viisi nykyistä moottorin ja voimansiirron BOM-tarkastusaluetta yhdellä varmennetulla laajalla lukusarjalla.",
      groupCount: groups.length,
      componentCount: IS220D_COMPONENT_DIAGNOSTICS.length,
      coverage: coverageSummary(IS220D_COMPONENT_DIAGNOSTICS.map(component => component.id), coverage),
      groups
    });
  }

  const group = getIs220dDiagnosticGroup(normalizedId);
  if (!group) throw new Error(`Unknown IS220d guided diagnostic group: ${normalizedId}`);
  return buildGroupSession(group, coverage, planSummaries);
}

export function buildIs220dGuidedDiagnosticSessionHtml(session) {
  if (!session) return "";
  const safety = "Ajo käyttää samaa varmennettua laajaa read-only-lukusarjaa. Tarkastusalue rajaa tulkinnan ja fyysiset jatkotoimet, ei ECU-komentoja.";
  if (session.id === "all") {
    const coverage = session.coverage?.available
      ? `Viime ajosta dataa ${session.coverage.observed}/${session.coverage.total} komponentille.`
      : "Aiemman ajon kattavuutta ei ole vielä tällä asennuksella.";
    return `<div class="bom-guided-title"><strong>${escapeHtml(session.label)}</strong><span>${session.groupCount} aluetta · ${session.componentCount} komponenttia</span></div>
      <p>${escapeHtml(session.physicalFocus)}</p>
      <div class="bom-guided-coverage">${escapeHtml(coverage)}</div>
      <div class="bom-guided-safety">${escapeHtml(safety)}</div>`;
  }

  const summary = session.planSummary;
  const parts = [
    `${session.componentCount} komponenttia`,
    `${summary.selectedSignalCount} evidenssisignaalia`,
    `jo saatu ${summary.alreadyObserved}`
  ];
  if (summary.availableInCurrentWideDiagnostic) parts.push(`nykytesti voi kerätä ${summary.availableInCurrentWideDiagnostic}`);
  if (summary.notInCurrentWideDiagnostic) parts.push(`ei nykytestissä ${summary.notInCurrentWideDiagnostic}`);
  if (summary.notAuthorized) parts.push(`odottaa varmennusta ${summary.notAuthorized}`);
  if (summary.fieldRejected) parts.push(`kentässä hylätty ${summary.fieldRejected}`);

  const coverage = session.coverage?.available
    ? `Viime ajosta: data ${session.coverage.observed}/${session.coverage.total} · arvioitu ${session.coverage.assessed}${session.coverage.strongDeviation ? ` · vahva poikkeama ${session.coverage.strongDeviation}` : ""}.`
    : "Aiemman ajon kattavuutta ei ole vielä tällä asennuksella.";
  const gaps = session.gaps.length
    ? `<ul class="bom-guided-gaps">${session.gaps.map(gap => `<li><strong>${escapeHtml(gap.stateLabel)}</strong><span>${escapeHtml(gap.label)}</span></li>`).join("")}</ul>`
    : '<div class="bom-guided-clear">Nykyisen reseptin valituissa signaaleissa ei ole varmennusta odottavaa aukkoa.</div>';

  return `<div class="bom-guided-title"><strong>${escapeHtml(session.label)}</strong><span>${escapeHtml(parts.join(" · "))}</span></div>
    <p>${escapeHtml(session.physicalFocus)}</p>
    <div class="bom-guided-coverage">${escapeHtml(coverage)}</div>
    ${gaps}
    <div class="bom-guided-safety">${escapeHtml(safety)}</div>`;
}

let latestCoverage = null;
let latestPlanSummaries = [];

function safeStoredGroup() {
  try {
    const value = String(globalThis.localStorage?.getItem(STORAGE_KEY) || "all");
    return value === "all" || getIs220dDiagnosticGroup(value) ? value : "all";
  } catch {
    return "all";
  }
}

function storeGroup(value) {
  try { globalThis.localStorage?.setItem(STORAGE_KEY, value); } catch {}
}

function selectedGroupId() {
  const value = String(document.querySelector("#bomDiagnosticRunGroup")?.value || "all");
  return value === "all" || getIs220dDiagnosticGroup(value) ? value : "all";
}

function groupOptionsMarkup() {
  return IS220D_DIAGNOSTIC_GROUPS.map(group => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.shortLabel)}</option>`).join("");
}

function ensureStyles() {
  if (typeof document === "undefined" || document.querySelector("#bom-guided-session-styles")) return;
  const style = document.createElement("style");
  style.id = "bom-guided-session-styles";
  style.textContent = `
    .bom-guided-session { margin:10px 0 12px; padding:10px; border:1px solid var(--line); border-radius:12px; background:var(--surface-inset); }
    .bom-guided-session label { margin-top:0; }
    .bom-guided-preflight { margin-top:9px; padding-top:9px; border-top:1px solid var(--line-soft); }
    .bom-guided-title { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
    .bom-guided-title strong { color:var(--text-strong); font-size:11px; }
    .bom-guided-title span { max-width:58%; color:var(--muted); font-size:8px; line-height:1.4; text-align:right; }
    .bom-guided-preflight p { margin:7px 0 0; color:var(--text-strong); font-size:10px; line-height:1.45; }
    .bom-guided-coverage,.bom-guided-safety,.bom-guided-clear { margin-top:7px; color:var(--muted); font-size:9px; line-height:1.4; }
    .bom-guided-safety { padding-top:7px; border-top:1px solid var(--line-soft); color:var(--info); }
    .bom-guided-gaps { display:grid; gap:5px; margin:8px 0 0; padding:0; list-style:none; }
    .bom-guided-gaps li { display:flex; justify-content:space-between; gap:8px; padding:6px 7px; border:1px solid var(--warning-border); border-radius:8px; background:var(--warning-bg); }
    .bom-guided-gaps strong { color:var(--warning); font-size:7px; letter-spacing:.03em; }
    .bom-guided-gaps span { color:var(--text-strong); font-size:9px; text-align:right; }
  `;
  document.head.append(style);
}

function renderGuidedSession() {
  if (typeof document === "undefined") return null;
  const target = document.querySelector("#bomGuidedSessionPreflight");
  if (!target) return null;
  const session = buildIs220dGuidedDiagnosticSession(selectedGroupId(), {
    coverage: latestCoverage,
    planSummaries: latestPlanSummaries
  });
  target.innerHTML = buildIs220dGuidedDiagnosticSessionHtml(session);
  return session;
}

function syncDisplayFilter(groupId) {
  const filter = document.querySelector("#bomGroupFilter");
  if (!filter || filter.value === groupId) return;
  filter.value = groupId;
  filter.dispatchEvent(new Event("change", { bubbles: true }));
}

function ensurePanel() {
  if (typeof document === "undefined") return null;
  const existing = document.querySelector("#bomGuidedSession");
  if (existing) return existing;
  const runButton = document.querySelector("#bomDiagnosticRun");
  const card = runButton?.closest?.(".card");
  if (!card) return null;
  ensureStyles();

  const panel = document.createElement("div");
  panel.id = "bomGuidedSession";
  panel.className = "bom-guided-session";
  panel.innerHTML = `<label for="bomDiagnosticRunGroup">Tarkastusalue ajolle</label>
    <select id="bomDiagnosticRunGroup"><option value="all">Kaikki alueet</option>${groupOptionsMarkup()}</select>
    <div id="bomGuidedSessionPreflight" class="bom-guided-preflight"></div>`;
  const engineStateLabel = card.querySelector('label[for="bomDiagnosticEngineState"]');
  card.insertBefore(panel, engineStateLabel || card.firstChild);

  const selector = panel.querySelector("#bomDiagnosticRunGroup");
  selector.value = safeStoredGroup();
  selector.addEventListener("change", () => {
    const groupId = selectedGroupId();
    storeGroup(groupId);
    syncDisplayFilter(groupId);
    renderGuidedSession();
  });

  const displayFilter = document.querySelector("#bomGroupFilter");
  displayFilter?.addEventListener("change", () => {
    const value = String(displayFilter.value || "all");
    if (!(value === "all" || getIs220dDiagnosticGroup(value))) return;
    if (selector.value !== value) selector.value = value;
    storeGroup(value);
    renderGuidedSession();
  });

  runButton.addEventListener("click", () => {
    const groupId = selectedGroupId();
    syncDisplayFilter(groupId);
  }, true);

  syncDisplayFilter(selector.value);
  renderGuidedSession();
  return panel;
}

export function publishIs220dGuidedDiagnosticSession(coverage, meta = {}) {
  if (coverage?.applicable) latestCoverage = coverage;
  latestPlanSummaries = Array.isArray(meta?.diagnosticGroupPlans) ? meta.diagnosticGroupPlans : [];
  ensurePanel();
  return typeof document === "undefined"
    ? buildIs220dGuidedDiagnosticSession("all", { coverage: latestCoverage, planSummaries: latestPlanSummaries })
    : renderGuidedSession();
}

ensurePanel();
