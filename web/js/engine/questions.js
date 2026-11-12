// The anamnesis question bank. Every question carries:
//   when(s)   - clinical eligibility rule (the adaptive part: most questions are
//               only asked when their answer can change triage or the lens)
//   reason(s) - why it is being asked, shown to the operator and logged for
//               the reviewing optometrist
//   urgentOk  - still asked once a red flag has switched the session to urgent
// s = { a: answers, d: derived state from adaptive.derive() }
// English, Hindi and Tamil text live here; Telugu, Marathi and Kannada are
// merged in from js/lang/ packs at the bottom of this file. All drafted by the
// team, to be reviewed by native speakers at the pilot sites before use.
import { PACKS } from '../lang/index.js';

const YN = 'yesno';

const opt = (v, en, hi, ta, kw = [], extra = {}) => ({ v, label: { en, hi, ta }, kw, ...extra });

export const OCCUPATIONS = [
  opt('farmer', 'Farming', 'खेती', 'விவசாயம்', ['farm', 'farmer', 'farming', 'agriculture', 'field', 'fields', 'kisan', 'kheti', 'किसान', 'खेती', 'खेत', 'விவசாயம்', 'விவசாயி', 'வயல்', 'vivasayam']),
  opt('fisher', 'Fishing', 'मछली पकड़ना', 'மீன்பிடி', ['fish', 'fisherman', 'fishing', 'boat', 'मछली', 'मछुआरा', 'மீன்', 'மீனவர்', 'மீன்பிடி', 'படகு']),
  opt('driver', 'Driving', 'ड्राइविंग', 'ஓட்டுநர்', ['driver', 'driving', 'auto', 'lorry', 'truck', 'taxi', 'bus driver', 'ड्राइवर', 'ऑटो', 'ट्रक', 'टैक्सी', 'ஓட்டுநர்', 'டிரைவர்', 'ஆட்டோ', 'லாரி', 'டாக்ஸி']),
  opt('labour', 'Manual / construction', 'मज़दूरी / निर्माण', 'கூலி / கட்டட வேலை', ['labour', 'labourer', 'labor', 'construction', 'mason', 'coolie', 'factory', 'majdoor', 'मज़दूर', 'मजदूर', 'मिस्त्री', 'फैक्ट्री', 'கூலி', 'கட்டட', 'மேஸ்திரி', 'தொழிலாளி', 'பேக்டரி']),
  opt('tailor', 'Tailoring / sewing', 'सिलाई', 'தையல்', ['tailor', 'tailoring', 'sewing', 'stitching', 'darzi', 'silai', 'दर्जी', 'सिलाई', 'தையல்', 'டெய்லர்']),
  opt('weaver', 'Weaving', 'बुनाई', 'நெசவு', ['weaver', 'weaving', 'loom', 'handloom', 'bunkar', 'बुनकर', 'करघा', 'बुनाई', 'நெசவு', 'நெசவாளர்', 'தறி']),
  opt('fine', 'Fine work (jewellery, repair)', 'बारीक काम (गहने, मरम्मत)', 'நுணுக்க வேலை (நகை, ரிப்பேர்)', ['goldsmith', 'jeweller', 'jewellery', 'jewelry', 'watch repair', 'electronics', 'mobile repair', 'embroidery', 'sunar', 'सुनार', 'जौहरी', 'कढ़ाई', 'घड़ी', 'नगीना', 'பொற்கொல்லர்', 'நகை', 'எம்பிராய்டரி', 'ரிப்பேர்', 'வாட்ச்']),
  opt('shop', 'Shop / business', 'दुकान / व्यापार', 'கடை / வியாபாரம்', ['shop', 'shopkeeper', 'store', 'business', 'sales', 'counter', 'dukaan', 'dukan', 'दुकान', 'दुकानदार', 'व्यापार', 'बिज़नेस', 'கடை', 'வியாபாரம்', 'கடைக்காரர்', 'பிசினஸ்']),
  opt('homemaker', 'Housework', 'घर का काम', 'வீட்டு வேலை', ['housewife', 'homemaker', 'house work', 'housework', 'home', 'cooking', 'household', 'गृहिणी', 'घर का काम', 'घर', 'खाना बनाना', 'இல்லத்தரசி', 'வீட்டு வேலை', 'வீட்டில்', 'சமையல்']),
  opt('teacher', 'Teaching', 'पढ़ाना', 'ஆசிரியர்', ['teacher', 'teaching', 'professor', 'lecturer', 'शिक्षक', 'टीचर', 'अध्यापक', 'पढ़ाता', 'पढ़ाती', 'ஆசிரியர்', 'டீச்சர்']),
  opt('office', 'Office / computer', 'ऑफ़िस / कंप्यूटर', 'அலுவலகம் / கணினி', ['office', 'computer', 'laptop', 'accountant', 'accounts', 'clerk', 'software', 'it', 'bank', 'ऑफिस', 'ऑफ़िस', 'दफ़्तर', 'दफ्तर', 'कंप्यूटर', 'अकाउंटेंट', 'बैंक', 'அலுவலகம்', 'ஆபீஸ்', 'கணினி', 'கம்ப்யூட்டர்', 'அக்கவுண்டன்ட்', 'வங்கி']),
  opt('student', 'Studying', 'पढ़ाई', 'படிப்பு', ['student', 'study', 'studying', 'college', 'school', 'पढ़ाई', 'छात्र', 'छात्रा', 'स्टूडेंट', 'कॉलेज', 'स्कूल', 'படிப்பு', 'மாணவர்', 'மாணவி', 'காலேஜ்', 'படிக்கிறேன்', 'பள்ளி']),
  opt('health', 'Health worker', 'स्वास्थ्य कार्यकर्ता', 'சுகாதாரப் பணியாளர்', ['nurse', 'asha', 'health worker', 'anganwadi', 'आशा', 'नर्स', 'आंगनवाड़ी', 'செவிலியர்', 'நர்ஸ்', 'ஆஷா', 'அங்கன்வாடி']),
  opt('retired', 'Retired / not working', 'रिटायर / काम नहीं', 'ஓய்வு / வேலை இல்லை', ['retired', 'no work', 'not working', 'pension', 'रिटायर', 'सेवानिवृत्त', 'कोई काम नहीं', 'पेंशन', 'ஓய்வு', 'ரிட்டையர்', 'வேலை இல்லை', 'பென்ஷன்']),
  opt('other', 'Other', 'अन्य', 'மற்றவை', ['other', 'something else', 'अन्य', 'दूसरा', 'மற்றவை', 'வேறு']),
];

