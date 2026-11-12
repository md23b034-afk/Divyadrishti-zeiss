// Spoken spectacle prescription -> validated SPH / CYL / AXIS / ADD per eye.
// Handles how Indian opticians dictate: "right eye minus two fifty, cylinder
// minus point seven five, axis one eighty", "R -2.5 -0.75 x 180", "add plus two".
// Values are validated against real lens steps (0.25 D) and plus-cylinder is
// transposed to the minus-cylinder convention.

import { normalize } from './parse.js';

const UNITS = { zero: 0, oh: 0, nil: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
const TEENS = { ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

const MARKERS = {
  EYE_R: ['right', 'r', 're', 'od', 'rt', 'दायाँ', 'दायां', 'दाईं', 'दाहिनी', 'दायीं', 'दाएं', 'வலது', 'उजवा', 'उजवी', 'కుడి', 'ಬಲ'],
  EYE_L: ['left', 'l', 'le', 'os', 'lt', 'बायाँ', 'बायां', 'बाईं', 'बायीं', 'बाएं', 'இடது', 'डावा', 'डावी', 'ఎడమ', 'ಎಡ'],
  BOTH: ['both', 'ou', 'दोनों', 'இரண்டு', 'दोन्ही', 'రెండు', 'ಎರಡೂ'],
  SAME: ['same', 'similar', 'वही', 'அதே', 'तेच', 'అదే', 'ಅದೇ'],
  F_SPH: ['sph', 'sphere', 'spherical', 'sp', 'spherical power', 'power', 'number'],
  F_CYL: ['cyl', 'cylinder', 'cylindrical', 'cy', 'सिलेंडर', 'சிலிண்டர்'],
  F_AXIS: ['axis', 'ax', 'x', 'at', 'एक्सिस', 'ஆக்சிஸ்'],
  F_ADD: ['add', 'addition', 'near', 'reading', 'ऐड', 'ஆட்'],
  MINUS: ['minus', 'negative', 'माइनस', 'மைனஸ்'],
  PLUS: ['plus', 'positive', 'प्लस', 'ப்ளஸ்'],
  POINT: ['point', 'dot', 'पॉइंट', 'பாயிண்ட்'],
  PLANO: ['plano', 'plain', 'pl'],
  SKIP: ['eye', 'eyes', 'आँख', 'आंख', 'கண்', 'डोळा', 'కన్ను', 'ಕಣ್ಣು', 'and', 'with', 'degree', 'degrees', 'd', 'dioptre', 'diopter', 'dioptres', 'diopters', 'the', 'is'],
};
const MARKER_OF = new Map();
for (const [m, words] of Object.entries(MARKERS)) for (const w of words) MARKER_OF.set(normalize(w), m);

function tokenize(text) {
  // signs and leading-dot decimals must be read before normalize(), which
  // would otherwise treat "2.5 -0.75" as a range and drop the dot in ".75"
  let s = (text ?? '').toString().replace(/−/g, '-').replace(/×/g, ' x ');
  s = s.replace(/(^|[\s,;:(/])-\s*(?=\.?\d)/g, '$1 minus ').replace(/(^|[\s,;:(/])\+\s*(?=\.?\d)/g, '$1 plus ');
  s = s.replace(/(^|[^\d])\.(\d)/g, '$1 point $2');
  s = s.replace(/(\d)\s*[x×]\s*(\d)/gi, '$1 x $2').replace(/(\d)\s*°/g, '$1');
  s = normalize(s);
  const raw = s.split(' ').filter(Boolean);
  const toks = [];
  for (let i = 0; i < raw.length; i++) {
    const w = raw[i];
    if (/^\d+\.\d+$/.test(w)) { toks.push({ t: 'NUM', n: Number(w), dec: true, raw: w }); continue; }
    if (/^\d+$/.test(w)) { toks.push({ t: 'NUM', n: Number(w), dec: false, raw: w }); continue; }
    if (w in UNITS) { toks.push({ t: 'NUM', n: UNITS[w], dec: false, raw: String(UNITS[w]), word: true }); continue; }
    if (w in TEENS) { toks.push({ t: 'NUM', n: TEENS[w], dec: false, raw: String(TEENS[w]), word: true }); continue; }
    if (w in TENS) {
      const next = raw[i + 1];
      if (next in UNITS && UNITS[next] > 0) { // "seventy five" -> 75
        const n = TENS[w] + UNITS[next];
        toks.push({ t: 'NUM', n, dec: false, raw: String(n), word: true }); i++; continue;
      }
      toks.push({ t: 'NUM', n: TENS[w], dec: false, raw: String(TENS[w]), word: true }); continue;
    }
    if (w === 'hundred') {
      const prev = toks[toks.length - 1];
      if (prev && prev.t === 'NUM') { prev.n *= 100; prev.raw = String(prev.n); }
      else toks.push({ t: 'NUM', n: 100, dec: false, raw: '100' });
      let k = i + 1;
      if (raw[k] === 'and') k++; // "one hundred and eighty"
      const next = raw[k];
      if (prev && next && (next in TENS || next in TEENS || /^\d{1,2}$/.test(next))) {
        let add = next in TENS ? TENS[next] : next in TEENS ? TEENS[next] : Number(next);
        if (next in TENS && raw[k + 1] in UNITS) { add += UNITS[raw[k + 1]]; k++; }
        prev.n += add; prev.raw = String(prev.n);
        i = k;
      }
      continue;
    }
    const m = MARKER_OF.get(w);
    if (m === 'SKIP') continue;
    if (m === 'PLANO') { toks.push({ t: 'NUM', n: 0, dec: true, raw: '0.00' }); continue; }
    if (m) { toks.push({ t: m }); continue; }
    toks.push({ t: 'WORD', w });
  }
  return toks;
}

// Interpret a run of number tokens for a power field (dioptres).
// Returns [value, tokensConsumed].
function takePower(seq) {
  const pi = seq.findIndex((x) => x.t === 'POINT');
  if (pi !== -1 && pi <= 1) {
    const intPart = pi === 1 ? seq[0].raw : '0';
    let frac = '';
    let j = pi + 1;
    while (j < seq.length && seq[j].t === 'NUM' && !seq[j].dec && frac.length + seq[j].raw.length <= 2) {
      frac += seq[j].raw; j++;
    }
    if (!frac) frac = '0';
    return [Number(`${intPart}.${frac}`), j];
  }
  const a = seq[0];
  if (a.dec) return [a.n, 1];
  const b = seq[1];
  if (b && b.t === 'NUM' && !b.dec && a.n <= 20 && ([25, 50, 75].includes(b.n) || b.raw === '00')) {
    return [a.n + b.n / 100, 2]; // "two fifty" -> 2.50
  }
  if ([25, 50, 75].includes(a.n)) return [a.n / 100, 1]; // "seventy five" -> 0.75
  return [a.n, 1];
}

function takeAxis(seq) {
  const a = seq[0];
  const b = seq[1];
  if (a.n === 1 && b && b.t === 'NUM' && b.n >= 10 && b.n <= 80) return [100 + b.n, 2]; // "one eighty"
  const singles = [];
  for (const x of seq) { if (x.t === 'NUM' && !x.dec && x.raw.length === 1) singles.push(x.raw); else break; }
  if (singles.length >= 2 && singles.length <= 3) {
    const n = Number(singles.join(''));
    if (n <= 180) return [n, singles.length]; // "one eight zero"
  }
  return [Math.round(a.n), 1];
}

const FIELD_ORDER = ['sph', 'cyl', 'axis'];
const FIELD_OF = { F_SPH: 'sph', F_CYL: 'cyl', F_AXIS: 'axis', F_ADD: 'add' };

export function parseRxSpeech(text) {
  const toks = tokenize(text);
  const eyes = { R: {}, L: {} };
  const warnings = [];
  let eye = 'R';
  let sawEye = false;
  let field = null;
  let sign = null;
  let copyBoth = false;
  const nextDefault = (e) => FIELD_ORDER.find((f) => eyes[e][f] === undefined) || 'add';

  let i = 0;
  while (i < toks.length) {
    const tk = toks[i];
    if (tk.t === 'EYE_R' || tk.t === 'EYE_L') {
      eye = tk.t === 'EYE_R' ? 'R' : 'L'; sawEye = true; field = null; sign = null; i++; continue;
    }
    if (tk.t === 'BOTH') { copyBoth = true; i++; continue; }
    if (tk.t === 'SAME') { if (eye === 'L') eyes.L = { ...eyes.R }; i++; continue; }
    if (FIELD_OF[tk.t]) { field = FIELD_OF[tk.t]; i++; continue; }
    if (tk.t === 'MINUS' || tk.t === 'PLUS') { sign = tk.t; i++; continue; }
    if (tk.t === 'NUM' || tk.t === 'POINT') {
      let j = i;
      const seq = [];
      while (j < toks.length && (toks[j].t === 'NUM' || toks[j].t === 'POINT')) { seq.push(toks[j]); j++; }
      let k = 0;
      while (k < seq.length) {
        const f = field || nextDefault(eye);
        if (seq[k].t === 'POINT' && seq.length - k === 1) { k++; continue; }
        const [v, used] = f === 'axis' ? takeAxis(seq.slice(k)) : takePower(seq.slice(k));
        let val = v;
        if (f === 'sph' || f === 'cyl') {
          if (sign === 'MINUS') val = -Math.abs(v);
          else if (sign === 'PLUS') val = Math.abs(v);
          else if (v !== 0) warnings.push(`${eye} ${f.toUpperCase()}: sign not spoken, read as plus`);
        }
        if (f === 'add') val = Math.abs(v);
        if (eyes[eye][f] !== undefined && f !== 'add') warnings.push(`${eye} ${f.toUpperCase()} spoken twice; kept the last value`);
        eyes[eye][f] = val;
        field = null; sign = null;
        k += Math.max(1, used);
      }
      i = j; continue;
    }
    i++; // unknown word
  }
  if (!sawEye && copyBoth) eyes.L = { ...eyes.R };
  if (copyBoth && sawEye && Object.keys(eyes.L).length === 0) eyes.L = { ...eyes.R };
  // a single "add" usually applies to both eyes
  if (eyes.R.add !== undefined && eyes.L.add === undefined && Object.keys(eyes.L).length) eyes.L.add = eyes.R.add;
  if (eyes.L.add !== undefined && eyes.R.add === undefined && Object.keys(eyes.R).length) eyes.R.add = eyes.L.add;
  return validateRx(eyes, warnings);
}

const isStep = (v, step = 0.25) => Math.abs(v / step - Math.round(v / step)) < 0.02;
const snap = (v, step = 0.25) => Math.round(v / step) * step;

export function transposeToMinusCyl({ sph, cyl, axis }) {
  if (!(cyl > 0)) return { sph, cyl, axis };
  const ax = axis <= 90 ? axis + 90 : axis - 90;
  return { sph: sph + cyl, cyl: -cyl, axis: ax };
}

export function validateRx(eyes, warnings = []) {
  const errors = [];
  const out = {};
  for (const e of ['R', 'L']) {
    const src = eyes[e] || {};
    if (!Object.keys(src).length) { out[e] = null; continue; }
    let { sph = 0, cyl = 0, axis, add } = src;
    if (Math.abs(sph) > 20) errors.push(`${e} SPH ${sph} is outside ±20.00 D`);
    else if (!isStep(sph)) errors.push(`${e} SPH ${sph} is not a 0.25 D step`);
    else sph = snap(sph);
    if (Math.abs(cyl) > 8) errors.push(`${e} CYL ${cyl} is outside ±8.00 D`);
    else if (!isStep(cyl)) errors.push(`${e} CYL ${cyl} is not a 0.25 D step`);
    else cyl = snap(cyl);
    if (cyl !== 0) {
      if (axis === undefined) errors.push(`${e} has a cylinder but no axis`);
      else if (axis === 0) axis = 180;
      else if (axis < 0 || axis > 180) errors.push(`${e} axis ${axis} must be 1-180°`);
    } else {
      axis = undefined;
    }
    if (add !== undefined) {
      if (add < 0.75 || add > 4) errors.push(`${e} ADD +${add} is outside +0.75 to +4.00`);
      else if (!isStep(add)) errors.push(`${e} ADD ${add} is not a 0.25 D step`);
      else add = snap(add);
    }
    let rx = { sph, cyl, axis, add };
    if (cyl > 0 && axis !== undefined) {
      rx = { ...transposeToMinusCyl(rx), add };
      warnings.push(`${e} transposed from plus to minus cylinder`);
    }
    out[e] = rx;
  }
  const ok = errors.length === 0 && (out.R || out.L);
  return { R: out.R, L: out.L, ok: Boolean(ok), errors, warnings, text: ok ? formatRx(out) : '' };
}

export const sphericalEquivalent = (rx) => (rx ? rx.sph + (rx.cyl || 0) / 2 : null);

const fmtD = (v) => (v === 0 ? '0.00' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`);
export function formatEye(rx) {
  if (!rx) return '—';
  let s = rx.sph === 0 && !rx.cyl ? 'plano' : fmtD(rx.sph);
  if (rx.cyl) s += ` / ${fmtD(rx.cyl)} × ${rx.axis}`;
  if (rx.add) s += `  Add ${fmtD(rx.add)}`;
  return s;
}
export function formatRx(rx) {
  return `R ${formatEye(rx.R)}   L ${formatEye(rx.L)}`;
}

// Clinical checks on a known prescription (flags feed the triage engine).
export function rxFindings(rx) {
  const f = [];
  if (!rx || (!rx.R && !rx.L)) return f;
  const seR = sphericalEquivalent(rx.R);
  const seL = sphericalEquivalent(rx.L);
  if (seR !== null && seL !== null && Math.abs(seR - seL) >= 2) {
    f.push({ code: 'ANISOMETROPIA', diff: Math.abs(seR - seL) });
  }
  for (const [e, se] of [['R', seR], ['L', seL]]) {
    if (se !== null && se <= -6) f.push({ code: 'HIGH_MYOPIA', eye: e, se });
    if (se !== null && se >= 5) f.push({ code: 'HIGH_HYPEROPIA', eye: e, se });
  }
  for (const e of ['R', 'L']) {
    if (rx[e] && Math.abs(rx[e].cyl || 0) >= 3) f.push({ code: 'HIGH_ASTIGMATISM', eye: e, cyl: rx[e].cyl });
  }
  return f;
}
