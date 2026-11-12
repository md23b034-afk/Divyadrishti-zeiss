import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERSONA_BY_KEY } from '../../web/js/engine/personas.js';
import { buildProfile, presbyopia, visualZones } from '../../web/js/engine/profile.js';
import { runPersona } from './helpers.mjs';

const profileOf = (key) => {
  const p = PERSONA_BY_KEY[key];
  return buildProfile(runPersona(p).answers, p.measure);
};

test('Kumar (54, accountant): intermediate-dominant, office lens, green', () => {
  const pr = profileOf('kumar');
  assert.equal(pr.vision.dominance, 'intermediate');
  assert.equal(pr.vision.designEmphasis, 'Intermediate');
  assert.equal(pr.recommendation.category, 'office');
  assert.equal(pr.triage.lane, 'green');
  assert.equal(pr.presbyopia.amplitudeSource, 'measured near point');
  const blue = pr.recommendation.notes.find((n) => /blue-light/i.test(n));
  assert.ok(blue && blue.includes('not a treatment') && blue.includes('intermediate add'), 'blue-light note: optional, evidence, and the real fix');
});

test('Lakshmi (47, tailor, diabetic): readers at her measured 29 cm, amber for retina', () => {
  const pr = profileOf('lakshmi');
  assert.equal(pr.vision.dominance, 'near');
  assert.equal(pr.recommendation.category, 'readers');
  assert.equal(pr.vision.zones.near.workingDistanceCm, 29);
  assert.equal(pr.triage.lane, 'amber');
  assert.ok(pr.triage.flags.some((f) => f.code === 'DIABETES_RETINA_DUE'));
  assert.ok(pr.presbyopia.addD >= 1.75, `add ${pr.presbyopia.addD}`);
});

test('working distance changes the add: a tailor at 30 cm needs more than a reader at 40 cm', () => {
  const tailor = presbyopia({ age: 47 }, {}, { near: { workingDistanceCm: 30 } });
  const reader = presbyopia({ age: 47 }, {}, { near: { workingDistanceCm: 40 } });
  assert.equal(tailor.addD, 1.75);
  assert.equal(reader.addD, 1.0);
});

test('Hofstetter minimum amplitude tracks the usual age table at 40 cm', () => {
  const add = (age) => presbyopia({ age }, {}, { near: { workingDistanceCm: 40 } }).addD;
  assert.equal(add(30), 0);
  assert.equal(add(50), 1.25);
  assert.equal(add(55), 2.0);
  assert.equal(add(60), 2.5);
});

test('Murugan (62, farmer): distance-dominant, low budget bifocal, cataract suspicion', () => {
  const pr = profileOf('murugan');
  assert.equal(pr.vision.dominance, 'distance');
  assert.equal(pr.recommendation.category, 'bifocal');
  assert.equal(pr.triage.lane, 'amber');
  const cat = pr.triage.flags.find((f) => f.code === 'CATARACT_SUSPECT');
  assert.ok(cat && cat.detail.includes('pinhole'));
  assert.ok(pr.recommendation.coatings.some((c) => c.includes('UV')));
});

test('Priya (9): high myopia risk, child refraction, amber', () => {
  const pr = profileOf('priya');
  assert.equal(pr.myopiaRisk.level, 'high');
  assert.equal(pr.recommendation.category, 'child_refraction');
  assert.equal(pr.triage.lane, 'amber');
  assert.ok(pr.recommendation.example.includes('MyoCare'));
  assert.equal(pr.presbyopia, null);
});

test('Ravi: red lane, no glasses today', () => {
  const pr = profileOf('ravi');
  assert.equal(pr.triage.lane, 'red');
  assert.equal(pr.recommendation.category, 'urgent_referral');
  assert.ok(!pr.checks.includes('pd'));
});

test('Fatima (68, after cataract surgery, falls): pseudophakic add and separate pairs', () => {
  const pr = profileOf('fatima');
  assert.equal(pr.presbyopia.status, 'pseudophakic');
  assert.equal(pr.recommendation.category, 'separate_pairs');
  assert.ok(pr.presbyopia.addD >= 2.25);
});

test('Arjun (24): single vision distance, green', () => {
  const pr = profileOf('arjun');
  assert.equal(pr.recommendation.category, 'sv_distance');
  assert.equal(pr.triage.lane, 'green');
});

test('Selvi (44, weaver): symptomatic early presbyope, office lens for close + loom work', () => {
  const pr = profileOf('selvi');
  assert.ok(pr.presbyopia.addD >= 0.75);
  assert.equal(pr.recommendation.category, 'office');
});

test('measured reading distance overrides the occupation default', () => {
  const v1 = visualZones({ age: 50, occupation: 'office' }, {});
  const v2 = visualZones({ age: 50, occupation: 'office' }, { readingDistanceCm: 30 });
  assert.equal(v1.zones.near.distanceSource, 'typical for occupation');
  assert.equal(v2.zones.near.distanceSource, 'measured');
  assert.equal(v2.zones.near.demandD, 3.25);
});
