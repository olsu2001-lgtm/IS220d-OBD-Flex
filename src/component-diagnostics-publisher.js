import { publishIs220dTechstreamEvidence } from "./is220d-techstream-evidence.js";

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
let vikadiagObdDiagnosticPageModulePromise = null;
let guidedSessionModulePromise = null;
let operatingStateModulePromise = null;
let componentInspectionPointsModulePromise = null;
let fuelInspectionPointsModulePromise = null;
let startingChargingInspectionPointsModulePromise = null;
let airExhaustInspectionPointsModulePromise = null;
let inspectionExecutionStateModulePromise = null;
let captureHistoryModulePromise = null;
let techstreamDataListGapModulePromise = null;
let nextInspectionModulePromise = null;
let componentDiagnosticsNavigationPromise = null;

function loadPageModule() {
  if (!hasFullBrowserDom()) return null;
  if (!pageModulePromise) pageModulePromise = import("./component-diagnostics-page.js");
  return pageModulePromise;
}

export function syncComponentDiagnosticsNavigationVisibility(documentObject = globalThis.document) {
  if (!documentObject || typeof documentObject.querySelector !== "function") return false;
  const button = documentObject.querySelector("#nav-component-diagnostics");
  const is220dReferenceNav = documentObject.querySelector("#nav-dpnr");
  if (!button || !is220dReferenceNav) return false;
  const shouldBeVisible = !is220dReferenceNav.classList?.contains?.("hidden");
  button.classList?.toggle?.("hidden", !shouldBeVisible);
  return shouldBeVisible;
}

export function activateComponentDiagnosticsPage(documentObject = globalThis.document, windowObject = globalThis.window) {
  if (!documentObject || typeof documentObject.querySelector !== "function") return false;
  const button = documentObject.querySelector("#nav-component-diagnostics");
  const page = documentObject.querySelector("#page-component-diagnostics");
  if (!button || !page) return false;
  if (button.classList?.contains?.("hidden")) return false;

  documentObject.querySelectorAll?.(".page")?.forEach?.(candidate => {
    candidate.classList?.toggle?.("active", candidate.id === "page-component-diagnostics");
  });
  page.classList?.remove?.("hidden");
  documentObject.querySelectorAll?.(".nav-item")?.forEach?.(candidate => {
    candidate.classList?.toggle?.("active", candidate === button);
  });
  windowObject?.scrollTo?.({ top: 0, behavior: "instant" });
  return true;
}

export function bindComponentDiagnosticsNavigation(
  button,
  documentObject = globalThis.document,
  windowObject = globalThis.window
) {
  if (!button || typeof button.addEventListener !== "function") return false;
  button.dataset ||= {};
  if (button.dataset.dynamicNavigationBound === "1") return true;
  button.dataset.dynamicNavigationBound = "1";
  button.addEventListener("click", () => activateComponentDiagnosticsPage(documentObject, windowObject));
  return true;
}

function installComponentDiagnosticsNavigation() {
  const pagePromise = loadPageModule();
  if (!pagePromise) return null;
  if (!componentDiagnosticsNavigationPromise) {
    componentDiagnosticsNavigationPromise = pagePromise.then(() => {
      const button = document.querySelector("#nav-component-diagnostics");
      const page = document.querySelector("#page-component-diagnostics");
      if (!button || !page) return false;
      syncComponentDiagnosticsNavigationVisibility();
      return bindComponentDiagnosticsNavigation(button);
    }).catch(() => false);
  }
  return componentDiagnosticsNavigationPromise;
}

function loadGroupOverviewModule() {
  const pagePromise = loadPageModule();
  if (!pagePromise) return null;
  if (!groupOverviewModulePromise) {
    groupOverviewModulePromise = pagePromise.then(() => import("./component-diagnostic-group-overview.js"));
  }
  return groupOverviewModulePromise;
}

function loadVikadiagObdDiagnosticPageModule() {
  const pagePromise = loadPageModule();
  if (!pagePromise) return null;
  if (!vikadiagObdDiagnosticPageModulePromise) {
    vikadiagObdDiagnosticPageModulePromise = pagePromise.then(() => import("./vikadiag-obd-diagnostic-page.js"));
  }
  return vikadiagObdDiagnosticPageModulePromise;
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

function loadCaptureHistoryModule() {
  const executionPromise = loadInspectionExecutionStateModule();
  if (!executionPromise) return null;
  if (!captureHistoryModulePromise) {
    captureHistoryModulePromise = executionPromise.then(() => import("./is220d-capture-history.js"));
  }
  return captureHistoryModulePromise;
}

function loadTechstreamDataListGapModule() {
  const executionPromise = loadInspectionExecutionStateModule();
  if (!executionPromise) return null;
  if (!techstreamDataListGapModulePromise) {
    techstreamDataListGapModulePromise = executionPromise.then(() => import("./techstream-data-list-gap-ui.js"));
  }
  return techstreamDataListGapModulePromise;
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
  installComponentDiagnosticsNavigation();
  const overviewPromise = loadGroupOverviewModule();
  const vikadiagObdDiagnosticPagePromise = loadVikadiagObdDiagnosticPageModule();
  const guidedSessionPromise = loadGuidedSessionModule();
  const operatingStatePromise = loadOperatingStateModule();
  const componentInspectionPointsPromise = loadComponentInspectionPointsModule();
  const fuelInspectionPointsPromise = loadFuelInspectionPointsModule();
  const startingChargingInspectionPointsPromise = loadStartingChargingInspectionPointsModule();
  const airExhaustInspectionPointsPromise = loadAirExhaustInspectionPointsModule();
  const inspectionExecutionStatePromise = loadInspectionExecutionStateModule();
  const captureHistoryPromise = loadCaptureHistoryModule();
  const techstreamDataListGapPromise = loadTechstreamDataListGapModule();
  const nextInspectionPromise = loadNextInspectionModule();
  pagePromise
    .then(module => module.publishIs220dComponentDiagnosticCoverage(coverage, meta))
    .catch(() => {});
  overviewPromise
    ?.then(module => module.publishIs220dDiagnosticGroupOverview(coverage, meta))
    .catch(() => {});
  vikadiagObdDiagnosticPagePromise
    ?.then(module => module.publishVikadiagObdDiagnosticCatalog())
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
  captureHistoryPromise
    ?.then(module => module.publishIs220dCaptureHistory(meta.captureEvidence))
    .catch(() => {});
  techstreamDataListGapPromise
    ?.then(module => module.publishTechstreamDataListGapUi())
    .then(() => publishIs220dTechstreamEvidence())
    .catch(() => {});
  nextInspectionPromise
    ?.then(module => module.publishPhysicalInspectionNextTask(coverage, meta))
    .catch(() => {});
}

loadPageModule();
installComponentDiagnosticsNavigation();
loadGroupOverviewModule();
loadVikadiagObdDiagnosticPageModule();
loadGuidedSessionModule();
loadOperatingStateModule();
loadComponentInspectionPointsModule();
loadFuelInspectionPointsModule();
loadStartingChargingInspectionPointsModule();
loadAirExhaustInspectionPointsModule();
loadInspectionExecutionStateModule();
loadCaptureHistoryModule();
loadTechstreamDataListGapModule();
loadNextInspectionModule();
