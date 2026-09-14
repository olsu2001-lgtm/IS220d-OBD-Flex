const clean = value => String(value ?? "").replace(/[\r\n\t]+/g, " ").trim();

export function buildTechstreamReferenceTextReport(comparison) {
  if (!comparison?.loaded) return "TECHSTREAM REFERENCE\nStatus: not-loaded\n";
  const reference = comparison.reference || {};
  const lines = [
    "TECHSTREAM REFERENCE",
    `Status: ${clean(comparison.status) || "manual-review"}`,
    `Reference ID: ${clean(reference.referenceId) || "not-set"}`,
    `Captured at: ${clean(reference.capturedAt) || "not-set"}`,
    `Systems: ${Number(comparison.systemCount || 0)}`,
    `DTCs: ${Number(comparison.dtcCount || 0)}`,
    `Systems with DTCs: ${Number(comparison.systemsWithDtcs || 0)}`,
    `Verified mappings observed: ${Number(comparison.verifiedObserved || 0)}/${Number(comparison.verifiedMappings || 0)}`,
    `Candidate mappings: ${Number(comparison.candidateMappings || 0)}`,
    `Verified mapping discrepancies: ${Number(comparison.verifiedDiscrepancies || 0)}`,
    "",
    "Systems:"
  ];

  for (const system of reference.systems || []) {
    const dtcs = (system?.dtcs || []).join(",") || "none";
    lines.push(`- ${clean(system?.name) || "unnamed"} | dtc=${dtcs}${system?.note ? ` | note=${clean(system.note)}` : ""}`);
  }
  if (!(reference.systems || []).length) lines.push("- none");

  lines.push("", "Explicit CAN mappings:");
  for (const mapping of comparison.mappings || []) {
    lines.push(
      `- ${clean(mapping?.requestHeader)}>${clean(mapping?.responseHeader)} | ` +
      `system=${clean(mapping?.systemName)} | evidence=${clean(mapping?.evidenceLevel)} | status=${clean(mapping?.status)} | ` +
      `observed=${(mapping?.observedResponseHeaders || []).join(",") || "none"} | note=${clean(mapping?.evidenceNote)}`
    );
  }
  if (!(comparison.mappings || []).length) lines.push("- none; no CAN mapping is inferred from Techstream system names");

  if ((comparison.unmappedFlexResponders || []).length) {
    lines.push("", "Flex responders without explicit Techstream mapping:");
    for (const item of comparison.unmappedFlexResponders) {
      lines.push(`- ${clean(item?.requestHeader)}>${(item?.responseHeaders || []).join(",") || "?"}${item?.knownEcuId ? ` | known=${clean(item.knownEcuId)}` : ""}`);
    }
  }

  if ((comparison.unmappedTechstreamSystems || []).length) {
    lines.push("", `Techstream systems without explicit CAN mapping: ${comparison.unmappedTechstreamSystems.length}`);
  }

  lines.push(
    "",
    "Interpretation boundary:",
    "- This is a user-authored neutral reference, not a parser for Techstream proprietary files.",
    "- System names never create CAN mappings automatically.",
    "- candidate mappings remain hypotheses; verified mappings require an explicit evidence note.",
    "- A mapping discrepancy is an evidence-review flag, not an automatic ECU fault verdict.",
    "- Manual Techstream/vehicle review remains required before a new ECU identity is promoted into the vehicle profile."
  );
  return `${lines.join("\n")}\n`;
}


