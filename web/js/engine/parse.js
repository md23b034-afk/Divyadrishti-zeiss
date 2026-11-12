// Multilingual parsing of spoken (speech-recognition) or typed answers.
// Languages: English (en), Hindi (hi), Tamil (ta), Telugu (te), Marathi (mr),
// Kannada (kn), including romanised and code-mixed speech ("sugar irukku",
// "do-teen ghante", "BP undi").
// Pure functions, no DOM: unit-tested in tests/engine/parse.test.mjs.

export const LANG_CODES = ['en', 'hi', 'ta', 'te', 'mr', 'kn'];

// Native digits: Devanagari (hi, mr), Tamil, Telugu, Kannada
const DIGIT_BASES = [0x0966, 0x0BE6, 0x0C66, 0x0CE6];
const DIGIT_RE = /[०-९௦-௯౦-౯೦-೯]/g;
const digitOf = (ch) => {
  const c = ch.codePointAt(0);
  for (const b of DIGIT_BASES) if (c >= b && c <= b + 9) return String(c - b);
  return ch;
};

// Devanagari, Tamil, Telugu, Kannada blocks
const INDIC_RE = /[ऀ-ॿ஀-௿ఀ-౿ಀ-೿]/;
const isIndic = (s) => INDIC_RE.test(s);

