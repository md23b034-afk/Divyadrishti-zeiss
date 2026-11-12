import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNumber, parseYesNo, parseHours, parseOptions, parseDirection } from '../../web/js/engine/parse.js';
import { QUESTION_BY_ID } from '../../web/js/engine/questions.js';

test('numbers: digits, English words, ranges', () => {
  assert.equal(parseNumber('54'), 54);
  assert.equal(parseNumber('I am 54 years old'), 54);
  assert.equal(parseNumber('fifty four'), 54);
  assert.equal(parseNumber('one hundred and two'), 102);
  assert.equal(parseNumber('two or three'), 2.5);
  assert.equal(parseNumber('2-3 hours'), 2.5);
  assert.equal(parseNumber('two and a half'), 2.5);
  assert.equal(parseNumber('nothing here'), null);
});

test('numbers: Hindi words, fractions and romanised Hindi', () => {
  assert.equal(parseNumber('चौवन', 'hi'), 54);
  assert.equal(parseNumber('अट्ठावन साल', 'hi'), 58);
  assert.equal(parseNumber('दो-तीन घंटे', 'hi'), 2.5);
  assert.equal(parseNumber('ढाई', 'hi'), 2.5);
  assert.equal(parseNumber('डेढ़ घंटा', 'hi'), 1.5);
  assert.equal(parseNumber('साढ़े तीन', 'hi'), 3.5);
  assert.equal(parseNumber('pachaas', 'hi'), 50);
  assert.equal(parseNumber('५४', 'hi'), 54);
  assert.equal(parseNumber('do', 'en'), null, 'romanised Hindi only in Hindi sessions');
});

test('numbers: Tamil formal, colloquial, compounds and halves', () => {
  assert.equal(parseNumber('ஐம்பத்தி நாலு', 'ta'), 54);
  assert.equal(parseNumber('ஐம்பத்திநாலு', 'ta'), 54);
  assert.equal(parseNumber('நாற்பத்தி ஏழு', 'ta'), 47);
  assert.equal(parseNumber('அறுபது', 'ta'), 60);
  assert.equal(parseNumber('ரெண்டு மூணு மணி நேரம்', 'ta'), 2.5);
  assert.equal(parseNumber('ரெண்டரை', 'ta'), 2.5);
  assert.equal(parseNumber('பதினஞ்சு', 'ta'), 15);
  assert.equal(parseNumber('மூவாயிரம்', 'ta'), 3000);
});

test('yes / no across languages, negation wins over "hai"', () => {
  for (const y of ['yes', 'yeah I do', 'हाँ', 'हां जी', 'शुगर है', 'ஆமா', 'ஆமாம்', 'சுகர் இருக்கு', 'aama', 'sometimes']) {
    assert.equal(parseYesNo(y), true, y);
  }
  for (const n of ['no', 'nope', 'I dont', 'नहीं', 'नहीं है', 'कभी नहीं', 'இல்லை', 'இல்லைங்க', 'கிடையாது', 'illa', 'nahi']) {
    assert.equal(parseYesNo(n), false, n);
  }
  assert.equal(parseYesNo('yes no'), null);
  assert.equal(parseYesNo(''), null);
});

test('hours per day', () => {
  assert.equal(parseHours('six hours'), 6);
  assert.equal(parseHours('30 minutes'), 0.5);
  assert.equal(parseHours('आधा घंटा', 'hi'), 0.5);
  assert.equal(parseHours('सारा दिन', 'hi'), 8);
  assert.equal(parseHours('நாள் முழுக்க', 'ta'), 8);
  assert.equal(parseHours('கொஞ்சம்', 'ta'), 0.5);
  assert.equal(parseHours('இல்லை', 'ta'), 0);
  assert.equal(parseHours('an hour'), 1);
});

test('options: longest keyword wins ("no line" is progressive, not bifocal)', () => {
  const q = QUESTION_BY_ID.glasses_type;
  assert.equal(parseOptions('the ones with no line', q.options), 'progressive');
  assert.equal(parseOptions('the ones with a line', q.options), 'bifocal');
  assert.equal(parseOptions('बिना लाइन वाला', q.options), 'progressive');
  assert.equal(parseOptions('கோடு உள்ள', q.options), 'bifocal');
});

test('options: occupations in three languages, with suffixes', () => {
  const q = QUESTION_BY_ID.occupation;
  assert.equal(parseOptions('I am an accountant', q.options), 'office');
  assert.equal(parseOptions('खेती करता हूँ', q.options), 'farmer');
  assert.equal(parseOptions('தையல் வேலை', q.options), 'tailor');
  assert.equal(parseOptions('விவசாயம்', q.options), 'farmer');
  assert.equal(parseOptions('நெசவு', q.options), 'weaver');
});

test('options: multi-select complaints and budget by number', () => {
  const c = QUESTION_BY_ID.complaint;
  assert.deepEqual(parseOptions('blurry far away and headache', c.options, { multi: true }).sort(), ['far_blur', 'strain']);
  const b = QUESTION_BY_ID.budget;
  assert.equal(parseOptions('under one thousand', b.options), 'low');
  assert.equal(parseOptions('2000', b.options), 'mid');
  assert.equal(parseOptions('two thousand', b.options), 'mid');
  assert.equal(parseOptions('more than three thousand', b.options), 'high');
  assert.equal(parseOptions('ஆயிரம் முதல் மூவாயிரம்', b.options), 'mid');
});

test('tumbling-E directions', () => {
  assert.equal(parseDirection('up'), 'up');
  assert.equal(parseDirection('नीचे'), 'down');
  assert.equal(parseDirection('இடது'), 'left');
  assert.equal(parseDirection('வலது பக்கம்'), 'right');
  assert.equal(parseDirection('left right'), null);
});
