import {
  parseDate,
  formatDate,
  diffDays,
  addDays,
  analyzeCycleHistory,
  predictPeriodTravelOverlap,
  CycleRecord,
} from '../src/utils/cycleTravelPrediction';

describe('cycleTravelPrediction Engine', () => {
  describe('Date Helpers', () => {
    test('parses and formats YYYY-MM-DD correctly', () => {
      const d = parseDate('2026-11-15');
      expect(formatDate(d)).toBe('2026-11-15');
    });

    test('calculates day differences across month and year boundaries', () => {
      // Month boundary: Nov 28 to Dec 2
      expect(diffDays('2026-11-28', '2026-12-02')).toBe(4);

      // Year boundary: Dec 30, 2026 to Jan 3, 2027
      expect(diffDays('2026-12-30', '2027-01-03')).toBe(4);
    });

    test('adds days across month and year boundaries correctly', () => {
      expect(addDays('2026-11-28', 5)).toBe('2026-12-03');
      expect(addDays('2026-12-28', 6)).toBe('2027-01-03');
      expect(addDays('2026-03-05', -10)).toBe('2026-02-23');
    });

    test('handles invalid date strings gracefully', () => {
      const d = parseDate('invalid-date');
      expect(isNaN(d.getTime())).toBe(true);
      expect(isNaN(diffDays('invalid', '2026-11-01'))).toBe(true);
    });
  });

  describe('analyzeCycleHistory', () => {
    test('returns fallback defaults when no cycles are logged', () => {
      const analysis = analyzeCycleHistory([], 30, 6);
      expect(analysis.cyclesLogged).toBe(0);
      expect(analysis.avgCycleLength).toBe(30);
      expect(analysis.avgPeriodLength).toBe(6);
      expect(analysis.variabilityDays).toBe(0);
      expect(analysis.regularity).toBe('none');
      expect(analysis.lastStart).toBeNull();
    });

    test('analyzes single cycle with insufficient history for variability', () => {
      const cycles: CycleRecord[] = [
        { start: '2026-10-01', end: '2026-10-06' }, // 6 inclusive days
      ];
      const analysis = analyzeCycleHistory(cycles, 28, 5);
      expect(analysis.cyclesLogged).toBe(1);
      expect(analysis.avgPeriodLength).toBe(6);
      expect(analysis.regularity).toBe('insufficient_history');
      expect(analysis.lastStart).toBe('2026-10-01');
    });

    test('analyzes regular cycle history', () => {
      const cycles: CycleRecord[] = [
        { start: '2026-07-01', end: '2026-07-06' },
        { start: '2026-07-29', end: '2026-08-03' }, // 28 days
        { start: '2026-08-26', end: '2026-08-31' }, // 28 days
        { start: '2026-09-23', end: '2026-09-28' }, // 28 days
      ];
      const analysis = analyzeCycleHistory(cycles);
      expect(analysis.cyclesLogged).toBe(4);
      expect(analysis.avgCycleLength).toBe(28);
      expect(analysis.avgPeriodLength).toBe(6);
      expect(analysis.regularity).toBe('regular');
      expect(analysis.variabilityDays).toBeLessThanOrEqual(2);
      expect(analysis.lastStart).toBe('2026-09-23');
    });

    test('detects irregular cycles with high variability and adjusts buffer', () => {
      const cycles: CycleRecord[] = [
        { start: '2026-06-01', end: '2026-06-06' },
        { start: '2026-06-25', end: '2026-06-30' }, // 24 days
        { start: '2026-07-31', end: '2026-08-05' }, // 36 days
        { start: '2026-08-27', end: '2026-09-01' }, // 27 days
        { start: '2026-10-05', end: '2026-10-10' }, // 39 days
      ];
      const analysis = analyzeCycleHistory(cycles);
      expect(analysis.regularity).toBe('variable');
      expect(analysis.variabilityDays).toBeGreaterThan(2);
    });
  });

  describe('predictPeriodTravelOverlap', () => {
    test('returns "Prediction unavailable" when no cycles exist', () => {
      const result = predictPeriodTravelOverlap(
        '2026-11-15',
        '2026-11-20',
        [],
        28,
        5,
        '2026-10-28'
      );

      expect(result.status).toBe('unavailable');
      expect(result.label).toBe('Prediction unavailable');
      expect(result.estimatedPeriodWindow).toBeNull();
      expect(result.explanation).toContain('No cycle history has been recorded yet');
    });

    test('detects "Possible overlap" when trip directly falls in predicted window', () => {
      // Last period was Oct 1, 2026. 28-day cycle -> next period projected around Oct 29 - Nov 3.
      const cycles: CycleRecord[] = [
        { start: '2026-09-03', end: '2026-09-08' },
        { start: '2026-10-01', end: '2026-10-06' },
      ];

      const result = predictPeriodTravelOverlap(
        '2026-10-30',
        '2026-11-04',
        cycles,
        28,
        5,
        '2026-10-15'
      );

      expect(result.status).toBe('overlap');
      expect(result.label).toBe('Possible overlap');
      expect(result.estimatedPeriodWindow).not.toBeNull();
      expect(result.explanation).toContain('estimated period window');
    });

    test('detects "Possible overlap" for partial overlap with start/end buffer', () => {
      // Period window Oct 29 - Nov 3 with +/- 2 day buffer: Oct 27 - Nov 5
      const cycles: CycleRecord[] = [
        { start: '2026-10-01', end: '2026-10-06' },
      ];

      // Trip starts right before and enters the buffer window
      const result = predictPeriodTravelOverlap(
        '2026-10-25',
        '2026-10-28',
        cycles,
        28,
        5,
        '2026-10-15'
      );

      expect(result.status).toBe('overlap');
      expect(result.label).toBe('Possible overlap');
    });

    test('detects "Overlap unlikely" when trip is safely outside period window', () => {
      // Last period Oct 1, 2026. Next period ~Oct 29. Trip is mid-cycle: Oct 12 to Oct 18.
      const cycles: CycleRecord[] = [
        { start: '2026-10-01', end: '2026-10-06' },
      ];

      const result = predictPeriodTravelOverlap(
        '2026-10-12',
        '2026-10-18',
        cycles,
        28,
        5,
        '2026-10-08'
      );

      expect(result.status).toBe('unlikely');
      expect(result.label).toBe('Overlap unlikely');
      expect(result.explanation).toContain('fall outside your estimated period window');
    });

    test('projects multiple future cycles for a trip several months ahead across year boundary', () => {
      // Last period: Oct 1, 2026.
      // 28-day cycle -> cycle 1: Oct 29, cycle 2: Nov 26, cycle 3: Dec 24, cycle 4: Jan 21, 2027.
      const cycles: CycleRecord[] = [
        { start: '2026-10-01', end: '2026-10-06' },
      ];

      const result = predictPeriodTravelOverlap(
        '2027-01-20',
        '2027-01-25',
        cycles,
        28,
        5,
        '2026-10-15'
      );

      expect(result.status).toBe('overlap');
      expect(result.label).toBe('Possible overlap');
      expect(result.estimatedPeriodWindow?.start.startsWith('2027-01')).toBe(true);
    });

    test('accounts for irregular history by widening uncertainty buffer', () => {
      const irregularCycles: CycleRecord[] = [
        { start: '2026-06-01', end: '2026-06-05' },
        { start: '2026-06-25', end: '2026-06-30' },
        { start: '2026-08-01', end: '2026-08-06' },
        { start: '2026-09-02', end: '2026-09-07' },
        { start: '2026-10-04', end: '2026-10-09' },
      ];

      const result = predictPeriodTravelOverlap(
        '2026-10-31',
        '2026-11-05',
        irregularCycles,
        28,
        5,
        '2026-10-15'
      );

      expect(result.regularity).toBe('variable');
      expect(result.bufferDays).toBeGreaterThan(2);
      expect(result.disclaimer).toContain('calculated estimates');
    });

    test('never produces fabricated percentage numbers', () => {
      const cycles: CycleRecord[] = [
        { start: '2026-10-01', end: '2026-10-06' },
      ];

      const result = predictPeriodTravelOverlap(
        '2026-10-20',
        '2026-10-25',
        cycles,
        28,
        5,
        '2026-10-15'
      );

      // Verification that neither label nor explanation contains fabricated percentages like "78%"
      expect(result.label).toMatch(/^(Possible overlap|Overlap unlikely|Prediction unavailable)$/);
      expect(result.explanation).not.toMatch(/\d+%/);
    });
  });
});
