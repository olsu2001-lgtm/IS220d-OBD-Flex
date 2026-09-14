import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  IS220D_DIAGNOSTIC_PROFILE,
  IS220D_ENGINE_ECU_PROFILE,
  TOYOTA_READ_DATA_PROBES,
  IS220D_INJECTOR_SCREENING_PROBES,
  TOYOTA_READ_DATA_ALLOWED_COMMANDS,
  validateDiagnosticProfile,
  getToyotaReadDataProbe,
  isProfileReadOnlyCommand,
  buildProfileProbeCommand
} from "../src/is220d-profile.js";
import {
  parseDiagnosticNegativeResponse,
  classifyDiagnosticResponse,
  diagnosticNrcDefinition
} from "../src/diagnostic-response.js";
import {
  ReplayElmTransport,
  ReplayTransportError,
  replayScenarioFromFixture
} from "../src/replay-transport.js";
import {
  Elm327Client,
  decodeToyotaReadDataResponse,
  evaluateFullDiagnosticStep
} from "../src/core.js";

const fixturePath = fileURLToPath(new URL("../fixtures/is220d-elm-replay-v1.json", import.meta.url));
const fixture = JSON.parse(await fs.readFile(fixturePath, "utf8"));

test("IS220d-profiili validoituu ja on syväjäädytetty vain luku -määrittely", () => {
  const validation = validateDiagnosticProfile(IS220D_DIAGNOSTIC_PROFILE);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
  assert.equal(IS220D_DIAGNOSTIC_PROFILE.profileVersion, "is220d-xe20-2ad-fhv-readonly-v1");
  assert.equal(IS220D_DIAGNOSTIC_PROFILE.writable, false);
  assert.equal(IS220D_ENGINE_ECU_PROFILE.requestHeader, "7E0");
  assert.equal(IS220D_ENGINE_ECU_PROFILE.responseHeader, "7E8");
  assert.equal(Object.isFrozen(IS220D_DIAGNOSTIC_PROFILE), true);
  assert.equal(Object.isFrozen(TOYOTA_READ_DATA_PROBES[0].fields), true);
});

test("profiilivalidaattori estää kirjoittavan tai vääränmuotoisen määrittelyn", () => {
  const invalid = structuredClone(IS220D_DIAGNOSTIC_PROFILE);
  invalid.writable = true;
  invalid.ecus.engine.probes[0].command = "2E7E";
  invalid.ecus.engine.probes[0].writable = true;
  invalid.ecus.engine.probes[0].fields[0].plausibleRange = [100, -100];
  const validation = validateDiagnosticProfile(invalid);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /vain luku/);
  assert.match(validation.errors.join("\n"), /odotettiin 217E/);
  assert.match(validation.errors.join("\n"), /virheellinen min\/max-alue/);
});

test("profiili johtaa tuotantoluvut ja erillisen vain lukevan suutintestiryhmän", () => {
  assert.deepEqual(TOYOTA_READ_DATA_PROBES.map(probe => probe.command), ["217E", "217F", "212C"]);
  assert.deepEqual(IS220D_INJECTOR_SCREENING_PROBES.map(probe => probe.command), ["2193", "2196", "219C", "21AF"]);
  assert.deepEqual(TOYOTA_READ_DATA_ALLOWED_COMMANDS.slice(0, 6), [
    "217E", "02217E0000000000",
    "217F", "02217F0000000000",
    "212C", "02212C0000000000"
  ]);
  assert.equal(TOYOTA_READ_DATA_ALLOWED_COMMANDS.includes("219C"), false);
  assert.equal(TOYOTA_READ_DATA_ALLOWED_COMMANDS.includes("02219C0000000000"), false);
  assert.equal(getToyotaReadDataProbe("21 7E")?.id, "engine.dpnr_status");
  assert.equal(getToyotaReadDataProbe(0x2c)?.command, "212C");
  assert.equal(getToyotaReadDataProbe(0x9c)?.command, "219C");
  assert.equal(buildProfileProbeCommand(getToyotaReadDataProbe("217F"), "raw-single-frame"), "02217F0000000000");
  assert.equal(isProfileReadOnlyCommand("217E"), true);
  assert.equal(isProfileReadOnlyCommand("219C"), false);
  assert.throws(() => buildProfileProbeCommand(getToyotaReadDataProbe("219C")), /turvallisuussallintalista/);
  assert.equal(isProfileReadOnlyCommand("2192"), false);
});

