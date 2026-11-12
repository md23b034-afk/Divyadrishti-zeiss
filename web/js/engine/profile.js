// Functional Vision Profile + triage + lens-category recommendation.
// Deterministic, explainable rules: every output carries its reason and an
// evidence key (see docs/CLINICAL_LOGIC.md). Proposed rules, to be reviewed
// with optometrists before clinical use. The optometrist confirms every power.

import { rxFindings } from './rx.js';

// Typical hours/day per zone and habitual near working distance by occupation.
// inter = non-screen arm's-length work (counter, cooking, loom, dashboard);
// screen = default computer hours. Starting priors, refined by answers and by
// the camera-measured reading distance.
export const OCC_PRIORS = {
  farmer: { near: 1, inter: 1, screen: 0, far: 6, nearCm: 40 },
  fisher: { near: 2, inter: 1, screen: 0, far: 6, nearCm: 35 },
  driver: { near: 1, inter: 2, screen: 0, far: 7, nearCm: 40 },
  labour: { near: 1, inter: 2, screen: 0, far: 5, nearCm: 40 },
  tailor: { near: 6, inter: 1, screen: 0, far: 1, nearCm: 30 },
  weaver: { near: 3, inter: 4, screen: 0, far: 1, nearCm: 45 },
  fine: { near: 7, inter: 1, screen: 0, far: 1, nearCm: 25 },
  shop: { near: 2, inter: 3, screen: 1, far: 2, nearCm: 40 },
  homemaker: { near: 2, inter: 3, screen: 0, far: 2, nearCm: 40 },
  teacher: { near: 3, inter: 1, screen: 1, far: 3, nearCm: 40 },
  office: { near: 2, inter: 1, screen: 5, far: 1, nearCm: 40 },
  student: { near: 5, inter: 1, screen: 1, far: 1, nearCm: 33 },
  health: { near: 2, inter: 2, screen: 0, far: 3, nearCm: 40 },
  retired: { near: 3, inter: 2, screen: 0, far: 2, nearCm: 40 },
  other: { near: 2, inter: 2, screen: 0, far: 3, nearCm: 40 },
};
const OUTDOOR_JOBS = ['farmer', 'fisher', 'driver', 'labour'];
const INTERMEDIATE_CM = 66;

const round025 = (v) => Math.round(v * 4) / 4;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const has = (arr, v) => Array.isArray(arr) && arr.includes(v);

export function derive(a = {}) {
  const age = typeof a.age === 'number' ? a.age : null;
  const isChild = age !== null && age < 16;
  const occ = isChild ? 'student' : a.occupation ?? null;
  const pseudophakic = a.eye_surgery === 'cataract';
  const presbyopeLikely = age !== null && (age >= 40 || pseudophakic || (age >= 35 && has(a.complaint, 'near_blur')));
  const urgent = a.rf_sudden === true || a.rf_pain_severe === true || a.child_white === true;
  const diabetic = has(a.conditions, 'diabetes');
  return { age, isChild, occ, pseudophakic, presbyopeLikely, urgent, diabetic };
}

