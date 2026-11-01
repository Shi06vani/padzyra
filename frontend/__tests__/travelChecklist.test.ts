import {
  generateDefaultChecklist,
  getTravelPreparationTips,
  calculateChecklistProgress,
  CHECKLIST_CATEGORIES,
} from '../src/utils/travelChecklist';
import { TripChecklistItem } from '../src/api/client';

describe('travelChecklist and Preparation Engine', () => {
  describe('generateDefaultChecklist', () => {
    test('generates items in all 3 core categories', () => {
      const items = generateDefaultChecklist(4, 'overlap', []);
      const categories = new Set(items.map((i) => i.category));

      expect(categories.has('essentials')).toBe(true);
      expect(categories.has('comfort')).toBe(true);
      expect(categories.has('medication')).toBe(true);
    });

    test('scales quantities practically when overlap is predicted', () => {
      // 5-day trip with overlap
      const items = generateDefaultChecklist(5, 'overlap', []);
      const dayPads = items.find((i) => i.id === 'default-day-pads');
      const nightPads = items.find((i) => i.id === 'default-night-pads');
      const heatPatches = items.find((i) => i.id === 'default-heating-patch');

      expect(dayPads).toBeDefined();
      expect(dayPads!.quantity).toBeGreaterThanOrEqual(10);
      expect(dayPads!.quantity).toBeLessThanOrEqual(15); // Capped reasonably

      expect(nightPads).toBeDefined();
      expect(nightPads!.quantity).toBe(5);

      expect(heatPatches).toBeDefined();
      expect(heatPatches!.quantity).toBeGreaterThanOrEqual(2);
    });

    test('provides compact emergency backup quantities when overlap is unlikely', () => {
      // 5-day trip where overlap is unlikely
      const items = generateDefaultChecklist(5, 'unlikely', []);
      const dayPads = items.find((i) => i.id === 'default-day-pads');
      const nightPads = items.find((i) => i.id === 'default-night-pads');

      expect(dayPads).toBeDefined();
      expect(dayPads!.quantity).toBe(3); // Compact emergency safety pack
      expect(nightPads!.quantity).toBe(1);
    });

    test('never forces a specific product; includes optional alternatives', () => {
      const items = generateDefaultChecklist(3, 'overlap', []);
      const alternatives = items.find((i) => i.id === 'default-alternatives');

      expect(alternatives).toBeDefined();
      expect(alternatives!.name).toContain('optional');
    });

    test('includes non-prescriptive medication reminder without prescribing', () => {
      const items = generateDefaultChecklist(4, 'overlap', []);
      const medItem = items.find((i) => i.id === 'default-doctor-medication');

      expect(medItem).toBeDefined();
      expect(medItem!.name).toContain('Doctor-advised');
      expect(medItem!.description).toContain('medical guidance');
      // Must not name specific prescription drugs
      expect(medItem!.description).not.toContain('ibuprofen');
      expect(medItem!.description).not.toContain('tranexamic');
    });

    test('adds activity-specific items for beach, hiking, and long journey', () => {
      const beachItems = generateDefaultChecklist(3, 'overlap', ['beach']);
      expect(beachItems.some((i) => i.id.startsWith('activity-beach'))).toBe(true);

      const hikeItems = generateDefaultChecklist(3, 'overlap', ['hiking']);
      expect(hikeItems.some((i) => i.id.startsWith('activity-hiking'))).toBe(true);

      const journeyItems = generateDefaultChecklist(3, 'overlap', ['long journey']);
      expect(journeyItems.some((i) => i.id.startsWith('activity-travel'))).toBe(true);
    });
  });

  describe('calculateChecklistProgress', () => {
    test('calculates correct packed counts and percentage', () => {
      const items: TripChecklistItem[] = [
        { id: '1', name: 'Pads', category: 'essentials', packed: true, quantity: 5 },
        { id: '2', name: 'Liners', category: 'essentials', packed: false, quantity: 4 },
        { id: '3', name: 'Wipes', category: 'essentials', packed: true, quantity: 1 },
        { id: '4', name: 'Pouch', category: 'comfort', packed: false, quantity: 1 },
      ];

      const progress = calculateChecklistProgress(items);
      expect(progress.total).toBe(4);
      expect(progress.packed).toBe(2);
      expect(progress.percent).toBe(50);
      expect(progress.isAllPacked).toBe(false);
    });

    test('returns 0% when no items are present', () => {
      const progress = calculateChecklistProgress([]);
      expect(progress.total).toBe(0);
      expect(progress.packed).toBe(0);
      expect(progress.percent).toBe(0);
      expect(progress.isAllPacked).toBe(false);
    });

    test('detects when all items are packed (100%)', () => {
      const items: TripChecklistItem[] = [
        { id: '1', name: 'Pads', category: 'essentials', packed: true, quantity: 5 },
        { id: '2', name: 'Liners', category: 'essentials', packed: true, quantity: 4 },
      ];

      const progress = calculateChecklistProgress(items);
      expect(progress.percent).toBe(100);
      expect(progress.isAllPacked).toBe(true);
    });
  });

  describe('getTravelPreparationTips', () => {
    test('provides carry-on advice when overlap is possible', () => {
      const tips = getTravelPreparationTips('overlap', ['flight', 'office trip']);
      expect(tips.some((t) => t.id === 'tip-carry-on')).toBe(true);
    });

    test('provides dual-readiness advice when prediction is unavailable', () => {
      const tips = getTravelPreparationTips('unavailable', []);
      expect(tips.some((t) => t.id === 'tip-uncertain')).toBe(true);
    });

    test('provides beach swimwear and ocean advice when beach activity is selected', () => {
      const tips = getTravelPreparationTips('overlap', ['beach']);
      expect(tips.some((t) => t.id === 'tip-beach')).toBe(true);
    });

    test('provides hydration and transit tips for long journeys', () => {
      const tips = getTravelPreparationTips('unlikely', ['long journey']);
      expect(tips.some((t) => t.id === 'tip-transit')).toBe(true);
    });
  });

  describe('CHECKLIST_CATEGORIES metadata', () => {
    test('defines required category labels and colors', () => {
      expect(CHECKLIST_CATEGORIES.essentials.label).toBe('Period Essentials');
      expect(CHECKLIST_CATEGORIES.comfort.label).toBe('Comfort & Personal Care');
      expect(CHECKLIST_CATEGORIES.medication.label).toBe('Medication & Wellness');
    });
  });
});
