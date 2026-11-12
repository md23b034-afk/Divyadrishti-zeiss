// Remote Optometrist Bridge: review queue, case detail, decision, reply.
// Patient identity arrives sealed to this hub's key and is opened only here,
// in the optometrist's browser; the server never sees names or phone numbers.
import { profileHtml, esc } from './profile_view.js';
import { LANGS } from './i18n.js';
import { passportText, shortCode, whatsappLink } from './passport.js';
import { QUESTION_BY_ID } from './engine/questions.js';
import { PACKS } from './lang/index.js';
import { generateHubKeyPair, exportJwk, importHubPrivateKey, openFromHub, jwkThumbprint } from './crypto.js';

const API = new URLSearchParams(location.search).get('api') || '/api';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

const me = load('dd.reviewer', { name: 'Optom. A. Meenakshi', regNo: 'TN-OPT-0000 (demo)' });
// Deployed servers require a portal token. Open portal.html#token=XXXX once:
// the fragment never reaches the server or its logs, and is removed at once.
const frag = new URLSearchParams(location.hash.slice(1));
if (frag.get('token')) { save('dd.portalToken', frag.get('token')); history.replaceState(null, '', location.pathname + location.search); }
const token = load('dd.portalToken', null);
let laneFilter = '';
let selected = new URLSearchParams(location.search).get('case');
let rows = [];

const LENS = {
  readers: 'Reading glasses', office: 'Office / near-variable lens', progressive: 'Progressive', bifocal: 'Bifocal',
  sv_distance: 'Single vision, distance', separate_pairs: 'Separate distance + reading pairs', child_refraction: 'Child: cycloplegic refraction',
  no_change: 'No change', urgent_referral: 'No glasses: urgent referral',
};
const DECISION = { approve: 'Approve', modify: 'Approve with changes', in_person: 'In-person examination', urgent: 'Urgent referral' };
const REPLY = {
  approve: { en: 'Your glasses are approved. Please collect them at {site}.', hi: 'आपका चश्मा मंज़ूर हो गया है। कृपया {site} से ले लें।', ta: 'உங்கள் கண்ணாடி அங்கீகரிக்கப்பட்டது. {site}-இல் பெற்றுக்கொள்ளுங்கள்.' },
  modify: { en: 'Your glasses are approved with a small change. Please visit {site}.', hi: 'आपका चश्मा थोड़े बदलाव के साथ मंज़ूर हुआ है। कृपया {site} आइए।', ta: 'சிறிய மாற்றத்துடன் உங்கள் கண்ணாடி அங்கீகரிக்கப்பட்டது. {site}-க்கு வாருங்கள்.' },
  in_person: { en: 'Please come for a full eye examination at {place}.', hi: 'कृपया पूरी आँखों की जाँच के लिए {place} आइए।', ta: 'முழு கண் பரிசோதனைக்கு {place}-க்கு வாருங்கள்.' },
  urgent: { en: 'Please go to {place} today. This cannot wait.', hi: 'कृपया आज ही {place} जाइए। इसमें देर नहीं करनी चाहिए।', ta: 'தயவுசெய்து இன்றே {place}-க்குச் செல்லுங்கள். இதைத் தள்ளிப்போடக் கூடாது.' },
};
const PLACES = {
  in_person: { en: 'the next eye camp or the vision centre', hi: 'अगले आँखों के कैंप या विज़न सेंटर', ta: 'அடுத்த கண் முகாம் அல்லது பார்வை மையம்' },
  urgent: { en: 'the partner eye hospital', hi: 'सहयोगी आँखों के अस्पताल', ta: 'இணைந்த கண் மருத்துவமனை' },
};
for (const p of PACKS) {
  for (const k of Object.keys(REPLY)) REPLY[k][p.code] = p.reply[k];
  for (const k of Object.keys(PLACES)) PLACES[k][p.code] = p.places[k];
}

const headers = (extra = {}) => ({ 'X-Actor': `portal:${me.name}`, ...(token ? { 'X-Portal-Token': token } : {}), ...extra });

