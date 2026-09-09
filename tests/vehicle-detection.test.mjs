import test from "node:test";
import assert from "node:assert/strict";
import { Elm327Client } from "../src/core.js";
import { VEHICLE_KEYS } from "../src/vehicle-profiles.js";
import {
  classifyConnectedVehicle,
  normalizeVin,
  parseObdVin,
  vehicleKeyFromVin
} from "../src/vehicle-detection.js";

const IS220D_VIN = "JTHBB262302028787";
const CT200H_VIN = "JTHKD5BH0C2112797";
const COMPLETE_IS_PROBES = [
  { identifier: 0x7e, complete: true },
  { identifier: 0x7f, complete: true },
  { identifier: 0x2c, complete: true }
];

test("VIN-parseri kokoaa otsakkeellisen ISO-TP Mode 09 PID 02 -vastauksen", () => {
  const raw = [
    "7E8 10 14 49 02 01 4A 54 48",
    "7E8 21 42 42 32 36 32 33 30",
    "7E8 22 32 30 32 38 37 38 37",
    ">"
  ].join("\r");
  assert.equal(parseObdVin(raw), IS220D_VIN);
});

test("VIN-parseri tukee ELM:n numeroituja 49 02 -osavastauksia", () => {
  const raw = [
    "0: 49 02 01 00 00 00 4A",
    "1: 49 02 02 54 48 42 42",
    "2: 49 02 03 32 36 32 33",
    "3: 49 02 04 30 32 30 32",
    "4: 49 02 05 38 37 38 37"
  ].join("\r");
  assert.equal(parseObdVin(raw), IS220D_VIN);
});

test("VIN hyväksytään vain 17-merkkisellä OBD-sallitulla merkistöllä", () => {
  assert.equal(normalizeVin(` ${IS220D_VIN.toLowerCase()} `), IS220D_VIN);
  assert.equal(normalizeVin("JTHBI262302028787"), "");
  assert.equal(parseObdVin("49 02 01 4A 54 48 42 49 32 36 32 33 30 32 30 32 38 37 38 37"), "");
});

test("varmennettu VIN ja kaikki kolme 2AD-FHV-vastausta tunnistavat IS220d:n varmasti", () => {
  const result = classifyConnectedVehicle({ vin: IS220D_VIN, isProbeResults: COMPLETE_IS_PROBES });
  assert.equal(result.vehicleKey, VEHICLE_KEYS.IS220D);
  assert.equal(result.confidence, "confirmed");
  assert.equal(result.modelCode, "XE20");
  assert.equal(result.engineCode, "2AD-FHV");
  assert.match(result.message, /Lexus IS220d tunnistettu varmasti/);
});

test("ZWA10-mallitunniste ja CT-VIN tunnistavat CT 200h:n varmasti", () => {
  const result = classifyConnectedVehicle({
    vin: CT200H_VIN,
    ctIdentity: {
      complete: true,
      values: { zwa10Confirmed: true, modelCode: "ZWA10L", engineCode: "2ZRFXE" }
    }
  });
  assert.equal(result.vehicleKey, VEHICLE_KEYS.CT200H);
  assert.equal(result.confidence, "confirmed");
  assert.equal(result.modelCode, "ZWA10L");
  assert.match(result.message, /Lexus CT 200h tunnistettu varmasti/);
});

test("pelkkä varmennettu VIN-etuliite riittää vahvaan mutta ei kaksinkertaisesti varmennettuun tunnistukseen", () => {
  assert.equal(vehicleKeyFromVin(IS220D_VIN), VEHICLE_KEYS.IS220D);
  assert.equal(vehicleKeyFromVin(CT200H_VIN), VEHICLE_KEYS.CT200H);
  const result = classifyConnectedVehicle({ vin: CT200H_VIN });
  assert.equal(result.vehicleKey, VEHICLE_KEYS.CT200H);
  assert.equal(result.confidence, "high");
});

test("osittainen yksittäinen Toyota-vastaus ei aiheuta automaattista profiilivalintaa", () => {
  const result = classifyConnectedVehicle({ isProbeResults: [{ identifier: 0x7e, complete: true }] });
  assert.equal(result.vehicleKey, "");
  assert.equal(result.status, "unknown");
  assert.match(result.evidence.join(" "), /1\/3/);
});

test("ristiriitainen VIN- ja ECU-näyttö estää automaattisen arvauksen", () => {
  const result = classifyConnectedVehicle({
    vin: IS220D_VIN,
    ctIdentity: { complete: true, values: { zwa10Confirmed: true, modelCode: "ZWA10" } }
  });
  assert.equal(result.vehicleKey, "");
  assert.equal(result.status, "conflict");
  assert.match(result.message, /ristiriidassa/);
});

test("VIN-luku on atominen, vain lukeva ja palauttaa 7E0-otsakkeen", async () => {
  const commands = [];
  const transport = {
    async send(command) {
      commands.push(command);
      if (command === "0902") {
        return "7E8 10 14 49 02 01 4A 54 48\r7E8 21 42 42 32 36 32 33 30\r7E8 22 32 30 32 38 37 38 37\r>";
      }
      if (command === "010C") return "41 0C 0C 80\r>";
      return "OK\r>";
    },
    async disconnect() {}
  };
  const client = new Elm327Client(transport, () => {}, () => {}, { wait: async () => {} });
  const identification = client.readVehicleIdentification();
  const ordinaryRead = client.command("010C");
  const [raw] = await Promise.all([identification, ordinaryRead]);
  assert.equal(parseObdVin(raw), IS220D_VIN);
  assert.deepEqual(commands, ["ATCRA", "ATSH7E0", "0902", "ATCRA", "ATSH7E0", "010C"]);
  assert.equal(commands.some(command => /^(04|2E|2F|31)/.test(command)), false);
});
