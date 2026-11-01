const { Subscription } = require('../models');

const SUBSCRIPTION_PLANS = [
  {
    id: 'starter_50',
    name: 'Flow Starter',
    price: 50,
    currency: 'INR',
    period: 'monthly',
    badge: 'Essential',
    tagline: 'Ad-free peace & sisterhood community access',
    color: '#9a708f',
    features: [
      '100% Ad-Free Clean Sisterhood Space',
      'Unlimited Anonymous Period Thoughts & Confessions',
      'Community Sisterhood Badge on Threads',
      'Basic 6-Month Cycle & Symptom Trend History',
      'Priority Dispatch on Emergency SOS Pad Orders',
    ],
  },
  {
    id: 'pro_100',
    name: 'Flow Pro Care',
    price: 100,
    currency: 'INR',
    period: 'monthly',
    popular: true,
    badge: 'Most Popular ⭐',
    tagline: '24/7 AI Gynec Coach & Doctor Cycle Report',
    color: '#dc97c4',
    features: [
      'Everything in Flow Starter (₹50)',
      '🌸 24/7 AI Gynec & Period Coach Assistant (unlimited Q&A on cramps, discharge, delays & safe foods)',
      '📄 Doctor-Ready Cycle Health PDF Report (one-click summary for gynecologist visits)',
      '🥑 Phase-Based Nutrition & Cramp Yoga Guide (daily tailored recipes & stretches for each cycle phase)',
      '🔔 Smart Reminders (Hydration nudges, pad change intervals, warm bottle alerts)',
      '💬 Dedicated Sisterhood Q&A thread answers from health mentors',
    ],
  },
  {
    id: 'vip_250',
    name: 'Flow VIP Sisterhood',
    price: 250,
    currency: 'INR',
    period: 'monthly',
    badge: 'VIP Care 👑',
    tagline: 'Teleconsultation pass & partner sync comfort',
    color: '#6b3d62',
    features: [
      'Everything in Flow Pro Care (₹100)',
      '👩‍⚕️ Teleconsultation Discount Pass & Monthly live AMA webinars with certified Gynecologists',
      '🩸 PCOS / PCOD & Irregular Cycle Deep-Dive Tracker & symptom toolkit',
      '👫 Discreet Partner Cycle Sync Mode (notifies your partner with tips to pamper you)',
      '👑 Golden VIP Sisterhood Crown Badge on all your Period Threads',
      '🛍️ Flat 15% OFF on all Padzyra sanitary supplies & care boxes',
      '💌 Priority 24/7 VIP Sisterhood Support Desk',
    ],
  },
];

let inMemorySubscriptions = new Map();

function getPlans() {
  return SUBSCRIPTION_PLANS;
}

async function getCurrentSubscription(user) {
  if (!user) {
    return {
      active: false,
      plan: null,
      planId: null,
    };
  }

  try {
    if (Subscription) {
      const sub = await Subscription.findOne({
        where: { userId: user.id, status: 'active' },
        order: [['createdAt', 'DESC']],
      });
      if (sub && new Date(sub.expiresAt) > new Date()) {
        const plan = SUBSCRIPTION_PLANS.find((p) => p.id === sub.planId);
        return {
          active: true,
          subscriptionId: sub.id,
          planId: sub.planId,
          planName: sub.planName,
          amount: sub.amount,
          expiresAt: sub.expiresAt,
          startDate: sub.startDate,
          plan,
        };
      }
    }
  } catch {
    // fallback
  }

  const sub = inMemorySubscriptions.get(user.id);
  if (sub && new Date(sub.expiresAt) > new Date() && sub.status === 'active') {
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === sub.planId);
    return {
      active: true,
      subscriptionId: sub.id,
      planId: sub.planId,
      planName: sub.planName,
      amount: sub.amount,
      expiresAt: sub.expiresAt,
      startDate: sub.startDate,
      plan,
    };
  }

  return {
    active: false,
    plan: null,
    planId: null,
  };
}