// ------------------------------------------------------------------ zones
export function visualZones(a, m = {}) {
  const d = derive(a);
  const p = OCC_PRIORS[d.occ] || OCC_PRIORS.other;
  const src = {};
  let near; let inter; let far;
  if (d.isChild) {
    near = a.near_hours ?? 3; src.near = a.near_hours != null ? 'reported' : 'assumed';
    inter = 1; src.inter = 'assumed';
    far = Math.max(1, a.outdoor_hours ?? 1.5); src.far = a.outdoor_hours != null ? 'reported' : 'assumed';
  } else {
    near = a.near_hours ?? p.near; src.near = a.near_hours != null ? 'reported' : 'occupation';
    const screen = a.screen_hours ?? p.screen;
    inter = p.inter + screen; src.inter = a.screen_hours != null ? 'reported' : 'occupation';
    far = a.outdoor_hours ?? p.far;
    if (a.drives === true && !OUTDOOR_JOBS.includes(d.occ)) far += 1;
    far = Math.max(1, far); src.far = a.outdoor_hours != null ? 'reported' : 'occupation';
  }
  const total = near + inter + far;
  const zones = {
    near: { hours: near, share: near / total, source: src.near },
    intermediate: { hours: inter, share: inter / total, source: src.inter },
    distance: { hours: far, share: far / total, source: src.far },
  };
  const measuredCm = m.readingDistanceCm ? Math.round(m.readingDistanceCm) : null;
  const nearCm = measuredCm ?? (d.isChild ? 33 : p.nearCm);
  zones.near.workingDistanceCm = nearCm;
  zones.near.distanceSource = measuredCm ? 'measured' : 'typical for occupation';
  zones.near.demandD = round025(100 / nearCm);
  zones.intermediate.workingDistanceCm = INTERMEDIATE_CM;
  zones.intermediate.demandD = round025(100 / INTERMEDIATE_CM);

  const ranked = Object.entries(zones).sort((x, y) => y[1].share - x[1].share);
  const [top, second] = ranked;
  const dominance = top[1].share >= 0.45 && top[1].share - second[1].share >= 0.12 ? top[0] : 'balanced';
  // ZEISS individual progressive designs take exactly this input:
  // Balanced, Intermediate or Near viewing-zone emphasis.
  const designEmphasis = dominance === 'near' ? 'Near' : dominance === 'intermediate' ? 'Intermediate' : 'Balanced';
  const reported = Object.values(src).filter((x) => x === 'reported').length;
  return { zones, dominance, designEmphasis, inputsReported: reported, nearDistanceMeasured: Boolean(measuredCm) };
}

// ------------------------------------------------------------------ accommodation / add
// Hofstetter (1950): minimum expected amplitude = 15 - 0.25 * age (D).
// Tentative add = near demand - half the amplitude (keep half in reserve).
export function presbyopia(a, m = {}, zones) {
  const d = derive(a);
  if (d.age === null) return null;
  const hofMin = Math.max(0, 15 - 0.25 * d.age);
  const hofAvg = Math.max(0, 18.5 - 0.3 * d.age);
  let ampD; let ampSource;
  if (d.pseudophakic) { ampD = 0.5; ampSource = 'after cataract surgery (no natural focusing)'; }
  else if (m.nearPointCm) { ampD = 100 / m.nearPointCm; ampSource = 'measured near point'; }
  else { ampD = hofMin; ampSource = 'age (Hofstetter minimum)'; }
  const nearCm = zones?.near?.workingDistanceCm ?? 40;
  const demand = 100 / nearCm;
  let add = clamp(round025(demand - ampD / 2), 0, 3.5);
  // The half-amplitude rule under-calls symptomatic early presbyopes: a 44-year-old
  // who already struggles up close is usually given at least +0.75.
  const symptomatic = has(a.complaint, 'near_blur') || a.glasses_ok === 'near_blur';
  if (symptomatic && d.age >= 38 && add < 0.75) add = 0.75;
  const interAdd = clamp(round025(100 / INTERMEDIATE_CM - ampD / 2), 0, 2.5);
  let status = 'none';
  if (d.pseudophakic) status = 'pseudophakic';
  else if (add >= 1.25) status = 'established';
  else if (add >= 0.5) status = 'early';
  return {
    status,
    amplitudeD: Math.round(ampD * 10) / 10,
    amplitudeSource: ampSource,
    expectedAmplitudeD: { min: Math.round(hofMin * 10) / 10, avg: Math.round(hofAvg * 10) / 10 },
    workingDistanceCm: nearCm,
    nearDemandD: round025(demand),
    addD: add,
    addRangeD: add > 0 ? [Math.max(0.5, add - 0.25), Math.min(3.5, add + 0.25)] : null,
    intermediateAddD: interAdd,
    measuredNearPoint: Boolean(m.nearPointCm) && !d.pseudophakic,
  };
}

