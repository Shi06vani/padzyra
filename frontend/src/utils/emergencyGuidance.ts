/**
 * Padzyra Emergency Period Guidance Module
 * 100% Offline-accessible practical advice for menstrual leaks and cramps self-care.
 */

export interface GuidanceStep {
  id: string;
  stepNumber: number;
  title: string;
  summary: string;
  details: string[];
  icon: string;
  tip?: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
}

export interface RedFlagSymptom {
  symptom: string;
  urgency: string;
  advice: string;
}

export const LEAK_CLEANUP_STEPS: GuidanceStep[] = [
  {
    id: 'step-restroom',
    stepNumber: 1,
    title: 'Find a Restroom or Private Space',
    summary: 'Locate the nearest private restroom, single-occupancy stall, or wellness room.',
    icon: 'location-outline',
    details: [
      'Take a deep breath — unexpected periods happen to nearly everyone who menstruates and there is zero shame.',
      'Head directly to the nearest public toilet, office restroom, café, or transit facility.',
      'If you have a jacket, cardigan, or hoodie, tie it around your waist for immediate discreet coverage while walking.',
    ],
    tip: 'Use the "Nearby Toilets" tab in this mode to find verified accessible public restrooms.',
  },
  {
    id: 'step-product',
    stepNumber: 2,
    title: 'Secure a Menstrual Product',
    summary: 'Use a pad, pantyliner, tampon, or menstrual cup.',
    icon: 'shield-checkmark-outline',
    details: [
      'Check your bag, pouch, or locker for spare day or night pads.',
      'If you do not have supplies on you, check the "Period Products" or "Emergency Delivery" tab.',
      'If in an office or college, ask a female colleague, friend, or nurse for a spare pad — people are almost always glad to help.',
      'Temporary emergency stopgap: Fold several layers of clean, unperfumed toilet tissue lengthwise as an external barrier in your underwear until you obtain a pad.',
    ],
    tip: 'Important: Never insert tissue, paper towels, or household materials inside the vagina. Only use approved menstrual products internally.',
  },
  {
    id: 'step-underwear',
    stepNumber: 3,
    title: 'Check and Change Underwear',
    summary: 'Switch to a spare pair or line your existing pair securely.',
    icon: 'shirt-outline',
    details: [
      'If you carry a spare pair of panties in your bag pouch, change into them now.',
      'Place the stained pair into a sealed zip-lock bag or discreet pouch for laundering later.',
      'If no spare is available, line your existing underwear with a fresh absorbent pad with wings to keep it dry and prevent further leakage.',
    ],
  },
  {
    id: 'step-cleanse',
    stepNumber: 4,
    title: 'Gentle External Cleansing',
    summary: 'Clean intimate skin gently with water or fragrance-free wipes.',
    icon: 'water-outline',
    details: [
      'Dampen a piece of tissue or use an alcohol-free, fragrance-free intimate wipe.',
      'Gently pat and wipe externally from front to back to maintain clean hygiene.',
      'Avoid harsh hand soaps, sanitizers, or perfumes on intimate skin, as these cause stinging and disrupt natural pH balance.',
      'Pat dry gently with dry toilet paper before attaching your new pad.',
    ],
  },
  {
    id: 'step-stains',
    stepNumber: 5,
    title: 'Cold Water Clothing Treatment',
    summary: 'Treat fresh blood stains with cold water only.',
    icon: 'snow-outline',
    details: [
      'Always use COLD water. Never use hot or warm water, as heat immediately coagulates hemoglobin proteins and permanently sets the stain into fabric.',
      'Dab cold water onto the back of the stain to push blood out of the fibers rather than rubbing it deeper.',
      'In a private restroom, apply a little hand soap or salt with cold water and gently rub the fabric together, then rinse with cold water.',
      'Pat damp fabric with hand paper towels to absorb excess moisture.',
    ],
    tip: 'Hydrogen peroxide (3%) or cold salt water works wonders on white or light-colored fabrics once you get home.',
  },
  {
    id: 'step-disposal',
    stepNumber: 6,
    title: 'Safe & Respectful Disposal',
    summary: 'Wrap and dispose of used products in designated sanitary bins.',
    icon: 'trash-bin-outline',
    details: [
      'Wrap your used pad or tampon tightly in the wrapper of the new pad or in toilet paper.',
      'Place it in a sanitary disposal bin or designated waste receptacle.',
      'Never flush menstrual products down the toilet, as pads and tampons cause severe plumbing blockages and environmental damage.',
      'Always wash your hands thoroughly with soap and warm water afterwards.',
    ],
  },
];

