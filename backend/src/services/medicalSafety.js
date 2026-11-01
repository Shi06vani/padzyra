/**
 * Padzyra Medical Safety & Emergency Escalation Engine
 * Independent deterministic screening layer grounded in clinical guidelines (ACOG, NHS, WHO).
 * Enforces strict medical boundaries (no diagnosis, no prescription) and immediate emergency escalation.
 */

const RED_FLAG_RULES = [
  {
    id: 'severe_acute_pelvic_pain',
    name: 'Severe or Sudden Acute Pelvic Pain',
    urgency: 'emergency',
    triggers: [
      /excruciating/i,
      /unbearable/i,
      /worst pain of my life/i,
      /severe (?:and|&) sudden/i,
      /sudden(?:ly)? (?:severe|sharp|extreme) (?:pelvic|abdominal|stomach|cramp)/i,
      /cannot (?:stand|walk|breathe) (?:due to|from) pain/i,
      /doubled over in (?:agony|pain)/i,
      /extreme sharp pain (?:on|in) (?:one side|right side|left side)/i,
      /असहनीय दर्द/i,
      /बहुत तेज दर्द/i,
      /अचानक तेज दर्द/i,
    ],
    escalationEn: {
      urgencyTitle: '⚠️ Immediate Medical Care Recommended',
      summary: 'Sudden, excruciating, or worsening severe pelvic/abdominal pain requires urgent medical evaluation to rule out conditions such as an ovarian cyst rupture, ovarian torsion, ectopic pregnancy, or appendicitis.',
      actionSteps: [
        'Seek emergency medical evaluation or visit the nearest emergency room without delay.',
        'If pain is accompanied by fever, vomiting, or dizziness, do not attempt to drive yourself.',
        'Do not take additional pain medication before being evaluated, as it may mask vital diagnostic signs.',
      ],
      helpline: 'Emergency Services: 112 / 108 (India) • 911 (US) • 999 (UK)',
    },
    escalationHi: {
      urgencyTitle: '⚠️ तत्काल आपातकालीन चिकित्सा सहायता लें',
      summary: 'अचानक उठा तीव्र, असहनीय या लगातार बढ़ता हुआ पेल्विक/पेट दर्द एक आपातकालीन संकेत हो सकता है। यह ओवेरियन सिस्ट फटने, टॉर्शन, एक्टोपिक प्रेग्नेंसी या अपेंडिसाइटिस का लक्षण हो सकता है।',
      actionSteps: [
        'बिना किसी देरी के नजदीकी अस्पताल के इमरजेंसी विभाग जाएं या आपातकालीन एम्बुलेंस (108 / 112) को कॉल करें।',
        'यदि दर्द के साथ उल्टी, चक्कर या तेज बुखार है, तो अकेले ड्राइव न करें।',
        'डॉक्टर की जांच से पहले स्वयं कोई भारी दर्द निवारक दवा न लें, ताकि सही जांच में बाधा न आए।',
      ],
      helpline: 'आपातकालीन सेवाएं: 112 / 108 (भारत) • 911 (US) • 999 (UK)',
    },
  },
  {
    id: 'heavy_bleeding_with_shock_signs',
    name: 'Heavy Menstrual Bleeding with Hypovolemic/Shock Symptoms',
    urgency: 'emergency',
    triggers: [
      /(?:soaking|filling|bleeding)(?: through)? (?:a |1 |2 |two )?(?:pad|tampon)s? (?:every|per|in an) hour/i,
      /(?:heavy|soaking) (?:bleeding|flow).*(?:dizzy|faint|pass out|passed out|black out|blacked out|breathless|short of breath|pale)/i,
      /(?:dizzy|faint|pass out|passed out|black out|blacked out).*(?:heavy|soaking) (?:bleeding|flow)/i,
      /(?:soaking|pad|tampon).*hour.*(?:dizzy|faint|pass out|passed out|black out|blacked out)/i,
      /(?:dizzy|faint|pass out|passed out|black out|blacked out).*(?:soaking|pad|tampon).*hour/i,
      /golf ball (?:size|sized)? clots/i,
      /large blood clots.*(?:dizzy|weak|faint)/i,
      /खून के बड़े थक्के.*चक्कर/i,
      /हर घंटे पैड भीगना.*चक्कर/i,
    ],
    escalationEn: {
      urgencyTitle: '⚠️ Urgent: Signs of Severe Blood Loss',
      summary: 'Soaking through one or more sanitary pads/tampons every hour for two or more consecutive hours, especially when accompanied by dizziness, weakness, fainting, or shortness of breath, indicates potentially acute blood loss (severe menorrhagia).',
      actionSteps: [
        'Go to the nearest emergency department or call emergency services immediately.',
        'Lie down with your legs slightly elevated to help maintain cerebral blood circulation.',
        'Track approximately how many pads have been fully soaked and note the approximate size of blood clots.',
      ],
      helpline: 'Emergency Services: 112 / 108 (India) • 911 (US) • 999 (UK)',
    },
    escalationHi: {
      urgencyTitle: '⚠️ तत्काल: अत्यधिक रक्तस्राव और कमजोरी के संकेत',
      summary: 'लगातार 2 घंटे या अधिक समय तक हर घंटे पैड पूरी तरह भीग जाना और साथ में चक्कर आना, बेहोशी या अत्यधिक कमजोरी महसूस होना अत्यधिक रक्तस्राव का संकेत है।',
      actionSteps: [
        'तुरंत आपातकालीन चिकित्सा सहायता (108 / 112) लें या नजदीकी अस्पताल जाएं।',
        'पैरों को थोड़ा ऊपर उठाकर लेटें ताकि मस्तिष्क में रक्त प्रवाह बना रहे।',
        'डॉक्टर को बताने के लिए ध्यान रखें कि कितने पैड भीगे हैं और क्या बड़े थक्के आ रहे हैं।',
      ],
      helpline: 'आपातकालीन सेवाएं: 112 / 108 (भारत) • 911 (US) • 999 (UK)',
    },
  },
  {
    id: 'pregnancy_with_pain_or_bleeding',
    name: 'Possible Pregnancy with Pain or Vaginal Bleeding',
    urgency: 'emergency',
    triggers: [
      /(?:pregnant|positive (?:pregnancy )?test|missed period).*(?:sharp pain|severe pain|bleeding|spotting|shoulder pain)/i,
      /(?:bleeding|spotting|sharp pain|severe pain).*(?:pregnant|positive (?:pregnancy )?test)/i,
      /गर्भवती.*(?:दर्द|खून|रक्तस्राव)/i,
      /प्रेग्नेंट.*(?:दर्द|ब्लडिंग)/i,
    ],
    escalationEn: {
      urgencyTitle: '⚠️ Urgent: Pregnancy Pain or Bleeding Evaluation',
      summary: 'Any positive or suspected pregnancy accompanied by severe abdominal/pelvic pain, one-sided cramping, fainting, or vaginal bleeding must be clinically evaluated immediately to rule out an ectopic pregnancy (a fertilized egg implanting outside the uterus).',
      actionSteps: [
        'Contact your obstetrician/gynecologist or visit an emergency room immediately.',
        'Inform the triage staff that you are or might be pregnant and are experiencing pelvic pain or bleeding.',
        'Ectopic pregnancy is a medical emergency that requires timely clinical imaging (ultrasound) and care.',
      ],
      helpline: 'Emergency Services: 112 / 108 (India) • 911 (US) • 999 (UK)',
    },
    escalationHi: {
      urgencyTitle: '⚠️ तत्काल: गर्भावस्था में दर्द या रक्तस्राव की जांच',
      summary: 'यदि आप गर्भवती हैं या गर्भावस्था की संभावना है, और आपको पेट के एक तरफ तेज दर्द, ऐंठन या रक्तस्राव हो रहा है, तो तुरंत एक्टोपिक प्रेग्नेंसी (गर्भाशय के बाहर भ्रूण ठहरना) की जांच करानी जरूरी है।',
      actionSteps: [
        'तुरंत अपने स्त्री रोग विशेषज्ञ (Gynecologist) या नजदीकी आपातकालीन अस्पताल जाएं।',
        'अस्पताल पहुंचते ही बताएं कि आप गर्भवती हैं और दर्द या रक्तस्राव हो रहा है।',
        'यह एक अतिसंवेदनशील स्थिति है जिसकी पुष्टि केवल क्लिनिकल अल्ट्रासाउंड से ही हो सकती है।',
      ],
      helpline: 'आपातकालीन सेवाएं: 112 / 108 (भारत) • 911 (US) • 999 (UK)',
    },
  },
  {
    id: 'infection_or_toxic_shock_warning',
    name: 'Signs of Severe Pelvic Infection or Toxic Shock Syndrome',
    urgency: 'emergency',
    triggers: [
      /(?:tampon|menstrual cup).*(?:high fever|vomiting|diarrhea|rash|faint)/i,
      /(?:high fever|chills|vomiting).*(?:tampon|menstrual cup)/i,
      /(?:foul smelling|bad odor|pungent) (?:discharge|fluid).*(?:fever|pelvic pain|cramps)/i,
      /(?:fever|chills).*(?:severe pelvic pain|foul discharge)/i,
      /तेज बुखार.*(?:टैम्पोन|बदबूदार स्राव|पेल्विक दर्द)/i,
    ],
    escalationEn: {
      urgencyTitle: '⚠️ Urgent: Signs of Infection / Toxic Shock Warning',
      summary: 'Sudden high fever, chills, vomiting, diarrhea, sunburn-like rash, or dizziness while using tampons or a menstrual cup can indicate Toxic Shock Syndrome (TSS). Foul-smelling vaginal discharge with pelvic pain and fever can indicate pelvic inflammatory disease (PID).',
      actionSteps: [
        'If currently wearing a tampon or menstrual cup, remove it immediately.',
        'Seek urgent same-day medical evaluation at an emergency clinic or hospital.',
        'Inform your doctor that you were using an internal menstrual product and are experiencing high fever or systemic symptoms.',
      ],
      helpline: 'Emergency Services: 112 / 108 (India) • 911 (US) • 999 (UK)',
    },
    escalationHi: {
      urgencyTitle: '⚠️ तत्काल: गंभीर संक्रमण / टॉक्सिक शॉक सिंड्रोम चेतावनी',
      summary: 'टैम्पोन या मेंस्ट्रुअल कप के उपयोग के दौरान अचानक तेज बुखार, उल्टी, दस्त, त्वचा पर लाल चकत्ते या चक्कर आना टॉक्सिक शॉक सिंड्रोम (TSS) का संकेत हो सकता है। बदबूदार स्राव और बुखार पेल्विक इन्फेक्शन (PID) हो सकता है।',
      actionSteps: [
        'यदि आपने टैम्पोन या मेंस्ट्रुअल कप लगाया हुआ है, तो उसे तुरंत निकालें और पैड का प्रयोग करें।',
        'बिना देर किए तुरंत डॉक्टर या आपातकालीन क्लिनिक में दिखाएं।',
        'डॉक्टर को बताएं कि आप इंटरनल मेंस्ट्रुअल प्रोडक्ट का उपयोग कर रहे थे और तेज बुखार है।',
      ],
      helpline: 'आपातकालीन सेवाएं: 112 / 108 (भारत) • 911 (US) • 999 (UK)',
    },
  },
];

