import { createSession, nextQuestion, interpret, submitAnswer } from '../../web/js/engine/adaptive.js';

// Run a persona through the adaptive interview using its spoken answers.
export function runPersona(p) {
  const session = createSession({ lang: p.lang, id: p.key });
  for (let guard = 0; guard < 60; guard++) {
    const q = nextQuestion(session);
    if (!q) return session;
    const raw = p.say[q.id];
    if (raw === undefined) throw new Error(`${p.key}: asked "${q.id}" but has no scripted answer`);
    const r = interpret(q, raw, q.asr || p.lang);
    if (!r.ok) throw new Error(`${p.key}: could not parse "${raw}" for ${q.id}`);
    submitAnswer(session, q.id, r.value, { raw, mode: 'voice' });
  }
  throw new Error('interview did not finish');
}

export const askedIds = (session) => session.trace.filter((t) => t.qid && !t.event).map((t) => t.qid);