// ------------------------------------------------------------------ child myopia risk
export function myopiaRisk(a, m = {}) {
  const d = derive(a);
  if (!d.isChild) return null;
  let score = 0;
  const factors = [];
  if (a.outdoor_hours != null && a.outdoor_hours < 2) { score += 2; factors.push(`outdoors only ${a.outdoor_hours} h/day (under 2 h)`); }
  if (a.near_hours != null && a.near_hours > 5) { score += 2; factors.push(`${a.near_hours} h/day of close work`); }
  else if (a.near_hours != null && a.near_hours > 3) { score += 1; factors.push(`${a.near_hours} h/day of close work`); }
  if (a.parent_myopia === 'both') { score += 2; factors.push('both parents short-sighted'); }
  else if (a.parent_myopia === 'one') { score += 1; factors.push('one parent short-sighted'); }
  if (m.readingDistanceCm && m.readingDistanceCm < 25) { score += 1; factors.push(`holds books/phone at ${Math.round(m.readingDistanceCm)} cm (measured)`); }
  if (a.child_board === true) { score += 2; factors.push('trouble seeing the school board'); }
  if (d.age < 10 && score > 0) { score += 1; factors.push('younger child: faster progression if myopia starts early'); }
  const level = score >= 4 ? 'high' : score >= 2 ? 'moderate' : 'low';
  return { score, level, factors };
}

// ------------------------------------------------------------------ acuity helpers
const worstLogmar = (acuity) => {
  if (!acuity) return null;
  const v = ['R', 'L'].map((e) => acuity[e]?.logmar).filter((x) => typeof x === 'number');
  return v.length ? Math.max(...v) : null;
};

// ------------------------------------------------------------------ flags / triage
const flag = (lane, code, title, detail, ref, action) => ({ lane, code, title, detail, ref, action });

