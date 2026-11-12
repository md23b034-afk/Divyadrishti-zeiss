// Sarvam handles primary speech synthesis and recognition; browser voices are
// retained as a text-to-speech fallback when the server is unavailable.
import { LOCALE } from './i18n.js';

let voices = [];
function loadVoices() { voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : []; }
if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;
export const sttSupported = () => typeof navigator !== 'undefined'
  && Boolean(navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
    && (window.AudioContext || window.webkitAudioContext));

export function selectVoice(available, locale) {
  const loc = locale.replace('_', '-').toLowerCase();
  const base = loc.slice(0, 2);
  const candidates = available.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(base));
  const score = (v) => {
    const voiceLocale = v.lang.replace('_', '-').toLowerCase();
    return (voiceLocale === loc ? 100 : 0)
      + (voiceLocale.endsWith('-in') ? 20 : 0)
      + (/india|indian/i.test(v.name) ? 10 : 0)
      + (/natural|online|google/i.test(v.name) ? 2 : 0)
      + (v.localService ? 0 : 1);
  };
  return candidates.sort((a, b) => score(b) - score(a))[0] || null;
}

export function voiceFor(lang) {
  if (!voices.length) loadVoices();
  return selectVoice(voices, LOCALE[lang] || 'en-IN');
}

export const hasVoice = (lang) => ttsSupported() && Boolean(voiceFor(lang));

let activeAudio = null;
let activeAudioUrl = null;
let finishActiveAudio = null;
let finishBrowserSpeech = null;
let speechRequest = null;
let speechId = 0;
function stopSpeaking() {
  speechId++;
  speechRequest?.abort();
  speechRequest = null;
  finishActiveAudio?.();
  finishBrowserSpeech?.();
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = '';
    activeAudio = null;
  }
  if (activeAudioUrl) { URL.revokeObjectURL(activeAudioUrl); activeAudioUrl = null; }
  if (ttsSupported()) window.speechSynthesis.cancel();
}

function speakWithBrowser(text, lang, rate) {
  return new Promise((resolve) => {
    if (!ttsSupported() || !text) { resolve(false); return; }
    const voice = voiceFor(lang);
    if (!voice) { resolve(false); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = rate;
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (finishBrowserSpeech === cancel) finishBrowserSpeech = null;
      resolve(result);
    };
    const cancel = () => finish(false);
    finishBrowserSpeech = cancel;
    const timer = setTimeout(() => finish(true), Math.min(30000, 1500 + text.length * 90));
    utterance.onend = () => finish(true);
    utterance.onerror = () => finish(false);
    window.speechSynthesis.speak(utterance);
  });
}

export async function speak(text, lang, { rate = 0.9 } = {}) {
  if (!text) return false;
  stopSpeaking();
  const requestId = speechId;
  const controller = new AbortController();
  speechRequest = controller;
  try {
    const response = await fetch('/api/voice/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Speech service returned ${response.status}`);
    const blob = await response.blob();
    if (requestId !== speechId) return false;
    activeAudioUrl = URL.createObjectURL(blob);
    const audio = new Audio(activeAudioUrl);
    activeAudio = audio;
    return await new Promise((resolve) => {
      let done = false;
      const finish = (success) => {
        if (done) return;
        done = true;
        audio.onended = null;
        audio.onerror = null;
        if (finishActiveAudio === cancel) finishActiveAudio = null;
        if (activeAudio === audio) activeAudio = null;
        if (activeAudioUrl) { URL.revokeObjectURL(activeAudioUrl); activeAudioUrl = null; }
        resolve(success);
      };
      const cancel = () => finish(false);
      finishActiveAudio = cancel;
      audio.onended = () => finish(true);
      audio.onerror = () => finish(false);
      audio.play().catch(() => finish(false));
    });
  } catch (error) {
    if (error.name === 'AbortError' || requestId !== speechId) return false;
    return speakWithBrowser(text, lang, rate);
  } finally {
    if (speechRequest === controller) speechRequest = null;
  }
}

function wavFromAudioBuffer(buffer) {
  const targetRate = 16000;
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  const sampleCount = Math.floor(buffer.length * targetRate / buffer.sampleRate);
  const dataBytes = sampleCount * 2;
  const wav = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(wav);
  const write = (offset, value) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < sampleCount; i++) {
    const sourceIndex = i * buffer.sampleRate / targetRate;
    const low = Math.floor(sourceIndex);
    const fraction = sourceIndex - low;
    const sample = channels.reduce((sum, channel) => {
      const a = channel[low] || 0;
      const b = channel[Math.min(low + 1, channel.length - 1)] || 0;
      return sum + a + (b - a) * fraction;
    }, 0) / channels.length;
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return new Blob([wav], { type: 'audio/wav' });
}

async function toWav(blob) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error('Audio decoding is not supported');
  const context = new AudioContextClass();
  try {
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    return wavFromAudioBuffer(audio);
  } finally {
    await context.close();
  }
}

let activeRecorder = null;
let activeStream = null;
let activeListenController = null;
let cancelListening = null;
export function listen(lang, { onInterim = () => {}, timeoutMs = 9000 } = {}) {
  stopListening();
  return new Promise((resolve) => {
    let finished = false;
    let timer = null;
    const finish = (value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      activeListenController?.abort();
      activeListenController = null;
      if (activeRecorder?.state === 'recording') activeRecorder.stop();
      activeRecorder = null;
      activeStream?.getTracks().forEach((track) => track.stop());
      activeStream = null;
      cancelListening = null;
      resolve(value);
    };
    cancelListening = () => finish(null);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        });
        if (finished) { stream.getTracks().forEach((track) => track.stop()); return; }
        activeStream = stream;
        const supportedTypes = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'];
        const mimeType = supportedTypes.find((type) => MediaRecorder.isTypeSupported(type));
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        activeRecorder = recorder;
        const chunks = [];
        recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
        recorder.onerror = () => finish(null);
        recorder.onstop = async () => {
          if (finished) return;
          stream.getTracks().forEach((track) => track.stop());
          activeStream = null;
          try {
            const wav = await toWav(new Blob(chunks, { type: recorder.mimeType }));
            if (finished) return;
            const controller = new AbortController();
            activeListenController = controller;
            const response = await fetch(`/api/voice/transcribe?lang=${encodeURIComponent(lang)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'audio/wav' },
              body: wav,
              signal: controller.signal,
            });
            if (!response.ok) throw new Error(`Speech service returned ${response.status}`);
            const result = await response.json();
            const transcript = typeof result.transcript === 'string' ? result.transcript.trim() : '';
            finish(transcript ? {
              transcript,
              confidence: null,
              alternatives: [{ text: transcript, confidence: null }],
            } : null);
          } catch (error) {
            if (error.name !== 'AbortError') finish(null);
          }
        };
        recorder.start();
        onInterim('Recording…');
        timer = setTimeout(() => {
          if (recorder.state === 'recording') recorder.stop();
        }, timeoutMs);
      } catch {
        finish(null);
      }
    })();
  });
}

export function stopListening() {
  if (cancelListening) cancelListening();
}

export function stopAll() {
  stopListening();
  stopSpeaking();
}
