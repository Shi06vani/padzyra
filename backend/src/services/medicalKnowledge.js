/**
 * Padzyra Curated Medical Knowledge Base
 * Authoritative reviewed clinical evidence from WHO, NHS, ACOG, and MedlinePlus.
 * Supports bilingual (EN/HI) summaries, source citation validation, and safe RAG retrieval.
 */

const db = require('../models');

const CURATED_SOURCES = [
  {
    slug: 'who-menstrual-health',
    title: 'Menstrual health: Fact sheets',
    organization: 'World Health Organization (WHO)',
    url: 'https://www.who.int/news-room/fact-sheets/detail/menstrual-health',
    topic: 'menstrual_health_hygiene',
    reviewStatus: 'reviewed',
    reviewDate: '2026-06-15',
    summaryEn:
      'Menstrual health is an integral aspect of sexual and reproductive health and overall human dignity. A normal menstrual cycle typically ranges between 21 and 35 days, with 2 to 7 days of bleeding. Proper menstrual hygiene, access to safe sanitation facilities, clean water, and supportive care prevent pelvic and reproductive tract infections.',
    summaryHi:
      'मासिक धर्म (माहवारी) स्वास्थ्य महिला प्रजनन और संपूर्ण शारीरिक स्वास्थ्य का महत्वपूर्ण अंग है। सामान्य मासिक चक्र आमतौर पर 21 से 35 दिनों का होता है, जिसमें 2 से 7 दिन रक्तस्राव होता है। उचित स्वच्छता, साफ पानी और सुरक्षित सैनिटरी उत्पादों का उपयोग संक्रमण से बचाता है।',
    keyPoints: [
      'Normal menstrual cycle length is typically 21 to 35 days.',
      'Active bleeding usually lasts between 2 and 7 days.',
      'Access to clean sanitary products and hygiene prevents bacterial vaginosis and pelvic infections.',
      'Severe pain or prolonged cycle disruption warrants professional clinical care.',
    ],
    emergencyFlags: ['Systemic signs of infection', 'High fever with internal product usage'],
  },
  {
    slug: 'nhs-period-pain',
    title: 'Period pain (Dysmenorrhea)',
    organization: 'National Health Service (NHS)',
    url: 'https://www.nhs.uk/symptoms/period-pain/',
    topic: 'cramps_pain_relief',
    reviewStatus: 'reviewed',
    reviewDate: '2026-08-20',
    summaryEn:
      'Period pain (dysmenorrhea) is caused by uterine muscle contractions triggered by prostaglandins. Mild to moderate cramping in the lower abdomen, lower back, and thighs is common. Non-pharmacological evidence-based relief includes continuous heat therapy (heating pad or hot water bottle at ~40°C), gentle exercise, yoga stretches (Child’s pose), and adequate hydration. Seek clinical advice if pain severely disrupts daily life or is not eased by standard over-the-counter measures.',
    summaryHi:
      'पीरियड में होने वाला दर्द (Dysmenorrhea) गर्भाशय की मांसपेशियों में प्रोस्टाग्लैंडीन रसायन के कारण होने वाले संकुचन से होता है। पेट के निचले हिस्से, पीठ या जांघों में हल्का या मध्यम दर्द सामान्य है। पेट पर गर्म पानी की थैली (हीट पैक) रखना, हल्का योग (बालासन), गर्म हर्बल चाय पीना और हाइड्रेशन दर्द कम करने में वैज्ञानिक रूप से असरदार हैं।',
    keyPoints: [
      'Continuous heat application relaxes uterine muscles as effectively as mild pain relievers.',
      'Prostaglandins trigger cramping; anti-inflammatory lifestyle measures can reduce their impact.',
      'Gentle physical movement and deep abdominal breathing alleviate pelvic tension.',
      'Pain that prevents walking, going to school/work, or suddenly worsens requires clinical examination.',
    ],
    emergencyFlags: ['Sudden, excruciating pelvic pain', 'Pain accompanied by vomiting and high fever'],
  },
  {
    slug: 'acog-painful-periods',
    title: 'Painful Periods (Dysmenorrhea FAQs)',
    organization: 'American College of Obstetricians and Gynecologists (ACOG)',
    url: 'https://www.acog.org/womens-health/faqs/painful-periods',
    topic: 'cramps_pain_relief',
    reviewStatus: 'reviewed',
    reviewDate: '2026-07-10',
    summaryEn:
      'Primary dysmenorrhea is natural cramping without underlying pelvic pathology, typically beginning 1 to 2 days before bleeding. Secondary dysmenorrhea is caused by medical conditions such as endometriosis, adenomyosis, or uterine fibroids and tends to worsen over time or last throughout the cycle. Self-care includes warm compressions, sleep regularity, and magnesium-rich nutrition.',
    summaryHi:
      'ACOG के अनुसार, पीरियड दर्द दो प्रकार का होता है: प्राइमरी (सामान्य मासिक ऐंठन) और सेकेंडरी (एंडोमेट्रियोसिस या फाइब्रॉएड जैसी स्थितियों के कारण)। यदि दर्द सालों-साल अधिक गंभीर होता जा रहा है या पीरियड खत्म होने के बाद भी बना रहता है, तो स्त्री रोग विशेषज्ञ से जांच करवाना जरूरी है।',
    keyPoints: [
      'Primary dysmenorrhea usually starts shortly before bleeding and subsides over 48–72 hours.',
      'Secondary dysmenorrhea often begins earlier in the cycle and lasts longer.',
      'Magnesium, adequate rest, and avoiding high sodium reduce bloating and cramp severity.',
      'Clinicians evaluate secondary dysmenorrhea with pelvic ultrasound and specialized exams.',
    ],
    emergencyFlags: ['Unilateral sharp pain with dizziness', 'Pain unresponsive to rest and worsening'],
  },
  {
    slug: 'nhs-period-problems',
    title: 'Period problems (Irregular, Delayed, or Heavy Cycles)',
    organization: 'National Health Service (NHS)',
    url: 'https://www.nhs.uk/conditions/periods/period-problems/',
    topic: 'period_delay_irregularity',
    reviewStatus: 'reviewed',
    reviewDate: '2026-09-01',
    summaryEn:
      'Natural cycle variations of 3 to 7 days are frequent and often caused by acute emotional stress, illness, intense exercise, travel, or rapid dietary shifts. These temporary factors delay ovulation via the hypothalamic-pituitary-ovarian axis. If sexually active, a home pregnancy test should be performed if a period is 1 to 2 weeks overdue. Cycles chronically longer than 35 days or absent for >90 days warrant medical screening for hormonal variations (e.g., PCOS, thyroid disorders).',
    summaryHi:
      'तनाव, यात्रा, बीमारी, नींद की कमी या अचानक वजन में बदलाव के कारण 3 से 7 दिनों का पीरियड डिले सामान्य हो सकता है। यह ओव्यूलेशन में देरी के कारण होता है। यदि गर्भावस्था संभव हो, तो 1-2 दिन की देरी के बाद होम प्रेग्नेंसी टेस्ट करें। यदि चक्र लगातार 35 दिनों से अधिक का रहता है या 2-3 महीने तक पीरियड नहीं आता, तो PCOS या थायरॉयड की जांच करवाएं।',
    keyPoints: [
      'Stress and cortisol delay the LH surge and ovulation, shifting the bleeding date.',
      'A 3 to 7 day cycle shift is usually within physiological variance.',
      'Home pregnancy testing is recommended 1–2 days after a missed expected period.',
      'Delays exceeding 60–90 days require an evaluation for PCOS, prolactin, or thyroid variations.',
    ],
    emergencyFlags: ['Positive pregnancy with severe pelvic pain or bleeding', 'Severe fainting episodes'],
  },
  {
    slug: 'acog-heavy-abnormal-periods',
    title: 'Heavy and Abnormal Periods (Menorrhagia)',
    organization: 'American College of Obstetricians and Gynecologists (ACOG)',
    url: 'https://www.acog.org/womens-health/faqs/heavy-and-abnormal-periods',
    topic: 'heavy_bleeding_flow',
    reviewStatus: 'reviewed',
    reviewDate: '2026-08-05',
    summaryEn:
      'Menorrhagia is defined clinically as menstrual blood loss exceeding 80 mL per cycle or bleeding lasting longer than 7 days. Key clinical warning indicators include needing to change a pad or tampon every hour for 2 or more consecutive hours, bleeding through clothes, needing double protection, or passing blood clots larger than a quarter (approx. 2.5 cm / golf ball size). Chronic heavy flow can lead to iron-deficiency anemia, causing fatigue and dizziness.',
    summaryHi:
      'यदि आपका पीरियड 7 दिनों से अधिक समय तक चलता है, हर 1-2 घंटे में पैड बदलना पड़ता है, या बड़े थक्के (golf-ball आकार के) निकलते हैं, तो इसे अत्यधिक रक्तस्राव (Menorrhagia) कहा जाता है। लंबे समय तक भारी रक्तस्राव शरीर में हीमोग्लोबिन कम करके एनीमिया और अत्यधिक थकान पैदा कर सकता है। इसकी डॉक्टर द्वारा जांच करानी चाहिए।',
    keyPoints: [
      'Changing pads every 1–2 hours consecutively is a key clinical sign of heavy bleeding.',
      'Blood clots larger than 2.5 cm require evaluation.',
      'Chronic heavy periods can cause iron deficiency anemia and extreme fatigue.',
      'Medical assessment includes full blood count, ferritin levels, and pelvic ultrasound.',
    ],
    emergencyFlags: [
      'Soaking through pads every hour with dizziness or fainting',
      'Sudden shortness of breath or extreme pallor',
    ],
  },
  {
    slug: 'nhs-periods',
    title: 'Periods (Menstruation Overview)',
    organization: 'National Health Service (NHS)',
    url: 'https://www.nhs.uk/conditions/periods/',
    topic: 'period_basics_cycle',
    reviewStatus: 'reviewed',
    reviewDate: '2026-09-12',
    summaryEn:
      'A period is part of the menstrual cycle in which the uterine lining sheds through the vagina. Most women lose about 30 to 40 mL of blood and tissue across their period. Tracking your cycle day, flow heaviness, and symptoms helps you understand your body’s unique baseline rhythm.',
    summaryHi:
      'माहवारी (पीरियड) महिला शरीर के प्राकृतिक मासिक चक्र का हिस्सा है जिसमें गर्भाशय की भीतरी परत रक्त और ऊतक के रूप में बाहर निकलती है। औसतन 30 से 40 मिलीलीटर रक्त निकलता है। अपने चक्र और लक्षणों को नियमित रूप से ट्रैक करने से शरीर के प्राकृतिक पैटर्न को समझने में मदद मिलती है।',
    keyPoints: [
      'Average cycle length is 28 days, but 21–35 days is considered healthy variance.',
      'Bleeding is typically heaviest during the first 2 days.',
      'Logging symptoms helps distinguish typical cyclical changes from atypical symptoms.',
    ],
    emergencyFlags: ['Bleeding lasting over 10 consecutive days'],
  },
  {
    slug: 'medlineplus-menstruation',
    title: 'Menstruation and Menstrual Disorders',
    organization: 'MedlinePlus / National Library of Medicine (NIH)',
    url: 'https://www.medlineplus.gov/menstruation.html',
    topic: 'menstruation_overview',
    reviewStatus: 'reviewed',
    reviewDate: '2026-05-30',
    summaryEn:
      'Menstruation is controlled by hormones including estrogen, progesterone, FSH, and LH. Menstrual disorders include amenorrhea (absence of periods), dysmenorrhea (painful periods), and abnormal uterine bleeding. Maintaining a balanced diet with iron, zinc, and B vitamins supports steady hormonal balance and red blood cell production.',
    summaryHi:
      'मासिक धर्म एस्ट्रोजेन और प्रोजेस्टेरोन जैसे हार्मोन्स द्वारा नियंत्रित होता है। समस्याओं में अमेनोरिया (पीरियड न आना), डिसमेनोरिया (दर्द), और असामान्य रक्तस्राव शामिल हैं। संतुलित आहार, पर्याप्त आयरन और विटामिन बी शरीर में हीमोग्लोबिन और हार्मोन संतुलन बनाए रखने में मदद करते हैं।',
    keyPoints: [
      'Hormonal fluctuations naturally impact energy, mood, and appetite during the cycle.',
      'Iron-rich nutrition (spinach, beans, dates, lean proteins) helps replenish lost red blood cells.',
      'Hydration and regular sleep help reduce premenstrual water retention.',
    ],
    emergencyFlags: ['Sudden severe lower abdominal pain', 'High fever during menstruation'],
  },
];

