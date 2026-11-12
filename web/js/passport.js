// Vision Passport: the patient's own copy, in their language, short enough
// for one WhatsApp or SMS message. It travels with the patient to any store,
// camp or vision centre.
import { P, pt } from './i18n.js';
import { formatRx } from './engine/rx.js';

export const shortCode = (id) => `DD-${(id || '').replace(/-/g, '').slice(0, 6).toUpperCase()}`;

export function passportText({ id, patient, profile, answers, review = null }, lang = 'en') {
  const lines = [];
  lines.push(`${pt(P.title, lang)} · ${shortCode(id)}`);
  if (patient?.name) lines.push(`${patient.name} · ${new Date().toLocaleDateString('en-IN')}`);
  lines.push(`${pt(P.usedFor, lang)}: ${pt(P.zone[profile.vision.dominance], lang)}.`);
  const cat = review?.lensCategory || profile.recommendation.category;
  let lens = pt(P.lens[cat], lang);
  const add = review?.addD ?? profile.presbyopia?.addD;
  if (add && ['readers', 'office', 'bifocal', 'progressive', 'separate_pairs'].includes(cat)) lens += ` (add +${Number(add).toFixed(2)})`;
  lines.push(`${pt(P.suggested, lang)}: ${lens}.`);
  if (answers?.rx_known?.R || answers?.rx_known?.L) lines.push(`Rx: ${formatRx(answers.rx_known)}`);
  lines.push(pt(P.lane[profile.triage.lane], lang));
  const needs = [...new Set(profile.triage.flags.map((f) => pt(P.flag[f.code] || P.flag.default, lang)))];
  if (needs.length) lines.push(`${pt(P.needed, lang)}: ${needs.join('; ')}.`);
  if (review?.messageToPatient) lines.push(review.messageToPatient);
  const tips = profile.advice.slice(0, 2).map((k) => pt(P.advice[k], lang)).filter(Boolean);
  if (tips.length) lines.push(`${pt(P.tips, lang)}: ${tips.join(' ')}`);
  lines.push(pt(P.showThis, lang));
  return lines.join('\n');
}

const digits = (phone) => (phone || '').replace(/\D/g, '').replace(/^0+/, '');
export function whatsappLink(phone, text) {
  let d = digits(phone);
  if (d.length === 10) d = `91${d}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}
export const smsLink = (phone, text) => `sms:${digits(phone)}?body=${encodeURIComponent(text)}`;
