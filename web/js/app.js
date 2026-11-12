// DivyaDrishti field app: runs on the phone a store owner or camp volunteer
// already has. Flow: consent -> adaptive voice interview -> quick checks ->
// functional vision profile -> send to the remote optometrist -> Vision Passport.
import * as E from './engine/adaptive.js';
import { QUESTION_BY_ID, questionText } from './engine/questions.js';
import { buildProfile, RULES_VERSION } from './engine/profile.js';
import { validateRx } from './engine/rx.js';
import { PERSONAS, PERSONA_BY_KEY } from './engine/personas.js';
import { tr, LANGS, LOCALE } from './i18n.js';
import { PACK_BY_CODE } from './lang/index.js';
import * as V from './voice.js';
import { voiceCommand } from './voice_commands.js';
import * as store from './store.js';
import { passportText, whatsappLink, smsLink, shortCode } from './passport.js';
import * as G from './measure/geometry.js';
import * as A from './measure/acuity.js';
import { profileHtml } from './profile_view.js';

const APP_VERSION = '0.3.0';
const LOW_CONFIDENCE = 0.6; // below this, a spoken answer must be confirmed by tap
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const load = (k, d) => { try { return { ...d, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const isPhone = () => matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600;

const main = $('#main');
const settings = load('dd.settings', { site: 'Chennai Optics, Velachery', siteType: 'store', operator: '', voice: true, lang: 'en' });
try {
  const migrationKey = 'dd.default-language-en.v1';
  if (!localStorage.getItem(migrationKey)) {
    if (settings.lang === 'ta') {
      settings.lang = 'en';
      save('dd.settings', settings);
    }
    localStorage.setItem(migrationKey, '1');
  }
} catch { /* private browsing can disable local storage */ }
const calib = load('dd.calibration', { pxPerMm: null, focalNorm: null });
const pxPerMm = () => calib.pxPerMm || G.defaultPxPerMm(isPhone());
const focalPxFor = (W) => (calib.focalNorm ? calib.focalNorm * W : G.defaultFocalPx(W));

let C = null; // current case
let turn = 0; // cancels stale async voice turns
let cleanup = null; // stops cameras / loops when leaving a screen

function setScreen(html, name) {
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  V.stopAll();
  turn++;
  main.innerHTML = html;
  main.dataset.screen = name;
  window.scrollTo(0, 0);
  updateHeader();
}

const L = () => (C ? C.lang : settings.lang);
const t = (k, vars) => tr(k, L(), vars);

function updateHeader() {
  const vb = $('#voiceToggle');
  if (vb) { vb.textContent = settings.voice ? `🔊 ${t('voiceOn')}` : `🔇 ${t('voiceOff')}`; vb.setAttribute('aria-pressed', String(settings.voice)); }
  const sb = $('#syncBadge');
  store.pendingCount().then((pending) => {
    if (sb) { sb.textContent = pending ? `⟳ ${pending}` : '✓'; sb.title = pending ? `${pending} waiting to sync` : 'All synced'; }
  }).catch(() => {});
  const lb = $('#lockBtn');
  if (lb) { lb.hidden = !store.isUnlocked(); lb.textContent = '🔒'; lb.title = t('lock'); lb.setAttribute('aria-label', t('lock')); }
}

// Encrypted autosave of the case in progress: a crash, a reload or a call
// never loses a patient's answers.
function saveDraft() {
  if (!C || !store.isUnlocked()) return;
  const { still, ...state } = C;
  store.saveDraft(state).catch(() => {});
}

// ====================================================================== home
async function home() {
  C = null;
  const draft = await store.loadDraft().catch(() => null);
  const langBtns = Object.entries(LANGS).map(([k, v]) => `<button class="chip lang ${settings.lang === k ? 'on' : ''}" data-lang="${k}" aria-pressed="${settings.lang === k}">${v}</button>`).join('');
  const demos = PERSONAS.map((p) => `<button class="demo" data-demo="${p.key}"><b>${esc(p.name)}</b><span>${esc(p.blurb)}</span><i>${LANGS[p.lang]}</i></button>`).join('');
  setScreen(`
    <section class="hero home-hero">
      <div>
      <p class="eyebrow">${esc(settings.site)}</p>
      <h1>${t('appTagline')}</h1>
      </div>
      <div class="hero-mark" aria-hidden="true">
        <svg viewBox="0 0 64 64"><path d="M5 32s10-18 27-18 27 18 27 18-10 18-27 18S5 32 5 32Z"/><circle cx="32" cy="32" r="9"/></svg>
      </div>
    </section>
    ${draft ? `<section class="card resume"><b>${t('resume')}</b>
      <p class="muted small">${esc(draft.patient?.name || shortCode(draft.id))} · ${LANGS[draft.lang] || ''} · ${draft.session?.trace?.filter((x) => x.qid && !x.event).length || 0} answers</p>
      <div class="row gap"><button class="btn primary" id="resumeBtn">↻ ${t('resume')}</button><button class="btn ghost" id="discardBtn">✕</button></div></section>` : ''}
    <section class="card start-card">
      <p class="eyebrow">START HERE</p>
      <h2>${t('newScreening')}</h2>
      <p class="muted small">${t('language')}</p>
      <div class="lang-grid">${langBtns}</div>
      <button class="btn primary big" id="newBtn">${t('newScreening')} <span aria-hidden="true">→</span></button>
    </section>
    <section class="card">
      <h2>${t('demo')}</h2>
      <p class="muted small">Plays the interview with a scripted patient so you can see the adaptive questions, the checks and the profile without a microphone.</p>
      <div class="demos">${demos}</div>
    </section>
    <section class="row wrap gap">
      <button class="btn" id="inboxBtn">📥 ${t('results')}</button>
      <button class="btn" id="calBtn">📏 ${t('calibrate')}</button>
      <button class="btn" id="checkBtn">🩻 Phone check</button>
      <a class="btn" href="portal.html" target="_blank" rel="noopener">🩺 Optometrist portal</a>
    </section>
    <details class="card small">
      <summary>Store / camp settings</summary>
      <label>${t('site')}<input id="siteIn" value="${esc(settings.site)}"></label>
      <label>Type<select id="siteType"><option value="store" ${settings.siteType === 'store' ? 'selected' : ''}>Optical store</option><option value="camp" ${settings.siteType === 'camp' ? 'selected' : ''}>Eye camp</option></select></label>
      <label>${t('operator')}<input id="opIn" value="${esc(settings.operator)}"></label>
      <p class="muted small">App ${APP_VERSION} · rules ${RULES_VERSION} · data on this phone is encrypted (AES-256-GCM, PIN-protected)</p>
    </details>`, 'home');
  if (draft) {
    $('#resumeBtn').onclick = () => resumeDraft(draft);
    $('#discardBtn').onclick = async () => { await store.clearDraft(); home(); };
  }
  $('#checkBtn').onclick = phoneCheck;
  $$('.lang', main).forEach((b) => b.onclick = () => { settings.lang = b.dataset.lang; save('dd.settings', settings); home(); });
  $('#newBtn').onclick = () => startCase(settings.lang);
  $$('.demo', main).forEach((b) => b.onclick = () => startCase(PERSONA_BY_KEY[b.dataset.demo].lang, PERSONA_BY_KEY[b.dataset.demo]));
  $('#inboxBtn').onclick = inbox;
  $('#calBtn').onclick = calibration;
  $('#siteIn').onchange = (e) => { settings.site = e.target.value; save('dd.settings', settings); };
  $('#siteType').onchange = (e) => { settings.siteType = e.target.value; save('dd.settings', settings); };
  $('#opIn').onchange = (e) => { settings.operator = e.target.value; save('dd.settings', settings); };
}

function startCase(lang, persona = null) {
  C = {
    id: store.uuid(), lang, createdAt: new Date().toISOString(), demo: persona,
    patient: persona ? { name: persona.name, phone: persona.phone, village: persona.village } : { name: '', phone: '', village: '' },
    site: { name: persona ? persona.site : settings.site, type: persona ? persona.siteType : settings.siteType },
    operator: persona ? (persona.siteType === 'camp' ? 'Camp volunteer (demo)' : 'Store owner (demo)') : settings.operator, consent: null, session: E.createSession({ lang }), measurements: {},
  };
  C.session.id = C.id;
  register();
}

function resumeDraft(draft) {
  C = draft;
  if (!C.consent) { register(); return; }
  if (E.nextQuestion(C.session)) interview(); else checks();
}

// ====================================================================== register + consent
function register() {
  const p = C.patient;
  setScreen(`
    <section class="card">
      <p class="eyebrow">${LANGS[C.lang]}${C.demo ? ' · demo' : ''}</p>
      <label>${t('patientName')}<input id="pName" value="${esc(p.name)}" autocomplete="off"></label>
      <label>${t('phone')}<input id="pPhone" value="${esc(p.phone)}" inputmode="tel" autocomplete="off"></label>
      <label>${t('village')}<input id="pVillage" value="${esc(p.village)}" autocomplete="off"></label>
    </section>
    <section class="card consent">
      <h2>${t('consentTitle')}</h2>
      <p class="say">${t('consentText')}</p>
      <div class="row gap wrap">
        <button class="btn" id="playConsent">🔊 ${t('play')}</button>
      </div>
      <div class="row gap">
        <button class="btn primary big" id="agree">✓ ${t('agree')}</button>
        <button class="btn ghost" id="disagree">${t('disagree')}</button>
      </div>
      <p class="muted small">Recorded with time and language (Digital Personal Data Protection Act, 2023). Images from the camera checks never leave the phone; only measurements are sent.</p>
    </section>`, 'register');
  if (settings.voice) V.speak(t('consentText'), C.lang);
  $('#playConsent').onclick = () => V.speak(t('consentText'), C.lang);
  $('#agree').onclick = () => {
    C.patient = { name: $('#pName').value.trim(), phone: $('#pPhone').value.trim(), village: $('#pVillage').value.trim() };
    C.consent = { given: true, at: new Date().toISOString(), lang: C.lang, textVersion: 'consent-v2-sarvam', method: 'verbal, recorded by operator' };
    saveDraft();
    interview();
  };
  $('#disagree').onclick = home;
}

// ====================================================================== interview
const MODULE_LABEL = { core: 'About you', redflag: 'Safety check', child: 'Child', medical: 'Health', glasses: 'Current glasses', lifestyle: 'Daily vision', preference: 'Preference' };

function optionLabel(q, v) {
  const o = q.options?.find((x) => x.v === v);
  return o ? o.label[C.lang] || o.label.en : String(v);
}
function valueLabel(q, v) {
  if (v === null || v === undefined) return '';
  switch (q.type) {
    case 'yesno': return v ? t('yes') : t('no');
    case 'single': return optionLabel(q, v);
    case 'multi': return v.map((x) => optionLabel(q, x)).join(', ');
    case 'number': return `${v} ${q.unit ? q.unit[C.lang] || q.unit.en : ''}`;
    case 'hours': return `${v} h`;
    case 'rx': return v.skipped ? t('skip') : v.text;
    default: return String(v);
  }
}

function answerControls(q) {
  switch (q.type) {
    case 'yesno':
      return `<div class="row gap"><button class="btn answer big yes" data-v="true">${t('yes')}</button><button class="btn answer big no" data-v="false">${t('no')}</button></div>`;
    case 'single':
      return `<div class="opts">${q.options.map((o) => `<button class="btn answer" data-v="${o.v}">${esc(o.label[C.lang] || o.label.en)}${C.lang !== 'en' ? `<small>${esc(o.label.en)}</small>` : ''}</button>`).join('')}</div>`;
    case 'multi':
      return `<div class="opts">${q.options.map((o) => `<button class="btn toggle" data-v="${o.v}" ${o.exclusive ? 'data-exclusive="1"' : ''}>${esc(o.label[C.lang] || o.label.en)}${C.lang !== 'en' ? `<small>${esc(o.label.en)}</small>` : ''}</button>`).join('')}</div>
        <button class="btn primary" id="multiNext" disabled>${t('next')} →</button>`;
    case 'number':
    case 'hours': {
      const quick = (q.quick || []).map((n) => `<button class="chip quick" data-v="${n}">${n}${q.type === 'hours' ? ' h' : ''}</button>`).join('');
      return `<div class="row wrap gap">${quick}</div>
        <div class="row gap numrow"><input id="numIn" type="number" inputmode="decimal" step="${q.type === 'hours' ? '0.5' : '1'}" min="${q.min ?? 0}" max="${q.max ?? 16}" placeholder="${q.type === 'hours' ? 'hours' : esc(q.unit?.en || '')}">
        <button class="btn primary" id="numNext">${t('next')} →</button></div>`;
    }
    case 'rx': {
      const sel = (id, from, to, step, def) => {
        let o = '';
        for (let v = from; v <= to + 1e-9; v += step) {
          const r = Math.round(v * 100) / 100;
          o += `<option value="${r}" ${r === def ? 'selected' : ''}>${step < 1 ? (r > 0 ? '+' : '') + r.toFixed(2) : r}</option>`;
        }
        return `<select id="${id}">${o}</select>`;
      };
      const eyeRow = (e) => `<tr><th>${e}</th><td>${sel(`${e}sph`, -12, 8, 0.25, 0)}</td><td>${sel(`${e}cyl`, -6, 0, 0.25, 0)}</td><td>${sel(`${e}ax`, 0, 180, 5, 0)}</td></tr>`;
      return `<details class="rxgrid"><summary>${t('enterManually')}</summary>
        <table><tr><th></th><th>SPH</th><th>CYL</th><th>AXIS</th></tr>${eyeRow('R')}${eyeRow('L')}</table>
        <button class="btn" id="rxSave">${t('next')} →</button></details>
        <div class="row gap"><button class="btn ghost" id="rxSkip">${t('skip')}</button></div>
        <p id="rxErr" class="err"></p>`;
    }
    default: return '';
  }
}

async function interview() {
  const q = E.nextQuestion(C.session);
  if (!q) { C.session.finishedAt = C.session.finishedAt || new Date().toISOString(); checks(); return; }
  const s = E.stateOf(C.session);
  const text = questionText(q, s, C.lang);
  const textEn = questionText(q, s, 'en');
  const asked = C.session.trace.filter((x) => x.qid && !x.event).length;
  const more = Math.max(0, E.remainingEstimate(C.session) - 1);
  setScreen(`
    ${s.d.urgent ? `<div class="banner red">⚠ ${t('urgentBanner')}</div>` : ''}
    <section class="card qcard">
      <div class="row between"><span class="tag">${MODULE_LABEL[q.module] || q.module}</span><span class="muted small">Q${asked + 1}${s.d.age !== null ? ` · ${t('aboutMore', { n: more })}` : ''}</span></div>
      <p class="question" lang="${C.lang}">${esc(text)}</p>
      ${C.lang !== 'en' ? `<p class="muted small en">${esc(textEn)}</p>` : ''}
      <div class="voicebar"><span id="vstate" class="pill">…</span><span id="transcript" class="transcript"></span></div>
      ${settings.voice ? `<details class="voice-help"><summary>Voice controls <span>English · हिन्दी</span></summary>
        <p>Repeat / फिर से · Go back / पीछे · Yes / हाँ · No / नहीं · Next / आगे</p>
      </details>` : ''}
      <div id="heard" class="heard" hidden></div>
      <div class="controls">${answerControls(q)}</div>
      <p class="why"><b>${t('why')}:</b> ${esc(q.reason(s))}</p>
    </section>
    <div class="row between">
      <button class="btn ghost" id="backBtn" ${asked ? '' : 'disabled'}>← ${t('back')}</button>
      <button class="btn ghost" id="againBtn">↻ ${t('speakAgain')}</button>
      <button class="btn ghost" id="skipBtn">${t('skip')} →</button>
    </div>`, 'interview');

  const my = turn;
  const commit = (value, raw = null, mode = 'tap', extra = {}) => {
    if (my !== turn) return;
    E.submitAnswer(C.session, q.id, value, { raw, mode, ...extra });
    saveDraft();
    interview();
  };
  wireControls(q, commit);
  $('#backBtn').onclick = () => { E.undoLast(C.session); interview(); };
  $('#skipBtn').onclick = () => { E.skipQuestion(C.session, q.id); interview(); };
  $('#againBtn').onclick = () => voiceTurn(q, text, my, commit, true);
  voiceTurn(q, text, my, commit, false);
}

function wireControls(q, commit) {
  $$('.answer', main).forEach((b) => b.onclick = () => {
    const v = q.type === 'yesno' ? b.dataset.v === 'true' : b.dataset.v;
    commit(v);
  });
  if (q.type === 'multi') {
    const toggles = $$('.toggle', main);
    const next = $('#multiNext');
    toggles.forEach((b) => b.onclick = () => {
      b.classList.toggle('on');
      if (b.classList.contains('on')) {
        if (b.dataset.exclusive) toggles.forEach((o) => { if (o !== b) o.classList.remove('on'); });
        else toggles.forEach((o) => { if (o.dataset.exclusive) o.classList.remove('on'); });
      }
      next.disabled = !toggles.some((o) => o.classList.contains('on'));
    });
    next.onclick = () => commit(toggles.filter((o) => o.classList.contains('on')).map((o) => o.dataset.v));
  }
  if (q.type === 'number' || q.type === 'hours') {
    $$('.quick', main).forEach((b) => b.onclick = () => commit(Number(b.dataset.v)));
    const go = () => {
      const v = Number($('#numIn').value);
      if ($('#numIn').value !== '' && Number.isFinite(v) && v >= (q.min ?? 0) && v <= (q.max ?? 16)) commit(q.id === 'age' ? Math.floor(v) : v, null, 'typed');
    };
    $('#numNext').onclick = go;
    $('#numIn').onkeydown = (e) => { if (e.key === 'Enter') go(); };
  }
  if (q.type === 'rx') {
    $('#rxSkip').onclick = () => commit({ skipped: true });
    $('#rxSave').onclick = () => {
      const eye = (e) => {
        const cyl = Number($(`#${e}cyl`).value);
        return { sph: Number($(`#${e}sph`).value), cyl, axis: cyl ? Number($(`#${e}ax`).value) : undefined };
      };
      const r = validateRx({ R: eye('R'), L: eye('L') });
      if (!r.ok) { $('#rxErr').textContent = r.errors.join('; '); return; }
      commit({ R: r.R, L: r.L, text: r.text, warnings: r.warnings }, null, 'typed');
    };
  }
}

function setVState(state) {
  const el = $('#vstate');
  if (!el) return;
  el.className = `pill ${state}`;
  el.textContent = state === 'speaking' ? `🔊 ${t('speaking')}` : state === 'listening' ? `🎙 ${t('listening')}` : state === 'demo' ? '🎭 demo patient' : state === 'off' ? t('voiceOff') : '…';
}

async function voiceTurn(q, text, my, commit, again) {
  const spoke = settings.voice ? await (setVState('speaking'), V.speak(text, C.lang)) : false;
  if (my !== turn) return;
  if (settings.voice && !spoke && !again && !V.hasVoice(C.lang)) $('#transcript').textContent = t('noVoice');
  if (C.still) { stillAnswer(q); return; }
  if (C.demo) { await demoAnswer(q, my, commit); return; }
  if (!settings.voice) { setVState('off'); return; }
  if (!V.sttSupported()) { setVState('off'); $('#transcript').textContent = t('noMic'); return; }
  for (let attempt = 0; attempt < 2; attempt++) {
    setVState('listening');
    const res = await V.listen(q.asr || C.lang, { onInterim: (s) => { if (my === turn) $('#transcript').textContent = s; } });
    if (my !== turn) return;
    if (res) {
      $('#transcript').textContent = `“${res.transcript}”`;
      const command = voiceCommand(res.transcript);
      if (command === 'repeat') { await voiceTurn(q, text, my, commit, true); return; }
      if (command === 'back' && !$('#backBtn').disabled) { $('#backBtn').click(); return; }
      if (command === 'next') { $('#skipBtn').click(); return; }
      if ((command === 'yes' || command === 'no') && q.type === 'yesno') {
        const answer = E.interpret(q, command, 'en');
        if (answer.ok) {
          const lowConfidence = res.confidence > 0 && res.confidence < LOW_CONFIDENCE;
          await confirmHeard(q, answer, res.transcript, my, commit, 'voice', { confidence: res.confidence, lowConfidence });
          return;
        }
      }
      const idx = res.alternatives.findIndex((alt) => E.interpret(q, alt.text, q.asr || C.lang).ok);
      if (idx !== -1) {
        const alt = res.alternatives[idx];
        const r = E.interpret(q, alt.text, q.asr || C.lang);
        // second-guess or low engine confidence: the operator confirms by tap
        const lowConfidence = idx > 0 || (alt.confidence > 0 && alt.confidence < LOW_CONFIDENCE);
        await confirmHeard(q, r, alt.text, my, commit, 'voice', { confidence: alt.confidence, lowConfidence });
        return;
      }
    }
    if (attempt === 0) { setVState('speaking'); await V.speak(t('notUnderstood'), C.lang); if (my !== turn) return; }
  }
  setVState('idle');
}

function stillAnswer(q) {
  setVState('listening');
  const raw = C.still[q.id];
  if (!raw) return;
  $('#transcript').textContent = `“${raw}”`;
  const r = E.interpret(q, raw, q.asr || C.lang);
  if (r.ok) { reflectHeard(q, r.value); const box = $('#heard'); box.hidden = false; box.innerHTML = `<span>${t('heard')}: <b>${esc(valueLabel(q, r.value))}</b></span>`; }
}

async function demoAnswer(q, my, commit) {
  setVState('demo');
  const raw = C.demo.say[q.id];
  if (raw === undefined) return; // unscripted: operator taps
  const el = $('#transcript');
  for (let i = 1; i <= raw.length; i += Math.max(1, Math.round(raw.length / 14))) {
    if (my !== turn) return;
    el.textContent = `“${raw.slice(0, i)}”`;
    await sleep(45);
  }
  el.textContent = `“${raw}”`;
  const r = E.interpret(q, raw, q.asr || C.lang);
  if (r.ok) await confirmHeard(q, r, raw, my, commit, 'voice');
}

// keep the tap controls in sync with what was heard
function reflectHeard(q, value) {
  if (q.type !== 'multi') return;
  $$('.toggle', main).forEach((b) => b.classList.toggle('on', value.includes(b.dataset.v)));
  const next = $('#multiNext'); if (next) next.disabled = !value.length;
}

async function confirmHeard(q, r, raw, my, commit, mode, extra = {}) {
  reflectHeard(q, r.value);
  const box = $('#heard');
  const critical = (q.module === 'redflag' || q.id === 'child_white') && r.value === true;
  const needsTap = critical || r.ambiguous || extra.lowConfidence || (q.type === 'rx' && r.value.warnings?.length);
  box.hidden = false;
  box.innerHTML = `<span>${t('heard')}: <b>${esc(valueLabel(q, r.value))}</b></span>
    ${needsTap ? `<button class="btn primary" id="okHeard">✓ ${t('next')}</button>` : ''}<button class="btn ghost" id="chgHeard">${t('change')}</button>
    ${extra.lowConfidence ? `<p class="small warn-text">${t('confirmLow')}</p>` : ''}`;
  if (q.type === 'rx' && r.value.warnings?.length) box.insertAdjacentHTML('beforeend', `<p class="muted small">${esc(r.value.warnings.join('; '))}</p>`);
  let cancelled = false;
  $('#chgHeard').onclick = () => { cancelled = true; box.hidden = true; setVState('idle'); };
  if (needsTap) { $('#okHeard').onclick = () => commit(r.value, raw, mode, extra); return; }
  await sleep(C.demo ? 650 : 1300);
  if (!cancelled && my === turn) commit(r.value, raw, mode, extra);
}

// ====================================================================== checks hub
const CHECK_RUN = { reading_distance: checkReading, near_point: checkNear, acuity: checkAcuity, amsler: checkAmsler, pd: checkPd };
const checkDone = (k) => ({
  reading_distance: C.measurements.readingDistanceCm, near_point: C.measurements.nearPointCm,
  acuity: C.measurements.acuity?.L, amsler: C.measurements.amsler?.L, pd: C.measurements.pd,
}[k]);
function checkSummary(k) {
  const m = C.measurements;
  switch (k) {
    case 'reading_distance': return m.readingDistanceCm ? `${Math.round(m.readingDistanceCm)} cm` : '';
    case 'near_point': return m.nearPointCm ? `${Math.round(m.nearPointCm)} cm (${(100 / m.nearPointCm).toFixed(1)} D)` : '';
    case 'acuity': return m.acuity?.L ? `R ${A.snellen(m.acuity.R.logmar)} · L ${A.snellen(m.acuity.L.logmar)}` : '';
    case 'amsler': return m.amsler?.L ? `R ${m.amsler.R} · L ${m.amsler.L}` : '';
    case 'pd': return m.pd ? `PD ${m.pd.binocularMm} mm` : '';
    default: return '';
  }
}

function checks() {
  // record how trustworthy the phone's measurements are, for the reviewer
  C.measurements.calibration = { screen: Boolean(calib.pxPerMm), camera: Boolean(calib.focalNorm) };
  saveDraft();
  const prof = buildProfile(C.session.answers, C.measurements);
  const list = prof.checks.map((k) => `<li class="check ${checkDone(k) ? 'ok' : ''}">
      <div><b>${t(`chk_${k}`)}</b><span class="muted small">${esc(checkSummary(k))}</span></div>
      <button class="btn ${checkDone(k) ? 'ghost' : ''}" data-chk="${k}">${checkDone(k) ? '↻' : t('run')}</button></li>`).join('');
  setScreen(`
    ${prof.derived.urgent ? `<div class="banner red">⚠ ${t('urgentBanner')}</div>` : ''}
    <section class="card">
      <h2>${t('checksTitle')}</h2>
      <p class="muted small">${t('checksHint')}</p>
      <ul class="checks">${list}</ul>
    </section>
    <button class="btn primary big" id="toSummary">${t('finishChecks')} →</button>`, 'checks');
  $$('[data-chk]', main).forEach((b) => b.onclick = () => CHECK_RUN[b.dataset.chk]());
  $('#toSummary').onclick = summary;
}

function demoFill(key) {
  const m = C.demo?.measure;
  if (!m) return false;
  const map = {
    reading_distance: () => { if (m.readingDistanceCm) C.measurements.readingDistanceCm = m.readingDistanceCm; },
    near_point: () => { if (m.nearPointCm) C.measurements.nearPointCm = m.nearPointCm; },
    acuity: () => { if (m.acuity) C.measurements.acuity = structuredClone(m.acuity); },
    amsler: () => { if (m.amsler) C.measurements.amsler = { ...m.amsler }; },
    pd: () => { if (m.pd) C.measurements.pd = { ...m.pd }; },
  };
  map[key]?.();
  C.measurements.simulated = [...new Set([...(C.measurements.simulated || []), key])];
  return true;
}
const demoBtn = (key) => (C.demo ? `<button class="btn ghost" id="demoFill" data-k="${key}">🎭 Use demo patient’s value</button>` : '');
function wireDemo() { const b = $('#demoFill'); if (b) b.onclick = () => { demoFill(b.dataset.k); checks(); }; }

// ---------------------------------------------------------------- camera checks
async function cameraScreen({ key, title, instruction, extraHtml = '', onFrame, actions }) {
  setScreen(`
    <section class="card">
      <h2>${title}</h2>
      <p class="say">${instruction}</p>
      <div class="cam"><video id="vid" playsinline muted></video><div id="readout" class="readout">${t('noFace')}</div></div>
      ${extraHtml}
      <p class="muted small">${calib.focalNorm ? 'Phone calibrated.' : 'Phone not calibrated: distances ±15%. Calibrate once per phone for ±5%.'}</p>
      <div class="row gap wrap">${actions}</div>
      <details class="small"><summary>${t('enterManually')}</summary>
        <div class="row gap"><input id="manualIn" type="number" inputmode="decimal" placeholder="cm"><button class="btn" id="manualSave">${t('done')}</button></div></details>
      ${demoBtn(key)}
      <button class="btn ghost" id="backChecks">← ${t('back')}</button>
    </section>`, `check-${key}`);
  $('#backChecks').onclick = checks;
  wireDemo();
  if (settings.voice) V.speak(instruction.replace(/<[^>]+>/g, ''), C.lang);
  // the operator may leave before the model loads: never start a camera for a screen that is gone
  let stream = null; let stop = null; let face = null; let cancelled = false;
  const vid = $('#vid');
  cleanup = () => { cancelled = true; stop?.(); face?.stopCamera(stream); };
  try {
    face = await import('./measure/face.js');
    const [lm, s] = await Promise.all([face.loadLandmarker(), face.startCamera(vid)]);
    stream = s;
    if (cancelled) { face.stopCamera(stream); return; }
    stop = face.track(vid, lm, onFrame, focalPxFor);
  } catch (e) {
    if (cancelled) return;
    const ro = $('#readout');
    if (ro) ro.textContent = t('cameraFail');
  }
}

function checkReading() {
  const samples = [];
  cameraScreen({
    key: 'reading_distance', title: t('chk_reading_distance'), instruction: t('holdLikeReading'),
    actions: `<button class="btn primary" id="useBtn" disabled>${t('useThis')}</button>`,
    onFrame: (f) => {
      const ro = $('#readout'); if (!ro) return;
      if (!f || !f.distanceMm) { ro.textContent = t('noFace'); return; }
      samples.push(f.distanceMm / 10);
      if (samples.length > 60) samples.shift();
      const stable = G.isStable(samples, 25, 0.05);
      ro.innerHTML = `<b>${Math.round(G.median(samples.slice(-10)))} cm</b>${stable ? ' ✓' : ''}`;
      $('#useBtn').disabled = !stable;
    },
  });
  setTimeout(() => {
    const use = $('#useBtn'); if (!use) return;
    use.onclick = () => { C.measurements.readingDistanceCm = Math.round(G.median(samples.slice(-25))); checks(); };
    $('#manualSave').onclick = () => { const v = Number($('#manualIn').value); if (v >= 10 && v <= 100) { C.measurements.readingDistanceCm = v; checks(); } };
  }, 0);
}

function checkNear() {
  const samples = [];
  const words = { en: 'the quick brown fox reads small print', hi: 'छोटे अक्षर पढ़िए और बताइए', ta: 'சிறிய எழுத்துகளைப் படியுங்கள்' }[C.lang]
    || PACK_BY_CODE[C.lang]?.nearWords || 'the quick brown fox reads small print';
  const size = Math.max(7, 1.0 * pxPerMm()); // ~N5-N6 print
  cameraScreen({
    key: 'near_point', title: t('chk_near_point'), instruction: t('bringCloser'),
    extraHtml: `<p class="tiny" style="font-size:${size}px">${esc(words)}</p>`,
    actions: `<button class="btn primary big" id="blurBtn">${t('blurredNow')}</button>`,
    onFrame: (f) => {
      const ro = $('#readout'); if (!ro) return;
      if (!f || !f.distanceMm) { ro.textContent = t('noFace'); samples.push(null); return; }
      samples.push(f.distanceMm / 10); if (samples.length > 60) samples.shift();
      ro.innerHTML = `<b>${Math.round(f.distanceMm / 10)} cm</b>`;
    },
  });
  setTimeout(() => {
    const b = $('#blurBtn'); if (!b) return;
    b.onclick = () => {
      const recent = samples.slice(-10).filter((x) => x);
      // face lost because the phone is very close: focusing range is excellent
      C.measurements.nearPointCm = recent.length ? Math.round(G.median(recent)) : 12;
      checks();
    };
    $('#manualSave').onclick = () => { const v = Number($('#manualIn').value); if (v >= 8 && v <= 150) { C.measurements.nearPointCm = v; checks(); } };
  }, 0);
}

// ---------------------------------------------------------------- acuity (tumbling E)
const ROT = { right: 0, down: 90, left: 180, up: 270 };
const eSvg = (dir, sizePx) => `<svg class="optotype" width="${sizePx}" height="${sizePx}" viewBox="0 0 5 5" style="transform:rotate(${ROT[dir]}deg)" aria-label="E"><path d="M0 0H5V1H1V2H5V3H1V4H5V5H0Z" fill="currentColor"/></svg>`;

function checkAcuity(eye = 'R', pinhole = false) {
  const distanceMm = 2000;
  const st = A.createStaircase({ start: pinhole ? 0.5 : 0.6 });
  const cover = eye === 'R' ? t('leftEye') : t('rightEye');
  setScreen(`
    <section class="card acuity">
      <h2>${t('chk_acuity')} · ${eye === 'R' ? 'Right eye' : 'Left eye'}${pinhole ? ' · pinhole' : ''}</h2>
      <p class="say">${t('acuitySetup', { eye: cover })}</p>
      <div class="estage" id="stage"></div>
      <div class="arrows">
        <button class="btn" data-d="up">↑</button>
        <div class="row gap"><button class="btn" data-d="left">←</button><button class="btn" data-d="right">→</button></div>
        <button class="btn" data-d="down">↓</button>
      </div>
      <p class="muted small" id="lvl"></p>
      ${demoBtn('acuity')}
      <button class="btn ghost" id="backChecks">← ${t('back')}</button>
    </section>`, 'check-acuity');
  $('#backChecks').onclick = checks;
  wireDemo();
  if (settings.voice) V.speak(t('acuitySetup', { eye: cover }), C.lang);
  const show = () => {
    const o = A.nextOptotype(st);
    const px = Math.max(6, G.optotypeMm(o.level, distanceMm) * pxPerMm());
    $('#stage').innerHTML = eSvg(o.dir, Math.round(px));
    $('#lvl').textContent = `Line ${A.snellen(o.level)} · ${Math.round(px)} px`;
  };
  const answer = (d) => {
    A.respond(st, d);
    if (!st.done) { show(); return; }
    C.measurements.acuity = C.measurements.acuity || { distanceM: 2 };
    const rec = C.measurements.acuity[eye] || {};
    const lm = st.best === null ? 1.1 : st.best;
    if (pinhole) { rec.pinholeLogmar = lm; rec.pinholeImproved = lm <= rec.logmar - 0.2; }
    else rec.logmar = lm;
    C.measurements.acuity[eye] = rec;
    if (!pinhole && lm >= 0.5) { pinholeOffer(eye); return; }
    if (eye === 'R') checkAcuity('L'); else checks();
  };
  $$('[data-d]', main).forEach((b) => b.onclick = () => answer(b.dataset.d));
  let x0 = null; let y0 = null;
  const stage = $('#stage');
  stage.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; const dy = e.changedTouches[0].clientY - y0;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 30) answer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    x0 = null;
  });
  const key = (e) => { const m = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key]; if (m) { e.preventDefault(); answer(m); } };
  document.addEventListener('keydown', key);
  cleanup = () => document.removeEventListener('keydown', key);
  show();
}