export function normalize(text) {
  let s = (text ?? '').toString().normalize('NFC').toLowerCase();
  s = s.replace(DIGIT_RE, digitOf);
  s = s.replace(/['‘’`]/g, '');
  s = s.replace(/[!?;:"“”()[\]{}।॥,]/g, ' ');
  s = s.replace(/(?<!\d)\.|\.(?!\d)/g, ' '); // keep only decimal points
  s = s.replace(/\s*-\s*/g, ' - '); // "2-3", "दो-तीन", "check-up" -> separate tokens
  return s.replace(/\s+/g, ' ').trim();
}

// Consume one keyword from normalised text. Indic keywords of 3+ code points
// also match as a token prefix, because Indian languages attach suffixes
// (இல்லைங்க, सुगरची, ಇಲ್ಲವೇ, లేదండి).
function consume(norm, keyword) {
  const p = normalize(keyword);
  if (!p) return { hit: false, rest: norm };
  if (p.includes(' ')) {
    const padded = ` ${norm} `;
    const i = padded.indexOf(` ${p} `);
    if (i === -1) return { hit: false, rest: norm };
    const rest = (padded.slice(0, i) + ' # ' + padded.slice(i + p.length + 2)).trim();
    return { hit: true, rest };
  }
  const toks = norm.split(' ');
  const prefixOk = isIndic(p) && [...p].length >= 3;
  const idx = toks.findIndex((t) => t === p || (prefixOk && t.startsWith(p)));
  if (idx === -1) return { hit: false, rest: norm };
  toks[idx] = '#';
  return { hit: true, rest: toks.join(' ') };
}

export function containsAny(text, keywords) {
  const n = normalize(text);
  return keywords.some((k) => consume(n, k).hit);
}

const byLengthDesc = (arr, key = (x) => x) =>
  [...arr].sort((a, b) => normalize(key(b)).length - normalize(key(a)).length);

// ---------------------------------------------------------------- yes / no
// Words safe in any session, plus a few that only mean yes/no in one language
// (Marathi "हो" is "yes", but in Hindi it is just a verb).
const NO_BASE = [
  'no', 'nope', 'nah', 'not', 'never', 'none', 'dont', 'do not', 'didnt', 'did not', 'havent', 'have not',
  'not really', 'no problem', 'nothing', 'nahi', 'nahin', 'nai', 'kabhi nahi', 'illa', 'illai', 'ille',
  'illainga', 'kidaiyathu', 'kidayathu', 'venda', 'vendam', 'ledu', 'kaadu', 'vaddu', 'beda', 'nako',
  // Hindi
  'नहीं', 'नही', 'कभी नहीं', 'नहीं है', 'नही है', 'बिल्कुल नहीं', 'कोई नहीं', 'कुछ नहीं',
  // Tamil
  'இல்லை', 'இல்ல', 'இல்லீங்க', 'இல்லைங்க', 'கிடையாது', 'வேண்டாம்', 'இல்லே', 'ஒன்றும் இல்லை', 'எதுவும் இல்லை',
  // Marathi
  'नाही', 'नाय', 'नको', 'काही नाही', 'अजिबात नाही', 'कधीच नाही',
  // Telugu
  'లేదు', 'లేవు', 'కాదు', 'వద్దు', 'లేదండి', 'ఏమీ లేదు', 'ఎప్పుడూ లేదు',
  // Kannada
  'ಇಲ್ಲ', 'ಇಲ್ಲಾ', 'ಬೇಡ', 'ಅಲ್ಲ', 'ಏನೂ ಇಲ್ಲ', 'ಯಾವತ್ತೂ ಇಲ್ಲ',
];
const YES_BASE = [
  'yes', 'yeah', 'yep', 'ya', 'yah', 'yup', 'i do', 'i have', 'it does', 'sometimes', 'definitely',
  'haan', 'haa', 'han', 'ji', 'ji haan', 'haanji', 'kabhi kabhi', 'aama', 'aamaa', 'aam', 'amam',
  'aamam', 'irukku', 'iruku', 'undu', 'avunu', 'undi', 'haudu', 'hoy',
  // Hindi
  'हाँ', 'हां', 'जी', 'जी हाँ', 'जी हां', 'हाँ जी', 'हां जी', 'है', 'बिल्कुल', 'कभी कभी',
  // Tamil
  'ஆமா', 'ஆமாம்', 'ஆம்', 'ஆமாங்க', 'உண்டு', 'இருக்கு', 'இருக்கிறது', 'சில நேரம்', 'சில சமயம்',
  // Marathi (unambiguous)
  'होय', 'आहे', 'आहेत', 'कधी कधी',
  // Telugu
  'అవును', 'ఔను', 'అవునండి', 'ఉంది', 'ఉన్నాయి', 'ఉన్నది', 'కొన్నిసార్లు',
  // Kannada
  'ಹೌದು', 'ಇದೆ', 'ಇವೆ', 'ಕೆಲವೊಮ್ಮೆ',
];
// Short Devanagari words that mean yes/no in one language only:
// Hindi "हा"/"ना" vs Marathi "हा" (this) and "ना" (tag particle).
const YES_ONLY = { mr: ['हो', 'ho', 'हो ना', 'होय ना'], hi: ['हा', 'ha', 'hai'], en: ['ha', 'hai'] };
const NO_ONLY = { hi: ['ना', 'न', 'na'], en: ['na'], ta: ['na'], te: ['na'], kn: ['na'] };

const yesNoLists = new Map();
// One list of [word, polarity], longest first, so "नहीं है" (no) beats "है" (yes)
// and Marathi "हो ना" (yes) beats "ना".
function listFor(lang) {
  if (!yesNoLists.has(lang)) {
    const all = [
      ...[...NO_BASE, ...(NO_ONLY[lang] || [])].map((w) => [w, false]),
      ...[...YES_BASE, ...(YES_ONLY[lang] || [])].map((w) => [w, true]),
    ];
    yesNoLists.set(lang, byLengthDesc(all, (x) => x[0]));
  }
  return yesNoLists.get(lang);
}

export function parseYesNo(text, lang = 'hi') {
  let rest = normalize(text);
  if (!rest) return null;
  let yes = 0;
  let no = 0;
  for (const [w, polarity] of listFor(lang)) {
    let r = consume(rest, w);
    while (r.hit) { if (polarity) yes++; else no++; rest = r.rest; r = consume(rest, w); }
  }
  if (no && !yes) return false;
  if (yes && !no) return true;
  return null; // empty or contradictory: ask again or tap
}

// ---------------------------------------------------------------- numbers
const EN_SMALL = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const EN_TENS = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

const indexMap = (list) => Object.fromEntries(list.map((w, i) => [w.normalize('NFC'), i]));

// Hindi number words are single words for 0-100.
const HI_WORDS = (() => {
  const m = indexMap([
    'शून्य', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ', 'दस',
    'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस', 'बीस',
    'इक्कीस', 'बाईस', 'तेईस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताईस', 'अट्ठाईस', 'उनतीस', 'तीस',
    'इकतीस', 'बत्तीस', 'तैंतीस', 'चौंतीस', 'पैंतीस', 'छत्तीस', 'सैंतीस', 'अड़तीस', 'उनतालीस', 'चालीस',
    'इकतालीस', 'बयालीस', 'तैंतालीस', 'चवालीस', 'पैंतालीस', 'छियालीस', 'सैंतालीस', 'अड़तालीस', 'उनचास', 'पचास',
    'इक्यावन', 'बावन', 'तिरपन', 'चौवन', 'पचपन', 'छप्पन', 'सत्तावन', 'अट्ठावन', 'उनसठ', 'साठ',
    'इकसठ', 'बासठ', 'तिरसठ', 'चौंसठ', 'पैंसठ', 'छियासठ', 'सड़सठ', 'अड़सठ', 'उनहत्तर', 'सत्तर',
    'इकहत्तर', 'बहत्तर', 'तिहत्तर', 'चौहत्तर', 'पचहत्तर', 'छिहत्तर', 'सतहत्तर', 'अठहत्तर', 'उन्यासी', 'अस्सी',
    'इक्यासी', 'बयासी', 'तिरासी', 'चौरासी', 'पचासी', 'छियासी', 'सत्तासी', 'अट्ठासी', 'नवासी', 'नब्बे',
    'इक्यानवे', 'बानवे', 'तिरानवे', 'चौरानवे', 'पचानवे', 'छियानवे', 'सत्तानवे', 'अट्ठानवे', 'निन्यानवे', 'सौ',
  ]);
  Object.assign(m, {
    'पांच': 5, 'छः': 6, 'छे': 6, 'छै': 6, 'पन्द्रह': 15, 'अठाईस': 28, 'चौवालीस': 44,
    'पैतालीस': 45, 'सैतालीस': 47, 'अठावन': 58,
  });
  return m;
})();
// romanised Hindi, used only when the session language is Hindi
const HI_ROMAN = {
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, che: 6, chhah: 6, saat: 7,
  aath: 8, nau: 9, das: 10, gyarah: 11, barah: 12, bees: 20, pachchis: 25, tees: 30, chalis: 40,
  pachas: 50, pachaas: 50, sattar: 70, assi: 80, nabbe: 90, sau: 100,
};
const HI_FRACTION = { 'आधा': 0.5, 'आधे': 0.5, aadha: 0.5, adha: 0.5, 'डेढ़': 1.5, 'डेढ': 1.5, dedh: 1.5, 'ढाई': 2.5, dhai: 2.5 };

// Marathi number words (Devanagari, but different words): active in Marathi sessions only,
// because some collide with Hindi words ("तेरा" is 13 in Marathi, "your" in Hindi).
const MR_WORDS = (() => {
  const m = indexMap([
    'शून्य', 'एक', 'दोन', 'तीन', 'चार', 'पाच', 'सहा', 'सात', 'आठ', 'नऊ', 'दहा',
    'अकरा', 'बारा', 'तेरा', 'चौदा', 'पंधरा', 'सोळा', 'सतरा', 'अठरा', 'एकोणीस', 'वीस',
    'एकवीस', 'बावीस', 'तेवीस', 'चोवीस', 'पंचवीस', 'सव्वीस', 'सत्तावीस', 'अठ्ठावीस', 'एकोणतीस', 'तीस',
    'एकतीस', 'बत्तीस', 'तेहेतीस', 'चौतीस', 'पस्तीस', 'छत्तीस', 'सदतीस', 'अडतीस', 'एकोणचाळीस', 'चाळीस',
    'एक्केचाळीस', 'बेचाळीस', 'त्रेचाळीस', 'चव्वेचाळीस', 'पंचेचाळीस', 'सेहेचाळीस', 'सत्तेचाळीस', 'अठ्ठेचाळीस', 'एकोणपन्नास', 'पन्नास',
    'एक्कावन्न', 'बावन्न', 'त्रेपन्न', 'चोपन्न', 'पंचावन्न', 'छप्पन्न', 'सत्तावन्न', 'अठ्ठावन्न', 'एकोणसाठ', 'साठ',
    'एकसष्ठ', 'बासष्ठ', 'त्रेसष्ठ', 'चौसष्ठ', 'पासष्ठ', 'सहासष्ठ', 'सदुसष्ठ', 'अडुसष्ठ', 'एकोणसत्तर', 'सत्तर',
    'एकाहत्तर', 'बाहत्तर', 'त्र्याहत्तर', 'चौऱ्याहत्तर', 'पंच्याहत्तर', 'शहात्तर', 'सत्याहत्तर', 'अठ्ठ्याहत्तर', 'एकोणऐंशी', 'ऐंशी',
    'एक्याऐंशी', 'ब्याऐंशी', 'त्र्याऐंशी', 'चौऱ्याऐंशी', 'पंच्याऐंशी', 'शहाऐंशी', 'सत्त्याऐंशी', 'अठ्ठ्याऐंशी', 'एकोणनव्वद', 'नव्वद',
    'एक्याण्णव', 'ब्याण्णव', 'त्र्याण्णव', 'चौऱ्याण्णव', 'पंच्याण्णव', 'शहाण्णव', 'सत्त्याण्णव', 'अठ्ठ्याण्णव', 'नव्व्याण्णव', 'शंभर',
  ]);
  Object.assign(m, { 'चोपन': 54, 'पंचावन': 55, 'बावन': 52, 'पंचाहत्तर': 75, 'दोनशे': 200 });
  return m;
})();
const MR_FRACTION = { 'अर्धा': 0.5, 'अर्धी': 0.5, 'अर्धे': 0.5, 'दीड': 1.5, 'अडीच': 2.5, 'पाऊण': 0.75 };

const SADHE = ['साढ़े', 'साढे', 'साडे', 'sadhe', 'saade']; // "साढ़े तीन" / "साडे तीन" = 3.5
const SAVA = ['सवा', 'सव्वा', 'sawa', 'sava']; // +0.25
const PAUNE = ['पौने', 'पावणे', 'paune']; // -0.25

const TA_UNITS = {
  'பூஜ்யம்': 0, 'ஒன்று': 1, 'ஒண்ணு': 1, 'ஒரு': 1, 'இரண்டு': 2, 'ரெண்டு': 2, 'மூன்று': 3, 'மூணு': 3,
  'நான்கு': 4, 'நாலு': 4, 'ஐந்து': 5, 'அஞ்சு': 5, 'ஆறு': 6, 'ஏழு': 7, 'எட்டு': 8, 'ஒன்பது': 9, 'ஒம்பது': 9,
};
const TA_COMPLETE = {
  'பத்து': 10, 'பதினொன்று': 11, 'பதினொண்ணு': 11, 'பன்னிரண்டு': 12, 'பன்னெண்டு': 12, 'பதிமூன்று': 13,
  'பதிமூணு': 13, 'பதினான்கு': 14, 'பதினாலு': 14, 'பதினைந்து': 15, 'பதினஞ்சு': 15, 'பதினாறு': 16,
  'பதினேழு': 17, 'பதினெட்டு': 18, 'பத்தொன்பது': 19, 'நூறு': 100,
  'இரண்டாயிரம்': 2000, 'ரெண்டாயிரம்': 2000, 'மூவாயிரம்': 3000, 'மூணாயிரம்': 3000, 'நாலாயிரம்': 4000,
  'ஐயாயிரம்': 5000, 'அஞ்சாயிரம்': 5000, 'பத்தாயிரம்': 10000,
};
const TA_TENS = {
  'இருபது': 20, 'முப்பது': 30, 'நாற்பது': 40, 'நாப்பது': 40, 'ஐம்பது': 50, 'அம்பது': 50, 'அறுபது': 60,
  'அறுவது': 60, 'எழுபது': 70, 'எழுவது': 70, 'எண்பது': 80, 'எம்பது': 80, 'தொண்ணூறு': 90,
};
// combining stems for 21..99, e.g. "ஐம்பத்தி நாலு" / "ஐம்பத்திநாலு" = 54
const TA_TEN_STEMS = byLengthDesc([
  ['இருபத்தி', 20], ['இருபத்து', 20], ['முப்பத்தி', 30], ['முப்பத்து', 30], ['நாற்பத்தி', 40], ['நாற்பத்து', 40],
  ['நாப்பத்தி', 40], ['ஐம்பத்தி', 50], ['ஐம்பத்து', 50], ['அம்பத்தி', 50], ['அறுபத்தி', 60], ['அறுபத்து', 60],
  ['அறுவத்தி', 60], ['எழுபத்தி', 70], ['எழுபத்து', 70], ['எழுவத்தி', 70], ['எண்பத்தி', 80], ['எண்பத்து', 80],
  ['எம்பத்தி', 80], ['தொண்ணூற்றி', 90], ['தொண்ணூற்று', 90],
], (pair) => pair[0]);
const TA_HALVES = {
  'அரை': 0.5, 'ஒன்றரை': 1.5, 'ஒண்ணரை': 1.5, 'இரண்டரை': 2.5, 'ரெண்டரை': 2.5, 'மூன்றரை': 3.5, 'மூணரை': 3.5,
  'நான்கரை': 4.5, 'நாலரை': 4.5, 'ஐந்தரை': 5.5, 'அஞ்சரை': 5.5, 'ஆறரை': 6.5, 'ஏழரை': 7.5, 'எட்டரை': 8.5,
  'ஒன்பதரை': 9.5, 'பத்தரை': 10.5,
};

// Telugu: tens and units are separate words ("యాభై నాలుగు" = 54)
const TE_UNITS = {
  'సున్నా': 0, 'ఒకటి': 1, 'ఒక': 1, 'రెండు': 2, 'మూడు': 3, 'నాలుగు': 4, 'ఐదు': 5, 'అయిదు': 5,
  'ఆరు': 6, 'ఏడు': 7, 'ఎనిమిది': 8, 'తొమ్మిది': 9,
};
const TE_COMPLETE = {
  'పది': 10, 'పదకొండు': 11, 'పన్నెండు': 12, 'పదమూడు': 13, 'పద్నాలుగు': 14, 'పదునాలుగు': 14, 'పదిహేను': 15,
  'పదహేను': 15, 'పదహారు': 16, 'పదిహేడు': 17, 'పద్దెనిమిది': 18, 'పంతొమ్మిది': 19, 'పందొమ్మిది': 19, 'వంద': 100, 'నూరు': 100,
};
const TE_TENS = {
  'ఇరవై': 20, 'ఇరవయి': 20, 'ముప్పై': 30, 'ముప్ఫై': 30, 'ముప్పయి': 30, 'నలభై': 40, 'నలబై': 40, 'యాభై': 50,
  'యాబై': 50, 'ఏభై': 50, 'అరవై': 60, 'అరవయి': 60, 'డెబ్బై': 70, 'డెబ్భై': 70, 'ఎనభై': 80, 'ఎనబై': 80,
  'తొంభై': 90, 'తొంబై': 90,
};
const TE_HALVES = {
  'అర': 0.5, 'అరగంట': 0.5, 'ఒకటిన్నర': 1.5, 'గంటన్నర': 1.5, 'రెండున్నర': 2.5, 'మూడున్నర': 3.5, 'నాలుగున్నర': 4.5,
  'ఐదున్నర': 5.5, 'ఆరున్నర': 6.5,
};

// Kannada: separate ("ಐವತ್ತು ನಾಲ್ಕು") or fused ("ಐವತ್ತನಾಲ್ಕು") tens + units
const KN_UNITS = {
  'ಸೊನ್ನೆ': 0, 'ಒಂದು': 1, 'ಒಂದ': 1, 'ಎರಡು': 2, 'ಮೂರು': 3, 'ನಾಲ್ಕು': 4, 'ಐದು': 5, 'ಆರು': 6, 'ಏಳು': 7, 'ಎಂಟು': 8, 'ಒಂಬತ್ತು': 9,
};
const KN_COMPLETE = {
  'ಹತ್ತು': 10, 'ಹನ್ನೊಂದು': 11, 'ಹನ್ನೆರಡು': 12, 'ಹದಿಮೂರು': 13, 'ಹದಿನಾಲ್ಕು': 14, 'ಹದಿನೈದು': 15, 'ಹದಿನಾರು': 16,
  'ಹದಿನೇಳು': 17, 'ಹದಿನೆಂಟು': 18, 'ಹತ್ತೊಂಬತ್ತು': 19, 'ನೂರು': 100,
};
const KN_TENS = {
  'ಇಪ್ಪತ್ತು': 20, 'ಮೂವತ್ತು': 30, 'ನಲವತ್ತು': 40, 'ನಲ್ವತ್ತು': 40, 'ಐವತ್ತು': 50, 'ಅರವತ್ತು': 60, 'ಎಪ್ಪತ್ತು': 70,
  'ಎಂಬತ್ತು': 80, 'ತೊಂಬತ್ತು': 90,
};
const KN_TEN_STEMS = byLengthDesc([
  ['ಇಪ್ಪತ್ತ', 20], ['ಮೂವತ್ತ', 30], ['ನಲವತ್ತ', 40], ['ನಲ್ವತ್ತ', 40], ['ಐವತ್ತ', 50], ['ಅರವತ್ತ', 60], ['ಎಪ್ಪತ್ತ', 70],
  ['ಎಂಬತ್ತ', 80], ['ತೊಂಬತ್ತ', 90],
], (pair) => pair[0]);
const KN_HALVES = {
  'ಅರ್ಧ': 0.5, 'ಒಂದೂವರೆ': 1.5, 'ಎರಡೂವರೆ': 2.5, 'ಮೂರೂವರೆ': 3.5, 'ನಾಲ್ಕೂವರೆ': 4.5, 'ಐದೂವರೆ': 5.5, 'ಆರೂವರೆ': 6.5,
};

// Sandhi in fused numbers: the unit's first vowel becomes a vowel sign on the
// tens stem ("ஐம்பத்த" + "ொன்று" = ஐம்பத்தொன்று 51; "ಐವತ್ತ" + "ೆರಡು" = ಐವತ್ತೆರಡು 52).
const TA_VOWEL = { 'ா': 'ஆ', 'ி': 'இ', 'ீ': 'ஈ', 'ு': 'உ', 'ூ': 'ஊ', 'ெ': 'எ', 'ே': 'ஏ', 'ை': 'ஐ', 'ொ': 'ஒ', 'ோ': 'ஓ' };
const KN_VOWEL = { 'ಾ': 'ಆ', 'ಿ': 'ಇ', 'ೀ': 'ಈ', 'ು': 'ಉ', 'ೂ': 'ಊ', 'ೆ': 'ಎ', 'ೇ': 'ಏ', 'ೈ': 'ಐ', 'ೊ': 'ಒ', 'ೋ': 'ಓ' };
function compoundUnit(tok, stem, units, vowels) {
  const tries = [stem];
  const last = stem.slice(-1);
  if (last in vowels) tries.push(stem.slice(0, -1)); // "ஐம்பத்தி" -> "ஐம்பத்த"
  for (const s of tries) {
    if (!tok.startsWith(s) || tok === s) continue;
    let rest = tok.slice(s.length);
    if (rest in units) return units[rest];
    const v = vowels[rest[0]];
    if (v) { rest = v + rest.slice(1); if (rest in units) return units[rest]; }
  }
  return null;
}

const THOUSAND_WORDS = new Set(['thousand', 'हज़ार', 'हजार', 'hazaar', 'hazar', 'ஆயிரம்', 'వెయ్యి', 'వేలు', 'వేల', 'ಸಾವಿರ']);
const RANGE_WORDS = new Set(['-', 'to', 'or', 'se', 'से', 'அல்லது', 'முதல்', 'किंवा', 'ते', 'లేదా', 'ಅಥವಾ']);

// Turn a token into a lexical number item.
function lexToken(tok, lang) {
  if (/^\d+(\.\d+)?$/.test(tok)) return { k: 'num', v: Number(tok) };
  if (RANGE_WORDS.has(tok)) return { k: 'range' };
  if (tok in EN_SMALL) return { k: EN_SMALL[tok] < 10 ? 'unit' : 'teen', v: EN_SMALL[tok] };
  if (tok in EN_TENS) return { k: 'tens', v: EN_TENS[tok] };
  if (tok === 'hundred') return { k: 'hundred' };
  if (THOUSAND_WORDS.has(tok)) return { k: 'thousand' };
  if (tok === 'half') return { k: 'half' };
  if (SADHE.includes(tok)) return { k: 'mod', v: 0.5 };
  if (SAVA.includes(tok)) return { k: 'mod', v: 0.25 };
  if (PAUNE.includes(tok)) return { k: 'mod', v: -0.25 };
  if (lang === 'mr') {
    if (tok in MR_WORDS) return { k: 'num', v: MR_WORDS[tok] };
    if (tok in MR_FRACTION) return { k: 'num', v: MR_FRACTION[tok] };
  }
  if (lang === 'hi' && tok in HI_ROMAN) return { k: 'num', v: HI_ROMAN[tok] };
  if (isIndic(tok)) {
    if (tok in HI_WORDS) return { k: 'num', v: HI_WORDS[tok] };
    if (tok in HI_FRACTION) return { k: 'num', v: HI_FRACTION[tok] };
    if (tok in TA_HALVES) return { k: 'num', v: TA_HALVES[tok] };
    if (tok in TA_UNITS) return { k: 'unit', v: TA_UNITS[tok] };
    if (tok in TA_COMPLETE) return { k: 'num', v: TA_COMPLETE[tok] };
    if (tok in TA_TENS) return { k: 'tens', v: TA_TENS[tok] };
    if (tok in TE_HALVES) return { k: 'num', v: TE_HALVES[tok] };
    if (tok in TE_UNITS) return { k: 'unit', v: TE_UNITS[tok] };
    if (tok in TE_COMPLETE) return { k: 'num', v: TE_COMPLETE[tok] };
    if (tok in TE_TENS) return { k: 'tens', v: TE_TENS[tok] };
    if (tok in KN_HALVES) return { k: 'num', v: KN_HALVES[tok] };
    if (tok in KN_UNITS) return { k: 'unit', v: KN_UNITS[tok] };
    if (tok in KN_COMPLETE) return { k: 'num', v: KN_COMPLETE[tok] };
    if (tok in KN_TENS) return { k: 'tens', v: KN_TENS[tok] };
    for (const [stems, units, vowels] of [[TA_TEN_STEMS, TA_UNITS, TA_VOWEL], [KN_TEN_STEMS, KN_UNITS, KN_VOWEL]]) {
      for (const [stem, v] of stems) {
        if (tok === stem) return { k: 'tens', v };
        const u = compoundUnit(tok, stem, units, vowels);
        if (u !== null) return { k: 'num', v: v + u };
      }
    }
  }
  return { k: 'word' };
}

// All numbers mentioned, in order. "two or three" -> [2, 3]; "fifty four" -> [54].
export function extractNumbers(text, lang = 'en') {
  const toks = normalize(text).split(' ').filter(Boolean);
  const out = [];
  let cur = null; // number being built
  let curKind = null; // 'tens' | 'unit' | 'num' | 'hundred'
  let mod = 0;
  let sawRange = false;
  const flush = () => {
    if (cur !== null) out.push(cur + mod);
    cur = null; curKind = null; mod = 0;
  };
  for (const tok of toks) {
    const t = lexToken(tok, lang);
    if (t.k === 'word') {
      if ((tok === 'and' || tok === 'a' || tok === 'an') && cur !== null) continue;
      flush();
      continue;
    }
    if (t.k === 'range') { flush(); sawRange = true; continue; }
    if (t.k === 'mod') { flush(); mod = t.v; continue; }
    if (t.k === 'half') {
      if (cur !== null) { cur += 0.5; flush(); } else { out.push(0.5); }
      continue;
    }
    if (t.k === 'hundred') { cur = (cur ?? 1) * 100; curKind = 'hundred'; continue; }
    if (t.k === 'thousand') { cur = (cur ?? 1) * 1000; curKind = 'hundred'; continue; }
    if (t.k === 'tens') {
      if (curKind === 'hundred') { cur += t.v; curKind = 'tens'; continue; }
      flush(); cur = t.v; curKind = 'tens'; continue;
    }
    if (t.k === 'unit') {
      if (curKind === 'tens' || curKind === 'hundred') { cur += t.v; curKind = 'unit'; continue; }
      flush(); cur = t.v; curKind = 'unit'; continue;
    }
    if (t.k === 'teen') {
      if (curKind === 'hundred') { cur += t.v; curKind = 'unit'; continue; }
      flush(); cur = t.v; curKind = 'unit'; continue;
    }
    // complete number (digits, Hindi/Marathi word, fused Tamil/Kannada)
    if (curKind === 'hundred' && t.v < 100) { cur += t.v; curKind = 'num'; continue; }
    if (mod && cur === null) { cur = t.v; curKind = 'num'; flush(); continue; }
    flush(); cur = t.v; curKind = 'num';
  }
  flush();
  out.sawRange = sawRange;
  return out;
}

// One number from an answer. Two adjacent close numbers are a range
// ("दो-तीन", "2 to 3", "ரெண்டு மூணு", "ಎರಡು ಮೂರು") and return the midpoint.
export function parseNumber(text, lang = 'en') {
  const nums = extractNumbers(text, lang);
  if (!nums.length) return null;
  if (nums.length >= 2) {
    const [a, b] = nums;
    if (b > a && (nums.sawRange || b - a <= 2)) return (a + b) / 2;
  }
  return nums[0];
}

// ---------------------------------------------------------------- hours per day
const ZERO_HOURS = ['none', 'no', 'nothing', 'zero', 'never', 'not at all', 'nahi', 'nahin', 'bilkul nahi', 'नहीं',
  'बिल्कुल नहीं', 'कुछ नहीं', 'illa', 'illai', 'இல்லை', 'இல்ல', 'கிடையாது', 'எதுவும் இல்லை',
  'नाही', 'अजिबात नाही', 'లేదు', 'అస్సలు లేదు', 'ಇಲ್ಲ', 'ಇಲ್ಲವೇ ಇಲ್ಲ'];
const FULL_DAY = ['full day', 'whole day', 'all day', 'entire day', 'सारा दिन', 'पूरा दिन', 'दिन भर', 'दिनभर', 'sara din',
  'pura din', 'நாள் முழுக்க', 'நாள் முழுவதும்', 'முழு நாள்', 'நாள் பூரா', 'दिवसभर', 'पूर्ण दिवस',
  'రోజంతా', 'రోజు మొత్తం', 'ದಿನವಿಡೀ', 'ಇಡೀ ದಿನ', 'ದಿನಪೂರ್ತಿ'];
const LITTLE = ['little', 'a little', 'very little', 'few minutes', 'थोड़ा', 'थोड़ी देर', 'कुछ मिनट', 'thoda',
  'கொஞ்சம்', 'கொஞ்ச நேரம்', 'konjam', 'थोडा', 'थोडं', 'थोडे', 'కొంచెం', 'కొద్దిగా', 'ಸ್ವಲ್ಪ', 'ಸ್ವಲ್ಪ ಹೊತ್ತು'];
const MINUTE_UNITS = ['minute', 'minutes', 'mins', 'min', 'मिनट', 'நிமிடம்', 'நிமிஷம்', 'நிமிடங்கள்', 'मिनिटे', 'मिनिट',
  'నిమిషాలు', 'నిమిషం', 'ನಿಮಿಷ'];
const HOUR_RE = /hour|घंट|மணி|तास|గంట|ಗಂಟೆ/;

export function parseHours(text, lang = 'en') {
  const n = normalize(text);
  if (!n) return null;
  const num = parseNumber(n, lang);
  if (num === null) {
    if (containsAny(n, FULL_DAY)) return 8;
    if (containsAny(n, LITTLE)) return 0.5;
    if (containsAny(n, ZERO_HOURS)) return 0;
    if (/\b(an?|one) hour\b/.test(n)) return 1;
    return null;
  }
  const isMinutes = containsAny(n, MINUTE_UNITS) && !HOUR_RE.test(n);
  const h = isMinutes ? num / 60 : num;
  return Math.max(0, Math.min(16, Math.round(h * 4) / 4));
}

// ---------------------------------------------------------------- options
// options: [{ v, kw: [...keywords in any language], range?: [min, max) }]
// Longest keyword wins, and a matched span cannot match again, so "no line"
// (progressive) beats "line" (bifocal).
export function parseOptions(text, options, { multi = false, lang = 'en' } = {}) {
  let rest = normalize(text);
  if (!rest) return multi ? [] : null;
  const all = [];
  for (const o of options) for (const k of o.kw || []) all.push([k, o.v]);
  all.sort((a, b) => normalize(b[0]).length - normalize(a[0]).length);
  const hits = [];
  for (const [k, v] of all) {
    const r = consume(rest, k);
    if (r.hit) { rest = r.rest; if (!hits.includes(v)) hits.push(v); }
  }
  if (!hits.length) {
    const ranged = options.filter((o) => o.range);
    const num = ranged.length ? parseNumber(text, lang) : null;
    if (num !== null) {
      const o = ranged.find((x) => num >= x.range[0] && num < x.range[1]);
      if (o) hits.push(o.v);
    }
  }
  if (multi) return hits;
  return hits.length ? hits[0] : null;
}

// ---------------------------------------------------------------- directions (tumbling E)
const DIRS = {
  up: ['up', 'top', 'upar', 'upper', 'ऊपर', 'उपर', 'மேல', 'மேலே', 'மேல்', 'mela', 'mele', 'वर', 'वरती', 'పైకి', 'పైన', 'ಮೇಲೆ'],
  down: ['down', 'bottom', 'neeche', 'niche', 'नीचे', 'கீழ', 'கீழே', 'கீழ்', 'keezha', 'kizhe', 'खाली', 'కిందికి', 'కింద', 'ಕೆಳಗೆ'],
  left: ['left', 'baayen', 'bayen', 'baaye', 'बाएँ', 'बाएं', 'बायें', 'बायां', 'இடது', 'இடப்பக்கம்', 'idathu',
    'डावीकडे', 'डावा', 'डावी', 'ఎడమ', 'ఎడమవైపు', 'ಎಡ', 'ಎಡಕ್ಕೆ'],
  right: ['right', 'daayen', 'dayen', 'daaye', 'दाएँ', 'दाएं', 'दायें', 'दायां', 'வலது', 'வலப்பக்கம்', 'valathu',
    'उजवीकडे', 'उजवा', 'उजवी', 'కుడి', 'కుడివైపు', 'ಬಲ', 'ಬಲಕ್ಕೆ'],
};
export function parseDirection(text) {
  const found = parseOptions(text, Object.entries(DIRS).map(([v, kw]) => ({ v, kw })), { multi: true });
  return found.length === 1 ? found[0] : null;
}
