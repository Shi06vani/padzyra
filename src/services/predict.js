const { diffDays, addDays } = require('../utils/dates');

function averageLength(cycles, fallback) {
  const starts = cycles.map((cycle) => cycle.start).sort();
  const gaps = [];
  for (let i = 1; i < starts.length; i += 1) {
    const gap = diffDays(starts[i - 1], starts[i]);
    if (gap >= 15 && gap <= 60) gaps.push(gap);
  }
  if (!gaps.length) return fallback;
  return Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length);
}

function summarize(cycles, user, today) {
  const sorted = cycles
    .filter((cycle) => cycle.start)
    .sort((a, b) => a.start.localeCompare(b.start));
  const open = [...sorted].reverse().find((cycle) => cycle.start <= today && (!cycle.end || cycle.end >= today));
  const avg = averageLength(sorted, user.cycleLength);
  const inPeriod = Boolean(open);
  let inDays = null;
  let until = null;

  if (inPeriod) {
    until = open.end || addDays(open.start, user.periodLength - 1);
  } else if (sorted.length) {
    const last = sorted[sorted.length - 1];
    inDays = diffDays(today, addDays(last.start, avg));
  }

  const heavy = sorted.filter((cycle) => cycle.flow === 'heavy').length >= 2;

  return {
    cycles: sorted,
    open,
    inPeriod,
    day: inPeriod ? diffDays(open.start, today) + 1 : null,
    of: user.periodLength,
    until,
    inDays,
    late: inDays != null && inDays <= -7,
    pms: inDays != null && inDays >= 3 && inDays <= 5,
    endedYesterday: sorted.some((cycle) => cycle.end === addDays(today, -1)),
    heavy,
  };
}

module.exports = { summarize };
