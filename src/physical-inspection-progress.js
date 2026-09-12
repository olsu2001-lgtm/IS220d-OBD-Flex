export const PHYSICAL_INSPECTION_PROGRESS_SCHEMA_VERSION = 1;
export const PHYSICAL_INSPECTION_PROGRESS_STORAGE_KEY = "lexusIs220dPhysicalInspectionProgressV1";

function emptyProgress() {
  return { schemaVersion: PHYSICAL_INSPECTION_PROGRESS_SCHEMA_VERSION, items: {} };
}

function sanitize(parsed) {
  if (!parsed || parsed.schemaVersion !== PHYSICAL_INSPECTION_PROGRESS_SCHEMA_VERSION || typeof parsed.items !== "object" || Array.isArray(parsed.items)) {
    return emptyProgress();
  }
  const items = {};
  for (const [id, value] of Object.entries(parsed.items)) {
    if (!/^engine\.[a-z0-9_]+$/.test(id) || !value?.checked) continue;
    items[id] = {
      checked: true,
      updatedAt: Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : 0
    };
  }
  return { schemaVersion: PHYSICAL_INSPECTION_PROGRESS_SCHEMA_VERSION, items };
}

export function readPhysicalInspectionProgress(storage = globalThis.localStorage) {
  try {
    return sanitize(JSON.parse(storage?.getItem(PHYSICAL_INSPECTION_PROGRESS_STORAGE_KEY) || "null"));
  } catch {
    return emptyProgress();
  }
}

export function writePhysicalInspectionChecked(componentId, checked, {
  storage = globalThis.localStorage,
  now = Date.now()
} = {}) {
  const id = String(componentId || "");
  if (!/^engine\.[a-z0-9_]+$/.test(id)) throw new Error(`Invalid physical inspection component id: ${id}`);
  const progress = readPhysicalInspectionProgress(storage);
  if (checked) progress.items[id] = { checked: true, updatedAt: Number(now) || 0 };
  else delete progress.items[id];
  try { storage?.setItem(PHYSICAL_INSPECTION_PROGRESS_STORAGE_KEY, JSON.stringify(progress)); } catch {}
  return progress;
}

export function clearPhysicalInspectionProgress(storage = globalThis.localStorage) {
  try { storage?.removeItem(PHYSICAL_INSPECTION_PROGRESS_STORAGE_KEY); } catch {}
  return emptyProgress();
}

export function summarizePhysicalInspectionProgress(group, progress = emptyProgress()) {
  const ids = Array.isArray(group?.items) ? group.items.map(item => item.id) : [];
  const checkedIds = ids.filter(id => progress?.items?.[id]?.checked === true);
  return Object.freeze({
    total: ids.length,
    checked: checkedIds.length,
    complete: ids.length > 0 && checkedIds.length === ids.length,
    checkedIds: Object.freeze(checkedIds)
  });
}
