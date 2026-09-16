import {
  Elm327Client,
  PID_BY_ID,
  VEHICLE_KEYS,
  getProfileReadDataProbe,
  isProfileReadOnlyCommand,
  metricSupportsVehicle
} from "./core.js";
import { buildIs220dSelectiveDiagnosticPlan } from "./is220d-selective-diagnostic-plan.js";

export const IS220D_SELECTIVE_RUNTIME_SCHEMA_VERSION = 1;

const deepFreeze = value => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
};

const unique = values => [...new Set((values || []).filter(Boolean).map(String))];
const normalizeToyotaCommand = value => String(value || "").replace(/\s+/g, "").toUpperCase();

function runtimeError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

/**
 * Resolve executable read sources from metric IDs only.
 *
 * No Drive/catalog command text and no plan command identity is accepted here.
 * A metric must already exist in Flex and either resolve to a standard Mode 01
 * decoder or to an IS220d Toyota Read Data probe that is present in the current
 * vehicle-profile allowlist.
 */
export function resolveIs220dSelectiveMetricReadGroups(metricIds) {
  const ids = unique(metricIds);
  if (!ids.length) {
    throw runtimeError("EMPTY_METRIC_PLAN", "Selective-diagnostiikassa ei ole yhtään luettavaa Flex-mittaria.");
  }

  const groups = new Map();
  for (const metricId of ids) {
    const definition = PID_BY_ID[metricId];
    if (!definition) {
      throw runtimeError("UNKNOWN_METRIC", `Selective-diagnostiikka viittasi tuntemattomaan Flex-mittariin ${metricId}.`, { metricId });
    }
    if (!metricSupportsVehicle(definition, VEHICLE_KEYS.IS220D)) {
      throw runtimeError("WRONG_VEHICLE_METRIC", `Flex-mittari ${metricId} ei kuulu IS220d-profiiliin.`, { metricId });
    }

    let sourceType;
    let sourceKey;
    let probe = null;
    if (definition.toyotaCommand) {
      const command = normalizeToyotaCommand(definition.toyotaCommand);
      probe = getProfileReadDataProbe(command, VEHICLE_KEYS.IS220D);
      if (!probe || !isProfileReadOnlyCommand(command, VEHICLE_KEYS.IS220D)) {
        throw runtimeError("TOYOTA_READ_NOT_ALLOWED", `IS220d-profiilin sallintalista esti mittarin ${metricId}.`, { metricId });
      }
      if (!definition.toyotaValueKey) {
        throw runtimeError("MISSING_TOYOTA_VALUE", `Toyota-mittarilta ${metricId} puuttuu varmennettu arvokenttä.`, { metricId });
      }
      sourceType = "toyota-read-data";
      sourceKey = `toyota:${command}`;
    } else if (Number.isInteger(definition.pid) && typeof definition.decode === "function") {
      sourceType = "mode01";
      sourceKey = `mode01:${definition.pid.toString(16).padStart(2, "0").toUpperCase()}`;
    } else {
      throw runtimeError("NON_EXECUTABLE_METRIC", `Flex-mittarilla ${metricId} ei ole tuotannon lukupolkua.`, { metricId });
    }

    if (!groups.has(sourceKey)) groups.set(sourceKey, { sourceType, sourceKey, probe, definitions: [] });
    groups.get(sourceKey).definitions.push(definition);
  }

  return deepFreeze([...groups.values()].map(group => ({
    sourceType: group.sourceType,
    sourceKey: group.sourceKey,
    metricIds: group.definitions.map(definition => definition.id),
    definitions: [...group.definitions],
    probe: group.probe
  })));
}

function assertRuntimeClient(client) {
  if (!(client instanceof Elm327Client)) {
    throw runtimeError("ELM327_CLIENT_REQUIRED", "Selective-diagnostiikka voidaan ajaa vain nykyisen Elm327Clientin kautta.");
  }
  if (client.vehicleKey !== VEHICLE_KEYS.IS220D) {
    throw runtimeError("IS220D_PROFILE_REQUIRED", "Selective-diagnostiikka vaatii aktiiviseksi IS220d-ajoneuvoprofiilin.");
  }
  if (!client.connected || !client.ecuConnected) {
    throw runtimeError("ENGINE_ECU_REQUIRED", "Selective-diagnostiikka vaatii valmiin ELM327- ja moottori-ECU-yhteyden.");
  }
}

function publicMetricResult(result) {
  return {
    metricId: result.definition.id,
    name: result.definition.name,
    unit: result.definition.unit || "",
    value: result.value,
    raw: result.raw || "",
    updatedAt: Number(result.updatedAt) || Date.now(),
    transactionId: result.transactionId || "",
    source: result.source || ""
  };
}