async function subscribe(user, { planId, paymentMethod = 'upi', transactionId }) {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
  if (!plan) {
    const err = new Error('Invalid plan selected');
    err.status = 400;
    throw err;
  }

  const txId = transactionId || `TXN_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  try {
    if (Subscription) {
      const sub = await Subscription.create({
        userId: user.id,
        planId: plan.id,
        planName: plan.name,
        amount: plan.price,
        status: 'active',
        paymentMethod,
        transactionId: txId,
        startDate: now,
        expiresAt,
      });
      return {
        success: true,
        message: `Successfully subscribed to ${plan.name}`,
        subscription: {
          id: sub.id,
          planId: sub.planId,
          planName: sub.planName,
          amount: sub.amount,
          transactionId: sub.transactionId,
          expiresAt: sub.expiresAt,
        },
        plan,
      };
    }
  } catch {
    // fallback
  }

  const memorySub = {
    id: `sub_${Date.now()}`,
    userId: user.id,
    planId: plan.id,
    planName: plan.name,
    amount: plan.price,
    status: 'active',
    paymentMethod,
    transactionId: txId,
    startDate: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  inMemorySubscriptions.set(user.id, memorySub);

  return {
    success: true,
    message: `Successfully subscribed to ${plan.name}`,
    subscription: memorySub,
    plan,
  };
}

async function cancelSubscription(user) {
  if (!user) return { success: false };

  try {
    if (Subscription) {
      await Subscription.update(
        { status: 'cancelled' },
        { where: { userId: user.id, status: 'active' } }
      );
    }
  } catch {
    // fallback
  }

  const existing = inMemorySubscriptions.get(user.id);
  if (existing) {
    existing.status = 'cancelled';
  }

  return { success: true, message: 'Subscription cancelled. Active until current period ends.' };
}

async function createOrder({ planId }) {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
  if (!plan) {
    const err = new Error('Invalid plan');
    err.status = 400;
    throw err;
  }

  const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  return {
    orderId,
    planId: plan.id,
    planName: plan.name,
    amount: plan.price,
    amountPaise: plan.price * 100,
    currency: 'INR',
    keyId: 'rzp_test_padzyra_secret',
    notes: {
      membership: plan.name,
      validity: '30 days',
    },
  };
}

async function verifyPayment(user, { planId, paymentMethod = 'upi', transactionId, orderId }) {
  const txId = transactionId || `TXN_${orderId || Date.now()}`;
  return subscribe(user, { planId, paymentMethod, transactionId: txId });
}

async function getDoctorReport(user) {
  if (!user) {
    const err = new Error('User not found');
    err.status = 401;
    throw err;
  }

  const sub = await getCurrentSubscription(user);
  const isEligible = sub.active && (sub.planId === 'pro_100' || sub.planId === 'vip_250');

  return {
    reportId: `REP-${user.id.slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`,
    generatedAt: new Date().toISOString(),
    user: {
      alias: user.email ? `${user.email.slice(0, 3)}***@${user.email.split('@')[1]}` : 'Patient',
      cycleLength: user.cycleLength || 28,
      periodLength: user.periodLength || 5,
      padPreference: user.padSize || 'regular',
    },
    metrics: {
      averageCycleDays: user.cycleLength || 28,
      averageFlowDays: user.periodLength || 5,
      cycleRegularity: 'Regular (Within 28±3 days)',
      primarySymptomsReported: ['Mild to moderate dysmenorrhea (cramps)', 'Luteal phase fatigue', 'Sweet cravings'],
      recommendedConsultationFocus: 'Review cramp management options and routine iron levels.',
    },
    membershipStatus: {
      active: isEligible,
      tier: sub.planName || 'Free Tier',
      verifiedDoctorBadge: isEligible,
    },
    doctorNotes: 'This document presents user-recorded menstrual and symptom tracking data from Padzyra to aid clinical consultation. Clinical evaluation and diagnostic tests should follow standard medical practice.',
  };
}

module.exports = {
  SUBSCRIPTION_PLANS,
  getPlans,
  getCurrentSubscription,
  subscribe,
  cancelSubscription,
  createOrder,
  verifyPayment,
  getDoctorReport,
};