const COMPLAINTS = [
  opt('far_blur', 'Blurry far away', 'दूर का धुंधला', 'தூரம் மங்கல்', ['far', 'distance', 'faraway', 'board', 'bus number', 'tv', 'television', 'road', 'दूर', 'टीवी', 'बोर्ड', 'बस', 'தூரம்', 'தூரத்தில்', 'போர்டு', 'பஸ்', 'டிவி']),
  opt('near_blur', 'Blurry up close', 'पास का धुंधला', 'அருகில் மங்கல்', ['near', 'close', 'up close', 'reading', 'read', 'newspaper', 'phone', 'mobile', 'small letters', 'small print', 'needle', 'पास', 'पढ़ने', 'पढ़ना', 'अख़बार', 'अखबार', 'मोबाइल', 'फोन', 'सुई', 'धागा', 'छोटे अक्षर', 'அருகில்', 'கிட்ட', 'படிக்க', 'பேப்பர்', 'செய்தித்தாள்', 'ஊசி', 'போன்', 'மொபைல்', 'சின்ன எழுத்து']),
  opt('strain', 'Headache / tired eyes', 'सिरदर्द / आँखों में थकान', 'தலைவலி / கண் சோர்வு', ['headache', 'head ache', 'tired', 'strain', 'burning', 'watering', 'itching', 'dry', 'सिरदर्द', 'सर दर्द', 'सिर दर्द', 'थकान', 'जलन', 'खुजली', 'தலைவலி', 'தலை வலி', 'சோர்வு', 'எரிச்சல்', 'அரிப்பு']),
  opt('checkup', 'Routine check / new glasses', 'जाँच / नया चश्मा', 'பரிசோதனை / புது கண்ணாடி', ['check', 'checkup', 'check up', 'routine', 'test', 'new glasses', 'new specs', 'जाँच', 'जांच', 'चेकअप', 'चेक', 'टेस्ट', 'नया चश्मा', 'பரிசோதனை', 'செக்கப்', 'செக்', 'டெஸ்ட்', 'புது கண்ணாடி']),
];

const t = (en, hi, ta) => ({ en, hi, ta });
const has = (arr, v) => Array.isArray(arr) && arr.includes(v);
const OUTDOOR_JOBS = ['farmer', 'fisher', 'driver', 'labour'];
const SCREEN_JOBS = ['office', 'student', 'teacher', 'shop', 'health', 'other', 'retired'];
const NEAR_JOBS = ['tailor', 'weaver', 'fine', 'student', 'office', 'teacher'];