function pinholeOffer(eye) {
  setScreen(`<section class="card"><h2>${t('chk_acuity')}</h2>
    <p class="say">${t('pinholePrompt')}</p>
    <div class="row gap"><button class="btn primary" id="ph">${t('pinholeTest')}</button><button class="btn ghost" id="noph">${t('skip')}</button></div></section>`, 'pinhole');
  if (settings.voice) V.speak(t('pinholePrompt'), C.lang);
  $('#ph').onclick = () => checkAcuity(eye, true);
  $('#noph').onclick = () => (eye === 'R' ? checkAcuity('L') : checks());
}

// ---------------------------------------------------------------- Amsler grid
function checkAmsler(eye = 'R') {
  const cell = 5 * pxPerMm(); // 5 mm squares
  const n = Math.max(8, Math.min(14, Math.floor((Math.min(window.innerWidth, 520) - 48) / cell)));
  const cover = eye === 'R' ? t('leftEye') : t('rightEye');
  setScreen(`<section class="card">
      <h2>${t('chk_amsler')} · ${eye === 'R' ? 'Right eye' : 'Left eye'}</h2>
      <p class="say">${t('amslerAsk', { eye: cover })}</p>
      <div class="amsler" style="--cell:${cell}px;--n:${n}"><i></i></div>
      <div class="row gap"><button class="btn big" id="aNo">${t('no')}</button><button class="btn big warn" id="aYes">${t('yes')}</button></div>
      ${demoBtn('amsler')}
      <button class="btn ghost" id="backChecks">← ${t('back')}</button></section>`, 'check-amsler');
  $('#backChecks').onclick = checks;
  wireDemo();
  if (settings.voice) V.speak(t('amslerAsk', { eye: cover }), C.lang);
  const rec = (v) => { C.measurements.amsler = { ...(C.measurements.amsler || {}), [eye]: v }; if (eye === 'R') checkAmsler('L'); else checks(); };
  $('#aNo').onclick = () => rec('normal');
  $('#aYes').onclick = () => rec('abnormal');
}

