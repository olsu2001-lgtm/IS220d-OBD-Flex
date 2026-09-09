import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  CT200H_DIAGNOSTIC_PROFILE,
  CT200H_READ_DATA_PROBES,
  CT200H_LIVE_DATA_PROBES,
  CT200H_DTC_REQUESTS,
  CT200H_READ_ONLY_ALLOWED_COMMANDS,
  getCt200hReadDataProbe,
  validateCt200hDiagnosticProfile
} from "../src/ct200h-profile.js";
import {
  CT200H_LIVE_METRIC_IDS,
  Elm327Client,
  PID_BY_ID,
  ReplayElmTransport,
  decodeToyotaReadDataResponse,
  parseCountedDtcResponse,
  replayScenarioFromFixture,
  summarizeFullDiagnostic
} from "../src/core.js";
import { buildAdaptivePollPlan } from "../src/poll-scheduler.js";

const fixturePath = fileURLToPath(new URL("../fixtures/ct200h-zwa10-elm-replay-v1.json", import.meta.url));
const fixture = JSON.parse(await fs.readFile(fixturePath, "utf8"));

const RESPONSE_21C1 = "7EA 10 12 61 C1 5A 57 41 31\r7EA 21 30 20 20 32 5A 52 46\r7EA 22 58 45 00 00 45 00 00\r>";
const RESPONSE_2101 = "7EA 10 18 61 01 00 00 00 00\r7EA 21 00 00 00 00 00 00 00\r7EA 22 00 00 00 00 00 00 00\r7EA 23 00 00 00 99 00 00 00\r>";
const RESPONSE_2181 = "7EA 10 1E 61 81 2E 16 2E 26\r7EA 21 2E 1E 2E 2E 2E 37 2E\r7EA 22 3F 2E 47 2E 4F 2E 57\r7EA 23 2E 60 2E 68 2E 70 2E\r7EA 24 78 2E 80 00 00 00 00\r>";
const RESPONSE_2187 = "7EA 10 0A 61 87 4B 07 50 08\r7EA 21 51 08 52 08 00 00 00\r>";
const RESPONSE_2195 = "7EA 10 10 61 95 19 1A 1B 1C\r7EA 21 1D 1E 1F 20 21 22 23\r7EA 22 24 25 26 00 00 00 00\r>";
const RESPONSE_2198 = "7EA 10 0A 61 98 89 C4 58 D0\r7EA 21 04 78 80 70 00 00 00\r>";

test("CT 200h -profiili validoituu, lukitsee 14/28-rakenteen ja sisältää vain lukuja", () => {
  const validation = validateCt200hDiagnosticProfile(CT200H_DIAGNOSTIC_PROFILE);
  assert.deepEqual(validation, { valid: true, errors: [] });
  assert.equal(CT200H_DIAGNOSTIC_PROFILE.profileVersion, "ct200h-zwa10-gen3-hybrid-readonly-v2");
  assert.equal(CT200H_DIAGNOSTIC_PROFILE.battery.blockCount, 14);
  assert.equal(CT200H_DIAGNOSTIC_PROFILE.battery.moduleCount, 28);
  assert.equal(CT200H_DIAGNOSTIC_PROFILE.writable, false);
  assert.equal(Object.isFrozen(CT200H_DIAGNOSTIC_PROFILE), true);
  assert.equal(Object.isFrozen(CT200H_DIAGNOSTIC_PROFILE.ecus.hybrid.probes[0].fields), true);
  assert.deepEqual(CT200H_READ_DATA_PROBES.map(probe => probe.command), ["21C1", "2101", "2181", "2187", "2195", "2198"]);
  assert.deepEqual(CT200H_DTC_REQUESTS.map(request => request.command), ["0A", "13B0", "13B0"]);
  assert.deepEqual(CT200H_DTC_REQUESTS.map(request => request.requestHeader), ["7E2", "7E2", "7B0"]);
  assert.equal(CT200H_DTC_REQUESTS.at(-1).evidence, "research-candidate");
  assert.equal(CT200H_DTC_REQUESTS.at(-1).validatedOnCt200h, false);
  assert.equal(CT200H_LIVE_DATA_PROBES.length, 5);
  assert.equal(CT200H_LIVE_METRIC_IDS.length, 52);
  assert.equal(getCt200hReadDataProbe("21 81")?.id, "hybrid.block_voltages");
  assert.equal(CT200H_READ_ONLY_ALLOWED_COMMANDS.includes("04"), false);
  assert.equal(CT200H_READ_ONLY_ALLOWED_COMMANDS.some(command => /^(?:2E|2F|31)/.test(command)), false);
});

