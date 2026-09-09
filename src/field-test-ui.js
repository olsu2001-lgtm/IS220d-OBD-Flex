const STYLE_ID = "field-test-ui-style";
const ROOT_ID = "ecuSurveyFieldTestMode";
const EVENT_NAME = "is220d:ecu-survey-history-updated";
const ENGINE_STATE_KEY = "is220d-obd:field-test-engine-state:v1";
export const FIELD_TEST_REQUIRED_RUNS = 3;

const styles = `
.field-test-mode{margin:0 0 11px;padding:10px;border:1px solid var(--line);border-radius:11px;background:var(--surface)}
.field-test-header{display:flex;align-items:center;justify-content:space-between;gap:8px}.field-test-header strong{font-size:11px}.field-test-status{font-size:9px;font-weight:850;color:var(--yellow)}.field-test-status.ready{color:var(--green)}.field-test-status.attention{color:#ffb4b4}
.field-test-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:8px}.field-test-meta>div{padding:7px;border-radius:8px;background:#0a0e13}.field-test-meta span{display:block;color:var(--muted);font-size:8px;text-transform:uppercase}.field-test-meta strong{display:block;margin-top:3px;overflow:hidden;font-size:10px;text-overflow:ellipsis;white-space:nowrap}
.field-test-controls{display:grid;grid-template-columns:minmax(0,1fr) minmax(130px,.8fr);gap:7px;margin-top:8px}.field-test-controls select,.field-test-controls button{min-height:38px}.field-test-hint,.field-test-message{margin:7px 0 0;color:var(--muted);font-size:9px;line-height:1.4}.field-test-message.ok{color:var(--green)}.field-test-message.error{color:#ffb4b4}
@media(max-width:420px){.field-test-meta{grid-template-columns:1fr 1fr}.field-test-controls{grid-template-columns:1fr}}
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
  root = create("div", "field-test-mode");
  root.id = ROOT_ID;
  anchor.insertAdjacentElement("beforebegin", root);
  return root;
}

function runtimeBuildSha(historyResult) {
  try {
    const embedded = String(globalThis.__IS220D_BUILD_SHA__ || "").trim();
    if (embedded) return embedded;
  } catch {}
  return String(historyResult?.latestSnapshot?.buildSha || historyResult?.fieldValidation?.buildSha || "").trim();
}

function loadEngineState() {
  try {
    const value = String(globalThis.localStorage?.getItem(ENGINE_STATE_KEY) || "");
    if (value === "running" || value === "stopped") return value;
  } catch {}
  return "running";
}

function saveEngineState(value) {
  if (value !== "running" && value !== "stopped") return false;
  try {
    globalThis.localStorage?.setItem(ENGINE_STATE_KEY, value);
    return true;
  } catch {
    return false;
  }
}

function matchingRuns(historyResult, buildSha, engineState) {
  return (Array.isArray(historyResult?.snapshots) ? historyResult.snapshots : []).filter(snapshot =>
    String(snapshot?.buildSha || "") === String(buildSha || "") &&
    String(snapshot?.validation?.engineState || "") === engineState &&
    snapshot?.mode === "read-only"
  );
}

export function buildFieldTestState(historyResult, engineState, buildShaOverride = "") {
  const normalizedState = engineState === "stopped" ? "stopped" : "running";
  const buildSha = String(buildShaOverride || runtimeBuildSha(historyResult)).trim();
  const runs = matchingRuns(historyResult, buildSha, normalizedState);
  const latestThree = runs.slice(-FIELD_TEST_REQUIRED_RUNS);
  const validation = historyResult?.fieldValidation || null;
  const sameCurrentGroup = String(validation?.buildSha || "") === buildSha && String(validation?.engineState || "") === normalizedState;
  const ready = sameCurrentGroup && validation?.readyForTechstream === true;
  const attention = sameCurrentGroup && validation?.status === "needs-attention";
  return Object.freeze({
    buildSha,
    engineState: normalizedState,
    observedRuns: latestThree.length,
    totalMatchingRuns: runs.length,
    ready,
    attention,
    currentValidationStatus: sameCurrentGroup ? String(validation?.status || "collecting") : "collecting"
  });
}

export function fieldTestStatusLabel(state) {
  if (state?.ready) return Object.freeze({ text: "3/3 valmis", className: "ready" });
  if (state?.attention) return Object.freeze({ text: "3/3 tarkistettava", className: "attention" });
  return Object.freeze({ text: `${Number(state?.observedRuns || 0)}/${FIELD_TEST_REQUIRED_RUNS} kerätty`, className: "" });
}

export function fieldTestButtonLabel(state) {
  if (state?.ready) return "Aja lisävarmennusajo";
  if (state?.attention) return "Aja korvaava kenttäajo";
  return `Aja kenttäajo ${Math.min(Number(state?.observedRuns || 0) + 1, FIELD_TEST_REQUIRED_RUNS)}/${FIELD_TEST_REQUIRED_RUNS}`;
}

function render(historyResult, loadHistory) {
  ensureStyles();
  const root = ensureRoot();
  if (!root) return;
  root.replaceChildren();

  const selectedState = loadEngineState();
  let state = buildFieldTestState(historyResult, selectedState);
  const badgeState = fieldTestStatusLabel(state);

  const header = create("div", "field-test-header");
  header.append(create("strong", "", "Field Test Mode · ECU Survey 3×"), create("span", `field-test-status ${badgeState.className}`, badgeState.text));
  root.append(header);

  const meta = create("div", "field-test-meta");
  for (const [label, value] of [
    ["Build", state.buildSha || "–"],
    ["Moottori", state.engineState === "running" ? "käy" : "ei käy"],
    ["Saman ryhmän ajot", `${state.observedRuns}/${FIELD_TEST_REQUIRED_RUNS}`]
  ]) {
    const cell = create("div");
    cell.append(create("span", "", label), create("strong", "", value));
    meta.append(cell);
  }
  root.append(meta);

  const controls = create("div", "field-test-controls");
  const select = create("select");
  select.setAttribute("aria-label", "Kenttävalidoinnin moottorin tila");
  for (const [value, label] of [["running", "Moottori käy"], ["stopped", "Moottori ei käy"]]) {
    const option = create("option", "", label);
    option.value = value;
    option.selected = value === selectedState;
    select.append(option);
  }
  const run = create("button", "primary", fieldTestButtonLabel(state));
  run.type = "button";
  const message = create("p", "field-test-message", "");

  select.addEventListener("change", () => {
    saveEngineState(select.value);
    render(typeof loadHistory === "function" ? loadHistory() : historyResult, loadHistory);
  });

  run.addEventListener("click", () => {
    const currentHistory = typeof loadHistory === "function" ? loadHistory() : historyResult;
    state = buildFieldTestState(currentHistory, select.value);
    const diagnosticState = document.getElementById("diagnosticEngineState");
    const diagnosticButton = document.getElementById("runGekoTest");
    if (!diagnosticState || !diagnosticButton) {
      message.className = "field-test-message error";
      message.textContent = "Laajan diagnostiikan kontrollit eivät ole käytettävissä tässä näkymässä.";
      return;
    }
    if (diagnosticButton.disabled) {
      message.className = "field-test-message error";
      message.textContent = "Yhdistä adapteriin ensin; nykyinen laaja vLinker / ELM + Toyota -testi ei ole vielä käynnistettävissä.";
      return;
    }
    saveEngineState(select.value);
    diagnosticState.value = select.value;
    diagnosticState.dispatchEvent(new Event("change", { bubbles: true }));
    message.className = "field-test-message ok";
    message.textContent = `Käynnistetään nykyinen laaja testi kenttäajona ${Math.min(state.observedRuns + 1, FIELD_TEST_REQUIRED_RUNS)}/${FIELD_TEST_REQUIRED_RUNS} · moottori ${select.value === "running" ? "käy" : "ei käy"}.`;
    diagnosticButton.click();
    document.getElementById("diagnosticProgressText")?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  });

  controls.append(select, run);
  root.append(controls);
  root.append(create("p", "field-test-hint", "Pidä sama build ja sama moottorin tila kaikissa kolmessa ajossa. Field Test Mode käyttää olemassa olevaa laajaa vLinker / ELM + Toyota -testiä eikä lisää uusia ajoneuvokomentoja."), message);
}

export function installFieldTestUi({ loadHistory } = {}) {
  if (typeof document === "undefined" || typeof loadHistory !== "function") return false;
  const mount = () => render(loadHistory(), loadHistory);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else queueMicrotask(mount);
  document.addEventListener(EVENT_NAME, event => render(event?.detail?.historyResult || loadHistory(), loadHistory));
  return true;
}
