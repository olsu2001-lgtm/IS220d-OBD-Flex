import { IS220D_INJECTOR_SCREENING_PROBES, decodeToyotaReadDataResponse, isProfileReadOnlyCommand } from "./core.js";

// Explicit evidence collection only; never publishes into normal live values.
export async function readEngineComparison(client) {
  if (!client?.connected || client.binaryQuicklynks || client.vehicleKey !== "is220d") throw new Error("Vertailuluku tarvitsee IS220d-profiilin ja yhdistetyn ELM-lukijan");
  const probes = IS220D_INJECTOR_SCREENING_PROBES.filter(p => ["2193", "2196", "21AF"].includes(p.command) && isProfileReadOnlyCommand(p.command, "is220d"));
  const transaction = await client.runReadOnlyEcuTransaction({
    requestHeader: "7E0", responseHeader: "7E8", profileKey: "is220d",
    setupCommands: ["ATSP6", "ATCAF1", "ATCFC1", "ATAL", "ATH0", "ATS0"],
    restoreSetupCommands: ["ATCAF1", "ATCFC1", "ATH0", "ATS0"],
    requests: probes.map(p => ({ command: p.command, service: p.service, timeoutMs: 5000 })),
    continueOnReadError: true, label: "IS220d · Techstream-vertailulukemat"
  });
  return transaction.responses.map(response => {
    const probe = probes.find(p => p.command === response.command);
    const decoded = !response.error && decodeToyotaReadDataResponse(response.raw, probe.identifier, "is220d");
    return { command: probe.command, timestamp: transaction.endedAt, durationMs: response.durationMs,
      requestHeader: "7E0", responseHeader: "7E8", transactionId: transaction.transactionId,
      raw: response.raw, error: response.error, evidence: "techstream-derived; ajoneuvovarmennus puuttuu",
      fields: probe.fields.map(field => {
        const rawValue = decoded?.complete ? decoded.values?.[field.valueKey] : null;
        const value = rawValue == null ? null : Number(rawValue);
        const plausible = Number.isFinite(value) && value >= field.plausibleRange[0] && value <= field.plausibleRange[1];
        return { id: field.id, name: field.label, unit: field.unit, value: plausible ? value : null,
          plausibleRange: field.plausibleRange, decoder: probe.id,
          status: plausible ? "vertailtava Techstreamiin" : "ei kelvollista arvoa" };
      }) };
  });
}
