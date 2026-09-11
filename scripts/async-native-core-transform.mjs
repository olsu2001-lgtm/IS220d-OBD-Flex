const CLASSIC_SEND = 'const raw = String(this.bridge.send(String(command), Number(timeoutMs)));';
const BLE_SEND = 'const raw = String(this.bridge.send(String(hex), Number(timeoutMs)));';
const MARKER = 'export function createDiagnosticReportId';

const ASYNC_HELPER = `async function nativeAsyncBridgeSend(bridge, channel, payload, timeoutMs) {
  const asyncBridge = globalThis.obdAsync;
  const safeTimeout = Math.max(250, Number(timeoutMs) || 2500);
  const starterName = channel === "ble" ? "startBle" : "startClassic";
  if (!asyncBridge || typeof asyncBridge[starterName] !== "function" || typeof asyncBridge.poll !== "function") {
    return String(bridge.send(String(payload), safeTimeout));
  }

  const requestId = String(asyncBridge[starterName](String(payload), safeTimeout));
  const deadline = Date.now() + safeTimeout + 1500;
  while (true) {
    const raw = String(asyncBridge.poll(requestId));
    if (raw !== "__PENDING__") return raw;
    if (Date.now() >= deadline) return "__TIMEOUT__";
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}

`;

function count(source, needle) {
  return source.split(needle).length - 1;
}

export function patchCoreForAsyncNativeBridge(source) {
  const input = String(source || "");
  if (input.includes("async function nativeAsyncBridgeSend(")) return input;

  if (count(input, CLASSIC_SEND) !== 1) {
    throw new Error("Classic OBD -sillan synkronista send-kohtaa ei löytynyt yksikäsitteisesti");
  }
  if (count(input, BLE_SEND) !== 1) {
    throw new Error("BLE OBD -sillan synkronista send-kohtaa ei löytynyt yksikäsitteisesti");
  }
  if (!input.includes(MARKER)) {
    throw new Error("core.js:n async-helperin lisäyskohtaa ei löytynyt");
  }

  return input
    .replace(MARKER, `${ASYNC_HELPER}${MARKER}`)
    .replace(CLASSIC_SEND, 'const raw = await nativeAsyncBridgeSend(this.bridge, "classic", String(command), Number(timeoutMs));')
    .replace(BLE_SEND, 'const raw = await nativeAsyncBridgeSend(this.bridge, "ble", String(hex), Number(timeoutMs));');
}
