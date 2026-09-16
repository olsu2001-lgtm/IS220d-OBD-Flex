import {
  Elm327Client,
  PID_BY_ID,
  VEHICLE_KEYS,
  CT200H_READ_DATA_PROBES,
  getProfileReadDataProbe,
  isProfileReadOnlyCommand,
  metricSupportsVehicle
} from "./core.js";
import {
  CT200H_ECU_COMPONENT_TESTS,
  getCt200hEcuComponentTest
} from "./ct200h-ecu-component-tests.js";

export const CT200H_ECU_COMPONENT_RUNTIME_SCHEMA_VERSION = 1;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

const unique = values => [...new Set((values || []).filter(Boolean).map(String))];
const normalizeToyotaCommand = value => String(value || "").replace(/\s+/g, "").toUpperCase();

function runtimeError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function assertCtClient(client) {
  if (!(client instanceof Elm327Client)) {
    throw runtimeError("ELM327_CLIENT_REQUIRED", "CT-komponenttitesti voidaan ajaa vain Flexin nykyisen Elm327Clientin kautta.");
  }
  if (client.vehicleKey !== VEHICLE_KEYS.CT200H) {
    throw runtimeError("CT200H_PROFILE_REQUIRED", "CT-komponenttitesti vaatii aktiiviseksi Lexus CT 200h -profiilin.");
  }
  if (!client.connected || !client.ecuConnected) {
    throw runtimeError("ECU_CONNECTION_REQUIRED", "CT-komponenttitesti vaatii valmiin ELM327- ja ajoneuvo-ECU-yhteyden.");
  }
}

function copyMetricDefinition(definition) {
  return { ...definition };
}

function copyProbe(probe) {
  return probe ? {
    ...probe,
    fields: Array.isArray(probe.fields) ? probe.fields.map(field => ({ ...field })) : []
  } : null;
}

