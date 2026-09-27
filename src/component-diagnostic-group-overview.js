import { IS220D_DIAGNOSTIC_GROUPS } from "./is220d-diagnostic-groups.js";
import { buildIs220dPhysicalInspectionChecklist } from "./is220d-physical-inspection.js";
import {
  readPhysicalInspectionProgress,
  summarizePhysicalInspectionProgress,
  writePhysicalInspectionChecked
} from "./physical-inspection-progress.js";

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

  const physicalChecklist = buildIs220dPhysicalInspectionChecklist(coverage);
  const inspectionByGroup = new Map(physicalChecklist.groups.map(group => [group.id, group]));
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
      physicalInspection: inspectionByGroup.get(group.id) || null,
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

function buildPhysicalInspectionHtml(group, progress) {
  const inspection = group.physicalInspection;
  if (!inspection?.items?.length) return "";
  const completion = summarizePhysicalInspectionProgress(inspection, progress);
  const summaryParts = [`${inspection.itemCount} kohdetta`, `tarkastettu ${completion.checked}/${completion.total}`];
  if (inspection.priorityCount) summaryParts.push(`ensin ${inspection.priorityCount}`);
  if (inspection.gapCount) summaryParts.push(`vajaa evidenssi ${inspection.gapCount}`);
  const items = inspection.items.map(item => {
    const checked = progress?.items?.[item.id]?.checked === true;
    return `<li class="bom-physical-item ${escapeHtml(item.priorityKey)}${checked ? " checked" : ""}" data-bom-inspection-item="${escapeHtml(item.id)}">
      <label class="bom-physical-check"><input type="checkbox" data-bom-inspection-check="${escapeHtml(item.id)}"${checked ? " checked" : ""}><span>Tarkastettu</span></label>
      <div class="bom-physical-item-head"><strong>${escapeHtml(item.priorityLabel)}</strong><span>${escapeHtml(item.label)}</span></div>
      <p>${escapeHtml(item.instruction)}</p>
      <div class="bom-physical-symptom">Oireyhteys: ${escapeHtml(item.symptom)}</div>
      <div class="bom-physical-part">PNC ${escapeHtml(item.pnc)} · OE ${escapeHtml(item.oe.join(", "))}</div>
    </li>`;
  }).join("");
  return `<details class="bom-physical-details">
    <summary>Fyysiset tarkastuskohteet · <span data-bom-inspection-summary="${escapeHtml(group.id)}">${escapeHtml(summaryParts.join(" · "))}</span></summary>
    <ol class="bom-physical-list">${items}</ol>
  </details>`;
}

export function buildIs220dDiagnosticGroupOverviewHtml(model, progress = { items: {} }) {
  if (!model?.applicable) return '<div class="bom-group-overview-empty">Ei IS220d-komponenttidiagnoosia.</div>';
  return model.groups.map(group => {
    const attention = group.attentionComponents.length
      ? `<div class="bom-group-attention">Huomio: ${group.attentionComponents.map(item => escapeHtml(item.label)).join(", ")}</div>`
      : '<div class="bom-group-attention quiet">Ei tämän ajon perusteella erikseen nostettavia komponentteja.</div>';
    const planText = groupPlanText(group);
    const plan = planText ? `<span class="bom-group-plan">Evidenssi: ${escapeHtml(planText)}</span>` : "";
    const physicalInspection = buildPhysicalInspectionHtml(group, progress);
    return `<article class="bom-group-overview-card" data-bom-group-card="${escapeHtml(group.id)}">
      <div class="bom-group-overview-head"><strong>${escapeHtml(group.shortLabel)}</strong><span>${escapeHtml(groupStatusText(group))}</span></div>
      <span class="bom-group-overview-focus">${escapeHtml(group.physicalFocus)}</span>
      ${plan}
      ${attention}
      ${physicalInspection}
      <button class="secondary compact bom-group-open" type="button" data-bom-open-group="${escapeHtml(group.id)}">Näytä ryhmän komponentit</button>
    </article>`;
  }).join("");
}

