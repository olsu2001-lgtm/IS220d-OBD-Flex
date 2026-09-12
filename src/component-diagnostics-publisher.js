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
  nextInspectionPromise
    ?.then(module => module.publishPhysicalInspectionNextTask(coverage, meta))
    .catch(() => {});
}

loadPageModule();
loadGroupOverviewModule();
loadGuidedSessionModule();
loadOperatingStateModule();
loadComponentInspectionPointsModule();
loadNextInspectionModule();
