export interface CycleRecord {
  id?: string;
  start: string;
  end?: string | null;
  flow?: string | null;
  note?: string | null;
}

export type OverlapStatus = 'overlap' | 'unlikely' | 'unavailable';
export type CycleRegularity = 'regular' | 'variable' | 'insufficient_history' | 'none';

export interface PeriodPredictionResult {
  status: OverlapStatus;
  label: 'Possible overlap' | 'Overlap unlikely' | 'Prediction unavailable';
  regularity: CycleRegularity;
  explanation: string;
  disclaimer: string;
  estimatedPeriodWindow: {
    start: string;
    end: string;
  } | null;
  bufferDays: number;
  tripWindow: {
    start: string;
    end: string;
    days: number;
  };
  isPastTrip: boolean;
  daysUntilTrip: number;
  stats: {
    avgCycleLength: number;
    avgPeriodLength: number;
    variabilityDays: number;
    cyclesLogged: number;
    lastRecordedPeriodStart: string | null;
  };
}

/**
 * Parses YYYY-MM-DD safely into Date object at midnight UTC
 */
export function parseDate(iso: string): Date {
  const parts = iso.split('-').map((p) => parseInt(p, 10));
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return new Date(NaN);
  }
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
}

/**
 * Formats a Date to YYYY-MM-DD
 */
export function formatDate(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Difference in days between two ISO date strings (d2 - d1)
 */
export function diffDays(d1Iso: string, d2Iso: string): number {
  const t1 = parseDate(d1Iso).getTime();
  const t2 = parseDate(d2Iso).getTime();
  return Math.round((t2 - t1) / 86400000);
}

/**
 * Adds days to an ISO date string
 */
export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDate(d);
}

/**
 * Validates whether an ISO string is a valid YYYY-MM-DD date
 */
export function isValidDateString(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = parseDate(iso);
  return !isNaN(d.getTime()) && formatDate(d) === iso;
}

/**
 * Calculates cycle statistics from historical cycle records
 */
export function analyzeCycleHistory(
  cycles: CycleRecord[],
  fallbackCycleLength: number = 28,
  fallbackPeriodLength: number = 5
) {
  const valid = cycles
    .filter((c) => c && isValidDateString(c.start))
    .sort((a, b) => a.start.localeCompare(b.start));

  if (!valid.length) {
    return {
      lastStart: null,
      avgCycleLength: fallbackCycleLength > 0 ? fallbackCycleLength : 28,
      avgPeriodLength: fallbackPeriodLength > 0 ? fallbackPeriodLength : 5,
      variabilityDays: 0,
      regularity: 'none' as CycleRegularity,
      cyclesLogged: 0,
    };
  }

  const lastStart = valid[valid.length - 1].start;

  // Calculate gaps between consecutive cycles
  const gaps: number[] = [];
  for (let i = 1; i < valid.length; i += 1) {
    const gap = diffDays(valid[i - 1].start, valid[i].start);
    // Typical human cycle range 18-55 days
    if (gap >= 18 && gap <= 55) {
      gaps.push(gap);
    }
  }

  let avgCycleLength = fallbackCycleLength || 28;
  let variabilityDays = 2; // baseline uncertainty
  let regularity: CycleRegularity = 'insufficient_history';

  if (gaps.length > 0) {
    const mean = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
    avgCycleLength = Math.round(mean);

    if (gaps.length >= 2) {
      // Standard deviation
      const variance = gaps.reduce((sum, g) => sum + Math.pow(g - mean, 2), 0) / gaps.length;
      const stdDev = Math.sqrt(variance);
      variabilityDays = Math.min(Math.max(Math.round(stdDev), 2), 6);
      regularity = stdDev > 3.5 ? 'variable' : 'regular';
    } else {
      regularity = 'insufficient_history';
      variabilityDays = 3;
    }
  }

  // Calculate average period duration (bleeding days)
  const durations: number[] = [];
  for (const c of valid) {
    if (c.end && isValidDateString(c.end)) {
      const dur = diffDays(c.start, c.end) + 1;
      if (dur >= 2 && dur <= 10) {
        durations.push(dur);
      }
    }
  }

  let avgPeriodLength = fallbackPeriodLength || 5;
  if (durations.length > 0) {
    avgPeriodLength = Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length);
  }

  return {
    lastStart,
    avgCycleLength,
    avgPeriodLength,
    variabilityDays,
    regularity,
    cyclesLogged: valid.length,
  };
}

/**
 * Predicts whether travel dates may overlap with the user's estimated menstrual period window.
 */
