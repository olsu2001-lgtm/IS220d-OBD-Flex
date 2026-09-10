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

function loadPageModule() {
  if (!hasFullBrowserDom()) return null;
  if (!pageModulePromise) pageModulePromise = import("./component-diagnostics-page.js");
  return pageModulePromise;
}

export function publishIs220dComponentDiagnosticCoverageToUi(coverage, meta = {}) {
  const modulePromise = loadPageModule();
  if (!modulePromise) return;
  modulePromise
    .then(module => module.publishIs220dComponentDiagnosticCoverage(coverage, meta))
    .catch(() => {});
}

loadPageModule();