export function triage(a, m = {}, extras = {}) {
  const d = derive(a);
  const f = [];
  // ---- red: same-day referral
  if (a.rf_sudden === true) {
    const which = (a.rf_sudden_which || []).join(', ') || 'unspecified';
    f.push(flag('red', 'SUDDEN_VISION_CHANGE', 'Sudden change in vision',
      `Reported: ${which}. Possible retinal detachment, vascular occlusion or neurological cause.`,
      'redflags', 'Same-day ophthalmologist. Do not dispense glasses today.'));
  }
  if (a.rf_pain_severe === true) {
    f.push(flag('red', 'PAINFUL_RED_EYE', 'Painful red eye with blur, haloes or injury',
      'Possible acute angle-closure glaucoma, keratitis, chemical or mechanical injury.',
      'redflags', 'Same-day ophthalmologist. If a chemical splash: rinse with clean water for 15 minutes first.'));
  }
  if (a.child_white === true) {
    f.push(flag('red', 'LEUKOCORIA', 'White pupil reflex in a child',
      'Leukocoria can indicate congenital cataract or retinoblastoma.', 'leukocoria',
      'Urgent paediatric ophthalmology referral this week.'));
  }
  // ---- amber: optometrist / doctor review, scheduled
  if (a.rf_pain === true && a.rf_pain_severe !== true) {
    f.push(flag('amber', 'RED_EYE', 'Red or uncomfortable eye', 'No blur, haloes or injury reported.',
      'redflags', 'Optometrist review within 2-3 days; sooner if it worsens.'));
  }
  if (d.diabetic && a.retina_exam && a.retina_exam !== 'within_1y') {
    const yrs = a.diabetes_years != null ? `${a.diabetes_years} years of diabetes; ` : '';
    f.push(flag('amber', 'DIABETES_RETINA_DUE', 'Diabetic retina check overdue',
      `${yrs}last dilated retina check: ${a.retina_exam === 'never' ? 'never' : 'over a year ago'}.`,
      'diabetes', 'Dilated fundus exam or retinal photo at the next camp or vision centre.'));
  }
  if (a.glaucoma_family === true && d.age >= 40) {
    f.push(flag('amber', 'GLAUCOMA_FAMILY', 'Family history of glaucoma, age 40+',
      'First-degree relatives have a markedly higher risk; glaucoma is painless until late.', 'glaucoma',
      'Eye pressure and optic-nerve check.'));
  }
  const cataractSigns = [];
  if (d.age >= 50 && a.night_glare === true) cataractSigns.push('night glare or faded colours');
  if (d.age >= 50 && a.frequent_change === true) cataractSigns.push('power changing often');
  const wl = worstLogmar(m.acuity);
  const pinholeFailed = ['R', 'L'].some((e) => m.acuity?.[e]?.logmar >= 0.5 && m.acuity?.[e]?.pinholeImproved === false);
  if (d.age >= 50 && pinholeFailed) cataractSigns.push('reduced vision not improved by pinhole');
  if (cataractSigns.length && !d.pseudophakic) {
    f.push(flag('amber', 'CATARACT_SUSPECT', 'Possible cataract', cataractSigns.join('; ') + '.', 'cataract',
      'Slit-lamp exam at the next camp or vision centre; cataract surgery restores sight better than new glasses.'));
  } else if (a.frequent_change === true) {
    f.push(flag('amber', 'UNSTABLE_POWER', 'Glasses power changing often',
      'Check blood sugar control, cataract and keratoconus.', 'cataract', 'Optometrist review before a new prescription.'));
  }
  if (pinholeFailed && !(d.age >= 50 && cataractSigns.length)) {
    f.push(flag('amber', 'VA_UNEXPLAINED', 'Reduced vision not explained by glasses',
      'Vision 6/18 or worse that a pinhole does not improve points to eye disease, not refractive error.',
      'pinhole', 'Optometrist or ophthalmologist examination.'));
  }
  if (wl !== null && wl > 1.0) {
    f.push(flag('amber', 'SEVERE_VI', 'Vision worse than 6/60 in at least one eye',
      'Severe visual impairment or worse.', 'who_vi', 'Full eye examination; check for cataract.'));
  }
  if (m.amsler && (m.amsler.R === 'abnormal' || m.amsler.L === 'abnormal')) {
    f.push(flag('amber', 'AMSLER_DISTORTION', 'Wavy or missing lines on the central grid',
      `Eye: ${['R', 'L'].filter((e) => m.amsler[e] === 'abnormal').join(' & ')}. Possible macular disease (AMD, diabetic macular oedema).`,
      'amsler', 'Macula check within 1-2 weeks; same day if it started suddenly.'));
  }
  if (a.child_squint === true) {
    f.push(flag('amber', 'CHILD_SQUINT', 'Squint or head tilt in a child', 'Risk of amblyopia (lazy eye).',
      'amblyopia', 'Paediatric optometrist or ophthalmologist within weeks: treatable only in childhood.'));
  }
  if (a.child_board === true) {
    f.push(flag('amber', 'CHILD_REFRACTION', 'Child likely needs glasses',
      'Difficulty with the school board. Children need cycloplegic refraction; phone estimates are unsafe.',
      'child_refraction', 'Cycloplegic refraction by an optometrist.'));
  }
  if (a.glasses_type === 'progressive' && a.glasses_ok === 'discomfort') {
    f.push(flag('amber', 'PROGRESSIVE_INTOLERANCE', 'Discomfort with current progressives',
      'Often a fitting-height or PD error rather than the power.', 'centration',
      'Check centration (PD, fitting height) before changing the lens.'));
  }
  for (const x of extras.rxFindings || []) {
    if (x.code === 'ANISOMETROPIA') f.push(flag('amber', 'ANISOMETROPIA', 'Large difference between the eyes',
      `${x.diff.toFixed(2)} D difference in spherical equivalent.`, 'anisometropia', 'Optometrist review; in children, amblyopia check.'));
    if (x.code === 'HIGH_MYOPIA') f.push(flag('amber', 'HIGH_MYOPIA', `High myopia (${x.eye})`,
      `Spherical equivalent ${x.se.toFixed(2)} D: higher risk of retinal detachment and glaucoma.`, 'high_myopia', 'Annual retina check.'));
    if (x.code === 'HIGH_HYPEROPIA') f.push(flag('amber', 'HIGH_HYPEROPIA', `High hyperopia (${x.eye})`,
      `Spherical equivalent +${x.se.toFixed(2)} D: angle-closure risk in adults, amblyopia risk in children.`, 'high_myopia', 'Optometrist review.'));
    if (x.code === 'HIGH_ASTIGMATISM') f.push(flag('amber', 'HIGH_ASTIGMATISM', `High astigmatism (${x.eye})`,
      `Cylinder ${x.cyl} D: rule out keratoconus.`, 'high_myopia', 'Optometrist review (corneal topography if available).'));
  }
  const lane = f.some((x) => x.lane === 'red') ? 'red' : f.some((x) => x.lane === 'amber') ? 'amber' : 'green';
  return { lane, flags: f };
}