// ---------------------------------------------------------------- PD + fitting height
function checkPd() {
  let last = null;
  cameraScreen({
    key: 'pd', title: t('chk_pd'), instruction: t('pdAsk'),
    extraHtml: '<canvas id="still" class="still" hidden></canvas><div id="pdOut" class="pdout"></div>',
    actions: `<button class="btn primary" id="capBtn">${t('capture')}</button>`,
    onFrame: (f) => {
      const ro = $('#readout'); if (!ro) return;
      last = f;
      if (!f) { ro.textContent = t('noFace'); return; }
      const q = G.faceQuality(f.eyes);
      ro.innerHTML = `<b>${Math.round(f.distanceMm / 10)} cm</b> ${q.ok ? '✓' : `· ${t('holdStraight')}`}`;
    },
  });
  setTimeout(() => {
    $('#manualSave').onclick = () => { const v = Number($('#manualIn').value); if (v >= 45 && v <= 80) { C.measurements.pd = { binocularMm: v, method: 'manual (PD ruler)' }; checks(); } };
    const cap = $('#capBtn'); if (!cap) return;
    cap.onclick = () => {
      if (!last) return;
      // a tilted or turned head shortens the apparent PD: refuse the capture
      const quality = G.faceQuality(last.eyes);
      if (!quality.ok) { $('#pdOut').innerHTML = `<p class="warn-text">${t('holdStraight')} (tilt ${quality.rollDeg}°, turn ${quality.yawPct}%)</p>`; return; }
      const vid = $('#vid'); const cv = $('#still');
      cv.width = last.W; cv.height = last.H; cv.hidden = false;
      const snap = document.createElement('canvas');
      snap.width = last.W; snap.height = last.H; snap.getContext('2d').drawImage(vid, 0, 0);
      const g = cv.getContext('2d');
      const f = last; const eyes = f.eyes;
      let pd = { ...G.measurePd(eyes, { method: 'iris', eyeDistanceMm: f.distanceMm || 400 }), quality };
      const taps = []; let mode = null; let fh = {};
      const draw = () => {
        g.drawImage(snap, 0, 0);
        g.lineWidth = Math.max(2, f.W / 400);
        for (const p of [eyes.od, eyes.os]) { g.strokeStyle = '#ff7a1a'; g.beginPath(); g.arc(p.x, p.y, eyes.irisPx / 2, 0, 7); g.stroke(); }
        g.strokeStyle = '#1f9bb0'; g.beginPath(); g.moveTo(eyes.bridge.x, eyes.bridge.y - 40); g.lineTo(eyes.bridge.x, eyes.bridge.y + 40); g.stroke();
        for (const p of taps) { g.fillStyle = '#1f9bb0'; g.fillRect(p.x - 4, p.y - 4, 8, 8); }
      };
      const out = () => {
        $('#pdOut').innerHTML = `<p><b>PD ${pd.binocularMm} mm</b> (R ${pd.rightMm} · L ${pd.leftMm}) · near ${pd.nearMm} mm · ±${pd.uncertaintyMm} mm · ${pd.method} scale</p>
          ${fh.R ? `<p>Fitting height R ${fh.R} mm · L ${fh.L ?? '…'} mm</p>` : ''}
          <div class="row gap wrap"><button class="btn" id="cardBtn">Use ID-card scale</button><button class="btn" id="fhBtn">Fitting height</button><button class="btn primary" id="pdSave">${t('done')}</button></div>
          <p class="muted small" id="tapHint"></p>`;
        $('#cardBtn').onclick = () => { mode = 'card'; taps.length = 0; $('#tapHint').textContent = 'Card on the forehead: tap its left edge, then its right edge.'; };
        $('#fhBtn').onclick = () => { mode = 'fh'; taps.length = 0; $('#tapHint').textContent = 'Tap the bottom of the frame rim under the right pupil, then under the left.'; };
        $('#pdSave').onclick = () => { C.measurements.pd = { ...pd, fittingHeightMm: fh.R ? fh : undefined }; checks(); };
      };
      cv.onclick = (e) => {
        if (!mode) return;
        const r = cv.getBoundingClientRect();
        const p = { x: (e.clientX - r.left) * (cv.width / r.width), y: (e.clientY - r.top) * (cv.height / r.height) };
        taps.push(p); draw();
        if (mode === 'card' && taps.length === 2) {
          pd = { ...G.measurePd(eyes, { method: 'card', cardPx: Math.abs(taps[1].x - taps[0].x), eyeDistanceMm: f.distanceMm || 400 }), quality };
          mode = null; out();
        }
        if (mode === 'fh' && taps.length === 2) {
          const [rTap, lTap] = taps;
          fh = { R: G.fittingHeightMm(eyes.od.y, rTap.y, pd.mmPerPx), L: G.fittingHeightMm(eyes.os.y, lTap.y, pd.mmPerPx) };
          mode = null; out();
        }
      };
      draw(); out();
      cleanup?.(); // stop the camera: the still is enough
      cleanup = null;
      vid.hidden = true; cap.hidden = true;
    };
  }, 0);
}