test("CT-profiilivalidaattori torjuu kirjoittavan pyynnön ja väärän akkurakenteen", () => {
  const invalid = structuredClone(CT200H_DIAGNOSTIC_PROFILE);
  invalid.writable = true;
  invalid.battery.blockCount = 15;
  invalid.ecus.hybrid.probes[0].service = 0x2e;
  invalid.ecus.hybrid.probes[0].command = "2E01";
  const validation = validateCt200hDiagnosticProfile(invalid);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /vain luku/);
  assert.match(validation.errors.join("\n"), /14 lohkoa ja 28 moduulia/);
  assert.match(validation.errors.join("\n"), /sallintalistaan/);
});

test("ZWA10-tunnistus ja kaikki julkaistut hybridipaketit purkautuvat", () => {
  const identity = decodeToyotaReadDataResponse(RESPONSE_21C1, 0xc1, "ct200h");
  assert.equal(identity.complete, true);
  assert.equal(identity.values.modelCode, "ZWA10");
  assert.equal(identity.values.engineCode, "2ZRFXE");
  assert.equal(identity.values.zwa10Confirmed, true);

  const soc = decodeToyotaReadDataResponse(RESPONSE_2101, 0x01, "ct200h");
  assert.equal(soc.complete, true);
  assert.ok(Math.abs(soc.values.stateOfChargePercent - 60) < 1e-9);

  const blocks = decodeToyotaReadDataResponse(RESPONSE_2181, 0x81, "ct200h");
  assert.equal(blocks.complete, true);
  assert.equal(Object.keys(blocks.values).filter(key => /^blockVoltage\d{2}V$/.test(key)).length, 14);
  assert.ok(Math.abs(blocks.values.blockVoltage01V - 14.4) < 0.01);
  assert.ok(Math.abs(blocks.values.blockVoltage14V - 14.53) < 0.01);
  assert.equal(blocks.values.blockMinimumIndex, 1);
  assert.equal(blocks.values.blockMaximumIndex, 14);
  assert.ok(blocks.values.blockDeltaV > 0.12 && blocks.values.blockDeltaV < 0.14);
  assert.ok(blocks.values.packVoltageV > 202 && blocks.values.packVoltageV < 203);

  const temperatures = decodeToyotaReadDataResponse(RESPONSE_2187, 0x87, "ct200h");
  assert.equal(temperatures.complete, true);
  assert.ok(Math.abs(temperatures.values.intakeTemperatureC - 25) < 0.1);
  assert.ok(Math.abs(temperatures.values.temperature1C - 30) < 0.1);
  assert.ok(Math.abs(temperatures.values.temperature3C - 32) < 0.1);
  assert.ok(Math.abs(temperatures.values.temperatureDeltaC - 2) < 0.1);

  const resistance = decodeToyotaReadDataResponse(RESPONSE_2195, 0x95, "ct200h");
  assert.equal(resistance.complete, true);
  assert.equal(resistance.values.internalResistance01Ohm, 0.025);
  assert.equal(resistance.values.internalResistance14Ohm, 0.038);
  assert.ok(Math.abs(resistance.values.internalResistanceDeltaOhm - 0.013) < 1e-12);

  const limits = decodeToyotaReadDataResponse(RESPONSE_2198, 0x98, "ct200h");
  assert.equal(limits.complete, true);
  assert.ok(Math.abs(limits.values.batteryCurrentA - 25) < 1e-9);
  assert.equal(limits.values.chargeControlKw, -20);
  assert.equal(limits.values.dischargeControlKw, 40);
  assert.equal(limits.values.deltaSocPercent, 2);
  assert.equal(limits.values.socAfterIgnitionPercent, 60);
  assert.equal(limits.values.socMaximumPercent, 64);
  assert.equal(limits.values.socMinimumPercent, 56);
});

test("katkennut tai väärässä järjestyksessä tullut 2181-monikehys ei kelpaa mittausarvoksi", () => {
  const truncated = decodeToyotaReadDataResponse(
    "7EA 10 1E 61 81 2E 16 2E 26\r7EA 21 2E 1E 2E\r>",
    0x81,
    "ct200h"
  );
  assert.equal(truncated.complete, false);
  assert.equal(truncated.transportComplete, false);

  const wrongSequence = decodeToyotaReadDataResponse(
    RESPONSE_2181.replace("7EA 22 3F", "7EA 23 3F"),
    0x81,
    "ct200h"
  );
  assert.equal(wrongSequence.complete, false);
  assert.equal(wrongSequence.sequenceError, true);
});

