import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  restoreMissingClassicSelection,
  sortAdapterDevices
} from "../src/adapter-profile.js";

test("väärän PINin jälkeen puuttuva Classic-valinta säilytetään parituspalautuksena", () => {
  const devices = restoreMissingClassicSelection([
    { name: "vLinker MC-IOS", address: "AA:BB:CC:DD:EE:02", transport: "ble", rssi: -20 }
  ], {
    name: "vLinker MC-Android",
    address: "AA:BB:CC:DD:EE:01",
    transport: "classic"
  });

  const restored = devices.find(device => device.transport === "classic");
  assert.ok(restored);
  assert.equal(restored.address, "AA:BB:CC:DD:EE:01");
  assert.equal(restored.pairingRequired, true);

  const sorted = sortAdapterDevices(devices);
  assert.equal(sorted[0].transport, "classic");
  assert.equal(sorted[0].pairingRequired, true);
  assert.equal(sorted[1].transport, "ble");
});

test("jo paritettua Classic-laitetta ei monisteta", () => {
  const devices = restoreMissingClassicSelection([
    { name: "vLinker MC", address: "AA:BB:CC:DD:EE:01", transport: "classic" }
  ], {
    name: "vLinker MC-Android",
    address: "aa:bb:cc:dd:ee:01",
    transport: "classic"
  });
  assert.equal(devices.length, 1);
  assert.equal(Boolean(devices[0].pairingRequired), false);
});

test("BLE- tai simulaattorivalinnasta ei muodosteta Classic-palautusriviä", () => {
  assert.deepEqual(restoreMissingClassicSelection([], {
    name: "vLinker MC-IOS",
    address: "AA:BB:CC:DD:EE:02",
    transport: "ble"
  }), []);
  assert.deepEqual(restoreMissingClassicSelection([], {
    name: "Simulaattori",
    address: "FAKE:IS220D",
    transport: "classic"
  }), []);
});

test("käyttöliittymä säilyttää Classic-nimen ja näyttää PIN-palautusohjeen", () => {
  const source = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(source, /localStorage\.setItem\("lastObdName"/);
  assert.match(source, /PARITUS VAADITAAN/);
  assert.match(source, /PIN-koodia 1234/);
  assert.match(source, /MC-IOS on saman adapterin erillinen BLE-kanava/);
});
