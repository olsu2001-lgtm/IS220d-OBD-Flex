import { getIs220dRepairManualVisuals } from "./is220d-repair-manual-visuals.js";

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function getIs220dObdDiagnosticVisuals(componentId) {
  return getIs220dRepairManualVisuals(componentId);
}

export function buildIs220dObdDiagnosticVisualHtml(componentId) {
  const visuals = getIs220dObdDiagnosticVisuals(componentId);
  if (!visuals.length) {
    return `<div class="obd-diagnostic-visual-missing"><small>Korjaamo-opaskuvaa ei ole vielä pakattu tälle kohteelle.</small></div>`;
  }
  return visuals.map(visual => `<figure class="obd-diagnostic-visual" style="margin:12px 0">
    <img src="${escapeHtml(visual.assetPath)}" alt="${escapeHtml(visual.title)}" loading="lazy" style="display:block;max-width:100%;height:auto;background:white;border-radius:8px">
    <figcaption><strong>${escapeHtml(visual.title)}</strong><p>${escapeHtml(visual.caption)}</p><small>Lexus IS250/220D · RM0150 · ${escapeHtml(visual.section)} · ${escapeHtml(visual.sourceImagePath.split("/").at(-1))}</small></figcaption>
  </figure>`).join("");
}
