// Renders a functional vision profile: shared by the field app (summary
// screen) and the optometrist portal.
import { snellen } from './measure/acuity.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const LANE_TXT = { red: 'Urgent: same-day referral', amber: 'Optometrist review: referral needed', green: 'Routine: optometrist sign-off' };
export const ZONE_NAME = { near: 'Near (reading, phone, sewing)', intermediate: 'Arm’s length (screen, counter, loom)', distance: 'Distance (outdoors, driving)' };

export function profileHtml(prof, m = {}, answers = {}) {
  const z = prof.vision.zones;
  const bars = ['near', 'intermediate', 'distance'].map((k) => `
    <div class="zone ${prof.vision.dominance === k ? 'dom' : ''}">
      <div class="row between"><span>${ZONE_NAME[k]}</span><span>${z[k].hours} h · ${Math.round(z[k].share * 100)}%</span></div>
      <div class="bar"><i style="width:${Math.round(z[k].share * 100)}%"></i></div>
      <span class="muted tiny-note">${z[k].source}${k === 'near' ? ` · ${z.near.workingDistanceCm} cm (${z.near.distanceSource})` : ''}</span>
    </div>`).join('');
  const p = prof.presbyopia;
  const r = prof.recommendation;
  const flags = prof.triage.flags.map((f) => `<li class="flag ${f.lane}"><b>${esc(f.title)}</b><span>${esc(f.detail)}</span><em>${esc(f.action)}</em></li>`).join('');
  return `
    <div class="lane ${prof.triage.lane}">${LANE_TXT[prof.triage.lane]}</div>
    <h3>Functional vision profile</h3>
    <p class="dominance">${prof.vision.dominance === 'balanced' ? 'Balanced' : prof.vision.dominance[0].toUpperCase() + prof.vision.dominance.slice(1) + '-dominant'}
      <span class="chip on">Lens design emphasis: ${prof.vision.designEmphasis}</span></p>
    ${bars}
    ${p ? `<div class="kv"><span>Accommodation</span><b>${p.amplitudeD} D</b><small>${esc(p.amplitudeSource)}; age-expected ≥ ${p.expectedAmplitudeD.min} D</small></div>
      <div class="kv"><span>Reading add (estimate)</span><b>${p.addD ? `+${p.addD.toFixed(2)} D` : 'none'}</b><small>for ${p.workingDistanceCm} cm · status: ${p.status}</small></div>` : ''}
    ${prof.myopiaRisk ? `<div class="kv"><span>Myopia risk</span><b>${prof.myopiaRisk.level}</b><small>${esc(prof.myopiaRisk.factors.join('; ') || 'no risk factors reported')}</small></div>` : ''}
    ${m.acuity?.R ? `<div class="kv"><span>Distance vision</span><b>R ${snellen(m.acuity.R.logmar)} · L ${snellen(m.acuity.L?.logmar ?? null)}</b><small>${['R', 'L'].filter((e) => m.acuity[e]?.pinholeLogmar !== undefined).map((e) => `${e} pinhole ${snellen(m.acuity[e].pinholeLogmar)}`).join(' · ')}</small></div>` : ''}
    ${m.pd ? `<div class="kv"><span>Centration</span><b>PD ${m.pd.binocularMm} mm</b><small>${m.pd.rightMm ? `R ${m.pd.rightMm} / L ${m.pd.leftMm} · near ${m.pd.nearMm} · ` : ''}${esc(m.pd.method)}</small></div>` : ''}
    ${answers.rx_known?.text ? `<div class="kv"><span>Current Rx</span><b>${esc(answers.rx_known.text)}</b></div>` : ''}
    ${flags ? `<h3>Flags</h3><ul class="flags">${flags}</ul>` : ''}
    <h3>Suggested</h3>
    <div class="rec"><b>${esc(r.title)}</b>
      <ul>${r.rationale.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      ${r.example ? `<p class="muted small">${esc(r.example)}</p>` : ''}
      ${r.coatings.length ? `<p class="small"><b>Coatings:</b> ${esc(r.coatings.join('; '))}</p>` : ''}
      ${r.notes.map((x) => `<p class="small note">${esc(x)}</p>`).join('')}
      ${r.centrationNeeded && !m.pd ? '<p class="small warn-text">Needs PD and fitting height before ordering.</p>' : ''}
    </div>
    ${decisionPathHtml(r.decisionPath)}
    ${qualityHtml(prof.quality)}
    ${prof.rulesVersion ? `<p class="muted tiny-note">Rules ${esc(prof.rulesVersion)}: proposed, for optometrist review</p>` : ''}`;
}

// How the lens category was reached: each rule checked, in order.
export function decisionPathHtml(path) {
  if (!path?.length) return '';
  return `<details class="dpath"><summary>How this suggestion was reached (${path.length} rules checked)</summary>
    <ol>${path.map((p) => `<li class="${p.passed ? 'pass' : 'fail'}"><b>${p.passed ? '✓' : '✗'} ${esc(p.rule)}</b><span>${esc(p.detail)}</span></li>`).join('')}</ol></details>`;
}

// What the profile rests on: reported, measured or assumed, and how reliable.
export function qualityHtml(q) {
  if (!q?.items?.length) return '';
  return `<details class="quality"><summary>Data quality: <b>${esc(q.level)}</b></summary>
    <ul>${q.items.map((i) => `<li class="${i.ok ? 'ok' : 'warn'}"><span>${i.ok ? '✓' : '!'} ${esc(i.label)}</span><em>${esc(i.value)}</em></li>`).join('')}</ul></details>`;
}
