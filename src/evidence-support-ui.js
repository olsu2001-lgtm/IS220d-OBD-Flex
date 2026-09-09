import { stringifyEvidenceSupportBundle } from "./evidence-support-bundle.js";

const STYLE_ID = "evidence-support-ui-style";
const ROOT_ID = "ecuSurveyEvidenceSupport";
const EVENT_NAME = "is220d:ecu-survey-history-updated";

const styles = `
.evidence-support{margin:0 0 11px;padding:10px;border:1px solid var(--line);border-radius:11px;background:var(--surface)}
.evidence-support-header{display:flex;align-items:center;justify-content:space-between;gap:8px}.evidence-support-header strong{font-size:11px}.evidence-support-header span{color:var(--muted);font-size:9px}
.evidence-support p{margin:7px 0 0;color:var(--muted);font-size:9px;line-height:1.4}.evidence-support button{width:100%;min-height:36px;margin-top:8px;padding:0 10px;font-size:10px;font-weight:800}.evidence-support textarea{width:100%;min-height:150px;margin-top:8px;padding:9px;border:1px solid var(--line);border-radius:9px;background:#080c11;color:#c5d5e6;resize:vertical;font:9px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.evidence-support-message{margin-top:6px!important}.evidence-support-message.ok{color:var(--green)!important}.evidence-support-message.error{color:#ffb4b4!important}
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

function ensureRoot() {
  let root = document.getElementById(ROOT_ID);
  if (root) return root;
  const anchor = document.getElementById("ecuSurveyTechstreamReference") || document.getElementById("ecuSurveyFieldValidation") || document.getElementById("ecuSurveyMeta");
  if (!anchor?.parentNode) return null;
  root = create("div", "evidence-support");
  root.id = ROOT_ID;
  anchor.insertAdjacentElement("afterend", root);
  return root;
}

function render(historyResult, loadHistory) {
  ensureStyles();
  const root = ensureRoot();
  if (!root) return;
  root.replaceChildren();
  const runs = Number(historyResult?.fieldValidation?.observedRuns || 0);
  const buildSha = String(historyResult?.fieldValidation?.buildSha || historyResult?.latestSnapshot?.buildSha || "");

  const header = create("div", "evidence-support-header");
  header.append(create("strong", "", "Evidence Support Bundle v1"), create("span", "", `${runs}/3 ajoa`));
  root.append(header);
  root.append(create("p", "", `Kompakti read-only JSON analyysiin. Build ${buildSha || "ei vielä kirjattu"}. Raaka CAN/ELM-data, adapteritunnisteet, Bluetooth-osoitteet ja ajoneuvon identiteettiarvot eivät kuulu pakettiin.`));

  const copy = create("button", "primary", "Kopioi evidenssipaketti");
  copy.type = "button";
  const fallback = create("textarea", "hidden");
  fallback.readOnly = true;
  fallback.setAttribute("aria-label", "Evidence Support Bundle JSON");
  const message = create("p", "evidence-support-message", "");

  copy.addEventListener("click", async () => {
    const current = typeof loadHistory === "function" ? loadHistory() : historyResult;
    const payload = stringifyEvidenceSupportBundle(current);
    try {
      await navigator.clipboard.writeText(payload);
      fallback.classList.add("hidden");
      message.className = "evidence-support-message ok";
      message.textContent = "Evidenssipaketti kopioitu.";
    } catch {
      fallback.value = payload;
      fallback.classList.remove("hidden");
      message.className = "evidence-support-message";
      message.textContent = "Leikepöytä ei ollut käytettävissä; JSON näkyy alla kopioitavaksi.";
    }
  });

  root.append(copy, fallback, message);
}

export function installEvidenceSupportUi({ loadHistory } = {}) {
  if (typeof document === "undefined" || typeof loadHistory !== "function") return false;
  const mount = () => render(loadHistory(), loadHistory);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else queueMicrotask(mount);
  document.addEventListener(EVENT_NAME, event => render(event?.detail?.historyResult || loadHistory(), loadHistory));
  return true;
}
