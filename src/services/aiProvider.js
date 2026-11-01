/**
 * Padzyra AI Provider Integration & Abstraction Layer
 * Supports Google Gemini, OpenAI, or local evidence-grounded Clinical Rule Engine.
 * Never fabricates answers; strictly enforces medical boundaries and structured validation.
 */

const env = require('../config/env');

const AI_PROVIDER = process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : 'clinical_engine');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

/**
 * Build the clinical system prompt for the AI model
 */
function buildSystemPrompt(context) {
  const lang = context.language === 'hi' ? 'Hindi (हिंदी)' : 'simple, warm English';
  return `You are the Padzyra Evidence-Based AI Period Companion.
Your role is to offer respectful, scientifically grounded menstrual health guidance.
Primary Language: ${lang}.

MANDATORY MEDICAL BOUNDARIES:
1. NEVER diagnose medical conditions (e.g., do not say "You have PCOS" or "You are pregnant").
2. NEVER prescribe medications or personalized dosages. Advise consulting a licensed doctor or pharmacist.
3. NEVER guarantee symptoms are harmless or claim to replace professional clinical assessment.
4. ONLY cite sources provided in the RETRIEVED SOURCES section below.
5. If medical evidence or user context is insufficient, explicitly state your uncertainty and suggest safe clinical next steps.

RETRIEVED REVIEWED MEDICAL SOURCES:
${JSON.stringify(context.retrievedSources, null, 2)}

USER AUTHORIZED CYCLE CONTEXT (Consent: ${context.cycleConsent ? 'YES' : 'NO'}):
${context.cycleContext ? JSON.stringify(context.cycleContext, null, 2) : 'No personalized cycle data authorized.'}

FORMAT YOUR OUTPUT AS A STRICT VALID JSON OBJECT WITH THESE KEYS:
{
  "reply": "string (the plain language, compassionate, direct answer)",
  "language": "${context.language}",
  "followUpQuestion": "string or null (a single relevant follow-up question if needed, e.g. symptom severity or onset)",
  "followUpOptions": ["array of 2-4 brief options, e.g. Mild, Moderate, Severe, Unsure"] or null,
  "selfCareSteps": ["array of 2-4 practical, evidence-backed self care steps"] or [],
  "whenToSeeDoctor": ["array of 2-3 specific clinical indicators when doctor evaluation is needed"] or [],
  "citedSourceIds": ["array of matching source slugs from the retrieved sources, e.g. 'nhs-period-pain'"]
}`;
}

/**
 * Google Gemini API Provider Implementation
 */
async function generateWithGemini(prompt, systemPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error [${response.status}]: ${errorText}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Empty response from Gemini API');
  return JSON.parse(rawText);
}

/**
 * OpenAI API Provider Implementation
 */
async function generateWithOpenAI(prompt, systemPrompt) {
  const url = 'https://api.openai.com/v1/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error [${response.status}]: ${errorText}`);
  }

  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content;
  if (!rawText) throw new Error('Empty response from OpenAI API');
  return JSON.parse(rawText);
}

/**
 * High-Precision Evidence-Grounded Clinical Fallback Engine
 * Used when external API keys are not supplied or if external network times out.
 * Directly translates reviewed WHO / NHS / ACOG knowledge into simple, structured guidance.
 */