// ------------------------------------------------------------------ lens category
export function recommendLens(a, m, prof) {
  const d = derive(a);
  const { zones, dominance, designEmphasis } = prof.vision;
  const pres = prof.presbyopia;
  const notes = [];
  const coatings = [];
  const rationale = [];
  let category; let title; let example = null;
  // Decision path: every rule checked, in order, with the values it saw.
  // The chain short-circuits, so only rules that were actually evaluated appear.
  const decisionPath = [];
  const check = (rule, passed, detail) => { decisionPath.push({ rule, passed: Boolean(passed), detail }); return Boolean(passed); };
  const pct = (x) => `${Math.round(x * 100)}%`;

  if (check('Red-flag lane', prof.triage.lane === 'red', `lane ${prof.triage.lane}`)) {
    return {
      category: 'urgent_referral', title: 'No glasses today: urgent referral',
      rationale: ['A red-flag symptom needs a doctor first; new glasses could delay care.'],
      coatings: [], notes: [], centrationNeeded: false, example: null, decisionPath,
    };
  }
  const near = zones.near.share; const inter = zones.intermediate.share; const far = zones.distance.share;
  const needsNear = pres && (pres.status === 'established' || pres.status === 'pseudophakic' || (pres.status === 'early' && (near >= 0.3 || has(a.complaint, 'near_blur'))));
  const farComplaint = has(a.complaint, 'far_blur') || a.glasses_ok === 'far_blur' || a.glasses_type === 'distance'
    || a.glasses_type === 'bifocal' || a.glasses_type === 'progressive' || (m.acuity && (worstLogmar(m.acuity) ?? 0) >= 0.3);
  const fallRisk = d.age >= 65 && a.falls === true;
  const budget = a.budget || 'mid';
  const addDetail = pres ? `add +${pres.addD.toFixed(2)} D at ${pres.workingDistanceCm} cm, status ${pres.status}` : 'child: not assessed';

  if (check('Child under 16', d.isChild, `age ${d.age}`)) {
    category = 'child_refraction';
    title = 'Cycloplegic refraction, then single-vision lenses';
    rationale.push('Children’s focusing is strong enough to hide long-sightedness; only a dilated (cycloplegic) refraction gives the true power.');
    const risk = prof.myopiaRisk;
    if (risk && risk.level !== 'low') {
      rationale.push(`Myopia risk ${risk.level}: ${risk.factors.join('; ')}.`);
      notes.push('If myopia is confirmed and progressing, discuss myopia-management lenses with the optometrist.');
      example = 'e.g. ZEISS MyoCare (ages 6-12), after confirmation by the optometrist';
    }
    coatings.push('Polycarbonate or other impact-resistant material for children');
  } else if (!check('Needs a reading add', needsNear, addDetail)) {
    if (check('Distance complaint or already wears glasses', farComplaint || a.glasses_now === true,
      `distance complaint ${farComplaint ? 'yes' : 'no'}, glasses ${a.glasses_now === true ? 'yes' : 'no'}`)) {
      category = 'sv_distance';
      title = 'Single-vision lenses for distance';
      rationale.push('No reading add needed yet at this age and working distance.');
      if ((a.screen_hours ?? 0) >= 4 && d.age >= 30) {
        notes.push('Long screen hours from the 30s: a single-vision design with a small near "boost" can reduce end-of-day fatigue.');
        example = 'e.g. ZEISS SmartLife single-vision range';
      }
    } else {
      category = 'no_change';
      title = 'No new glasses indicated by the interview';
      rationale.push('No distance or near complaint and no add needed; confirm with the vision checks.');
    }
  } else if (check('Fall at 65+ and active outdoors', fallRisk && far >= 0.25,
    `age ${d.age}, fall ${a.falls === true ? 'yes' : 'no'}, distance ${pct(far)} of day`)) {
    category = 'separate_pairs';
    title = 'Two pairs: single-vision distance for walking + reading glasses';
    rationale.push('Fall reported at 65+: multifocals blur steps and kerbs. In older people who are active outdoors, single-vision distance glasses reduced outdoor falls (VISIBLE trial).');
  } else if (check('Mostly close work, little else (near ≥50%, others <25%, no distance complaint)',
    near >= 0.5 && far < 0.25 && inter < 0.25 && !farComplaint,
    `near ${pct(near)}, arm’s length ${pct(inter)}, distance ${pct(far)}, distance complaint ${farComplaint ? 'yes' : 'no'}`)) {
    category = 'readers';
    title = `Reading glasses at ${zones.near.workingDistanceCm} cm`;
    rationale.push(`Mostly close work (${Math.round(near * 100)}% of the day) and no distance complaint.`);
    if (!a.rx_known || (!a.rx_known.R && !a.rx_known.L)) {
      notes.push('If both eyes see well far away and there is no astigmatism complaint, ready-made readers are a low-cost option once the optometrist approves the add.');
    }
  } else if (check('Arm’s-length work dominates, or close + arm’s length ≥75%',
    dominance === 'intermediate' || (near + inter >= 0.75 && far < 0.2),
    `dominance ${dominance}, close + arm’s length ${pct(near + inter)}, distance ${pct(far)}`)) {
    category = 'office';
    title = 'Office (near-variable) lens for work, plus distance glasses if needed';
    rationale.push(dominance === 'intermediate'
      ? `Arm’s-length work dominates (${Math.round(inter * 100)}% of the day): bifocals have no intermediate zone and standard progressives keep it narrow.`
      : `Almost the whole day is close and arm’s-length work (${Math.round((near + inter) * 100)}%): a work lens gives wider near and intermediate zones than a progressive.`);
    notes.push(`If only one pair is affordable: a progressive with the ${dominance === 'intermediate' ? 'Intermediate' : 'Near'} design emphasis.`);
    example = `e.g. ZEISS SmartLife Progressive with the ${dominance === 'intermediate' ? 'Intermediate' : 'Near'} design option (one-pair alternative)`;
  } else if (check('Low budget, or already comfortable in bifocals',
    budget === 'low' || (a.glasses_type === 'bifocal' && a.glasses_ok === 'fine'),
    `budget ${budget}, current glasses ${a.glasses_type || 'none'}`)) {
    category = 'bifocal';
    title = 'Bifocal (distance + near)';
    rationale.push(budget === 'low' ? 'Needs both distance and near within a low budget.' : 'Already comfortable in bifocals.');
    if (inter >= 0.25) notes.push('Bifocals have no arm’s-length zone; screens and counters will be awkward.');
  } else {
    check('Otherwise: progressive with the profile’s design emphasis', true, `design ${designEmphasis}`);
    category = 'progressive';
    title = `Progressive lens, ${designEmphasis} design`;
    rationale.push(`Needs distance and near (${Math.round(far * 100)}% far, ${Math.round(near * 100)}% near, ${Math.round(inter * 100)}% arm’s length).`);
    example = `e.g. ZEISS SmartLife Progressive, ${designEmphasis} design option`;
    if (a.glasses_type === 'progressive' && a.glasses_ok === 'discomfort') notes.push('Previous progressives were uncomfortable: check fitting height and PD carefully.');
  }

  if (pres && pres.addD > 0 && category !== 'urgent_referral' && !d.isChild && needsNear) {
    rationale.push(`Estimated reading add about +${pres.addD.toFixed(2)} D for ${pres.workingDistanceCm} cm (${pres.amplitudeSource}). The optometrist confirms.`);
  }
  if (a.drives === true || d.occ === 'driver' || a.night_glare === true) coatings.push('Anti-reflective coating for night driving and glare');
  if (d.occ === 'driver') example = example || 'e.g. ZEISS DriveSafe for drivers';
  const outdoor = a.outdoor_hours ?? (OUTDOOR_JOBS.includes(d.occ) ? 6 : 0);
  if (!d.isChild && outdoor >= 4) coatings.push('UV protection; photochromic lenses or sunglasses for long hours in the sun');
  if (['labour', 'fine'].includes(d.occ)) coatings.push('Scratch-resistant, impact-resistant material for work');
  if ((a.screen_hours ?? 0) >= 2 || has(a.complaint, 'strain')) {
    // Cochrane review (Singh et al. 2023, 17 RCTs): blue-light filtering lenses probably make no
    // difference to eye strain, sleep or retinal health; no consistent harms. Offer as a
    // preference, never as the treatment, and fix what does cause screen strain.
    const interFix = pres && pres.status !== 'none' ? ' (for this patient, an intermediate add for the screen distance)' : '';
    notes.push(`Blue-light filter: optional, not a treatment. A Cochrane review of 17 trials (2023) found it probably makes no difference to eye strain, sleep or retinal health, and no harm. What relieves screen strain: the right power at screen distance${interFix}, an anti-reflective coating, blinking and 20-20-20 breaks.`);
  }
  const centrationNeeded = ['progressive', 'office', 'bifocal'].includes(category);
  return { category, title, rationale, coatings, notes, centrationNeeded, example, decisionPath };
}

