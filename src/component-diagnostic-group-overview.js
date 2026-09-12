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

export function buildIs220dDiagnosticGroupOverview(coverage) {
  const components = Array.isArray(coverage?.components) ? coverage.components : [];
  if (!coverage?.applicable) {
    return Object.freeze({ applicable: false, totalComponents: 0, groups: Object.freeze([]) });
  }

  const byId = new Map(components.map(component => [component.id, component]));
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

export function buildIs220dDiagnosticGroupOverviewHtml(model) {
  if (!model?.applicable) return '<div class="bom-group-overview-empty">Ei IS220d-komponenttidiagnoosia.</div>';
  return model.groups.map(group => {
    const attention = group.attentionComponents.length
      ? `<div class="bom-group-attention">Huomio: ${group.attentionComponents.map(item => escapeHtml(item.label)).join(", ")}</div>`
      : '<div class="bom-group-attention quiet">Ei tämän ajon perusteella erikseen nostettavia komponentteja.</div>';
    return `<button class="bom-group-overview-card" type="button" data-bom-group-overview="${escapeHtml(group.id)}">
      <span class="bom-group-overview-head"><strong>${escapeHtml(group.shortLabel)}</strong><span>${escapeHtml(groupStatusText(group))}</span></span>
      <span class="bom-group-overview-focus">${escapeHtml(group.physicalFocus)}</span>
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

export function publishIs220dDiagnosticGroupOverview(coverage) {
  const model = buildIs220dDiagnosticGroupOverview(coverage);
  const panel = ensurePanel();
  if (!panel || !model.applicable) return model;
  const grid = panel.querySelector("#bomGroupOverviewGrid");
  const meta = panel.querySelector("#bomGroupOverviewMeta");
  if (grid) grid.innerHTML = buildIs220dDiagnosticGroupOverviewHtml(model);
  if (meta) meta.textContent = `${model.groups.length} aluetta · ${model.totalComponents} komponenttia · data ${model.observedComponents}/${model.totalComponents} · arvioitu ${model.assessedComponents}`;
  return model;
}

ensurePanel();
