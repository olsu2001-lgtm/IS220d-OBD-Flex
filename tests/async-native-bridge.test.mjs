import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { patchCoreForAsyncNativeBridge } from "../scripts/async-native-core-transform.mjs";

const coreSource = fs.readFileSync(new URL("../src/core.js", import.meta.url), "utf8");
const mainActivity = fs.readFileSync(new URL("../native/smali/com/nicron/webview/MainActivity.smali", import.meta.url), "utf8");
const asyncBridge = fs.readFileSync(new URL("../native/smali/com/nicron/webview/AsyncObdBridge.smali", import.meta.url), "utf8");
const asyncRunnable = fs.readFileSync(new URL("../native/smali/com/nicron/webview/AsyncObdSendRunnable.smali", import.meta.url), "utf8");

test("APK-transformi siirtää OBD-sendit ja blokkaavat Bluetooth-ohjauskutsut asynkronisen sillan kautta", () => {
  const patched = patchCoreForAsyncNativeBridge(coreSource);
  assert.match(patched, /async function nativeAsyncBridgeCall\(/);
  assert.match(patched, /await nativeAsyncBridgeCall\(this\.bridge, "classicSend", String\(command\), Number\(timeoutMs\)\)/);
  assert.match(patched, /await nativeAsyncBridgeCall\(this\.bridge, "bleSend", String\(hex\), Number\(timeoutMs\)\)/);
  assert.match(patched, /await nativeAsyncBridgeCall\(this\.bridge, "classicConnect", address, 20000\)/);
  assert.match(patched, /await nativeAsyncBridgeCall\(this\.bridge, "bleConnect", address, 15000\)/);
  assert.match(patched, /await nativeAsyncBridgeCall\(this\.bridge, "bleScan", "", Number\(timeoutMs\)\)/);
  assert.match(patched, /"bleDisconnect"/);
  assert.match(patched, /"classicDisconnect"/);
  assert.match(patched, /await new Promise\(resolve => setTimeout\(resolve, 25\)\)/);
  assert.match(patched, /raw !== "__PENDING__"/);
  assert.doesNotMatch(patched, /const result = String\(this\.bridge\.scanDevices/);
});

test("asynkroninen natiivisilta ajaa Bluetooth-operaatiot taustasäikeessä ja sarjallistaa niiden suorittamisen", () => {
  assert.match(asyncBridge, /new-instance v3, Ljava\/lang\/Thread;/);
  assert.match(asyncBridge, /\.method public synchronized execute\(Ljava\/lang\/String;Ljava\/lang\/String;I\)V/);
  assert.match(asyncBridge, /startClassic\(Ljava\/lang\/String;I\)Ljava\/lang\/String;/);
  assert.match(asyncBridge, /startBle\(Ljava\/lang\/String;I\)Ljava\/lang\/String;/);
  assert.match(asyncBridge, /startClassicConnect\(Ljava\/lang\/String;I\)Ljava\/lang\/String;/);
  assert.match(asyncBridge, /startBleConnect\(Ljava\/lang\/String;I\)Ljava\/lang\/String;/);
  assert.match(asyncBridge, /startBleScan\(Ljava\/lang\/String;I\)Ljava\/lang\/String;/);
  assert.match(asyncBridge, /startClassicDisconnect\(Ljava\/lang\/String;I\)Ljava\/lang\/String;/);
  assert.match(asyncBridge, /startBleDisconnect\(Ljava\/lang\/String;I\)Ljava\/lang\/String;/);
  assert.match(asyncBridge, /BleObdBridge;->scanDevices\(I\)Ljava\/lang\/String;/);
  assert.match(asyncBridge, /BleObdBridge;->connect\(Ljava\/lang\/String;\)Ljava\/lang\/String;/);
  assert.match(asyncBridge, /ObdBridge;->connect\(Ljava\/lang\/String;\)Ljava\/lang\/String;/);
  assert.match(asyncBridge, /poll\(Ljava\/lang\/String;\)Ljava\/lang\/String;/);
  assert.match(asyncBridge, /__PENDING__/);
  assert.match(asyncRunnable, /implements Ljava\/lang\/Runnable;/);
  assert.match(asyncRunnable, /AsyncObdBridge;->execute/);
});

test("MainActivity julkaisee obdAsync-sillan WebViewille", () => {
  assert.match(mainActivity, /Lcom\/nicron\/webview\/AsyncObdBridge;/);
  assert.match(mainActivity, /const-string v3, "obdAsync"/);
  assert.match(mainActivity, /addJavascriptInterface/);
});

test("transformi failaa kiinni jos core-rakenne muuttuu odottamatta", () => {
  assert.throws(() => patchCoreForAsyncNativeBridge("export function createDiagnosticReportId() {}"), /Classic OBD/);
});