function ensureStyles() {
  if (typeof document === "undefined" || document.querySelector("#bom-group-overview-styles")) return;
  const style = document.createElement("style");
  style.id = "bom-group-overview-styles";
  style.textContent = `
    .bom-group-overview { margin-bottom:14px; overflow:hidden; }
    .bom-group-overview > summary { display:flex; min-height:52px; align-items:center; justify-content:space-between; gap:10px; padding:12px 14px; cursor:pointer; list-style:none; }
    .bom-group-overview > summary::-webkit-details-marker { display:none; }
    .bom-group-overview > summary::after { content:"⌄"; margin-left:8px; color:var(--muted); font-size:18px; }
    .bom-group-overview[open] > summary::after { transform:rotate(180deg); }
    .bom-group-overview-title { min-width:0; display:grid; gap:2px; }
    .bom-group-overview-title strong { font-size:14px; }
    .bom-group-overview-title span { color:var(--muted); font-size:9px; }
    .bom-group-overview-grid { display:grid; gap:8px; padding:0 12px 12px; }
    .bom-group-overview-card { width:100%; padding:11px 12px; border:1px solid var(--line); border-radius:12px; background:var(--surface); color:var(--text); text-align:left; }
    .bom-group-overview-head { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
    .bom-group-overview-head strong { color:var(--text-strong); font-size:12px; }
    .bom-group-overview-head span { color:var(--muted); font-size:9px; text-align:right; }
    .bom-group-overview-focus { display:block; margin-top:6px; color:var(--muted); font-size:10px; line-height:1.4; }
    .bom-group-plan { display:block; margin-top:7px; padding-top:7px; border-top:1px solid var(--line); color:var(--info); font-size:9px; line-height:1.4; }
    .bom-group-attention { margin-top:7px; color:var(--warning-text); font-size:9px; line-height:1.35; }
    .bom-group-attention.quiet { color:var(--success); }
    .bom-physical-details { margin-top:9px; padding-top:8px; border-top:1px solid var(--line); }
    .bom-physical-details summary { color:var(--text-strong); cursor:pointer; font-size:10px; font-weight:800; }
    .bom-physical-list { display:grid; gap:7px; margin:9px 0 0; padding:0; list-style:none; }
    .bom-physical-item { position:relative; padding:9px; border:1px solid var(--line-soft); border-radius:10px; background:var(--surface-inset); }
    .bom-physical-item.checked { opacity:.62; }
    .bom-physical-item.deviation { border-color:var(--danger-border); }
    .bom-physical-item.gap { border-color:var(--warning-border); }
    .bom-physical-check { display:flex; justify-content:flex-end; align-items:center; gap:5px; margin-bottom:6px; color:var(--muted); font-size:9px; }
    .bom-physical-check input { width:17px; height:17px; margin:0; }
    .bom-physical-item-head { display:flex; flex-direction:column; gap:3px; }
    .bom-physical-item-head strong { color:var(--info); font-size:8px; letter-spacing:.04em; }
    .bom-physical-item.deviation .bom-physical-item-head strong { color:var(--danger-text); }
    .bom-physical-item.gap .bom-physical-item-head strong { color:var(--warning); }
    .bom-physical-item-head span { color:var(--text-strong); font-size:11px; font-weight:800; }
    .bom-physical-item p { margin:6px 0 0; color:var(--text-strong); font-size:10px; line-height:1.45; }
    .bom-physical-symptom { margin-top:6px; color:var(--muted); font-size:9px; line-height:1.4; }
    .bom-physical-part { margin-top:5px; color:var(--muted); font:8px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
    .bom-group-open { margin-top:9px; width:100%; }
    .bom-group-overview-empty { padding:12px; color:var(--muted); font-size:11px; }
  `;
  document.head.append(style);
}

function updateInspectionProgressLabel(card) {
  const groupId = card?.getAttribute?.("data-bom-group-card");
  if (!groupId) return;
  const checks = [...card.querySelectorAll("[data-bom-inspection-check]")];
  const checked = checks.filter(input => input.checked).length;
  const label = card.querySelector(`[data-bom-inspection-summary="${groupId}"]`);
  if (!label) return;
  const inspectionItems = checks.length;
  const current = label.textContent.split(" · ").filter(part => !part.startsWith("tarkastettu "));
  current.splice(1, 0, `tarkastettu ${checked}/${inspectionItems}`);
  label.textContent = current.join(" · ");
}

function ensurePanel() {
  if (typeof document === "undefined") return null;
  let panel = document.querySelector("#bomGroupOverview");
  if (panel) return panel;
  const page = document.querySelector("#page-component-diagnostics");
  if (!page) return null;
  ensureStyles();
  panel = document.createElement("details");
  panel.id = "bomGroupOverview";
  panel.className = "bom-group-overview card";
  panel.innerHTML = `<summary><span class="bom-group-overview-title"><strong>Fyysinen tarkastusjärjestys</strong><span id="bomGroupOverviewMeta">5 aluetta · 23 komponenttia</span></span></summary><div id="bomGroupOverviewGrid" class="bom-group-overview-grid"><div class="bom-group-overview-empty">Aja OBD Health Check nähdäksesi aluekohtaisen kattavuuden.</div></div>`;
  const summary = document.querySelector("#bomDiagnosticSummary");
  if (summary?.parentNode) summary.parentNode.insertBefore(panel, summary.nextSibling);
  else page.append(panel);
  panel.addEventListener("click", event => {
    const button = event.target?.closest?.("[data-bom-open-group]");
    if (!button) return;
    const groupId = button.getAttribute("data-bom-open-group");
    const filter = document.querySelector("#bomGroupFilter");
    if (filter && [...filter.options].some(option => option.value === groupId)) {
      filter.value = groupId;
      filter.dispatchEvent(new Event("change", { bubbles: true }));
      document.querySelector("#bomComponentList")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }
  });
  panel.addEventListener("change", event => {
    const input = event.target?.closest?.("[data-bom-inspection-check]");
    if (!input) return;
    const componentId = input.getAttribute("data-bom-inspection-check");
    writePhysicalInspectionChecked(componentId, input.checked);
    input.closest("[data-bom-inspection-item]")?.classList.toggle("checked", input.checked);
    updateInspectionProgressLabel(input.closest("[data-bom-group-card]"));
  });
  return panel;
}

export function publishIs220dDiagnosticGroupOverview(coverage, meta = {}) {
  const model = buildIs220dDiagnosticGroupOverview(coverage, meta?.diagnosticGroupPlans);
  const panel = ensurePanel();
  if (!panel || !model.applicable) return model;
  const grid = panel.querySelector("#bomGroupOverviewGrid");
  const metaLabel = panel.querySelector("#bomGroupOverviewMeta");
  if (grid) grid.innerHTML = buildIs220dDiagnosticGroupOverviewHtml(model, readPhysicalInspectionProgress());
  if (metaLabel) metaLabel.textContent = `${model.groups.length} aluetta · ${model.totalComponents} komponenttia · data ${model.observedComponents}/${model.totalComponents} · arvioitu ${model.assessedComponents}`;
  return model;
}

ensurePanel();