export function resolveCt200hMetricReadGroups(metricIds) {
  const ids = unique(metricIds);
  if (!ids.length) throw runtimeError("EMPTY_METRIC_PLAN", "CT-komponenttitestissä ei ole luettavia Flex-mittareita.");

  const groups = new Map();
  for (const metricId of ids) {
    const registryDefinition = PID_BY_ID[metricId];
    if (!registryDefinition) {
      throw runtimeError("UNKNOWN_METRIC", `CT-komponenttitesti viittasi tuntemattomaan Flex-mittariin ${metricId}.`, { metricId });
    }
    if (!metricSupportsVehicle(registryDefinition, VEHICLE_KEYS.CT200H)) {
      throw runtimeError("WRONG_VEHICLE_METRIC", `Flex-mittari ${metricId} ei kuulu CT 200h -profiiliin.`, { metricId });
    }
    if (registryDefinition.derived || registryDefinition.adapterOnly) {
      throw runtimeError("NON_EXECUTABLE_METRIC", `Flex-mittarilla ${metricId} ei ole suoraa ajoneuvon lukupolkua.`, { metricId });
    }

    const definition = copyMetricDefinition(registryDefinition);
    let sourceType;
    let sourceKey;
    let probe = null;

    if (definition.toyotaCommand) {
      const command = normalizeToyotaCommand(definition.toyotaCommand);
      const registryProbe = getProfileReadDataProbe(command, VEHICLE_KEYS.CT200H);
      if (!registryProbe || !isProfileReadOnlyCommand(command, VEHICLE_KEYS.CT200H)) {
        throw runtimeError("CT_PROFILE_READ_NOT_ALLOWED", `CT 200h -profiilin sallintalista esti mittarin ${metricId}.`, { metricId });
      }
      if (!definition.toyotaValueKey) {
        throw runtimeError("MISSING_TOYOTA_VALUE", `CT Toyota -mittarilta ${metricId} puuttuu varmennettu arvokenttä.`, { metricId });
      }
      probe = copyProbe(registryProbe);
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
  if (!probe || !isProfileReadOnlyCommand(probe.command, VEHICLE_KEYS.CT200H)) {
    throw runtimeError("CT_PROFILE_READ_NOT_ALLOWED", `CT 200h -profiilin sallintalista esti lukulähteen ${group.sourceKey}.`);
  }
  const entry = await client.readToyotaProbeResponse(probe, timeoutMs);
  const results = group.definitions.map(definition => {
    const value = Number(entry.decoded?.values?.[definition.toyotaValueKey]);
    client.validateToyotaMetricValue(probe, definition, value);
    return publicMetricResult({
      definition,
      value,
      raw: entry.raw,
      updatedAt: entry.updatedAt,
      transactionId: entry.transactionId,
      source: `Toyota ${probe.command} · CT200h vehicle profile`
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

async function runMetricTest(plan, client, timeoutMs, continueOnReadError) {
  const groups = resolveCt200hMetricReadGroups(plan.metricIds);
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
  return { status, observedMetricIds, failedMetricIds, groups: groupResults, values };
}

async function runProfileProbeTest(plan, client, timeoutMs) {
  const probe = CT200H_READ_DATA_PROBES.find(candidate => candidate.id === plan.probeId) || null;
  if (!probe) throw runtimeError("UNKNOWN_PROFILE_PROBE", `CT-profiilista ei löytynyt testiä ${plan.probeId}.`, { probeId: plan.probeId });
  if (probe.evidence === "research-candidate" || !isProfileReadOnlyCommand(probe.command, VEHICLE_KEYS.CT200H)) {
    throw runtimeError("CT_PROFILE_READ_NOT_ALLOWED", `CT-profiili esti testin ${plan.probeId}.`, { probeId: plan.probeId });
  }
  const entry = await client.readToyotaProbeResponse(copyProbe(probe), timeoutMs);
  return {
    status: entry.decoded?.complete ? "complete" : "partial",
    observedMetricIds: [],
    failedMetricIds: [],
    groups: [{
      sourceType: "profile-probe",
      sourceKey: `profile:${probe.id}`,
      metricIds: [],
      transportAttempted: entry.fromCache !== true,
      transactionId: entry.transactionId || "",
      raw: entry.raw || "",
      decoded: entry.decoded || null,
      results: [],
      missingMetricIds: [],
      error: entry.decoded?.complete ? "" : "Vastaus saatiin, mutta profiilidekoodaus jäi vajaaksi."
    }],
    values: entry.decoded?.values ? { ...entry.decoded.values } : {}
  };
}

async function runVehicleDtcTest(plan, client) {
  const snapshot = await client.readVehicleSpecificDtcs({ includeResearchCandidates: false });
  const groups = (snapshot.groups || []).filter(group => plan.dtcRequestIds.includes(group.id));
  const observedIds = groups.filter(group => group.validResponse === true).map(group => group.id);
  const failedIds = plan.dtcRequestIds.filter(id => !observedIds.includes(id));
  return {
    status: observedIds.length === plan.dtcRequestIds.length ? "complete" : observedIds.length ? "partial" : "unavailable",
    observedMetricIds: observedIds,
    failedMetricIds: failedIds,
    groups: groups.map(group => ({
      sourceType: "vehicle-dtc",
      sourceKey: `dtc:${group.id}`,
      metricIds: [],
      transportAttempted: true,
      transactionId: group.transactionId || "",
      raw: group.raw || "",
      decoded: { codes: [...(group.codes || [])], validResponse: group.validResponse === true },
      results: [],
      missingMetricIds: [],
      error: group.validResponse === true ? "" : group.error || "Hyväksyttävää DTC-vastausta ei saatu."
    })),
    values: Object.fromEntries(groups.map(group => [group.id, { codes: [...(group.codes || [])], validResponse: group.validResponse === true }]))
  };
}

export async function runCt200hEcuComponentTest(testId, {
  client,
  timeoutMs = 5000,
  continueOnReadError = true
} = {}) {
  const plan = getCt200hEcuComponentTest(testId);
  if (!plan) throw runtimeError("UNKNOWN_CT_COMPONENT_TEST", `CT-komponenttitestiä ${testId || "(tyhjä)"} ei löytynyt.`);

  const startedAt = Date.now();
  if (!plan.productionAuthorized || plan.runner === "blocked") {
    return deepFreeze({
      schemaVersion: CT200H_ECU_COMPONENT_RUNTIME_SCHEMA_VERSION,
      testId: plan.id,
      ecuId: plan.ecuId,
      label: plan.label,
      runner: plan.runner,
      status: "blocked",
      requestedMetricIds: [...(plan.metricIds || [])],
      observedMetricIds: [],
      failedMetricIds: [],
      operatingStates: [...(plan.operatingStates || [])],
      startedAt,
      endedAt: Date.now(),
      groups: [],
      values: {},
      note: plan.note,
      interpretationBoundary: "Blocked/research-only CT ECU coverage is shown but never transmitted by the production component runner."
    });
  }

  assertCtClient(client);
  let evidence;
  if (plan.runner === "metric") evidence = await runMetricTest(plan, client, timeoutMs, continueOnReadError);
  else if (plan.runner === "profile-probe") evidence = await runProfileProbeTest(plan, client, timeoutMs);
  else if (plan.runner === "vehicle-dtc") evidence = await runVehicleDtcTest(plan, client);
  else throw runtimeError("UNKNOWN_CT_RUNNER", `CT-komponenttitestin runner ${plan.runner} ei ole tuettu.`, { runner: plan.runner });

  return deepFreeze({
    schemaVersion: CT200H_ECU_COMPONENT_RUNTIME_SCHEMA_VERSION,
    testId: plan.id,
    ecuId: plan.ecuId,
    label: plan.label,
    runner: plan.runner,
    diagnosticClass: plan.diagnosticClass,
    status: evidence.status,
    requestedMetricIds: [...(plan.metricIds || plan.dtcRequestIds || [])],
    observedMetricIds: evidence.observedMetricIds,
    failedMetricIds: evidence.failedMetricIds,
    operatingStates: [...(plan.operatingStates || [])],
    startedAt,
    endedAt: Date.now(),
    groups: evidence.groups,
    values: evidence.values,
    note: plan.note,
    interpretationBoundary: "CT component runtime reports read evidence only; it does not declare component health or remaining HV-battery capacity."
  });
}

export async function runAllCt200hEcuComponentTests({
  client,
  timeoutMs = 5000,
  continueOnReadError = true
} = {}) {
  assertCtClient(client);
  const startedAt = Date.now();
  const results = [];
  for (const plan of CT200H_ECU_COMPONENT_TESTS) {
    if (!plan.productionAuthorized || plan.runner === "blocked") {
      results.push(await runCt200hEcuComponentTest(plan.id, { client, timeoutMs, continueOnReadError }));
      continue;
    }
    try {
      results.push(await runCt200hEcuComponentTest(plan.id, { client, timeoutMs, continueOnReadError }));
    } catch (error) {
      results.push(deepFreeze({
        schemaVersion: CT200H_ECU_COMPONENT_RUNTIME_SCHEMA_VERSION,
        testId: plan.id,
        ecuId: plan.ecuId,
        label: plan.label,
        runner: plan.runner,
        status: "unavailable",
        requestedMetricIds: [...(plan.metricIds || plan.dtcRequestIds || [])],
        observedMetricIds: [],
        failedMetricIds: [...(plan.metricIds || plan.dtcRequestIds || [])],
        operatingStates: [...(plan.operatingStates || [])],
        startedAt: Date.now(),
        endedAt: Date.now(),
        groups: [],
        values: {},
        error: error?.message || String(error),
        note: plan.note,
        interpretationBoundary: "A failed read is retained as unavailable evidence; the runner does not infer a component fault from transport failure."
      }));
      if (!continueOnReadError) throw error;
    }
  }
  const summary = {
    total: results.length,
    complete: results.filter(result => result.status === "complete").length,
    partial: results.filter(result => result.status === "partial").length,
    unavailable: results.filter(result => result.status === "unavailable").length,
    blocked: results.filter(result => result.status === "blocked").length
  };
  return deepFreeze({
    schemaVersion: CT200H_ECU_COMPONENT_RUNTIME_SCHEMA_VERSION,
    vehicleKey: VEHICLE_KEYS.CT200H,
    startedAt,
    endedAt: Date.now(),
    results,
    summary,
    interpretationBoundary: "Run-all covers every ECU component test currently declared by the CT200h profile; undeclared ECUs are not guessed or probed."
  });
}