test("yleinen NRC-parseri erottaa palvelun, luokan ja uudelleenyrityksen", () => {
  const unsupported = parseDiagnosticNegativeResponse("7E8 03 7F 21 12\r>", 0x21);
  assert.equal(unsupported.serviceHex, "21");
  assert.equal(unsupported.code, "12");
  assert.equal(unsupported.category, "subfunction-not-supported");
  assert.equal(unsupported.retryable, false);

  const pending = parseDiagnosticNegativeResponse("7E8 03 7F 22 78\r>", 0x22);
  assert.equal(pending.responsePending, true);
  assert.equal(pending.retryable, true);
  assert.equal(classifyDiagnosticResponse({ raw: "7E8 03 7F 22 78\r>", expectedService: 0x22 }).kind, "response-pending");
  assert.equal(diagnosticNrcDefinition("33")?.category, "security-access-denied");
});

test("ELM-häiriöt luokitellaan erilleen ECU:n kielteisistä vastauksista", () => {
  assert.equal(classifyDiagnosticResponse({ raw: "NO DATA\r>" }).kind, "no-data");
  assert.equal(classifyDiagnosticResponse({ raw: "CAN ERROR\r>" }).kind, "can-error");
  assert.equal(classifyDiagnosticResponse({ error: "Aikakatkaisu 5000 ms" }).kind, "timeout");
  assert.equal(classifyDiagnosticResponse({ error: "Bluetooth-yhteys katkesi" }).kind, "disconnected");
});

test("vajaa positiivinen Toyota-monikehys ei kelpaa mittausarvoksi", () => {
  const raw = "7E8 10 0A 61 7E 0A 04 02\r7E8 21 00\r>";
  const decoded = decodeToyotaReadDataResponse(raw, 0x7e);
  assert.equal(decoded.complete, false);
  const evaluation = evaluateFullDiagnosticStep(
    { command: "217E", expected: "toyotaReadData", requestService: 0x21, toyotaIdentifier: 0x7e },
    raw
  );
  assert.equal(evaluation.validResponse, false);
  assert.equal(evaluation.status, "WARN");
  assert.equal(evaluation.responseClass, "truncated-positive-response");
});

test("replay-kuljetus toistaa Toyota happy pathin ja säilyttää järjestyksen", async () => {
  const scenario = replayScenarioFromFixture(fixture, "toyota_happy_path");
  const transport = new ReplayElmTransport(scenario.script, { wait: async () => {} });
  await transport.connect();
  const client = new Elm327Client(transport, () => {}, () => {}, { wait: async () => {} });

  for (const probe of TOYOTA_READ_DATA_PROBES) {
    const transaction = await client.runReadOnlyEcuTransaction({
      requestHeader: probe.requestHeader,
      requests: [{ command: probe.command, service: probe.service, timeoutMs: 5000 }],
      clearResponseFilter: false,
      label: probe.id
    });
    const decoded = decodeToyotaReadDataResponse(transaction.responses[0].raw, probe.identifier);
    assert.equal(decoded.complete, true);
  }
  const snapshot = transport.snapshot();
  assert.equal(snapshot.complete, true);
  assert.deepEqual(snapshot.history.map(event => event.command), scenario.script.map(step => step.command));
});

