const { inQuiet, inWindow, shiftHM } = require('../utils/dates');

function changeHour(hm) {
  const hour = hm.slice(0, 2);
  return ['08', '12', '16', '20'].includes(hour) ? hour : null;
}

function instruction(state, hm, user) {
  if (state.inPeriod && inWindow(hm, user.lunch || '13:00', 60)) return 'lunch';
  if (state.inPeriod && inWindow(hm, '21:00', 60)) return 'night';
  if (state.inPeriod && inWindow(hm, shiftHM(user.leaveHome || '08:00', -30), 60)) return 'leave';
  if (state.inPeriod && state.day === 1 && user.heat && inWindow(hm, user.heat, 60)) return 'heat';
  if (state.endedYesterday && inWindow(hm, '08:00', 240)) return 'laundry';
  if (state.heavy && state.inPeriod && state.day === 2 && inWindow(hm, '08:00', 180)) return 'heavy';
  if (state.inPeriod && changeHour(hm)) return 'change';
  if (state.inPeriod) return 'period';
  if (state.inDays === 1) return 'eve';
  if (state.inDays === 2) return 'pack';
  if (state.pms) return 'pms';
  if (state.late) return 'late';
  if (state.move) return 'move';
  if (state.low) return 'low';
  return null;
}

function pushKind(state, hm, user) {
  const focus = instruction(state, hm, user);
  if (!focus) return null;
  if (inQuiet(hm, user.quietStart, user.quietEnd) && focus !== 'lunch') return null;
  if (focus === 'change') return `chg${hm.slice(0, 2)}`;
  return focus;
}

function dashboard(state, hm, user) {
  const body = { bag: state.bag };
  if (state.inPeriod) {
    body.day = state.day;
    body.of = state.of;
    body.until = state.until;
  } else if (state.inDays != null) {
    body.inDays = state.inDays;
  }
  const focus = instruction(state, hm, user);
  if (state.low && !state.move && focus !== 'low') body.low = true;
  if (state.move) body.move = state.move;
  if (focus) body.focus = focus;
  return body;
}

const CHECKLIST = ['Day pad', 'Night pad', 'Liner', 'Dark underwear', 'Pain relief', 'Disposal bag', 'Hot water bag'];

function checklist(state) {
  const due = state.inDays != null && state.inDays >= 0 && state.inDays <= 2;
  if (!due) return [];
  return [...CHECKLIST];
}

module.exports = { instruction, pushKind, dashboard, checklist };
