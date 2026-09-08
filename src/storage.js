const DB_NAME = "is220d-obd-local";
const DB_VERSION = 1;
const STORE = "sessions";

let databasePromise;

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("startedAt", "startedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Paikallisen tietokannan avaaminen epäonnistui"));
  });
  return databasePromise;
}

function transaction(mode, operation) {
  return openDatabase().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let request;
    try { request = operation(store); } catch (error) { reject(error); return; }
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error || request?.error || new Error("Tietokantatoiminto epäonnistui"));
    tx.onabort = () => reject(tx.error || new Error("Tietokantatoiminto keskeytyi"));
  }));
}

export const SessionStore = {
  async save(session) {
    await transaction("readwrite", store => store.put(structuredCloneSafe(session)));
    return session;
  },

  async get(id) {
    return transaction("readonly", store => store.get(id));
  },

  async list() {
    const sessions = await transaction("readonly", store => store.getAll());
    return (sessions || []).sort((a, b) => b.startedAt - a.startedAt);
  },

  async remove(id) {
    await transaction("readwrite", store => store.delete(id));
  },

  async clear() {
    await transaction("readwrite", store => store.clear());
  }
};

function structuredCloneSafe(value) {
  if (globalThis.structuredClone) return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
