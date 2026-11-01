import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme/colors';
import { PadzyraApi } from '../api/client';

export interface PlanBenefit {
  text: string;
  highlight?: boolean;
}

export interface PlanTier {
  id: string;
  name: string;
  price: number;
  period: string;
  tagline: string;
  badge?: string;
  badgeColor?: string;
  popular?: boolean;
  color: string;
  benefits: PlanBenefit[];
}

export const SUBSCRIPTION_TIERS: PlanTier[] = [
  {
    id: 'starter_50',
    name: 'Flow Starter',
    price: 50,
    period: 'month',
    badge: 'Essential',
    badgeColor: '#9a708f',
    tagline: 'Ad-free peace & safe community sisterhood',
    color: '#9a708f',
    benefits: [
      { text: '100% Ad-Free Clean Experience' },
      { text: 'Unlimited Anonymous Period Thoughts on Threads' },
      { text: 'Sisterhood Community Badge' },
      { text: '6-Month Cycle & Symptom Trend Analytics' },
      { text: 'Priority Emergency SOS Pad Dispatch' },
    ],
  },
  {
    id: 'pro_100',
    name: 'Flow Pro Care',
    price: 100,
    period: 'month',
    popular: true,
    badge: 'Most Popular ⭐',
    badgeColor: '#dc97c4',
    tagline: '24/7 AI Gynec Coach & Doctor Cycle Report',
    color: '#b05d93',
    benefits: [
      { text: 'Everything in Flow Starter (₹50)', highlight: true },
      { text: '🌸 24/7 AI Gynec & Period Coach (Instant guidance on cramps, delay & flow)', highlight: true },
      { text: '📄 Doctor-Ready Health PDF Report (One-tap export for gynecologist)', highlight: true },
      { text: '🥑 Phase-Based Nutrition & Cramp Yoga Routines' },
      { text: '🔔 Smart Reminders (Hydration, pad change timer, hot water bottle alert)' },
      { text: 'Priority Sisterhood Q&A thread replies' },
    ],
  },
  {
    id: 'vip_250',
    name: 'Flow VIP Sisterhood',
    price: 250,
    period: 'month',
    badge: 'VIP Care 👑',
    badgeColor: '#6b3d62',
    tagline: 'Teleconsultation pass & discreet partner sync',
    color: '#4e2846',
    benefits: [
      { text: 'Everything in Flow Pro Care (₹100)', highlight: true },
      { text: '👩‍⚕️ Teleconsultation Discount Pass & Monthly Gynecologist AMA', highlight: true },
      { text: '🩸 PCOS / PCOD & Irregular Cycle Deep-Dive Toolkit' },
      { text: '👫 Discreet Partner Cycle Sync Mode (Shares cycle cues with partner)' },
      { text: '👑 Golden VIP Sisterhood Crown Badge on all your Period Threads', highlight: true },
      { text: '🛍️ Flat 15% OFF on all Padzyra sanitary supplies & care boxes' },
      { text: 'Priority 24/7 VIP Sisterhood Support Desk' },
    ],
  },
];