// ------------------------------------------------------------------ data quality
// How much of the profile rests on what the patient said, what the phone
// measured, and how trustworthy those measurements were. Shown to the optometrist.
export function dataQuality(a, m, prof, trace = []) {
  const items = [];
  const z = prof.vision;
  const cal = m.calibration || {};
  items.push({ key: 'zones', label: 'Daily hours reported by the patient', value: `${z.inputsReported} of 3 (rest from occupation)`, ok: z.inputsReported >= 2 });
  items.push({
    key: 'nearDistance', label: 'Near working distance',
    value: z.nearDistanceMeasured ? `measured${cal.camera ? ', calibrated camera (±5%)' : ', uncalibrated camera (±15%)'}` : 'typical for occupation (not measured)',
    ok: z.nearDistanceMeasured,
  });
  if (prof.presbyopia) {
    items.push({ key: 'amplitude', label: 'Focusing range', value: prof.presbyopia.measuredNearPoint ? 'measured near point' : prof.presbyopia.amplitudeSource, ok: prof.presbyopia.measuredNearPoint || prof.derived.pseudophakic });
  }
  if (m.acuity?.R) items.push({ key: 'acuity', label: 'Eye-chart letter size', value: cal.screen ? 'screen calibrated' : 'screen not calibrated: sizes approximate', ok: Boolean(cal.screen) });
  if (m.pd?.binocularMm) {
    const q = m.pd.quality;
    items.push({ key: 'pd', label: 'Pupillary distance', value: `${m.pd.method}${m.pd.uncertaintyMm ? `, ±${m.pd.uncertaintyMm} mm` : ''}${q ? `, head roll ${q.rollDeg}°, turn ${q.yawPct}%` : ''}`, ok: !q || q.ok });
  }
  const answered = trace.filter((t) => t.qid && !t.event);
  if (answered.length) {
    const voice = answered.filter((t) => t.mode === 'voice').length;
    const low = answered.filter((t) => t.lowConfidence).length;
    items.push({ key: 'answers', label: 'Answers', value: `${voice} by voice, ${answered.length - voice} by tap${low ? `; ${low} low-confidence, confirmed by tap` : ''}`, ok: true });
  }
  if (m.simulated?.length) items.push({ key: 'simulated', label: 'Simulated measurements (demo)', value: m.simulated.join(', '), ok: false });
  const okShare = items.filter((i) => i.ok).length / items.length;
  return { items, level: okShare >= 0.75 ? 'high' : okShare >= 0.5 ? 'medium' : 'low' };
}