export const QUESTIONS = [
  // ---------------------------------------------------------- core
  {
    id: 'age', module: 'core', type: 'number', min: 1, max: 110, unit: t('years', 'साल', 'வயது'), urgentOk: true,
    quick: [8, 15, 25, 40, 50, 60, 70],
    text: t('How old are you?', 'आपकी उम्र कितनी है?', 'உங்கள் வயது என்ன?'),
    when: () => true,
    reason: () => 'Age sets which eye changes to look for: myopia in children, presbyopia after 40, cataract after 50.',
  },
  {
    id: 'sex', module: 'core', type: 'single', urgentOk: true,
    text: t('Are you female or male?', 'आप महिला हैं या पुरुष?', 'நீங்கள் பெண்ணா அல்லது ஆணா?'),
    options: [
      opt('female', 'Female', 'महिला', 'பெண்', ['female', 'woman', 'lady', 'girl', 'mahila', 'aurat', 'ladki', 'महिला', 'औरत', 'स्त्री', 'लड़की', 'பெண்', 'பொண்ணு', 'penn', 'ponnu']),
      opt('male', 'Male', 'पुरुष', 'ஆண்', ['male', 'man', 'boy', 'gents', 'purush', 'aadmi', 'ladka', 'पुरुष', 'आदमी', 'लड़का', 'ஆண்', 'ஆம்பள', 'பையன்', 'aambala', 'paiyan']),
      opt('other', 'Other', 'अन्य', 'மற்றவை', ['other', 'transgender', 'अन्य', 'ट्रांसजेंडर', 'மற்றவை', 'திருநங்கை']),
    ],
    when: () => true,
    reason: () => 'Needed for the record; some conditions differ by sex (angle-closure glaucoma is more common in women).',
  },
  {
    id: 'complaint', module: 'core', type: 'multi', urgentOk: true,
    text: t(
      'What brings you here today? For example: blurry far away, blurry up close, headache or tired eyes, or just a check-up.',
      'आज आप किस वजह से आए हैं? जैसे दूर का धुंधला दिखना, पास का धुंधला दिखना, सिरदर्द या आँखों में थकान, या सिर्फ़ जाँच।',
      'இன்று எதற்காக வந்தீர்கள்? உதாரணமாக: தூரம் மங்கலாகத் தெரிவது, அருகில் மங்கலாகத் தெரிவது, தலைவலி அல்லது கண் சோர்வு, அல்லது வெறும் பரிசோதனை.'),
    options: COMPLAINTS,
    when: () => true,
    reason: () => 'The main complaint decides which tests and follow-up questions matter.',
  },

  // ---------------------------------------------------------- red flags (always asked)
  {
    id: 'rf_sudden', module: 'redflag', type: YN, urgentOk: true,
    text: t(
      'In the last few weeks, has your sight suddenly got worse, or have you seen flashes of light, a dark shadow like a curtain, or double vision?',
      'पिछले कुछ हफ़्तों में क्या आपकी नज़र अचानक कम हुई है, या रोशनी की चमक, पर्दे जैसी काली परछाई, या दोहरा दिखाई दिया है?',
      'கடந்த சில வாரங்களில் பார்வை திடீரென்று குறைந்ததா, அல்லது ஒளி மின்னல், திரை போன்ற கருப்பு நிழல், அல்லது இரண்டாகத் தெரிவது ஏற்பட்டதா?'),
    when: () => true,
    reason: () => 'Sudden loss, flashes, a curtain or new double vision can mean retinal detachment, a blocked vessel or a stroke: same-day referral.',
  },
  {
    id: 'rf_sudden_which', module: 'redflag', type: 'multi', urgentOk: true,
    text: t(
      'Which of these happened? Sudden blur, flashes or floating spots, a shadow or curtain, or double vision?',
      'इनमें से क्या हुआ? अचानक धुंधलापन, चमक या तैरते धब्बे, परछाई या पर्दा, या दोहरा दिखना?',
      'இவற்றில் எது நடந்தது? திடீர் மங்கல், மின்னல் அல்லது மிதக்கும் புள்ளிகள், நிழல் அல்லது திரை, அல்லது இரண்டாகத் தெரிவது?'),
    options: [
      opt('drop', 'Sudden blur or loss', 'अचानक धुंधलापन', 'திடீர் மங்கல்', ['sudden', 'suddenly', 'drop', 'loss', 'blur', 'blurry', 'gone', 'अचानक', 'धुंधला', 'திடீர்', 'மங்கல்']),
      opt('flashes', 'Flashes / new floaters', 'चमक / तैरते धब्बे', 'மின்னல் / மிதக்கும் புள்ளிகள்', ['flash', 'flashes', 'light', 'lights', 'floaters', 'spots', 'dots', 'threads', 'चमक', 'रोशनी', 'धब्बे', 'மின்னல்', 'ஒளி', 'புள்ளி']),
      opt('curtain', 'Shadow / curtain', 'परछाई / पर्दा', 'நிழல் / திரை', ['curtain', 'shadow', 'dark', 'black', 'veil', 'पर्दा', 'परछाई', 'काला', 'திரை', 'நிழல்', 'கருப்பு', 'இருட்டு']),
      opt('double', 'Double vision', 'दोहरा दिखना', 'இரண்டாகத் தெரிவது', ['double', 'two images', 'दोहरा', 'दो दिखते', 'இரண்டாக', 'இரட்டை', 'ரெண்டா']),
    ],
    when: (s) => s.a.rf_sudden === true,
    reason: () => 'The type of sudden change tells the receiving doctor whether to expect a retinal or a neurological emergency.',
  },
  {
    id: 'rf_pain', module: 'redflag', type: YN, urgentOk: true,
    text: t('Do you have eye pain, redness, or an eye injury right now?',
      'क्या अभी आपकी आँख में दर्द, लाली, या कोई चोट है?',
      'இப்போது கண்ணில் வலி, சிவப்பு, அல்லது ஏதேனும் காயம் இருக்கிறதா?'),
    when: () => true,
    reason: () => 'A painful red eye or an injury needs a doctor, not new glasses.',
  },
  {
    id: 'rf_pain_severe', module: 'redflag', type: YN, urgentOk: true,
    text: t(
      'Is your vision also blurred, do you see coloured rings around lights, or did something hit or splash into the eye?',
      'क्या साथ में धुंधला भी दिखता है, बत्तियों के चारों ओर रंगीन घेरे दिखते हैं, या आँख में कुछ लगा या छिटका था?',
      'கூடவே பார்வை மங்கலாக இருக்கிறதா, விளக்குகளைச் சுற்றி வண்ண வளையங்கள் தெரிகிறதா, அல்லது கண்ணில் ஏதாவது பட்டதா அல்லது தெறித்ததா?'),
    when: (s) => s.a.rf_pain === true,
    reason: () => 'Pain with blur or haloes suggests acute angle-closure glaucoma, keratitis or trauma: same-day referral. Without them it is usually less urgent.',
  },
  {
    id: 'child_white', module: 'child', type: YN, urgentOk: true,
    text: t(
      'Have you ever seen a white glow, like a cat’s eye, in the child’s eye, in person or in a photo?',
      'क्या आपने कभी बच्चे की आँख में बिल्ली की आँख जैसी सफ़ेद चमक देखी है, सामने या फ़ोटो में?',
      'குழந்தையின் கண்ணில் பூனைக் கண் போன்ற வெள்ளைப் பளபளப்பை நேரிலோ புகைப்படத்திலோ எப்போதாவது பார்த்திருக்கிறீர்களா?'),
    when: (s) => s.d.isChild,
    reason: () => 'A white pupil glow (leukocoria) can be childhood cataract or retinoblastoma: urgent referral.',
  },
  {
    id: 'child_squint', module: 'child', type: YN,
    text: t(
      'Does one of the child’s eyes turn in or out, or does the child tilt their head or close one eye to see?',
      'क्या बच्चे की एक आँख अंदर या बाहर मुड़ती है, या देखने के लिए बच्चा सिर टेढ़ा करता है या एक आँख बंद करता है?',
      'குழந்தையின் ஒரு கண் உள்ளே அல்லது வெளியே திரும்புகிறதா, அல்லது பார்க்கும்போது தலையைச் சாய்க்கிறதா அல்லது ஒரு கண்ணை மூடுகிறதா?'),
    when: (s) => s.d.isChild,
    reason: () => 'A squint or head tilt can mean amblyopia (lazy eye), which can only be treated in childhood.',
  },

  // ---------------------------------------------------------- medical
  {
    id: 'conditions', module: 'medical', type: 'multi', urgentOk: true,
    text: t('Do you have diabetes, high blood pressure, or a thyroid problem?',
      'क्या आपको शुगर (डायबिटीज़), हाई बीपी, या थायरॉइड की समस्या है?',
      'உங்களுக்கு சர்க்கரை நோய், ரத்த அழுத்தம், அல்லது தைராய்டு பிரச்சனை இருக்கிறதா?'),
    options: [
      opt('diabetes', 'Diabetes (sugar)', 'शुगर (डायबिटीज़)', 'சர்க்கரை நோய்', ['diabetes', 'diabetic', 'sugar', 'शुगर', 'मधुमेह', 'डायबिटीज', 'डायबिटीज़', 'சுகர்', 'சர்க்கரை', 'நீரிழிவு']),
      opt('bp', 'High blood pressure', 'हाई बीपी', 'ரத்த அழுத்தம்', ['bp', 'blood pressure', 'pressure', 'hypertension', 'बीपी', 'ब्लड प्रेशर', 'रक्तचाप', 'प्रेशर', 'பிபி', 'பி பி', 'ரத்த அழுத்தம்', 'பிரஷர்']),
      opt('thyroid', 'Thyroid', 'थायरॉइड', 'தைராய்டு', ['thyroid', 'थायरॉइड', 'थायराइड', 'थाइरोइड', 'தைராய்டு']),
      opt('none', 'None of these', 'इनमें से कुछ नहीं', 'எதுவும் இல்லை', ['none', 'no', 'nothing', 'neither', 'कोई नहीं', 'नहीं', 'कुछ नहीं', 'இல்லை', 'எதுவும் இல்லை', 'ஒன்றும் இல்லை', 'illa', 'nahi'], { exclusive: true }),
    ],
    when: (s) => s.d.age >= 18,
    reason: () => 'Diabetes damages the retina silently and makes glasses power fluctuate; blood pressure and thyroid disease also affect the eyes.',
  },
  {
    id: 'diabetes_years', module: 'medical', type: 'number', min: 0, max: 80, unit: t('years', 'साल', 'வருடம்'),
    quick: [1, 3, 5, 10, 15, 20],
    text: t('For how many years have you had diabetes?', 'आपको शुगर कितने साल से है?', 'எத்தனை வருடங்களாக சர்க்கரை நோய் இருக்கிறது?'),
    when: (s) => s.d.diabetic,
    reason: () => 'Retinopathy risk rises with every year of diabetes; a new diagnosis also means the glasses power may still be shifting.',
  },
  {
    id: 'retina_exam', module: 'medical', type: 'single',
    text: t(
      'When did a doctor last put drops in your eyes and check the back of the eye? Within the last year, more than a year ago, or never?',
      'डॉक्टर ने आखिरी बार आँखों में दवा डालकर आँख के पर्दे की जाँच कब की थी? पिछले एक साल में, एक साल से पहले, या कभी नहीं?',
      'கடைசியாக எப்போது மருத்துவர் கண்ணில் சொட்டு மருந்து போட்டு கண்ணின் பின்பகுதியைப் பரிசோதித்தார்? கடந்த ஒரு வருடத்திற்குள், ஒரு வருடத்திற்கு முன், அல்லது ஒருபோதும் இல்லை?'),
    options: [
      opt('within_1y', 'Within the last year', 'पिछले एक साल में', 'கடந்த ஒரு வருடத்திற்குள்', ['within', 'this year', 'last year', 'recently', 'recent', 'months', 'month', 'few months', 'इस साल', 'पिछले साल', 'कुछ महीने', 'महीने', 'हाल ही में', 'இந்த வருடம்', 'சில மாதம்', 'மாசம்', 'சமீபத்தில்']),
      opt('over_1y', 'More than a year ago', 'एक साल से पहले', 'ஒரு வருடத்திற்கு முன்', ['more than', 'years ago', 'long ago', 'long time', 'two years', 'three years', 'साल पहले', 'बहुत पहले', 'काफी पहले', 'दो साल', 'வருடம் முன்', 'வருஷம் முன்', 'ரொம்ப நாள்', 'ரெண்டு வருடம்']),
      opt('never', 'Never', 'कभी नहीं', 'ஒருபோதும் இல்லை', ['never', 'not done', 'no', 'नहीं', 'कभी नहीं', 'नहीं करवाई', 'ஒருபோதும்', 'இல்லை', 'இல்ல', 'பார்க்கவில்லை', 'செய்யவில்லை']),
    ],
    when: (s) => s.d.diabetic,
    reason: () => 'People with diabetes need a dilated retina check every year; an overdue check is referred.',
  },
  {
    id: 'glaucoma_family', module: 'medical', type: YN,
    text: t('Does your mother, father, brother or sister have glaucoma, the eye pressure disease?',
      'क्या आपकी माँ, पिता, भाई या बहन को काला मोतिया (ग्लूकोमा) है?',
      'உங்கள் அம்மா, அப்பா, சகோதரர் அல்லது சகோதரிக்கு கண் அழுத்த நோய் (கிளாக்கோமா) இருக்கிறதா?'),
    when: (s) => s.d.age >= 40,
    reason: () => 'Glaucoma runs in families and steals sight painlessly; relatives over 40 need an eye-pressure and optic-nerve check.',
  },
  {
    id: 'eye_surgery', module: 'medical', type: 'single',
    text: t('Have you had cataract surgery, or any other eye operation?',
      'क्या आपका मोतियाबिंद का ऑपरेशन, या आँख का कोई और ऑपरेशन हुआ है?',
      'உங்களுக்கு கண்புரை அறுவை சிகிச்சை அல்லது வேறு ஏதேனும் கண் அறுவை சிகிச்சை செய்யப்பட்டதா?'),
    options: [
      opt('cataract', 'Cataract surgery', 'मोतियाबिंद का ऑपरेशन', 'கண்புரை அறுவை', ['cataract', 'lens', 'iol', 'मोतियाबिंद', 'लेंस', 'कैटरेक्ट', 'கண்புரை', 'புரை', 'கேட்டராக்ட்', 'லென்ஸ்']),
      opt('other', 'Another eye operation', 'आँख का कोई और ऑपरेशन', 'வேறு கண் அறுவை', ['other', 'laser', 'lasik', 'retina', 'squint', 'लेज़र', 'लेजर', 'दूसरा', 'लसिक', 'லேசர்', 'வேறு']),
      opt('none', 'No operation', 'कोई ऑपरेशन नहीं', 'அறுவை இல்லை', ['no', 'none', 'never', 'नहीं', 'कभी नहीं', 'இல்லை', 'இல்ல', 'கிடையாது']),
    ],
    when: (s) => s.d.age >= 40,
    reason: () => 'After cataract surgery the eye cannot focus up close, so near glasses are needed whatever the age.',
  },

  // ---------------------------------------------------------- current glasses
  {
    id: 'glasses_now', module: 'glasses', type: YN,
    text: t('Do you wear glasses now?', 'क्या आप अभी चश्मा पहनते हैं?', 'இப்போது கண்ணாடி அணிகிறீர்களா?'),
    when: () => true,
    reason: () => 'Current glasses show the past prescription and what is or isn’t working.',
  },
  {
    id: 'glasses_type', module: 'glasses', type: 'single',
    text: t('What kind are they: for distance, for reading, bifocal with a line, or progressive with no line?',
      'चश्मा किस तरह का है: दूर का, पढ़ने का, लाइन वाला बाइफ़ोकल, या बिना लाइन वाला प्रोग्रेसिव?',
      'அது எந்த வகை: தூரப் பார்வைக்கு, படிக்க, கோடு உள்ள பைஃபோகல், அல்லது கோடு இல்லாத புரோகிரசிவ்?'),
    options: [
      opt('distance', 'Distance', 'दूर का', 'தூரப் பார்வை', ['distance', 'far', 'दूर', 'தூர', 'தூரம்']),
      opt('reading', 'Reading', 'पढ़ने का', 'படிக்க', ['reading', 'read', 'near', 'readers', 'पढ़ने', 'पास', 'படிக்க', 'அருகில்', 'ரீடிங்']),
      opt('bifocal', 'Bifocal (line)', 'बाइफ़ोकल (लाइन)', 'பைஃபோகல் (கோடு)', ['bifocal', 'line', 'kryptok', 'बाइफोकल', 'बाइफ़ोकल', 'लाइन', 'பைஃபோகல்', 'கோடு']),
      opt('progressive', 'Progressive (no line)', 'प्रोग्रेसिव (बिना लाइन)', 'புரோகிரசிவ் (கோடு இல்லை)', ['progressive', 'no line', 'varifocal', 'without line', 'प्रोग्रेसिव', 'बिना लाइन', 'புரோகிரசிவ்', 'கோடு இல்லாத', 'கோடு இல்லை']),
      opt('unknown', 'Don’t know', 'पता नहीं', 'தெரியாது', ['dont know', 'not sure', 'no idea', 'पता नहीं', 'मालूम नहीं', 'தெரியாது', 'தெரியலை']),
    ],
    when: (s) => s.a.glasses_now === true,
    reason: () => 'Tells us which zones the patient already relies on, and whether they have adapted to multifocals before.',
  },
  {
    id: 'glasses_years', module: 'glasses', type: 'number', min: 0, max: 40, unit: t('years', 'साल', 'வருடம்'),
    quick: [0.5, 1, 2, 3, 5, 10],
    text: t('How old are your current glasses, in years?', 'आपका अभी वाला चश्मा कितने साल पुराना है?', 'இப்போதைய கண்ணாடி எத்தனை வருடம் பழையது?'),
    when: (s) => s.a.glasses_now === true,
    reason: () => 'Prescriptions older than about two years are often out of date, especially after 40.',
  },
  {
    id: 'glasses_ok', module: 'glasses', type: 'single',
    text: t('With these glasses, how do you see: fine, blurry far away, blurry up close, or do they give you headaches?',
      'इस चश्मे से कैसा दिखता है: ठीक, दूर का धुंधला, पास का धुंधला, या सिरदर्द होता है?',
      'இந்தக் கண்ணாடியுடன் எப்படித் தெரிகிறது: நன்றாக, தூரம் மங்கல், அருகில் மங்கல், அல்லது தலைவலி வருகிறதா?'),
    options: [
      opt('fine', 'Fine', 'ठीक', 'நன்றாக', ['fine', 'good', 'ok', 'okay', 'clear', 'no problem', 'ठीक', 'अच्छा', 'साफ़', 'साफ', 'कोई दिक्कत नहीं', 'நன்றாக', 'நல்லா', 'சரியா', 'தெளிவா', 'பிரச்சனை இல்லை']),
      opt('far_blur', 'Blurry far away', 'दूर का धुंधला', 'தூரம் மங்கல்', ['far', 'distance', 'दूर', 'தூரம்', 'தூர']),
      opt('near_blur', 'Blurry up close', 'पास का धुंधला', 'அருகில் மங்கல்', ['near', 'close', 'reading', 'पास', 'पढ़ने', 'அருகில்', 'படிக்க', 'கிட்ட']),
      opt('discomfort', 'Headaches / discomfort', 'सिरदर्द / परेशानी', 'தலைவலி / அசௌகரியம்', ['headache', 'pain', 'discomfort', 'dizzy', 'dizziness', 'सिरदर्द', 'चक्कर', 'दर्द', 'தலைவலி', 'தலைசுற்றல்', 'வலி']),
    ],
    when: (s) => s.a.glasses_now === true,
    reason: () => 'Separates an outdated prescription from a wrong lens type or a poor fit.',
  },
  {
    id: 'rx_known', module: 'glasses', type: 'rx', asr: 'en',
    text: t(
      'If you have the prescription slip, read it out. For example: right eye minus one point five, cylinder minus point five, axis ninety. Or say skip.',
      'अगर चश्मे के नंबर की पर्ची है, तो नंबर पढ़कर बताइए। जैसे: right eye minus one point five, cylinder minus point five, axis ninety। या skip कहिए।',
      'கண்ணாடி பவர் சீட்டு இருந்தால், அதைப் படியுங்கள். உதாரணம்: right eye minus one point five, cylinder minus point five, axis ninety. இல்லையென்றால் skip என்று சொல்லுங்கள்.'),
    when: (s) => s.a.glasses_now === true,
    reason: () => 'A known prescription is the best starting point; it is checked against valid lens steps and for big differences between the eyes.',
  },
  {
    id: 'frequent_change', module: 'glasses', type: YN,
    text: t('In the last two years, have you needed new glasses more than once because the power kept changing?',
      'पिछले दो साल में क्या नंबर बदलते रहने की वजह से एक से ज़्यादा बार नया चश्मा बनवाना पड़ा?',
      'கடந்த இரண்டு வருடங்களில், பவர் மாறிக்கொண்டே இருந்ததால் ஒன்றுக்கு மேற்பட்ட முறை புதிய கண்ணாடி தேவைப்பட்டதா?'),
    when: (s) => s.a.glasses_now === true && (s.d.age >= 45 || s.d.diabetic),
    reason: () => 'Power that keeps changing can signal a developing cataract or uncontrolled diabetes.',
  },

  // ---------------------------------------------------------- visual tasks (the profile)
  {
    id: 'occupation', module: 'lifestyle', type: 'single',
    text: t(
      'What work do you do for most of the day? For example: farming, tailoring, driving, a shop, office or computer work, housework, or studies.',
      'आप दिन में ज़्यादातर क्या काम करते हैं? जैसे खेती, सिलाई, गाड़ी चलाना, दुकान, ऑफ़िस या कंप्यूटर का काम, घर का काम, या पढ़ाई।',
      'நாளின் பெரும்பகுதி என்ன வேலை செய்கிறீர்கள்? உதாரணமாக: விவசாயம், தையல், வண்டி ஓட்டுதல், கடை, அலுவலகம் அல்லது கணினி வேலை, வீட்டு வேலை, அல்லது படிப்பு.'),
    options: OCCUPATIONS,
    when: (s) => !s.d.isChild,
    reason: () => 'Work sets how many hours go to near, arm’s-length and far vision, the core of the vision profile.',
  },
  {
    id: 'near_hours', module: 'lifestyle', type: 'hours',
    quick: [0, 1, 2, 3, 4, 6, 8],
    text: (s) => (s.d.isChild
      ? t('How many hours a day does the child spend on homework, books, or a phone or tablet?',
        'बच्चा दिन में कितने घंटे होमवर्क, किताबों, या मोबाइल-टैबलेट पर बिताता है?',
        'குழந்தை நாளில் எத்தனை மணி நேரம் வீட்டுப்பாடம், புத்தகம், அல்லது போன்-டேப்லெட்டில் செலவிடுகிறது?')
      : t('On a normal day, how many hours do you spend on close work: reading, the phone, sewing or fine handwork?',
        'आम दिन में आप कितने घंटे पास का काम करते हैं: पढ़ना, मोबाइल, सिलाई या बारीक हाथ का काम?',
        'ஒரு சாதாரண நாளில் எத்தனை மணி நேரம் அருகில் பார்க்கும் வேலை செய்கிறீர்கள்: படிப்பது, போன், தையல் அல்லது நுணுக்கமான கைவேலை?')),
    when: (s) => s.d.isChild || s.d.age >= 35 || NEAR_JOBS.includes(s.d.occ)
      || has(s.a.complaint, 'near_blur') || has(s.a.complaint, 'strain'),
    reason: (s) => (s.d.isChild
      ? 'More than about 3 hours of close work a day raises a child’s myopia risk.'
      : s.d.age >= 35 ? 'From the late 30s, hours of close work decide the reading add and the lens type.'
        : 'Long close work explains strain symptoms and shapes the lens design.'),
  },
  {
    id: 'screen_hours', module: 'lifestyle', type: 'hours',
    quick: [0, 1, 2, 4, 6, 8],
    text: t('How many hours a day do you work on a computer or laptop screen?',
      'दिन में कितने घंटे आप कंप्यूटर या लैपटॉप की स्क्रीन पर काम करते हैं?',
      'நாளில் எத்தனை மணி நேரம் கணினி அல்லது லேப்டாப் திரையில் வேலை செய்கிறீர்கள்?'),
    when: (s) => !s.d.isChild && SCREEN_JOBS.includes(s.d.occ),
    reason: () => 'Screens sit at arm’s length ("intermediate" vision), which standard bifocals do not cover and progressives cover narrowly.',
  },
  {
    id: 'outdoor_hours', module: 'lifestyle', type: 'hours',
    quick: [0, 0.5, 1, 2, 3, 4, 6],
    text: (s) => (s.d.isChild
      ? t('How many hours a day does the child play or spend time outdoors in daylight?',
        'बच्चा दिन में कितने घंटे बाहर दिन की रोशनी में खेलता या समय बिताता है?',
        'குழந்தை நாளில் எத்தனை மணி நேரம் வெளியே பகல் வெளிச்சத்தில் விளையாடுகிறது?')
      : t('How many hours a day are you outdoors in daylight?',
        'दिन में कितने घंटे आप बाहर दिन की रोशनी में रहते हैं?',
        'நாளில் எத்தனை மணி நேரம் வெளியே பகல் வெளிச்சத்தில் இருக்கிறீர்கள்?')),
    when: (s) => s.d.isChild || (s.d.occ !== null && !OUTDOOR_JOBS.includes(s.d.occ)),
    reason: (s) => (s.d.isChild
      ? 'Daylight outdoors protects against myopia; children with under 2 hours a day are at higher risk.'
      : 'Long hours in sunlight call for UV protection and possibly photochromic lenses.'),
  },
  {
    id: 'child_board', module: 'child', type: YN,
    text: t('Does the child have trouble reading the board at school, or sit very close to the TV?',
      'क्या बच्चे को स्कूल में बोर्ड पढ़ने में दिक्कत होती है, या वह टीवी के बहुत पास बैठता है?',
      'குழந்தைக்கு பள்ளியில் கரும்பலகையைப் படிப்பதில் சிரமம் இருக்கிறதா, அல்லது டிவிக்கு மிக அருகில் உட்காருகிறதா?'),
    when: (s) => s.d.isChild && s.d.age >= 4,
    reason: () => 'The classic early sign of myopia in school children.',
  },
  {
    id: 'parent_myopia', module: 'child', type: 'single',
    text: t('Do the child’s parents wear glasses for seeing far? Neither, one parent, or both?',
      'क्या बच्चे के माता-पिता दूर देखने के लिए चश्मा पहनते हैं? कोई नहीं, एक, या दोनों?',
      'குழந்தையின் பெற்றோர் தூரம் பார்க்கக் கண்ணாடி அணிகிறார்களா? யாரும் இல்லை, ஒருவர், அல்லது இருவரும்?'),
    options: [
      opt('none', 'Neither', 'कोई नहीं', 'யாரும் இல்லை', ['none', 'neither', 'no', 'nobody', 'कोई नहीं', 'नहीं', 'யாரும் இல்லை', 'இல்லை']),
      opt('one', 'One parent', 'एक', 'ஒருவர்', ['one', 'mother', 'father', 'mom', 'dad', 'एक', 'माँ', 'मां', 'पापा', 'पिता', 'ஒருவர்', 'அம்மா', 'அப்பா']),
      opt('both', 'Both', 'दोनों', 'இருவரும்', ['both', 'दोनों', 'இருவரும்', 'ரெண்டு பேரும்']),
    ],
    when: (s) => s.d.isChild,
    reason: () => 'Myopia risk rises with one short-sighted parent and more with two.',
  },
  {
    id: 'drives', module: 'lifestyle', type: YN,
    text: t('Do you drive a vehicle or ride a two-wheeler?', 'क्या आप कोई गाड़ी या दोपहिया चलाते हैं?', 'நீங்கள் வாகனம் அல்லது இருசக்கர வாகனம் ஓட்டுகிறீர்களா?'),
    when: (s) => s.d.age >= 16 && s.d.occ !== 'driver',
    reason: () => 'Driving needs sharp distance vision and wide side vision; it changes lens design and coating advice.',
  },
  {
    id: 'night_glare', module: 'lifestyle', type: YN,
    text: t('At night, do headlights or street lights dazzle you, or do colours look dull and faded?',
      'रात में क्या गाड़ियों या सड़क की बत्तियों से आँखें चौंधियाती हैं, या रंग फीके दिखते हैं?',
      'இரவில் வாகன விளக்குகள் அல்லது தெரு விளக்குகள் கண்ணைக் கூசச் செய்கின்றனவா, அல்லது நிறங்கள் மங்கலாகத் தெரிகின்றனவா?'),
    when: (s) => s.d.age >= 50 || s.a.drives === true || s.d.occ === 'driver',
    reason: (s) => (s.d.age >= 50
      ? 'Glare and faded colours after 50 are early cataract signs.'
      : 'Night glare for a driver calls for an anti-reflective coating.'),
  },
  {
    id: 'falls', module: 'lifestyle', type: YN,
    text: t('In the past year, have you had a fall, or do you find steps and kerbs hard to judge?',
      'पिछले एक साल में क्या आप गिरे हैं, या सीढ़ियाँ और ऊँचे-नीचे किनारे समझने में दिक्कत होती है?',
      'கடந்த ஒரு வருடத்தில் கீழே விழுந்தீர்களா, அல்லது படிக்கட்டுகள் மற்றும் விளிம்புகளைக் கணிப்பது கடினமாக இருக்கிறதா?'),
    when: (s) => s.d.age >= 65,
    reason: () => 'In active older people, bifocals and progressives blur steps and kerbs; a separate distance pair for walking can prevent falls.',
  },

  // ---------------------------------------------------------- preference
  {
    id: 'budget', module: 'preference', type: 'single',
    text: t(
      'How much would you like to spend on the lenses: under one thousand rupees, one to three thousand, or more than three thousand?',
      'आप लेंस पर कितना खर्च करना चाहेंगे: एक हज़ार रुपये से कम, एक से तीन हज़ार, या तीन हज़ार से ज़्यादा?',
      'லென்ஸுக்கு எவ்வளவு செலவு செய்ய விரும்புகிறீர்கள்: ஆயிரம் ரூபாய்க்குக் குறைவாக, ஆயிரம் முதல் மூவாயிரம், அல்லது மூவாயிரத்திற்கு மேல்?'),
    options: [
      opt('low', 'Under ₹1,000', '₹1,000 से कम', '₹1,000-க்குக் கீழ்', ['under', 'below', 'less than', 'cheap', 'low', 'से कम', 'कम', 'सस्ता', 'குறைவாக', 'குறைவு', 'கம்மி', 'கீழ்'], { range: [0, 1000] }),
      opt('mid', '₹1,000 – 3,000', '₹1,000 – 3,000', '₹1,000 – 3,000', ['between', 'one to three', 'medium', 'बीच', 'एक से तीन', 'இடையில்', 'ஆயிரம் முதல்'], { range: [1000, 3001] }),
      opt('high', 'Over ₹3,000', '₹3,000 से ज़्यादा', '₹3,000-க்கு மேல்', ['more than', 'above', 'over', 'best', 'से ज़्यादा', 'से ज्यादा', 'ज़्यादा', 'ज्यादा', 'மேல்', 'அதிகம்'], { range: [3001, 1e9] }),
    ],
    when: (s) => s.d.presbyopeLikely || s.d.isChild,
    reason: () => 'Lens options for near-and-far needs range from low-cost bifocals to progressives; advice must be affordable to be followed.',
  },
];

// ---------------------------------------------------------------- merge language packs
for (const pack of PACKS) {
  const c = pack.code;
  for (const q of QUESTIONS) {
    const tx = pack.q[q.id];
    if (tx && typeof q.text === 'function') {
      const prev = q.text; // child/adult variants: wrap, keeping earlier languages
      q.text = (s) => ({ ...prev(s), [c]: s.d.isChild ? tx.child : tx.adult });
    } else if (tx && typeof tx === 'string') {
      q.text[c] = tx;
    }
    if (q.unit) q.unit[c] = pack.units.years;
    const opts = pack.opt[q.id];
    if (opts && q.options) {
      for (const o of q.options) {
        const entry = opts[o.v];
        if (!entry) continue;
        o.label[c] = entry[0];
        o.kw = [...o.kw, ...entry];
      }
    }
  }
}

export const QUESTION_BY_ID = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

export function questionText(q, s, lang) {
  const txt = typeof q.text === 'function' ? q.text(s) : q.text;
  return txt[lang] || txt.en;
}
