import { buildEcuSurveyUiModel } from "./ecu-survey-ui.js";
import {
  buildTechstreamReferenceTemplate,
  clearTechstreamReference,
  saveTechstreamReference
} from "./techstream-reference.js";

const STYLE_ID = "techstream-reference-ui-style";
const ROOT_ID = "ecuSurveyTechstreamReference";
const EVENT_NAME = "is220d:ecu-survey-history-updated";

const styles = `
.techstream-reference{margin:0 0 11px;padding:10px;border:1px solid var(--line);border-radius:11px;background:var(--surface)}
.techstream-reference-header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.techstream-reference-header strong{font-size:11px}
.techstream-reference-status{font-size:9px;font-weight:850}.techstream-reference-status.not-loaded{color:var(--muted)}.techstream-reference-status.review,.techstream-reference-status.incomplete{color:var(--yellow)}.techstream-reference-status.observed{color:var(--green)}.techstream-reference-status.attention{color:#ffb4b4}
.techstream-reference-meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-bottom:8px}.techstream-reference-meta>div{padding:7px;border-radius:8px;background:#0a0e13}.techstream-reference-meta span{display:block;color:var(--muted);font-size:8px;text-transform:uppercase}.techstream-reference-meta strong{display:block;margin-top:3px;font-size:10px}
.techstream-reference details{margin-top:7px;border-top:1px solid var(--line);padding-top:7px}.techstream-reference summary{cursor:pointer;color:#cbd5df;font-size:10px;font-weight:750}
.techstream-system-list,.techstream-mapping-list{display:grid;gap:5px;margin-top:7px}.techstream-system,.techstream-mapping{padding:7px 8px;border-radius:8px;background:#0a0e13;font-size:9px}.techstream-system strong,.techstream-mapping strong{display:block;font-size:10px}.techstream-system small,.techstream-mapping small{display:block;margin-top:2px;color:var(--muted);font-size:8px;line-height:1.35}.techstream-mapping.observed{border-left:3px solid var(--green)}.techstream-mapping.different-response,.techstream-mapping.not-observed,.techstream-mapping.outside-survey-plan{border-left:3px solid var(--yellow)}
.techstream-reference-note{margin:8px 0 0;color:var(--muted);font-size:9px;line-height:1.4}.techstream-reference textarea{width:100%;min-height:160px;margin-top:8px;padding:9px;border:1px solid var(--line);border-radius:9px;background:#080c11;color:#c5d5e6;resize:vertical;font:9px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.techstream-reference-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:7px}.techstream-reference-actions button{min-height:34px;padding:0 7px;font-size:9px}.techstream-reference-message{margin-top:6px;color:var(--muted);font-size:9px}.techstream-reference-message.error{color:#ffb4b4}.techstream-reference-message.ok{color:var(--green)}
@media(max-width:420px){.techstream-reference-meta{grid-template-columns:1fr 1fr}.techstream-reference-actions{grid-template-columns:1fr}}
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
  const anchor = document.getElementById("ecuSurveyFieldValidation") || document.getElementById("ecuSurveyIdentity") || document.getElementById("ecuSurveyMeta");
  if (!anchor?.parentNode) return null;
  root = create("div", "techstream-reference");
  root.id = ROOT_ID;
  anchor.insertAdjacentElement("afterend", root);
  return root;
}

function setMessage(root, text, type = "") {
  const message = root.querySelector(".techstream-reference-message");
  if (!message) return;
  message.textContent = String(text || "");
  message.className = `techstream-reference-message${type ? ` ${type}` : ""}`;
}

function renderSystems(root, model) {
  const details = create("details");
  details.append(create("summary", "", `Techstream-järjestelmät (${model.systems.length})`));
  const list = create("div", "techstream-system-list");
  if (!model.systems.length) list.append(create("div", "techstream-system", "Ei järjestelmiä referenssissä."));
  for (const system of model.systems) {
    const row = create("div", "techstream-system");
    row.append(create("strong", "", system.name));
    row.append(create("small", "", system.dtcs.length ? `DTC: ${system.dtcs.join(", ")}` : "DTC: ei kirjattuja koodeja"));
    if (system.note) row.append(create("small", "", system.note));
    list.append(row);
  }
  details.append(list);
  root.append(details);
}

function renderMappings(root, model) {
  const details = create("details");
  details.append(create("summary", "", `Eksplisiittiset CAN-mappingit (${model.mappings.length})`));
  const list = create("div", "techstream-mapping-list");
  if (!model.mappings.length) list.append(create("div", "techstream-mapping", "Ei mappingeja. Flex ei päättele niitä järjestelmänimistä."));
  for (const mapping of model.mappings) {
    const row = create("div", `techstream-mapping ${mapping.status}`);
    row.append(create("strong", "", `${mapping.requestHeader} → ${mapping.responseHeader} · ${mapping.systemName}`));
    row.append(create("small", "", `${mapping.evidenceLevel} · ${mapping.status}`));
    row.append(create("small", "", mapping.evidenceNote));
    if (mapping.observedResponseHeaders.length) row.append(create("small", "", `Flex havaitsi: ${mapping.observedResponseHeaders.join(", ")}`));
    list.append(row);
  }
  details.append(list);
  root.append(details);
}

function buildEditor(root, model, loadHistory) {
  const details = create("details");
  details.append(create("summary", "", model.loaded ? "Päivitä / korvaa referenssi-JSON" : "Tuo Techstream-referenssi JSON:na"));
  const textarea = create("textarea");
  textarea.setAttribute("aria-label", "Techstream reference JSON");
  textarea.value = model.loaded ? JSON.stringify(loadHistory()?.techstreamReference || {}, null, 2) : "";
  textarea.placeholder = "Liitä neutraali Techstream Health Check -evidenssi JSON-muodossa";
  const actions = create("div", "techstream-reference-actions");
  const template = create("button", "secondary", "Kopioi JSON-pohja");
  const save = create("button", "primary", "Tuo referenssi");
  const clear = create("button", "secondary", "Tyhjennä referenssi");
  template.type = save.type = clear.type = "button";

  template.addEventListener("click", async () => {
    const value = buildTechstreamReferenceTemplate();
    try {
      await navigator.clipboard.writeText(value);
      setMessage(root, "JSON-pohja kopioitu.", "ok");
    } catch {
      textarea.value = value;
      setMessage(root, "Leikepöytä ei ollut käytettävissä; pohja lisättiin kenttään.");
    }
  });

  save.addEventListener("click", () => {
    let result;
    try {
      result = saveTechstreamReference(textarea.value);
    } catch (error) {
      setMessage(root, error?.message || String(error), "error");
      return;
    }
    if (!result.saved) {
      setMessage(root, `Tallennus epäonnistui: ${result.error}`, "error");
      return;
    }
    render(loadHistory());
    const refreshed = document.getElementById(ROOT_ID);
    if (refreshed) setMessage(refreshed, "Techstream-referenssi tallennettu.", "ok");
  });

  clear.addEventListener("click", () => {
    if (!clearTechstreamReference()) {
      setMessage(root, "Referenssin tyhjennys epäonnistui.", "error");
      return;
    }
    render(loadHistory());
    const refreshed = document.getElementById(ROOT_ID);
    if (refreshed) setMessage(refreshed, "Techstream-referenssi tyhjennetty.");
  });

  actions.append(template, save, clear);
  details.append(textarea, actions);
  root.append(details);
}

function render(historyResult, loadHistoryOverride = null) {
  ensureStyles();
  const root = ensureRoot();
  if (!root) return;
  const loader = loadHistoryOverride || render.loadHistory;
  const current = historyResult?.latestSnapshot || historyResult?.snapshots?.[historyResult.snapshots.length - 1] || null;
  const model = current ? buildEcuSurveyUiModel(current, historyResult).techstreamReference : null;
  root.replaceChildren();
  root.classList.toggle("hidden", !model);
  if (!model) return;

  const header = create("div", "techstream-reference-header");
  header.append(
    create("strong", "", "Techstream · referenssievidenssi"),
    create("span", `techstream-reference-status ${model.code}`, model.label)
  );
  root.append(header);

  const meta = create("div", "techstream-reference-meta");
  for (const [label, value] of [
    ["Järjestelmät", model.systemCount],
    ["DTC", model.dtcCount],
    ["Varm. mappingit", `${model.verifiedObserved}/${model.verifiedMappings}`],
    ["Kandidaatit", model.candidateMappings]
  ]) {
    const cell = create("div");
    cell.append(create("span", "", label), create("strong", "", value));
    meta.append(cell);
  }
  root.append(meta);

  if (model.loaded) {
    if (model.referenceId || model.capturedAt) root.append(create("p", "techstream-reference-note", `${model.referenceId || "Referenssi"}${model.capturedAt ? ` · ${model.capturedAt}` : ""}`));
    renderSystems(root, model);
    renderMappings(root, model);
    if (model.unmappedFlexResponders.length) {
      root.append(create("p", "techstream-reference-note", `Flex-vastaajia ilman eksplisiittistä Techstream-mappingia: ${model.unmappedFlexResponders.map(item => `${item.requestHeader}→${item.responseHeaders.join("/") || "?"}`).join(", ")}.`));
    }
    if (model.unmappedTechstreamSystems.length) {
      root.append(create("p", "techstream-reference-note", `Techstream-järjestelmiä ilman CAN-mappingia: ${model.unmappedTechstreamSystems.length}. Tämä ei ole automaattinen poikkeama, koska kaikki järjestelmät eivät kuulu nykyiseen CAN-surveyhin.`));
    }
  } else {
    root.append(create("p", "techstream-reference-note", "Tuo tähän Flexin oma neutraali JSON-referenssi. Techstreamin alkuperäistä tiedostomuotoa ei parsita eikä järjestelmänimestä päätellä CAN-osoitetta."));
  }

  buildEditor(root, model, loader);
  root.append(create("p", "techstream-reference-message", ""));
}

export function installTechstreamReferenceUi({ loadHistory } = {}) {
  if (typeof document === "undefined" || typeof loadHistory !== "function") return false;
  render.loadHistory = loadHistory;
  const mount = () => render(loadHistory(), loadHistory);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else queueMicrotask(mount);
  document.addEventListener(EVENT_NAME, event => {
    render(event?.detail?.historyResult || loadHistory(), loadHistory);
  });
  return true;
}
