import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectVoice } from '../../web/js/voice.js';

test('voice selection prefers the requested Indian English locale', () => {
  const voices = [
    { name: 'Google US English', lang: 'en-US', localService: false },
    { name: 'English India', lang: 'en-IN', localService: true },
  ];
  assert.equal(selectVoice(voices, 'en-IN'), voices[1]);
});

test('voice selection falls back to another voice in the same language', () => {
  const voices = [
    { name: 'English US', lang: 'en-US', localService: true },
    { name: 'Hindi India', lang: 'hi-IN', localService: true },
  ];
  assert.equal(selectVoice(voices, 'en-IN'), voices[0]);
});
