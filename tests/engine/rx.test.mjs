import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRxSpeech, transposeToMinusCyl, rxFindings, formatEye } from '../../web/js/engine/rx.js';

test('full dictation in words', () => {
  const r = parseRxSpeech('right eye minus two point five cylinder minus point seven five axis one eighty left eye minus two point two five cylinder minus point five axis one seventy');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(r.R, { sph: -2.5, cyl: -0.75, axis: 180, add: undefined });
  assert.deepEqual(r.L, { sph: -2.25, cyl: -0.5, axis: 170, add: undefined });
});

test('how opticians say it: "two fifty", "seventy five", add for both eyes', () => {
  const r = parseRxSpeech('right minus two fifty cyl minus seventy five axis ninety left minus one twenty five add plus two');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.R.sph, -2.5);
  assert.equal(r.R.cyl, -0.75);
  assert.equal(r.R.axis, 90);
  assert.equal(r.L.sph, -1.25);
  assert.equal(r.R.add, 2);
  assert.equal(r.L.add, 2);
});

test('digits from speech recognition, unlabeled fields in order', () => {
  const r = parseRxSpeech('R -2.5 -0.75 x 180, L -2.25 -0.5 x 170');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.R.sph, -2.5); assert.equal(r.R.cyl, -0.75); assert.equal(r.R.axis, 180);
  assert.equal(r.L.sph, -2.25); assert.equal(r.L.axis, 170);
});

test('leading-dot decimals and "one hundred and eighty"', () => {
  const r = parseRxSpeech('right eye plus 1.00 cylinder minus .5 axis one hundred and eighty');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.R.sph, 1); assert.equal(r.R.cyl, -0.5); assert.equal(r.R.axis, 180);
});

test('plus cylinder is transposed to minus cylinder', () => {
  assert.deepEqual(transposeToMinusCyl({ sph: -1, cyl: 1, axis: 90 }), { sph: 0, cyl: -1, axis: 180 });
  const r = parseRxSpeech('right eye minus one cylinder plus one axis ninety');
  assert.equal(r.R.sph, 0); assert.equal(r.R.cyl, -1); assert.equal(r.R.axis, 180);
  assert.ok(r.warnings.some((w) => w.includes('transposed')));
});

test('invalid values are rejected, not silently saved', () => {
  assert.equal(parseRxSpeech('right eye minus two point three').ok, false); // not a 0.25 step
  assert.equal(parseRxSpeech('right eye minus two cylinder minus one').ok, false); // no axis
  assert.equal(parseRxSpeech('right eye minus 30').ok, false); // out of range
});

test('clinical findings from a known prescription', () => {
  const codes = rxFindings({ R: { sph: -7, cyl: 0 }, L: { sph: -3, cyl: -0.5, axis: 90 } }).map((f) => f.code);
  assert.ok(codes.includes('ANISOMETROPIA'));
  assert.ok(codes.includes('HIGH_MYOPIA'));
  assert.equal(formatEye({ sph: -2.5, cyl: -0.75, axis: 180 }), '−2.50 / −0.75 × 180');
});