async function readToyotaGroup(client, group, timeoutMs) {
  const probe = group.probe;
  if (!probe || !isProfileReadOnlyCommand(probe.command, VEHICLE_KEYS.IS220D)) {
    throw runtimeError("TOYOTA_READ_NOT_ALLOWED", `IS220d-profiilin sallintalista esti lukulähteen ${group.sourceKey}.`);
  }

  const entry = await client.readToyotaProbeResponse(probe, timeoutMs);
  const results = group.definitions.map(definition => {
    const rawValue = entry.decoded?.values?.[definition.toyotaValueKey];
    const value = Number(rawValue);
    client.validateToyotaMetricValue(probe, definition, value);
    return publicMetricResult({
      definition,
      value,
      raw: entry.raw,
      updatedAt: entry.updatedAt,
      transactionId: entry.transactionId,
      source: `Toyota ${probe.command} · IS220d vehicle profile`
    });
  });

  return {
    sourceType: group.sourceType,
    sourceKey: group.sourceKey,
    metricIds: [...group.metricIds],
    transportAttempted: entry.fromCache !== true,
    transactionId: entry.transactionId || "",
    raw: entry.raw || "",
    results,
    missingMetricIds: [],
    error: ""
  };
}

async function readMode01Group(client, group, timeoutMs) {
  const reading = await client.readMetricGroup(group.definitions, timeoutMs);
  return {
    sourceType: group.sourceType,
    sourceKey: group.sourceKey,
    metricIds: [...group.metricIds],
    transportAttempted: reading.transportAttempted !== false,
    transactionId: "",
    raw: reading.raw || "",
    results: reading.results.map(publicMetricResult),
    missingMetricIds: [...(reading.missingMetricIds || [])],
    error: ""
  };
}

/**
 * Execute one generic component's selective evidence read.
 *
 * Execution is derived exclusively from plan.metricIds. Toyota request identity
 * comes back from the existing metric definition and must pass the IS220d
 * vehicle-profile allowlist in Elm327Client before transport. Standard Mode 01
 * values use Elm327Client.readMetricGroup and its existing decoder path.
 *
 * Dedicated guided components (currently DPNR pressure) are deliberately not
 * replaced by this one-shot runtime.
 */
export async function runIs220dSelectiveDiagnostic(componentId, {
  client,
  timeoutMs = 5000,
  continueOnReadError = true
} = {}) {
  const plan = buildIs220dSelectiveDiagnosticPlan(componentId);
  if (!plan) {
    throw runtimeError("UNKNOWN_COMPONENT", `Selective-diagnostiikalle ei löytynyt komponenttia ${componentId || "(tyhjä)"}.`);
  }
  if (!plan.runnable) {
    throw runtimeError("PLAN_NOT_RUNNABLE", `${plan.label}: tuotantoon hyväksytty selective-lukusuunnitelma ei ole valmis.`, { componentId: plan.componentId });
  }
  if (plan.dedicatedRunner) {
    throw runtimeError("DEDICATED_RUNNER_REQUIRED", `${plan.label}: käytä komponentin nykyistä ohjattua testiä (${plan.dedicatedRunner}).`, {
      componentId: plan.componentId,
      dedicatedRunner: plan.dedicatedRunner
    });
  }

  // Resolve every selected source before the first transport operation so an
  // invalid metric cannot cause a partially transmitted plan.
  const groups = resolveIs220dSelectiveMetricReadGroups(plan.metricIds);
  assertRuntimeClient(client);

  const startedAt = Date.now();
  const groupResults = [];
  for (const group of groups) {
    try {
      groupResults.push(group.sourceType === "toyota-read-data"
        ? await readToyotaGroup(client, group, timeoutMs)
        : await readMode01Group(client, group, timeoutMs));
    } catch (error) {
      groupResults.push({
        sourceType: group.sourceType,
        sourceKey: group.sourceKey,
        metricIds: [...group.metricIds],
        transportAttempted: true,
        transactionId: error?.transactionId || "",
        raw: error?.raw || error?.partialRaw || "",
        results: [],
        missingMetricIds: [...group.metricIds],
        error: error?.message || String(error)
      });
      if (!continueOnReadError) throw error;
    }
  }

  const observedMetricIds = unique(groupResults.flatMap(group => group.results.map(result => result.metricId)));
  const failedMetricIds = unique(groupResults.flatMap(group => [
    ...group.missingMetricIds,
    ...(group.error ? group.metricIds.filter(metricId => !observedMetricIds.includes(metricId)) : [])
  ])).filter(metricId => !observedMetricIds.includes(metricId));
  const values = Object.fromEntries(groupResults.flatMap(group => group.results.map(result => [result.metricId, result])));
  const status = observedMetricIds.length === plan.metricIds.length
    ? "complete"
    : observedMetricIds.length
      ? "partial"
      : "unavailable";

  return deepFreeze({
    schemaVersion: IS220D_SELECTIVE_RUNTIME_SCHEMA_VERSION,
    componentId: plan.componentId,
    label: plan.label,
    diagnosticClass: plan.diagnosticClass,
    status,
    requestedMetricIds: [...plan.metricIds],
    observedMetricIds,
    failedMetricIds,
    operatingStates: [...plan.operatingStates],
    startedAt,
    endedAt: Date.now(),
    groups: groupResults,
    values,
    interpretationBoundary: "Selective runtime reports read evidence only; it does not declare component health."
  });
}