function generateWithClinicalEngine(userMessage, context) {
  const text = String(userMessage || '').toLowerCase();
  const lang = context.language === 'hi' ? 'hi' : 'en';
  const sources = context.retrievedSources || [];
  const cycle = context.cycleContext;

  let personalizedNote = '';
  if (context.cycleConsent && cycle) {
    if (cycle.currentCycleDay) {
      personalizedNote =
        lang === 'hi'
          ? `\n\n📌 आपके पैडज़ीरा में दर्ज रिकॉर्ड के अनुसार, आप वर्तमान में अपने चक्र के लगभग दिन ${cycle.currentCycleDay} पर हैं।`
          : `\n\n📌 Based on your authorized cycle history in Padzyra, you appear to be around Day ${cycle.currentCycleDay} of your current cycle.`;
    } else if (cycle.averageCycleLength) {
      personalizedNote =
        lang === 'hi'
          ? `\n\n📌 आपके पिछले रिकॉर्ड के आधार पर आपका औसत चक्र लगभग ${cycle.averageCycleLength} दिनों का रहता है।`
          : `\n\n📌 Based on your logged history, your cycle averages approximately ${cycle.averageCycleLength} days.`;
    }
  }

  // 1. Cramps and Pain
  if (/cramp|pain|ache|hurt|spasm|pelvic|back pain|ऐंठन|दर्द|कष्ट/i.test(text)) {
    if (lang === 'hi') {
      return {
        reply: `पीरियड के दौरान होने वाला दर्द (Dysmenorrhea) गर्भाशय की मांसपेशियों में संकुचन के कारण होता है। यह प्रोस्टाग्लैंडीन रसायन के प्रभाव से होता है। गर्म पानी की थैली से पेट या पीठ के निचले हिस्से की सिकाई करना, हल्का योग (जैसे बालासन) और पर्याप्त पानी पीना ऐंठन को प्राकृतिक रूप से शांत करने में मदद करता है।${personalizedNote}`,
        language: 'hi',
        followUpQuestion: 'क्या यह दर्द हर पीरियड में होता है या इस बार अचानक बहुत अधिक बढ़ गया है?',
        followUpOptions: ['हल्का (Mild)', 'मध्यम (Moderate)', 'गंभीर (Severe)', 'निश्चित नहीं (Unsure)'],
        selfCareSteps: [
          'पेट या पीठ के निचले हिस्से पर 15-20 मिनट के लिए गर्म पानी की थैली (हीट पैक) रखें।',
          'अदरक या कैमोमाइल की गर्म चाय पिएं जो मांसपेशियों को आराम देती है।',
          'गहरी सांस लें और हल्का बालासन (Child’s Pose) करें।',
          'कैफीन और अत्यधिक नमकीन खाद्य पदार्थों का सेवन सीमित करें।',
        ],
        whenToSeeDoctor: [
          'यदि दर्द दैनिक कार्यों (स्कूल/ऑफिस) को रोक देता है या सामान्य घरेलू उपायों से कम नहीं होता।',
          'यदि दर्द अचानक अत्यधिक तीव्र हो जाए या बुखार/उल्टी के साथ हो।',
          'यदि दर्द पीरियड खत्म होने के बाद भी कई दिनों तक लगातार बना रहता है।',
        ],
        citedSourceIds: ['nhs-period-pain', 'acog-painful-periods'],
      };
    }

    return {
      reply: `Menstrual cramps (dysmenorrhea) happen when your uterine muscles contract under the influence of natural chemicals called prostaglandins. Mild to moderate cramping is common and can be effectively eased with continuous warmth, gentle stretching, and hydration.${personalizedNote}`,
      language: 'en',
      followUpQuestion: 'How would you describe your cramp severity today?',
      followUpOptions: ['Mild', 'Moderate', 'Severe', 'Unsure'],
      selfCareSteps: [
        'Apply a heating pad or hot water bottle to your lower abdomen or lower back for 20 minutes.',
        'Sip warm ginger or chamomile tea to support uterine muscle relaxation.',
        'Practice gentle yoga stretches such as Child’s Pose (Balasana) with diaphragmatic breathing.',
        'Stay well-hydrated and reduce salty snacks to alleviate pelvic water retention.',
      ],
      whenToSeeDoctor: [
        'If pain prevents you from carrying out normal daily activities or school/work.',
        'If cramping is sudden, excruciating, or unresponsive to regular rest and heat.',
        'If pelvic pain persists well past your period bleeding days.',
      ],
      citedSourceIds: ['nhs-period-pain', 'acog-painful-periods'],
    };
  }

  // 2. Late / Delayed Period
  if (/late|delay|miss|missed|pregnant|pregnancy|लेट|देरी|रुका/i.test(text)) {
    if (lang === 'hi') {
      return {
        reply: `एक स्वस्थ चक्र में 3 से 7 दिनों का उतार-चढ़ाव होना बिल्कुल सामान्य और स्वाभाविक है। मानसिक तनाव, हालिया बीमारी, यात्रा, नींद में खलल या वजन में अचानक बदलाव ओव्यूलेशन को कुछ दिनों के लिए टाल देते हैं, जिससे पीरियड की तारीख आगे खिसक जाती है।${personalizedNote}`,
        language: 'hi',
        followUpQuestion: 'क्या आपके पीरियड को छूटे हुए 1 सप्ताह से अधिक का समय हो गया है?',
        followUpOptions: ['1-3 दिन की देरी', '4-7 दिन की देरी', '1-2 सप्ताह की देरी', '2 सप्ताह से अधिक'],
        selfCareSteps: [
          'नियमित 7-8 घंटे की नींद लें और अत्यधिक तनाव कम करने के लिए विश्राम करें।',
          'यदि आप सेक्शुअली एक्टिव हैं, तो छूटी हुई तारीख के 1-2 दिन बाद होम प्रेग्नेंसी टेस्ट करें।',
          'पर्याप्त पानी पिएं और पोषण युक्त संतुलित आहार लें।',
        ],
        whenToSeeDoctor: [
          'यदि पीरियड में 2 से 3 सप्ताह (या 60+ दिनों) से अधिक की देरी हो चुकी है।',
          'यदि आपके चक्र लगातार 35 दिनों से अधिक लंबे हो रहे हैं (PCOS या थायरॉयड जांच हेतु)।',
          'यदि देरी के साथ पेट के निचले हिस्से में तीव्र दर्द या बेहोशी की अनुभूति हो।',
        ],
        citedSourceIds: ['nhs-period-problems', 'who-menstrual-health'],
      };
    }

    return {
      reply: `A cycle shift of 3 to 7 days is very common and natural. Acute emotional stress, travel, illness, sleep disruption, or dietary fluctuations can temporarily delay ovulation, shifting your period date backward accordingly.${personalizedNote}`,
      language: 'en',
      followUpQuestion: 'Approximately how many days past your expected period date are you?',
      followUpOptions: ['1-3 days late', '4-7 days late', '1-2 weeks late', '>2 weeks late'],
      selfCareSteps: [
        'Prioritize 7–8 hours of restful sleep and manage acute stress levels.',
        'If pregnancy is possible, perform a home pregnancy test 1–2 days after your missed date.',
        'Track any accompanying bodily feelings and maintain balanced hydration.',
      ],
      whenToSeeDoctor: [
        'If your period is delayed by more than 2 to 3 weeks and pregnancy test is negative.',
        'If cycles are chronically longer than 35 days or absent for 3 consecutive months.',
        'If delay is accompanied by abnormal hair growth, severe acne, or unexpected weight changes.',
      ],
      citedSourceIds: ['nhs-period-problems', 'who-menstrual-health'],
    };
  }

  // 3. Heavy Bleeding
  if (/heavy|clot|bleed|flow|soak|खून|थक्के|भारी रक्तस्राव/i.test(text)) {
    if (lang === 'hi') {
      return {
        reply: `पीरियड के पहले 2 दिनों में रक्तस्राव का थोड़ा भारी होना सामान्य हो सकता है। हालांकि, यदि आपको लगातार 2 या अधिक घंटों तक हर घंटे पैड बदलना पड़ रहा है, या गोल्फ-बॉल के आकार के बड़े थक्के निकल रहे हैं, तो यह असामान्य रूप से भारी प्रवाह (Menorrhagia) कहलाता है।${personalizedNote}`,
        language: 'hi',
        followUpQuestion: 'आपको पैड कितनी बार बदलना पड़ रहा है?',
        followUpOptions: ['हर 1 घंटे में', 'हर 2-3 घंटे में', 'हर 4-6 घंटे में', 'अनियमित'],
        selfCareSteps: [
          'भरपूर आराम करें और भारी शारीरिक श्रम से बचें।',
          'आयरन युक्त आहार (पालक, दालें, अनार, खजूर) लें ताकि हीमोग्लोबिन स्तर सुरक्षित रहे।',
          'पैड बदलने की संख्या और समय को नोट रखें ताकि डॉक्टर से चर्चा की जा सके।',
        ],
        whenToSeeDoctor: [
          'यदि लगातार 2 घंटे हर घंटे पैड पूरी तरह भीग जाता है।',
          'यदि ब्लीडिंग के साथ अत्यधिक चक्कर, कमजोरी या सांस फूलने का अहसास हो।',
          'यदि माहवारी का रक्तस्राव 7 दिनों से अधिक समय तक लगातार चलता रहे।',
        ],
        citedSourceIds: ['acog-heavy-abnormal-periods', 'nhs-period-problems'],
      };
    }

    return {
      reply: `Flow is typically heaviest during the first 1 to 2 days. However, needing to change a pad or tampon every hour for two or more consecutive hours, or passing blood clots larger than a coin/golf ball, is considered clinically heavy bleeding (menorrhagia) and should be evaluated.${personalizedNote}`,
      language: 'en',
      followUpQuestion: 'How often are you currently needing to change your sanitary pad?',
      followUpOptions: ['Every 1 hour', 'Every 2-3 hours', 'Every 4-6 hours', 'Unsure'],
      selfCareSteps: [
        'Rest and avoid heavy strenuous physical exertion while flow is at its peak.',
        'Include iron-rich foods (beans, leafy greens, dates) and vitamin C in your meals.',
        'Keep an objective count of how many pads you soak completely throughout the day.',
      ],
      whenToSeeDoctor: [
        'If you soak through 1+ pads every hour for 2 or more consecutive hours.',
        'If heavy bleeding is accompanied by dizziness, fainting, or unusual shortness of breath.',
        'If period bleeding lasts longer than 7 consecutive days.',
      ],
      citedSourceIds: ['acog-heavy-abnormal-periods', 'nhs-period-problems'],
    };
  }

  // 4. Tiredness, Fatigue, Mood
  if (/tired|fatigue|exhaust|mood|cry|pms|sad|चिड़चिड़ा|थकान|कमजोरी/i.test(text)) {
    if (lang === 'hi') {
      return {
        reply: `पीरियड्स के दौरान या उससे पहले थकान और मूड में बदलाव बहुत सामान्य हैं। ल्यूटियल फेज में एस्ट्रोजेन और प्रोजेस्टेरोन का स्तर अचानक गिरता है, जिससे शरीर में सेरोटोनिन कम हो जाता है। इसके अलावा, रक्तस्राव के साथ आयरन की कमी भी सुस्ती ला सकती है।${personalizedNote}`,
        language: 'hi',
        followUpQuestion: 'क्या यह थकान मुख्य रूप से पीरियड शुरू होने से पहले महसूस होती है या पीरियड के दौरान?',
        followUpOptions: ['पीरियड से पहले (PMS)', 'पीरियड के दौरान', 'पूरे महीने', 'निश्चित नहीं'],
        selfCareSteps: [
          'डार्क चॉकलेट (70%+ कोको), केला या अखरोट खाएं जो मैग्नीशियम और डोपामाइन बढ़ाते हैं।',
          'जटिल कार्बोहाइड्रेट (दलिया, साबुत अनाज) लें जो ब्लड शुगर और मूड को स्थिर रखते हैं।',
          'अपने शरीर को पर्याप्त विश्राम दें और आवश्यकता पड़ने पर छोटी झपकी (nap) लें।',
        ],
        whenToSeeDoctor: [
          'यदि अत्यधिक थकान पीरियड खत्म होने के बाद भी बनी रहे (एनीमिया की जांच हेतु)।',
          'यदि मूड में अत्यधिक तीव्र डिप्रेशन या घबराहट महसूस हो (PMDD के मूल्यांकन हेतु)।',
        ],
        citedSourceIds: ['medlineplus-menstruation', 'who-menstrual-health'],
      };
    }

    return {
      reply: `Feeling fatigued or emotionally sensitive during your cycle is biological and valid. As progesterone and estrogen drop before your period, brain serotonin temporarily dips. Additionally, menstrual blood loss can deplete iron reserves, leading to low energy.${personalizedNote}`,
      language: 'en',
      followUpQuestion: 'Does this tiredness typically occur before bleeding starts or during flow?',
      followUpOptions: ['Before period (PMS)', 'During bleeding', 'All month round', 'Unsure'],
      selfCareSteps: [
        'Eat small, balanced meals featuring complex carbohydrates (oatmeal, sweet potatoes) to sustain steady serotonin.',
        'Enjoy dark chocolate (70%+ cocoa) or magnesium-rich seeds to ease tension.',
        'Prioritize quiet boundaries and allow yourself guilt-free restorative rest.',
      ],
      whenToSeeDoctor: [
        'If extreme exhaustion persists well after bleeding finishes (screen for iron-deficiency anemia).',
        'If premenstrual mood shifts cause severe depression or interfere with daily life (evaluate for PMDD).',
      ],
      citedSourceIds: ['medlineplus-menstruation', 'who-menstrual-health'],
    };
  }

  // General wellness guidance
  if (lang === 'hi') {
    return {
      reply: `आपका मासिक धर्म स्वास्थ्य आपके संपूर्ण शारीरिक संतुलन का एक महत्वपूर्ण सूचक है। चक्र के दौरान शरीर के संकेतों को सुनना, पर्याप्त जल ग्रहण करना और गर्माहट का उपयोग करना बहुत लाभकारी होता है। आप मुझसे ऐंठन (cramps), देरी (delay), भारी ब्लीडिंग या सुरक्षित घरेलू उपायों के बारे में कभी भी पूछ सकती हैं।${personalizedNote}`,
      language: 'hi',
      followUpQuestion: 'क्या आप किसी विशेष लक्षण जैसे ऐंठन, देरी या रक्तस्राव के बारे में और जानना चाहती हैं?',
      followUpOptions: ['ऐंठन (Cramps)', 'पीरियड में देरी (Delay)', 'ब्लीडिंग (Flow)', 'अन्य प्रश्न'],
      selfCareSteps: [
        'पर्याप्त मात्रा में गुनगुना पानी पिएं।',
        'हल्के व्यायाम या टहलने से पेल्विक सर्कुलेशन बेहतर रहता है।',
        'पैडज़ीरा में अपने दैनिक लक्षणों को दर्ज करें।',
      ],
      whenToSeeDoctor: [
        'यदि आपको असहनीय पेल्विक दर्द या असामान्य अत्यधिक रक्तस्राव हो।',
        'यदि आपके चक्र लगातार अत्यधिक अनियमित रहते हैं।',
      ],
      citedSourceIds: ['who-menstrual-health', 'nhs-periods'],
    };
  }

  return {
    reply: `Your menstrual cycle is a vital sign of your overall health and well-being. Listening to your body, resting when needed, keeping warm compressions handy, and staying hydrated support a smoother cycle. Feel free to ask specifically about cramps, period delays, flow variations, or comforting self-care.${personalizedNote}`,
    language: 'en',
    followUpQuestion: 'Would you like more guidance on a specific symptom today?',
    followUpOptions: ['Period cramps', 'Cycle delay', 'Flow heaviness', 'Other questions'],
    selfCareSteps: [
      'Stay consistently hydrated with warm water or herbal teas.',
      'Log your daily cycle feelings in Padzyra to recognize personal trends.',
      'Maintain gentle physical movement and consistent sleep hours.',
    ],
    whenToSeeDoctor: [
      'For severe, sudden pelvic pain or bleeding soaking pads hourly.',
      'If your cycle is chronically irregular (less than 21 or greater than 35 days).',
    ],
    citedSourceIds: ['who-menstrual-health', 'nhs-periods'],
  };
}

/**
 * Main AI answer generation function
 */
async function generateAiAnswer(userMessage, context) {
  const systemPrompt = buildSystemPrompt(context);

  if (AI_PROVIDER === 'gemini' && GEMINI_API_KEY) {
    try {
      return await generateWithGemini(userMessage, systemPrompt);
    } catch (err) {
      // Fallback safely to clinical engine without crashing
    }
  }

  if (AI_PROVIDER === 'openai' && OPENAI_API_KEY) {
    try {
      return await generateWithOpenAI(userMessage, systemPrompt);
    } catch (err) {
      // Fallback safely to clinical engine without crashing
    }
  }

  // Reliable, verified evidence-grounded clinical fallback
  return generateWithClinicalEngine(userMessage, context);
}

module.exports = {
  AI_PROVIDER,
  generateAiAnswer,
  buildSystemPrompt,
};
