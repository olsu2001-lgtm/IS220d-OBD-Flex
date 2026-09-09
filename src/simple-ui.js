const STYLE_ID = "simple-ui-style";
const ROOT_ID = "simpleUseCard";
const ADVANCED_ID = "advancedDiagnostics";
const PROTOCOL_KEY = "obdProtocol";

const styles = `
.simple-use-card{margin-top:12px}.simple-use-card h3{margin:0 0 5px}.simple-use-card p{margin:0;color:var(--muted);font-size:11px;line-height:1.45}
.simple-use-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:11px}.simple-use-actions button{min-height:44px}
.simple-use-status{margin-top:8px;color:var(--muted);font-size:10px}.simple-use-status.ready{color:var(--green)}
.advanced-diagnostics{margin-top:12px;border:1px solid var(--line);border-radius:12px;background:var(--surface);overflow:hidden}.advanced-diagnostics>summary{cursor:pointer;padding:12px 13px;color:#cbd5df;font-size:11px;font-weight:800;list-style:none}.advanced-diagnostics>summary::-webkit-details-marker{display:none}.advanced-diagnostics>summary::after{content:"+";float:right;color:var(--muted)}.advanced-diagnostics[open]>summary::after{content:"−"}.advanced-diagnostics-body{padding:0 10px 10px}.advanced-connection-settings{margin:0 0 10px;padding:10px;border:1px solid var(--line);border-radius:10px;background:#0a0e13}.advanced-connection-settings label{margin-top:0}.advanced-connection-settings .hint{margin-bottom:0}
body.simple-user-mode #nav-terminal{display:none}
body.simple-user-mode.advanced-user-mode #nav-terminal{display:flex}
@media(max-width:420px){.simple-use-actions{grid-template-columns:1fr}}
`;

function create(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== "") element.textContent = String(text);
  return element;
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = styles;
  document.head.append(style);
}

function go(page) {
  const nav = document.getElementById(`nav-${page}`);
  if (nav) nav.click();
}

function configureDefaultProtocol() {
  const select = document.getElementById("protocolSelect");
  if (!select) return false;
  let stored = "";
  try { stored = String(globalThis.localStorage?.getItem(PROTOCOL_KEY) || ""); } catch {}
  if (!stored) {
    select.value = "can6";
    try { globalThis.localStorage?.setItem(PROTOCOL_KEY, "can6"); } catch {}
  }
  return true;
}

function moveProtocolToAdvanced(container) {
  const select = document.getElementById("protocolSelect");
  const label = document.querySelector('label[for="protocolSelect"]');
  if (!select || !label || container.contains(select)) return;
  const box = create("div", "advanced-connection-settings");
  box.append(label, select, create("p", "hint", "IS220d käyttää CAN 11 bit / 500 kbit/s -protokollaa. Muuta tätä vain yhteysongelman tutkimista varten."));
  container.prepend(box);
}

function advancedCards() {
  return ["elmDiagnosticCard", "quicklynksDiagnosticCard", "obdPlusTraceCard"]
    .map(id => document.getElementById(id))
    .filter(Boolean);
}

function ensureAdvanced(connectionPage) {
  let details = document.getElementById(ADVANCED_ID);
  if (!details) {
    details = create("details", "advanced-diagnostics");
    details.id = ADVANCED_ID;
    details.append(create("summary", "", "Lisädiagnostiikka ja kehitystyökalut"));
    const body = create("div", "advanced-diagnostics-body");
    body.id = `${ADVANCED_ID}Body`;
    details.append(body);
    connectionPage.append(details);
    details.addEventListener("toggle", () => {
      document.body.classList.toggle("advanced-user-mode", details.open);
    });
  }
  const body = document.getElementById(`${ADVANCED_ID}Body`);
  if (!body) return details;
  moveProtocolToAdvanced(body);
  for (const card of advancedCards()) {
    if (!body.contains(card)) body.append(card);
  }
  return details;
}

function connectionReady() {
  const ecu = document.getElementById("stageEcu");
  return Boolean(ecu?.classList.contains("connected"));
}

function updateSimpleStatus(root) {
  const status = root?.querySelector(".simple-use-status");
  if (!status) return;
  const ready = connectionReady();
  status.className = `simple-use-status${ready ? " ready" : ""}`;
  status.textContent = ready
    ? "Moottori-ECU yhdistetty. Voit avata mittaukset suoraan."
    : "Valitse OBD-lukija ja paina Yhdistä. Muut asetukset eivät normaalisti vaadi muutoksia.";
}

function ensureSimpleCard(connectionPage) {
  let root = document.getElementById(ROOT_ID);
  if (root) return root;
  const connectionStages = document.getElementById("connectionStages");
  const connectionCard = connectionStages?.closest?.(".card");
  if (!connectionCard) return null;

  root = create("div", "card simple-use-card");
  root.id = ROOT_ID;
  root.append(
    create("h3", "", "Normaalikäyttö"),
    create("p", "", "Kun yhteys on muodostettu, avaa DPNR-tarkistus tai tavallinen live-data. Flex käyttää autolle valmiiksi sopivaa CAN-asetusta." )
  );
  const actions = create("div", "simple-use-actions");
  const dpnr = create("button", "primary", "DPNR-tarkistus");
  const live = create("button", "secondary", "Live-data");
  dpnr.type = live.type = "button";
  dpnr.addEventListener("click", () => go("dpnr"));
  live.addEventListener("click", () => go("live"));
  actions.append(dpnr, live);
  root.append(actions, create("div", "simple-use-status", ""));
  connectionCard.insertAdjacentElement("afterend", root);
  updateSimpleStatus(root);
  return root;
}

function observeConnection(root) {
  const stage = document.getElementById("stageEcu");
  if (!stage || stage.dataset.simpleUiObserved === "true") return;
  stage.dataset.simpleUiObserved = "true";
  const observer = new MutationObserver(() => updateSimpleStatus(root));
  observer.observe(stage, { attributes: true, childList: true, subtree: true, characterData: true });
}

export function installSimpleUi() {
  if (typeof document === "undefined") return false;
  const mount = () => {
    const connectionPage = document.getElementById("page-connection");
    if (!connectionPage) return false;
    ensureStyles();
    document.body.classList.add("simple-user-mode");
    configureDefaultProtocol();
    const root = ensureSimpleCard(connectionPage);
    const advanced = ensureAdvanced(connectionPage);
    if (advanced?.open) document.body.classList.add("advanced-user-mode");
    observeConnection(root);
    return true;
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else queueMicrotask(mount);
  return true;
}
