import { IS220D_DIAGNOSTIC_GROUPS } from "./is220d-diagnostic-groups.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const ASSESSED_STATUSES = new Set(["normal-pattern", "deviation", "strong-deviation", "inconclusive"]);
const ATTENTION_ASSESSMENTS = new Set(["deviation", "strong-deviation", "inconclusive"]);

function normalizePlanSummary(summary) {
  if (!summary || typeof summary !== "object") return null;
  const integer = key => Math.max(0, Number.parseInt(summary[key], 10) || 0);
  return Object.freeze({
    selectedSignalCount: integer("selectedSignalCount"),
    alreadyObserved: integer("alreadyObserved"),
    availableInCurrentWideDiagnostic: integer("availableInCurrentWideDiagnostic"),
    notInCurrentWideDiagnostic: integer("notInCurrentWideDiagnostic"),
    notAuthorized: integer("notAuthorized"),
    fieldRejected: integer("fieldRejected")
  });
}

export function buildIs220dDiagnosticGroupOverview(coverage, planSummaries = []) {
  const components = Array.isArray(coverage?.components) ? coverage.components : [];
  if (!coverage?.applicable) {
    return Object.freeze({ applicable: false, totalComponents: 0, groups: Object.freeze([]) });
  }

  const byId = new Map(components.map(component => [component.id, component]));
  const planById = new Map((Array.isArray(planSummaries) ? planSummaries : []).map(plan => [plan?.id, normalizePlanSummary(plan?.summary)]));
  const groups = IS220D_DIAGNOSTIC_GROUPS.map(group => {
    const groupComponents = group.componentIds.map(id => byId.get(id)).filter(Boolean);
    const observed = groupComponents.filter(component => component.status === "observed").length;
    const partial = groupComponents.filter(component => component.status === "partial").length;
    const unavailable = groupComponents.filter(component => component.status === "unavailable").length;
    const assessed = groupComponents.filter(component => ASSESSED_STATUSES.has(component?.assessment?.status)).length;
    const strongDeviation = groupComponents.filter(component => component?.assessment?.status === "strong-deviation").length;
    const attention = groupComponents.filter(component =>
      component.status === "partial" ||
      component.status === "unavailable" ||
      ATTENTION_ASSESSMENTS.has(component?.assessment?.status)
    );

    return Object.freeze({
      id: group.id,
      label: group.label,
      shortLabel: group.shortLabel,
      physicalFocus: group.physicalFocus,
      componentCount: groupComponents.length,
      observed,
      partial,
      unavailable,
      notTested: Math.max(0, groupComponents.length - observed - partial - unavailable),
      assessed,
      strongDeviation,
      attentionCount: attention.length,
      planSummary: planById.get(group.id) || null,
      attentionComponents: Object.freeze(attention.map(component => Object.freeze({
        id: component.id,
        label: component.label,
        status: component.status,
        assessmentStatus: component?.assessment?.status || "not-evaluated"
      })))
    });
  });

  return Object.freeze({
    applicable: true,
    totalComponents: components.length,
    observedComponents: components.filter(component => component.status === "observed").length,
    assessedComponents: components.filter(component => ASSESSED_STATUSES.has(component?.assessment?.status)).length,
    groups: Object.freeze(groups)
  });
}

function groupStatusText(group) {
  const parts = [`data ${group.observed}/${group.componentCount}`];
  if (group.assessed) parts.push(`arvioitu ${group.assessed}`);
  if (group.strongDeviation) parts.push(`vahva poikkeama ${group.strongDeviation}`);
  if (group.partial) parts.push(`osittain ${group.partial}`);
  if (group.unavailable) parts.push(`ei vastausta ${group.unavailable}`);
  return parts.join(" · ");
}

function groupPlanText(group) {
  const plan = group.planSummary;
  if (!plan) return "";
  const parts = [`valitut signaalit ${plan.selectedSignalCount}`, `jo saatu ${plan.alreadyObserved}`];
  if (plan.availableInCurrentWideDiagnostic) parts.push(`nykytesti voi kerätä ${plan.availableInCurrentWideDiagnostic}`);
  if (plan.notInCurrentWideDiagnostic) parts.push(`ei nykytestissä ${plan.notInCurrentWideDiagnostic}`);
  if (plan.notAuthorized) parts.push(`ei tuotantolukuun valtuutettu ${plan.notAuthorized}`);
  if (plan.fieldRejected) parts.push(`kentässä hylätty ${plan.fieldRejected}`);
  return parts.join(" · ");
}

