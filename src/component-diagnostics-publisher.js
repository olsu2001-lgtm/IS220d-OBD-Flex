const hasFullBrowserDom = () => {
  try {
    if (typeof document === "undefined" || typeof document.querySelector !== "function") return false;
    const main = document.querySelector("#main");
    return Boolean(main && typeof main.insertBefore === "function");
  } catch {
    return false;
  }
};

let pageModulePromise = null;
let groupOverviewModulePromise = null;
let guidedSessionModulePromise = null;
let operatingStateModulePromise = null;
let componentInspectionPointsModulePromise = null;
let fuelInspectionPointsModulePromise = null;
let startingChargingInspectionPointsModulePromise = null;
let airExhaustInspectionPointsModulePromise = null;
let inspectionExecutionStateModulePromise = null;
let nextInspectionModulePromise = null;

function loadPageModule() {
  if (!hasFullBrowserDom()) return null;
  if (!pageModulePromise) pageModulePromise = import("./component-diagnostics-page.js");
  return pageModulePromise;
}

function loadGroupOverviewModule() {
  const pagePromise = loadPageModule();
  if (!pagePromise) return null;
  if (!groupOverviewModulePromise) {
    groupOverviewModulePromise = pagePromise.then(() => import("./component-diagnostic-group-overview.js"));
  }
  return groupOverviewModulePromise;
}

function loadGuidedSessionModule() {
  const pagePromise = loadPageModule();
  if (!pagePromise) return null;
  if (!guidedSessionModulePromise) {
    guidedSessionModulePromise = pagePromise.then(() => import("./component-diagnostic-guided-session.js"));
  }
  return guidedSessionModulePromise;
}

function loadOperatingStateModule() {
  const guidedPromise = loadGuidedSessionModule();
  if (!guidedPromise) return null;
  if (!operatingStateModulePromise) {
    operatingStateModulePromise = guidedPromise.then(() => import("./is220d-operating-state-guidance.js"));
  }
  return operatingStateModulePromise;
}

function loadComponentInspectionPointsModule() {
  const operatingPromise = loadOperatingStateModule();
  if (!operatingPromise) return null;
  if (!componentInspectionPointsModulePromise) {
    componentInspectionPointsModulePromise = operatingPromise.then(() => import("./is220d-component-inspection-points.js"));
  }
  return componentInspectionPointsModulePromise;
}

function loadFuelInspectionPointsModule() {
  const pointsPromise = loadComponentInspectionPointsModule();
  if (!pointsPromise) return null;
  if (!fuelInspectionPointsModulePromise) {
    fuelInspectionPointsModulePromise = pointsPromise.then(() => import("./is220d-fuel-inspection-points.js"));
  }
  return fuelInspectionPointsModulePromise;
}

function loadStartingChargingInspectionPointsModule() {
  const fuelPromise = loadFuelInspectionPointsModule();
  if (!fuelPromise) return null;
  if (!startingChargingInspectionPointsModulePromise) {
    startingChargingInspectionPointsModulePromise = fuelPromise.then(() => import("./is220d-starting-charging-inspection-points.js"));
  }
  return startingChargingInspectionPointsModulePromise;
}

function loadAirExhaustInspectionPointsModule() {
  const startPromise = loadStartingChargingInspectionPointsModule();
  if (!startPromise) return null;
  if (!airExhaustInspectionPointsModulePromise) {
    airExhaustInspectionPointsModulePromise = startPromise.then(() => import("./is220d-air-exhaust-inspection-points.js"));
  }
  return airExhaustInspectionPointsModulePromise;
}

function loadInspectionExecutionStateModule() {
  const airExhaustPromise = loadAirExhaustInspectionPointsModule();
  if (!airExhaustPromise) return null;
  if (!inspectionExecutionStateModulePromise) {
    inspectionExecutionStateModulePromise = airExhaustPromise.then(() => import("./is220d-inspection-execution-state.js"));
  }
  return inspectionExecutionStateModulePromise;
}

function loadNextInspectionModule() {
  const overviewPromise = loadGroupOverviewModule();
  if (!overviewPromise) return null;
  if (!nextInspectionModulePromise) {
    nextInspectionModulePromise = overviewPromise.then(() => import("./physical-inspection-next-task.js"));
  }
  return nextInspectionModulePromise;
}

export function publishIs220dComponentDiagnosticCoverageToUi(coverage, meta = {}) {
  const pagePromise = loadPageModule();
  if (!pagePromise) return;
  const overviewPromise = loadGroupOverviewModule();
  const guidedSessionPromise = loadGuidedSessionModule();
  const operatingStatePromise = loadOperatingStateModule();
  const componentInspectionPointsPromise = loadComponentInspectionPointsModule();
  const fuelInspectionPointsPromise = loadFuelInspectionPointsModule();
  const startingChargingInspectionPointsPromise = loadStartingChargingInspectionPointsModule();
  const airExhaustInspectionPointsPromise = loadAirExhaustInspectionPointsModule();
  const inspectionExecutionStatePromise = loadInspectionExecutionStateModule();
  const nextInspectionPromise = loadNextInspectionModule();
  pagePromise
    .then(module => module.publishIs220dComponentDiagnosticCoverage(coverage, meta))
    .catch(() => {});
  overviewPromise
    ?.then(module => module.publishIs220dDiagnosticGroupOverview(coverage, meta))
    .catch(() => {});
  guidedSessionPromise
    ?.then(module => module.publishIs220dGuidedDiagnosticSession(coverage, meta))
    .catch(() => {});
  operatingStatePromise
    ?.then(module => module.publishIs220dOperatingStateGuidance())
    .catch(() => {});
  componentInspectionPointsPromise
    ?.then(module => module.publishIs220dComponentInspectionPoints())
    .catch(() => {});
  fuelInspectionPointsPromise
    ?.then(module => module.publishIs220dFuelInspectionPoints())
    .catch(() => {});
  startingChargingInspectionPointsPromise
    ?.then(module => module.publishIs220dStartingChargingInspectionPoints())
    .catch(() => {});
  airExhaustInspectionPointsPromise
    ?.then(module => module.publishIs220dAirExhaustInspectionPoints())
    .catch(() => {});
  inspectionExecutionStatePromise
    ?.then(module => module.publishIs220dInspectionExecutionState(coverage, meta))
    .catch(() => {});
  nextInspectionPromise
    ?.then(module => module.publishPhysicalInspectionNextTask(coverage, meta))
    .catch(() => {});
}

loadPageModule();
loadGroupOverviewModule();
loadGuidedSessionModule();
loadOperatingStateModule();
loadComponentInspectionPointsModule();
loadFuelInspectionPointsModule();
loadStartingChargingInspectionPointsModule();
loadAirExhaustInspectionPointsModule();
loadInspectionExecutionStateModule();
loadNextInspectionModule();