test("atominen ECU-transaktio ei päästä rinnakkaista PID-lukua otsakkeen ja pyynnön väliin", async () => {
  const commands = [];
  const traffic = [];
  const transport = {
    async send(command) {
      commands.push(command);
      if (command.startsWith("AT")) return "OK\r>";
      if (command === "217E") return "7E8 06 61 7E 0A 04 02 00\r>";
      if (command === "010C") return "7E8 04 41 0C 0C 80\r>";
      return "NO DATA\r>";
    },
    async disconnect() {}
  };
  const client = new Elm327Client(transport, event => traffic.push(event), () => {}, { wait: async () => {} });
  const profileRead = client.runReadOnlyEcuTransaction({
    requestHeader: "7E0",
    requests: [{ command: "217E", service: 0x21 }]
  });
  const ordinaryRead = client.command("010C");
  const [transaction] = await Promise.all([profileRead, ordinaryRead]);
  assert.deepEqual(commands, ["ATCRA", "ATSH7E0", "217E", "010C"]);
  assert.equal(transaction.responses[0].transactionId, transaction.transactionId);
  const transactionTraffic = traffic.filter(event => event.transactionId === transaction.transactionId);
  assert.deepEqual(transactionTraffic.filter(event => event.direction === "tx").map(event => event.command), ["ATCRA", "ATSH7E0", "217E"]);
});

test("ECU-transaktion estää kirjoituskomennot ennen kuljetusta", async () => {
  const sent = [];
  const client = new Elm327Client({
    async send(command) { sent.push(command); return "OK\r>"; },
    async disconnect() {}
  });
  assert.throws(() => client.runReadOnlyEcuTransaction({ requestHeader: "7E0", requests: [{ command: "2F01" }] }), /turvallisuussallintalista/);
  assert.throws(() => client.runReadOnlyEcuTransaction({ requestHeader: "7E0", setupCommands: ["ATZ"], requests: [{ command: "217E" }] }), /asetuskomennon ATZ/);
  assert.deepEqual(sent, []);
});

test("continueOnReadError kerää NO DATA -tuloksen ja jatkaa seuraavaan varmennettuun pyyntöön", async () => {
  const transport = {
    async send(command) {
      if (command.startsWith("AT")) return "OK\r>";
      if (command === "217E") return "NO DATA\r>";
      if (command === "217F") return "7E8 06 61 7F 01 00 02 00\r>";
      return "NO DATA\r>";
    },
    async disconnect() {}
  };
  const client = new Elm327Client(transport, () => {}, () => {}, { wait: async () => {} });
  const transaction = await client.runReadOnlyEcuTransaction({
    requestHeader: "7E0",
    requests: [
      { command: "217E", service: 0x21 },
      { command: "217F", service: 0x21 }
    ],
    continueOnReadError: true
  });
  assert.equal(transaction.responses[0].responseClass, "no-data");
  assert.match(transaction.responses[0].error, /ei palauttanut tietoa/i);
  assert.equal(transaction.responses[1].responseClass, "unclassified-response");
  assert.equal(decodeToyotaReadDataResponse(transaction.responses[1].raw, 0x7f).complete, true);
});

test("replay-aikakatkaisu palauttaa osittaisen raakavastauksen eikä uusi komentoa", async () => {
  const scenario = replayScenarioFromFixture(fixture, "slow_timeout");
  const transport = new ReplayElmTransport(scenario.script, { wait: async () => {} });
  await transport.connect();
  const client = new Elm327Client(transport, () => {}, () => {}, { wait: async () => {} });
  await assert.rejects(
    client.runReadOnlyEcuTransaction({
      requestHeader: "7E0",
      requests: [{ command: "217E", service: 0x21, timeoutMs: 5000 }],
      clearResponseFilter: false
    }),
    error => {
      assert.equal(error instanceof ReplayTransportError, true);
      assert.equal(error.code, "REPLAY_TIMEOUT");
      assert.match(error.partialRaw, /61 7E/);
      return true;
    }
  );
  assert.deepEqual(transport.snapshot().history.map(event => event.command), ["ATSH7E0", "217E"]);
});

test("ELM327-emulaattoriskenaario pysyy vain luku -rajassa", async () => {
  const scenarioPath = fileURLToPath(new URL("../tools/elm327-emulator/is220d_flex_readonly.py", import.meta.url));
  const source = await fs.readFile(scenarioPath, "utf8");
  assert.match(source, /217E/);
  assert.match(source, /217F/);
  assert.match(source, /212C/);
  assert.doesNotMatch(source, /(?:Request|command).*(?:04|2E|2F|31|34|36)/i);
  assert.match(source, /no write, clear, active-test/i);
});