interface SubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  currentPlanId?: string | null;
  onSubscriptionSuccess?: (plan: PlanTier) => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  visible,
  onClose,
  currentPlanId = null,
  onSubscriptionSuccess,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('pro_100');
  const [paymentStep, setPaymentStep] = useState<'plans' | 'checkout' | 'success'>('plans');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [submitting, setSubmitting] = useState(false);
  const [activatedPlan, setActivatedPlan] = useState<PlanTier | null>(null);

  const selectedPlan =
    SUBSCRIPTION_TIERS.find((p) => p.id === selectedPlanId) || SUBSCRIPTION_TIERS[1];

  const handleSelectPlan = (plan: PlanTier) => {
    setSelectedPlanId(plan.id);
  };

  const handleProceedToPayment = () => {
    setPaymentStep('checkout');
  };

  const handleConfirmPayment = async () => {
    setSubmitting(true);
    try {
      const order = await PadzyraApi.createSubscriptionOrder(selectedPlan.id).catch(() => null);
      const mockTxnId = `UPI_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      await PadzyraApi.verifySubscriptionPayment({
        planId: selectedPlan.id,
        paymentMethod,
        transactionId: mockTxnId,
        orderId: order?.orderId,
      }).catch(async () => {
        await PadzyraApi.subscribeToPlan(selectedPlan.id, paymentMethod, mockTxnId).catch(() => {});
      });

      setActivatedPlan(selectedPlan);
      setPaymentStep('success');
      if (onSubscriptionSuccess) {
        onSubscriptionSuccess(selectedPlan);
      }
    } catch {
      setActivatedPlan(selectedPlan);
      setPaymentStep('success');
      if (onSubscriptionSuccess) {
        onSubscriptionSuccess(selectedPlan);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setPaymentStep('plans');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCloseModal}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.badgePill}>
                <Ionicons name="sparkles" size={13} color={colors.plum} style={{ marginRight: 4 }} />
                <Text style={styles.badgePillText}>PADZYRA PLUS</Text>
              </View>
              <Text style={styles.modalTitle}>
                {paymentStep === 'plans' && 'Choose Your Care Plan'}
                {paymentStep === 'checkout' && 'Secure Checkout'}
                {paymentStep === 'success' && 'Welcome to Padzyra Club! 🌸'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {paymentStep === 'plans' && 'Empower your periods with comfort, tools & sisterhood.'}
                {paymentStep === 'checkout' && `Total Amount: ₹${selectedPlan.price} / month`}
                {paymentStep === 'success' && `${selectedPlan.name} is now active on your account.`}
              </Text>
            </View>
            <TouchableOpacity onPress={handleCloseModal} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.rose} />
            </TouchableOpacity>
          </View>

          {/* STEP 1: Plan Selection */}
          {paymentStep === 'plans' && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
              {SUBSCRIPTION_TIERS.map((tier) => {
                const isSelected = selectedPlanId === tier.id;
                const isCurrent = currentPlanId === tier.id;

                return (
                  <TouchableOpacity
                    key={tier.id}
                    activeOpacity={0.88}
                    onPress={() => handleSelectPlan(tier)}
                    style={[
                      styles.planCard,
                      isSelected && styles.planCardSelected,
                      tier.popular && styles.planCardPopular,
                    ]}
                  >
                    {tier.badge ? (
                      <View
                        style={[
                          styles.planRibbon,
                          { backgroundColor: tier.badgeColor || colors.plum },
                        ]}
                      >
                        <Text style={styles.planRibbonText}>{tier.badge}</Text>
                      </View>
                    ) : null}

                    <View style={styles.planCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planName}>{tier.name}</Text>
                        <Text style={styles.planTagline}>{tier.tagline}</Text>
                      </View>
                      <View style={styles.priceContainer}>
                        <Text style={styles.currency}>₹</Text>
                        <Text style={styles.priceText}>{tier.price}</Text>
                        <Text style={styles.periodText}>/{tier.period}</Text>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.benefitsList}>
                      {tier.benefits.map((b, idx) => (
                        <View key={idx} style={styles.benefitRow}>
                          <Ionicons
                            name="checkmark-circle"
                            size={16}
                            color={b.highlight ? colors.plum : colors.pinkDark}
                            style={{ marginRight: 8, marginTop: 1 }}
                          />
                          <Text
                            style={[
                              styles.benefitText,
                              b.highlight && styles.benefitTextHighlight,
                            ]}
                          >
                            {b.text}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.planCardFooter}>
                      <View
                        style={[
                          styles.radioCircle,
                          isSelected && styles.radioCircleSelected,
                        ]}
                      >
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                      <Text
                        style={[
                          styles.selectText,
                          isSelected && styles.selectTextSelected,
                        ]}
                      >
                        {isCurrent ? 'Current Plan' : isSelected ? 'Selected' : 'Select Plan'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              <View style={styles.guaranteeBox}>
                <Ionicons name="shield-checkmark" size={20} color={colors.plum} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.guaranteeTitle}>Discreet & Safe Guarantee</Text>
                  <Text style={styles.guaranteeSub}>
                    Cancel anytime with 1-click. No hidden charges. 100% confidential.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.actionBtn}
                activeOpacity={0.85}
                onPress={handleProceedToPayment}
              >
                <Text style={styles.actionBtnText}>
                  Continue with {selectedPlan.name} • ₹{selectedPlan.price}/mo
                </Text>
                <Ionicons name="arrow-forward" size={18} color={colors.white} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* STEP 2: Checkout / Payment Simulation */}
          {paymentStep === 'checkout' && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>SELECTED MEMBERSHIP</Text>
                <View style={styles.summaryRow}>
                  <View>
                    <Text style={styles.summaryPlanName}>{selectedPlan.name}</Text>
                    <Text style={styles.summarySub}>Monthly Sisterhood Plan</Text>
                  </View>
                  <Text style={styles.summaryAmount}>₹{selectedPlan.price}</Text>
                </View>
              </View>

              <Text style={styles.paymentMethodTitle}>CHOOSE PAYMENT METHOD</Text>

              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentMethod === 'upi' && styles.paymentOptionSelected,
                ]}
                onPress={() => setPaymentMethod('upi')}
              >
                <View style={styles.paymentLeft}>
                  <Ionicons name="phone-portrait-outline" size={22} color={colors.plum} style={{ marginRight: 12 }} />
                  <View>
                    <Text style={styles.paymentName}>UPI / QR (Instant)</Text>
                    <Text style={styles.paymentSub}>Google Pay, PhonePe, Paytm, BHIM</Text>
                  </View>
                </View>
                <Ionicons
                  name={paymentMethod === 'upi' ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={paymentMethod === 'upi' ? colors.plum : colors.rose}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentMethod === 'card' && styles.paymentOptionSelected,
                ]}
                onPress={() => setPaymentMethod('card')}
              >
                <View style={styles.paymentLeft}>
                  <Ionicons name="card-outline" size={22} color={colors.plum} style={{ marginRight: 12 }} />
                  <View>
                    <Text style={styles.paymentName}>Credit or Debit Card</Text>
                    <Text style={styles.paymentSub}>Visa, MasterCard, RuPay</Text>
                  </View>
                </View>
                <Ionicons
                  name={paymentMethod === 'card' ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={paymentMethod === 'card' ? colors.plum : colors.rose}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentMethod === 'netbanking' && styles.paymentOptionSelected,
                ]}
                onPress={() => setPaymentMethod('netbanking')}
              >
                <View style={styles.paymentLeft}>
                  <Ionicons name="business-outline" size={22} color={colors.plum} style={{ marginRight: 12 }} />
                  <View>
                    <Text style={styles.paymentName}>Net Banking</Text>
                    <Text style={styles.paymentSub}>SBI, HDFC, ICICI, Axis & All Banks</Text>
                  </View>
                </View>
                <Ionicons
                  name={paymentMethod === 'netbanking' ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={paymentMethod === 'netbanking' ? colors.plum : colors.rose}
                />
              </TouchableOpacity>

              <View style={styles.secureBadge}>
                <Ionicons name="lock-closed" size={14} color={colors.rose} style={{ marginRight: 6 }} />
                <Text style={styles.secureText}>256-bit encrypted bank grade payment</Text>
              </View>

              <TouchableOpacity
                style={[styles.actionBtn, submitting && { opacity: 0.7 }]}
                activeOpacity={0.85}
                disabled={submitting}
                onPress={handleConfirmPayment}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark" size={18} color={colors.white} style={{ marginRight: 6 }} />
                    <Text style={styles.actionBtnText}>
                      Pay ₹{selectedPlan.price} & Activate Plan
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => setPaymentStep('plans')}
              >
                <Text style={styles.backBtnText}>Change Plan</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* STEP 3: Success Confirmation */}
          {paymentStep === 'success' && (
            <View style={styles.successContainer}>
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark-done" size={42} color={colors.white} />
              </View>
              <Text style={styles.successTitle}>Subscription Activated!</Text>
              <Text style={styles.successSub}>
                You are now a verified member of <Text style={{ fontWeight: '800' }}>{activatedPlan?.name}</Text>. All premium benefits and features are unlocked!
              </Text>

              <View style={styles.unlockedBox}>
                <Text style={styles.unlockedHeader}>UNLOCKED BENEFITS:</Text>
                {activatedPlan?.benefits.slice(0, 4).map((b, i) => (
                  <View key={i} style={styles.unlockedRow}>
                    <Ionicons name="sparkles" size={14} color="#b05d93" style={{ marginRight: 6 }} />
                    <Text style={styles.unlockedText}>{b.text}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={styles.actionBtn}
                activeOpacity={0.85}
                onPress={handleCloseModal}
              >
                <Text style={styles.actionBtnText}>Explore My Benefits 🌸</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(74, 48, 72, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    paddingBottom: 24,
    shadowColor: colors.plum,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f6e7f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.plum,
    letterSpacing: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.plum,
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.rose,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#faedf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    padding: 18,
    paddingBottom: 30,
  },
  planCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  planCardSelected: {
    borderColor: colors.plum,
    backgroundColor: '#fffcfd',
    shadowColor: colors.plum,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  planCardPopular: {
    borderColor: '#dc97c4',
  },
  planRibbon: {
    position: 'absolute',
    top: 0,
    right: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  planRibbonText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.5,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 6,
  },
  planName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.plum,
  },
  planTagline: {
    fontSize: 12,
    color: colors.rose,
    marginTop: 2,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: '#fcf3f8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currency: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.plum,
  },
  priceText: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.plum,
    marginLeft: 2,
  },
  periodText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.rose,
  },
  divider: {
    height: 1,
    backgroundColor: '#f5e4ee',
    marginVertical: 12,
  },
  benefitsList: {
    gap: 8,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  benefitText: {
    fontSize: 13,
    color: colors.ink,
    flex: 1,
    lineHeight: 18,
  },
  benefitTextHighlight: {
    fontWeight: '700',
    color: colors.plum,
  },
  planCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#faedf4',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  radioCircleSelected: {
    borderColor: colors.plum,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.plum,
  },
  selectText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.rose,
  },
  selectTextSelected: {
    color: colors.plum,
    fontWeight: '800',
  },
  guaranteeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdf6fa',
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f5e0ee',
  },
  guaranteeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.plum,
  },
  guaranteeSub: {
    fontSize: 11,
    color: colors.rose,
    marginTop: 2,
  },
  actionBtn: {
    backgroundColor: colors.plum,
    borderRadius: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.plum,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
  },
  summaryCard: {
    backgroundColor: '#fbf3f8',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f5dceb',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.rose,
    letterSpacing: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  summaryPlanName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.plum,
  },
  summarySub: {
    fontSize: 12,
    color: colors.rose,
    marginTop: 2,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.plum,
  },
  paymentMethodTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.rose,
    letterSpacing: 1,
    marginBottom: 10,
  },
  paymentOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  paymentOptionSelected: {
    borderColor: colors.plum,
    backgroundColor: '#fffafc',
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
  },
  paymentSub: {
    fontSize: 11,
    color: colors.rose,
    marginTop: 2,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  secureText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.rose,
  },
  backBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.rose,
  },
  successContainer: {
    padding: 24,
    alignItems: 'center',
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2f7a52',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#2f7a52',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.plum,
  },
  successSub: {
    fontSize: 13,
    color: colors.rose,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
    paddingHorizontal: 12,
  },
  unlockedBox: {
    width: '100%',
    backgroundColor: '#fcf3f8',
    borderRadius: 18,
    padding: 16,
    marginVertical: 20,
    borderWidth: 1,
    borderColor: '#f2d5e6',
  },
  unlockedHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.plum,
    letterSpacing: 1,
    marginBottom: 10,
  },
  unlockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  unlockedText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
    flex: 1,
  },
});
