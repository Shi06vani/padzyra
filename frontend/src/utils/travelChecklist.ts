import { TripChecklistItem } from '../api/client';
import { OverlapStatus } from './cycleTravelPrediction';

export interface TravelPreparationTip {
  id: string;
  category: 'timing' | 'luggage' | 'comfort' | 'activity';
  title: string;
  tip: string;
  icon: string;
}

/**
 * Generates a personalized packing checklist tailored to trip length, overlap status, and activities.
 */
export function generateDefaultChecklist(
  tripDays: number,
  overlapStatus: OverlapStatus,
  activities: string[] = []
): TripChecklistItem[] {
  const days = Math.max(tripDays, 1);
  const isOverlap = overlapStatus === 'overlap';

  // Practical quantity formulas (capped to avoid excessive or unrealistic numbers)
  const dayPadsQty = isOverlap ? Math.min(Math.max(days * 3, 4), 15) : 3;
  const nightPadsQty = isOverlap ? Math.min(Math.max(days, 2), 5) : 1;
  const linersQty = Math.min(Math.max(days * 2, 2), 10);
  const spareUnderwearQty = Math.min(Math.max(days + 2, 3), 7);
  const disposalBagsQty = Math.min(Math.max(days * 2, 3), 8);
  const heatPatchesQty = isOverlap ? Math.min(Math.max(days, 1), 4) : 1;

  const items: TripChecklistItem[] = [
    // --- Period Essentials ---
    {
      id: 'default-day-pads',
      name: 'Sanitary pads (daytime)',
      category: 'essentials',
      packed: false,
      quantity: dayPadsQty,
      description: isOverlap ? 'For daily cycle protection' : 'Emergency safety supply',
    },
    {
      id: 'default-night-pads',
      name: 'Sanitary pads (overnight)',
      category: 'essentials',
      packed: false,
      quantity: nightPadsQty,
      description: isOverlap ? 'For leak-free sleep while away' : 'Overnight backup',
    },
    {
      id: 'default-liners',
      name: 'Panty liners',
      category: 'essentials',
      packed: false,
      quantity: linersQty,
      description: 'For spotting, light discharge, or cup/tampon backup',
    },
    {
      id: 'default-alternatives',
      name: 'Tampons, cup, or period underwear (optional)',
      category: 'essentials',
      packed: false,
      quantity: 1,
      description: 'Your preferred personal alternative menstrual product',
    },
    {
      id: 'default-spare-underwear',
      name: 'Spare cotton underwear',
      category: 'essentials',
      packed: false,
      quantity: spareUnderwearQty,
      description: 'Breathable, comfortable extra pairs for peace of mind',
    },
    {
      id: 'default-disposal-bags',
      name: 'Disposal bags / zip pouches',
      category: 'essentials',
      packed: false,
      quantity: disposalBagsQty,
      description: 'For discreet, hygienic disposal while in transit',
    },
    {
      id: 'default-wipes',
      name: 'Intimate / fragrance-free wipes',
      category: 'essentials',
      packed: false,
      quantity: 1,
      description: 'Travel pack for quick freshening up',
    },
    {
      id: 'default-sanitizer',
      name: 'Travel hand sanitizer',
      category: 'essentials',
      packed: false,
      quantity: 1,
      description: 'For clean hands before and after product changes',
    },

    // --- Comfort & Personal Care ---
    {
      id: 'default-heating-patch',
      name: 'Heating patch / hot water bag',
      category: 'comfort',
      packed: false,
      quantity: heatPatchesQty,
      description: 'Natural abdominal cramp and backache relief',
    },
    {
      id: 'default-comfortable-clothes',
      name: 'Comfortable loose clothing & soft pants',
      category: 'comfort',
      packed: false,
      quantity: Math.min(days, 3),
      description: 'Non-restrictive waistbands for travel bloating',
    },
    {
      id: 'default-carry-on-pouch',
      name: 'Small zipper pouch for hand luggage',
      category: 'comfort',
      packed: false,
      quantity: 1,
      description: 'Keep 2-3 pads & wipes easily accessible in your day bag',
    },
    {
      id: 'default-intimate-wash',
      name: 'Mild soap or intimate hygiene wash',
      category: 'comfort',
      packed: false,
      quantity: 1,
      description: 'Travel size bottle to avoid harsh hotel soaps',
    },

    // --- Medication & Health ---
    {
      id: 'default-doctor-medication',
      name: 'Doctor-advised pain relief or routine medication',
      category: 'medication',
      packed: false,
      quantity: 1,
      description: 'Any prescription or cramp relief you already take under medical guidance',
    },
    {
      id: 'default-electrolytes',
      name: 'Hydration salts or electrolytes',
      category: 'medication',
      packed: false,
      quantity: Math.min(days, 4),
      description: 'Helpful for fatigue, cramps, and travel dehydration',
    },
  ];

  // Activity-specific additions
  if (activities.includes('beach')) {
    items.push({
      id: 'activity-beach-swimwear',
      name: 'Period-proof swimwear or dark swim coverup',
      category: 'comfort',
      packed: false,
      quantity: 1,
      description: 'Great for relaxing by the beach or pool with confidence',
    });
    items.push({
      id: 'activity-beach-waterproof-pouch',
      name: 'Waterproof dry bag for wet items',
      category: 'essentials',
      packed: false,
      quantity: 1,
      description: 'Keeps clean and used items separate after swimming',
    });
  }

  if (activities.includes('hiking')) {
    items.push({
      id: 'activity-hiking-sealed-bags',
      name: 'Heavy-duty zip-lock bags for pack-in/pack-out',
      category: 'essentials',
      packed: false,
      quantity: 4,
      description: 'Crucial for trail hygiene where sanitary bins are absent',
    });
  }

  if (activities.includes('long journey')) {
    items.push({
      id: 'activity-travel-pillow',
      name: 'Travel lumbar or neck cushion',
      category: 'comfort',
      packed: false,
      quantity: 1,
      description: 'Reduces lower back pelvic ache on long flights or drives',
    });
  }

  if (activities.includes('office trip')) {
    items.push({
      id: 'activity-office-discreet-pouch',
      name: 'Slim laptop-bag menstrual organizer',
      category: 'comfort',
      packed: false,
      quantity: 1,
      description: 'Fits cleanly into work totes for bathroom breaks between meetings',
    });
  }

  if (activities.includes('wedding')) {
    items.push({
      id: 'activity-wedding-stain-pen',
      name: 'Emergency stain-remover wipe / pen',
      category: 'comfort',
      packed: false,
      quantity: 1,
      description: 'Quick spot treatment for formal or festive attire',
    });
    items.push({
      id: 'activity-wedding-safety-pins',
      name: 'Safety pins & seamless dark shorts',
      category: 'comfort',
      packed: false,
      quantity: 1,
      description: 'Comfortable support under festive lehengas or sarees',
    });
  }

  return items;
}

