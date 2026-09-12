const CLASSIC_SEND = 'const raw = String(this.bridge.send(String(command), Number(timeoutMs)));';
const BLE_SEND = 'const raw = String(this.bridge.send(String(hex), Number(timeoutMs)));';
const CLASSIC_CONNECT = 'const result = String(this.bridge.connect(address));';
const BLE_SCAN = 'const result = String(this.bridge.scanDevices(Number(timeoutMs)));';
const BASE_DISCONNECT = 'async disconnect() { if (this.available()) this.bridge.disconnect(); }';
const BLE_DIRECT_DISCONNECT = 'this.bridge.disconnect?.();';
const MARKER = 'export function createDiagnosticReportId';

const ASYNC_HELPER = `async function nativeAsyncBridgeCall(bridge, operation, payload = "", timeoutMs = 2500) {
  const asyncBridge = globalThis.obdAsync;
  const safeTimeout = Math.max(250, Number(timeoutMs) || 2500);
  const starterNames = {
    classicSend: "startClassic",
    bleSend: "startBle",
    classicConnect: "startClassicConnect",
    bleConnect: "startBleConnect",
    bleScan: "startBleScan",
    classicDisconnect: "startClassicDisconnect",
    bleDisconnect: "startBleDisconnect"
  };
  const starterName = starterNames[operation];
  const starter = starterName && asyncBridge?.[starterName];

  if (!starter || typeof starter !== "function" || typeof asyncBridge.poll !== "function") {
    if (operation === "classicSend" || operation === "bleSend") return String(bridge.send(String(payload), safeTimeout));
    if (operation === "classicConnect" || operation === "bleConnect") return String(bridge.connect(String(payload)));
    if (operation === "bleScan") return String(bridge.scanDevices(safeTimeout));
    if (operation === "classicDisconnect" || operation === "bleDisconnect") {
      bridge.disconnect?.();
      return "OK";
    }
    throw new Error("Tuntematon natiivi Bluetooth-operaatio: " + operation);
  }

  const requestId = String(starter.call(asyncBridge, String(payload), safeTimeout));
  const graceMs = operation.endsWith("Connect") ? 3500 : operation === "bleScan" ? 2500 : operation.endsWith("Disconnect") ? 1000 : 1500;
  const deadline = Date.now() + safeTimeout + graceMs;
  while (true) {
    const raw = String(asyncBridge.poll(requestId));
    if (raw !== "__PENDING__") return raw;
    if (Date.now() >= deadline) {
      return operation.endsWith("Send") ? "__TIMEOUT__" : "__ERROR__Aikakatkaisu: " + operation;
    }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}

`;

function count(source, needle) {
  return source.split(needle).length - 1;
}

export function patchCoreForAsyncNativeBridge(source) {
  const input = String(source || "");
  if (input.includes("async function nativeAsyncBridgeCall(")) return input;

  if (count(input, CLASSIC_SEND) !== 1) throw new Error("Classic OBD -sillan synkronista send-kohtaa ei löytynyt yksikäsitteisesti");
  if (count(input, BLE_SEND) !== 1) throw new Error("BLE OBD -sillan synkronista send-kohtaa ei löytynyt yksikäsitteisesti");
  if (count(input, CLASSIC_CONNECT) !== 2) throw new Error("Classic/BLE connect-kohtia ei löytynyt odotettua kahta kappaletta");
  if (count(input, BLE_SCAN) !== 1) throw new Error("BLE-skannauksen synkronista kohtaa ei löytynyt yksikäsitteisesti");
  if (count(input, BASE_DISCONNECT) !== 1) throw new Error("Natiivikuljetuksen disconnect-kohtaa ei löytynyt yksikäsitteisesti");
  if (count(input, BLE_DIRECT_DISCONNECT) !== 2) throw new Error("BLE-yhdistämisen suoria disconnect-kohtia ei löytynyt odotettua kahta kappaletta");
  if (!input.includes(MARKER)) throw new Error("core.js:n async-helperin lisäyskohtaa ei löytynyt");

  let classicConnectSeen = false;
  let patched = input.replace(MARKER, `${ASYNC_HELPER}${MARKER}`);
  patched = patched.replace(CLASSIC_SEND, 'const raw = await nativeAsyncBridgeCall(this.bridge, "classicSend", String(command), Number(timeoutMs));');
  patched = patched.replace(BLE_SEND, 'const raw = await nativeAsyncBridgeCall(this.bridge, "bleSend", String(hex), Number(timeoutMs));');
  patched = patched.replaceAll(BLE_DIRECT_DISCONNECT, 'await nativeAsyncBridgeCall(this.bridge, "bleDisconnect", "", 2500);');
  patched = patched.replace(BLE_SCAN, 'const result = await nativeAsyncBridgeCall(this.bridge, "bleScan", "", Number(timeoutMs));');
  patched = patched.replace(BASE_DISCONNECT, 'async disconnect() { if (this.available()) await nativeAsyncBridgeCall(this.bridge, this instanceof NativeBleElmTransport ? "bleDisconnect" : "classicDisconnect", "", 2500); }');
  patched = patched.replaceAll(CLASSIC_CONNECT, match => {
    const replacement = classicConnectSeen
      ? 'const result = await nativeAsyncBridgeCall(this.bridge, "bleConnect", address, 15000);'
      : 'const result = await nativeAsyncBridgeCall(this.bridge, "classicConnect", address, 20000);';
    classicConnectSeen = true;
    return replacement;
  });
  return patched;
}
