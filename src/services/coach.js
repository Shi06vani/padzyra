const db = require('../models');

const TOPIC_RESPONSES = [
  {
    keywords: ['cramp', 'pain', 'ache', 'back pain', 'stomach', 'spasm'],
    category: 'cramp_relief',
    title: 'Rapid Cramp & Pain Relief',
    reply: `Here are evidence-backed ways to ease menstrual cramps quickly:
1. **Continuous Heat Therapy**: Apply a hot water bottle or electric heating pad to your lower abdomen or lower back. Heat increases pelvic blood flow and relaxes uterine muscle contractions as effectively as over-the-counter pain relievers.
2. **Magnesium & Hydration**: Drink warm ginger-lemon water or chamomile tea. Ginger inhibits prostaglandin synthesis (the chemical messenger that causes cramps).
3. **Gentle Decompression Stretches**:
   • *Child's Pose (Balasana)* for 3–5 minutes with deep diaphragmatic breathing.
   • *Reclining Bound Angle Pose (Supta Baddha Konasana)* with cushions under your knees.
4. **Gentle Acupressure**: Massage the *Spleen 6 (SP6)* point located roughly 4 finger-widths above your inner ankle bone on the calf.`,
    quickTips: ['Use heat bottle for 20 mins', 'Sip warm ginger tea', 'Avoid excessive sodium & iced drinks'],
  },
  {
    keywords: ['delay', 'late', 'miss', 'missed', 'pregnant', 'irregular', 'not coming'],
    category: 'cycle_delay',
    title: 'Understanding Cycle Delays',
    reply: `A cycle shift of 3 to 7 days is very common and natural! Here is what usually happens:
1. **Cortisol & Stress**: Elevated stress delays ovulation. When ovulation is postponed, your period date naturally shifts backward.
2. **Recent Illness, Travel or Sleep Loss**: Disrupts circadian rhythms and the hypothalamic-pituitary-ovarian (HPO) axis.
3. **Diet or Weight Fluctuations**: Rapid caloric deficit or extreme workouts can signal the body to conserve energy.
4. **Action Steps**:
   • Log your daily feelings in Padzyra to track patterns.
   • Stay well-hydrated and prioritize 7–8 hours of sound sleep.
   • If pregnancy is a possibility, take a home pregnancy test 1–2 days after your missed date.
   • If your period is delayed by >60 days or cycles are chronically over 35 days, visit a gynecologist to screen for PCOS or thyroid variations.`,
    quickTips: ['Track basal body patterns', 'Maintain regular sleep', 'Consult doctor if delayed >2 weeks'],
  },
  {
    keywords: ['mood', 'cry', 'crying', 'angry', 'irritated', 'sad', 'pms', 'depression', 'anxiety'],
    category: 'pms_mood',
    title: 'Soothing PMS Mood Swings & Hormonal Dips',
    reply: `What you are feeling is real and biochemical—during your luteal phase, estrogen and progesterone plummet, which temporarily lowers serotonin (your feel-good neurotransmitter):
1. **Stabilize Blood Sugar**: Eat small, balanced meals with complex carbohydrates (oatmeal, sweet potatoes, whole grains) to maintain steady brain serotonin levels.
2. **Mood-Boosting Foods**: Dark chocolate (70%+ cacao) contains magnesium and flavonoids that elevate endorphins.
3. **Mindful Boundaries**: Give yourself permission to say "no" to draining obligations. Low energy during this phase is your body's biological cue to slow down.
4. **B6 & Vitamin D**: Foods like bananas, walnuts, and spinach assist dopamine synthesis.`,
    quickTips: ['Enjoy dark chocolate guilt-free', 'Reduce caffeine during luteal phase', 'Practice 10 mins quiet journaling'],
  },
  {
    keywords: ['spot', 'spotting', 'brown', 'discharge', 'pink', 'light flow'],
    category: 'discharge_spotting',
    title: 'Spotting vs. Period Flow',
    reply: `Spotting and full menstruation have distinct characteristics:
1. **Color & Consistency**:
   • *Brown/Dark Spotting*: Usually older, oxidized uterine blood taking longer to exit (frequently harmless at cycle start or end).
   • *Pinkish Discharge*: Often cervical fluid mixed with a tiny drop of fresh blood (common around ovulation or implantation).
   • *Active Period*: Bright to deep red, continuous flow requiring pad changes every 4–8 hours.
2. **Timing**: Mid-cycle spotting often correlates with the LH surge during ovulation.
3. **When to seek medical checkup**: If spotting occurs consistently after intercourse, is accompanied by foul odor, fever, or severe pelvic burning.`,
    quickTips: ['Use light pantyliners', 'Note the exact cycle day', 'Watch for accompanying symptoms'],
  },
  {
    keywords: ['food', 'eat', 'craving', 'crave', 'diet', 'chocolate', 'snack'],
    category: 'nutrition',
    title: 'Cycle-Syncing Nutrition & Cravings',
    reply: `Cravings are your body signaling metabolic shifts! During the late luteal phase, your resting metabolic rate actually increases by ~100–300 calories per day:
• **Craving Sweets/Chocolate**: Your body needs magnesium and dopamine. Opt for dark chocolate, banana with peanut butter, or warm dates.
• **Craving Salty/Savory**: Signals electrolyte needs. Try roasted pumpkin seeds, salted almonds, or warm broth.
• **Anti-Bloat Heroes**: Cucumbers, watermelon, peppermint tea, and pineapple (contains bromelain, an anti-inflammatory enzyme).`,
    quickTips: ['Satisfy cravings with nutrient-dense swaps', 'Boost dietary magnesium', 'Drink 2.5L water daily'],
  },
];

const DEFAULT_RESPONSE = {
  category: 'general_care',
  title: 'Holistic Cycle Wellness Advice',
  reply: `Your cycle is a vital sign of your overall well-being. Listening to your body, resting when fatigue sets in, staying hydrated, and keeping warm compressions handy can make a world of difference.\n\nFeel free to ask me specifically about cramps, period delays, spotting, PMS emotions, or cycle-syncing nutrition! 🌸`,
  quickTips: ['Stay hydrated', 'Keep a hot water bottle near', 'Track your cycle symptoms in Padzyra'],
};

async function getCoachResponse(user, message) {
  const query = String(message || '').toLowerCase().trim();

  // Find best topic match
  let matched = null;
  for (const topic of TOPIC_RESPONSES) {
    if (topic.keywords.some((k) => query.includes(k))) {
      matched = topic;
      break;
    }
  }

  const result = matched || DEFAULT_RESPONSE;

  // Personalized cycle note if user is logged in
  let cycleNote = '';
  if (user) {
    try {
      const activeCycle = await db.Cycle.findOne({
        where: { userId: user.id, endedAt: null },
        order: [['startedAt', 'DESC']],
      });
      if (activeCycle) {
        const daysSince = Math.floor((Date.now() - new Date(activeCycle.startedAt).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        cycleNote = ` (You are currently around Day ${daysSince} of your cycle)`;
      }
    } catch {
      // ignore
    }
  }

  return {
    reply: `${result.reply}${cycleNote ? `\n\n📌 *Personalized note: You appear to be around Day of your current logged cycle. Keep track of how symptoms evolve over the next 48 hours.*` : ''}`,
    title: result.title,
    quickTips: result.quickTips,
    category: result.category,
    timestamp: new Date().toISOString(),
    disclaimer: 'Padzyra AI Coach provides educational wellness guidance and does not replace medical diagnosis. For severe or prolonged symptoms, please consult a certified gynecologist.',
  };
}

module.exports = {
  getCoachResponse,
  TOPIC_RESPONSES,
};
