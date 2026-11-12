const COMMANDS = new Map([
  ['repeat', ['repeat', 'repeat that', 'repeat that please', 'say again', 'again', 'फिर से', 'दोबारा', 'दुबारा', 'दोहराइए', 'दोहराएं']],
  ['back', ['go back', 'back', 'previous', 'previous question', 'पीछे', 'वापस', 'पिछला', 'पिछला सवाल', 'पिछले सवाल पर']],
  ['yes', ['yes', 'yeah', 'yep', 'हाँ', 'हां', 'जी', 'जी हाँ', 'जी हां']],
  ['no', ['no', 'nope', 'नहीं', 'नही', 'ना']],
  ['next', ['next', 'continue', 'skip', 'go next', 'आगे', 'अगला', 'अगले', 'जारी रखें', 'आगे बढ़ें']],
]);

function normalize(text) {
  return String(text ?? '')
    .normalize('NFC')
    .toLocaleLowerCase()
    .replace(/[.,!?;:"“”()[\]{}।॥]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NORMALIZED_COMMANDS = new Map(
  [...COMMANDS].map(([command, phrases]) => [command, new Set(phrases.map(normalize))]),
);

export function voiceCommand(text) {
  const phrase = normalize(text);
  for (const [command, phrases] of NORMALIZED_COMMANDS) {
    if (phrases.has(phrase)) return command;
  }
  return null;
}