// ====================================================================== summary
function buildCasePayload(prof) {
  const asked = C.session.trace.filter((x) => x.qid && !x.event).length;
  return {
    id: C.id, createdAt: C.createdAt, appVersion: APP_VERSION, lang: C.lang,
    site: C.site, operator: C.operator || settings.operator || null, demo: Boolean(C.demo),
    patient: { ...C.patient, age: C.session.answers.age ?? null, sex: C.session.answers.sex ?? null },
    consent: C.consent,
    interview: { answers: C.session.answers, trace: C.session.trace, skipped: C.session.skipped, startedAt: C.session.startedAt, finishedAt: C.session.finishedAt, asked, bank: E.bankSize(), notAsked: E.notAsked(C.session) },
    measurements: C.measurements,
    profile: prof,
    rulesVersion: RULES_VERSION,
    // the server's copy carries no name; the phone keeps the named copy for sharing
    passport: { lang: C.lang, text: passportText({ id: C.id, patient: {}, profile: prof, answers: C.session.answers }, C.lang) },
    passportLocal: passportText({ id: C.id, patient: C.patient, profile: prof, answers: C.session.answers }, C.lang),
  };
}

function summary() {
  const prof = buildProfile(C.session.answers, C.measurements, { trace: C.session.trace });
  const payload = buildCasePayload(prof);
  const mins = Math.max(1, Math.round((Date.now() - new Date(C.session.startedAt).getTime()) / 60000));
  setScreen(`
    <section class="card">
      <p class="eyebrow">${esc(C.patient.name || 'Patient')} · ${esc(shortCode(C.id))}${C.demo ? ' · demo' : ''}</p>
      ${profileHtml(prof, C.measurements, C.session.answers)}
      <p class="muted small">Asked ${payload.interview.asked} of ${payload.interview.bank} questions (${payload.interview.bank - payload.interview.asked} not relevant for this patient) · about ${mins} min${C.measurements.simulated ? ` · simulated checks: ${C.measurements.simulated.join(', ')}` : ''}</p>
    </section>
    <button class="btn primary big" id="sendBtn">📤 ${t('sendToOptom')}</button>
    <p id="sendState" class="muted small center"></p>
    <section class="card passport" id="passportCard" hidden>
      <h2>${t('passport')}</h2>
      <pre lang="${C.lang}">${esc(payload.passportLocal)}</pre>
      <div class="row gap wrap">
        <a class="btn" target="_blank" rel="noopener" href="${esc(whatsappLink(C.patient.phone, payload.passportLocal))}">${t('shareWa')}</a>
        <a class="btn" href="${esc(smsLink(C.patient.phone, payload.passportLocal))}">${t('shareSms')}</a>
      </div>
    </section>
    <button class="btn ghost big" id="nextPt">${t('newPatient')} →</button>`, 'summary');
  $('#sendBtn').onclick = async () => {
    $('#sendBtn').disabled = true;
    await store.putCase({ ...payload, sync: 'queued' });
    await store.clearDraft();
    $('#sendState').textContent = t('queued');
    const n = await store.syncPending();
    const hub = await store.getHubKey({ refresh: false });
    $('#sendState').textContent = `${n ? `✓ ${t('sent')}` : t('queued')} · 🔐 ${hub ? 'name and phone sealed so only the optometrist can read them' : 'name and phone stay on this phone'}`;
    $('#passportCard').hidden = false;
    updateHeader();
  };
  $('#nextPt').onclick = home;
}