/**
 * Deterministic boundaries detection (Diagnosis / Prescription blocks)
 */
const BOUNDARY_PATTERNS = {
  prescription: [
    /(?:how many|what) (?:mg|mgs|dose|dosage|tablets?|pills?)/i,
    /(?:prescribe|give me) (?:medicine|pills?|antibiotic|medication)/i,
    /(?:should I take|can I take) \d+\s*(?:mg|ml)/i,
    /(?:meftal|ibuprofen|paracetamol|combiflam|drotaverine)\s*(?:dose|dosage|\d+mg)/i,
    /दवा की खुराक|कितनी गोली लूँ|दवा लिखो/i,
  ],
  diagnosis: [
    /(?:do I have|diagnose me with) (?:pcos|pcod|endometriosis|adenomyosis|cancer|fibroids|anemia)/i,
    /(?:am I|could I be) (?:pregnant|infertile)/i,
    /tell me (?:what disease|what condition) I have/i,
    /क्या मुझे pcos है|क्या मुझे एंडोमेट्रियोसिस है|मेरी बीमारी बताओ/i,
  ],
};

function checkMedicalSafety(query, options = {}) {
  const text = String(query || '').trim();
  const lang = options.language === 'hi' ? 'hi' : 'en';

  const detectedFlags = [];
  let highestUrgency = 'normal';
  let primaryEscalation = null;

  for (const rule of RED_FLAG_RULES) {
    const isMatched = rule.triggers.some((trigger) => trigger.test(text));
    if (isMatched) {
      detectedFlags.push(rule.id);
      highestUrgency = 'emergency';
      if (!primaryEscalation) {
        primaryEscalation = lang === 'hi' ? rule.escalationHi : rule.escalationEn;
      }
    }
  }

  // Check boundaries
  let prescriptionGuard = false;
  for (const pattern of BOUNDARY_PATTERNS.prescription) {
    if (pattern.test(text)) {
      prescriptionGuard = true;
      break;
    }
  }

  let diagnosisGuard = false;
  for (const pattern of BOUNDARY_PATTERNS.diagnosis) {
    if (pattern.test(text)) {
      diagnosisGuard = true;
      break;
    }
  }

  return {
    isEmergency: detectedFlags.length > 0,
    urgency: highestUrgency,
    redFlags: detectedFlags,
    primaryEscalation,
    prescriptionGuard,
    diagnosisGuard,
  };
}

module.exports = {
  RED_FLAG_RULES,
  checkMedicalSafety,
};