// ---------------------------------------------------------------- hub keys
// The hub's private key lives only in this browser (IndexedDB, non-extractable).
// A recovery file is downloaded once at setup, to restore it on another device.
const HUB_DB = 'divyadrishti-hub';
function hubDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HUB_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('keys');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function hubGet() {
  const d = await hubDb();
  return new Promise((resolve) => { const r = d.transaction('keys').objectStore('keys').get('hub'); r.onsuccess = () => resolve(r.result || null); r.onerror = () => resolve(null); });
}
async function hubPut(v) {
  const d = await hubDb();
  return new Promise((resolve, reject) => { const t = d.transaction('keys', 'readwrite'); t.objectStore('keys').put(v, 'hub'); t.oncomplete = resolve; t.onerror = () => reject(t.error); });
}
let hub = null; // { kid, key: CryptoKey (private, non-extractable) }
let serverKid = null;
const identities = new Map();

async function loadHub() {
  hub = await hubGet();
  try { const r = await fetch(`${API}/hub/key`, { headers: headers() }); serverKid = r.ok ? (await r.json()).kid : null; } catch { serverKid = null; }
  renderHubBanner();
}

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function setupHub() {
  const pair = await generateHubKeyPair();
  const pub = await exportJwk(pair.publicKey);
  const priv = await exportJwk(pair.privateKey);
  const kid = await jwkThumbprint(pub);
  const r = await fetch(`${API}/hub/key${serverKid ? '?replace=true' : ''}`, { method: 'PUT', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ jwk: pub }) });
  if (!r.ok) { alert(`Could not register the hub key (${r.status})`); return; }
  download(`divyadrishti-hub-recovery-${kid.slice(0, 8)}.json`, JSON.stringify({ kid, jwk: priv, note: 'DivyaDrishti hub private key. Keep offline; anyone with this file can read patient identities.' }));
  await hubPut({ kid, key: await importHubPrivateKey(priv) });
  identities.clear();
  await loadHub(); await refreshList(); if (selected) showCase(selected);
}

async function importRecovery(file) {
  try {
    const { kid, jwk } = JSON.parse(await file.text());
    await hubPut({ kid, key: await importHubPrivateKey(jwk) });
    identities.clear();
    await loadHub(); await refreshList(); if (selected) showCase(selected);
  } catch { alert('That is not a valid hub recovery file.'); }
}

function renderHubBanner() {
  const el = $('#hubBanner'); if (!el) return;
  if (hub && serverKid === hub.kid) { el.innerHTML = `🔐 Identity encryption on · hub key ${esc(hub.kid.slice(0, 10))}…`; el.className = 'hubok'; return; }
  el.className = 'hubwarn';
  el.innerHTML = `${!serverKid ? 'No hub key yet: field phones keep names and phones to themselves.' : 'This browser cannot open sealed identities.'}
    <button class="btn" id="hubSetup">${serverKid ? 'Replace hub key' : 'Set up identity encryption'}</button>
    <label class="btn ghost">Import recovery file<input type="file" id="hubImport" accept="application/json" hidden></label>`;
  $('#hubSetup').onclick = setupHub;
  $('#hubImport').onchange = (e) => e.target.files[0] && importRecovery(e.target.files[0]);
}

// Who is this patient? Demo cases carry synthetic names; real ones are sealed.
async function identityOf(id, p = {}) {
  if (p.name) return { name: p.name, phone: p.phone, village: p.village, how: 'demo (synthetic, unencrypted)' };
  if (!p.sealed) return { name: null, how: 'kept on the field phone' };
  if (identities.has(id)) return identities.get(id);
  let out = { name: null, how: 'sealed: this browser has no matching hub key' };
  if (hub && p.sealed.kid === hub.kid) {
    try { out = { ...(await openFromHub(p.sealed, hub.key, id)), how: 'sealed to this hub, opened here' }; } catch { out = { name: null, how: 'sealed: could not be opened' }; }
  }
  identities.set(id, out);
  return out;
}

