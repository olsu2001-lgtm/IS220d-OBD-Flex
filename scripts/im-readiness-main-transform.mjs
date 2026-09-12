const ANCHOR = 'diagnosticModeStep("0101", 0x01, "MIL ja päästömonitorien tila", bestHeader, 6000),';
const INSERTION = `${ANCHOR}\n      diagnosticModeStep("0141", 0x41, "I/M readiness · tämä ajosykli", bestHeader, 6000),\n      diagnosticModeStep("0130", 0x30, "Lämmityskerrat DTC-poiston jälkeen", bestHeader, 6000),\n      diagnosticModeStep("0131", 0x31, "Matka DTC-poiston jälkeen", bestHeader, 6000),`;

export function patchMainForImReadiness(source) {
  const text = String(source || "");
  if (text.includes('diagnosticModeStep("0141", 0x41, "I/M readiness · tämä ajosykli"')) return text;
  const occurrences = text.split(ANCHOR).length - 1;
  if (occurrences !== 1) throw new Error(`I/M readiness main transform expected exactly one 0101 anchor, got ${occurrences}`);
  return text.replace(ANCHOR, INSERTION);
}
