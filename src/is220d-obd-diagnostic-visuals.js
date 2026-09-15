import { getIs220dRepairManualVisuals } from "./is220d-repair-manual-visuals.js";
import { IS220D_REPAIR_MANUAL_VISUAL_CANDIDATES } from "./is220d-repair-manual-visual-candidates.js";

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function getIs220dObdDiagnosticVisuals(componentId) {
  const packaged = getIs220dRepairManualVisuals(componentId);
  if (packaged.length) return packaged;
  return IS220D_REPAIR_MANUAL_VISUAL_CANDIDATES
    .filter(candidate => candidate.componentId === componentId)
    .map(candidate => ({
      id: candidate.id,
      componentIds: [candidate.componentId],
      sourceRows: [candidate.sourceRow],
      assetPath: candidate.targetAssetPath,
      sourceImagePath: candidate.sourceImagePath,
      manualReference: candidate.manualReference,
      section: candidate.section,
      title: candidate.title,
      caption: candidate.caption,
      sha256: candidate.sourceImageSha256,
      sourceHtmlSha256: candidate.sourceHtmlSha256,
      figureReviewed: true,
      reviewedAt: candidate.reviewedAt,
      status: "available"
    }));
}

export function buildIs220dObdDiagnosticVisualHtml(componentId) {
  const visuals = getIs220dObdDiagnosticVisuals(componentId);
  if (!visuals.length) {
    return `<div class="obd-diagnostic-visual-missing"><small>Korjaamo-opaskuvaa ei ole vielä varmennettu tälle kohteelle.</small></div>`;
  }
  return visuals.map(visual => `<figure class="obd-diagnostic-visual" style="margin:12px 0">
    <img src="${escapeHtml(visual.assetPath)}" alt="${escapeHtml(visual.title)}" loading="lazy" style="display:block;max-width:100%;height:auto;background:white;border-radius:8px">
    <figcaption><strong>${escapeHtml(visual.title)}</strong><p>${escapeHtml(visual.caption)}</p><small>Lexus IS250/220D · RM0150 · ${escapeHtml(visual.section)} · ${escapeHtml(visual.sourceImagePath.split("/").at(-1))}</small></figcaption>
  </figure>`).join("");
}