export function buildIs220dDiagnosticGroupOverviewHtml(model) {
  if (!model?.applicable) return '<div class="bom-group-overview-empty">Ei IS220d-komponenttidiagnoosia.</div>';
  return model.groups.map(group => {
    const attention = group.attentionComponents.length
      ? `<div class="bom-group-attention">Huomio: ${group.attentionComponents.map(item => escapeHtml(item.label)).join(", ")}</div>`
      : '<div class="bom-group-attention quiet">Ei tämän ajon perusteella erikseen nostettavia komponentteja.</div>';
    const planText = groupPlanText(group);
    const plan = planText ? `<span class="bom-group-plan">Evidenssi: ${escapeHtml(planText)}</span>` : "";
    return `<button class="bom-group-overview-card" type="button" data-bom-group-overview="${escapeHtml(group.id)}">
      <span class="bom-group-overview-head"><strong>${escapeHtml(group.shortLabel)}</strong><span>${escapeHtml(groupStatusText(group))}</span></span>
      <span class="bom-group-overview-focus">${escapeHtml(group.physicalFocus)}</span>
      ${plan}
      ${attention}
    </button>`;
  }).join("");
}

function ensureStyles() {
  if (typeof document === "undefined" || document.querySelector("#bom-group-overview-styles")) return;
  const style = document.createElement("style");
  style.id = "bom-group-overview-styles";
  style.textContent = `
    .bom-group-overview { margin-bottom:14px; }
    .bom-group-overview-title { display:flex; align-items:end; justify-content:space-between; gap:10px; margin-bottom:8px; }
    .bom-group-overview-title h3 { margin:0; font-size:14px; }
    .bom-group-overview-title span { color:var(--muted); font-size:9px; text-align:right; }
    .bom-group-overview-grid { display:grid; gap:8px; }
    .bom-group-overview-card { width:100%; padding:11px 12px; border:1px solid var(--line); border-radius:12px; background:var(--surface); color:var(--text); text-align:left; }
    .bom-group-overview-card:active { transform:translateY(1px); }
    .bom-group-overview-head { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
    .bom-group-overview-head strong { color:var(--text-strong); font-size:12px; }
    .bom-group-overview-head span { color:var(--muted); font-size:9px; text-align:right; }
    .bom-group-overview-focus { display:block; margin-top:6px; color:var(--muted); font-size:10px; line-height:1.4; }
    .bom-group-plan { display:block; margin-top:7px; padding-top:7px; border-top:1px solid var(--line); color:var(--info); font-size:9px; line-height:1.4; }
    .bom-group-attention { margin-top:7px; color:var(--warning-text); font-size:9px; line-height:1.35; }
    .bom-group-attention.quiet { color:var(--success); }
    .bom-group-overview-empty { padding:12px; color:var(--muted); font-size:11px; }
  `;
  document.head.append(style);
}

function ensurePanel() {
  if (typeof document === "undefined") return null;
  let panel = document.querySelector("#bomGroupOverview");
  if (panel) return panel;
  const page = document.querySelector("#page-component-diagnostics");
  if (!page) return null;
  ensureStyles();
  panel = document.createElement("section");
  panel.id = "bomGroupOverview";
  panel.className = "bom-group-overview card";
  panel.innerHTML = `<div class="bom-group-overview-title"><h3>Fyysinen tarkastusjärjestys</h3><span id="bomGroupOverviewMeta">5 aluetta · 23 komponenttia</span></div><div id="bomGroupOverviewGrid" class="bom-group-overview-grid"><div class="bom-group-overview-empty">Aja BOM-komponenttidiagnoosi nähdäksesi aluekohtaisen kattavuuden.</div></div>`;
  const summary = document.querySelector("#bomDiagnosticSummary");
  if (summary?.parentNode) summary.parentNode.insertBefore(panel, summary.nextSibling);
  else page.append(panel);
  panel.addEventListener("click", event => {
    const button = event.target?.closest?.("[data-bom-group-overview]");
    if (!button) return;
    const groupId = button.getAttribute("data-bom-group-overview");
    const filter = document.querySelector("#bomGroupFilter");
    if (filter && [...filter.options].some(option => option.value === groupId)) {
      filter.value = groupId;
      filter.dispatchEvent(new Event("change", { bubbles: true }));
      document.querySelector("#bomComponentList")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }
  });
  return panel;
}

export function publishIs220dDiagnosticGroupOverview(coverage, meta = {}) {
  const model = buildIs220dDiagnosticGroupOverview(coverage, meta?.diagnosticGroupPlans);
  const panel = ensurePanel();
  if (!panel || !model.applicable) return model;
  const grid = panel.querySelector("#bomGroupOverviewGrid");
  const metaLabel = panel.querySelector("#bomGroupOverviewMeta");
  if (grid) grid.innerHTML = buildIs220dDiagnosticGroupOverviewHtml(model);
  if (metaLabel) metaLabel.textContent = `${model.groups.length} aluetta · ${model.totalComponents} komponenttia · data ${model.observedComponents}/${model.totalComponents} · arvioitu ${model.assessedComponents}`;
  return model;
}

ensurePanel();