// ====================================================================== inbox
async function inbox() {
  await store.syncPending();
  await store.pullReviews();
  const list = await store.allCases();
  const rows = list.map((c) => {
    if (c.unreadable) return `<li class="inrow muted">${esc(shortCode(c.id))}: encrypted with an older PIN</li>`;
    const lane = c.profile?.triage?.lane || 'green';
    const rv = c.review;
    return `<li class="inrow"><span class="dot ${lane}"></span><div><b>${esc(c.patient?.name || shortCode(c.id))}</b>
      <span class="muted small">${esc(c.profile?.summary || '')}</span>
      <span class="small">${c.sync === 'sent' ? (rv ? `🩺 ${esc(rv.decisionLabel || rv.decision)}: ${esc(rv.nextStep || '')}` : 'Waiting for optometrist') : t('queued')}</span></div>
      ${rv ? `<a class="btn" target="_blank" rel="noopener" href="${esc(whatsappLink(c.patient?.phone, passportText({ id: c.id, patient: c.patient, profile: c.profile, answers: c.interview?.answers, review: rv }, c.lang)))}">${t('shareWa')}</a>` : ''}</li>`;
  }).join('') || '<li class="muted">No cases on this phone yet.</li>';
  setScreen(`<section class="card"><h2>${t('results')}</h2><ul class="inbox">${rows}</ul></section>
    <div class="row gap"><button class="btn" id="refresh">↻ Refresh</button><button class="btn ghost" id="home">← Home</button></div>`, 'inbox');
  $('#refresh').onclick = inbox;
  $('#home').onclick = home;
}

