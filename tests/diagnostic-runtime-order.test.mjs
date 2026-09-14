import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/main.js", import.meta.url), "utf8");

function indexOfOrFail(needle) {
  const index = source.indexOf(needle);
  assert.notEqual(index, -1, `main.js must contain: ${needle}`);
  return index;
}

test("laaja ELM-diagnostiikka kokeilee nykyasetusten 0100:n ennen capability-probeja ja ATZ:aa", () => {
  const runStart = indexOfOrFail("async function runGekoDiagnostic()");
  const currentProbe = source.indexOf('phase: "Nykytila ennen nollausta"', runStart);
  const capabilityPhase = source.indexOf('await runFullDiagnosticSteps("Adapteri"', runStart);
  const reset = source.indexOf('label: "Kylmä ELM-nollaus"', runStart);

  assert.ok(currentProbe > runStart, "current-settings 0100 preflight must exist inside runGekoDiagnostic");
  assert.ok(capabilityPhase > currentProbe, "capability probes must run after current-settings 0100 preflight");
  assert.ok(reset > capabilityPhase, "ATZ fallback must remain after capability probes");
});

test("laaja ELM-raportti muodostaa ECU Survey -snapshotin jo kerätyistä diagnostiikkatuloksista", () => {
  assert.match(source, /import \{ ecuSurveySnapshotFromDiagnosticRun \} from "\.\/ecu-survey-diagnostic\.js";/);
  assert.match(source, /import \{ buildEcuSurveyTextReport \} from "\.\/ecu-survey-report\.js";/);
  assert.match(source, /run\.ecuSurvey = ecuSurveySnapshotFromDiagnosticRun\(run\);/);
});

test("valmis ECU Survey -snapshot tallennetaan kompaktiin paikallishistoriaan ja toistettavuus liitetään raporttiin", () => {
  assert.match(source, /import \{ recordEcuSurveySnapshot \} from "\.\/ecu-survey-history\.js";/);
  assert.match(source, /const surveyHistory = recordEcuSurveySnapshot\(run\.ecuSurvey\);/);
  assert.match(source, /run\.ecuSurveyHistory = \{/);
  assert.match(source, /buildEcuSurveyTextReport\(run\.ecuSurvey, surveyHistory\)/);
});

test("runtime-integraatio ei lisää erillistä survey-lähetysloopia main.js:ään", () => {
  assert.doesNotMatch(source, /runEcuSurvey|sendEcuSurvey|executeEcuSurvey/i);
  assert.match(source, /state\.diagnosticRun\.currentPhase = "ECU-osoitehaku";/);
  assert.match(source, /diagnosticModeStep\("0100", 0x00, `\$\{header\} tukibittikartta`, header, 7000\)/);
});