test("CT-livedatan tunnistus löytää 52 mittaria ja palauttaa 7E0-otsakkeen", async () => {
  const scenario = replayScenarioFromFixture(fixture, "hybrid_live_happy_path");
  const transport = new ReplayElmTransport(scenario.script, { wait: async () => {}, name: "vLinker MC+ replay" });
  await transport.connect();
  const client = new Elm327Client(transport, () => {}, () => {}, { wait: async () => {}, vehicleKey: "ct200h" });
  const discovered = await client.discoverToyotaLiveMetrics();
  assert.equal(discovered.size, 52);
  assert.equal(discovered.has("ctHvBlockVoltage01"), true);
  assert.equal(discovered.has("ctHvInternalResistance14"), true);
  assert.equal(discovered.has("ctHvCurrent"), true);
  const snapshot = transport.snapshot();
  assert.equal(snapshot.complete, true);
  assert.deepEqual(snapshot.history.map(event => event.command), scenario.script.map(step => step.command));
  assert.equal(snapshot.history.at(-1).command, "ATSH7E0");
});

test("CT-hybridin DTC-luku käyttää vain 0A/13B0-pyyntöjä, 7EA-suodatinta ja palauttaa otsakkeen", async () => {
  const scenario = replayScenarioFromFixture(fixture, "hybrid_dtc_happy_path");
  const transport = new ReplayElmTransport(scenario.script, { wait: async () => {} });
  await transport.connect();
  const client = new Elm327Client(transport, () => {}, () => {}, { wait: async () => {}, vehicleKey: "ct200h" });
  const result = await client.readVehicleSpecificDtcs();
  assert.deepEqual(result.groups.map(group => group.command), ["0A", "13B0"]);
  assert.deepEqual(result.groups[0].codes.map(code => code.code), ["P0A80"]);
  assert.deepEqual(result.groups[1].codes.map(code => code.code), ["P3000", "P0A80"]);
  assert.match(result.groups[0].codes[0].description, /Vaihda hybridiakun/);
  assert.equal(result.notes.length, 0);
  assert.deepEqual(transport.snapshot().history.map(event => event.command), scenario.script.map(step => step.command));
  assert.equal(transport.snapshot().history.at(-1).command, "ATSH7E0");
});

test("counted-DTC-parseri ei lue ilmoitetun määrän tai saatavilla olevan datan yli", () => {
  assert.deepEqual(parseCountedDtcResponse("7EA 06 53 03 0A 80\r>", 0x53).map(item => item.code), ["P0A80"]);
  assert.deepEqual(parseCountedDtcResponse("7EA 02 53 00\r>", 0x53), []);
  assert.deepEqual(parseCountedDtcResponse("NO DATA\r>", 0x53), []);
});

test("2181-pollaus yhdistää useat lohkomittarit yhdeksi fyysiseksi pyynnöksi", async () => {
  const definitions = [
    PID_BY_ID.ctHvBlockVoltage01,
    PID_BY_ID.ctHvBlockVoltage14,
    PID_BY_ID.ctHvBlockMin,
    PID_BY_ID.ctHvBlockMax,
    PID_BY_ID.ctHvBlockDelta
  ];
  const plan = buildAdaptivePollPlan(definitions, new Set(definitions.map(definition => definition.id)));
  assert.equal(plan.length, 1);
  assert.equal(plan[0].key, "toyota:2181");
  assert.equal(plan[0].metricIds.length, 5);

  const commands = [];
  const client = new Elm327Client({
    async send(command) {
      commands.push(command);
      if (command.startsWith("AT")) return "OK\r>";
      if (command === "2181") return RESPONSE_2181;
      return "NO DATA\r>";
    },
    async disconnect() {}
  }, () => {}, () => {}, { wait: async () => {}, vehicleKey: "ct200h" });
  client.toyotaLiveMetricIds = new Set(definitions.map(definition => definition.id));
  const group = await client.readMetricGroup(definitions, 5000);
  assert.equal(group.results.length, 5);
  assert.deepEqual(commands, ["ATCRA", "ATSH7E2", "2181", "ATSH7E0"]);
});

