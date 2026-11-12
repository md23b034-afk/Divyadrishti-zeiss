// Encryption for patient data, using only the browser's WebCrypto API
// (also available in Node 20+, so it is unit-tested in tests/engine/crypto.test.mjs).
//
// 1. At rest on the field phone: every case is encrypted with AES-256-GCM. The
//    data key is random and is stored only wrapped by a key derived from the
//    operator's PIN (PBKDF2-SHA-256, 310,000 iterations). A lost phone without
//    the PIN reveals nothing; a wrong PIN fails GCM authentication.
// 2. Identity to the hub: the patient's name, phone and village are sealed to
//    the optometrist hub's public key (ECDH P-256 + HKDF-SHA-256 + AES-256-GCM,
//    a fresh ephemeral key per case, bound to the case id). The cloud server
//    stores clinical data under a pseudonymous case id and cannot read who the
//    patient is; only the hub's browser can.

const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;
const rand = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

export const b64 = (buf) => {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
};
export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64url = (buf) => b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const PBKDF2_ITERATIONS = 310000;

// ---------------------------------------------------------------- at rest (PIN vault)
async function deriveKek(pin, salt, iterations) {
  const base = await subtle().importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base,
    { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']);
}

// Create a vault for a new PIN. Returns the storable record and the unlocked key.
export async function createVault(pin, { iterations = PBKDF2_ITERATIONS } = {}) {
  if (!/^\d{6}$/.test(pin)) throw new Error('PIN must be 6 digits');
  const salt = rand(16);
  const kek = await deriveKek(pin, salt, iterations);
  const dataKey = await subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const iv = rand(12);
  const wrapped = await subtle().wrapKey('raw', dataKey, kek, { name: 'AES-GCM', iv });
  const record = { v: 1, kdf: 'PBKDF2-SHA-256', iterations, salt: b64(salt), iv: b64(iv), wrapped: b64(wrapped) };
  return { record, key: await openVault(record, pin) };
}

// Unlock: derive the KEK from the PIN and unwrap the data key as non-extractable.
// Throws on a wrong PIN.
export async function openVault(record, pin) {
  const kek = await deriveKek(pin, unb64(record.salt), record.iterations);
  return subtle().unwrapKey('raw', unb64(record.wrapped), kek, { name: 'AES-GCM', iv: unb64(record.iv) },
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptJson(key, obj, aad = '') {
  const iv = rand(12);
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, enc.encode(JSON.stringify(obj)));
  return { alg: 'A256GCM', iv: b64(iv), ct: b64(ct) };
}

export async function decryptJson(key, box, aad = '') {
  const pt = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(box.iv), additionalData: enc.encode(aad) }, key, unb64(box.ct));
  return JSON.parse(dec.decode(pt));
}

// ---------------------------------------------------------------- identity sealed to the hub
const INFO = enc.encode('divyadrishti-identity-v1');
const EC = { name: 'ECDH', namedCurve: 'P-256' };
const publicPart = (jwk) => ({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y });

export const generateHubKeyPair = () => subtle().generateKey(EC, true, ['deriveBits']);
export const exportJwk = (key) => subtle().exportKey('jwk', key);
export const importHubPrivateKey = (jwk) => subtle().importKey('jwk', jwk, EC, false, ['deriveBits']);

// RFC 7638 JWK thumbprint: the key id both sides can compute.
export async function jwkThumbprint(jwk) {
  const canon = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
  return b64url(await subtle().digest('SHA-256', enc.encode(canon)));
}

async function aesFromEcdh(privateKey, publicKey, usage) {
  const bits = await subtle().deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
  const hk = await subtle().importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: INFO }, hk,
    { name: 'AES-GCM', length: 256 }, false, [usage]);
}

export async function sealToHub(obj, hubPublicJwk, caseId) {
  const hubPub = await subtle().importKey('jwk', publicPart(hubPublicJwk), EC, false, []);
  const eph = await subtle().generateKey(EC, true, ['deriveBits']);
  const key = await aesFromEcdh(eph.privateKey, hubPub, 'encrypt');
  const iv = rand(12);
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(caseId) }, key, enc.encode(JSON.stringify(obj)));
  return {
    alg: 'ECDH-ES+HKDF-SHA256+A256GCM',
    kid: await jwkThumbprint(hubPublicJwk),
    epk: publicPart(await subtle().exportKey('jwk', eph.publicKey)),
    iv: b64(iv),
    ct: b64(ct),
  };
}

// Throws if the key is wrong or the sealed box was moved to another case.
export async function openFromHub(sealed, hubPrivateKey, caseId) {
  const epk = await subtle().importKey('jwk', sealed.epk, EC, false, []);
  const key = await aesFromEcdh(hubPrivateKey, epk, 'decrypt');
  const pt = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(sealed.iv), additionalData: enc.encode(caseId) }, key, unb64(sealed.ct));
  return JSON.parse(dec.decode(pt));
}
