import { NativeElmTransport } from "./core.js";

const CALLBACK_NAME = "__IS220D_OBD_ASYNC_RESULT__";
const PATCH_FLAG = Symbol.for("is220d.native-elm-async-patched");
const CONNECT_WATCHDOG_MS = 12000;
const SEND_WATCHDOG_MARGIN_MS = 1250;
const pending = new Map();
let requestSequence = 0;

function decodeBase64Utf8(value) {
  const encoded = String(value || "");
  if (!encoded) return "";
  if (typeof atob !== "function") {
    if (typeof Buffer !== "undefined") return Buffer.from(encoded, "base64").toString("utf8");
    throw new Error("Async Bluetooth -vastauksen base64-purkua ei ole käytettävissä");
  }
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function finishPending(requestId, error, raw) {
  const entry = pending.get(String(requestId));
  if (!entry) return false;
  pending.delete(String(requestId));
  clearTimeout(entry.timer);
  if (error) entry.reject(error);
  else entry.resolve(raw);
  return true;
}

function installCallback() {
  const previous = globalThis[CALLBACK_NAME];
  if (previous?.__is220dAsyncDispatcher === true) return;
  const dispatcher = (requestId, encodedResult) => {
    let raw = "";
    try {
      raw = decodeBase64Utf8(encodedResult);
    } catch (error) {
      if (finishPending(requestId, error, "")) return;
      if (typeof previous === "function") previous(requestId, encodedResult);
      return;
    }
    if (finishPending(requestId, null, raw)) return;
    if (typeof previous === "function") previous(requestId, encodedResult);
  };
  Object.defineProperty(dispatcher, "__is220dAsyncDispatcher", { value: true });
  globalThis[CALLBACK_NAME] = dispatcher;
}

function isClassicAsyncAvailable(instance, method) {
  const asyncBridge = globalThis.obdAsync;
  return Boolean(
    instance?.bridge &&
    instance.bridge === globalThis.obd &&
    asyncBridge &&
    typeof asyncBridge[method] === "function"
  );
}

function abortClassicSocket(instance) {
  try { instance?.bridge?.disconnect?.(); } catch {}
}

function startAsyncRequest(instance, method, args, watchdogMs, watchdogMessage, disconnectOnWatchdog = false) {
  installCallback();
  const asyncBridge = globalThis.obdAsync;
  const requestId = String(++requestSequence);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      if (disconnectOnWatchdog) abortClassicSocket(instance);
      reject(new Error(watchdogMessage));
    }, Math.max(500, Number(watchdogMs) || 500));
    pending.set(requestId, { resolve, reject, timer });
    let accepted = "";
    try {
      accepted = String(asyncBridge[method](...args, requestId));
    } catch (error) {
      clearTimeout(timer);
      pending.delete(requestId);
      reject(error);
      return;
    }
    if (accepted.startsWith("__ERROR__")) {
      clearTimeout(timer);
      pending.delete(requestId);
      reject(new Error(accepted.slice(9) || `Async ${method} epäonnistui`));
    }
  });
}

function parseClassicConnectResult(result) {
  const raw = String(result || "");
  if (raw.startsWith("__ERROR__")) throw new Error(raw.slice(9));
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error(raw || "Bluetooth-yhteys epäonnistui"); }
  if (!parsed.ok) throw new Error(parsed.error || "Bluetooth-yhteys epäonnistui");
  return { ...parsed, transport: parsed.transport || "classic" };
}

function parseClassicSendResult(result, command) {
  const raw = String(result || "");
  if (raw.startsWith("__ERROR__")) throw new Error(raw.slice(9));
  if (raw.startsWith("__TIMEOUT__")) {
    const error = new Error(`Aikakatkaisu: ${command}`);
    error.partialRaw = raw.slice(11);
    throw error;
  }
  return raw;
}

export function installClassicAsyncTransport() {
  const prototype = NativeElmTransport?.prototype;
  if (!prototype || prototype[PATCH_FLAG]) return false;
  installCallback();
  const originalConnect = prototype.connect;
  const originalSend = prototype.send;

  prototype.connect = async function connectNonBlocking(address) {
    if (!isClassicAsyncAvailable(this, "connectAsync")) return originalConnect.call(this, address);
    if (!this.available()) throw new Error("Androidin Bluetooth-silta ei ole käytettävissä");
    const result = await startAsyncRequest(
      this,
      "connectAsync",
      [String(address)],
      CONNECT_WATCHDOG_MS,
      "Bluetooth-yhteyden muodostus ei valmistunut 12 sekunnissa",
      true
    );
    return parseClassicConnectResult(result);
  };

  prototype.send = async function sendNonBlocking(command, timeoutMs = 2500) {
    if (!isClassicAsyncAvailable(this, "sendAsync")) return originalSend.call(this, command, timeoutMs);
    if (!this.available()) throw new Error("Androidin Bluetooth-silta ei ole käytettävissä");
    const timeout = Math.max(1, Number(timeoutMs) || 2500);
    const result = await startAsyncRequest(
      this,
      "sendAsync",
      [String(command), timeout],
      timeout + SEND_WATCHDOG_MARGIN_MS,
      `Bluetooth-komento ei valmistunut ${timeout + SEND_WATCHDOG_MARGIN_MS} ms aikarajassa`,
      true
    );
    return parseClassicSendResult(result, command);
  };

  Object.defineProperty(prototype, PATCH_FLAG, { value: true, configurable: false });
  return true;
}

export const CLASSIC_ASYNC_TRANSPORT_LIMITS = Object.freeze({
  connectWatchdogMs: CONNECT_WATCHDOG_MS,
  sendWatchdogMarginMs: SEND_WATCHDOG_MARGIN_MS
});