export function predictPeriodTravelOverlap(
  tripStart: string,
  tripEnd: string,
  cycles: CycleRecord[],
  userCycleLength: number = 28,
  userPeriodLength: number = 5,
  referenceDateIso: string = new Date().toISOString().slice(0, 10)
): PeriodPredictionResult {
  const tripDays = isValidDateString(tripStart) && isValidDateString(tripEnd)
    ? Math.max(diffDays(tripStart, tripEnd) + 1, 1)
    : 1;

  const tripWindow = {
    start: tripStart,
    end: tripEnd,
    days: tripDays,
  };

  const daysUntilTrip = isValidDateString(tripStart)
    ? diffDays(referenceDateIso, tripStart)
    : 0;

  const isPastTrip = isValidDateString(tripEnd) && tripEnd < referenceDateIso;

  const DISCLAIMER =
    'Menstrual cycle predictions are calculated estimates for travel preparation, not medical guarantees. Cycles naturally vary with travel, stress, sleep, and hormonal changes.';

  const stats = analyzeCycleHistory(cycles, userCycleLength, userPeriodLength);

  // If no cycle dates have been logged at all
  if (!stats.lastStart) {
    return {
      status: 'unavailable',
      label: 'Prediction unavailable',
      regularity: 'none',
      explanation:
        'No cycle history has been recorded yet. Log your last period start date in the calendar to enable period travel overlap estimation, or plan your travel packing checklist without prediction.',
      disclaimer: DISCLAIMER,
      estimatedPeriodWindow: null,
      bufferDays: 0,
      tripWindow,
      isPastTrip,
      daysUntilTrip,
      stats: {
        avgCycleLength: stats.avgCycleLength,
        avgPeriodLength: stats.avgPeriodLength,
        variabilityDays: 0,
        cyclesLogged: 0,
        lastRecordedPeriodStart: null,
      },
    };
  }

  // Project cycles forward and backward around the trip window
  const cycleLen = stats.avgCycleLength;
  const periodLen = stats.avgPeriodLength;
  const buffer = stats.variabilityDays;
  const lastStart = stats.lastStart;

  // Determine cycle count distance from lastStart to tripStart
  const diffFromLastStart = diffDays(lastStart, tripStart);
  const minK = Math.floor((diffFromLastStart - 60) / cycleLen);
  const maxK = Math.ceil((diffFromLastStart + tripDays + 60) / cycleLen) + 1;

  let hasDirectOverlap = false;
  let hasBufferOverlap = false;
  let closestWindow: { start: string; end: string } | null = null;
  let minDistanceToTrip = Infinity;

  for (let k = Math.min(minK, -2); k <= Math.max(maxK, 15); k += 1) {
    const estPeriodStart = addDays(lastStart, k * cycleLen);
    const estPeriodEnd = addDays(estPeriodStart, periodLen - 1);

    const bufferedStart = addDays(estPeriodStart, -buffer);
    const bufferedEnd = addDays(estPeriodEnd, buffer);

    // Overlap checks: max(start1, start2) <= min(end1, end2)
    const directOverlap =
      tripStart <= estPeriodEnd && tripEnd >= estPeriodStart;

    const bufferOverlap =
      tripStart <= bufferedEnd && tripEnd >= bufferedStart;

    if (directOverlap) {
      hasDirectOverlap = true;
      closestWindow = { start: estPeriodStart, end: estPeriodEnd };
      break;
    }

    if (bufferOverlap) {
      hasBufferOverlap = true;
      if (!closestWindow) {
        closestWindow = { start: estPeriodStart, end: estPeriodEnd };
      }
    }

    // Keep track of the temporally closest period window to display on timeline
    const distToTrip = Math.min(
      Math.abs(diffDays(estPeriodStart, tripStart)),
      Math.abs(diffDays(estPeriodEnd, tripEnd))
    );
    if (distToTrip < minDistanceToTrip) {
      minDistanceToTrip = distToTrip;
      if (!hasBufferOverlap && !hasDirectOverlap) {
        closestWindow = { start: estPeriodStart, end: estPeriodEnd };
      }
    }
  }

  if (hasDirectOverlap || hasBufferOverlap) {
    const reason = hasDirectOverlap
      ? `Your travel dates (${tripStart} to ${tripEnd}) directly coincide with your estimated period window (${closestWindow?.start} to ${closestWindow?.end}).`
      : `Based on your historical cycle variation (±${buffer} days), your period window (${closestWindow?.start} to ${closestWindow?.end}) may overlap with your trip dates.`;

    return {
      status: 'overlap',
      label: 'Possible overlap',
      regularity: stats.regularity,
      explanation: reason,
      disclaimer: DISCLAIMER,
      estimatedPeriodWindow: closestWindow,
      bufferDays: buffer,
      tripWindow,
      isPastTrip,
      daysUntilTrip,
      stats: {
        avgCycleLength: stats.avgCycleLength,
        avgPeriodLength: stats.avgPeriodLength,
        variabilityDays: buffer,
        cyclesLogged: stats.cyclesLogged,
        lastRecordedPeriodStart: stats.lastStart,
      },
    };
  }

  return {
    status: 'unlikely',
    label: 'Overlap unlikely',
    regularity: stats.regularity,
    explanation: closestWindow
      ? `Your travel dates fall outside your estimated period window (nearest predicted: ${closestWindow.start} to ${closestWindow.end}). Keep a couple of emergency pads handy just in case.`
      : 'Your travel dates are not expected to overlap with your menstrual cycle window based on your cycle timing.',
    disclaimer: DISCLAIMER,
    estimatedPeriodWindow: closestWindow,
    bufferDays: buffer,
    tripWindow,
    isPastTrip,
    daysUntilTrip,
    stats: {
      avgCycleLength: stats.avgCycleLength,
      avgPeriodLength: stats.avgPeriodLength,
      variabilityDays: buffer,
      cyclesLogged: stats.cyclesLogged,
      lastRecordedPeriodStart: stats.lastStart,
    },
  };
}
