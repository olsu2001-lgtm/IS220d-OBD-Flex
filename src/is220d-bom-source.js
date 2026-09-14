export const IS220D_BOM_SOURCE_SCHEMA_VERSION = 1;
export const IS220D_BOM_SOURCE_POLICY = "direct-indirect-only";
export const IS220D_BOM_ALLOWED_CLASSES = Object.freeze(["direct", "indirect"]);

const ALLOWED_CLASS_SET = new Set(IS220D_BOM_ALLOWED_CLASSES);
const FORBIDDEN_TRANSPORT_KEYS = new Set([
  "command",
  "commands",
  "request",
  "requestHeader",
  "responseHeader",
  "rawRequest",
  "pid",
  "localIdentifier",
  "allowlist",
  "transport"
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Invalid IS220d BOM diagnostics snapshot: ${message}`);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function scanForbiddenTransportKeys(value, path = "snapshot") {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbiddenTransportKeys(item, `${path}[${index}]`));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    assert(!FORBIDDEN_TRANSPORT_KEYS.has(key), `${path}.${key} is a transport/authorization field and does not belong in BOM source data`);
    scanForbiddenTransportKeys(nested, `${path}.${key}`);
  }
}

function validateSource(source, id) {
  assert(source && typeof source === "object" && !Array.isArray(source), `${id}: source is required`);
  assert(source.sheet === "Vikadiag_kohteet" || source.sheet === "BOM", `${id}: unsupported source sheet ${source.sheet}`);
  assert(Number.isInteger(source.row) && source.row > 0, `${id}: source.row must be a positive integer`);
  assert(nonEmpty(source.locator), `${id}: source.locator is required`);
}

function validateComponent(component, ids) {
  assert(component && typeof component === "object" && !Array.isArray(component), "component must be an object");
  assert(nonEmpty(component.id) && /^engine\.[a-z0-9_]+$/.test(component.id), `invalid stable component id ${component.id}`);
  assert(!ids.has(component.id), `duplicate component id ${component.id}`);
  ids.add(component.id);

  assert(ALLOWED_CLASS_SET.has(component.diagnosticClass), `${component.id}: diagnosticClass must be direct or indirect`);
  assert(nonEmpty(component.diagGroup), `${component.id}: diagGroup is required`);
  assert(nonEmpty(component.mainGroup), `${component.id}: mainGroup is required`);
  assert(nonEmpty(component.category), `${component.id}: category is required`);
  assert(nonEmpty(component.pnc), `${component.id}: PNC is required`);
  assert(Array.isArray(component.oe) && component.oe.length > 0 && component.oe.every(nonEmpty), `${component.id}: at least one OE number is required`);
  assert(nonEmpty(component.name), `${component.id}: Finnish component name is required`);
  assert(nonEmpty(component.symptom), `${component.id}: symptom is required`);
  assert(nonEmpty(component.physicalConfirmation), `${component.id}: physicalConfirmation is required`);
  assert(nonEmpty(component.obdTechstreamCheck), `${component.id}: obdTechstreamCheck is required`);
  assert(nonEmpty(component.sourceConfidence), `${component.id}: sourceConfidence is required`);
  assert(nonEmpty(component.sourceStatus), `${component.id}: sourceStatus is required`);
  validateSource(component.source, component.id);
}

export function validateIs220dBomDiagnosticSnapshot(snapshot) {
  assert(snapshot && typeof snapshot === "object" && !Array.isArray(snapshot), "root must be an object");
  assert(snapshot.schemaVersion === IS220D_BOM_SOURCE_SCHEMA_VERSION, `schemaVersion must be ${IS220D_BOM_SOURCE_SCHEMA_VERSION}`);
  assert(snapshot.vehicleKey === "is220d", "vehicleKey must be is220d");
  assert(snapshot.policy === IS220D_BOM_SOURCE_POLICY, `policy must be ${IS220D_BOM_SOURCE_POLICY}`);
  assert(nonEmpty(snapshot.sourceWorkbook), "sourceWorkbook is required");
  assert(nonEmpty(snapshot.sourceWorkbookId), "sourceWorkbookId is required");
  assert(Array.isArray(snapshot.components), "components must be an array");

  scanForbiddenTransportKeys(snapshot);

  const ids = new Set();
  for (const component of snapshot.components) validateComponent(component, ids);

  const direct = snapshot.components.filter(component => component.diagnosticClass === "direct").length;
  const indirect = snapshot.components.filter(component => component.diagnosticClass === "indirect").length;
  const vikadiag = snapshot.components.filter(component => component.source.sheet === "Vikadiag_kohteet").length;
  const bom = snapshot.components.filter(component => component.source.sheet === "BOM").length;

  return Object.freeze({
    total: snapshot.components.length,
    direct,
    indirect,
    sourceSheets: Object.freeze({ Vikadiag_kohteet: vikadiag, BOM: bom })
  });
}

export function indexIs220dBomDiagnosticSnapshot(snapshot) {
  validateIs220dBomDiagnosticSnapshot(snapshot);
  return new Map(snapshot.components.map(component => [component.id, component]));
}