function ago(iso) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
}
function slaText(r) {
  if (r.status === 'reviewed') return { cls: 'done', txt: `✓ ${esc(r.review?.decisionLabel || 'reviewed')}` };
  const m = Math.round((new Date(r.slaDueAt).getTime() - Date.now()) / 60000);
  const fmt = (x) => (Math.abs(x) < 60 ? `${Math.abs(x)} min` : `${Math.floor(Math.abs(x) / 60)} h ${Math.abs(x) % 60} min`);
  return m < 0 ? { cls: 'over', txt: `overdue ${fmt(m)}` } : { cls: '', txt: `due in ${fmt(m)}` };
}

async function refreshList() {
  try {
    rows = await (await fetch(`${API}/cases`, { headers: headers() })).json();
  } catch { $('#listMeta').textContent = 'Server unreachable: retrying…'; return; }
  const openOnly = $('#openOnly').checked;
  const shown = rows.filter((r) => (!laneFilter || r.lane === laneFilter) && (!openOnly || r.status !== 'reviewed'));
  const ids = await Promise.all(shown.map((r) => identityOf(r.id, r.patient || {})));
  $('#cases').innerHTML = shown.map((r, i) => {
    const s = slaText(r);
    const p = r.patient || {};
    const who = ids[i].name ? esc(ids[i].name) : `${esc(shortCode(r.id))}${p.sealed ? ' 🔐' : ''}`;
    return `<li class="crow ${r.id === selected ? 'sel' : ''}" data-id="${esc(r.id)}">
      <span class="bar ${r.lane}"></span>
      <div><b>${who}</b><span class="sub">${esc(p.age ?? '?')} · ${esc(p.sex || '')} · ${esc(r.site?.name || '')} · ${LANGS[r.lang] || ''}</span>
      <span class="sub">${esc((r.flags || []).slice(0, 2).join(' · ') || r.summary || '')}</span></div>
      <div class="sla ${s.cls}">${s.txt}<br><span class="muted">${ago(r.receivedAt)}</span>${r.demo ? '<br><span class="muted">demo</span>' : ''}</div></li>`;
  }).join('') || '<li class="muted">No cases.</li>';
  const open = rows.filter((r) => r.status !== 'reviewed');
  $('#listMeta').textContent = `${open.length} open · ${open.filter((r) => r.lane === 'red').length} red · ${rows.filter((r) => r.overdue).length} overdue · targets: red 2 h, amber 24 h, green 72 h`;
  $$('.crow').forEach((li) => li.onclick = () => { selected = li.dataset.id; history.replaceState(null, '', `?case=${selected}`); refreshList(); showCase(selected); });
}

function traceHtml(c) {
  const rowsHtml = (c.interview?.trace || []).map((t) => {
    if (t.event === 'urgent_mode') return `<tr class="urgent"><td colspan="3"><b>Urgent mode:</b> ${esc(t.reason)}</td></tr>`;
    if (t.event === 'skipped') return `<tr><td colspan="3" class="muted">${esc(t.qid)}: skipped by operator</td></tr>`;
    const q = QUESTION_BY_ID[t.qid];
    let val = t.value;
    if (q?.type === 'yesno') val = t.value ? 'Yes' : 'No';
    else if (q?.type === 'single') val = q.options.find((o) => o.v === t.value)?.label.en ?? t.value;
    else if (q?.type === 'multi') val = (t.value || []).map((v) => q.options.find((o) => o.v === v)?.label.en ?? v).join(', ');
    else if (q?.type === 'rx') val = t.value?.skipped ? 'skipped' : t.value?.text;
    else if (q?.type === 'hours') val = `${t.value} h/day`;
    return `<tr><td class="q">${esc(t.questionEn)}<span class="why">${esc(t.reason)}</span></td>
      <td>${t.raw ? `<span class="raw" lang="${esc(t.lang)}">“${esc(t.raw)}”</span>` : '<span class="muted">tap</span>'}</td>
      <td><b>${esc(val)}</b><br><span class="muted">${esc(t.mode)}</span></td></tr>`;
  }).join('');
  const notAsked = (c.interview?.notAsked || []).map((id) => {
    const q = QUESTION_BY_ID[id];
    return q && typeof q.text === 'object' ? q.text.en : id;
  });
  return `<table class="trace"><tr><th>Question (why it was asked)</th><th>Patient said</th><th>Recorded</th></tr>${rowsHtml}</table>
    <details class="small"><summary>${c.interview?.asked} of ${c.interview?.bank} questions asked · ${notAsked.length} skipped as not relevant for this patient</summary>
      <ul>${notAsked.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>`;
}

