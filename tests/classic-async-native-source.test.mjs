import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const mainActivity = await readFile(new URL("../native/smali/com/nicron/webview/MainActivity.smali", import.meta.url), "utf8");
const bridge = await readFile(new URL("../native/smali/com/nicron/webview/AsyncObdBridge.smali", import.meta.url), "utf8");
const sendWorker = await readFile(new URL("../native/smali/com/nicron/webview/AsyncObdSendRunnable.smali", import.meta.url), "utf8");
const connectWorker = await readFile(new URL("../native/smali/com/nicron/webview/AsyncObdConnectRunnable.smali", import.meta.url), "utf8");
const callbackWorker = await readFile(new URL("../native/smali/com/nicron/webview/AsyncObdCallbackRunnable.smali", import.meta.url), "utf8");
const jsTransport = await readFile(new URL("../src/classic-async-transport.js", import.meta.url), "utf8");

test("MainActivity exposes a separate obdAsync interface while retaining the original obd bridge", () => {
  assert.match(mainActivity, /const-string v3, "obd"/);
  assert.match(mainActivity, /const-string v3, "obdAsync"/);
  assert.match(mainActivity, /Lcom\/nicron\/webview\/AsyncObdBridge;/);
  assert.match(mainActivity, /addJavascriptInterface/);
});

test("native async bridge starts worker threads and posts results back to WebView", () => {
  assert.match(bridge, /connectAsync/);
  assert.match(bridge, /sendAsync/);
  assert.match(bridge, /Ljava\/lang\/Thread;->start\(\)V/);
  assert.match(bridge, /Landroid\/webkit\/WebView;->post\(Ljava\/lang\/Runnable;\)Z/);
  assert.match(bridge, /__IS220D_OBD_ASYNC_RESULT__/);
  assert.match(sendWorker, /Lcom\/nicron\/webview\/ObdBridge;|runSend/);
  assert.match(connectWorker, /runConnect/);
  assert.match(callbackWorker, /evaluateJavascript/);
});

test("JS layer uses Promise callback path with watchdog and leaves BLE fallback intact", () => {
  assert.match(jsTransport, /new Promise/);
  assert.match(jsTransport, /connectAsync/);
  assert.match(jsTransport, /sendAsync/);
  assert.match(jsTransport, /setTimeout/);
  assert.match(jsTransport, /instance\.bridge === globalThis\.obd/);
  assert.match(jsTransport, /originalConnect\.call/);
  assert.match(jsTransport, /originalSend\.call/);
  assert.doesNotMatch(jsTransport, /ATSH|ATSP|ATZ|ATMA|217E|217F|212C|02217E|02217F|02212C/);
});
