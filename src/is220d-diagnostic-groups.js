import { IS220D_COMPONENT_DIAGNOSTICS } from "./is220d-component-diagnostics.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

export const IS220D_DIAGNOSTIC_GROUPS = deepFreeze([
  {
    id: "air-intake-turbo-egr",
    label: "Ilmanotto, turbo, alipaine ja EGR",
    shortLabel: "Ilma / turbo / EGR",
    sourceGroup: "3. Ilma, alipaine, EGR ja pakokaasu",
    physicalFocus: "Ilmansuodattimelta turbolle ja imusarjalle sekä EGR:n ja turbon alipaineohjaukselle.",
    componentIds: [
      "engine.maf_sensor",
      "engine.map_sensor",
      "engine.egr_valve",
      "engine.turbocharger",
      "engine.intercooler",
      "engine.intake_manifold",
      "engine.vacuum_regulating_valve",
      "engine.vacuum_switching_valve",
      "engine.air_cleaner_hose"
    ]
  },
  {
    id: "fuel-rail-injection",
    label: "Polttoaine, rail ja ruiskutus",
    shortLabel: "Polttoaine / rail",
    sourceGroup: "4. Polttoainejärjestelmä",
    physicalFocus: "Polttoainesuodatin, korkeapainepumppu ja sen imuannosteluventtiili, common rail sekä pääsuuttimet.",
    componentIds: [
      "engine.fuel_temperature_sensor",
      "engine.common_rail_pressure_sensor",
      "engine.main_injectors",
      "engine.scv",
      "engine.fuel_filter",
      "engine.injection_pump"
    ]
  },
  {
    id: "dpnr-exhaust",
    label: "DPNR ja pakokaasun jälkikäsittely",
    shortLabel: "DPNR / pakokaasu",
    sourceGroup: "3. Ilma, alipaine, EGR ja pakokaasu",
    physicalFocus: "DPNR:n paine-ero, pakolämpöanturit ja regeneroinnin lisäpolttoainesuutin pakopuolella.",
    componentIds: [
      "engine.dpnr_differential_pressure_sensor",
      "engine.exhaust_gas_temperature_sensor_1",
      "engine.exhaust_gas_temperature_sensor_2",
      "engine.exhaust_fuel_addition_injector"
    ]
  },
  {
    id: "starting-charging-position",
    label: "Käynnistys, lataus ja kampiakselisignaali",
    shortLabel: "Startti / lataus",
    sourceGroup: "6. Laturi, startti ja 12 V sähkö",
    physicalFocus: "Akku-/maadoitusketju, starttimoottori, laturi ja moottorin kampiakselin kierroslukusignaali.",
    componentIds: [
      "engine.alternator",
      "engine.starter",
      "engine.crank_position_sensor"
    ]
  },
  {
    id: "engine-thermal-baseline",
    label: "Moottorin lämpötila ja perustila",
    shortLabel: "Lämpötila",
    sourceGroup: "5. Jäähdytys, öljy ja hihnakäyttö",
    physicalFocus: "Jäähdytysnesteen lämpötilan perustieto, jota käytetään myöhemmin kylmä/lämmin-toimintatilojen tunnistamiseen.",
    componentIds: [
      "engine.coolant_temperature_sensor"
    ]
  }
]);

const GROUP_BY_ID = new Map(IS220D_DIAGNOSTIC_GROUPS.map(group => [group.id, group]));
const GROUP_BY_COMPONENT_ID = new Map();
for (const group of IS220D_DIAGNOSTIC_GROUPS) {
  for (const componentId of group.componentIds) {
    if (GROUP_BY_COMPONENT_ID.has(componentId)) throw new Error(`Component ${componentId} belongs to multiple diagnostic groups`);
    GROUP_BY_COMPONENT_ID.set(componentId, group);
  }
}

const recipeIds = new Set(IS220D_COMPONENT_DIAGNOSTICS.map(component => component.id));
for (const componentId of GROUP_BY_COMPONENT_ID.keys()) {
  if (!recipeIds.has(componentId)) throw new Error(`Diagnostic group references unknown component ${componentId}`);
}
for (const componentId of recipeIds) {
  if (!GROUP_BY_COMPONENT_ID.has(componentId)) throw new Error(`Diagnostic component ${componentId} is missing a physical diagnostic group`);
}

export function getIs220dDiagnosticGroup(groupId) {
  return GROUP_BY_ID.get(String(groupId || "")) || null;
}

export function getIs220dDiagnosticGroupForComponent(componentId) {
  return GROUP_BY_COMPONENT_ID.get(String(componentId || "")) || null;
}

export function is220dDiagnosticComponentsForGroup(groupId) {
  const group = getIs220dDiagnosticGroup(groupId);
  if (!group) return [];
  const ids = new Set(group.componentIds);
  return IS220D_COMPONENT_DIAGNOSTICS.filter(component => ids.has(component.id));
}
