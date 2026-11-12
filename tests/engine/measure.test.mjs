import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceFromIrisMm, focalFromCalibration, distancePdFromNear, nearPdMm, measurePd, prenticePrismD, pdTolerance,
  optotypeMm, isStable, IRIS_MM,
} from '../../web/js/measure/geometry.js';
import { createStaircase, nextOptotype, respond, snellen, whoCategory } from '../../web/js/measure/acuity.js';

test('iris as a ruler: calibrate at 40 cm, then measure distance', () => {
  const f = focalFromCalibration(20, 400); // iris 20 px at 40 cm
  assert.equal(Math.round(distanceFromIrisMm(20, f)), 400);
  assert.equal(Math.round(distanceFromIrisMm(40, f)), 200); // twice as big = half the distance
});

test('convergence: near-fixation PD is converted back to distance PD', () => {
  const d = distancePdFromNear(60.5, 400);
  assert.ok(d > 61.5 && d < 62.5, `distance PD ${d}`);
  // rule of thumb: spectacle-plane near PD at 40 cm is ~3-4 mm less than distance PD
  const n = nearPdMm(63, 400);
  assert.ok(63 - n >= 3 && 63 - n <= 4.5, `near PD ${n}`);
});

test('PD from a synthetic face: iris scale is depth-independent', () => {
  // pupils 240 px apart, irises 45 px wide -> 240 * 11.7 / 45 = 62.4 mm measured
  const eyes = { od: { x: 200, y: 300 }, os: { x: 440, y: 300 }, irisPx: 45, bridge: { x: 320, y: 290 } };
  const pd = measurePd(eyes, { method: 'iris', eyeDistanceMm: 400 });
  assert.equal(pd.measuredMm, +(240 * IRIS_MM / 45).toFixed(1));
  assert.ok(pd.binocularMm > pd.measuredMm);
  assert.ok(Math.abs(pd.rightMm + pd.leftMm - pd.binocularMm) < 0.3);
});

test("Prentice's rule and PD tolerance for the patient's power", () => {
  assert.equal(prenticePrismD(5, 4), 2); // 5 mm off on a 4 D lens = 2 prism dioptres
  assert.equal(pdTolerance(2, { R: { sph: -1, cyl: 0 } }).acceptable, true);
  assert.equal(pdTolerance(4, { R: { sph: -6, cyl: -1, axis: 90 } }).acceptable, false);
});

test('optotype sizes: 6/6 at 2 m is ~2.9 mm, 6/60 ~29 mm', () => {
  assert.equal(optotypeMm(0, 2000).toFixed(1), '2.9');
  assert.equal(optotypeMm(1, 2000).toFixed(0), '29');
});

test('stability detector for camera samples', () => {
  assert.equal(isStable([400, 402, 398, 401, 399], 5, 0.04), true);
  assert.equal(isStable([400, 450, 398, 401, 399], 5, 0.04), false);
});

function simulate(trueLogmar, seed = 1) {
  let s = seed;
  const rng = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const st = createStaircase({ start: 0.6, rng });
  while (!st.done) {
    const o = nextOptotype(st);
    respond(st, o.level >= trueLogmar - 1e-9 ? o.dir : 'wrong');
  }
  return st;
}

test('acuity staircase finds the threshold for an ideal observer', () => {
  for (const t of [0, 0.1, 0.3, 0.5, 0.6, 0.8, 1.0]) {
    const st = simulate(t);
    assert.equal(st.best, t, `true ${t}, got ${st.best} after ${st.history.length} trials`);
    assert.ok(st.history.length <= 16, `${st.history.length} trials`);
  }
  assert.equal(simulate(1.3).best, null); // worse than 6/60
});

test('Snellen and WHO categories', () => {
  assert.equal(snellen(0), '6/6');
  assert.equal(snellen(0.3), '6/12');
  assert.equal(snellen(1), '6/60');
  assert.equal(whoCategory(0.5), 'moderate impairment (below 6/18)');
  assert.equal(whoCategory(0.2), 'no impairment');
});
