const ROOT_SELECTOR = "#is220dDiagnosticTestLab";
const TOOLBAR_SELECTOR = "[data-test-lab-run-toolbar]";
const ITEM_SELECTOR = "[data-test-lab-item]";
const ITEM_RUN_SELECTOR = "[data-test-lab-run-item]";
const ITEM_STATE_SELECTOR = "[data-test-lab-item-state]";

let pendingItemLabel = "";

function mutationObserverFor(documentObject) {
  return documentObject?.defaultView?.MutationObserver || globalThis.MutationObserver || null;
}

function setRunState(root, message, warning = false) {
  const status = root?.querySelector?.("[data-test-lab-run-state]");
  if (!status) return;
  status.textContent = message;
  status.className = `inline-message test-lab-run-state${warning ? " warning" : ""}`;
}

function setItemState(item, message, warning = false) {
  const status = item?.querySelector?.(ITEM_STATE_SELECTOR);
  if (!status) return;
  status.textContent = message;
  status.className = `inline-message test-lab-item-state${warning ? " warning" : ""}`;
}

function itemLabel(item) {
  return String(item?.querySelector?.("h3")?.textContent || "").trim();
}

function findItemByLabel(root, label) {
  if (!root || !label) return null;
  return [...root.querySelectorAll(ITEM_SELECTOR)].find(item => itemLabel(item) === label) || null;
}

function focusPendingItem(root) {
  if (!pendingItemLabel) return false;
  const item = findItemByLabel(root, pendingItemLabel);
  if (!item) return false;
  root.querySelectorAll(`${ITEM_SELECTOR}[data-test-lab-focused="1"]`).forEach(candidate => {
    delete candidate.dataset.testLabFocused;
  });
  item.dataset.testLabFocused = "1";
  item.hidden = false;
  setItemState(item, "Kattavuusajo valmistui. Tämän kohteen dataketju on päivitetty uusimmasta BOM-diagnoosista.");
  item.scrollIntoView?.({ block: "center", behavior: "smooth" });
  pendingItemLabel = "";
  return true;
}

function sharedRunner(documentObject) {
  const source = documentObject.querySelector("#bomDiagnosticRun");
  return source && !source.disabled ? source : null;
}

function installPerItemActions(root, documentObject) {
  let installed = 0;
  root.querySelectorAll(ITEM_SELECTOR).forEach(item => {
    if (item.dataset.runnable !== "1") return;
    const actions = item.querySelector(".test-lab-actions");
    if (!actions || actions.querySelector(ITEM_RUN_SELECTOR)) return;
    // DPNR keeps its dedicated guided capture. The generic Test Lab must not
    // replace that direct 217E/617E path with a second transport implementation.
    if (actions.querySelector("[data-test-lab-open-dpnr]")) return;

    const button = documentObject.createElement("button");
    button.type = "button";
    button.className = "secondary compact";
    button.dataset.testLabRunItem = "1";
    button.textContent = "Aja tämän kohteen OBD-evidenssi";

    const status = documentObject.createElement("span");
    status.dataset.testLabItemState = "1";
    status.className = "inline-message test-lab-item-state";
    status.setAttribute("aria-live", "polite");

    actions.insertBefore(button, actions.firstChild);
    actions.insertBefore(status, button.nextSibling);
    button.addEventListener("click", () => {
      const source = sharedRunner(documentObject);
      if (!source) {
        setItemState(item, "Yhteinen BOM-komponenttidiagnoosi ei ole nyt ajettavissa. Yhdistä IS220d:n moottori-ECU ja varmista, ettei toinen testi ole käynnissä.", true);
        return;
      }
      const label = itemLabel(item);
      if (!label) {
        setItemState(item, "Kohdetta ei voitu tunnistaa turvallisesti. Testiä ei käynnistetty.", true);
        return;
      }
      pendingItemLabel = label;
      setItemState(item, "Käynnistetään Flexin yhteinen read-only BOM-kattavuusajo. Vain tämän kortin tulos nostetaan lopuksi esiin; Test Lab ei lähetä omia komentoja.");
      source.click();
    });
    installed += 1;
  });
  return installed;
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
    const source = sharedRunner(documentObject);
    if (!source) {
      setRunState(root, "BOM-komponenttidiagnoosi ei ole nyt ajettavissa. Yhdistä IS220d:n moottori-ECU ja varmista, ettei toinen testi ole käynnissä.", true);
      return;
    }
    pendingItemLabel = "";
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
    if (!root) return;
    if (!root.querySelector(TOOLBAR_SELECTOR)) installRunToolbar(root, documentObject);
    installPerItemActions(root, documentObject);
    installCoverageRefreshObserver(documentObject);
    focusPendingItem(root);
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
    .test-lab-item-state{margin:0;max-width:520px;font-size:10px}.test-lab-item[data-test-lab-focused="1"]{outline:2px solid var(--info);outline-offset:3px}.test-lab-item[data-test-lab-focused="1"] .test-lab-diagnosis{font-weight:700}
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
  installPerItemActions(root, documentObject);
  installCoverageRefreshObserver(documentObject);
  installRootReplacementObserver(documentObject);
  focusPendingItem(root);
  return true;
}
