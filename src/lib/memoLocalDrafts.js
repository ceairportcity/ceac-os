// Account-scoped, encrypted on-device recovery for an unsent Memo.
// No attachment bytes or private storage URLs are stored in this database.
const DATABASE = "ceac-private-draft-recovery";
const VERSION = 1;
function openDatabase() {
  if (!globalThis.indexedDB || !globalThis.crypto?.subtle) return Promise.reject(new Error("Local draft recovery is not supported on this device."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("keys")) db.createObjectStore("keys");
      if (!db.objectStoreNames.contains("drafts")) db.createObjectStore("drafts");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function storeRequest(db, store, mode, method, ...args) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = tx.objectStore(store)[method](...args);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.onabort = () => reject(tx.error);
  });
}
function scope(orgId, userId) {
  if (!orgId || !userId) throw new Error("Account scope is required.");
  return `${orgId}:${userId}`;
}
async function keyFor(db, id) {
  const existing = await storeRequest(db, "keys", "readonly", "get", id);
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({name:"AES-GCM",length:256}, false, ["encrypt","decrypt"]);
  await storeRequest(db, "keys", "readwrite", "put", key, id);
  return key;
}
export async function saveLocalMemoDraft(orgId, userId, payload) {
  const db = await openDatabase();
  try {
    const id = scope(orgId, userId), key = await keyFor(db, id);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plain = new TextEncoder().encode(JSON.stringify(payload));
    const encrypted = await crypto.subtle.encrypt({name:"AES-GCM",iv}, key, plain);
    await storeRequest(db, "drafts", "readwrite", "put", {
      iv: Array.from(iv), value: Array.from(new Uint8Array(encrypted)), updatedAt: Date.now(),
    }, id);
  } finally { db.close(); }
}
export async function readLocalMemoDraft(orgId, userId) {
  const db = await openDatabase();
  try {
    const id = scope(orgId, userId);
    const saved = await storeRequest(db, "drafts", "readonly", "get", id);
    if (!saved) return null;
    const key = await storeRequest(db, "keys", "readonly", "get", id);
    if (!key) return null;
    const plain = await crypto.subtle.decrypt({name:"AES-GCM",iv: new Uint8Array(saved.iv)}, key, new Uint8Array(saved.value));
    return JSON.parse(new TextDecoder().decode(plain));
  } finally { db.close(); }
}
export async function clearLocalMemoDraft(orgId, userId) {
  const db = await openDatabase();
  try {
    const id=scope(orgId,userId);
    await storeRequest(db,"drafts","readwrite","delete",id);
    await storeRequest(db,"keys","readwrite","delete",id);
  } finally { db.close(); }
}

export function saveLocalRoomDraft(orgId, userId, roomId, payload) {
  return saveLocalMemoDraft(orgId, `${userId}:room:${roomId}`, payload);
}
export function readLocalRoomDraft(orgId, userId, roomId) {
  return readLocalMemoDraft(orgId, `${userId}:room:${roomId}`);
}
export function clearLocalRoomDraft(orgId, userId, roomId) {
  return clearLocalMemoDraft(orgId, `${userId}:room:${roomId}`);
}
