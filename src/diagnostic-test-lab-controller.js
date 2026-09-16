const ROOT_SELECTOR = "#is220dDiagnosticTestLab";
const TOOLBAR_SELECTOR = "[data-test-lab-run-toolbar]";

function mutationObserverFor(documentObject) {
  return documentObject?.defaultView?.MutationObserver || globalThis.MutationObserver || null;
}

function setRunState(root, message, warning = false) {
  const status = root?.querySelector?.("[data-test-lab-run-state]");
  if (!status) return;
  status.textContent = message;
  status.className = `inline-message test-lab-run-state${warning ? " warning" : ""}`;
}

function installRunToolbar(root, documentObject) {
  if (!root || root.querySelector(TOOLBAR_SELECTOR)) return false;
  const filters = root.querySelector("[data-test-lab-filters]");
  if (!filters) return false;

  const toolbar = documentObject.createElement("div");
  toolbar.dataset.testLabRunToolbar = "1";
  toolbar.className = "test-lab-run-toolbar";
  toolbar.innerHTML = `
    <div>
      <strong>Aja yhteinen OBD-kattavuustesti</strong>
      <span> Käyttää Flexin olemassa olevaa BOM-komponenttidiagnoosia ja nykyistä tuotantoallowlistia. Test Lab ei lähetä omia komentoja.</span>
    </div>
    <div class="test-lab-run-toolbar-actions">
      <button type="button" class="primary compact" data-test-lab-run-all>Aja sallitut OBD-luk testit</button>
      <span class="inline-message test-lab-run-state" data-test-lab-run-state aria-live="polite"></span>
    </div>`;
  filters.parentNode.insertBefore(toolbar, filters);

  const button = toolbar.querySelector("[data-test-lab-run-all]");
  button?.addEventListener("click", () => {
    const source = documentObject.querySelector("#bomDiagnosticRun");
    if (!source || source.disabled) {
      setRunState(root, "BOM-komponenttidiagnoosi ei ole nyt ajettavissa. Yhdistä IS220d:n moottori-ECU ja varmista, ettei toinen testi ole käynnissä.", true);
      return;
    }
    setRunState(root, "Kattavuustesti käynnistetty. Näkymä päivittyy automaattisesti BOM-diagnoosin valmistuttua.");
    source.click();
  });
  return true;
}

function installCoverageRefreshObserver(documentObject) {
  const badge = documentObject.querySelector("#bomDiagnosticBadge");
  const Observer = mutationObserverFor(documentObject);
  if (!badge || !Observer || badge.dataset.testLabCoverageObserver === "1") return false;
  badge.dataset.testLabCoverageObserver = "1";
  let previous = badge.textContent || "";
  const observer = new Observer(() => {
    const current = badge.textContent || "";
    if (current === previous) return;
    previous = current;
    const root = documentObject.querySelector(ROOT_SELECTOR);
    const refresh = root?.querySelector?.("[data-test-lab-refresh]");
    refresh?.click();
  });
  observer.observe(badge, { childList: true, characterData: true, subtree: true });
  return true;
}

function installRootReplacementObserver(documentObject) {
  const page = documentObject.querySelector("#page-component-diagnostics");
  const Observer = mutationObserverFor(documentObject);
  if (!page || !Observer || page.dataset.testLabControllerObserver === "1") return false;
  page.dataset.testLabControllerObserver = "1";
  const observer = new Observer(() => {
    const root = documentObject.querySelector(ROOT_SELECTOR);
    if (root && !root.querySelector(TOOLBAR_SELECTOR)) installRunToolbar(root, documentObject);
    installCoverageRefreshObserver(documentObject);
  });
  observer.observe(page, { childList: true, subtree: false });
  return true;
}

function installControllerStyles(documentObject) {
  if (!documentObject?.head || documentObject.querySelector("#diagnosticTestLabControllerStyles")) return;
  const style = documentObject.createElement("style");
  style.id = "diagnosticTestLabControllerStyles";
  style.textContent = `
    .test-lab-run-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;margin:12px 0;padding:11px 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface-inset)}
    .test-lab-run-toolbar>div:first-child{font-size:11px;line-height:1.45}.test-lab-run-toolbar>div:first-child span{color:var(--muted)}
    .test-lab-run-toolbar-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.test-lab-run-state{margin:0;max-width:420px;font-size:10px}
    @media(max-width:720px){.test-lab-run-toolbar{grid-template-columns:1fr}.test-lab-run-toolbar-actions{justify-content:flex-start}.test-lab-run-toolbar-actions button{width:100%}}
  `;
  documentObject.head.appendChild(style);
}

export function enhanceIs220dDiagnosticTestLab(documentObject = globalThis.document) {
  if (!documentObject?.querySelector) return false;
  const root = documentObject.querySelector(ROOT_SELECTOR);
  if (!root) return false;
  installControllerStyles(documentObject);
  installRunToolbar(root, documentObject);
  installCoverageRefreshObserver(documentObject);
  installRootReplacementObserver(documentObject);
  return true;
}
