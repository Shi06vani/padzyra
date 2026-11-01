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
} from 'react-native';
import { colors } from '../theme/colors';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { PadzyraApi } from '../api/client';
import { AiCoachModal } from '../components/AiCoachModal';
import { SubscriptionModal } from '../components/SubscriptionModal';

interface HomeScreenProps {
  onNavigateToNow: () => void;
  onRequestPin: () => void;
  onNavigateToEmergency?: () => void;
}

const FOCUS_TEXTS: Record<string, string> = {
  lunch: 'Change at lunch.',
  night: 'Keep a night pad by the bed.',
  leave: 'Is the pouch in the bag?',
  heat: 'Hot water bottle.',
  laundry: 'Wash clothes and sheets.',
  heavy: 'Put an extra in the bag.',
  change: 'Time to change.',
  period: 'Today needs a check.',
  eve: 'Pack the pouch tonight.',
  pack: 'Pack the bag checklist.',
  pms: 'Take it easy tomorrow.',
  late: 'This month is late. A doctor can help if you want.',
  move: 'Move pads into the bag tonight.',
  low: 'Bag is low.',
  trip: 'Pack extra pads for the trip.',
  follow: 'Bag is still low.',
};

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigateToNow,
  onRequestPin,
  onNavigateToEmergency,
}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<any>({});
  const [supplies, setSupplies] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [feelings, setFeelings] = useState<{ cramps?: string; mood?: string }>({});
  const [error, setError] = useState('');

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

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData();
          }}
          tintColor={colors.pink}
        />
      }
    >
      {/* Top Brand Bar */}
      <View style={styles.topBar}>
        <Text style={styles.brandSubtitle}>PADZYRA</Text>
        <Text style={styles.brandTitle}>Home</Text>
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      {/* Hero Section */}
      <View style={styles.heroSection}>
        {dashboard.day ? (
          <>
            <Text style={styles.kicker}>THIS TIME</Text>
            <Text style={styles.bigNumber}>
              Day {dashboard.day}{' '}
              <Text style={styles.subNumber}>of {dashboard.of || 5}</Text>
            </Text>
            {dashboard.until ? (
              <Text style={styles.mutedText}>Until {dashboard.until}</Text>
            ) : null}
          </>
        ) : dashboard.inDays != null ? (
          <>
            <Text style={styles.kicker}>ESTIMATE</Text>
            <Text style={styles.bigNumber}>
              {dashboard.inDays < 0 ? 'Late' : dashboard.inDays === 0 ? 'Today' : dashboard.inDays}
              {dashboard.inDays > 0 ? <Text style={styles.subNumber}> days</Text> : null}
            </Text>
            <Text style={styles.mutedText}>
              {dashboard.inDays < 0
                ? 'A doctor can help if you want. Not a diagnosis.'
                : 'Estimate only.'}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.kicker}>TODAY</Text>
            <Text style={styles.bigNumber}>Hello</Text>
          </>
        )}
      </View>

      {/* Focus banner */}
      {dashboard.focus && FOCUS_TEXTS[dashboard.focus] ? (
        <View style={styles.focusBanner}>
          <Text style={styles.focusText}>{FOCUS_TEXTS[dashboard.focus]}</Text>
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.actionRow}>
        {dashboard.day ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnOutline]}
            onPress={handleEndCycle}
          >
            <Ionicons name="flag-outline" size={16} color={colors.plum} style={{ marginRight: 6 }} />
            <Text style={styles.actionBtnOutlineText}>Ended</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSolid]}
            onPress={handleStartCycle}
          >
            <Ionicons name="water-outline" size={16} color={colors.white} style={{ marginRight: 6 }} />
            <Text style={styles.actionBtnSolidText}>Started</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnSolid]}
          onPress={handleUsePad}
        >
          <Ionicons name="checkmark-outline" size={16} color={colors.white} style={{ marginRight: 6 }} />
          <Text style={styles.actionBtnSolidText}>Used 1</Text>
        </TouchableOpacity>
      </View>

      {/* Emergency Period Mode: I Need Help Now */}
      <TouchableOpacity
        style={styles.emergencySosButton}
        activeOpacity={0.88}
        onPress={onNavigateToEmergency || onNavigateToNow}
      >
        <View style={styles.emergencySosIconCircle}>
          <Ionicons name="alert-circle" size={20} color={colors.white} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.emergencySosTitle}>I Need Help Now</Text>
            <View style={styles.emergencySosBadge}>
              <Text style={styles.emergencySosBadgeText}>EMERGENCY</Text>
            </View>
          </View>
          <Text style={styles.emergencySosSub}>
            Unexpected period · Leaks · Nearby toilets · Fast delivery
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#b91c1c" />
      </TouchableOpacity>

      <PrimaryButton
        title="Need one now"
        icon={<Ionicons name="flash" size={18} color={colors.white} />}
        onPress={onNavigateToNow}
        style={styles.needOneNowBtn}
      />

      {/* 24/7 AI Gynec & Period Coach Banner */}
      <TouchableOpacity
        style={styles.aiCoachWidget}
        activeOpacity={0.88}
        onPress={() => setShowAiCoach(true)}
      >
        <View style={styles.aiCoachIconCircle}>
          <Ionicons name="sparkles" size={16} color={colors.white} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.aiCoachTitle}>Ask AI Period Coach</Text>
            <View style={styles.aiCoachPill}>
              <Text style={styles.aiCoachPillText}>24/7</Text>
            </View>
          </View>
          <Text style={styles.aiCoachSub}>Ask questions about delay, cramps & remedies</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.plum} />
      </TouchableOpacity>

      {/* Pads Stock Card */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="cube-outline" size={15} color={colors.rose} style={{ marginRight: 6 }} />
            <Text style={styles.cardHeader}>PADS</Text>
          </View>
          <TouchableOpacity
            style={styles.adjustStockBtn}
            onPress={() => setShowStockForm(!showStockForm)}
          >
            <Ionicons
              name={showStockForm ? 'close' : 'create-outline'}
              size={14}
              color={colors.plum}
              style={{ marginRight: 4 }}
            />
            <Text style={styles.adjustStockBtnText}>
              {showStockForm ? 'Close' : 'Adjust'}
            </Text>
          </TouchableOpacity>
        </View>
        {dashboard.move ? (
          <Text style={styles.mutedText}>
            Move {dashboard.move} into the bag tonight.
          </Text>
        ) : null}

        <View style={styles.tilesGrid}>
          <View style={[styles.tile, bagDay < 2 && styles.tileLow]}>
            <View style={styles.tileLabelRow}>
              <Ionicons name="bag-handle-outline" size={13} color={bagDay < 2 ? colors.warn : colors.rose} style={{ marginRight: 4 }} />
              <Text style={styles.tileLabel}>Bag · day</Text>
            </View>
            <Text style={[styles.tileCount, bagDay < 2 && styles.tileCountLow]}>
              {bagDay}
            </Text>
          </View>
          <View style={[styles.tile, bagNight < 2 && styles.tileLow]}>
            <View style={styles.tileLabelRow}>
              <Ionicons name="moon-outline" size={13} color={bagNight < 2 ? colors.warn : colors.rose} style={{ marginRight: 4 }} />
              <Text style={styles.tileLabel}>Bag · night</Text>
            </View>
            <Text style={[styles.tileCount, bagNight < 2 && styles.tileCountLow]}>
              {bagNight}
            </Text>
          </View>
          <View style={styles.tile}>
            <View style={styles.tileLabelRow}>
              <Ionicons name="home-outline" size={13} color={colors.rose} style={{ marginRight: 4 }} />
              <Text style={styles.tileLabel}>Home · day</Text>
            </View>
            <Text style={styles.tileCount}>{homeDay}</Text>
          </View>
          <View style={styles.tile}>
            <View style={styles.tileLabelRow}>
              <Ionicons name="bed-outline" size={13} color={colors.rose} style={{ marginRight: 4 }} />
              <Text style={styles.tileLabel}>Home · night</Text>
            </View>
            <Text style={styles.tileCount}>{homeNight}</Text>
          </View>
        </View>

        {showStockForm && (
          <View style={styles.stockFormBox}>
            <Text style={styles.stockFormTitle}>Update Supplies</Text>

            <View style={styles.stockRow}>
              <Text style={styles.stockLabel}>Location:</Text>
              <View style={styles.stockOptionsRow}>
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

            <View style={styles.stockRow}>
              <Text style={styles.stockLabel}>Type:</Text>
              <View style={styles.stockOptionsRow}>
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

            <View style={styles.stockRow}>
              <Text style={styles.stockLabel}>Exact Count:</Text>
              <TextInput
                style={styles.stockQtyInput}
                keyboardType="numeric"
                value={stockQty}
                onChangeText={setStockQty}
                placeholder="0"
                maxLength={3}
              />
            </View>

            <TouchableOpacity
              style={styles.saveStockBtn}
              onPress={handleSaveStock}
              disabled={savingStock}
            >
              {savingStock ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={16} color={colors.white} style={{ marginRight: 6 }} />
                  <Text style={styles.saveStockBtnText}>Save Stock</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </Card>

      {/* Daily Feelings Card */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="heart-outline" size={15} color={colors.rose} style={{ marginRight: 6 }} />
          <Text style={styles.cardHeader}>HOW TODAY FEELS</Text>
        </View>

        <Text style={styles.chipCategory}>Cramps</Text>
        <View style={styles.chipsRow}>
          {['none', 'mild', 'strong'].map((val) => {
            const active = feelings.cramps === val;
            return (
              <TouchableOpacity
                key={val}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => handleFeelChange('cramps', val)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {val.charAt(0).toUpperCase() + val.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.chipCategory, { marginTop: 14 }]}>Mood</Text>
        <View style={styles.chipsRow}>
          {['calm', 'okay', 'low', 'irritable'].map((val) => {
            const active = feelings.mood === val;
            return (
              <TouchableOpacity
                key={val}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => handleFeelChange('mood', val)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {val.charAt(0).toUpperCase() + val.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      {/* Ready Orders */}
      {readyOrders.length > 0 ? (
        <Card>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="bag-check-outline" size={15} color={colors.rose} style={{ marginRight: 6 }} />
            <Text style={styles.cardHeader}>READY TO PICK UP</Text>
          </View>
          {readyOrders.map((ord) => (
            <View key={ord.id} style={styles.orderItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderShop}>
                  {ord.shop || 'Shop'} · {ord.orderNumber}
                </Text>
                <Text style={styles.mutedText}>
                  {ord.kind} × {ord.qty} ·{' '}
                  <Text style={{ color: colors.success, fontWeight: '800' }}>
                    {ord.status}
                  </Text>
                </Text>
              </View>
              <TouchableOpacity
                style={styles.pickupBtn}
                onPress={() => handlePickedUp(ord.id)}
              >
                <Text style={styles.pickupBtnText}>Picked up</Text>
              </TouchableOpacity>
            </View>
          ))}
        </Card>
      ) : null}

      {/* Checklist */}
      {checklist.length > 0 ? (
        <Card>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="list-outline" size={15} color={colors.rose} style={{ marginRight: 6 }} />
            <Text style={styles.cardHeader}>PACK</Text>
          </View>
          {checklist.map((item, idx) => (
            <View key={idx} style={styles.checklistItem}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.pink} style={styles.checklistDot} />
              <Text style={styles.checklistText}>{item}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {/* Bottom spacer for floating navigation */}
      <View style={{ height: 90 }} />

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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.blush,
  },
  content: {
    padding: 16,
    paddingTop: 20,
    maxWidth: 440,
    alignSelf: 'center',
    width: '100%',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.blush,
  },
  topBar: {
    marginBottom: 16,
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.rose,
    letterSpacing: 1.5,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.plum,
    letterSpacing: -0.5,
  },
  errorCard: {
    backgroundColor: colors.warnBg,
  },
  errorText: {
    color: colors.warn,
    fontWeight: '700',
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 14,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.rose,
    letterSpacing: 1,
    marginBottom: 4,
  },
  bigNumber: {
    fontSize: 48,
    fontWeight: '900',
    color: colors.plum,
    letterSpacing: -1,
  },
  subNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.rose,
  },
  mutedText: {
    fontSize: 14,
    color: colors.rose,
    marginTop: 4,
  },
  focusBanner: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#eec3d6',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  focusText: {
    color: colors.plum,
    fontWeight: '700',
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnSolid: {
    backgroundColor: '#dc97c4',
  },
  actionBtnSolidText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
  },
  actionBtnOutline: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  actionBtnOutlineText: {
    color: colors.plum,
    fontWeight: '800',
    fontSize: 15,
  },
  needOneNowBtn: {
    marginBottom: 12,
  },
  aiCoachWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff4fa',
    borderWidth: 1.5,
    borderColor: '#f2cade',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    shadowColor: colors.plum,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  aiCoachIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dc97c4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiCoachTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.plum,
  },
  aiCoachPill: {
    backgroundColor: '#f3d5e7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
  },
  aiCoachPillText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.plum,
  },
  aiCoachSub: {
    fontSize: 11,
    color: colors.rose,
    marginTop: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.rose,
    letterSpacing: 1,
  },
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  tile: {
    width: '48%',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 14,
  },
  tileLow: {
    borderColor: colors.warn,
    backgroundColor: colors.warnBg,
  },
  tileLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tileLabel: {
    fontSize: 13,
    color: colors.rose,
    fontWeight: '700',
  },
  tileCount: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.plum,
    marginTop: 4,
  },
  tileCountLow: {
    color: colors.warn,
  },
  chipCategory: {
    fontSize: 13,
    color: colors.rose,
    fontWeight: '700',
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  chipActive: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  chipTextActive: {
    color: colors.white,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  orderShop: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  pickupBtn: {
    backgroundColor: colors.plum,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  pickupBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  checklistDot: {
    color: colors.pink,
    fontSize: 18,
    marginRight: 8,
  },
  checklistText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  adjustStockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5ebf1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  adjustStockBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.plum,
  },
  stockFormBox: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  stockFormTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 10,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stockLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.rose,
  },
  stockOptionsRow: {
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
  stockQtyInput: {
    width: 70,
    height: 36,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.white,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  saveStockBtn: {
    flexDirection: 'row',
    backgroundColor: colors.plum,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  saveStockBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  emergencySosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    borderColor: '#fda4af',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
    marginVertical: 10,
    shadowColor: '#e11d48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  emergencySosIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e11d48',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencySosTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#9f1239',
  },
  emergencySosBadge: {
    backgroundColor: '#ffe4e6',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#f43f5e',
  },
  emergencySosBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#e11d48',
    letterSpacing: 0.5,
  },
  emergencySosSub: {
    fontSize: 11,
    color: '#881337',
    marginTop: 2,
    fontWeight: '500',
  },
});