// ====================================================================== calibration
function calibration() {
  const startPx = (calib.pxPerMm || G.defaultPxPerMm(isPhone())) * G.ID_CARD_MM;
  setScreen(`<section class="card">
      <h2>1 · Screen size</h2>
      <p class="say">Hold any ID card (Aadhaar, bank card) against the screen. Move the slider until the box matches the card’s width.</p>
      <div class="cardbox" id="cardbox" style="width:${startPx}px"></div>
      <input type="range" id="cardRange" min="150" max="900" value="${Math.round(startPx)}">
      <button class="btn" id="saveScreen">Save screen size</button>
      <p class="muted small" id="scrOut">${calib.pxPerMm ? `Saved: ${calib.pxPerMm.toFixed(2)} px/mm` : 'Not calibrated yet'}</p>
    </section>
    <section class="card">
      <h2>2 · Camera distance</h2>
      <p class="say">Hold the phone exactly 40 cm from your eyes (use the 40 cm cord from the near-vision kit). Look at the screen and tap Save.</p>
      <div class="cam"><video id="vid" playsinline muted></video><div id="readout" class="readout">${t('noFace')}</div></div>
      <button class="btn" id="saveCam" disabled>Save camera at 40 cm</button>
      <p class="muted small" id="camOut">${calib.focalNorm ? 'Camera calibrated' : 'Camera not calibrated (assumes a 63° lens)'}</p>
    </section>
    <button class="btn ghost" id="home">← Home</button>`, 'calibration');
  $('#cardRange').oninput = (e) => { $('#cardbox').style.width = `${e.target.value}px`; };
  $('#saveScreen').onclick = () => { calib.pxPerMm = Number($('#cardRange').value) / G.ID_CARD_MM; save('dd.calibration', calib); $('#scrOut').textContent = `Saved: ${calib.pxPerMm.toFixed(2)} px/mm`; };
  $('#home').onclick = home;
  const irisSamples = [];
  let W = 0; let stream = null; let stop = null; let cancelled = false;
  const vid = $('#vid');
  cleanup = () => { cancelled = true; stop?.(); stream?.getTracks().forEach((x) => x.stop()); };
  import('./measure/face.js').then(async (face) => {
    const [lm, s] = await Promise.all([face.loadLandmarker(), face.startCamera(vid)]);
    stream = s;
    if (cancelled) { face.stopCamera(s); return; }
    stop = face.track(vid, lm, (f) => {
      const ro = $('#readout'); if (!ro) return;
      if (!f) { ro.textContent = t('noFace'); return; }
      W = f.W; irisSamples.push(f.eyes.irisPx); if (irisSamples.length > 40) irisSamples.shift();
      ro.innerHTML = `iris <b>${f.eyes.irisPx.toFixed(1)} px</b>`;
      $('#saveCam').disabled = irisSamples.length < 20;
    }, focalPxFor);
  }).catch(() => { const ro = $('#readout'); if (ro) ro.textContent = t('cameraFail'); });
  $('#saveCam').onclick = () => {
    const iris = G.median(irisSamples.slice(-20));
    calib.focalNorm = G.focalFromCalibration(iris, 400) / W;
    save('dd.calibration', calib);
    $('#camOut').textContent = 'Camera calibrated';
  };
}