/**
 * Generates personalized, supportive travel preparation advice.
 */
export function getTravelPreparationTips(
  overlapStatus: OverlapStatus,
  activities: string[] = [],
  tripDays: number = 3
): TravelPreparationTip[] {
  const tips: TravelPreparationTip[] = [];

  // Overlap-specific guidance
  if (overlapStatus === 'overlap') {
    tips.push({
      id: 'tip-carry-on',
      category: 'luggage',
      title: 'Keep 2-Day Supplies in Carry-On',
      tip: 'Do not pack all menstrual items in checked baggage. Keep 3-4 pads, liners, wipes, and a change of underwear in your handbag or carry-on in case of flight delays or baggage arrival issues.',
      icon: 'briefcase',
    });
    tips.push({
      id: 'tip-timing',
      category: 'timing',
      title: 'Plan Regular Restroom Breaks',
      tip: 'Set a gentle reminder to change your menstrual product every 4–6 hours while traveling. Public restrooms may vary in availability, so take advantage of transit hubs.',
      icon: 'time',
    });
    tips.push({
      id: 'tip-heat',
      category: 'comfort',
      title: 'Air-Activated Heating Patches',
      tip: 'Single-use adhesive heat patches are airport-security safe and do not require boiling water, making them ideal for cramps on long flights or train journeys.',
      icon: 'flame',
    });
  } else if (overlapStatus === 'unlikely') {
    tips.push({
      id: 'tip-safety-kit',
      category: 'luggage',
      title: 'Carry a Minimal Emergency Kit',
      tip: 'Although an overlap is unlikely, changes in time zones, circadian rhythms, or travel stress can occasionally induce mild spotting or slight cycle shifts. Carry 2 pads and liners just in case.',
      icon: 'shield-checkmark',
    });
  } else {
    tips.push({
      id: 'tip-uncertain',
      category: 'timing',
      title: 'Dual-Preparation Strategy',
      tip: 'Because your cycle data is limited, prepare for both possibilities. Packing 3–4 versatile daytime pads and extra liners takes minimal luggage space and prevents last-minute stress.',
      icon: 'help-circle',
    });
  }

  // Activity guidance
  if (activities.includes('beach')) {
    tips.push({
      id: 'tip-beach',
      category: 'activity',
      title: 'Beach & Swimming Care',
      tip: 'If your flow arrives, tampons, menstrual cups, or period-proof swimwear allow you to swim freely. Pack dark towels and easy-to-wash coverups for lounging by the shore.',
      icon: 'sunny',
    });
  }

  if (activities.includes('hiking')) {
    tips.push({
      id: 'tip-hiking',
      category: 'activity',
      title: 'Leave No Trace Trail Care',
      tip: 'Wilderness trails rarely have waste bins. Pack double-sealed opaque zip pouches to store used hygiene items until you return to a designated disposal point. Carry biodegradable hand wipes.',
      icon: 'leaf',
    });
  }

  if (activities.includes('long journey')) {
    tips.push({
      id: 'tip-transit',
      category: 'comfort',
      title: 'Comfort in Transit',
      tip: 'Prolonged sitting can exacerbate pelvic heaviness. Stand up and stretch every 2 hours during flights or drives, stay well hydrated with water, and avoid tight synthetic trousers.',
      icon: 'airplane',
    });
  }

  if (activities.includes('office trip')) {
    tips.push({
      id: 'tip-office',
      category: 'activity',
      title: 'Discreet Workday Routines',
      tip: 'Keep a small, stylish makeup-style pouch in your laptop backpack. Pre-pack it with two pads and individually wrapped wipes for smooth, stress-free freshening between meetings.',
      icon: 'business',
    });
  }

  if (activities.includes('wedding')) {
    tips.push({
      id: 'tip-wedding',
      category: 'activity',
      title: 'Festive Wear Tips',
      tip: 'Layer seamless bike shorts under heavy outfits for inner-thigh comfort and pad stability. Keep a quick stain remover pen in your small evening clutch for emergencies.',
      icon: 'sparkles',
    });
  }

  return tips;
}

export const CHECKLIST_CATEGORIES = {
  essentials: {
    label: 'Period Essentials',
    color: '#D4738C',
    icon: 'water-outline',
  },
  comfort: {
    label: 'Comfort & Personal Care',
    color: '#8A5A72',
    icon: 'heart-outline',
  },
  medication: {
    label: 'Medication & Wellness',
    color: '#B05D78',
    icon: 'medkit-outline',
  },
} as const;

export interface ChecklistProgress {
  total: number;
  packed: number;
  percent: number;
  isAllPacked: boolean;
}

export function calculateChecklistProgress(items: TripChecklistItem[] = []): ChecklistProgress {
  if (!items || items.length === 0) {
    return { total: 0, packed: 0, percent: 0, isAllPacked: false };
  }
  const total = items.length;
  const packed = items.filter((i) => i.packed).length;
  const percent = Math.round((packed / total) * 100);
  return {
    total,
    packed,
    percent,
    isAllPacked: total > 0 && packed === total,
  };
}
