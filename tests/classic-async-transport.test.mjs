import test from "node:test";
import assert from "node:assert/strict";
import { NativeElmTransport } from "../src/core.js";
import {
  CLASSIC_ASYNC_TRANSPORT_LIMITS,
  installClassicAsyncTransport
} from "../src/classic-async-transport.js";

function encode(value) {
  return Buffer.from(String(value), "utf8").toString("base64");
}

function makeClassicBridge() {
  return {
    syncConnectCalls: 0,
    syncSendCalls: 0,
    disconnectCalls: 0,
    pairedDevices() { return "[]"; },
    connect() { this.syncConnectCalls += 1; throw new Error("sync connect must not run"); },
    send() { this.syncSendCalls += 1; throw new Error("sync send must not run"); },
    disconnect() { this.disconnectCalls += 1; },
    isConnected() { return true; }
  };
}

test("Classic transport uses obdAsync callbacks instead of synchronous send/connect", async () => {
  const bridge = makeClassicBridge();
  globalThis.obd = bridge;
  globalThis.obdAsync = {
    connectAsync(address, requestId) {
      assert.equal(address, "AA:BB:CC:DD:EE:FF");
      setTimeout(() => globalThis.__IS220D_OBD_ASYNC_RESULT__(requestId, encode(JSON.stringify({ ok: true, name: "vLinker" }))), 5);
      return "OK";
    },
    sendAsync(command, timeoutMs, requestId) {
      assert.equal(command, "0100");
      assert.equal(timeoutMs, 2500);
      setTimeout(() => globalThis.__IS220D_OBD_ASYNC_RESULT__(requestId, encode("41 00 BE 3F A8 13\r>")), 5);
      return "OK";
    }
  };

  installClassicAsyncTransport();
  const transport = new NativeElmTransport(bridge);
  const connected = await transport.connect("AA:BB:CC:DD:EE:FF");
  assert.equal(connected.ok, true);
  assert.equal(connected.transport, "classic");
  assert.equal(bridge.syncConnectCalls, 0);

  const sendPromise = transport.send("0100", 2500);
  assert.equal(bridge.syncSendCalls, 0);
  assert.equal(await sendPromise, "41 00 BE 3F A8 13\r>");
  assert.equal(bridge.syncSendCalls, 0);
});

test("Classic async timeout marker preserves partial raw data", async () => {
  const bridge = makeClassicBridge();
  globalThis.obd = bridge;
  globalThis.obdAsync = {
    connectAsync() { return "__ERROR__not used"; },
    sendAsync(command, timeoutMs, requestId) {
      setTimeout(() => globalThis.__IS220D_OBD_ASYNC_RESULT__(requestId, encode("__TIMEOUT__PARTIAL")), 1);
      return "OK";
    }
  };
  installClassicAsyncTransport();
  const transport = new NativeElmTransport(bridge);
  await assert.rejects(
    transport.send("010C", 100),
    error => error.message === "Aikakatkaisu: 010C" && error.partialRaw === "PARTIAL"
  );
});

test("non-Classic transports keep the original synchronous bridge fallback", async () => {
  const classicBridge = makeClassicBridge();
  globalThis.obd = classicBridge;
  globalThis.obdAsync = { connectAsync() { return "OK"; }, sendAsync() { return "OK"; } };
  installClassicAsyncTransport();

  let calls = 0;
  const otherBridge = {
    pairedDevices() { return "[]"; },
    connect() { return JSON.stringify({ ok: true }); },
    send() { calls += 1; return "OK\r>"; },
    disconnect() {},
    isConnected() { return true; }
  };
  const transport = new NativeElmTransport(otherBridge);
  assert.equal(await transport.send("ATI", 100), "OK\r>");
  assert.equal(calls, 1);
});

test("Classic watchdog limits remain explicit", () => {
  assert.equal(CLASSIC_ASYNC_TRANSPORT_LIMITS.connectWatchdogMs, 12000);
  assert.equal(CLASSIC_ASYNC_TRANSPORT_LIMITS.sendWatchdogMarginMs, 1250);
});
