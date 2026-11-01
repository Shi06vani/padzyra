import React, { useState, useEffect, useCallback } from 'react';
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
  const todayIso = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState('');
  const [flow, setFlow] = useState<'light' | 'medium' | 'heavy' | ''>('');
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
      setFlow('');
      loadCycles();
      Alert.alert('Logged', 'Your cycle dates have been recorded.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not save cycle dates');
    } finally {
      setSavingCycle(false);
    }
  };

  const handleDeleteCycle = async (cycleId: string) => {
    Alert.alert(
      'Remove Cycle',
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadCycles();
          }}
          tintColor={colors.pink}
        />
      }
    >
      <View style={styles.topBar}>
        <Text style={styles.brandSubtitle}>PADZYRA</Text>
        <Text style={styles.brandTitle}>Dates & Trips</Text>
      </View>

      {/* Top Segmented Tabs: Cycles vs Trips */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'cycles' && styles.segmentBtnActive]}
          onPress={() => setActiveTab('cycles')}
        >
          <Ionicons
            name="calendar-outline"
            size={15}
            color={activeTab === 'cycles' ? colors.white : colors.plum}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.segmentText, activeTab === 'cycles' && styles.segmentTextActive]}>
            Cycle Dates
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'trips' && styles.segmentBtnActive]}
          onPress={() => setActiveTab('trips')}
        >
          <Ionicons
            name="airplane-outline"
            size={15}
            color={activeTab === 'trips' ? colors.white : colors.plum}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.segmentText, activeTab === 'trips' && styles.segmentTextActive]}>
            Trips & Packing
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'trips' ? (
        <TripsScreen />
      ) : (
        <>
          {/* Log Cycle Form or Button */}
          {showLogForm ? (
            <Card style={styles.formCard}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="calendar-outline" size={17} color={colors.plum} style={{ marginRight: 6 }} />
                <Text style={styles.cardHeader}>LOG CYCLE DATES</Text>
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
              label="End Date (optional)"
              placeholder="YYYY-MM-DD"
              value={endDate}
              onChangeText={setEndDate}
              containerStyle={{ flex: 1, marginLeft: 8 }}
            />
          </View>

          <Text style={styles.flowLabel}>Flow (optional)</Text>
          <View style={styles.flowRow}>
            {(['light', 'medium', 'heavy'] as const).map((level) => {
              const active = flow === level;
              return (
                <TouchableOpacity
                  key={level}
                  style={[styles.flowChip, active && styles.flowChipActive]}
                  onPress={() => setFlow(active ? '' : level)}
                >
                  <Text style={[styles.flowChipText, active && styles.flowChipTextActive]}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <InputField
            label="Note (optional)"
            placeholder="e.g. Started early morning, mild cramps"
            value={note}
            onChangeText={setNote}
          />

          <View style={styles.formActions}>
            <PrimaryButton
              title="Save Dates"
              icon={<Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />}
              onPress={handleSaveCycle}
              loading={savingCycle}
              style={{ flex: 1, marginRight: 6 }}
            />
            <PrimaryButton
              title="Cancel"
              variant="ghost"
              onPress={() => setShowLogForm(false)}
              style={{ flex: 1, marginLeft: 6 }}
            />
          </View>
        </Card>
      ) : (
        <PrimaryButton
          title="Log Past or Current Dates"
          icon={<Ionicons name="add-circle-outline" size={18} color={colors.white} />}
          onPress={() => setShowLogForm(true)}
          style={{ marginBottom: 14 }}
        />
      )}

      {loading ? (
        <ActivityIndicator size="large" color={colors.pink} style={{ marginTop: 40 }} />
      ) : (
        <Card>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="time-outline" size={16} color={colors.rose} style={styles.cardHeaderIcon} />
            <Text style={styles.cardHeader}>CYCLE HISTORY</Text>
          </View>

          {cycles.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-clear-outline" size={36} color={colors.rose} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No cycles logged yet.</Text>
              <Text style={styles.emptySub}>Log your dates above to track your rhythm.</Text>
            </View>
          ) : (
            cycles.map((c, i) => (
              <View key={c.id || i} style={styles.cycleRow}>
                <View style={styles.cycleLeft}>
                  <Ionicons
                    name={c.endedAt || c.end ? 'water-outline' : 'water'}
                    size={22}
                    color={colors.plum}
                    style={styles.cycleIcon}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cycleDate}>
                      {c.startedAt ? c.startedAt.slice(0, 10) : c.start || 'Ongoing'}
                      {(c.endedAt || c.end) ? ` – ${(c.endedAt || c.end).slice(0, 10)}` : ''}
                    </Text>
                    <View style={styles.subRow}>
                      <Text style={styles.cycleSub}>
                        {(c.endedAt || c.end)
                          ? `Ended ${(c.endedAt || c.end).slice(0, 10)}`
                          : 'Currently active'}
                      </Text>
                      {c.flow ? (
                        <View style={styles.flowBadge}>
                          <Text style={styles.flowBadgeText}>{c.flow}</Text>
                        </View>
                      ) : null}
                    </View>
                    {c.note ? <Text style={styles.noteText}>{c.note}</Text> : null}
                  </View>
                </View>

                <View style={styles.cycleRight}>
                  <View style={styles.pillBadge}>
                    <Text style={styles.pillText}>
                      {c.periodDays ? `${c.periodDays}d` : 'Active'}
                    </Text>
                  </View>

                  {c.id ? (
                    <TouchableOpacity
                      onPress={() => handleDeleteCycle(c.id)}
                      disabled={deletingId === c.id}
                      style={styles.deleteCycleBtn}
                    >
                      {deletingId === c.id ? (
                        <ActivityIndicator size="small" color={colors.warn} />
                      ) : (
                        <Ionicons name="trash-outline" size={16} color={colors.warn} />
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </Card>
      )}
        </>
      )}

      <View style={{ height: 90 }} />
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
  topBar: {
    marginBottom: 12,
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
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  segmentBtnActive: {
    backgroundColor: colors.plum,
    shadowColor: colors.plum,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.plum,
  },
  segmentTextActive: {
    color: colors.white,
  },
  formCard: {
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderIcon: {
    marginRight: 6,
  },
  cardHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.rose,
    letterSpacing: 1,
  },
  datesRow: {
    flexDirection: 'row',
  },
  flowLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8d6a84',
    marginBottom: 8,
  },
  flowRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  flowChip: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  flowChipActive: {
    backgroundColor: '#dc97c4',
    borderColor: '#dc97c4',
  },
  flowChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
  },
  flowChipTextActive: {
    color: colors.white,
  },
  formActions: {
    flexDirection: 'row',
    marginTop: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyIcon: {
    marginBottom: 8,
    opacity: 0.7,
  },
  emptyText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  emptySub: {
    color: colors.rose,
    fontSize: 13,
  },
  cycleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  cycleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cycleIcon: {
    marginRight: 10,
  },
  cycleDate: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  cycleSub: {
    fontSize: 12,
    color: colors.rose,
  },
  flowBadge: {
    backgroundColor: '#f6eaf3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  flowBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.plum,
    textTransform: 'uppercase',
  },
  noteText: {
    fontSize: 12,
    color: colors.plum,
    fontStyle: 'italic',
    marginTop: 2,
  },
  cycleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  pillBadge: {
    backgroundColor: '#f3e5f0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  pillText: {
    color: colors.plum,
    fontSize: 12,
    fontWeight: '800',
  },
  deleteCycleBtn: {
    padding: 6,
    marginLeft: 6,
  },
});
