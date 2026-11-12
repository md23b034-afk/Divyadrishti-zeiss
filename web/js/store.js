// Offline-first, encrypted case store on the field phone.
// - Cases and the in-progress draft are encrypted at rest (AES-256-GCM) with a
//   key that exists only while the operator's PIN has unlocked the app.
// - Sync is store-and-forward: POST is idempotent on the client case id, so
//   retries over flaky 2G never duplicate a case.
// - What leaves the phone is pseudonymous: name, phone and village are sealed
//   to the optometrist hub's public key (or withheld if no hub key exists yet);
//   the server sees age, sex, PIN code and the clinical record.
import { createVault, openVault, encryptJson, decryptJson, sealToHub } from './crypto.js';

const DB_NAME = 'divyadrishti';
const VAULT_KEY = 'dd.vault';
const HUB_KEY = 'dd.hubKey';
let dbp = null;
let sessionKey = null;
let lastActivity = Date.now();
export const IDLE_LOCK_MS = 15 * 60 * 1000;

function db() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('cases')) d.createObjectStore('cases', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('drafts')) d.createObjectStore('drafts', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => resolve(out && 'result' in out ? out.result : out);
    t.onerror = () => reject(t.error);
  });
}

// ---------------------------------------------------------------- vault (PIN)
const readVault = () => { try { return JSON.parse(localStorage.getItem(VAULT_KEY) || 'null'); } catch { return null; } };
export const hasVault = () => Boolean(readVault());
export const isUnlocked = () => Boolean(sessionKey);
export function touch() { lastActivity = Date.now(); }
export function idleTooLong() { return sessionKey && Date.now() - lastActivity > IDLE_LOCK_MS; }
export function lock() { sessionKey = null; }

export async function setupPin(pin) {
  const { record, key } = await createVault(pin);
  localStorage.setItem(VAULT_KEY, JSON.stringify(record));
  sessionKey = key;
  touch();
  // ask the browser not to evict queued cases under storage pressure
  try { await navigator.storage?.persist?.(); } catch { /* not supported */ }
}

export async function unlock(pin) {
  const rec = readVault();
  if (!rec) throw new Error('no vault');
  sessionKey = await openVault(rec, pin); // throws on a wrong PIN
  touch();
}

// Forgotten PIN: the only way back is to wipe this phone's encrypted data.
export async function resetVault() {
  sessionKey = null;
  localStorage.removeItem(VAULT_KEY);
  await tx('cases', 'readwrite', (s) => s.clear());
  await tx('drafts', 'readwrite', (s) => s.clear());
}

function needKey() {
  if (!sessionKey) throw new Error('locked');
  return sessionKey;
}

// Plaintext kept beside the ciphertext: only what sync and the badge need.
async function seal(c) {
  return { id: c.id, createdAt: c.createdAt, sync: c.sync || 'queued', box: await encryptJson(needKey(), c, c.id) };
}
async function unseal(r) {
  if (!r) return null;
  if (!r.box) return r; // legacy plaintext record from an older build
  return { ...(await decryptJson(needKey(), r.box, r.id)), sync: r.sync };
}

// Encrypt first, then open the transaction: IndexedDB transactions auto-commit
// across async gaps, so no await may sit inside one.
export async function putCase(c) { const rec = await seal(c); return tx('cases', 'readwrite', (s) => s.put(rec)); }
export async function getCase(id) { return unseal(await tx('cases', 'readonly', (s) => s.get(id))); }
export async function allCases() {
  const rows = (await tx('cases', 'readonly', (s) => s.getAll())) || [];
  const list = [];
  for (const r of rows) {
    try { list.push(await unseal(r)); } catch { list.push({ id: r.id, createdAt: r.createdAt, sync: r.sync, unreadable: true }); }
  }
  return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}
export async function pendingCount() {
  const rows = (await tx('cases', 'readonly', (s) => s.getAll())) || [];
  return rows.filter((r) => r.sync !== 'sent').length;
}

// ---------------------------------------------------------------- draft autosave
export async function saveDraft(state) {
  const rec = { id: 'current', savedAt: new Date().toISOString(), box: await encryptJson(needKey(), state, 'draft') };
  return tx('drafts', 'readwrite', (s) => s.put(rec));
}
export async function loadDraft() {
  const r = await tx('drafts', 'readonly', (s) => s.get('current'));
  if (!r) return null;
  try { return await decryptJson(needKey(), r.box, 'draft'); } catch { return null; }
}
export const clearDraft = () => tx('drafts', 'readwrite', (s) => s.delete('current'));

// ---------------------------------------------------------------- server
export const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  }));

export const API = (() => {
  const u = new URL(location.href);
  return u.searchParams.get('api') || localStorage.getItem('dd.api') || '/api';
})();

// The hub's public key (not secret). Cached so cases can be sealed offline.
export async function getHubKey({ refresh = true } = {}) {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(HUB_KEY) || 'null'); } catch { cached = null; }
  if (!refresh) return cached;
  try {
    const r = await fetch(`${API}/hub/key`, { cache: 'no-store' });
    if (r.ok) { const k = await r.json(); localStorage.setItem(HUB_KEY, JSON.stringify(k)); return k; }
    if (r.status === 404) { localStorage.removeItem(HUB_KEY); return null; }
  } catch { /* offline: use cache */ }
  return cached;
}

const pinCodeOf = (village) => ((village || '').match(/\b\d{6}\b/) || [null])[0];

// What actually leaves the phone.
export async function outgoing(c, hubKey) {
  const { sync, sentAt, review, passportLocal, ...p } = c;
  const id = { name: p.patient?.name || '', phone: p.patient?.phone || '', village: p.patient?.village || '' };
  const sealed = hubKey ? await sealToHub(id, hubKey.jwk, p.id) : null;
  p.patient = { age: p.patient?.age ?? null, sex: p.patient?.sex ?? null, pin: pinCodeOf(id.village), sealed };
  p.privacy = { identity: sealed ? 'sealed-to-hub' : 'kept-on-phone', hubKid: hubKey?.kid || null };
  return p;
}

export async function syncPending() {
  if (!sessionKey) return 0;
  const list = await allCases();
  const queued = list.filter((x) => x.sync !== 'sent' && !x.unreadable);
  if (!queued.length) return 0;
  const hub = await getHubKey();
  let sent = 0;
  for (const c of queued) {
    try {
      const body = await outgoing(c, hub);
      const r = await fetch(`${API}/cases`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Actor': `field:${c.site?.name || 'unknown'}` }, body: JSON.stringify(body),
      });
      if (r.ok) { c.sync = 'sent'; c.sentAt = new Date().toISOString(); await putCase(c); sent++; }
    } catch { /* offline: try later */ }
  }
  return sent;
}

// Pull optometrist decisions back for cases this phone sent.
export async function pullReviews() {
  if (!sessionKey) return;
  const list = (await allCases()).filter((c) => c.sync === 'sent' && !c.review);
  for (const c of list) {
    try {
      const r = await fetch(`${API}/cases/${c.id}`, { headers: { 'X-Actor': `field:${c.site?.name || 'unknown'}` } });
      if (!r.ok) continue;
      const remote = await r.json();
      if (remote.review) { c.review = remote.review; await putCase(c); }
    } catch { /* offline */ }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { syncPending(); });
  setInterval(() => { if (navigator.onLine) syncPending().catch(() => {}); }, 60000); // retry queued cases every minute
}
