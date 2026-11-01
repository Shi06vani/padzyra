/**
 * Padzyra AI Companion Master Service
 * Coordinates:
 * - Request validation & ownership checks
 * - Consent-gated cycle & symptom history extraction
 * - Curated medical evidence retrieval (WHO, NHS, ACOG, MedlinePlus)
 * - Independent deterministic safety screening & emergency escalation
 * - AI answer generation & citation validation
 * - Secure persistence and backward compatibility
 */

const db = require('../models');
const HttpError = require('../utils/httpError');
const { checkMedicalSafety } = require('./medicalSafety');
const {
  retrieveRelevantSources,
  validateCitations,
  CURATED_SOURCES,
} = require('./medicalKnowledge');
const { generateAiAnswer } = require('./aiProvider');
const { loadCycles, buildState } = require('./state');
const daysService = require('./days');

const MAX_MESSAGE_LENGTH = 1000;

/**
 * Safely retrieve authorized minimal cycle context for the user
 */
async function getAuthorizedCycleContext(user) {
  if (!user) return null;

  try {
    const state = await buildState(user);
    const cycles = await loadCycles(user.id);

    let currentCycleDay = null;
    let periodStartedAt = null;

    if (state && state.open) {
      currentCycleDay = state.open.day || 1;
      periodStartedAt = state.open.start;
    } else if (cycles && cycles.length > 0) {
      const latest = cycles[0];
      periodStartedAt = latest.start;
      if (latest.start) {
        const diffMs = Date.now() - new Date(latest.start).getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
        if (diffDays >= 1 && diffDays <= 90) {
          currentCycleDay = diffDays;
        }
      }
    }

    // Retrieve recent symptom days
    let recentSymptoms = [];
    try {
      const recentLogs = await daysService.list(user);
      recentSymptoms = (recentLogs || []).slice(0, 5).map((l) => ({
        date: l.date,
        cramps: l.cramps || null,
        mood: l.mood || null,
      }));
    } catch {
      // ignore
    }

    return {
      currentCycleDay,
      lastPeriodStart: periodStartedAt,
      averageCycleLength: user.cycleLength || 28,
      typicalPeriodLength: user.periodLength || 5,
      recentSymptoms,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Main chat handler for the AI companion
 */
async function chat(user, body = {}) {
  const rawMessage = String(body.message || '').trim();
  if (!rawMessage) {
    throw new HttpError(400, 'Message is required');
  }
  if (rawMessage.length > MAX_MESSAGE_LENGTH) {
    throw new HttpError(400, `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
  }

  const requestedLanguage = body.language === 'hi' ? 'hi' : 'en';
  const explicitCycleConsent = Boolean(body.useCycleHistory);

  // 1. Verify / initialize conversation
  let conversation = null;
  if (body.conversationId) {
    conversation = await db.AiConversation.findByPk(body.conversationId);
    if (!conversation) {
      throw new HttpError(404, 'Conversation not found');
    }
    // Verify ownership if conversation is bound to a user
    if (conversation.userId && (!user || conversation.userId !== user.id)) {
      throw new HttpError(403, 'Unauthorized conversation access');
    }
  } else {
    // Generate brief title from first message
    const snippet = rawMessage.slice(0, 40).replace(/[\r\n]+/g, ' ');
    conversation = await db.AiConversation.create({
      userId: user ? user.id : null,
      title: snippet.length >= 3 ? snippet : 'Consultation',
      language: requestedLanguage,
      useCycleHistory: explicitCycleConsent,
    });
  }

  // 2. Load minimal authorized cycle context
  let cycleContext = null;
  if (explicitCycleConsent && user) {
    cycleContext = await getAuthorizedCycleContext(user);
  }

  // 3. Independent medical safety screening
  const safetyAssessment = checkMedicalSafety(rawMessage, {
    language: requestedLanguage,
  });

  // 4. Retrieve curated medical evidence
  const retrievedSources = retrieveRelevantSources(rawMessage, {
    language: requestedLanguage,
  });

  // 5. Generate evidence-grounded AI answer
  let aiOutput = null;

  if (safetyAssessment.isEmergency && safetyAssessment.primaryEscalation) {
    // Immediate deterministic emergency escalation
    const esc = safetyAssessment.primaryEscalation;
    aiOutput = {
      reply: `${esc.urgencyTitle}\n\n${esc.summary}\n\n${esc.helpline}`,
      language: requestedLanguage,
      followUpQuestion: null,
      followUpOptions: null,
      selfCareSteps: [],
      whenToSeeDoctor: esc.actionSteps,
      citedSourceIds: ['acog-painful-periods', 'acog-heavy-abnormal-periods', 'nhs-period-pain'],
    };
  } else if (safetyAssessment.prescriptionGuard) {
    // Boundaries: Medication dosage block
    const msg =
      requestedLanguage === 'hi'
        ? 'मैं एक AI साथी हूँ और किसी भी दवा का नाम या सटीक खुराक (dosage) निर्धारित नहीं कर सकता। दर्द निवारक या किसी भी दवा के सुरक्षित उपयोग के लिए कृपया अपने डॉक्टर या लाइसेंस प्राप्त फार्मासिस्ट से परामर्श लें।'
        : 'I cannot prescribe specific medication dosages or tell you to start or change pharmaceuticals. Please consult a qualified pharmacist or gynecologist for individualized dosing tailored to your medical history.';
    aiOutput = {
      reply: msg,
      language: requestedLanguage,
      followUpQuestion: null,
      followUpOptions: null,
      selfCareSteps: [
        requestedLanguage === 'hi'
          ? 'पेट पर गर्म पानी की थैली रखें।'
          : 'Apply continuous heat to your abdomen.',
      ],
      whenToSeeDoctor: [
        requestedLanguage === 'hi'
          ? 'दवा की सही खुराक के लिए डॉक्टर या फार्मासिस्ट से बात करें।'
          : 'Consult your doctor or pharmacist for safe, personalized medication advice.',
      ],
      citedSourceIds: ['nhs-period-pain'],
    };
  } else if (safetyAssessment.diagnosisGuard) {
    // Boundaries: Diagnosis block
    const msg =
      requestedLanguage === 'hi'
        ? 'मैं सीधे किसी बीमारी (जैसे PCOS या एंडोमेट्रियोसिस) का मेडिकल डायग्नोसिस नहीं कर सकता। इसकी सटीक पुष्टि केवल क्लिनिकल परीक्षणों (जैसे पेल्विक अल्ट्रासाउंड और ब्लड टेस्ट) से हो सकती है। आप अपने लक्षणों को पैडज़ीरा में नोट करके डॉक्टर से परामर्श ले सकती हैं।'
        : 'I cannot clinically diagnose medical conditions such as PCOS, endometriosis, or pregnancy. A definitive diagnosis requires in-person medical evaluation, imaging (such as ultrasound), and lab testing. I can help you record your symptoms so you have clear information to share with your gynecologist.';
    aiOutput = {
      reply: msg,
      language: requestedLanguage,
      followUpQuestion:
        requestedLanguage === 'hi'
          ? 'क्या आप जानना चाहती हैं कि डॉक्टर से मिलने से पहले कौन से लक्षण नोट करने चाहिए?'
          : 'Would you like guidance on what symptoms to record before speaking to your doctor?',
      followUpOptions:
        requestedLanguage === 'hi'
          ? ['हाँ, बताएं', 'नहीं, धन्यवाद']
          : ['Yes, please', 'No, thanks'],
      selfCareSteps: [
        requestedLanguage === 'hi'
          ? 'दैनिक पीरियड कैलेंडर में लक्षणों को ट्रैक करें।'
          : 'Log your daily symptoms and dates in Padzyra.',
      ],
      whenToSeeDoctor: [
        requestedLanguage === 'hi'
          ? 'सटीक अल्ट्रासाउंड या हॉर्मोनल प्रोफाइल जांच के लिए स्त्री रोग विशेषज्ञ से मिलें।'
          : 'Schedule a comprehensive clinical assessment with a gynecologist.',
      ],
      citedSourceIds: ['who-menstrual-health', 'nhs-period-problems'],
    };
  } else {
    // Ordinary grounded generation via provider abstraction
    aiOutput = await generateAiAnswer(rawMessage, {
      language: requestedLanguage,
      cycleConsent: explicitCycleConsent,
      cycleContext,
      retrievedSources,
    });
  }

  // 6. Validate citation identifiers strictly against retrieved sources
  const validCitations = validateCitations(
    aiOutput.citedSourceIds && aiOutput.citedSourceIds.length > 0
      ? aiOutput.citedSourceIds
      : retrievedSources.map((s) => s.slug)
  );

  // 7. Persist messages in database
  const userMsgRecord = await db.AiMessage.create({
    conversationId: conversation.id,
    sender: 'user',
    content: rawMessage,
    urgency: 'normal',
  });

  const assistantMsgRecord = await db.AiMessage.create({
    conversationId: conversation.id,
    sender: 'assistant',
    content: aiOutput.reply,
    urgency: safetyAssessment.urgency,
    redFlags: JSON.stringify(safetyAssessment.redFlags),
    citedSources: JSON.stringify(validCitations),
    followUpQuestion: aiOutput.followUpQuestion || null,
    followUpOptions: JSON.stringify(aiOutput.followUpOptions || []),
    selfCareSteps: JSON.stringify(aiOutput.selfCareSteps || []),
    whenToSeeDoctor: JSON.stringify(aiOutput.whenToSeeDoctor || []),
  });

  // 8. Assemble response contract
  return {
    conversationId: conversation.id,
    messageId: assistantMsgRecord.id,
    reply: aiOutput.reply,
    language: requestedLanguage,
    urgency: safetyAssessment.urgency,
    isEmergency: safetyAssessment.isEmergency,
    redFlags: safetyAssessment.redFlags,
    sources: validCitations,
    followUpQuestion: aiOutput.followUpQuestion || null,
    followUpOptions: aiOutput.followUpOptions || [],
    selfCareSteps: aiOutput.selfCareSteps || [],
    whenToSeeDoctor: aiOutput.whenToSeeDoctor || [],
    cycleContextUsed: explicitCycleConsent && Boolean(cycleContext),
    disclaimer:
      requestedLanguage === 'hi'
        ? 'पैडज़ीरा एआई साथी केवल शैक्षिक एवं साक्ष्य-आधारित मार्गदर्शन प्रदान करता है। यह डॉक्टर के व्यक्तिगत चिकित्सकीय परामर्श का विकल्प नहीं है।'
        : 'Padzyra AI Period Companion provides educational wellness guidance grounded in reviewed medical sources. It does not replace clinical diagnosis or professional medical advice.',
    // Backward compatibility fields for legacy /coach/chat tests
    category:
      safetyAssessment.isEmergency
        ? 'emergency_escalation'
        : rawMessage.toLowerCase().includes('cramp')
        ? 'cramp_relief'
        : 'general_care',
    quickTips: aiOutput.selfCareSteps && aiOutput.selfCareSteps.length > 0
      ? aiOutput.selfCareSteps
      : ['Stay hydrated', 'Keep warm compresses handy', 'Track symptoms in Padzyra'],
    timestamp: new Date().toISOString(),
  };
}

/**
 * List conversations for authenticated user
 */
async function listConversations(user) {
  if (!user) throw new HttpError(401, 'Login required');
  const conversations = await db.AiConversation.findAll({
    where: { userId: user.id },
    order: [['updatedAt', 'DESC']],
    limit: 50,
  });

  return conversations.map((c) => ({
    id: c.id,
    title: c.title,
    language: c.language,
    useCycleHistory: c.useCycleHistory,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}

/**
 * Retrieve messages for a single conversation
 */
async function getConversation(user, conversationId) {
  if (!user) throw new HttpError(401, 'Login required');
  const conversation = await db.AiConversation.findOne({
    where: { id: conversationId, userId: user.id },
    include: [{ model: db.AiMessage, as: 'messages' }],
    order: [[{ model: db.AiMessage, as: 'messages' }, 'createdAt', 'ASC']],
  });

  if (!conversation) {
    throw new HttpError(404, 'Conversation not found');
  }

  const messages = (conversation.messages || []).map((m) => ({
    id: m.id,
    sender: m.sender,
    content: m.content,
    urgency: m.urgency,
    redFlags: m.redFlags ? JSON.parse(m.redFlags) : [],
    sources: m.citedSources ? JSON.parse(m.citedSources) : [],
    followUpQuestion: m.followUpQuestion,
    followUpOptions: m.followUpOptions ? JSON.parse(m.followUpOptions) : [],
    selfCareSteps: m.selfCareSteps ? JSON.parse(m.selfCareSteps) : [],
    whenToSeeDoctor: m.whenToSeeDoctor ? JSON.parse(m.whenToSeeDoctor) : [],
    createdAt: m.createdAt,
  }));

  return {
    id: conversation.id,
    title: conversation.title,
    language: conversation.language,
    useCycleHistory: conversation.useCycleHistory,
    messages,
    createdAt: conversation.createdAt,
  };
}

/**
 * Delete a single conversation
 */
async function deleteConversation(user, conversationId) {
  if (!user) throw new HttpError(401, 'Login required');
  const conversation = await db.AiConversation.findOne({
    where: { id: conversationId, userId: user.id },
  });

  if (!conversation) {
    throw new HttpError(404, 'Conversation not found');
  }

  await conversation.destroy();
}

/**
 * Get curated medical sources catalog
 */
function getMedicalSources() {
  return CURATED_SOURCES.map((s) => ({
    id: s.slug,
    title: s.title,
    organization: s.organization,
    url: s.url,
    topic: s.topic,
    reviewStatus: s.reviewStatus,
    reviewDate: s.reviewDate,
    summaryEn: s.summaryEn,
    summaryHi: s.summaryHi,
    keyPoints: s.keyPoints,
    emergencyFlags: s.emergencyFlags,
  }));
}

/**
 * Get single medical source by slug/ID
 */
function getMedicalSourceById(sourceId) {
  const source = CURATED_SOURCES.find((s) => s.slug === sourceId);
  if (!source) throw new HttpError(404, 'Medical source not found');
  return {
    id: source.slug,
    title: source.title,
    organization: source.organization,
    url: source.url,
    topic: source.topic,
    reviewStatus: source.reviewStatus,
    reviewDate: source.reviewDate,
    summaryEn: source.summaryEn,
    summaryHi: source.summaryHi,
    keyPoints: source.keyPoints,
    emergencyFlags: source.emergencyFlags,
  };
}

/**
 * Get user consent and settings
 */
async function getUserConsent(user) {
  if (!user) {
    return {
      aiCycleConsent: false,
      aiLanguage: 'en',
    };
  }
  return {
    aiCycleConsent: Boolean(user.aiCycleConsent),
    aiLanguage: user.aiLanguage || 'en',
  };
}

/**
 * Update user consent and settings
 */
async function updateUserConsent(user, updates = {}) {
  if (!user) throw new HttpError(401, 'Login required');

  if (Object.prototype.hasOwnProperty.call(updates, 'aiCycleConsent')) {
    user.aiCycleConsent = Boolean(updates.aiCycleConsent);
  }
  if (updates.aiLanguage && ['en', 'hi'].includes(updates.aiLanguage)) {
    user.aiLanguage = updates.aiLanguage;
  }
  await user.save();

  return {
    aiCycleConsent: user.aiCycleConsent,
    aiLanguage: user.aiLanguage,
  };
}

module.exports = {
  chat,
  listConversations,
  getConversation,
  deleteConversation,
  getMedicalSources,
  getMedicalSourceById,
  getUserConsent,
  updateUserConsent,
};