// ------------------------------------------------------------------ which checks to run
export function suggestedChecks(a, m = {}) {
  const d = derive(a);
  const checks = [];
  if (d.age !== null && !d.urgent) {
    if (d.isChild || d.age >= 35 || (a.near_hours ?? 0) >= 3) checks.push('reading_distance');
    if (!d.isChild && d.age >= 35 && !d.pseudophakic) checks.push('near_point');
  }
  checks.push('acuity');
  if (d.age >= 50 || d.diabetic || has(a.rf_sudden_which, 'drop')) checks.push('amsler');
  if (!d.urgent && (d.presbyopeLikely || a.glasses_now === true)) checks.push('pd');
  return checks;
}

// ------------------------------------------------------------------ advice
export function adviceKeys(a, prof) {
  const d = derive(a);
  const k = [];
  if ((a.screen_hours ?? 0) >= 2 || (a.near_hours ?? 0) >= 4) k.push('rule_20_20_20');
  if (d.isChild) k.push('outdoor_2h');
  if (d.diabetic) k.push('diabetes_yearly');
  const outdoor = a.outdoor_hours ?? (OUTDOOR_JOBS.includes(d.occ) ? 6 : 0);
  if (outdoor >= 4) k.push('uv_sunglasses');
  if (prof.presbyopia && prof.presbyopia.status !== 'none' && (prof.vision.zones.near.share >= 0.3)) k.push('good_light');
  if (['labour', 'fine'].includes(d.occ)) k.push('safety_eyewear');
  if (a.glaucoma_family === true) k.push('family_check');
  return k;
}

