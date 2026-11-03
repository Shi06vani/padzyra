import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
  Modal,
} from 'react-native';
import { colors } from '../theme/colors';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Card } from '../components/Card';
import { TabKey } from '../components/BottomTabBar';
import { PadzyraApi } from '../api/client';
import { AiCoachModal } from '../components/AiCoachModal';
import { SubscriptionModal } from '../components/SubscriptionModal';

interface HomeScreenProps {
  onNavigateToNow: () => void;
  onRequestPin: () => void;
  onNavigateToEmergency?: () => void;
  onNavigateToTab?: (tab: TabKey) => void;
}

const FOCUS_TEXTS: Record<string, string> = {
  lunch: 'Change at lunch time for fresh comfort.',
  night: 'Keep a night pad ready by the bedside.',
  leave: 'Double check: is your emergency pouch packed?',
  heat: 'Warm heat pack helps soothe pelvic tension.',
  laundry: 'Light warm wash for clothing & sheets.',
  heavy: 'Heavier flow expected. Keep an extra pad handy.',
  change: 'It has been 4 hours — time for a fresh pad.',
  period: 'Period may begin today. Stay prepared.',
  eve: 'Restock your bag pouch before bed.',
  pack: 'Review your essentials checklist before heading out.',
  pms: 'Premenstrual phase — prioritize hydration and rest.',
  late: 'Cycle is delayed. Normal fluctuations happen, consult a doctor if prolonged.',
  move: 'Transfer fresh pads from home to your bag tonight.',
  low: 'Bag pad count is low. Restock recommended.',
  trip: 'Packing extra pads for your travel plans.',
  follow: 'Bag supply still low. Refill today.',
};

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigateToNow,
  onRequestPin,
  onNavigateToEmergency,
  onNavigateToTab,
}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<any>({});
  const [supplies, setSupplies] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [feelings, setFeelings] = useState<{ cramps?: string; mood?: string }>({});
  const [error, setError] = useState('');

  // App Flow Guide modal
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Stock updater states
  const [showStockForm, setShowStockForm] = useState(false);
  const [stockPlace, setStockPlace] = useState<'bag' | 'home'>('bag');
  const [stockKind, setStockKind] = useState<'day' | 'night'>('day');
  const [stockQty, setStockQty] = useState('2');
  const [savingStock, setSavingStock] = useState(false);
  const [showAiCoach, setShowAiCoach] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError('');
      const todayIso = new Date().toISOString().slice(0, 10);
      const [dashData, suppData, listData, ordersData] = await Promise.all([
        PadzyraApi.getDashboard().catch((e) => {
          if (e?.message === 'PIN required') onRequestPin();
          throw e;
        }),
        PadzyraApi.getSupplies().catch(() => []),
        PadzyraApi.getChecklist().catch(() => []),
        PadzyraApi.getOrders().catch(() => []),
      ]);

      setDashboard(dashData || {});
      setSupplies(suppData || []);
      setChecklist(listData || []);
      setOrders(ordersData || []);

      const feelData = await PadzyraApi.getDayFeelings(todayIso).catch(() => ({}));
      setFeelings(feelData || {});
    } catch (err: any) {
      if (err?.message !== 'PIN required') {
        setError(err?.message || 'Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onRequestPin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStartCycle = async () => {
    try {
      await PadzyraApi.startCycle();
      loadData();
    } catch (err: any) {
      Alert.alert('Notice', err?.message || 'Could not start cycle');
    }
  };

  const handleEndCycle = async () => {
    try {
      await PadzyraApi.endCycle();
      loadData();
    } catch (err: any) {
      Alert.alert('Notice', err?.message || 'Could not end cycle');
    }
  };

  const handleUsePad = async () => {
    try {
      await PadzyraApi.useSupply('bag', 'day', 1);
      loadData();
    } catch (err: any) {
      Alert.alert('Notice', err?.message || 'Could not log pad usage');
    }
  };

  const handleFeelChange = async (type: 'cramps' | 'mood', value: string) => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const updated = { ...feelings, [type]: value };
    setFeelings(updated);
    try {
      await PadzyraApi.saveDayFeelings(todayIso, updated);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not save feeling');
    }
  };

  const handlePickedUp = async (orderId: string) => {
    try {
      await PadzyraApi.markOrderPickedUp(orderId);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not confirm pickup');
    }
  };

  const handleSaveStock = async () => {
    const qty = parseInt(stockQty, 10);
    if (isNaN(qty) || qty < 0) {
      Alert.alert('Invalid', 'Please enter a valid pad quantity');
      return;
    }
    setSavingStock(true);
    try {
      await PadzyraApi.updateSupplies(stockPlace, stockKind, qty);
      setShowStockForm(false);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not update supplies');
    } finally {
      setSavingStock(false);
    }
  };

  const getQty = (place: 'bag' | 'home', kind: 'day' | 'night') => {
    const item = supplies.find((s) => s.place === place && s.kind === kind);
    return item ? item.qty : 0;
  };

  const bagDay = getQty('bag', 'day');
  const bagNight = getQty('bag', 'night');
  const homeDay = getQty('home', 'day');
  const homeNight = getQty('home', 'night');

  const readyOrders = orders.filter((o) => o.status === 'ready' || o.status === 'accepted');

  const getFormattedDate = () => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    };
    return now.toLocaleDateString('en-US', options);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.plum} />
      </View>
    );
  }

  const isPeriodActive = Boolean(dashboard.day);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData();
          }}
          tintColor={colors.plum}
        />
      }
    >
      {/* Top Header Row */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.dateLabel}>{getFormattedDate()}</Text>
          <Text style={styles.greetingTitle}>Padzyra Care</Text>
        </View>

        <View style={styles.headerRightActions}>
          {/* Quick Flow Guide */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.headerGuideButton}
            onPress={() => setShowGuideModal(true)}
          >
            <Ionicons name="compass-outline" size={15} color={colors.plum} />
            <Text style={styles.headerGuideText}>Flow</Text>
          </TouchableOpacity>

          {/* Quick Emergency / SOS Shortcut */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.headerSosButton}
            onPress={onNavigateToEmergency || onNavigateToNow}
          >
            <Ionicons name="flash" size={13} color="#ffffff" style={{ marginRight: 3 }} />
            <Text style={styles.headerSosText}>SOS</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 4-Pillar Quick Action Strip (Icon-First, Zero Clutter) */}
      <View style={styles.quickFlowGrid}>
        <TouchableOpacity
          style={styles.quickFlowCard}
          activeOpacity={0.8}
          onPress={() => (onNavigateToTab ? onNavigateToTab('calendar') : null)}
        >
          <View style={[styles.quickFlowIconCircle, { backgroundColor: '#ffe4e6' }]}>
            <Ionicons name="calendar" size={20} color="#e11d48" />
          </View>
          <Text style={styles.quickFlowLabel}>Cycle</Text>
          <Text style={styles.quickFlowBadge}>{isPeriodActive ? 'Active' : `${dashboard.inDays ?? 28}d left`}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickFlowCard}
          activeOpacity={0.8}
          onPress={() => setShowStockForm(true)}
        >
          <View style={[styles.quickFlowIconCircle, { backgroundColor: '#f3e8ff' }]}>
            <Ionicons name="bag-handle" size={20} color="#9333ea" />
          </View>
          <Text style={styles.quickFlowLabel}>My Bag</Text>
          <Text style={styles.quickFlowBadge}>{bagDay + bagNight} Pads</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickFlowCard}
          activeOpacity={0.8}
          onPress={onNavigateToNow}
        >
          <View style={[styles.quickFlowIconCircle, { backgroundColor: '#e0f2fe' }]}>
            <Ionicons name="storefront" size={20} color="#0284c7" />
          </View>
          <Text style={styles.quickFlowLabel}>Pharmacy</Text>
          <Text style={styles.quickFlowBadge}>Pickup</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickFlowCard}
          activeOpacity={0.8}
          onPress={onNavigateToEmergency}
        >
          <View style={[styles.quickFlowIconCircle, { backgroundColor: '#fee2e2' }]}>
            <Ionicons name="location" size={20} color="#dc2626" />
          </View>
          <Text style={styles.quickFlowLabel}>Restrooms</Text>
          <Text style={[styles.quickFlowBadge, { color: '#dc2626' }]}>Clean</Text>
        </TouchableOpacity>
      </View>

      {/* Visual Journey Bar (Clean, Minimalist 1-2-3-4 Flow) */}
      <View style={styles.journeyBar}>
        <View style={styles.journeyStep}>
          <View style={[styles.journeyDot, { backgroundColor: '#e11d48' }]}>
            <Ionicons name="water" size={11} color="#ffffff" />
          </View>
          <Text style={styles.journeyLabel}>1. Track</Text>
        </View>

        <View style={styles.journeyLine} />

        <View style={styles.journeyStep}>
          <View style={[styles.journeyDot, { backgroundColor: '#9333ea' }]}>
            <Ionicons name="bag-check" size={11} color="#ffffff" />
          </View>
          <Text style={styles.journeyLabel}>2. Pouch</Text>
        </View>

        <View style={styles.journeyLine} />

        <View style={styles.journeyStep}>
          <View style={[styles.journeyDot, { backgroundColor: '#0284c7' }]}>
            <Ionicons name="storefront" size={11} color="#ffffff" />
          </View>
          <Text style={styles.journeyLabel}>3. Pickup</Text>
        </View>

        <View style={styles.journeyLine} />

        <View style={styles.journeyStep}>
          <View style={[styles.journeyDot, { backgroundColor: '#dc2626' }]}>
            <Ionicons name="shield-checkmark" size={11} color="#ffffff" />
          </View>
          <Text style={styles.journeyLabel}>4. SOS</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.warn} style={{ marginRight: 6 }} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Hero Cycle Dial Ring */}
      <View style={styles.cycleCard}>
        <View style={styles.cycleRingOuter}>
          <View style={[styles.cycleRingInner, isPeriodActive && styles.cycleRingInnerActive]}>
            <View style={styles.cycleRingCenter}>
              {/* Status Badge */}
              <View style={[styles.phaseBadge, isPeriodActive && styles.phaseBadgeActive]}>
                <Ionicons
                  name={isPeriodActive ? 'water' : 'calendar-outline'}
                  size={12}
                  color={isPeriodActive ? '#e11d48' : colors.plum}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.phaseBadgeText, isPeriodActive && styles.phaseBadgeTextActive]}>
                  {isPeriodActive ? 'MENSTRUAL FLOW' : 'CYCLE FORECAST'}
                </Text>
              </View>

              {/* Day / Time Counter */}
              {dashboard.day ? (
                <>
                  <Text style={styles.cycleBigNumber}>
                    Day {dashboard.day}
                  </Text>
                  <Text style={styles.cycleSubNumber}>
                    of {dashboard.of || 5} days
                  </Text>
                  {dashboard.until ? (
                    <Text style={styles.cycleMutedNote}>Expected until {dashboard.until}</Text>
                  ) : null}
                </>
              ) : dashboard.inDays != null ? (
                <>
                  <Text style={styles.cycleBigNumber}>
                    {dashboard.inDays < 0
                      ? 'Late'
                      : dashboard.inDays === 0
                      ? 'Today'
                      : `${dashboard.inDays} Days`}
                  </Text>
                  <Text style={styles.cycleSubNumber}>
                    {dashboard.inDays <= 0 ? 'Expected period' : 'Until next period'}
                  </Text>
                  <Text style={styles.cycleMutedNote}>
                    {dashboard.inDays < 0 ? 'Cycle delayed · Normal variations' : 'Predicted based on cycle logs'}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.cycleBigNumber}>Welcome</Text>
                  <Text style={styles.cycleSubNumber}>Ready to track cycle</Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Daily Focus Reminder */}
        {dashboard.focus && FOCUS_TEXTS[dashboard.focus] ? (
          <View style={styles.focusTipBox}>
            <Ionicons name="information-circle-outline" size={16} color={colors.plum} style={{ marginRight: 6 }} />
            <Text style={styles.focusTipText}>{FOCUS_TEXTS[dashboard.focus]}</Text>
          </View>
        ) : null}

        {/* Action Buttons Below Dial */}
        <View style={styles.cycleActionRow}>
          {isPeriodActive ? (
            <TouchableOpacity
              style={[styles.primaryActionBtn, styles.actionBtnEnd]}
              activeOpacity={0.8}
              onPress={handleEndCycle}
            >
              <Ionicons name="checkmark-circle-outline" size={17} color={colors.white} style={{ marginRight: 6 }} />
              <Text style={styles.primaryActionText}>Period Ended</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryActionBtn, styles.actionBtnStart]}
              activeOpacity={0.8}
              onPress={handleStartCycle}
            >
              <Ionicons name="water" size={17} color={colors.white} style={{ marginRight: 6 }} />
              <Text style={styles.primaryActionText}>Period Started Today</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.secondaryActionBtn}
            activeOpacity={0.8}
            onPress={handleUsePad}
          >
            <Ionicons name="add" size={16} color={colors.plum} style={{ marginRight: 4 }} />
            <Text style={styles.secondaryActionText}>Log Pad Used</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Clinical Guidance / Medical Advisor Card (NO ChatGPT generic sparkles) */}
      <TouchableOpacity
        style={styles.medicalAdvisorCard}
        activeOpacity={0.85}
        onPress={() => setShowAiCoach(true)}
      >
        <View style={styles.advisorIconCircle}>
          <Ionicons name="medkit-outline" size={20} color={colors.plum} />
        </View>

        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.advisorTitle}>Clinical Care & Advisor</Text>
            <View style={styles.advisorBadge}>
              <Text style={styles.advisorBadgeText}>24/7 SUPPORT</Text>
            </View>
          </View>
          <Text style={styles.advisorSubtitle}>
            Evidence-based advice on cramps, cycle delay & reproductive health
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color={colors.rose} />
      </TouchableOpacity>

      {/* How Today Feels (Symptom & Mood Tracker with intuitive health icons) */}
      <Card style={styles.feelingsCard}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="heart-half-outline" size={16} color={colors.plum} style={{ marginRight: 8 }} />
          <Text style={styles.cardSectionHeader}>DAILY SYMPTOMS & WELLNESS</Text>
        </View>

        {/* Cramps Level */}
        <Text style={styles.feelingCategoryTitle}>Pelvic Cramps</Text>
        <View style={styles.chipsRow}>
          {[
            { key: 'none', label: 'None', icon: 'happy-outline' },
            { key: 'mild', label: 'Mild', icon: 'leaf-outline' },
            { key: 'strong', label: 'Severe', icon: 'pulse-outline' },
          ].map((item) => {
            const active = feelings.cramps === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.75}
                style={[styles.feelingChip, active && styles.feelingChipActive]}
                onPress={() => handleFeelChange('cramps', item.key)}
              >
                <Ionicons
                  name={item.icon as any}
                  size={14}
                  color={active ? colors.white : colors.rose}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.feelingChipText, active && styles.feelingChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Mood Level */}
        <Text style={[styles.feelingCategoryTitle, { marginTop: 14 }]}>Mood & Energy</Text>
        <View style={styles.chipsRow}>
          {[
            { key: 'calm', label: 'Calm', icon: 'flower-outline' },
            { key: 'okay', label: 'Normal', icon: 'sunny-outline' },
            { key: 'low', label: 'Tired', icon: 'cloud-outline' },
            { key: 'irritable', label: 'Restless', icon: 'flash-outline' },
          ].map((item) => {
            const active = feelings.mood === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.75}
                style={[styles.feelingChip, active && styles.feelingChipActive]}
                onPress={() => handleFeelChange('mood', item.key)}
              >
                <Ionicons
                  name={item.icon as any}
                  size={14}
                  color={active ? colors.white : colors.rose}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.feelingChipText, active && styles.feelingChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      {/* Pad Inventory & Supply Balance */}
      <Card style={styles.supplyCard}>
        <View style={styles.cardHeaderRowBetween}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="bag-handle-outline" size={16} color={colors.plum} style={{ marginRight: 8 }} />
            <Text style={styles.cardSectionHeader}>PAD INVENTORY</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.adjustStockButton}
            onPress={() => setShowStockForm(!showStockForm)}
          >
            <Ionicons
              name={showStockForm ? 'close' : 'create-outline'}
              size={13}
              color={colors.plum}
              style={{ marginRight: 4 }}
            />
            <Text style={styles.adjustStockButtonText}>
              {showStockForm ? 'Cancel' : 'Update Count'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inventoryGrid}>
          {/* Bag Day */}
          <View style={[styles.inventoryTile, bagDay < 2 && styles.inventoryTileWarning]}>
            <View style={styles.inventoryTileHeader}>
              <Ionicons name="sunny-outline" size={15} color={bagDay < 2 ? colors.warn : colors.rose} />
              <Text style={styles.inventoryTileLabel}>Bag · Day</Text>
            </View>
            <Text style={[styles.inventoryTileValue, bagDay < 2 && styles.inventoryTileValueWarning]}>
              {bagDay}
            </Text>
            <Text style={styles.inventoryTileSub}>
              {bagDay < 2 ? 'Low stock' : 'Pouch ready'}
            </Text>
          </View>

          {/* Bag Night */}
          <View style={[styles.inventoryTile, bagNight < 2 && styles.inventoryTileWarning]}>
            <View style={styles.inventoryTileHeader}>
              <Ionicons name="moon-outline" size={15} color={bagNight < 2 ? colors.warn : colors.rose} />
              <Text style={styles.inventoryTileLabel}>Bag · Night</Text>
            </View>
            <Text style={[styles.inventoryTileValue, bagNight < 2 && styles.inventoryTileValueWarning]}>
              {bagNight}
            </Text>
            <Text style={styles.inventoryTileSub}>
              {bagNight < 2 ? 'Low stock' : 'Pouch ready'}
            </Text>
          </View>

          {/* Home Day */}
          <View style={styles.inventoryTile}>
            <View style={styles.inventoryTileHeader}>
              <Ionicons name="home-outline" size={15} color={colors.rose} />
              <Text style={styles.inventoryTileLabel}>Home · Day</Text>
            </View>
            <Text style={styles.inventoryTileValue}>{homeDay}</Text>
            <Text style={styles.inventoryTileSub}>In drawer</Text>
          </View>

          {/* Home Night */}
          <View style={styles.inventoryTile}>
            <View style={styles.inventoryTileHeader}>
              <Ionicons name="bed-outline" size={15} color={colors.rose} />
              <Text style={styles.inventoryTileLabel}>Home · Night</Text>
            </View>
            <Text style={styles.inventoryTileValue}>{homeNight}</Text>
            <Text style={styles.inventoryTileSub}>Bedside ready</Text>
          </View>
        </View>

        {showStockForm && (
          <View style={styles.stockUpdateForm}>
            <Text style={styles.stockUpdateHeader}>Update Pad Quantity</Text>

            <View style={styles.stockFormRow}>
              <Text style={styles.stockFieldLabel}>Place:</Text>
              <View style={styles.stockChipsRow}>
                {(['bag', 'home'] as const).map((loc) => (
                  <TouchableOpacity
                    key={loc}
                    style={[styles.stockChip, stockPlace === loc && styles.stockChipActive]}
                    onPress={() => setStockPlace(loc)}
                  >
                    <Text style={[styles.stockChipText, stockPlace === loc && styles.stockChipTextActive]}>
                      {loc.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.stockFormRow}>
              <Text style={styles.stockFieldLabel}>Type:</Text>
              <View style={styles.stockChipsRow}>
                {(['day', 'night'] as const).map((kind) => (
                  <TouchableOpacity
                    key={kind}
                    style={[styles.stockChip, stockKind === kind && styles.stockChipActive]}
                    onPress={() => setStockKind(kind)}
                  >
                    <Text style={[styles.stockChipText, stockKind === kind && styles.stockChipTextActive]}>
                      {kind.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.stockFormRow}>
              <Text style={styles.stockFieldLabel}>Count:</Text>
              <TextInput
                style={styles.stockNumberInput}
                keyboardType="numeric"
                value={stockQty}
                onChangeText={setStockQty}
                placeholder="0"
                maxLength={3}
              />
            </View>

            <TouchableOpacity
              style={styles.saveStockSubmitButton}
              onPress={handleSaveStock}
              disabled={savingStock}
            >
              {savingStock ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={16} color={colors.white} style={{ marginRight: 6 }} />
                  <Text style={styles.saveStockSubmitText}>Save Supply</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </Card>

      {/* Ready Orders to Pickup */}
      {readyOrders.length > 0 ? (
        <Card style={styles.orderCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="receipt-outline" size={16} color={colors.plum} style={{ marginRight: 8 }} />
            <Text style={styles.cardSectionHeader}>READY FOR PICKUP</Text>
          </View>
          {readyOrders.map((ord) => (
            <View key={ord.id} style={styles.orderItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderShopName}>
                  {ord.shop || 'Partner Pharmacy'} · Order #{ord.orderNumber}
                </Text>
                <Text style={styles.orderDetails}>
                  {ord.kind} × {ord.qty} units ·{' '}
                  <Text style={{ color: colors.success, fontWeight: '700' }}>
                    {ord.status?.toUpperCase()}
                  </Text>
                </Text>
              </View>
              <TouchableOpacity
                style={styles.confirmPickupButton}
                activeOpacity={0.8}
                onPress={() => handlePickedUp(ord.id)}
              >
                <Text style={styles.confirmPickupText}>Picked Up</Text>
              </TouchableOpacity>
            </View>
          ))}
        </Card>
      ) : null}

      {/* Pack Essentials Checklist */}
      {checklist.length > 0 ? (
        <Card style={styles.checklistCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="checkbox-outline" size={16} color={colors.plum} style={{ marginRight: 8 }} />
            <Text style={styles.cardSectionHeader}>DAILY PACKING CHECKLIST</Text>
          </View>
          {checklist.map((item, idx) => (
            <View key={idx} style={styles.checklistItemRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.pinkDark} style={{ marginRight: 8 }} />
              <Text style={styles.checklistTitle}>{item}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {/* Spacer for bottom navigation dock */}
      <View style={{ height: 96 }} />

      <AiCoachModal
        visible={showAiCoach}
        onClose={() => setShowAiCoach(false)}
        isSubscribed={true}
        onOpenSubscription={() => {
          setShowAiCoach(false);
          setShowSubModal(true);
        }}
      />

      <SubscriptionModal
        visible={showSubModal}
        onClose={() => setShowSubModal(false)}
      />

      {/* Visual App Flow Modal */}
      <Modal
        visible={showGuideModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGuideModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.guideModalCard}>
            <View style={styles.guideModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="compass" size={20} color={colors.plum} style={{ marginRight: 8 }} />
                <Text style={styles.guideModalTitle}>Padzyra Quick Guide</Text>
              </View>
              <TouchableOpacity onPress={() => setShowGuideModal(false)}>
                <Ionicons name="close-circle" size={24} color={colors.rose} />
              </TouchableOpacity>
            </View>

            <View style={styles.guideList}>
              <View style={styles.guideRow}>
                <View style={[styles.guideIconBubble, { backgroundColor: '#ffe4e6' }]}>
                  <Ionicons name="calendar-outline" size={22} color="#e11d48" />
                </View>
                <View style={styles.guideContent}>
                  <Text style={styles.guideStepTitle}>1. Track Cycle</Text>
                  <Text style={styles.guideStepDesc}>Predict periods & fertile dates automatically</Text>
                </View>
              </View>

              <View style={styles.guideRow}>
                <View style={[styles.guideIconBubble, { backgroundColor: '#f3e8ff' }]}>
                  <Ionicons name="bag-handle-outline" size={22} color="#9333ea" />
                </View>
                <View style={styles.guideContent}>
                  <Text style={styles.guideStepTitle}>2. Check Bag Inventory</Text>
                  <Text style={styles.guideStepDesc}>Never run out of emergency pads when outside</Text>
                </View>
              </View>

              <View style={styles.guideRow}>
                <View style={[styles.guideIconBubble, { backgroundColor: '#e0f2fe' }]}>
                  <Ionicons name="storefront-outline" size={22} color="#0284c7" />
                </View>
                <View style={styles.guideContent}>
                  <Text style={styles.guideStepTitle}>3. Discreet Pharmacy Pickup</Text>
                  <Text style={styles.guideStepDesc}>Order secretly & pick up at nearby medical shops</Text>
                </View>
              </View>

              <View style={styles.guideRow}>
                <View style={[styles.guideIconBubble, { backgroundColor: '#fee2e2' }]}>
                  <Ionicons name="flash-outline" size={22} color="#dc2626" />
                </View>
                <View style={styles.guideContent}>
                  <Text style={styles.guideStepTitle}>4. Emergency SOS & Toilets</Text>
                  <Text style={styles.guideStepDesc}>Find clean restrooms & instant emergency relief</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.guideGotItBtn}
              activeOpacity={0.85}
              onPress={() => setShowGuideModal(false)}
            >
              <Ionicons name="checkmark" size={18} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.guideGotItText}>Got It</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff9fb',
  },
  content: {
    padding: 16,
    paddingTop: 14,
    maxWidth: 440,
    alignSelf: 'center',
    width: '100%',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff9fb',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.rose,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.plum,
    letterSpacing: -0.4,
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerGuideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(235, 195, 215, 0.8)',
    shadowColor: colors.plum,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerGuideText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.plum,
    marginLeft: 4,
  },
  headerSosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e11d48',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    shadowColor: '#e11d48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  headerSosText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // 4-Pillar Quick Action Strip
  quickFlowGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  quickFlowCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(235, 195, 215, 0.7)',
    shadowColor: colors.plum,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  quickFlowIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickFlowLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
  },
  quickFlowBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.rose,
    marginTop: 2,
    textAlign: 'center',
  },

  // Visual Journey Strip
  journeyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(235, 195, 215, 0.6)',
  },
  journeyStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  journeyDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  journeyLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
  },
  journeyLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(235, 195, 215, 0.8)',
    marginHorizontal: 4,
  },

  // Guide Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(30, 10, 25, 0.5)',
    justifyContent: 'flex-end',
  },
  guideModalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  guideModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  guideModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  guideList: {
    marginBottom: 20,
    gap: 14,
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guideIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  guideContent: {
    flex: 1,
  },
  guideStepTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 2,
  },
  guideStepDesc: {
    fontSize: 12,
    color: colors.rose,
    lineHeight: 16,
  },
  guideGotItBtn: {
    backgroundColor: colors.plum,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  guideGotItText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warnBg,
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  errorText: {
    color: colors.warn,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },

  // Cycle Dial Card
  cycleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#6b3d62',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(243, 213, 228, 0.6)',
  },
  cycleRingOuter: {
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(255, 245, 248, 0.8)',
    borderWidth: 2,
    borderColor: 'rgba(244, 167, 197, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  cycleRingInner: {
    width: 184,
    height: 184,
    borderRadius: 92,
    backgroundColor: '#ffffff',
    borderWidth: 3,
    borderColor: '#f9dce7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f4a7c5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  cycleRingInnerActive: {
    borderColor: '#f43f5e',
    backgroundColor: '#fffdfd',
  },
  cycleRingCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  phaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f6ecf3',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 6,
  },
  phaseBadgeActive: {
    backgroundColor: '#ffe4e6',
  },
  phaseBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.plum,
    letterSpacing: 0.6,
  },
  phaseBadgeTextActive: {
    color: '#e11d48',
  },
  cycleBigNumber: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.plum,
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  cycleSubNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.rose,
    marginTop: 2,
    textAlign: 'center',
  },
  cycleMutedNote: {
    fontSize: 11,
    color: '#a8819d',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 10,
  },

  // Focus Tip Box
  focusTipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fbf4f8',
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginTop: 14,
    width: '100%',
    borderWidth: 1,
    borderColor: '#f1d6e4',
  },
  focusTipText: {
    color: colors.plum,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },

  // Cycle Action Row
  cycleActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    width: '100%',
  },
  primaryActionBtn: {
    flex: 1.2,
    height: 44,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnStart: {
    backgroundColor: '#dc97c4',
  },
  actionBtnEnd: {
    backgroundColor: colors.plum,
  },
  primaryActionText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e8c9dc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    color: colors.plum,
    fontSize: 13,
    fontWeight: '800',
  },

  // Medical Advisor Card (NO ChatGPT generic sparkles)
  medicalAdvisorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(215, 176, 230, 0.45)',
    shadowColor: colors.plum,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  advisorIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f7edf9',
    borderWidth: 1,
    borderColor: '#e5c4ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  advisorTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.plum,
  },
  advisorBadge: {
    backgroundColor: '#efe2f2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
  },
  advisorBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.plum,
  },
  advisorSubtitle: {
    fontSize: 11.5,
    color: colors.rose,
    marginTop: 2,
    lineHeight: 16,
  },

  // Feelings Card
  feelingsCard: {
    marginBottom: 16,
    padding: 18,
    borderRadius: 20,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardSectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.plum,
    letterSpacing: 0.6,
  },
  feelingCategoryTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.rose,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  feelingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  feelingChipActive: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
  },
  feelingChipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink,
  },
  feelingChipTextActive: {
    color: colors.white,
  },

  // Supply Inventory
  supplyCard: {
    marginBottom: 16,
    padding: 18,
    borderRadius: 20,
  },
  adjustStockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5ebf1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  adjustStockButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.plum,
  },
  inventoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  inventoryTile: {
    width: '48%',
    backgroundColor: '#faf5f8',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f0d9e5',
  },
  inventoryTileWarning: {
    backgroundColor: '#fff1f2',
    borderColor: '#fca5a5',
  },
  inventoryTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  inventoryTileLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.rose,
  },
  inventoryTileValue: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.plum,
    marginVertical: 2,
  },
  inventoryTileValueWarning: {
    color: '#e11d48',
  },
  inventoryTileSub: {
    fontSize: 11,
    color: colors.rose,
    fontWeight: '500',
  },

  // Stock Form
  stockUpdateForm: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  stockUpdateHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.plum,
    marginBottom: 10,
  },
  stockFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stockFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.rose,
  },
  stockChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stockChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  stockChipActive: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
  },
  stockChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
  },
  stockChipTextActive: {
    color: colors.white,
  },
  stockNumberInput: {
    width: 64,
    height: 36,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: colors.white,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  saveStockSubmitButton: {
    flexDirection: 'row',
    backgroundColor: colors.plum,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  saveStockSubmitText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },

  // Orders
  orderCard: {
    marginBottom: 16,
    padding: 18,
    borderRadius: 20,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  orderShopName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
  },
  orderDetails: {
    fontSize: 12,
    color: colors.rose,
    marginTop: 2,
  },
  confirmPickupButton: {
    backgroundColor: colors.plum,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 10,
  },
  confirmPickupText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },

  // Checklist
  checklistCard: {
    marginBottom: 16,
    padding: 18,
    borderRadius: 20,
  },
  checklistItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  checklistTitle: {
    fontSize: 13.5,
    color: colors.ink,
    fontWeight: '600',
  },
});
