export const RESPONSIVE_UI_BUILD_MARKER = "__IS220D_RESPONSIVE_UI_V1__";

const APP_VERSION_ANCHOR = /^const APP_VERSION = "\d+\.\d+\.\d+";$/gm;
const APPEND_TERMINAL = `function appendTerminal(text) {
  state.terminalEntries.push(text);
  if (state.terminalEntries.length > 600) state.terminalEntries.splice(0, state.terminalEntries.length - 600);
  const terminal = $("#terminalLog");
  terminal.textContent = state.terminalEntries.join("\\n");
  terminal.scrollTop = terminal.scrollHeight;
}`;
const APPEND_ELM_DIAGNOSTIC = `function appendElmDiagnosticLine(line) {
  state.elmDiagnosticLines.push(String(line));
  if (state.elmDiagnosticLines.length > 500) state.elmDiagnosticLines.splice(0, state.elmDiagnosticLines.length - 500);
  renderElmDiagnostics();
}`;
const RUN_DIAGNOSTIC_STEPS = `async function runFullDiagnosticSteps(phase, steps, options = {}) {
  state.diagnosticRun.currentPhase = phase;
  for (const step of steps) {
    await executeFullDiagnosticStep({ phase, ...step }, options);
    if (step.pauseAfterMs) await delay(step.pauseAfterMs);
  }
}`;

const HELPERS = `
globalThis.${RESPONSIVE_UI_BUILD_MARKER} = true;
let terminalRenderTimer = 0;
let elmDiagnosticRenderTimer = 0;

function scheduleTerminalRender() {
  if (terminalRenderTimer) return;
  terminalRenderTimer = setTimeout(() => {
    terminalRenderTimer = 0;
    const terminal = $("#terminalLog");
    if (!terminal) return;
    terminal.textContent = state.terminalEntries.join("\\n");
    terminal.scrollTop = terminal.scrollHeight;
  }, 80);
}

function scheduleElmDiagnosticRender() {
  if (elmDiagnosticRenderTimer) return;
  elmDiagnosticRenderTimer = setTimeout(() => {
    elmDiagnosticRenderTimer = 0;
    renderElmDiagnostics();
  }, 80);
}

function yieldUiTurn() {
  return new Promise(resolve => setTimeout(resolve, 0));
}
`;

function count(source, needle) {
  return source.split(needle).length - 1;
}

export function patchMainForResponsiveness(source) {
  const input = String(source || "");
  if (input.includes(RESPONSIVE_UI_BUILD_MARKER)) return input;
  if ((input.match(APP_VERSION_ANCHOR) || []).length !== 1) throw new Error("Responsive UI transform: APP_VERSION anchor missing or ambiguous");
  if (count(input, APPEND_TERMINAL) !== 1) throw new Error("Responsive UI transform: appendTerminal shape changed");
  if (count(input, APPEND_ELM_DIAGNOSTIC) !== 1) throw new Error("Responsive UI transform: appendElmDiagnosticLine shape changed");
  if (count(input, RUN_DIAGNOSTIC_STEPS) !== 1) throw new Error("Responsive UI transform: runFullDiagnosticSteps shape changed");

  return input
    .replace(APP_VERSION_ANCHOR, anchor => `${anchor}${HELPERS}`)
    .replace(APPEND_TERMINAL, `function appendTerminal(text) {
  state.terminalEntries.push(text);
  if (state.terminalEntries.length > 600) state.terminalEntries.splice(0, state.terminalEntries.length - 600);
  scheduleTerminalRender();
}`)
    .replace(APPEND_ELM_DIAGNOSTIC, `function appendElmDiagnosticLine(line) {
  state.elmDiagnosticLines.push(String(line));
  if (state.elmDiagnosticLines.length > 500) state.elmDiagnosticLines.splice(0, state.elmDiagnosticLines.length - 500);
  scheduleElmDiagnosticRender();
}`)
    .replace(RUN_DIAGNOSTIC_STEPS, `async function runFullDiagnosticSteps(phase, steps, options = {}) {
  state.diagnosticRun.currentPhase = phase;
  for (const step of steps) {
    await executeFullDiagnosticStep({ phase, ...step }, options);
    if (step.pauseAfterMs) await delay(step.pauseAfterMs);
    await yieldUiTurn();
  }
}`);
}
