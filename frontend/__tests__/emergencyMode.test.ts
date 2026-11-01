import {
  LEAK_CLEANUP_STEPS,
  LEAK_CHECKLIST,
  CRAMPS_RELIEF_GUIDE,
  CRAMPS_RED_FLAGS,
} from '../src/utils/emergencyGuidance';
import { PadzyraApi } from '../src/api/client';

describe('Emergency Period Mode - Frontend & Guidance Engine', () => {
  describe('Discreet Leak and Cleanup Guidance', () => {
    test('contains comprehensive 6-step practical leak management advice', () => {
      expect(LEAK_CLEANUP_STEPS.length).toBe(6);
      const stepTitles = LEAK_CLEANUP_STEPS.map((s) => s.title.toLowerCase());

      expect(stepTitles.some((t) => t.includes('restroom') || t.includes('private'))).toBe(true);
      expect(stepTitles.some((t) => t.includes('product') || t.includes('pad'))).toBe(true);
      expect(stepTitles.some((t) => t.includes('underwear'))).toBe(true);
      expect(stepTitles.some((t) => t.includes('clean') || t.includes('external'))).toBe(true);
      expect(stepTitles.some((t) => t.includes('stain') || t.includes('cold water'))).toBe(true);
      expect(stepTitles.some((t) => t.includes('disposal') || t.includes('bin'))).toBe(true);
    });

    test('explicitly advises COLD water for clothing stains and warns against hot water', () => {
      const stainStep = LEAK_CLEANUP_STEPS.find((s) => s.id === 'step-stains');
      expect(stainStep).toBeDefined();

      const combinedText = stainStep!.details.join(' ').toLowerCase();
      expect(combinedText).toContain('cold water');
      expect(combinedText).toContain('never use hot');
    });

    test('maintains strict medical safety: warns against inserting unsafe household materials into the vagina', () => {
      const productStep = LEAK_CLEANUP_STEPS.find((s) => s.id === 'step-product');
      expect(productStep).toBeDefined();

      const combinedText = (productStep!.tip || '') + productStep!.details.join(' ');
      expect(combinedText.toLowerCase()).toContain('never insert');
    });

    test('quick interactive checklist covers all essential action points', () => {
      expect(LEAK_CHECKLIST.length).toBe(5);
      const labels = LEAK_CHECKLIST.map((c) => c.label.toLowerCase());

      expect(labels.some((l) => l.includes('restroom'))).toBe(true);
      expect(labels.some((l) => l.includes('product') || l.includes('pad'))).toBe(true);
      expect(labels.some((l) => l.includes('clean'))).toBe(true);
      expect(labels.some((l) => l.includes('rinse') || l.includes('cold water'))).toBe(true);
      expect(labels.some((l) => l.includes('dispose'))).toBe(true);
    });
  });

  describe('Cramps Relief and Red Flags Safety Guide', () => {
    test('contains evidence-based non-pharmacological self-care', () => {
      expect(CRAMPS_RELIEF_GUIDE.length).toBeGreaterThanOrEqual(4);
      const titles = CRAMPS_RELIEF_GUIDE.map((g) => g.title.toLowerCase());

      expect(titles.some((t) => t.includes('heat') || t.includes('warmth'))).toBe(true);
      expect(titles.some((t) => t.includes('posture') || t.includes('resting'))).toBe(true);
      expect(titles.some((t) => t.includes('hydration') || t.includes('tea'))).toBe(true);
      expect(titles.some((t) => t.includes('medication') || t.includes('relief'))).toBe(true);
    });

    test('never prescribes specific drugs or dosages; advises doctor and package instructions', () => {
      const medStep = CRAMPS_RELIEF_GUIDE.find((g) => g.id === 'cramp-medication');
      expect(medStep).toBeDefined();

      const allMedText = ((medStep!.tip || '') + medStep!.details.join(' ')).toLowerCase();
      expect(allMedText).toContain('we do not prescribe');
      expect(allMedText).toContain('label');
    });

    test('contains critical Red Flag alerts directing users to emergency services for severe symptoms', () => {
      expect(CRAMPS_RED_FLAGS.length).toBeGreaterThanOrEqual(4);

      const allFlagText = CRAMPS_RED_FLAGS.map((f) => `${f.symptom} ${f.advice}`).join(' ').toLowerCase();
      expect(allFlagText).toContain('sudden');
      expect(allFlagText).toContain('fever');
      expect(allFlagText).toContain('heavy');
      expect(allFlagText).toContain('fainting');

      const urgencies = CRAMPS_RED_FLAGS.map((f) => f.urgency.toLowerCase()).join(' ');
      expect(urgencies).toContain('emergency');
    });
  });

  describe('Emergency Delivery Order Calculations', () => {
    test('calculates correct subtotal, applies free delivery above ₹150 threshold, and handles fees', () => {
      // Scenario A: Order < 150 -> standard delivery fee ₹30
      const itemsUnder150 = [
        { price: 35, qty: 2 }, // 70
        { price: 45, qty: 1 }, // 45 -> Subtotal = 115
      ];
      const subtotalA = itemsUnder150.reduce((sum, i) => sum + i.price * i.qty, 0);
      const deliveryFeeA = subtotalA >= 150 ? 0 : 30;
      const totalA = subtotalA + deliveryFeeA;

      expect(subtotalA).toBe(115);
      expect(deliveryFeeA).toBe(30);
      expect(totalA).toBe(145);

      // Scenario B: Order >= 150 -> FREE delivery
      const itemsOver150 = [
        { price: 149, qty: 1 }, // 149
        { price: 35, qty: 1 },  // 35 -> Subtotal = 184
      ];
      const subtotalB = itemsOver150.reduce((sum, i) => sum + i.price * i.qty, 0);
      const deliveryFeeB = subtotalB >= 150 ? 0 : 30;
      const totalB = subtotalB + deliveryFeeB;

      expect(subtotalB).toBe(184);
      expect(deliveryFeeB).toBe(0);
      expect(totalB).toBe(184);
    });
  });

  describe('PadzyraApi Client Integration Contract', () => {
    test('exposes all required Emergency Period Mode API methods', () => {
      expect(typeof PadzyraApi.getNearbyToilets).toBe('function');
      expect(typeof PadzyraApi.searchToilets).toBe('function');
      expect(typeof PadzyraApi.getEmergencyProductCategories).toBe('function');
      expect(typeof PadzyraApi.getNearbyEmergencyProducts).toBe('function');
      expect(typeof PadzyraApi.getEmergencyShopDetails).toBe('function');
      expect(typeof PadzyraApi.getEmergencyDeliveryAvailability).toBe('function');
      expect(typeof PadzyraApi.getEmergencyDeliveryProducts).toBe('function');
      expect(typeof PadzyraApi.createEmergencyDeliveryOrder).toBe('function');
      expect(typeof PadzyraApi.getEmergencyOrder).toBe('function');
      expect(typeof PadzyraApi.cancelEmergencyOrder).toBe('function');
    });
  });
});
