// UI strings and patient-facing text. English, Hindi and Tamil live here;
// Telugu, Marathi and Kannada come from one pack file each (js/lang/).
// All Indian-language text is a team draft: native-speaker review at the
// pilot sites is on the plan.
import { PACKS } from './lang/index.js';

export const LANGS = { en: 'English', hi: 'हिन्दी', ta: 'தமிழ்' };
export const LOCALE = { en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN' };
for (const p of PACKS) { LANGS[p.code] = p.name; LOCALE[p.code] = p.locale; }

const S = {
  appTagline: { en: 'Voice-first eye check, reviewed by an optometrist', hi: 'आवाज़ से आँखों की जाँच, ऑप्टोमेट्रिस्ट की निगरानी में', ta: 'குரல் வழி கண் பரிசோதனை, ஆப்டோமெட்ரிஸ்ட் மேற்பார்வையில்' },
  newScreening: { en: 'New patient', hi: 'नया मरीज़', ta: 'புதிய நோயாளி' },
  language: { en: 'Patient’s language', hi: 'मरीज़ की भाषा', ta: 'நோயாளியின் மொழி' },
  demo: { en: 'Demo patients (synthetic)', hi: 'डेमो मरीज़ (काल्पनिक)', ta: 'டெமோ நோயாளிகள் (கற்பனை)' },
  calibrate: { en: 'Calibrate this phone', hi: 'इस फ़ोन को कैलिब्रेट करें', ta: 'இந்த போனை அளவுத்திருத்தம் செய்' },
  results: { en: 'Optometrist replies', hi: 'ऑप्टोमेट्रिस्ट के जवाब', ta: 'ஆப்டோமெட்ரிஸ்ட் பதில்கள்' },
  site: { en: 'Store / camp name', hi: 'दुकान / कैंप का नाम', ta: 'கடை / முகாம் பெயர்' },
  operator: { en: 'Your name', hi: 'आपका नाम', ta: 'உங்கள் பெயர்' },
  patientName: { en: 'Patient name', hi: 'मरीज़ का नाम', ta: 'நோயாளியின் பெயர்' },
  phone: { en: 'Phone (for the reply)', hi: 'फ़ोन (जवाब के लिए)', ta: 'போன் (பதிலுக்கு)' },
  village: { en: 'Village / area, PIN', hi: 'गाँव / इलाका, पिन', ta: 'ஊர் / பகுதி, பின்' },
  consentTitle: { en: 'Consent', hi: 'सहमति', ta: 'ஒப்புதல்' },
  consentText: {
    en: 'We will record your answers and simple eye checks on this phone to understand your vision needs. When voice is used, short audio recordings are sent to Sarvam AI to transcribe your answers. With your permission, your answers and eye checks will be shared with a qualified optometrist who will review them and reply. You can ask us to delete your records at any time. Do you agree?',
    hi: 'आपकी ज़रूरत समझने के लिए हम आपके जवाब और आँखों की आसान जाँच इस फ़ोन पर दर्ज करेंगे। आवाज़ का उपयोग होने पर, आपके जवाब लिखने के लिए छोटी ऑडियो रिकॉर्डिंग Sarvam AI को भेजी जाती है। आपकी अनुमति से आपके जवाब और जाँच एक योग्य ऑप्टोमेट्रिस्ट को भेजे जाएँगे, जो देखकर जवाब देंगे। आप कभी भी अपने रिकॉर्ड मिटाने को कह सकते हैं। क्या आप सहमत हैं?',
    ta: 'உங்கள் பார்வைத் தேவையைப் புரிந்துகொள்ள உங்கள் பதில்களையும் எளிய கண் பரிசோதனைகளையும் இந்த போனில் பதிவு செய்வோம். குரலைப் பயன்படுத்தும்போது, உங்கள் பதில்களை எழுத்தாக்க சிறிய ஒலிப்பதிவுகள் Sarvam AI-க்கு அனுப்பப்படும். உங்கள் அனுமதியுடன், உங்கள் பதில்களும் பரிசோதனைகளும் தகுதியான ஆப்டோமெட்ரிஸ்டுடன் பகிரப்படும்; அவர் பார்த்து பதிலளிப்பார். உங்கள் பதிவுகளை எப்போது வேண்டுமானாலும் நீக்கச் சொல்லலாம். நீங்கள் சம்மதிக்கிறீர்களா?',
  },
  play: { en: 'Read aloud', hi: 'पढ़कर सुनाएँ', ta: 'சத்தமாகப் படி' },
  agree: { en: 'Patient agrees', hi: 'मरीज़ सहमत है', ta: 'நோயாளி சம்மதிக்கிறார்' },
  disagree: { en: 'Does not agree', hi: 'सहमत नहीं', ta: 'சம்மதிக்கவில்லை' },
  start: { en: 'Start interview', hi: 'बातचीत शुरू करें', ta: 'உரையாடலைத் தொடங்கு' },
  speaking: { en: 'Speaking', hi: 'बोल रहा है', ta: 'பேசுகிறது' },
  listening: { en: 'Listening', hi: 'सुन रहा है', ta: 'கேட்கிறது' },
  heard: { en: 'Heard', hi: 'सुना', ta: 'கேட்டது' },
  notUnderstood: { en: 'Sorry, I did not catch that. Please say it again, or tap an answer.', hi: 'माफ़ कीजिए, समझ नहीं आया। फिर से बोलिए, या जवाब पर टैप कीजिए।', ta: 'மன்னிக்கவும், புரியவில்லை. மீண்டும் சொல்லுங்கள், அல்லது பதிலைத் தட்டுங்கள்.' },
  yes: { en: 'Yes', hi: 'हाँ', ta: 'ஆம்' },
  no: { en: 'No', hi: 'नहीं', ta: 'இல்லை' },
  next: { en: 'Next', hi: 'आगे', ta: 'அடுத்து' },
  back: { en: 'Back', hi: 'पीछे', ta: 'பின்' },
  skip: { en: 'Skip', hi: 'छोड़ें', ta: 'தவிர்' },
  change: { en: 'Change', hi: 'बदलें', ta: 'மாற்று' },
  speakAgain: { en: 'Ask again', hi: 'फिर पूछें', ta: 'மீண்டும் கேள்' },
  voiceOn: { en: 'Voice on', hi: 'आवाज़ चालू', ta: 'குரல் இயக்கம்' },
  voiceOff: { en: 'Voice off', hi: 'आवाज़ बंद', ta: 'குரல் நிறுத்தம்' },
  aboutMore: { en: 'about {n} more', hi: 'लगभग {n} और', ta: 'இன்னும் சுமார் {n}' },
  why: { en: 'Why we ask', hi: 'क्यों पूछते हैं', ta: 'ஏன் கேட்கிறோம்' },
  urgentBanner: { en: 'Red flag: this patient needs a doctor today. Only the essential questions remain.', hi: 'खतरे का संकेत: इस मरीज़ को आज ही डॉक्टर की ज़रूरत है। सिर्फ़ ज़रूरी सवाल बचे हैं।', ta: 'அபாய அறிகுறி: இவருக்கு இன்றே மருத்துவர் தேவை. அவசியமான கேள்விகள் மட்டும் மீதம்.' },
  checksTitle: { en: 'Quick checks chosen for this patient', hi: 'इस मरीज़ के लिए चुनी गई जाँचें', ta: 'இவருக்காகத் தேர்ந்த விரைவுப் பரிசோதனைகள்' },
  checksHint: { en: 'Each takes under a minute. Skip any that are not possible here.', hi: 'हर जाँच एक मिनट से कम। जो यहाँ संभव न हो, छोड़ दें।', ta: 'ஒவ்வொன்றும் ஒரு நிமிடத்திற்குள். இங்கே முடியாதவற்றைத் தவிர்க்கலாம்.' },
  chk_reading_distance: { en: 'Reading distance (camera)', hi: 'पढ़ने की दूरी (कैमरा)', ta: 'படிக்கும் தூரம் (கேமரா)' },
  chk_near_point: { en: 'Focusing range (camera)', hi: 'पास का फ़ोकस (कैमरा)', ta: 'அருகில் கவனக்குவிப்பு (கேமரா)' },
  chk_acuity: { en: 'Distance vision (2 m)', hi: 'दूर की नज़र (2 मीटर)', ta: 'தூரப் பார்வை (2 மீ)' },
  chk_amsler: { en: 'Central vision grid', hi: 'बीच की नज़र (ग्रिड)', ta: 'மையப் பார்வை (கட்டம்)' },
  chk_pd: { en: 'Pupil distance & fitting (camera)', hi: 'पुतलियों की दूरी और फ़िटिंग (कैमरा)', ta: 'கண்மணி இடைவெளி & பொருத்தம் (கேமரா)' },
  run: { en: 'Start', hi: 'शुरू', ta: 'தொடங்கு' },
  done: { en: 'Done', hi: 'हो गया', ta: 'முடிந்தது' },
  finishChecks: { en: 'See the vision profile', hi: 'विज़न प्रोफ़ाइल देखें', ta: 'பார்வை சுயவிவரத்தைப் பார்' },
  holdLikeReading: { en: 'Hold the phone the way you normally read a message. Keep still.', hi: 'फ़ोन वैसे पकड़िए जैसे आप आम तौर पर मैसेज पढ़ते हैं। स्थिर रहिए।', ta: 'வழக்கமாக மெசேஜ் படிப்பது போல போனைப் பிடியுங்கள். அசையாமல் இருங்கள்.' },
  bringCloser: { en: 'Without reading glasses, look at the small words. Slowly bring the phone closer until the words blur and stay blurred.', hi: 'पढ़ने का चश्मा उतारकर छोटे शब्दों को देखिए। फ़ोन को धीरे-धीरे पास लाइए, जब तक शब्द धुंधले न हो जाएँ।', ta: 'படிக்கும் கண்ணாடி இல்லாமல் சிறிய எழுத்துகளைப் பாருங்கள். எழுத்துகள் மங்கும் வரை போனை மெதுவாக அருகில் கொண்டு வாருங்கள்.' },
  blurredNow: { en: 'Blurred now', hi: 'अब धुंधला', ta: 'இப்போது மங்கல்' },
  useThis: { en: 'Use this', hi: 'यही लें', ta: 'இதைப் பயன்படுத்து' },
  enterManually: { en: 'Enter by hand', hi: 'हाथ से भरें', ta: 'கையால் உள்ளிடு' },
  noFace: { en: 'Looking for the face…', hi: 'चेहरा ढूँढ रहे हैं…', ta: 'முகத்தைத் தேடுகிறது…' },
  cameraFail: { en: 'Camera or face model unavailable here. Enter the value by hand or skip.', hi: 'कैमरा या मॉडल उपलब्ध नहीं। हाथ से भरें या छोड़ें।', ta: 'கேமரா அல்லது மாடல் கிடைக்கவில்லை. கையால் உள்ளிடுங்கள் அல்லது தவிர்க்கவும்.' },
  acuitySetup: { en: 'Stand 2 metres away (use the 2 m cord). Cover the {eye} eye. Point the way the fingers of the E point.', hi: '2 मीटर दूर खड़े हों (2 मीटर की डोरी से नापें)। {eye} आँख ढकें। E की उंगलियाँ जिस तरफ़ हैं, उधर इशारा करें।', ta: '2 மீட்டர் தூரத்தில் நில்லுங்கள் (2 மீ கயிறு). {eye} கண்ணை மூடுங்கள். E-யின் விரல்கள் எந்தப் பக்கம் என்று காட்டுங்கள்.' },
  leftEye: { en: 'LEFT', hi: 'बाईं', ta: 'இடது' },
  rightEye: { en: 'RIGHT', hi: 'दाईं', ta: 'வலது' },
  pinholePrompt: { en: 'Vision is reduced. Make a pinhole in paper with a pin and test again through it.', hi: 'नज़र कम है। कागज़ में पिन से छेद करें और उसमें से फिर जाँचें।', ta: 'பார்வை குறைவு. காகிதத்தில் ஊசியால் துளை போட்டு, அதன் வழியாக மீண்டும் பரிசோதியுங்கள்.' },
  pinholeTest: { en: 'Test with pinhole', hi: 'पिनहोल से जाँचें', ta: 'துளை வழியாக பரிசோதி' },
  amslerAsk: { en: 'Cover the {eye} eye, hold the grid at reading distance and look at the centre dot. Are any lines wavy, broken or missing?', hi: '{eye} आँख ढकें, ग्रिड को पढ़ने की दूरी पर रखें और बीच के बिंदु को देखें। क्या कोई लाइन टेढ़ी, टूटी या गायब दिखती है?', ta: '{eye} கண்ணை மூடி, கட்டத்தை படிக்கும் தூரத்தில் வைத்து நடுப் புள்ளியைப் பாருங்கள். ஏதேனும் கோடு வளைந்தோ, உடைந்தோ, காணாமலோ தெரிகிறதா?' },
  pdAsk: { en: 'Look straight at the camera dot, with the chosen frame on if possible. Tap Capture.', hi: 'कैमरे के बिंदु को सीधे देखें, हो सके तो चुना हुआ फ़्रेम पहनकर। Capture दबाएँ।', ta: 'கேமரா புள்ளியை நேராகப் பாருங்கள், முடிந்தால் தேர்ந்த ஃபிரேம் அணிந்து. Capture அழுத்துங்கள்.' },
  capture: { en: 'Capture', hi: 'कैप्चर', ta: 'பிடி' },
  sendToOptom: { en: 'Send to optometrist', hi: 'ऑप्टोमेट्रिस्ट को भेजें', ta: 'ஆப்டோமெட்ரிஸ்டுக்கு அனுப்பு' },
  queued: { en: 'Saved on phone, will send when online', hi: 'फ़ोन में सेव, नेटवर्क मिलने पर भेजा जाएगा', ta: 'போனில் சேமிக்கப்பட்டது, இணையம் வந்ததும் அனுப்பப்படும்' },
  sent: { en: 'Sent to the optometrist', hi: 'ऑप्टोमेट्रिस्ट को भेजा गया', ta: 'ஆப்டோமெட்ரிஸ்டுக்கு அனுப்பப்பட்டது' },
  passport: { en: 'Vision Passport for the patient', hi: 'मरीज़ के लिए विज़न पासपोर्ट', ta: 'நோயாளிக்கான பார்வை பாஸ்போர்ட்' },
  shareWa: { en: 'Share on WhatsApp', hi: 'WhatsApp पर भेजें', ta: 'WhatsApp-இல் பகிர்' },
  shareSms: { en: 'Send SMS', hi: 'SMS भेजें', ta: 'SMS அனுப்பு' },
  newPatient: { en: 'Next patient', hi: 'अगला मरीज़', ta: 'அடுத்த நோயாளி' },
  noVoice: { en: 'This phone has no voice for this language: please read the question aloud.', hi: 'इस फ़ोन में इस भाषा की आवाज़ नहीं है: कृपया सवाल पढ़कर सुनाएँ।', ta: 'இந்த போனில் இந்த மொழிக்கான குரல் இல்லை: கேள்வியைப் படித்துச் சொல்லுங்கள்.' },
  noMic: { en: 'Voice input is not available in this browser: tap the answers.', hi: 'इस ब्राउज़र में आवाज़ इनपुट नहीं है: जवाब टैप करें।', ta: 'இந்த உலாவியில் குரல் உள்ளீடு இல்லை: பதில்களைத் தட்டுங்கள்.' },
  pinSetTitle: { en: 'Protect patient data on this phone', hi: 'इस फ़ोन पर मरीज़ों का डेटा सुरक्षित करें', ta: 'இந்த போனில் உள்ள நோயாளி தகவல்களைப் பாதுகாக்கவும்' },
  pinSetHint: { en: 'Choose a 6-digit PIN. Records on this phone are encrypted with it (AES-256).', hi: '6 अंकों का पिन चुनें। इस फ़ोन के रिकॉर्ड इसी से एन्क्रिप्ट होते हैं।', ta: '6 இலக்க பின் தேர்ந்தெடுங்கள். இந்த போனின் பதிவுகள் அதைக் கொண்டு குறியாக்கம் செய்யப்படும்.' },
  pinEnterTitle: { en: 'Enter your PIN', hi: 'अपना पिन डालें', ta: 'உங்கள் பின்னை உள்ளிடவும்' },
  pinConfirm: { en: 'Enter the PIN again', hi: 'पिन दोबारा डालें', ta: 'பின்னை மீண்டும் உள்ளிடவும்' },
  pinMismatch: { en: 'The PINs did not match. Try again.', hi: 'पिन मेल नहीं खाए। फिर से कोशिश करें।', ta: 'பின் பொருந்தவில்லை. மீண்டும் முயற்சிக்கவும்.' },
  pinWrong: { en: 'Wrong PIN.', hi: 'गलत पिन।', ta: 'தவறான பின்.' },
  lock: { en: 'Lock', hi: 'लॉक', ta: 'பூட்டு' },
  resume: { en: 'Continue unfinished patient', hi: 'अधूरा मरीज़ जारी रखें', ta: 'முடிக்காத நோயாளியைத் தொடரவும்' },
  confirmLow: { en: 'Not sure I heard that right. Please confirm by tapping.', hi: 'ठीक से सुना या नहीं, पक्का नहीं। कृपया टैप करके पुष्टि करें।', ta: 'சரியாகக் கேட்டதா என்று உறுதியில்லை. தட்டி உறுதிப்படுத்தவும்.' },
  holdStraight: { en: 'Hold the phone straight, level with the eyes.', hi: 'फ़ोन को आँखों की सीध में सीधा पकड़ें।', ta: 'போனை கண் மட்டத்தில் நேராகப் பிடியுங்கள்.' },
  forgotPin: { en: 'Forgot the PIN? Reset (deletes unsent data on this phone)', hi: 'पिन भूल गए? रीसेट (इस फ़ोन पर न भेजा गया डेटा मिट जाएगा)', ta: 'பின் மறந்துவிட்டதா? மீட்டமை (இந்த போனில் அனுப்பாத தரவு அழிக்கப்படும்)' },
};

export function tr(key, lang = 'en', vars = {}) {
  const e = S[key];
  let s = e ? e[lang] || e.en : key;
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}

// ---------------------------------------------------------------- patient-facing
export const P = {
  title: { en: 'DivyaDrishti Vision Passport', hi: 'दिव्यदृष्टि विज़न पासपोर्ट', ta: 'திவ்யதிருஷ்டி பார்வை பாஸ்போர்ட்' },
  usedFor: { en: 'Your eyes are mostly used for', hi: 'आपकी आँखें ज़्यादातर इसके लिए इस्तेमाल होती हैं', ta: 'உங்கள் கண்கள் பெரும்பாலும் பயன்படுவது' },
  suggested: { en: 'Suggested', hi: 'सुझाव', ta: 'பரிந்துரை' },
  needed: { en: 'Also needed', hi: 'यह भी ज़रूरी', ta: 'இதுவும் தேவை' },
  tips: { en: 'Tips', hi: 'सलाह', ta: 'ஆலோசனைகள்' },
  showThis: { en: 'Show this message at any optical store or eye camp.', hi: 'यह संदेश किसी भी चश्मे की दुकान या आँखों के कैंप में दिखाएँ।', ta: 'இந்தச் செய்தியை எந்த கண்ணாடிக் கடை அல்லது கண் முகாமிலும் காட்டுங்கள்.' },
  lane: {
    red: { en: 'Please go to an eye hospital today. Do not wait for new glasses.', hi: 'कृपया आज ही आँखों के अस्पताल जाएँ। नए चश्मे का इंतज़ार न करें।', ta: 'தயவுசெய்து இன்றே கண் மருத்துவமனைக்குச் செல்லுங்கள். புதிய கண்ணாடிக்காகக் காத்திருக்க வேண்டாம்.' },
    amber: { en: 'An optometrist will review your results within a day and tell you where and when to get a full eye check.', hi: 'एक ऑप्टोमेट्रिस्ट एक दिन में आपके नतीजे देखकर बताएँगे कि पूरी जाँच कहाँ और कब करवानी है।', ta: 'ஒரு ஆப்டோமெட்ரிஸ்ட் ஒரு நாளுக்குள் உங்கள் முடிவுகளைப் பார்த்து, முழு கண் பரிசோதனை எங்கே, எப்போது என்று சொல்வார்.' },
    green: { en: 'An optometrist will check these results and confirm your glasses.', hi: 'एक ऑप्टोमेट्रिस्ट इन नतीजों की जाँच करके आपका चश्मा पक्का करेंगे।', ta: 'ஒரு ஆப்டோமெட்ரிஸ்ட் இந்த முடிவுகளைச் சரிபார்த்து உங்கள் கண்ணாடியை உறுதி செய்வார்.' },
  },
  zone: {
    near: { en: 'close work (reading, phone, sewing)', hi: 'पास का काम (पढ़ना, मोबाइल, सिलाई)', ta: 'அருகிலான வேலை (படித்தல், போன், தையல்)' },
    intermediate: { en: 'arm’s-length work (computer, counter, cooking)', hi: 'हाथ भर की दूरी का काम (कंप्यूटर, काउंटर, खाना बनाना)', ta: 'கை நீளத் தூர வேலை (கணினி, கவுண்டர், சமையல்)' },
    distance: { en: 'distance (outdoors, driving, faces)', hi: 'दूर देखना (बाहर, गाड़ी चलाना, चेहरे)', ta: 'தூரப் பார்வை (வெளியே, வாகனம் ஓட்டுதல், முகங்கள்)' },
    balanced: { en: 'a mix of near, arm’s-length and distance', hi: 'पास, हाथ भर और दूर, तीनों का मिश्रण', ta: 'அருகில், கை நீளம், தூரம் மூன்றும் கலந்து' },
  },
  lens: {
    urgent_referral: { en: 'No glasses today: see a doctor first', hi: 'आज चश्मा नहीं: पहले डॉक्टर को दिखाएँ', ta: 'இன்று கண்ணாடி வேண்டாம்: முதலில் மருத்துவரைப் பாருங்கள்' },
    child_refraction: { en: 'A full eye test with drops by an optometrist, then glasses', hi: 'ऑप्टोमेट्रिस्ट से दवा डालकर पूरी जाँच, फिर चश्मा', ta: 'ஆப்டோமெட்ரிஸ்ட் சொட்டு மருந்து போட்டு முழுப் பரிசோதனை, பிறகு கண்ணாடி' },
    sv_distance: { en: 'Single-vision glasses for distance', hi: 'दूर के लिए सिंगल-विज़न चश्मा', ta: 'தூரப் பார்வைக்கு சிங்கிள் விஷன் கண்ணாடி' },
    no_change: { en: 'No new glasses needed now', hi: 'अभी नए चश्मे की ज़रूरत नहीं', ta: 'இப்போது புதிய கண்ணாடி தேவையில்லை' },
    separate_pairs: { en: 'Two pairs: one for walking and distance, one for reading', hi: 'दो चश्मे: एक चलने और दूर के लिए, एक पढ़ने के लिए', ta: 'இரண்டு கண்ணாடிகள்: ஒன்று நடக்கவும் தூரத்திற்கும், ஒன்று படிக்க' },
    readers: { en: 'Reading glasses', hi: 'पढ़ने का चश्मा', ta: 'படிக்கும் கண்ணாடி' },
    office: { en: 'Work glasses for close and arm’s-length work', hi: 'पास और हाथ भर की दूरी के काम का चश्मा', ta: 'அருகிலான மற்றும் கை நீள வேலைக்கான கண்ணாடி' },
    bifocal: { en: 'Bifocal glasses (distance + reading)', hi: 'बाइफ़ोकल चश्मा (दूर + पढ़ना)', ta: 'பைஃபோகல் கண்ணாடி (தூரம் + படித்தல்)' },
    progressive: { en: 'Progressive glasses (all distances, no line)', hi: 'प्रोग्रेसिव चश्मा (सभी दूरियाँ, बिना लाइन)', ta: 'புரோகிரசிவ் கண்ணாடி (எல்லா தூரமும், கோடு இல்லாமல்)' },
  },
  flag: {
    SUDDEN_VISION_CHANGE: { en: 'a doctor for the sudden change in your sight', hi: 'नज़र में अचानक बदलाव के लिए डॉक्टर', ta: 'பார்வையில் திடீர் மாற்றத்திற்கு மருத்துவர்' },
    PAINFUL_RED_EYE: { en: 'a doctor for the painful red eye', hi: 'दर्द वाली लाल आँख के लिए डॉक्टर', ta: 'வலியுள்ள சிவந்த கண்ணுக்கு மருத்துவர்' },
    LEUKOCORIA: { en: 'a children’s eye doctor for the white glow in the eye', hi: 'आँख की सफ़ेद चमक के लिए बच्चों के आँखों के डॉक्टर', ta: 'கண்ணின் வெள்ளைப் பளபளப்புக்கு குழந்தைகள் கண் மருத்துவர்' },
    DIABETES_RETINA_DUE: { en: 'a diabetes eye check (retina)', hi: 'शुगर के लिए आँख के पर्दे की जाँच', ta: 'சர்க்கரை நோய்க்கான விழித்திரைப் பரிசோதனை' },
    CATARACT_SUSPECT: { en: 'a check for cataract', hi: 'मोतियाबिंद की जाँच', ta: 'கண்புரைப் பரிசோதனை' },
    GLAUCOMA_FAMILY: { en: 'an eye-pressure (glaucoma) check', hi: 'आँख के प्रेशर (काला मोतिया) की जाँच', ta: 'கண் அழுத்த (கிளாக்கோமா) பரிசோதனை' },
    CHILD_REFRACTION: { en: 'a full eye test for the child', hi: 'बच्चे की पूरी आँखों की जाँच', ta: 'குழந்தைக்கு முழு கண் பரிசோதனை' },
    CHILD_SQUINT: { en: 'a squint check for the child', hi: 'बच्चे की भेंगेपन की जाँच', ta: 'குழந்தைக்கு மாறுகண் பரிசோதனை' },
    AMSLER_DISTORTION: { en: 'a check of the centre of the retina', hi: 'आँख के पर्दे के बीच वाले हिस्से की जाँच', ta: 'விழித்திரையின் மையப் பகுதி பரிசோதனை' },
    default: { en: 'a full eye examination', hi: 'आँखों की पूरी जाँच', ta: 'முழு கண் பரிசோதனை' },
  },
  advice: {
    rule_20_20_20: { en: 'Every 20 minutes of close or screen work, look 6 metres away for 20 seconds.', hi: 'हर 20 मिनट पास के काम या स्क्रीन के बाद, 20 सेकंड तक 6 मीटर दूर देखें।', ta: 'ஒவ்வொரு 20 நிமிட அருகிலான வேலை அல்லது திரைக்குப் பிறகு, 20 வினாடிகள் 6 மீட்டர் தூரத்தைப் பாருங்கள்.' },
    outdoor_2h: { en: 'Children should play outdoors in daylight at least 2 hours a day; it helps prevent short sight.', hi: 'बच्चे रोज़ कम से कम 2 घंटे बाहर दिन की रोशनी में खेलें; इससे दूर की नज़र कमज़ोर होने से बचाव होता है।', ta: 'குழந்தைகள் தினமும் குறைந்தது 2 மணி நேரம் வெளியே பகல் வெளிச்சத்தில் விளையாட வேண்டும்; இது கிட்டப்பார்வையைத் தடுக்க உதவும்.' },
    diabetes_yearly: { en: 'With diabetes, have the back of the eye checked with drops once a year, even if you see well.', hi: 'शुगर हो तो हर साल एक बार आँखों में दवा डालकर पर्दे की जाँच करवाएँ, चाहे साफ़ दिखता हो।', ta: 'சர்க்கரை நோய் இருந்தால், நன்றாகத் தெரிந்தாலும் வருடத்திற்கு ஒருமுறை விழித்திரையைப் பரிசோதியுங்கள்.' },
    uv_sunglasses: { en: 'In strong sun, wear UV-protective sunglasses or a wide hat.', hi: 'तेज़ धूप में UV से बचाने वाला धूप का चश्मा या चौड़ी टोपी पहनें।', ta: 'கடும் வெயிலில் UV பாதுகாப்பு உள்ள கருப்புக் கண்ணாடி அல்லது அகன்ற தொப்பி அணியுங்கள்.' },
    good_light: { en: 'Use bright light for close work such as reading and sewing.', hi: 'पढ़ने और सिलाई जैसे पास के काम के लिए तेज़ रोशनी रखें।', ta: 'படித்தல், தையல் போன்ற அருகிலான வேலைக்கு நல்ல வெளிச்சம் வைத்துக்கொள்ளுங்கள்.' },
    safety_eyewear: { en: 'Wear protective glasses for work that can throw dust or chips into the eye.', hi: 'जिस काम में धूल या टुकड़े आँख में जा सकते हैं, उसमें सुरक्षा चश्मा पहनें।', ta: 'தூசி அல்லது துகள்கள் கண்ணில் படக்கூடிய வேலையில் பாதுகாப்புக் கண்ணாடி அணியுங்கள்.' },
    family_check: { en: 'Ask your brothers, sisters and children over 40 to get an eye-pressure check too.', hi: 'अपने 40 साल से ऊपर के भाई-बहनों और बच्चों से भी आँखों के प्रेशर की जाँच करवाने को कहें।', ta: '40 வயதுக்கு மேற்பட்ட உங்கள் சகோதர சகோதரிகளும் பிள்ளைகளும் கண் அழுத்தப் பரிசோதனை செய்யச் சொல்லுங்கள்.' },
  },
};

export const pt = (entry, lang) => (entry ? entry[lang] || entry.en : '');

// ---------------------------------------------------------------- merge language packs
for (const pack of PACKS) {
  const c = pack.code;
  for (const [k, v] of Object.entries(pack.ui)) if (S[k]) S[k][c] = v;
  const pp = pack.passport;
  for (const k of ['title', 'usedFor', 'suggested', 'needed', 'tips', 'showThis']) P[k][c] = pp[k];
  for (const group of ['lane', 'zone', 'lens', 'flag', 'advice']) {
    for (const [k, v] of Object.entries(pp[group])) if (P[group][k]) P[group][k][c] = v;
  }
}