// ====================================================================== PIN lock
// Patient data on the phone is encrypted; the PIN unlocks the key for this
// session. Five wrong PINs start an escalating wait.
const FAILS_KEY = 'dd.pinFails';
const fails = () => load(FAILS_KEY, { n: 0, until: 0 });
const lockoutRemaining = () => Math.max(0, fails().until - Date.now());
const resetAttempts = () => save(FAILS_KEY, { n: 0, until: 0 });
function recordFailure() {
  const f = fails(); f.n += 1;
  if (f.n >= 5) f.until = Date.now() + 30000 * 2 ** (f.n - 5);
  save(FAILS_KEY, f);
}

function pinScreen(mode, next) {
  setScreen(`<section class="card pin">
    <h2>🔐 ${mode === 'set' ? t('pinSetTitle') : t('pinEnterTitle')}</h2>
    ${mode === 'set' ? `<p class="muted small">${t('pinSetHint')}</p>` : ''}
    <input id="pin1" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="••••••" aria-label="PIN">
    ${mode === 'set' ? `<input id="pin2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="${esc(t('pinConfirm'))}" aria-label="${esc(t('pinConfirm'))}">` : ''}
    <button class="btn primary big" id="pinGo">${mode === 'set' ? '✓' : '🔓'} ${t('next')}</button>
    <p id="pinErr" class="err" role="alert"></p>
    ${mode === 'enter' ? `<button class="btn ghost small" id="pinReset">${t('forgotPin')}</button>` : ''}
  </section>`, `pin-${mode}`);
  const go = async () => {
    const err = $('#pinErr');
    const p1 = $('#pin1').value.trim();
    if (!/^\d{6}$/.test(p1)) { err.textContent = '6 digits'; return; }
    const wait = lockoutRemaining();
    if (mode === 'enter' && wait > 0) { err.textContent = `Too many attempts: wait ${Math.ceil(wait / 1000)} s`; return; }
    $('#pinGo').disabled = true;
    try {
      if (mode === 'set') {
        if (p1 !== $('#pin2').value.trim()) { err.textContent = t('pinMismatch'); $('#pinGo').disabled = false; return; }
        await store.setupPin(p1);
      } else {
        await store.unlock(p1);
      }
      resetAttempts();
      next();
    } catch {
      recordFailure();
      err.textContent = t('pinWrong');
      $('#pinGo').disabled = false;
      $('#pin1').value = '';
    }
  };
  $('#pinGo').onclick = go;
  $$('input', main).forEach((i) => { i.onkeydown = (e) => { if (e.key === 'Enter') go(); }; });
  $('#pin1').focus();
  const rb = $('#pinReset');
  if (rb) rb.onclick = async () => { if (confirm(`${t('forgotPin')}?`)) { await store.resetVault(); pinScreen('set', next); } };
}

async function lockNow() {
  if (C && store.isUnlocked()) { const { still, ...s } = C; await store.saveDraft(s).catch(() => {}); }
  store.lock();
  C = null;
  pinScreen('enter', () => home());
}

// ====================================================================== phone check
// Pre-flight for a field session or a demo: everything that can silently fail.
async function phoneCheck() {
  const rows = [];
  const add = (label, ok, detail = '') => rows.push(`<li class="pc ${ok === null ? 'na' : ok ? 'ok' : 'bad'}"><b>${ok === null ? '–' : ok ? '✓' : '✗'} ${esc(label)}</b><span class="muted small">${esc(detail)}</span></li>`);
  add('Secure connection (HTTPS)', window.isSecureContext, window.isSecureContext ? location.origin : 'Microphone and camera need HTTPS (or localhost).');
  add('Microphone recording', V.sttSupported(), V.sttSupported() ? 'Records short clips for transcription' : 'Use a supported browser and tap answers if unavailable');
  add('Screen calibrated (eye-chart size)', Boolean(calib.pxPerMm), calib.pxPerMm ? `${calib.pxPerMm.toFixed(2)} px/mm` : 'Calibrate › Screen size');
  add('Camera calibrated (distances)', Boolean(calib.focalNorm), calib.focalNorm ? 'about ±5%' : 'Calibrate › Camera at 40 cm (otherwise ±15%)');
  let persisted = null;
  try { persisted = await navigator.storage?.persisted?.(); } catch { persisted = null; }
  add('Storage protected from clean-up', persisted ?? null, persisted ? 'Queued cases will not be evicted' : 'Not granted yet (Chrome grants it to installed or often-used sites)');
  add('Patient data encrypted on this phone', store.isUnlocked(), 'AES-256-GCM; key unlocked by your PIN; locks after 15 min idle');
  let health = null;
  try { const r = await fetch(`${store.API}/health`, { cache: 'no-store' }); health = r.ok ? await r.json() : null; } catch { health = null; }
  add('Bridge server reachable', Boolean(health), health ? `${health.cases} cases on the server` : 'Offline: cases queue and send later');
  add('Sarvam speech service', health?.voice?.configured === true, health?.voice?.configured
    ? `${health.voice.ttsModel} · ${health.voice.sttModel}`
    : 'Set SARVAM_API_KEY on the server; browser speech may be used as a fallback');
  const hub = await store.getHubKey();
  add('Optometrist hub key', Boolean(hub), hub ? `key ${hub.kid.slice(0, 10)}…: names and phones sealed to the hub` : 'No hub key yet: names and phones stay on this phone');
  let bat = null;
  try { bat = await navigator.getBattery?.(); } catch { bat = null; }
  if (bat) add('Battery', bat.level >= 0.3 || bat.charging, `${Math.round(bat.level * 100)}%${bat.charging ? ', charging' : ''}`);
  add('Cases waiting to send', true, String(await store.pendingCount()));
  setScreen(`<section class="card"><h2>Phone check</h2><ul class="pcheck">${rows.join('')}</ul>
      <h3>Try it</h3>
      <div class="row gap wrap">${Object.entries(LANGS).map(([k, v]) => `<button class="chip" data-say="${k}">🔊 ${v}</button>`).join('')}</div>
      <div class="row gap wrap"><button class="btn" id="micTest">🎙 Test microphone (${LANGS[settings.lang]})</button><button class="btn" id="camTest">📷 Test camera + face model</button></div>
      <div id="tryOut" class="muted"></div>
      <p class="muted small">App ${APP_VERSION} · rules ${RULES_VERSION}</p></section>
    <button class="btn ghost" id="home">← Home</button>`, 'phonecheck');
  const ageQ = QUESTION_BY_ID.age;
  $$('[data-say]', main).forEach((b) => { b.onclick = () => V.speak(questionText(ageQ, E.stateOf(E.createSession()), b.dataset.say), b.dataset.say); });
  $('#micTest').onclick = async () => {
    $('#tryOut').textContent = 'Listening… say an age, e.g. “fifty four”';
    const r = await V.listen(settings.lang);
    const v = r ? E.interpret(ageQ, r.transcript, settings.lang) : null;
    $('#tryOut').textContent = r ? `Heard “${r.transcript}” → ${v?.ok ? v.value : 'not understood'}` : 'Nothing heard: check the microphone permission or speech service';
  };
  $('#camTest').onclick = async () => {
    const out = $('#tryOut');
    out.innerHTML = '<div class="cam"><video id="vid" playsinline muted></video><div id="readout" class="readout">Loading face model…</div></div>';
    let stream = null; let stop = null; let face = null; let cancelled = false;
    cleanup = () => { cancelled = true; stop?.(); face?.stopCamera(stream); };
    try {
      face = await import('./measure/face.js');
      const t0 = performance.now();
      const vid = $('#vid');
      const [lm, s] = await Promise.all([face.loadLandmarker(), face.startCamera(vid)]);
      stream = s;
      if (cancelled) { face.stopCamera(s); return; }
      const ms = Math.round(performance.now() - t0);
      stop = face.track(vid, lm, (f) => {
        const ro = $('#readout'); if (!ro) return;
        ro.innerHTML = f ? `face ✓ <b>${Math.round(f.distanceMm / 10)} cm</b> · ready in ${ms} ms` : `looking for a face · ready in ${ms} ms`;
      }, focalPxFor);
    } catch (e) { if (!cancelled) out.textContent = `Camera or face model failed: ${e.message || e}`; }
  };
  $('#home').onclick = home;
}

// ====================================================================== boot
$('#voiceToggle').onclick = () => { settings.voice = !settings.voice; save('dd.settings', settings); if (!settings.voice) V.stopAll(); updateHeader(); };
$('#homeLink').onclick = (e) => { e.preventDefault(); if (store.isUnlocked()) home(); };
$('#lockBtn').onclick = lockNow;
['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, store.touch, { passive: true }));
setInterval(() => { if (store.idleTooLong()) lockNow(); }, 30000);

async function boot() {
  if (!store.hasVault()) pinScreen('set', route);
  else if (!store.isUnlocked()) pinScreen('enter', route);
  else route();
}

// Deep links for demos and screenshots: ?demo=kumar[&screen=summary|checks]
async function route() {
  const q = new URLSearchParams(location.search);
  const demo = q.get('demo');
  if (demo && PERSONA_BY_KEY[demo]) {
    const p = PERSONA_BY_KEY[demo];
    startCase(p.lang, p);
    const target = q.get('screen');
    if (target === 'summary' || target === 'checks') {
      C.consent = { given: true, at: new Date().toISOString(), lang: p.lang, textVersion: 'consent-v1', method: 'demo' };
      for (let i = 0; i < 60; i++) {
        const qq = E.nextQuestion(C.session); if (!qq) break;
        const r = E.interpret(qq, p.say[qq.id], qq.asr || p.lang);
        if (!r.ok) break;
        E.submitAnswer(C.session, qq.id, r.value, { raw: p.say[qq.id], mode: 'voice' });
      }
      if (target === 'summary') for (const k of buildProfile(C.session.answers, {}).checks) demoFill(k);
      (target === 'summary' ? summary : checks)();
    } else if (target === 'interview') {
      C.consent = { given: true, at: new Date().toISOString(), lang: p.lang, textVersion: 'consent-v1', method: 'demo' };
      const stopAt = Number(q.get('q') || 0);
      for (let i = 0; i < stopAt; i++) {
        const qq = E.nextQuestion(C.session); if (!qq) break;
        const r = E.interpret(qq, p.say[qq.id], qq.asr || p.lang);
        E.submitAnswer(C.session, qq.id, r.value, { raw: p.say[qq.id], mode: 'voice' });
      }
      if (q.get('still')) { C.still = p.say; C.demo = null; }
      interview();
    }
    return;
  }
  home();
  store.syncPending().then(updateHeader).catch(() => {});
}
boot();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
