import { IS220D_COMPONENT_DIAGNOSTICS } from "./is220d-component-diagnostics.js";
import { getIs220dDiagnosticGroup } from "./is220d-diagnostic-groups.js";
import { getIs220dDiagnosticSignal } from "./is220d-diagnostic-signals.js";

export const IS220D_DIAGNOSTIC_PLAN_SCHEMA_VERSION = 1;

const ENGINE_REQUEST_HEADERS = new Set(["", "7DF", "7E0"]);
const normalizeHex = value => String(value || "").replace(/\s+/g, "").toUpperCase();

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function relevantResults(run) {
  return Array.isArray(run?.results)
    ? run.results.filter(result => ENGINE_REQUEST_HEADERS.has(normalizeHex(result?.requestHeader)))
    : [];
}

function signalObservation(signal, results) {
  const commands = new Set(signal.commands.map(normalizeHex));
  const matches = results.filter(result => commands.has(normalizeHex(result?.command)));
  return {
    attempted: matches.length > 0,
    observed: matches.some(result => result?.validResponse === true),
    attempts: matches.length
  };
}

function candidateRank(signal) {
  if (!signal) return 99;
  if (signal.authorization === "field-rejected") return 90;
  if (signal.productionAuthorized && signal.collectedByWideDiagnostic && signal.evidence === "vehicle-verified") return 0;
  if (signal.productionAuthorized && signal.collectedByWideDiagnostic) return 1;
  if (signal.productionAuthorized && signal.evidence === "vehicle-verified") return 2;
  if (signal.productionAuthorized) return 3;
  if (signal.evidence === "techstream-derived") return 20;
  return 30;
}

function planState(signal, observation) {
  if (observation.observed) return "already-observed";
  if (signal.authorization === "field-rejected") return "field-rejected";
  if (!signal.productionAuthorized) return "not-authorized";
  if (!signal.collectedByWideDiagnostic) return "not-in-current-wide-diagnostic";
  return "available-in-current-wide-diagnostic";
}

function componentRecipe(component, results) {
  const groupPlans = component.signalGroups.map((signalKeys, index) => {
    const candidates = signalKeys.map(signalKey => {
      const signal = getIs220dDiagnosticSignal(signalKey);
      if (!signal) throw new Error(`Unknown diagnostic signal ${signalKey} in ${component.id}`);
      const observation = signalObservation(signal, results);
      return {
        signalKey,
        label: signal.label,
        evidence: signal.evidence,
        authorization: signal.authorization,
        productionAuthorized: signal.productionAuthorized,
        collectedByWideDiagnostic: signal.collectedByWideDiagnostic,
        commands: [...signal.commands],
        ...observation,
        planState: planState(signal, observation)
      };
    });
    const observed = candidates.find(candidate => candidate.observed);
    const selected = observed || [...candidates].sort((a, b) => {
      const rank = candidateRank(getIs220dDiagnosticSignal(a.signalKey)) - candidateRank(getIs220dDiagnosticSignal(b.signalKey));
      return rank || a.signalKey.localeCompare(b.signalKey);
    })[0];
    return deepFreeze({
      groupIndex: index,
      satisfied: Boolean(observed),
      selectedSignalKey: selected?.signalKey || null,
      selectedState: selected?.planState || "missing-definition",
      candidates
    });
  });

  const satisfiedGroups = groupPlans.filter(group => group.satisfied).length;
  const requiredGroups = Math.max(1, Number(component.minimumGroups || 1));
  return deepFreeze({
    componentId: component.id,
    label: component.label,
    diagnosticClass: component.diagnosticClass,
    requiredGroups,
    satisfiedGroups,
    coverageSatisfied: satisfiedGroups >= requiredGroups,
    groupPlans
  });
}

/**
 * Creates a transport-free evidence plan for one physical diagnostic group.
 * Commands are retained as trace metadata only. This function never creates a
 * transport call and cannot expand the vehicle profile allowlist.
 */
export function buildIs220dDiagnosticGroupPlan(groupId, run = {}) {
  const group = getIs220dDiagnosticGroup(groupId);
  if (!group) throw new Error(`Unknown IS220d diagnostic group: ${groupId}`);
  const ids = new Set(group.componentIds);
  const results = relevantResults(run);
  const components = IS220D_COMPONENT_DIAGNOSTICS.filter(component => ids.has(component.id));
  const componentPlans = components.map(component => componentRecipe(component, results));

  const selectedBySignal = new Map();
  for (const component of componentPlans) {
    for (const groupPlan of component.groupPlans) {
      if (!groupPlan.selectedSignalKey) continue;
      const existing = selectedBySignal.get(groupPlan.selectedSignalKey) || {
        signalKey: groupPlan.selectedSignalKey,
        usedBy: [],
        groupUses: 0
      };
      if (!existing.usedBy.includes(component.componentId)) existing.usedBy.push(component.componentId);
      existing.groupUses += 1;
      selectedBySignal.set(groupPlan.selectedSignalKey, existing);
    }
  }

  const signals = [...selectedBySignal.values()].map(entry => {
    const signal = getIs220dDiagnosticSignal(entry.signalKey);
    const observation = signalObservation(signal, results);
    return deepFreeze({
      ...entry,
      label: signal.label,
      evidence: signal.evidence,
      authorization: signal.authorization,
      productionAuthorized: signal.productionAuthorized,
      collectedByWideDiagnostic: signal.collectedByWideDiagnostic,
      commands: [...signal.commands],
      ...observation,
      planState: planState(signal, observation)
    });
  });

  const stateCount = state => signals.filter(signal => signal.planState === state).length;
  return deepFreeze({
    schemaVersion: IS220D_DIAGNOSTIC_PLAN_SCHEMA_VERSION,
    vehicleKey: "is220d",
    group: {
      id: group.id,
      label: group.label,
      shortLabel: group.shortLabel,
      physicalFocus: group.physicalFocus
    },
    transportBoundary: "metadata-only; execution remains in the existing profile-authorized wide diagnostic",
    components: componentPlans,
    signals,
    summary: {
      componentCount: componentPlans.length,
      coveredComponents: componentPlans.filter(component => component.coverageSatisfied).length,
      selectedSignalCount: signals.length,
      alreadyObserved: stateCount("already-observed"),
      availableInCurrentWideDiagnostic: stateCount("available-in-current-wide-diagnostic"),
      notInCurrentWideDiagnostic: stateCount("not-in-current-wide-diagnostic"),
      notAuthorized: stateCount("not-authorized"),
      fieldRejected: stateCount("field-rejected")
    }
  });
}