function reviewForm(c) {
  const rec = c.profile.recommendation;
  const lane = c.profile.triage.lane;
  const def = lane === 'red' ? 'urgent' : lane === 'amber' ? 'in_person' : 'approve';
  const lensOpts = Object.entries(LENS).map(([k, v]) => `<option value="${k}" ${k === rec.category ? 'selected' : ''}>${v}</option>`).join('');
  const emph = ['Balanced', 'Intermediate', 'Near'].map((k) => `<option ${k === c.profile.vision.designEmphasis ? 'selected' : ''}>${k}</option>`).join('');
  const add = c.profile.presbyopia?.addD || '';
  return `<form class="card form" id="rvForm">
    <h2>Your decision</h2>
    <div class="decisions">${Object.entries(DECISION).map(([k, v]) => `<label><input type="radio" name="decision" value="${k}" ${k === def ? 'checked' : ''}> ${v}</label>`).join('')}</div>
    <div class="row gap"><label style="flex:2">Lens category<select name="lensCategory">${lensOpts}</select></label>
      <label style="flex:1">Design emphasis<select name="designEmphasis">${emph}</select></label>
      <label style="flex:1">Add (D)<input name="addD" type="number" step="0.25" min="0" max="4" value="${add}"></label></div>
    <label>Next step (shown to the store / camp)<input name="nextStep" value="${esc(c.profile.triage.flags[0]?.action || 'Dispense as suggested; recheck in 12 months.')}"></label>
    <label>Clinical notes<textarea name="notes"></textarea></label>
    <label>Message to the patient (${LANGS[c.lang]})<textarea name="messageToPatient" lang="${c.lang}" id="msg"></textarea></label>
    <div class="row gap"><button class="btn primary" type="submit">Sign and send</button><span class="muted small">Signed as ${esc(me.name)} (${esc(me.regNo || '')})</span></div>
    <p class="err" id="rvErr"></p>
  </form>`;
}

function fillMessage(c) {
  const form = $('#rvForm'); if (!form) return;
  const d = form.decision.value;
  const tpl = REPLY[d][c.lang] || REPLY[d].en;
  form.messageToPatient.value = tpl.replace('{site}', c.site?.name || 'the store').replace('{place}', (PLACES[d] || PLACES.in_person)[c.lang] || PLACES.in_person.en);
}