export const LEAK_CHECKLIST: ChecklistItem[] = [
  { id: 'chk-restroom', label: 'Find a private restroom or stall', description: 'Tie a jacket around waist if needed' },
  { id: 'chk-product', label: 'Apply a pad or menstrual product', description: 'Use wings to secure firmly to underwear' },
  { id: 'chk-clean', label: 'Gently clean intimate skin externally', description: 'Front-to-back with cold water or wipes' },
  { id: 'chk-stain', label: 'Rinse fabric stains with COLD water', description: 'Never hot water; dab gently' },
  { id: 'chk-dispose', label: 'Wrap & dispose of used products in bin', description: 'Never flush; wash hands with soap' },
];

export const CRAMPS_RELIEF_GUIDE: GuidanceStep[] = [
  {
    id: 'cramp-heat',
    stepNumber: 1,
    title: 'Apply Continuous Warmth (Heat Therapy)',
    summary: 'Heat relaxes contracting uterine smooth muscles and increases pelvic blood flow.',
    icon: 'flame-outline',
    details: [
      'Place a warm water bottle, heating pad, or microwaveable gel pack over your lower abdomen or lower back for 15–20 minutes.',
      'When outside, in class, or at work, apply a discreet stick-on herbal heating patch directly onto the outside of your panties.',
      'Studies show local heat therapy at 40°C is as effective as standard OTC pain relievers for primary dysmenorrhea.',
    ],
    tip: 'Ensure warm bottles are wrapped in a cloth sleeve to protect delicate skin.',
  },
  {
    id: 'cramp-posture',
    stepNumber: 2,
    title: 'Comfortable Resting Postures',
    summary: 'Relieve pressure on the pelvic floor and lower spine.',
    icon: 'body-outline',
    details: [
      'Fetal Position: Lie on your side with knees curled up toward your chest and a pillow between your knees to take tension off abdominal walls.',
      'Child’s Pose (Balasana): Kneel on a mat or bed, sit back on your heels, fold forward with forehead on the bed and arms stretched forward.',
      'Elevated Legs: Lie flat on your back with pillows under your knees or rest legs up against a wall to reduce pelvic congestion.',
    ],
  },
  {
    id: 'cramp-hydration',
    stepNumber: 3,
    title: 'Warm Hydration & Herbal Infusions',
    summary: 'Sip warm fluids to ease muscle spasms and reduce abdominal bloating.',
    icon: 'cafe-outline',
    details: [
      'Drink plenty of warm water throughout the day. Dehydration exacerbates uterine contractions.',
      'Chamomile Tea: Contains glycine which relieves muscle and nerve spasms.',
      'Ginger Tea: Natural anti-inflammatory properties that reduce prostaglandin synthesis.',
      'Avoid excessive caffeine, carbonated sodas, and salty snacks, which increase water retention and cramping.',
    ],
  },
  {
    id: 'cramp-medication',
    stepNumber: 4,
    title: 'Over-The-Counter Pain Relief Reminder',
    summary: 'Follow packaging instructions and consult a doctor or pharmacist.',
    icon: 'medkit-outline',
    details: [
      'If you have previously discussed period pain relief with a doctor or already have approved medication at home, follow the exact label instructions.',
      'Never exceed the recommended dosage on the packaging.',
      'Take oral medication with food or water to avoid stomach irritation.',
      'Do not take medications if you have known allergies, asthma, ulcer history, or kidney conditions without consulting your healthcare provider.',
    ],
    tip: 'We do not prescribe medications. Consult a licensed pharmacist or doctor for advice tailored to your medical history.',
  },
];

export const CRAMPS_RED_FLAGS: RedFlagSymptom[] = [
  {
    symptom: 'Sudden, excruciating, or worsening sharp pelvic pain',
    urgency: 'Immediate Urgent Medical Care',
    advice: 'Could indicate ectopic pregnancy, ovarian cyst rupture, or acute appendicitis. Seek emergency care immediately.',
  },
  {
    symptom: 'Soaking through 1+ pads every hour for 2+ consecutive hours',
    urgency: 'Urgent Care Required',
    advice: 'Very heavy flow with large golf-ball-sized clots requires clinical evaluation by a gynecologist or urgent care clinic.',
  },
  {
    symptom: 'Fever, chills, foul-smelling discharge, or nausea/vomiting',
    urgency: 'Same-Day Evaluation',
    advice: 'May be signs of pelvic infection or Toxic Shock Syndrome (especially if using tampons/cups). Remove internal products and seek immediate care.',
  },
  {
    symptom: 'Fainting, severe dizziness, pale skin, or shortness of breath',
    urgency: 'Call Emergency (112 / 108 / 911)',
    advice: 'Signs of significant blood loss, internal hemorrhage, or severe vasovagal syncope. Call emergency medical services without delay.',
  },
];
