import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERSONA_BY_KEY, PERSONAS } from '../../web/js/engine/personas.js';
import { bankSize, createSession, nextQuestion, submitAnswer, undoLast, interpret } from '../../web/js/engine/adaptive.js';
import { QUESTION_BY_ID } from '../../web/js/engine/questions.js';
import { runPersona, askedIds } from './helpers.mjs';

test('every persona completes the interview from spoken answers', () => {
  for (const p of PERSONAS) {
    const s = runPersona(p);
    assert.ok(s.finishedAt, p.key);
    assert.ok(askedIds(s).length < bankSize(), `${p.key} asked fewer than the full bank`);
  }
});

test('age is always first; red flags are always asked', () => {
  for (const p of PERSONAS) {
    const ids = askedIds(runPersona(p));
    assert.equal(ids[0], 'age', p.key);
    assert.ok(ids.includes('rf_sudden') && ids.includes('rf_pain'), p.key);
  }
});

test('a red flag switches to urgent mode and drops lifestyle questions', () => {
  const s = runPersona(PERSONA_BY_KEY.ravi);
  const ids = askedIds(s);
  assert.ok(s.trace.some((t) => t.event === 'urgent_mode'));
  assert.ok(!ids.includes('occupation'));
  assert.ok(!ids.includes('glasses_now'));
  assert.ok(!ids.includes('diabetes_years'), 'non-urgent follow-ups are dropped');
  assert.ok(ids.length <= 8, `urgent path asked ${ids.length}`);
  assert.deepEqual(s.answers.rf_sudden_which, ['curtain']);
});

test('children get the child branch and skip adult questions', () => {
  const ids = askedIds(runPersona(PERSONA_BY_KEY.priya));
  for (const q of ['child_white', 'child_squint', 'child_board', 'parent_myopia', 'outdoor_hours']) assert.ok(ids.includes(q), q);
  for (const q of ['occupation', 'conditions', 'glaucoma_family', 'drives', 'falls']) assert.ok(!ids.includes(q), q);
});

test('occupation priors skip questions whose answers are already known', () => {
  const farmer = askedIds(runPersona(PERSONA_BY_KEY.murugan));
  assert.ok(!farmer.includes('screen_hours'), 'farmers are not asked about computer screens');
  assert.ok(!farmer.includes('outdoor_hours'), 'farmers are outdoors by default');
  const office = askedIds(runPersona(PERSONA_BY_KEY.kumar));
  assert.ok(office.includes('screen_hours'));
});

test('every asked question is logged with its reason', () => {
  const s = runPersona(PERSONA_BY_KEY.kumar);
  for (const t of s.trace.filter((x) => x.qid)) {
    assert.ok(t.reason && t.reason.length > 20, t.qid);
    assert.ok(t.questionEn);
  }
});

test('undo re-opens the last question', () => {
  const s = createSession({ lang: 'en' });
  submitAnswer(s, 'age', 50);
  assert.equal(nextQuestion(s).id, 'sex');
  undoLast(s);
  assert.equal(nextQuestion(s).id, 'age');
});

test('ambiguous multi-select answers are flagged for confirmation', () => {
  const r = interpret(QUESTION_BY_ID.conditions, 'sugar illa BP irukku', 'ta');
  assert.equal(r.ok, true);
  assert.equal(r.ambiguous, true);
});

test('question counts across personas (adaptive vs full bank)', () => {
  const counts = PERSONAS.map((p) => [p.key, askedIds(runPersona(p)).length]);
  const n = counts.map((c) => c[1]).sort((a, b) => a - b);
  const median = n[Math.floor(n.length / 2)];
  console.log(`bank ${bankSize()} questions; asked per persona:`, Object.fromEntries(counts), `median ${median}`);
  assert.ok(median < bankSize() * 0.7);
});