async function showCase(id) {
  const det = $('#detail');
  let c;
  try { c = await (await fetch(`${API}/cases/${id}`, { headers: headers() })).json(); } catch { det.innerHTML = '<p class="err">Could not load the case.</p>'; return; }
  if (!c || !c.profile) { det.innerHTML = '<p class="err">Case not found.</p>'; return; }
  const p = c.patient || {};
  const who = await identityOf(c.id, p);
  const rv = c.review;
  const passport = passportText({ id: c.id, patient: { name: who.name || '' }, profile: c.profile, answers: c.interview?.answers, review: rv }, c.lang);
  let audit = [];
  try { audit = await (await fetch(`${API}/audit?case_id=${encodeURIComponent(c.id)}`, { headers: headers() })).json(); } catch { audit = []; }
  det.innerHTML = `
    <div class="dhead">
      <div><p class="eyebrow">${esc(shortCode(c.id))} · ${esc(c.site?.name || '')} (${esc(c.site?.type || '')}) · ${LANGS[c.lang]} · ${ago(c.server.receivedAt)}${c.demo ? ' · synthetic demo case' : ''}</p>
        <h1>${esc(who.name || `Patient ${shortCode(c.id)}`)} · ${esc(p.age ?? '?')} ${esc(p.sex || '')}</h1>
        <p class="muted">${esc(who.village || (p.pin ? `PIN ${p.pin}` : ''))} · 🔐 identity: ${esc(who.how)} · consent ${c.consent?.given ? `recorded ${esc(c.consent.lang)} ${esc((c.consent.at || '').slice(0, 16).replace('T', ' '))}` : 'MISSING'} · operator: ${esc(c.operator || 'unknown')}${c.rulesVersion || c.profile.rulesVersion ? ` · rules ${esc(c.rulesVersion || c.profile.rulesVersion)}` : ''}</p></div>
      <div class="row gap wrap"><a class="btn" href="${API}/cases/${esc(c.id)}/fhir" target="_blank" rel="noopener">FHIR R4 bundle</a>
        <button class="btn ghost" id="eraseBtn" title="Patient asked for their data to be deleted">Erase</button></div>
    </div>
    <div class="dgrid">
      <div>
        <section class="card">${profileHtml(c.profile, c.measurements || {}, c.interview?.answers || {})}</section>
      </div>
      <div>
        ${rv ? `<section class="card reviewed"><h2>✓ ${esc(rv.decisionLabel)}</h2><p>${esc(rv.nextStep)}</p>${rv.notes ? `<p class="small">${esc(rv.notes)}</p>` : ''}
          <p class="muted small">${esc(rv.reviewer?.name)} · ${esc((rv.reviewedAt || '').slice(0, 16).replace('T', ' '))}</p></section>` : reviewForm(c)}
        <section class="card"><h2>Vision Passport (${LANGS[c.lang]})</h2><pre class="pp" lang="${c.lang}">${esc(passport)}</pre>
          ${who.phone ? `<a class="btn" target="_blank" rel="noopener" href="${esc(whatsappLink(who.phone, passport))}">Send on WhatsApp</a>` : '<p class="muted small">The phone number is not on the server: the field phone sends the reply from its inbox.</p>'}</section>
      </div>
    </div>
    <section class="card"><h2>Adaptive interview</h2>${traceHtml(c)}</section>
    <section class="card"><h2>Access log</h2><p class="muted small">Every view, review, export and erasure of this case, append-only. No personal data is logged.</p>
      <table class="trace"><tr><th>When (UTC)</th><th>Who</th><th>What</th><th>Detail</th></tr>
      ${audit.map((a) => `<tr><td>${esc((a.at || '').replace('T', ' ').slice(0, 19))}</td><td>${esc(a.actor)}</td><td>${esc(a.action.replace(/_/g, ' '))}</td><td>${esc(a.detail || '')}</td></tr>`).join('')}</table></section>`;
  const form = $('#rvForm');
  if (form) {
    fillMessage(c);
    $$('input[name=decision]', form).forEach((r) => r.onchange = () => fillMessage(c));
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const body = {
        reviewer: me, decision: fd.get('decision'), lensCategory: fd.get('lensCategory'), designEmphasis: fd.get('designEmphasis'),
        addD: fd.get('addD') === '' ? null : Number(fd.get('addD')), nextStep: fd.get('nextStep'), notes: fd.get('notes'), messageToPatient: fd.get('messageToPatient'),
      };
      const r = await fetch(`${API}/cases/${c.id}/review`, { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
      if (!r.ok) { $('#rvErr').textContent = `Could not save (${r.status})`; return; }
      await refreshList(); showCase(c.id);
    };
  }
  $('#eraseBtn').onclick = async () => {
    if (!confirm('Erase this case permanently? Use only when the patient asks for deletion.')) return;
    const r = await fetch(`${API}/cases/${c.id}`, { method: 'DELETE', headers: headers() });
    if (r.ok) { selected = null; det.innerHTML = '<p class="muted">Case erased.</p>'; refreshList(); }
  };
}

async function planning() {
  const el = $('#planningTab');
  let s;
  try { s = await (await fetch(`${API}/stats`, { headers: headers() })).json(); } catch { el.innerHTML = '<p class="err">Server unreachable.</p>'; return; }
  const maxFlag = Math.max(1, ...s.topFlags.map((f) => f[1]));
  const places = Object.entries(s.byPlace).sort((a, b) => (b[1].amber + b[1].red) - (a[1].amber + a[1].red));
  const maxPlace = Math.max(1, ...places.map(([, v]) => v.cases));
  const LABEL = { ...LENS };
  el.innerHTML = `
    <h1>Camp planning</h1>
    <p class="muted">Pooled, de-identified counts from every store and camp on the bridge: where referrals cluster, which specialist camp to run next, what lens mix to stock.</p>
    <div class="tiles">
      <div class="tile"><div class="n">${s.cases}</div><div class="l">cases</div></div>
      <div class="tile"><div class="n" style="color:var(--red)">${s.byLane.red}</div><div class="l">red (same-day)</div></div>
      <div class="tile"><div class="n" style="color:#b07c00">${s.byLane.amber}</div><div class="l">amber (referral)</div></div>
      <div class="tile"><div class="n" style="color:var(--green)">${s.byLane.green}</div><div class="l">green (sign-off)</div></div>
      <div class="tile"><div class="n">${s.medianQuestionsAsked ?? '–'}</div><div class="l">median questions asked (of 30)</div></div>
      <div class="tile"><div class="n">${s.medianReviewMinutes ?? '–'}</div><div class="l">median minutes to review</div></div>
    </div>
    <div class="cols">
      <section class="card"><h2>Why patients are referred</h2>
        ${s.topFlags.map(([k, n]) => `<div class="hbar amber"><span>${esc(k)}</span><i style="width:${(n / maxFlag) * 100}%"></i><b>${n}</b></div>`).join('') || '<p class="muted">No flags yet.</p>'}</section>
      <section class="card"><h2>Referrals by area (PIN)</h2>
        ${places.map(([k, v]) => `<div class="hbar"><span>${esc(k)} <span class="muted">(${v.amber} amber, ${v.red} red)</span></span><i style="width:${(v.cases / maxPlace) * 100}%"></i><b>${v.cases}</b></div>`).join('')}</section>
      <section class="card"><h2>Suggested lens mix</h2>
        ${Object.entries(s.recommendations).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<div class="hbar"><span>${esc(LABEL[k] || k)}</span><i style="width:${(n / s.cases) * 100}%"></i><b>${n}</b></div>`).join('')}</section>
      <section class="card"><h2>Vision profiles</h2>
        ${Object.entries(s.dominance).map(([k, n]) => `<div class="hbar"><span>${esc(k)}</span><i style="width:${(n / s.cases) * 100}%"></i><b>${n}</b></div>`).join('')}</section>
    </div>`;
}

$$('[data-lane]').forEach((b) => b.onclick = () => { laneFilter = b.dataset.lane; $$('[data-lane]').forEach((x) => x.classList.toggle('on', x === b)); refreshList(); });
$('#openOnly').onchange = refreshList;
$$('[data-tab]').forEach((b) => b.onclick = () => {
  $$('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
  const plan = b.dataset.tab === 'planning';
  $('#queueTab').hidden = plan; $('#planningTab').hidden = !plan;
  if (plan) planning();
});
$('#me').textContent = `🩺 ${me.name}`;
$('#me').onclick = () => {
  const n = prompt('Reviewer name', me.name); if (!n) return;
  const reg = prompt('Registration number', me.regNo || '') || '';
  me.name = n; me.regNo = reg; save('dd.reviewer', me); $('#me').textContent = `🩺 ${me.name}`;
};

await loadHub();
await refreshList();
if (!selected && rows.length) selected = rows[0].id;
if (selected) showCase(selected);
setInterval(refreshList, 8000);
if (new URLSearchParams(location.search).get('tab') === 'planning') $('[data-tab=planning]').click();
