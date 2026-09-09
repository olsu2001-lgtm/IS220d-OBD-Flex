import {
  IS220D_DIAGNOSTIC_PROFILE,
  TOYOTA_READ_DATA_PROBES,
  IS220D_INJECTOR_SCREENING_PROBES,
  TOYOTA_READ_DATA_ALLOWED_COMMANDS,
  getToyotaReadDataProbe
} from "./is220d-profile.js";
import {
  CT200H_DIAGNOSTIC_PROFILE,
  CT200H_READ_DATA_PROBES,
  CT200H_LIVE_DATA_PROBES,
  CT200H_DTC_REQUESTS,
  CT200H_READ_ONLY_ALLOWED_COMMANDS,
  getCt200hReadDataProbe
} from "./ct200h-profile.js";

export const VEHICLE_KEYS = Object.freeze({
  IS220D: "is220d",
  CT200H: "ct200h",
  AUTO: "auto"
});

export const VEHICLE_PROFILES = Object.freeze({
  [VEHICLE_KEYS.IS220D]: IS220D_DIAGNOSTIC_PROFILE,
  [VEHICLE_KEYS.CT200H]: CT200H_DIAGNOSTIC_PROFILE
});

export const ALL_READ_DATA_PROBES = Object.freeze([
  ...TOYOTA_READ_DATA_PROBES.map(probe => Object.freeze({ ...probe, vehicleKey: VEHICLE_KEYS.IS220D })),
  ...IS220D_INJECTOR_SCREENING_PROBES.map(probe => Object.freeze({ ...probe, vehicleKey: VEHICLE_KEYS.IS220D })),
  ...CT200H_READ_DATA_PROBES
]);

export const ALL_PROFILE_READ_ONLY_COMMANDS = Object.freeze([
  ...TOYOTA_READ_DATA_ALLOWED_COMMANDS,
  ...CT200H_READ_ONLY_ALLOWED_COMMANDS
]);

export function getVehicleProfile(vehicleKey) {
  return VEHICLE_PROFILES[String(vehicleKey || "").toLowerCase()] || null;
}

export function getVehicleReadDataProbes(vehicleKey, { liveOnly = false } = {}) {
  if (vehicleKey === VEHICLE_KEYS.IS220D) return TOYOTA_READ_DATA_PROBES;
  if (vehicleKey === VEHICLE_KEYS.CT200H) return liveOnly ? CT200H_LIVE_DATA_PROBES : CT200H_READ_DATA_PROBES;
  return Object.freeze([]);
}

export function getVehicleDtcRequests(vehicleKey) {
  return vehicleKey === VEHICLE_KEYS.CT200H ? CT200H_DTC_REQUESTS : Object.freeze([]);
}

export function getProfileReadDataProbe(commandOrIdentifier, vehicleKey = "") {
  if (vehicleKey === VEHICLE_KEYS.IS220D) return getToyotaReadDataProbe(commandOrIdentifier);
  if (vehicleKey === VEHICLE_KEYS.CT200H) return getCt200hReadDataProbe(commandOrIdentifier);
  const normalized = String(commandOrIdentifier || "").replace(/\s+/g, "").toUpperCase();
  return ALL_READ_DATA_PROBES.find(probe =>
    Number.isInteger(commandOrIdentifier)
      ? probe.identifier === (Number(commandOrIdentifier) & 0xff)
      : probe.command === normalized || probe.rawCommand === normalized
  ) || null;
}

export function isProfileReadOnlyCommand(command, vehicleKey = "") {
  const normalized = String(command || "").replace(/\s+/g, "").toUpperCase();
  if (!normalized) return false;
  if (vehicleKey === VEHICLE_KEYS.IS220D) return TOYOTA_READ_DATA_ALLOWED_COMMANDS.includes(normalized);
  if (vehicleKey === VEHICLE_KEYS.CT200H) return CT200H_READ_ONLY_ALLOWED_COMMANDS.includes(normalized);
  return ALL_PROFILE_READ_ONLY_COMMANDS.includes(normalized);
}

export function vehicleDisplayName(vehicleKey) {
  return getVehicleProfile(vehicleKey)?.vehicle?.displayName || (vehicleKey === VEHICLE_KEYS.AUTO ? "Automaattinen tunnistus" : "Yleinen EOBD");
}

export function metricSupportsVehicle(definition, vehicleKey) {
  if (!definition) return false;
  if (definition.vehicleKey) return definition.vehicleKey === vehicleKey;
  if (Array.isArray(definition.vehicleKeys)) return definition.vehicleKeys.includes(vehicleKey);
  return true;
}
