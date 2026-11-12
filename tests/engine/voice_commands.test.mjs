import { test } from 'node:test';
import assert from 'node:assert/strict';
import { voiceCommand } from '../../web/js/voice_commands.js';

test('voice controls recognize English and Hindi phrases', () => {
  for (const [phrase, expected] of [
    ['Repeat that, please.', 'repeat'],
    ['फिर से', 'repeat'],
    ['Go back', 'back'],
    ['वापस', 'back'],
    ['Yes!', 'yes'],
    ['नहीं', 'no'],
    ['Continue', 'next'],
    ['आगे', 'next'],
  ]) {
    assert.equal(voiceCommand(phrase), expected, phrase);
  }
});

test('voice controls ignore ordinary answer phrases', () => {
  assert.equal(voiceCommand('I have diabetes'), null);
  assert.equal(voiceCommand('not sure'), null);
});
