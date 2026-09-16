import { buildEcuSurveyUiModel } from "./ecu-survey-ui.js";
import {
  buildTechstreamReferenceTemplate,
  clearTechstreamReference,
  saveTechstreamReference
} from "./techstream-reference.js";
import {
  buildGuidedTechstreamExamples,
  buildGuidedTechstreamReference,
  techstreamReferenceToGuidedDraft
} from "./techstream-reference-builder.js";

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
.techstream-guided-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}.techstream-guided-field{display:grid;gap:4px}.techstream-guided-field.full{grid-column:1/-1}.techstream-guided-field label{margin:0;color:#cbd5df;font-size:9px;font-weight:750}.techstream-guided-field input,.techstream-guided-field textarea{width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--line);border-radius:8px;background:#080c11;color:#c5d5e6;font:10px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.techstream-guided-field textarea{min-height:82px;margin-top:0}.techstream-guided-field textarea.rows{min-height:112px}.techstream-guided-help{margin:5px 0 0;color:var(--muted);font-size:8px;line-height:1.4}.techstream-guided-help code{color:#c5d5e6}.techstream-guided-badge{display:inline-block;margin-top:6px;padding:4px 6px;border-radius:7px;background:#0a0e13;color:var(--muted);font-size:8px}.techstream-guided-badge strong{color:#cbd5df}
@media(max-width:420px){.techstream-reference-meta{grid-template-columns:1fr 1fr}.techstream-reference-actions{grid-template-columns:1fr}.techstream-guided-grid{grid-template-columns:1fr}.techstream-guided-field.full{grid-column:auto}}
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
  const anchor = document.getElementById("ecuSurveyFieldValidation") || document.getElementById("ecuSurveyIdentity") || document.getElementById("ecuSurveyMeta") || document.getElementById("diagnosticSummary");
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

function techstreamState(status, loaded) {
  if (!loaded) return { code: "not-loaded", label: "Ei referenssiä" };
  switch (String(status || "")) {
    case "verified-mappings-observed": return { code: "observed", label: "Varmennetut mappingit havaittu" };
    case "verified-mapping-discrepancy": return { code: "attention", label: "Mapping-poikkeama" };
    case "incomplete-reference": return { code: "incomplete", label: "Referenssi keskeneräinen" };
    case "reference-only": return { code: "review", label: "Referenssi ladattu · survey puuttuu" };
    default: return { code: "review", label: "Referenssi ladattu · käsintarkistus" };
  }
}

function referenceOnlyModel(historyResult) {
  const comparison = historyResult?.techstreamComparison || { loaded: false, status: "not-loaded" };
  const reference = historyResult?.techstreamReference || comparison?.reference || null;
  const loaded = comparison?.loaded === true || Boolean(reference);
  const state = techstreamState(comparison?.status || (loaded ? "reference-only" : "not-loaded"), loaded);
  const systems = (reference?.systems || []).map(system => ({
    name: String(system?.name || ""),
    dtcs: [...(system?.dtcs || [])].map(String),
    note: String(system?.note || "")
  }));
  const comparisonMappings = Array.isArray(comparison?.mappings) && comparison.mappings.length
    ? comparison.mappings
    : (reference?.mappings || []).map(mapping => ({ ...mapping, status: "not-observed", observedResponseHeaders: [] }));
  const mappings = comparisonMappings.map(mapping => ({
    requestHeader: String(mapping?.requestHeader || ""),
    responseHeader: String(mapping?.responseHeader || ""),
    systemName: String(mapping?.systemName || ""),
    evidenceLevel: String(mapping?.evidenceLevel || ""),
    evidenceNote: String(mapping?.evidenceNote || ""),
    status: String(mapping?.status || "not-observed"),
    observedResponseHeaders: [...(mapping?.observedResponseHeaders || [])].map(String)
  }));
  return {
    visible: true,
    loaded,
    code: state.code,
    label: state.label,
    referenceId: String(reference?.referenceId || ""),
    capturedAt: String(reference?.capturedAt || ""),
    note: String(reference?.note || ""),
    systemCount: Number(comparison?.systemCount ?? systems.length),
    dtcCount: Number(comparison?.dtcCount ?? systems.reduce((sum, system) => sum + system.dtcs.length, 0)),
    verifiedMappings: Number(comparison?.verifiedMappings ?? mappings.filter(mapping => mapping.evidenceLevel === "verified").length),
    candidateMappings: Number(comparison?.candidateMappings ?? mappings.filter(mapping => mapping.evidenceLevel === "candidate").length),
    verifiedObserved: Number(comparison?.verifiedObserved || 0),
    mappings,
    systems,
    unmappedFlexResponders: [...(comparison?.unmappedFlexResponders || [])],
    unmappedTechstreamSystems: [...(comparison?.unmappedTechstreamSystems || systems.map(system => system.name))]
  };
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

function field(label, control, full = false) {
  const wrapper = create("div", `techstream-guided-field${full ? " full" : ""}`);
  const labelElement = create("label", "", label);
  wrapper.append(labelElement, control);
  return wrapper;
}

function toLocalDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function buildGuidedEditor(root, model, loadHistory) {
  const history = loadHistory();
  const currentReference = history?.techstreamReference || null;
  const draft = techstreamReferenceToGuidedDraft(currentReference);
  const examples = buildGuidedTechstreamExamples();
  const details = create("details");
  details.open = !model.loaded;
  details.append(create("summary", "", model.loaded ? "Muokkaa referenssiä ohjatusti" : "Luo Techstream-referenssi ohjatusti"));
  details.append(create("p", "techstream-reference-note", "Kirjaa Health Checkin järjestelmät sellaisina kuin ne näkyvät Techstreamissa. CAN-osoitteita ei päätellä nimestä: mapping lisätään vain, jos sinulla on sille erillinen peruste."));

  const grid = create("div", "techstream-guided-grid");
  const referenceId = create("input");
  referenceId.type = "text";
  referenceId.maxLength = 80;
  referenceId.value = draft.referenceId;
  referenceId.placeholder = "esim. health-check-2026-09";
  const capturedAt = create("input");
  capturedAt.type = "datetime-local";
  capturedAt.value = toLocalDateTimeInput(draft.capturedAt);
  const note = create("textarea");
  note.rows = 2;
  note.maxLength = 500;
  note.value = draft.note;
  note.placeholder = "Valinnainen yleishuomio referenssistä";
  grid.append(field("Referenssitunnus", referenceId), field("Health Checkin ajankohta", capturedAt), field("Yleishuomio", note, true));

  const systems = create("textarea", "rows");
  systems.value = draft.systemsText;
  systems.placeholder = examples.systems;
  const systemField = field("Järjestelmät · yksi rivi / järjestelmä", systems, true);
  systemField.append(create("p", "techstream-guided-help", "Muoto: järjestelmänimi | DTC:t pilkulla | valinnainen huomio. DTC-kentän ja huomion saa jättää tyhjäksi."));
  grid.append(systemField);

  const mappings = create("textarea", "rows");
  mappings.value = draft.mappingsText;
  mappings.placeholder = examples.mappings;
  const mappingField = field("Eksplisiittiset CAN-mappingit · valinnainen", mappings, true);
  mappingField.append(create("p", "techstream-guided-help", "Muoto: request | response | täsmälleen sama järjestelmänimi | evidenssiperuste. Tällainen 4-kenttäinen rivi tallentuu aina candidate-tasolle. Lisää erillinen candidate/verified-kenttä vain, kun haluat asettaa tason eksplisiittisesti."));
  grid.append(mappingField);
  details.append(grid);

  const badge = create("div", "techstream-guided-badge");
  badge.append(create("strong", "", "Fail-closed: "), document.createTextNode("lomake käyttää samaa schema-validatoria kuin JSON-tuonti; tuntemattomat järjestelmät, väärät DTC:t, duplikaatit ja perusteettomat mappingit hylätään."));
  details.append(badge);

  const actions = create("div", "techstream-reference-actions");
  const save = create("button", "primary", model.loaded ? "Päivitä referenssi" : "Tallenna referenssi");
  const preview = create("button", "secondary", "Muodosta JSON kenttään");
  const clear = create("button", "secondary", "Tyhjennä referenssi");
  save.type = preview.type = clear.type = "button";

  const buildValue = () => buildGuidedTechstreamReference({
    referenceId: referenceId.value,
    capturedAt: capturedAt.value,
    note: note.value,
    systemsText: systems.value,
    mappingsText: mappings.value
  });

  save.addEventListener("click", () => {
    let reference;
    try { reference = buildValue(); }
    catch (error) {
      setMessage(root, error?.message || String(error), "error");
      return;
    }
    const result = saveTechstreamReference(reference);
    if (!result.saved) {
      setMessage(root, `Tallennus epäonnistui: ${result.error}`, "error");
      return;
    }
    render(loadHistory());
    const refreshed = document.getElementById(ROOT_ID);
    if (refreshed) setMessage(refreshed, "Techstream-referenssi tallennettu ohjatusta lomakkeesta.", "ok");
  });

  preview.addEventListener("click", () => {
    let reference;
    try { reference = buildValue(); }
    catch (error) {
      setMessage(root, error?.message || String(error), "error");
      return;
    }
    const json = root.querySelector('textarea[aria-label="Techstream reference JSON"]');
    if (json) json.value = JSON.stringify(reference, null, 2);
    setMessage(root, "Validoitu JSON muodostettu lisäasetusten JSON-kenttään.", "ok");
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

  actions.append(save, preview, clear);
  details.append(actions);
  root.append(details);
}

function buildJsonEditor(root, model, loadHistory) {
  const details = create("details");
  details.append(create("summary", "", "JSON-editori · lisäasetukset"));
  const textarea = create("textarea");
  textarea.setAttribute("aria-label", "Techstream reference JSON");
  textarea.value = model.loaded ? JSON.stringify(loadHistory()?.techstreamReference || {}, null, 2) : "";
  textarea.placeholder = "Liitä neutraali Techstream Health Check -evidenssi JSON-muodossa";
  const actions = create("div", "techstream-reference-actions");
  const template = create("button", "secondary", "Kopioi JSON-pohja");
  const save = create("button", "primary", "Tuo JSON");
  template.type = save.type = "button";

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
    try { result = saveTechstreamReference(textarea.value); }
    catch (error) {
      setMessage(root, error?.message || String(error), "error");
      return;
    }
    if (!result.saved) {
      setMessage(root, `Tallennus epäonnistui: ${result.error}`, "error");
      return;
    }
    render(loadHistory());
    const refreshed = document.getElementById(ROOT_ID);
    if (refreshed) setMessage(refreshed, "Techstream-referenssi tallennettu JSONista.", "ok");
  });

  actions.append(template, save);
  details.append(textarea, actions);
  root.append(details);
}

function render(historyResult, loadHistoryOverride = null) {
  ensureStyles();
  const root = ensureRoot();
  if (!root) return;
  const loader = loadHistoryOverride || render.loadHistory;
  const current = historyResult?.latestSnapshot || historyResult?.snapshots?.[historyResult.snapshots.length - 1] || null;
  const surveyModel = current ? buildEcuSurveyUiModel(current, historyResult) : null;
  const model = surveyModel?.visible ? surveyModel.techstreamReference : referenceOnlyModel(historyResult);
  root.replaceChildren();
  root.classList.remove("hidden");

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
    root.append(create("p", "techstream-reference-note", current
      ? "Luo neutraali Techstream Health Check -referenssi ohjatulla lomakkeella. Järjestelmänimestä ei päätellä CAN-osoitetta."
      : "Techstream-referenssin voi valmistella jo ennen auton ECU Survey -ajoa. Varsinainen CAN-ristiinvertailu käynnistyy vasta, kun survey-evidenssiä on tallennettu."));
  }

  buildGuidedEditor(root, model, loader);
  buildJsonEditor(root, model, loader);
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