/**
 * Ensure curated sources are seeded into database
 */
async function ensureSourcesSeeded() {
  try {
    for (const source of CURATED_SOURCES) {
      const existing = await db.AiSource.findOne({ where: { slug: source.slug } });
      const payload = {
        slug: source.slug,
        title: source.title,
        organization: source.organization,
        url: source.url,
        topic: source.topic,
        reviewStatus: source.reviewStatus,
        reviewDate: source.reviewDate,
        summaryEn: source.summaryEn,
        summaryHi: source.summaryHi,
        keyPoints: JSON.stringify(source.keyPoints),
        emergencyFlags: JSON.stringify(source.emergencyFlags),
      };

      if (!existing) {
        await db.AiSource.create(payload);
      } else {
        await existing.update(payload);
      }
    }
  } catch (err) {
    // If DB is not ready in test or setup, fall back to in-memory CURATED_SOURCES
  }
}

/**
 * Retrieve curated medical sources matching query keywords and user concern
 */
function retrieveRelevantSources(query, options = {}) {
  const text = String(query || '').toLowerCase();
  const matched = [];

  const addIf = (slug, condition) => {
    if (condition && !matched.some((s) => s.slug === slug)) {
      const found = CURATED_SOURCES.find((s) => s.slug === slug);
      if (found) matched.push(found);
    }
  };

  // 1. Cramps / Pain
  const hasCramp = /cramp|pain|ache|hurt|spasm|pelvic|back pain|stomach ache|ऐंठन|दर्द|कष्ट/i.test(text);
  addIf('nhs-period-pain', hasCramp);
  addIf('acog-painful-periods', hasCramp);

  // 2. Late / Delay / Missed Period / Pregnancy question
  const hasDelay = /late|delay|miss|missed|pregnant|pregnancy|ovulat|cycle length|delay|लेट|देरी|रुका/i.test(text);
  addIf('nhs-period-problems', hasDelay);
  addIf('who-menstrual-health', hasDelay);

  // 3. Heavy Bleeding / Flow / Clots
  const hasHeavy = /heavy|clot|bleed|flow|soak|pad.*hour|quarter|खून|थक्के|भारी रक्तस्राव/i.test(text);
  addIf('acog-heavy-abnormal-periods', hasHeavy);
  addIf('nhs-period-problems', hasHeavy);

  // 4. PMS / Mood / Fatigue / Tiredness / Nutrition
  const hasPms = /tired|fatigue|exhaust|mood|cry|pms|sad|irritab|crav|sweet|food|थकान|कमजोरी|चिड़चिड़ा/i.test(text);
  addIf('medlineplus-menstruation', hasPms);
  addIf('who-menstrual-health', hasPms);

  // 5. General Menstrual hygiene & basics
  const hasGeneral = /period|menstrua|hygiene|care|doctor|when to see|माहवारी|पीरियड्स/i.test(text);
  addIf('who-menstrual-health', hasGeneral);
  addIf('nhs-periods', hasGeneral);

  // Default fallback if no specific topic was detected but it's a period question
  if (matched.length === 0) {
    matched.push(CURATED_SOURCES[0]); // WHO
    matched.push(CURATED_SOURCES[1]); // NHS Period pain
  }

  // Return formatted, citation-ready source metadata (only allowlisted fields, no private prompts)
  return matched.map((source) => ({
    id: source.slug,
    slug: source.slug,
    title: source.title,
    organization: source.organization,
    url: source.url,
    topic: source.topic,
    reviewStatus: source.reviewStatus,
    reviewDate: source.reviewDate,
    summary: options.language === 'hi' ? source.summaryHi : source.summaryEn,
    keyPoints: source.keyPoints,
  }));
}

/**
 * Validate that citation IDs strictly exist in the curated database
 */
function validateCitations(citationIds = []) {
  const valid = [];
  for (const id of citationIds) {
    const found = CURATED_SOURCES.find((s) => s.slug === id || s.title === id);
    if (found && !valid.some((v) => v.id === found.slug)) {
      valid.push({
        id: found.slug,
        title: found.title,
        organization: found.organization,
        url: found.url,
        reviewDate: found.reviewDate,
      });
    }
  }
  return valid;
}

module.exports = {
  CURATED_SOURCES,
  ensureSourcesSeeded,
  retrieveRelevantSources,
  validateCitations,
};
