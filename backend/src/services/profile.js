function profile(user) {
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    discreet: user.discreet,
    padSize: user.padSize,
    price: Number(user.price),
    cycleLength: user.cycleLength,
    periodLength: user.periodLength,
    quietStart: user.quietStart,
    quietEnd: user.quietEnd,
    leaveHome: user.leaveHome,
    lunch: user.lunch,
    heat: user.heat,
    pin: Boolean(user.pinHash),
    aiCycleConsent: Boolean(user.aiCycleConsent),
    aiLanguage: user.aiLanguage || 'en',
  };
}

module.exports = { profile };
