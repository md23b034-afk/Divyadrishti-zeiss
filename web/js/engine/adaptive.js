// Adaptive anamnesis engine.
// - The bank order is the clinical order (core, red flags, medical, glasses,
//   visual tasks, preference).
// - A question is asked only if its eligibility rule says the answer can change
//   triage or the lens decision for this patient.
// - A red flag switches the session to urgent mode: only urgentOk questions
//   remain, so a possible retinal detachment is not delayed by lifestyle questions.
// - Every asked question is logged with the reason it was asked, for the
//   reviewing optometrist.

import { QUESTIONS, QUESTION_BY_ID, questionText } from './questions.js';
import { derive } from './profile.js';
import { parseYesNo, parseNumber, parseHours, parseOptions, containsAny } from './parse.js';
import { parseRxSpeech } from './rx.js';

export function createSession({ lang = 'en', id = null } = {}) {
  return { id, lang, answers: {}, trace: [], skipped: [], startedAt: new Date().toISOString(), finishedAt: null };
}

export const stateOf = (session) => ({ a: session.answers, d: derive(session.answers) });

function isEligible(q, s, session) {
  if (q.id in session.answers || session.skipped.includes(q.id)) return false;
  if (s.d.urgent && !q.urgentOk) return false;
  if (s.d.age === null && q.id !== 'age') return false; // age first: it gates everything
  try { return Boolean(q.when(s)); } catch { return false; }
}

export function nextQuestion(session) {
  const s = stateOf(session);
  return QUESTIONS.find((q) => isEligible(q, s, session)) || null;
}

// Questions that would still be asked if the remaining answers were all "no" /
// defaults. Shown to the operator as "about N more".
export function remainingEstimate(session) {
  const s = stateOf(session);
  return QUESTIONS.filter((q) => isEligible(q, s, session)).length;
}

export const bankSize = () => QUESTIONS.length;

const SKIP_WORDS = ['skip', 'pass', 'dont have', 'do not have', 'no slip', 'not available', 'छोड़ें', 'छोड़ो', 'छोड़िए', 'पर्ची नहीं',
  'தவிர்', 'வேண்டாம்', 'சீட்டு இல்லை', 'वगळा', 'चिठ्ठी नाही', 'దాటవేయి', 'చీటీ లేదు', 'ಬಿಟ್ಟುಬಿಡಿ', 'ಚೀಟಿ ಇಲ್ಲ'];

// Turn a raw spoken/typed answer into a value for question q.
// Returns { ok, value, ambiguous?, detail? }.
export function interpret(q, raw, lang = 'en') {
  if (raw === null || raw === undefined || String(raw).trim() === '') return { ok: false };
  switch (q.type) {
    case 'yesno': {
      const v = parseYesNo(raw, lang);
      return v === null ? { ok: false } : { ok: true, value: v };
    }
    case 'number': {
      const v = parseNumber(raw, lang);
      if (v === null || v < q.min || v > q.max) return { ok: false };
      return { ok: true, value: q.id === 'age' ? Math.floor(v) : v };
    }
    case 'hours': {
      const v = parseHours(raw, lang);
      return v === null ? { ok: false } : { ok: true, value: v };
    }
    case 'single': {
      const v = parseOptions(raw, q.options, { lang });
      return v === null ? { ok: false } : { ok: true, value: v };
    }
    case 'multi': {
      const hits = parseOptions(raw, q.options, { lang, multi: true });
      if (!hits.length) return { ok: false };
      const exclusive = q.options.filter((o) => o.exclusive).map((o) => o.v);
      const positives = hits.filter((h) => !exclusive.includes(h));
      if (positives.length && positives.length !== hits.length) {
        // "sugar illa, BP irukku": negation scope is unreliable, so confirm by tap
        return { ok: true, value: positives, ambiguous: true };
      }
      return { ok: true, value: hits };
    }
    case 'rx': {
      if (containsAny(raw, SKIP_WORDS) || parseYesNo(raw, lang) === false) return { ok: true, value: { skipped: true } };
      const rx = parseRxSpeech(raw);
      if (!rx.ok) return { ok: false, detail: rx };
      return { ok: true, value: { R: rx.R, L: rx.L, text: rx.text, warnings: rx.warnings }, detail: rx };
    }
    default:
      return { ok: false };
  }
}

export function submitAnswer(session, qid, value, meta = {}) {
  const q = QUESTION_BY_ID[qid];
  if (!q) throw new Error(`unknown question ${qid}`);
  const s = stateOf(session);
  const wasUrgent = s.d.urgent;
  session.answers[qid] = value;
  session.trace.push({
    qid,
    module: q.module,
    question: questionText(q, s, session.lang),
    questionEn: questionText(q, s, 'en'),
    reason: q.reason(s),
    raw: meta.raw ?? null,
    value,
    mode: meta.mode ?? 'tap', // 'voice' | 'tap' | 'typed'
    confidence: typeof meta.confidence === 'number' ? Math.round(meta.confidence * 100) / 100 : null,
    lowConfidence: Boolean(meta.lowConfidence), // speech result was uncertain and confirmed by tap
    lang: session.lang,
    at: new Date().toISOString(),
  });
  const after = derive(session.answers);
  if (!wasUrgent && after.urgent) {
    session.trace.push({ event: 'urgent_mode', at: new Date().toISOString(), reason: 'Red flag: remaining lifestyle questions dropped.' });
  }
  if (!nextQuestion(session)) session.finishedAt = session.finishedAt || new Date().toISOString();
  return session;
}

export function skipQuestion(session, qid) {
  if (!session.skipped.includes(qid)) session.skipped.push(qid);
  session.trace.push({ qid, event: 'skipped', at: new Date().toISOString() });
  if (!nextQuestion(session)) session.finishedAt = session.finishedAt || new Date().toISOString();
  return session;
}

// Undo the last answered or skipped question (and anything that only became
// eligible because of it is naturally re-evaluated).
export function undoLast(session) {
  for (let i = session.trace.length - 1; i >= 0; i--) {
    const t = session.trace[i];
    if (t.event === 'urgent_mode') { session.trace.splice(i, 1); continue; }
    if (t.event === 'skipped') { session.skipped = session.skipped.filter((x) => x !== t.qid); session.trace.splice(i); break; }
    if (t.qid) { delete session.answers[t.qid]; session.trace.splice(i); break; }
  }
  session.finishedAt = null;
  return session;
}

export const isComplete = (session) => nextQuestion(session) === null;

// Questions that were never asked because the engine judged them irrelevant.
export function notAsked(session) {
  const asked = new Set(session.trace.filter((t) => t.qid).map((t) => t.qid));
  return QUESTIONS.filter((q) => !asked.has(q.id)).map((q) => q.id);
}
