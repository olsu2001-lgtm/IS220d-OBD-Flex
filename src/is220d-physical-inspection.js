import BOM_SNAPSHOT from "../data/is220d-bom-diagnostics.json" with { type: "json" };
import { IS220D_DIAGNOSTIC_GROUPS } from "./is220d-diagnostic-groups.js";

const SOURCE_BY_ID = new Map(BOM_SNAPSHOT.components.map(component => [component.id, component]));

export const PHYSICAL_INSPECTION_PRIORITY = Object.freeze({
  deviation: Object.freeze({ rank: 0, label: "TARKISTA ENSIN", reason: "Elektroninen evidenssi sisältää poikkeaman." }),
  gap: Object.freeze({ rank: 10, label: "TARKISTA SEURAAVAKSI", reason: "Elektroninen evidenssi on vajaa tai jäi ratkaisemattomaksi." }),
  untested: Object.freeze({ rank: 20, label: "PERUSTARKASTUS", reason: "Tälle kohteelle ei ole vielä riittävää diagnostiikkadataa." }),
  baseline: Object.freeze({ rank: 30, label: "VARMISTUS", reason: "Nykyinen elektroninen evidenssi ei yksin nosta kohdetta etusijalle." })
});

function priorityFor(component) {
  const assessment = String(component?.assessment?.status || "not-evaluated");
  const status = String(component?.status || "not-tested");
  if (assessment === "strong-deviation" || assessment === "deviation") return PHYSICAL_INSPECTION_PRIORITY.deviation;
  if (assessment === "inconclusive" || status === "partial" || status === "unavailable") return PHYSICAL_INSPECTION_PRIORITY.gap;
  if (status === "not-tested") return PHYSICAL_INSPECTION_PRIORITY.untested;
  return PHYSICAL_INSPECTION_PRIORITY.baseline;
}

function checklistItem(component, group, source, sourceIndex) {
  if (!source) throw new Error(`Missing reviewed BOM source for ${component.id}`);
  const priority = priorityFor(component);
  return Object.freeze({
    id: component.id,
    groupId: group.id,
    label: source.name,
    diagnosticClass: source.diagnosticClass,
    pnc: source.pnc,
    oe: Object.freeze([...(source.oe || [])]),
    symptom: source.symptom,
    instruction: source.physicalConfirmation,
    sourceConfidence: source.sourceConfidence,
    sourceStatus: source.sourceStatus,
    source: Object.freeze({ ...source.source }),
    coverageStatus: component.status || "not-tested",
    assessmentStatus: component?.assessment?.status || "not-evaluated",
    priorityKey: Object.entries(PHYSICAL_INSPECTION_PRIORITY).find(([, value]) => value === priority)?.[0] || "baseline",
    priorityRank: priority.rank,
    priorityLabel: priority.label,
    priorityReason: priority.reason,
    sourceIndex
  });
}

/**
 * Builds a transport-free physical inspection checklist from the reviewed BOM
 * snapshot. Runtime diagnostic evidence may only change ordering/labels; it
 * never changes the reviewed physical inspection instruction itself.
 */
export function buildIs220dPhysicalInspectionChecklist(coverage) {
  const components = Array.isArray(coverage?.components) ? coverage.components : [];
  if (!coverage?.applicable) return Object.freeze({ applicable: false, total: 0, groups: Object.freeze([]) });
  const runtimeById = new Map(components.map(component => [component.id, component]));

  const groups = IS220D_DIAGNOSTIC_GROUPS.map(group => {
    const items = group.componentIds.map((id, sourceIndex) => {
      const runtime = runtimeById.get(id) || { id, status: "not-tested", assessment: { status: "not-evaluated" } };
      return checklistItem(runtime, group, SOURCE_BY_ID.get(id), sourceIndex);
    }).sort((a, b) => a.priorityRank - b.priorityRank || a.sourceIndex - b.sourceIndex);

    return Object.freeze({
      id: group.id,
      label: group.label,
      shortLabel: group.shortLabel,
      physicalFocus: group.physicalFocus,
      itemCount: items.length,
      priorityCount: items.filter(item => item.priorityKey === "deviation").length,
      gapCount: items.filter(item => item.priorityKey === "gap").length,
      items: Object.freeze(items)
    });
  });

  return Object.freeze({
    applicable: true,
    sourceWorkbook: BOM_SNAPSHOT.sourceWorkbook,
    sourceWorkbookId: BOM_SNAPSHOT.sourceWorkbookId,
    reviewedAt: BOM_SNAPSHOT.reviewedAt,
    total: groups.reduce((sum, group) => sum + group.itemCount, 0),
    groups: Object.freeze(groups)
  });
}

export function getIs220dPhysicalInspectionGroup(coverage, groupId) {
  return buildIs220dPhysicalInspectionChecklist(coverage).groups.find(group => group.id === groupId) || null;
}
