export const IM_READINESS_BUILD_MARKER = "__IS220D_IM_READINESS_BUILD__";

const IMPORT_SOURCE = 'import { buildImReadinessSnapshot } from "./im-readiness.js";\nimport { publishImReadinessToDtcUi } from "./im-readiness-ui.js";';
const WIDE_ANCHOR = 'diagnosticModeStep("0101", 0x01, "MIL ja päästömonitorien tila", bestHeader, 6000),';
const WIDE_INSERTION = `${WIDE_ANCHOR}\n      diagnosticModeStep("0141", 0x41, "I/M readiness · tämä ajosykli", bestHeader, 6000),\n      diagnosticModeStep("0130", 0x30, "Lämmityskerrat DTC-poiston jälkeen", bestHeader, 6000),\n      diagnosticModeStep("0131", 0x31, "Matka DTC-poiston jälkeen", bestHeader, 6000),`;
const DTC_READ_ANCHOR = 'const milRaw = await safeCommand("0101");';
const DTC_READ_INSERTION = `${DTC_READ_ANCHOR}\n    const readinessDriveCycleRaw = await safeCommand("0141");\n    const readinessWarmupsRaw = await safeCommand("0130");\n    const readinessDistanceRaw = await safeCommand("0131");\n    const imReadinessSnapshot = buildImReadinessSnapshot({\n      sinceClearRaw: milRaw || "",\n      driveCycleRaw: readinessDriveCycleRaw || "",\n      warmupsRaw: readinessWarmupsRaw || "",\n      distanceRaw: readinessDistanceRaw || ""\n    });`;
const DTC_PUBLISH_ANCHOR = '$("#milCount").textContent = mil ? String(mil.count) : "–";';
const DTC_PUBLISH_INSERTION = `${DTC_PUBLISH_ANCHOR}\n    publishImReadinessToDtcUi(imReadinessSnapshot);`;
const MARKER_SOURCE = `globalThis.${IM_READINESS_BUILD_MARKER}="v1";`;

function replaceExactlyOnce(text, anchor, replacement, label) {
  const occurrences = text.split(anchor).length - 1;
  if (occurrences !== 1) throw new Error(`I/M readiness main transform expected exactly one ${label} anchor, got ${occurrences}`);
  return text.replace(anchor, replacement);
}

export function patchMainForImReadiness(source) {
  let text = String(source || "");
  if (!text.includes('from "./im-readiness-ui.js"')) text = `${IMPORT_SOURCE}\n${text}`;
  if (!text.includes('diagnosticModeStep("0141", 0x41, "I/M readiness · tämä ajosykli"')) {
    text = replaceExactlyOnce(text, WIDE_ANCHOR, WIDE_INSERTION, "wide 0101");
  }
  if (!text.includes('const readinessDriveCycleRaw = await safeCommand("0141");')) {
    text = replaceExactlyOnce(text, DTC_READ_ANCHOR, DTC_READ_INSERTION, "DTC 0101");
  }
  if (!text.includes("publishImReadinessToDtcUi(imReadinessSnapshot);")) {
    text = replaceExactlyOnce(text, DTC_PUBLISH_ANCHOR, DTC_PUBLISH_INSERTION, "DTC publish");
  }
  if (!text.includes(IM_READINESS_BUILD_MARKER)) text = `${MARKER_SOURCE}\n${text}`;
  return text;
}
