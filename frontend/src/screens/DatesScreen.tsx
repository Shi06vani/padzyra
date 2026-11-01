import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme/colors';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import { PadzyraApi } from '../api/client';
import { TripsScreen } from './TripsScreen';

export const DatesScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'cycles' | 'trips'>('cycles');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cycles, setCycles] = useState<any[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form states for logging a cycle
  const [showLogForm, setShowLogForm] = useState(false);
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState('');
  const [flow, setFlow] = useState<'light' | 'medium' | 'heavy' | ''>('medium');
  const [note, setNote] = useState('');
  const [savingCycle, setSavingCycle] = useState(false);

  const loadCycles = useCallback(async () => {
    try {
      const data = await PadzyraApi.getCycles();
      setCycles(data || []);
    } catch {
      setCycles([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'cycles') {
      loadCycles();
    }
  }, [activeTab, loadCycles]);

  const handleSaveCycle = async () => {
    if (!startDate.trim()) {
      Alert.alert('Required', 'Please enter a start date (YYYY-MM-DD)');
      return;
    }
    if (endDate.trim() && endDate.trim() < startDate.trim()) {
      Alert.alert('Invalid Dates', 'End date cannot be earlier than start date');
      return;
    }

    setSavingCycle(true);
    try {
      await PadzyraApi.createCycle({
        start: startDate.trim(),
        end: endDate.trim() || undefined,
        flow: flow || undefined,
        note: note.trim() || undefined,
      });
      setShowLogForm(false);
      setEndDate('');
      setNote('');
      setFlow('medium');
      loadCycles();
      Alert.alert('Saved', 'Your cycle has been recorded.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not save cycle');
    } finally {
      setSavingCycle(false);
    }
  };

  const handleDeleteCycle = async (cycleId: string) => {
    Alert.alert(
      'Remove Cycle Record',
      'Are you sure you want to delete this recorded cycle?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(cycleId);
            try {
              await PadzyraApi.deleteCycle(cycleId);
              loadCycles();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Could not delete cycle');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const clean = dateStr.slice(0, 10);
      const parts = clean.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return clean;
    } catch {
      return dateStr;
    }
  };

  // Rhythm Statistics
  const stats = useMemo(() => {
    if (!cycles || cycles.length === 0) {
      return { avgDuration: 5, avgCycleLength: 28, totalLogged: 0 };
    }
    let totalDuration = 0;
    let validDurationCount = 0;

    cycles.forEach((c) => {
      const s = c.startedAt ? c.startedAt.slice(0, 10) : c.start;
      const e = c.endedAt ? c.endedAt.slice(0, 10) : c.end;
      if (s && e) {
        const diff = Math.round((new Date(e).getTime() - new Date(s).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        if (diff > 0 && diff <= 14) {
          totalDuration += diff;
          validDurationCount += 1;
        }
      }
    });

    return {
      avgDuration: validDurationCount > 0 ? Math.round(totalDuration / validDurationCount) : 5,
      avgCycleLength: 28,
      totalLogged: cycles.length,
    };
  }, [cycles]);

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
            loadCycles();
          }}
          tintColor={colors.plum}
        />
      }
    >
      {/* Header */}
      <View style={styles.topHeader}>
        <Text style={styles.screenTitle}>Cycle & Calendar</Text>
        <Text style={styles.screenSubtitle}>Track flow rhythm, length & travel planning</Text>
      </View>

      {/* Segmented Tab Pill */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'cycles' && styles.segmentBtnActive]}
          activeOpacity={0.8}
          onPress={() => setActiveTab('cycles')}
        >
          <Ionicons
            name="calendar-outline"
            size={16}
            color={activeTab === 'cycles' ? colors.white : colors.plum}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.segmentText, activeTab === 'cycles' && styles.segmentTextActive]}>
            Cycle History
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'trips' && styles.segmentBtnActive]}
          activeOpacity={0.8}
          onPress={() => setActiveTab('trips')}
        >
          <Ionicons
            name="airplane-outline"
            size={16}
            color={activeTab === 'trips' ? colors.white : colors.plum}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.segmentText, activeTab === 'trips' && styles.segmentTextActive]}>
            Trip Planner
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'trips' ? (
        <TripsScreen />
      ) : (
        <>
          {/* Cycle Metrics Strip */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <View style={styles.metricIconWrap}>
                <Ionicons name="repeat-outline" size={16} color={colors.plum} />
              </View>
              <Text style={styles.metricValue}>{stats.avgCycleLength}d</Text>
              <Text style={styles.metricLabel}>Avg Cycle</Text>
            </View>

            <View style={styles.metricCard}>
              <View style={styles.metricIconWrap}>
                <Ionicons name="water-outline" size={16} color="#e11d48" />
              </View>
              <Text style={styles.metricValue}>{stats.avgDuration}d</Text>
              <Text style={styles.metricLabel}>Avg Period</Text>
            </View>

            <View style={styles.metricCard}>
              <View style={styles.metricIconWrap}>
                <Ionicons name="stats-chart-outline" size={16} color={colors.plum} />
              </View>
              <Text style={styles.metricValue}>{stats.totalLogged}</Text>
              <Text style={styles.metricLabel}>Recorded</Text>
            </View>
          </View>

          {/* Log Cycle Form or Button */}
          {showLogForm ? (
            <Card style={styles.formCard}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="create-outline" size={18} color={colors.plum} style={{ marginRight: 6 }} />
                <Text style={styles.cardHeaderTitle}>LOG PERIOD DATES</Text>
              </View>

              <View style={styles.datesRow}>
                <InputField
                  label="Start Date"
                  placeholder="YYYY-MM-DD"
                  value={startDate}
                  onChangeText={setStartDate}
                  containerStyle={{ flex: 1, marginRight: 8 }}
                />
                <InputField
                  label="End Date (Optional)"
                  placeholder="YYYY-MM-DD"
                  value={endDate}
                  onChangeText={setEndDate}
                  containerStyle={{ flex: 1, marginLeft: 8 }}
                />
              </View>

              {/* Flow Selector */}
              <Text style={styles.flowLabel}>Flow Intensity</Text>
              <View style={styles.flowRow}>
                {[
                  { key: 'light', label: 'Light', icon: 'water-outline', color: '#c98cb0' },
                  { key: 'medium', label: 'Medium', icon: 'water', color: colors.plum },
                  { key: 'heavy', label: 'Heavy', icon: 'water', color: '#e11d48' },
                ].map((item) => {
                  const active = flow === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.flowChip, active && styles.flowChipActive]}
                      onPress={() => setFlow(active ? '' : (item.key as any))}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={14}
                        color={active ? colors.white : item.color}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.flowChipText, active && styles.flowChipTextActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <InputField
                label="Notes (Optional)"
                placeholder="e.g. Started early morning, mild cramps"
                value={note}
                onChangeText={setNote}
              />

              <View style={styles.formActions}>
                <PrimaryButton
                  title="Save Dates"
                  icon={<Ionicons name="checkmark-circle-outline" size={17} color={colors.white} />}
                  onPress={handleSaveCycle}
                  loading={savingCycle}
                  style={{ flex: 1.2, marginRight: 8 }}
                />
                <PrimaryButton
                  title="Cancel"
                  variant="ghost"
                  onPress={() => setShowLogForm(false)}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          ) : (
            <TouchableOpacity
              style={styles.openLogBtn}
              activeOpacity={0.8}
              onPress={() => setShowLogForm(true)}
            >
              <Ionicons name="add-circle" size={18} color={colors.white} style={{ marginRight: 6 }} />
              <Text style={styles.openLogBtnText}>Log Past or Current Period</Text>
            </TouchableOpacity>
          )}

          {loading ? (
            <ActivityIndicator size="large" color={colors.plum} style={{ marginTop: 32 }} />
          ) : (
            <Card style={styles.historyCard}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="time-outline" size={16} color={colors.plum} style={{ marginRight: 6 }} />
                <Text style={styles.cardHeaderTitle}>RECORDED CYCLES</Text>
              </View>

              {cycles.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="calendar-clear-outline" size={28} color={colors.rose} />
                  </View>
                  <Text style={styles.emptyTitle}>No cycles logged yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Log your latest period dates above to calculate cycle duration and predictions.
                  </Text>
                </View>
              ) : (
                cycles.map((c, i) => {
                  const s = c.startedAt ? c.startedAt.slice(0, 10) : c.start;
                  const e = c.endedAt ? c.endedAt.slice(0, 10) : c.end;
                  const isOngoing = !e;

                  return (
                    <View key={c.id || i} style={styles.cycleItem}>
                      <View style={styles.cycleIconWrap}>
                        <Ionicons
                          name={isOngoing ? 'water' : 'checkmark-circle'}
                          size={18}
                          color={isOngoing ? '#e11d48' : colors.plum}
                        />
                      </View>

                      <View style={{ flex: 1, marginHorizontal: 10 }}>
                        <Text style={styles.cycleDateRange}>
                          {formatDateDisplay(s)}
                          {e ? ` – ${formatDateDisplay(e)}` : ' (Ongoing)'}
                        </Text>

                        <View style={styles.cycleMetaRow}>
                          <Text style={styles.cycleStatusText}>
                            {isOngoing ? 'Currently active' : 'Completed cycle'}
                          </Text>
                          {c.flow ? (
                            <View style={styles.flowBadge}>
                              <Ionicons name="water" size={10} color={colors.plum} style={{ marginRight: 2 }} />
                              <Text style={styles.flowBadgeText}>
                                {c.flow.toUpperCase()}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {c.note ? <Text style={styles.cycleNoteText}>{c.note}</Text> : null}
                      </View>

                      <View style={styles.cycleItemRight}>
                        <View style={[styles.durationBadge, isOngoing && styles.durationBadgeActive]}>
                          <Text style={[styles.durationText, isOngoing && styles.durationTextActive]}>
                            {c.periodDays ? `${c.periodDays}d` : isOngoing ? 'Active' : '–'}
                          </Text>
                        </View>

                        {c.id ? (
                          <TouchableOpacity
                            onPress={() => handleDeleteCycle(c.id)}
                            disabled={deletingId === c.id}
                            style={styles.deleteButton}
                          >
                            {deletingId === c.id ? (
                              <ActivityIndicator size="small" color={colors.warn} />
                            ) : (
                              <Ionicons name="trash-outline" size={15} color={colors.rose} />
                            )}
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}
            </Card>
          )}
        </>
      )}

      {/* Floating dock spacer */}
      <View style={{ height: 96 }} />
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
    paddingTop: 16,
    maxWidth: 440,
    alignSelf: 'center',
    width: '100%',
  },
  topHeader: {
    marginBottom: 14,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.plum,
    letterSpacing: -0.4,
  },
  screenSubtitle: {
    fontSize: 13,
    color: colors.rose,
    marginTop: 2,
    fontWeight: '500',
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(243, 213, 228, 0.7)',
    shadowColor: colors.plum,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 12,
  },
  segmentBtnActive: {
    backgroundColor: colors.plum,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.plum,
  },
  segmentTextActive: {
    color: colors.white,
  },

  // Metrics Row
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(243, 213, 228, 0.7)',
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8eff5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.plum,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.rose,
    marginTop: 1,
  },

  // Open Log Button
  openLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc97c4',
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 14,
    shadowColor: colors.pink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
  openLogBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },

  // Form Card
  formCard: {
    marginBottom: 14,
    padding: 18,
    borderRadius: 20,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.plum,
    letterSpacing: 0.6,
  },
  datesRow: {
    flexDirection: 'row',
  },
  flowLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.rose,
    marginBottom: 8,
  },
  flowRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  flowChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 12,
    paddingVertical: 8,
  },
  flowChipActive: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
  },
  flowChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  flowChipTextActive: {
    color: colors.white,
  },
  formActions: {
    flexDirection: 'row',
    marginTop: 6,
  },

  // History Card
  historyCard: {
    padding: 18,
    borderRadius: 20,
    marginBottom: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f8eff5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.plum,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: colors.rose,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  cycleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  cycleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fbf4f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleDateRange: {
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.ink,
  },
  cycleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  cycleStatusText: {
    fontSize: 11.5,
    color: colors.rose,
    fontWeight: '500',
  },
  flowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3d5e7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
  },
  flowBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.plum,
  },
  cycleNoteText: {
    fontSize: 12,
    color: colors.rose,
    marginTop: 3,
    fontStyle: 'italic',
  },
  cycleItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  durationBadge: {
    backgroundColor: '#f5ebf1',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  durationBadgeActive: {
    backgroundColor: '#ffe4e6',
  },
  durationText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.plum,
  },
  durationTextActive: {
    color: '#e11d48',
  },
  deleteButton: {
    padding: 6,
  },
});
