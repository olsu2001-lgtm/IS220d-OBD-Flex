import { IS220D_COMPONENT_DIAGNOSTICS } from "./is220d-component-diagnostics.js";
import { getIs220dDiagnosticSignal } from "./is220d-diagnostic-signals.js";

const DPNR_COMPONENT_ID = "engine.dpnr_differential_pressure_sensor";
const EVIDENCE_SCORE = Object.freeze({
  "vehicle-verified": 30,
  "techstream-derived": 20,
  "research-candidate": 10
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function eligibleSignal(signalKey, signalIndex) {
  const definition = getIs220dDiagnosticSignal(signalKey);
  if (!definition || definition.productionAuthorized !== true) return null;
  if (!Array.isArray(definition.metricIds) || definition.metricIds.length === 0) return null;
  return {
    signalIndex,
    key: definition.key,
    label: definition.label,
    commands: [...definition.commands],
    metricIds: [...definition.metricIds],
    expectedResponsePrefix: definition.expectedResponsePrefix || "",
    decoder: definition.decoder || "",
    unit: definition.unit || "",
    evidence: definition.evidence,
    authorization: definition.authorization,
    collectedByWideDiagnostic: definition.collectedByWideDiagnostic === true,
    operatingStates: [...(definition.operatingStates || [])]
  };
}

function signalPriority(signal) {
  return (EVIDENCE_SCORE[signal.evidence] || 0) +
    (signal.collectedByWideDiagnostic ? 3 : 0) +
    (signal.authorization === "vehicle-profile" ? 2 : 0);
}

function resolveGroup(signalKeys, groupIndex) {
  const eligible = signalKeys
    .map((signalKey, signalIndex) => eligibleSignal(signalKey, signalIndex))
    .filter(Boolean)
    .sort((a, b) => signalPriority(b) - signalPriority(a) || a.signalIndex - b.signalIndex);
  const selected = eligible[0] || null;
  return {
    groupIndex,
    signalKeys: [...signalKeys],
    selected,
    priority: selected ? signalPriority(selected) : -1,
    reason: selected
      ? `${selected.key} resolves to existing Flex metric ${selected.metricIds.join(", ")}`
      : "No production-authorized signal in this evidence group has an existing Flex metric binding"
  };
}

export function buildIs220dSelectiveDiagnosticPlan(componentId) {
  const definition = IS220D_COMPONENT_DIAGNOSTICS.find(item => item.id === String(componentId || ""));
  if (!definition) return null;

  const requiredGroups = Math.max(1, Number(definition.minimumGroups || 1));
  const groups = (definition.signalGroups || []).map(resolveGroup);
  const availableGroups = groups.filter(group => group.selected);
  const rankedGroups = [...availableGroups].sort((a, b) => b.priority - a.priority || a.groupIndex - b.groupIndex);
  const chosenGroups = rankedGroups.slice(0, requiredGroups);
  const chosenIndexes = new Set(chosenGroups.map(group => group.groupIndex));
  const selectedSignals = chosenGroups.map(group => group.selected);
  const runnable = chosenGroups.length >= requiredGroups;

  const plan = {
    schemaVersion: 1,
    componentId: definition.id,
    label: definition.label,
    diagnosticClass: definition.diagnosticClass,
    requiredGroups,
    availableGroups: availableGroups.length,
    runnable,
    dedicatedRunner: definition.id === DPNR_COMPONENT_ID ? "dpnr-guided-217e" : "",
    selectionPolicy: "minimum-evidence-groups / production-authorized named signals / existing metric IDs",
    selectedSignals: runnable ? selectedSignals : [],
    signalKeys: runnable ? selectedSignals.map(signal => signal.key) : [],
    metricIds: runnable ? unique(selectedSignals.flatMap(signal => signal.metricIds)) : [],
    commands: runnable ? unique(selectedSignals.flatMap(signal => signal.commands)) : [],
    operatingStates: runnable ? unique(selectedSignals.flatMap(signal => signal.operatingStates)) : [],
    groups: groups.map(group => ({
      groupIndex: group.groupIndex,
      signalKeys: group.signalKeys,
      selectedSignalKey: chosenIndexes.has(group.groupIndex) ? group.selected?.key || "" : "",
      availableSignalKey: group.selected?.key || "",
      selected: chosenIndexes.has(group.groupIndex),
      reason: group.reason
    })),
    reason: runnable
      ? `Selected ${chosenGroups.length}/${requiredGroups} required evidence groups using only production-authorized named signals bound to existing Flex metrics.`
      : `Only ${availableGroups.length}/${requiredGroups} required evidence groups have production-authorized named signals bound to existing Flex metrics.`
  };

  return deepFreeze(plan);
}

export function buildAllIs220dSelectiveDiagnosticPlans() {
  return deepFreeze(IS220D_COMPONENT_DIAGNOSTICS.map(item => buildIs220dSelectiveDiagnosticPlan(item.id)));
}
