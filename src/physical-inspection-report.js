import { buildIs220dPhysicalInspectionChecklist } from "./is220d-physical-inspection.js";
import { buildPhysicalInspectionWorkQueue, summarizePhysicalInspectionProgress } from "./physical-inspection-progress.js";

export const PHYSICAL_INSPECTION_REPORT_SCHEMA_VERSION = 1;

function runtimeById(coverage) {
  return new Map((Array.isArray(coverage?.components) ? coverage.components : []).map(component => [component.id, component]));
}

function statusCounts(items, runtime) {
  const counts = { observed: 0, partial: 0, unavailable: 0, notTested: 0 };
  for (const item of items) {
    const status = runtime.get(item.id)?.status || "not-tested";
    if (status === "observed") counts.observed += 1;
    else if (status === "partial") counts.partial += 1;
    else if (status === "unavailable") counts.unavailable += 1;
    else counts.notTested += 1;
  }
  return counts;
}

export function buildPhysicalInspectionReportModel(coverage, progress = { items: {} }, meta = {}) {
  const checklist = buildIs220dPhysicalInspectionChecklist(coverage);
  if (!checklist.applicable) return Object.freeze({ applicable: false });
  const runtime = runtimeById(coverage);
  const queue = buildPhysicalInspectionWorkQueue(checklist.groups, progress);
  const groups = checklist.groups.map(group => {
    const completion = summarizePhysicalInspectionProgress(group, progress);
    const counts = statusCounts(group.items, runtime);
    return Object.freeze({
      id: group.id,
      label: group.label,
      shortLabel: group.shortLabel,
      physicalFocus: group.physicalFocus,
      completion,
      coverage: Object.freeze(counts),
      items: Object.freeze(group.items.map(item => {
        const component = runtime.get(item.id) || {};
        return Object.freeze({
          id: item.id,
          label: item.label,
          pnc: item.pnc,
          oe: item.oe,
          diagnosticClass: item.diagnosticClass,
          coverageStatus: component.status || "not-tested",
          assessmentStatus: component?.assessment?.status || "not-evaluated",
          physicalChecked: progress?.items?.[item.id]?.checked === true,
          priorityLabel: item.priorityLabel,
          instruction: item.instruction
        });
      }))
    });
  });

  return Object.freeze({
    applicable: true,
    schemaVersion: PHYSICAL_INSPECTION_REPORT_SCHEMA_VERSION,
    sourceWorkbook: checklist.sourceWorkbook,
    sourceWorkbookId: checklist.sourceWorkbookId,
    sourceReviewedAt: checklist.reviewedAt,
    buildSha: String(meta?.buildSha || ""),
    runId: String(meta?.runId || ""),
    generatedAt: Number.isFinite(Number(meta?.generatedAt)) ? Number(meta.generatedAt) : Date.now(),
    queue,
    groups: Object.freeze(groups)
  });
}

export function buildPhysicalInspectionTextReport(model) {
  if (!model?.applicable) return "";
  const lines = [
    "===== BEGIN LEXUS IS220D BOM WORKSHOP REPORT =====",
    `Raporttiskeema: ${model.schemaVersion}`,
    `BOM-lähde: ${model.sourceWorkbook}`,
    `BOM tarkistettu: ${model.sourceReviewedAt || "–"}`,
    `Build SHA: ${model.buildSha || "–"}`,
    `Ajon tunniste: ${model.runId || "–"}`,
    `Luotu: ${new Date(model.generatedAt).toISOString()}`,
    `Fyysiset tarkastukset: ${model.queue.checked}/${model.queue.total} tehty · ${model.queue.remaining} jäljellä`,
    model.queue.next
      ? `Seuraava tarkastus: ${model.queue.next.label} · ${model.queue.next.groupShortLabel} · ${model.queue.next.priorityLabel}`
      : "Seuraava tarkastus: ei avoimia kohteita",
    "",
    "Huom: raportti sisältää BOM-komponenttitilat ja fyysisen työlistan, ei raakaa OBD/CAN-liikennettä.",
    ""
  ];

  for (const group of model.groups) {
    lines.push(`## ${group.label}`);
    lines.push(`Alue: ${group.physicalFocus}`);
    lines.push(`Tarkastettu: ${group.completion.checked}/${group.completion.total}`);
    lines.push(`Data: observed ${group.coverage.observed} · partial ${group.coverage.partial} · unavailable ${group.coverage.unavailable} · not-tested ${group.coverage.notTested}`);
    for (const item of group.items) {
      lines.push(`- [${item.physicalChecked ? "x" : " "}] ${item.label} · ${item.diagnosticClass.toUpperCase()} · coverage=${item.coverageStatus} · assessment=${item.assessmentStatus}`);
      lines.push(`  PNC ${item.pnc} · OE ${item.oe.join(", ")}`);
      lines.push(`  ${item.priorityLabel}: ${item.instruction}`);
    }
    lines.push("");
  }

  lines.push("===== END LEXUS IS220D BOM WORKSHOP REPORT =====");
  return lines.join("\n");
}
