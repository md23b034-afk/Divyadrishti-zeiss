// Tumbling-E visual acuity staircase (logMAR 1.0 = 6/60 ... 0.0 = 6/6).
// The patient points where the "fingers" of the E point; the operator swipes
// or taps that direction (as in Peek Acuity), or the patient says it.
// A level passes with 2 correct, fails with 2 wrong (max 3 shown).

export const LEVELS = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0];
export const DIRECTIONS = ['right', 'down', 'left', 'up'];
const r1 = (x) => Math.round(x * 10) / 10;

export function createStaircase({ start = 0.6, rng = Math.random } = {}) {
  return { level: start, correct: 0, wrong: 0, passed: [], failed: [], history: [], done: false, best: null, rng, current: null, lastDir: null };
}

export function nextOptotype(st) {
  let dir;
  do { dir = DIRECTIONS[Math.floor(st.rng() * 4)]; } while (dir === st.lastDir);
  st.lastDir = dir;
  st.current = { level: st.level, dir };
  return st.current;
}

export function respond(st, answeredDir) {
  if (st.done || !st.current) return st;
  const ok = answeredDir === st.current.dir;
  st.history.push({ level: st.level, shown: st.current.dir, answered: answeredDir, ok });
  if (ok) st.correct++; else st.wrong++;
  st.current = null;
  if (st.correct >= 2 || st.wrong >= 2) {
    (st.correct >= 2 ? st.passed : st.failed).push(st.level);
    st.correct = 0; st.wrong = 0;
    advance(st);
  }
  return st;
}

function advance(st) {
  const P = st.passed.length ? Math.min(...st.passed) : null;
  if (P === null) {
    const up = r1(Math.max(...st.failed) + 0.2);
    if (Math.max(...st.failed) >= 1.0) { st.done = true; st.best = null; return; } // worse than 6/60
    st.level = Math.min(1.0, up);
    return;
  }
  if (P === 0) { st.done = true; st.best = 0; return; }
  const below = st.failed.filter((f) => f < P);
  const F = below.length ? Math.max(...below) : null;
  if (F !== null && r1(P - F) <= 0.1) { st.done = true; st.best = P; return; }
  st.level = F !== null ? r1(P - 0.1) : Math.max(0, r1(P - 0.2));
  if (st.passed.includes(st.level) || st.failed.includes(st.level)) { st.done = true; st.best = P; }
}

// Standard logMAR-chart labels (metric Snellen equivalents).
const SNELLEN = { '0': '6/6', '0.1': '6/7.5', '0.2': '6/9.5', '0.3': '6/12', '0.4': '6/15', '0.5': '6/19', '0.6': '6/24', '0.7': '6/30', '0.8': '6/38', '0.9': '6/48', '1': '6/60' };
export const snellen = (logmar) => (logmar === null || logmar === undefined || logmar > 1.0 ? '<6/60' : SNELLEN[String(r1(logmar))] || `6/${+(6 * 10 ** logmar).toFixed(1)}`);

// WHO presenting-acuity categories (better eye).
export function whoCategory(logmar) {
  if (logmar === null || logmar > 1.0) return 'severe or worse (below 6/60)';
  if (logmar > 0.48) return 'moderate impairment (below 6/18)';
  if (logmar > 0.3) return 'mild impairment (below 6/12)';
  return 'no impairment';
}
