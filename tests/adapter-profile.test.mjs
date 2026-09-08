import test from "node:test";
import assert from "node:assert/strict";
import {
  VLINKER_CAPABILITY_PROBES,
  VLINKER_IDENTITY_TIMEOUT_MS,
  VLINKER_OPTIONAL_CAPABILITY_TIMEOUT_MS,
  classifyAdapterDevice,
  sortAdapterDevices,
  selectedAdapterHelp,
  summarizeAdapterCapabilities,
  formatAdapterCapabilitySummary,
  redactBluetoothAddress
} from "../src/adapter-profile.js";

test("vLinker MC+ tunnistetaan erikseen Classic- ja BLE-mainoksista", () => {
  const classic = classifyAdapterDevice({ name: "vLinker MC-Android", address: "AA:BB:CC:DD:EE:01", transport: "classic" });
  const ble = classifyAdapterDevice({ name: "vLinker MC-IOS", address: "AA:BB:CC:DD:EE:02", transport: "ble" });
  assert.equal(classic.vlinker, true);
  assert.equal(classic.recommended, true);
  assert.equal(classic.adapterFamily, "vlinker-mc-or-mc-plus");
  assert.equal(ble.vlinker, true);
  assert.equal(ble.adapterFamily, "vlinker-mc-plus");
  assert.match(ble.channelLabel, /MC-IOS/);
});

test("vLinker Classic priorisoidaan saman MC+:n BLE-kanavan edelle", () => {
  const sorted = sortAdapterDevices([
    { name: "OBD", address: "11:22:33:44:55:66", transport: "ble", rssi: -30 },
    { name: "vLinker MC-IOS", address: "AA:BB:CC:DD:EE:02", transport: "ble", rssi: -20 },
    { name: "vLinker MC", address: "AA:BB:CC:DD:EE:01", transport: "classic" }
  ]);
  assert.equal(sorted[0].transport, "classic");
  assert.equal(sorted[0].vlinker, true);
  assert.equal(sorted[1].adapterFamily, "vlinker-mc-plus");
});

test("vLinker-ohje erottaa Android-paritettavan Classicin ja sovelluksessa valittavan BLE:n", () => {
  assert.match(selectedAdapterHelp({ name: "vLinker MC", transport: "classic" }), /PIN-koodia 1234/);
  assert.match(selectedAdapterHelp({ name: "vLinker MC-IOS", transport: "ble" }), /ei pariteta Androidin asetuksissa/);
});

test("vLinker capability -sallintalista sisältää vain identiteetti- ja tilalukukomentoja", () => {
  assert.deepEqual(VLINKER_CAPABILITY_PROBES.map(item => item.command), [
    "ATI", "STI", "STDI", "AT@1", "AT@2", "ATRV", "ATIGN", "ATDP", "ATDPN", "ATCS"
  ]);
  assert.equal(VLINKER_CAPABILITY_PROBES.some(item => /^(04|ATSH|ATSP|ATZ)/.test(item.command)), false);
});

test("vLinker capability -vaiheen timeout-budjetti pysyy rajattuna ennen ECU-probea", () => {
  assert.equal(VLINKER_IDENTITY_TIMEOUT_MS, 3000);
  assert.equal(VLINKER_OPTIONAL_CAPABILITY_TIMEOUT_MS, 1500);
  assert.equal(VLINKER_CAPABILITY_PROBES[0].timeoutMs, VLINKER_IDENTITY_TIMEOUT_MS);
  assert.equal(VLINKER_CAPABILITY_PROBES.slice(1).every(item => item.timeoutMs === VLINKER_OPTIONAL_CAPABILITY_TIMEOUT_MS), true);
  const worstCaseBudgetMs = VLINKER_CAPABILITY_PROBES.reduce((sum, item) => sum + item.timeoutMs, 0);
  assert.equal(worstCaseBudgetMs, 16500);
});

test("capability-yhteenveto tunnistaa vLinkerin, ST-ytimen, jännitteen ja protokollan", () => {
  const pass = (command, cleaned) => ({ command, cleaned, raw: `${cleaned}\r>`, validResponse: true });
  const summary = summarizeAdapterCapabilities([
    pass("ATI", "ELM327 v2.2"),
    pass("STI", "STN1170 v4.3.0"),
    pass("AT@1", "Vgate vLinker MC+"),
    pass("ATRV", "14.2V"),
    pass("ATDP", "ISO 15765-4 (CAN 11/500)")
  ], { name: "vLinker MC-Android", transport: "Bluetooth Classic / SPP" });
  assert.equal(summary.vlinkerDetected, true);
  assert.equal(summary.stnSupported, true);
  assert.equal(summary.voltage, 14.2);
  assert.match(formatAdapterCapabilitySummary(summary), /vLinker MC/);
});

test("Bluetooth-osoite peitetään tutkimusraportin oletusviennissä", () => {
  assert.equal(redactBluetoothAddress("AA:BB:CC:DD:EE:FF"), "**:**:**:**:EE:FF");
});