test("CT-profiilin järkevyysraja estää nollaksi vioittuneen lohkojännitteen", async () => {
  const zeroPayload = "7EA 10 1E 61 81 00 00 00 00\r7EA 21 00 00 00 00 00 00 00\r7EA 22 00 00 00 00 00 00 00\r7EA 23 00 00 00 00 00 00 00\r7EA 24 00 00 00 00 00 00 00\r>";
  const client = new Elm327Client({
    async send(command) {
      if (command.startsWith("AT")) return "OK\r>";
      if (command === "2181") return zeroPayload;
      return "NO DATA\r>";
    },
    async disconnect() {}
  }, () => {}, () => {}, { wait: async () => {}, vehicleKey: "ct200h" });
  client.toyotaLiveMetricIds = new Set(["ctHvBlockVoltage01"]);
  await assert.rejects(
    client.readMetricGroup([PID_BY_ID.ctHvBlockVoltage01], 5000),
    error => {
      assert.equal(error.code, "IMPLAUSIBLE_VALUE");
      assert.equal(error.metricId, "ctHvBlockVoltage01");
      assert.match(error.message, /10…20 ulkopuolella/);
      assert.match(error.raw, /61 81/);
      return true;
    }
  );
});

test("CT-täysdiagnostiikan yhteenveto käyttää kuutta CT-profiilin lukupyyntöä", () => {
  const summary = summarizeFullDiagnostic({
    meta: { vehicleKey: "ct200h" },
    results: [{
      command: "21C1",
      expected: "toyotaReadData",
      toyotaIdentifier: 0xc1,
      vehicleKey: "ct200h",
      validResponse: true,
      status: "PASS",
      raw: RESPONSE_21C1,
      responseClass: "positive-response"
    }]
  });
  assert.equal(summary.toyotaProbeSummaries.length, 6);
  assert.equal(summary.toyotaResponseCount, 1);
  assert.equal(summary.toyotaProbeSummaries[0].decoded.values.zwa10Confirmed, true);
  assert.match(summary.findings.join("\n"), /Toyota 21C1/);
});

test("käyttöliittymä tarjoaa CT/auto-valinnan mutta ei CT:n vikakoodien nollausta", async () => {
  const base = fileURLToPath(new URL("..", import.meta.url));
  const [html, main] = await Promise.all([
    fs.readFile(`${base}/index.html`, "utf8"),
    fs.readFile(`${base}/src/main.js`, "utf8")
  ]);
  assert.match(html, /value="ct200h"/);
  assert.match(html, /value="auto"/);
  assert.match(html, /CT 200h/);
  assert.match(html, /id="page-ct-test"/);
  assert.match(html, /id="ctRoadDuration"/);
  assert.match(html, /kapasiteetti-\/SOH-mittaus/);
  assert.match(main, /zwa10Confirmed/);
  assert.match(main, /runCtPurchasePostflight/);
  assert.match(main, /includeResearchCandidates:\s*true/);
  assert.match(main, /getVehicleReadDataProbes\(VEHICLE_KEYS\.CT200H\).*21C1/s);
  assert.match(main, /CT-hybridikoodien poisto ei käytössä/);
  assert.match(main, /async function clearDtc\(\)[\s\S]*?if \(isCt200h\(\)\) \{[\s\S]*?poistokomentoa ei lähetetty[\s\S]*?return;/);
  assert.doesNotMatch(CT200H_READ_ONLY_ALLOWED_COMMANDS.join(" "), /(?:^|\s)04(?:\s|$)/);
});

test("CT 200h ELM327-emulaattoriskenaario pysyy profiilin vain luku -sallintalistassa", async () => {
  const scenarioPath = fileURLToPath(new URL("../tools/elm327-emulator/ct200h_flex_readonly.py", import.meta.url));
  const source = await fs.readFile(scenarioPath, "utf8");
  const requests = [...source.matchAll(/"Request":\s+r"([^"]+)"/g)].map(match => match[1]);
  assert.equal(requests.length, 9);
  assert.match(source, /21C1/);
  assert.match(source, /2101/);
  assert.match(source, /2181/);
  assert.match(source, /2187/);
  assert.match(source, /2195/);
  assert.match(source, /2198/);
  assert.match(source, /13B0/);
  assert.equal(requests.some(request => /(?:2E|2F|31|2701|\^04\$)/.test(request)), false);
  assert.match(source, /no\s+write,\s+clear,\s+Active Test/i);
});