// ------------------------------------------------------------------ full profile
// Bump when any rule, threshold or question changes: every case records the
// version that produced it, so a reviewer can reproduce the decision.
export const RULES_VERSION = '2026.11-r2';

export function buildProfile(answers, measurements = {}, meta = {}) {
  const a = answers || {};
  const m = measurements || {};
  const d = derive(a);
  const vision = visualZones(a, m);
  const pres = d.isChild ? null : presbyopia(a, m, vision.zones);
  const risk = myopiaRisk(a, m);
  const rxf = a.rx_known && (a.rx_known.R || a.rx_known.L) ? rxFindings(a.rx_known) : [];
  const tri = triage(a, m, { rxFindings: rxf });
  const prof = { derived: d, vision, presbyopia: pres, myopiaRisk: risk, triage: tri };
  prof.recommendation = recommendLens(a, m, prof);
  prof.advice = adviceKeys(a, prof);
  prof.checks = suggestedChecks(a, m);
  prof.quality = dataQuality(a, m, prof, meta.trace || []);
  prof.rulesVersion = RULES_VERSION;
  prof.summary = oneLine(prof);
  return prof;
}

const ZONE_WORD = { near: 'near-dominant', intermediate: 'intermediate-dominant', distance: 'distance-dominant', balanced: 'balanced' };
function oneLine(p) {
  const d = p.derived;
  const parts = [];
  if (d.age !== null) parts.push(`${d.age}y`);
  if (d.occ) parts.push(d.occ);
  parts.push(ZONE_WORD[p.vision.dominance]);
  if (p.presbyopia && p.presbyopia.status !== 'none') parts.push(`add ~+${p.presbyopia.addD.toFixed(2)}`);
  parts.push(p.recommendation.title);
  return parts.join(' · ');
}
