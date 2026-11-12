import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createVault, openVault, encryptJson, decryptJson, generateHubKeyPair, exportJwk, importHubPrivateKey,
  sealToHub, openFromHub, jwkThumbprint,
} from '../../web/js/crypto.js';
import { faceQuality } from '../../web/js/measure/geometry.js';
import { buildProfile, RULES_VERSION } from '../../web/js/engine/profile.js';
import { PERSONA_BY_KEY } from '../../web/js/engine/personas.js';
import { runPersona } from './helpers.mjs';

const FAST = { iterations: 1000 }; // tests only; the app uses 310,000

test('PIN vault: right PIN decrypts, wrong PIN and tampering fail', async () => {
  const { record, key } = await createVault('246810', FAST);
  assert.ok(!JSON.stringify(record).includes('246810'));
  const box = await encryptJson(key, { name: 'R. Lakshmi', phone: '+91 94440 00387' }, 'case-1');
  assert.ok(!box.ct.includes('Lakshmi'));
  const again = await openVault(record, '246810');
  assert.deepEqual(await decryptJson(again, box, 'case-1'), { name: 'R. Lakshmi', phone: '+91 94440 00387' });
  await assert.rejects(openVault(record, '111111'), 'wrong PIN');
  await assert.rejects(decryptJson(again, box, 'case-2'), 'box bound to its case id');
  await assert.rejects(createVault('12ab'), /6 digits/);
});

test('identity sealed to the hub: only the hub key opens it, only for that case', async () => {
  const hub = await generateHubKeyPair();
  const pubJwk = await exportJwk(hub.publicKey);
  const sealed = await sealToHub({ name: 'S. Kumar', phone: '+91 98400 00421' }, pubJwk, 'case-A');
  assert.equal(sealed.kid, await jwkThumbprint(pubJwk));
  assert.ok(!JSON.stringify(sealed).includes('Kumar'));
  const priv = await importHubPrivateKey(await exportJwk(hub.privateKey));
  assert.deepEqual(await openFromHub(sealed, priv, 'case-A'), { name: 'S. Kumar', phone: '+91 98400 00421' });
  await assert.rejects(openFromHub(sealed, priv, 'case-B'), 'cannot be replayed onto another case');
  const other = await generateHubKeyPair();
  await assert.rejects(openFromHub(sealed, other.privateKey, 'case-A'), 'another hub cannot read it');
});

test('head pose gate for PD capture', () => {
  const straight = { od: { x: 200, y: 300 }, os: { x: 440, y: 300 }, bridge: { x: 321, y: 290 } };
  assert.equal(faceQuality(straight).ok, true);
  const tilted = { od: { x: 200, y: 300 }, os: { x: 440, y: 330 }, bridge: { x: 320, y: 300 } };
  assert.equal(faceQuality(tilted).ok, false);
  const turned = { od: { x: 200, y: 300 }, os: { x: 440, y: 300 }, bridge: { x: 290, y: 290 } };
  assert.equal(faceQuality(turned).ok, false);
});

test('decision path explains the lens choice, rule by rule', () => {
  const p = PERSONA_BY_KEY.kumar;
  const s = runPersona(p);
  const pr = buildProfile(s.answers, p.measure, { trace: s.trace });
  const path = pr.recommendation.decisionPath;
  assert.equal(path[0].rule, 'Red-flag lane');
  assert.equal(path.at(-1).passed, true);
  assert.ok(path.at(-1).rule.startsWith('Arm’s-length work dominates'));
  assert.ok(path.slice(0, -1).every((x) => x.passed === false || x.rule === 'Needs a reading add'));
  assert.equal(pr.rulesVersion, RULES_VERSION);
});

test('data quality: says what was measured and what was assumed', () => {
  const p = PERSONA_BY_KEY.kumar;
  const s = runPersona(p);
  const pr = buildProfile(s.answers, { ...p.measure, calibration: { screen: true, camera: true } }, { trace: s.trace });
  const near = pr.quality.items.find((i) => i.key === 'nearDistance');
  assert.ok(near.ok && near.value.includes('calibrated'));
  assert.ok(pr.quality.items.find((i) => i.key === 'answers').value.includes('by voice'));
  const bare = buildProfile({ age: 50, occupation: 'office' }, {});
  assert.equal(bare.quality.items.find((i) => i.key === 'nearDistance').ok, false);
});
