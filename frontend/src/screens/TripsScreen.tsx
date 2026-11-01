import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme/colors';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import {
  PadzyraApi,
  TripItem,
  TripChecklistItem,
} from '../api/client';
import {
  predictPeriodTravelOverlap,
  isValidDateString,
  addDays,
  diffDays,
  formatDate,
  CycleRecord,
} from '../utils/cycleTravelPrediction';
import {
  generateDefaultChecklist,
  getTravelPreparationTips,
} from '../utils/travelChecklist';

interface TripsScreenProps {
  onBack?: () => void;
}

const ACTIVITY_OPTIONS = [
  { id: 'beach', label: 'Beach & Swimming', icon: 'sunny-outline' },
  { id: 'hiking', label: 'Hiking & Outdoors', icon: 'leaf-outline' },
  { id: 'long journey', label: 'Long Journey / Flight', icon: 'airplane-outline' },
  { id: 'office trip', label: 'Office / Work Trip', icon: 'business-outline' },
  { id: 'wedding', label: 'Wedding / Festive Event', icon: 'gift-outline' },
];

export const TripsScreen: React.FC<TripsScreenProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trips, setTrips] = useState<TripItem[]>([]);
  const [cycles, setCycles] = useState<CycleRecord[]>([]);
  const [userProfile, setUserProfile] = useState<{ cycleLength?: number; periodLength?: number }>({
    cycleLength: 28,
    periodLength: 5,
  });

  // View state: 'list' | 'detail' | 'form'
  const [currentView, setCurrentView] = useState<'list' | 'detail' | 'form'>('list');
  const [selectedTrip, setSelectedTrip] = useState<TripItem | null>(null);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);

  // Form states for creating / editing a trip
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const tomorrowIso = useMemo(() => addDays(todayIso, 2), [todayIso]);

  const [formName, setFormName] = useState('');
  const [formDestination, setFormDestination] = useState('');
  const [formStart, setFormStart] = useState(todayIso);
  const [formEnd, setFormEnd] = useState(tomorrowIso);
  const [formActivities, setFormActivities] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [savingTrip, setSavingTrip] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Custom checklist item form state (in detail view)
  const [showAddCustomItem, setShowAddCustomItem] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemCategory, setCustomItemCategory] = useState<'essentials' | 'comfort' | 'medication'>('essentials');
  const [customItemQty, setCustomItemQty] = useState('1');

  // Quick cycle logging state for users with no cycle data
  const [quickCycleStart, setQuickCycleStart] = useState(todayIso);
  const [loggingQuickCycle, setLoggingQuickCycle] = useState(false);
  const [showQuickCycleModal, setShowQuickCycleModal] = useState(false);

  // Filter between upcoming and past trips
  const [tripFilter, setTripFilter] = useState<'upcoming' | 'past'>('upcoming');

  const loadAllData = useCallback(async () => {
    try {
      const [tripsData, cyclesData, meData] = await Promise.all([
        PadzyraApi.getTrips().catch(() => []),
        PadzyraApi.getCycles().catch(() => []),
        PadzyraApi.getMe().catch(() => ({})),
      ]);

      const formattedCycles: CycleRecord[] = (cyclesData || []).map((c: any) => ({
        id: c.id,
        start: c.start || c.startedAt,
        end: c.end || c.endedAt,
        flow: c.flow,
        note: c.note,
      }));

      setTrips(tripsData || []);
      setCycles(formattedCycles);
      const profile = meData as any;
      if (profile && (profile.cycleLength || profile.periodLength)) {
        setUserProfile({
          cycleLength: profile.cycleLength || 28,
          periodLength: profile.periodLength || 5,
        });
      }

      // If viewing a detail trip, refresh it
      if (selectedTrip) {
        const refreshed = (tripsData || []).find((t: TripItem) => t.id === selectedTrip.id);
        if (refreshed) {
          setSelectedTrip(refreshed);
        }
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTrip]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Split trips into upcoming vs past
  const categorizedTrips = useMemo(() => {
    const upcoming: TripItem[] = [];
    const past: TripItem[] = [];

    trips.forEach((t) => {
      if (t.end < todayIso) {
        past.push(t);
      } else {
        upcoming.push(t);
      }
    });

    return { upcoming, past };
  }, [trips, todayIso]);

  // Form open: Add mode vs Edit mode
  const openAddForm = () => {
    setEditingTripId(null);
    setFormName('');
    setFormDestination('');
    setFormStart(todayIso);
    setFormEnd(addDays(todayIso, 3));
    setFormActivities([]);
    setFormError('');
    setCurrentView('form');
  };

  const openEditForm = (trip: TripItem) => {
    setEditingTripId(trip.id);
    setFormName(trip.name || '');
    setFormDestination(trip.destination || '');
    setFormStart(trip.start);
    setFormEnd(trip.end);
    setFormActivities(trip.activities || []);
    setFormError('');
    setCurrentView('form');
  };

  // Activity toggle
  const toggleActivity = (activityId: string) => {
    setFormActivities((prev) =>
      prev.includes(activityId)
        ? prev.filter((a) => a !== activityId)
        : [...prev, activityId]
    );
  };

  // Quick preset application for start/end dates
  const applyPreset = (daysDuration: number) => {
    const s = formStart && isValidDateString(formStart) ? formStart : todayIso;
    const e = addDays(s, daysDuration - 1);
    setFormStart(s);
    setFormEnd(e);
    setFormError('');
  };

  // Adjust date by days
  const adjustDate = (target: 'start' | 'end', deltaDays: number) => {
    if (target === 'start') {
      const next = addDays(formStart, deltaDays);
      setFormStart(next);
      if (formEnd < next) {
        setFormEnd(addDays(next, 2));
      }
    } else {
      const next = addDays(formEnd, deltaDays);
      setFormEnd(next);
    }
    setFormError('');
  };

  // Form submit: Save or Update trip
  const handleSaveTrip = async () => {
    const s = formStart.trim();
    const e = formEnd.trim();

    if (!isValidDateString(s)) {
      setFormError('Please enter a valid Start Date in YYYY-MM-DD format');
      return;
    }
    if (!isValidDateString(e)) {
      setFormError('Please enter a valid End Date in YYYY-MM-DD format');
      return;
    }
    if (e < s) {
      setFormError('End Date cannot be earlier than Start Date');
      return;
    }

    setFormError('');
    setSavingTrip(true);

    try {
      const tripDays = diffDays(s, e) + 1;
      const prediction = predictPeriodTravelOverlap(
        s,
        e,
        cycles,
        userProfile.cycleLength,
        userProfile.periodLength
      );

      if (editingTripId) {
        // Edit existing trip
        const existing = trips.find((t) => t.id === editingTripId);
        const checklist =
          existing?.checklist && existing.checklist.length > 0
            ? existing.checklist
            : generateDefaultChecklist(tripDays, prediction.status, formActivities);

        const updated = await PadzyraApi.updateTrip(editingTripId, {
          start: s,
          end: e,
          name: formName.trim() || null,
          destination: formDestination.trim() || null,
          activities: formActivities,
          checklist,
        });

        setSelectedTrip(updated);
        setCurrentView('detail');
        Alert.alert('Trip Updated', 'Your travel plan and packing list have been saved.');
      } else {
        // Create new trip with smart default checklist
        const initialChecklist = generateDefaultChecklist(
          tripDays,
          prediction.status,
          formActivities
        );

        const created = await PadzyraApi.addTrip({
          start: s,
          end: e,
          name: formName.trim() || null,
          destination: formDestination.trim() || null,
          activities: formActivities,
          checklist: initialChecklist,
        });

        setSelectedTrip(created);
        setCurrentView('detail');
        Alert.alert('Trip Created', 'Your trip and personalized packing checklist are ready!');
      }

      await loadAllData();
    } catch (err: any) {
      setFormError(err?.message || 'Could not save trip. Please check your details.');
    } finally {
      setSavingTrip(false);
    }
  };

  // Delete trip with confirmation
  const handleDeleteTrip = (tripId: string) => {
    Alert.alert(
      'Remove Trip',
      'Are you sure you want to delete this trip and its packing checklist? Your menstrual cycle history will remain completely untouched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Trip',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(tripId);
            try {
              await PadzyraApi.deleteTrip(tripId);
              if (selectedTrip?.id === tripId) {
                setSelectedTrip(null);
                setCurrentView('list');
              }
              await loadAllData();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Could not delete trip');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  // Checklist Item Toggle
  const handleToggleItem = async (itemId: string) => {
    if (!selectedTrip) return;
    const currentList = selectedTrip.checklist || [];
    const updated = currentList.map((item) =>
      item.id === itemId ? { ...item, packed: !item.packed } : item
    );

    const updatedTrip = { ...selectedTrip, checklist: updated };
    setSelectedTrip(updatedTrip);
    setTrips((prev) => prev.map((t) => (t.id === selectedTrip.id ? updatedTrip : t)));

    // Persist to backend
    try {
      await PadzyraApi.updateTrip(selectedTrip.id, { checklist: updated });
    } catch {
      // Revert if error
      setSelectedTrip(selectedTrip);
    }
  };

  // Adjust item quantity
  const handleQuantityChange = async (itemId: string, delta: number) => {
    if (!selectedTrip) return;
    const currentList = selectedTrip.checklist || [];
    const updated = currentList.map((item) => {
      if (item.id === itemId) {
        const nextQty = Math.max((item.quantity || 1) + delta, 1);
        return { ...item, quantity: nextQty };
      }
      return item;
    });

    const updatedTrip = { ...selectedTrip, checklist: updated };
    setSelectedTrip(updatedTrip);
    setTrips((prev) => prev.map((t) => (t.id === selectedTrip.id ? updatedTrip : t)));

    try {
      await PadzyraApi.updateTrip(selectedTrip.id, { checklist: updated });
    } catch {
      setSelectedTrip(selectedTrip);
    }
  };

  // Add custom checklist item
  const handleAddCustomItem = async () => {
    if (!selectedTrip) return;
    const name = customItemName.trim();
    if (!name) {
      Alert.alert('Required', 'Please enter an item name');
      return;
    }

    const qty = parseInt(customItemQty, 10) || 1;
    const newItem: TripChecklistItem = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      category: customItemCategory,
      packed: false,
      quantity: qty,
      custom: true,
    };

    const updated = [...(selectedTrip.checklist || []), newItem];
    const updatedTrip = { ...selectedTrip, checklist: updated };
    setSelectedTrip(updatedTrip);
    setTrips((prev) => prev.map((t) => (t.id === selectedTrip.id ? updatedTrip : t)));

    setCustomItemName('');
    setCustomItemQty('1');
    setShowAddCustomItem(false);

    try {
      await PadzyraApi.updateTrip(selectedTrip.id, { checklist: updated });
    } catch {
      setSelectedTrip(selectedTrip);
    }
  };

  // Remove custom item
  const handleRemoveItem = async (itemId: string) => {
    if (!selectedTrip) return;
    const updated = (selectedTrip.checklist || []).filter((item) => item.id !== itemId);
    const updatedTrip = { ...selectedTrip, checklist: updated };
    setSelectedTrip(updatedTrip);
    setTrips((prev) => prev.map((t) => (t.id === selectedTrip.id ? updatedTrip : t)));

    try {
      await PadzyraApi.updateTrip(selectedTrip.id, { checklist: updated });
    } catch {
      setSelectedTrip(selectedTrip);
    }
  };

  // Reset checklist with confirmation
  const handleResetChecklist = () => {
    if (!selectedTrip) return;
    Alert.alert(
      'Reset Checklist',
      'Reset this trip’s packing checklist back to smart recommendations? Any custom items will be cleared.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset to Defaults',
          style: 'destructive',
          onPress: async () => {
            const tripDays = diffDays(selectedTrip.start, selectedTrip.end) + 1;
            const prediction = predictPeriodTravelOverlap(
              selectedTrip.start,
              selectedTrip.end,
              cycles,
              userProfile.cycleLength,
              userProfile.periodLength
            );
            const freshList = generateDefaultChecklist(
              tripDays,
              prediction.status,
              selectedTrip.activities || []
            );

            const updatedTrip = { ...selectedTrip, checklist: freshList };
            setSelectedTrip(updatedTrip);
            setTrips((prev) => prev.map((t) => (t.id === selectedTrip.id ? updatedTrip : t)));

            try {
              await PadzyraApi.updateTrip(selectedTrip.id, { checklist: freshList });
            } catch {
              // Ignore
            }
          },
        },
      ]
    );
  };

  // Quick log period start date for predictions
  const handleSaveQuickCycle = async () => {
    if (!isValidDateString(quickCycleStart)) {
      Alert.alert('Invalid Date', 'Please enter a valid date in YYYY-MM-DD format');
      return;
    }
    setLoggingQuickCycle(true);
    try {
      await PadzyraApi.createCycle({ start: quickCycleStart });
      setShowQuickCycleModal(false);
      await loadAllData();
      Alert.alert('Period Logged', 'Your cycle dates have been updated. Overlap estimates are now active!');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not log cycle date');
    } finally {
      setLoggingQuickCycle(false);
    }
  };

  // Active trip prediction calculation
  const currentTripPrediction = useMemo(() => {
    if (!selectedTrip) return null;
    return predictPeriodTravelOverlap(
      selectedTrip.start,
      selectedTrip.end,
      cycles,
      userProfile.cycleLength,
      userProfile.periodLength
    );
  }, [selectedTrip, cycles, userProfile]);

  // Active trip travel tips
  const currentTripTips = useMemo(() => {
    if (!selectedTrip || !currentTripPrediction) return [];
    const tripDays = diffDays(selectedTrip.start, selectedTrip.end) + 1;
    return getTravelPreparationTips(
      currentTripPrediction.status,
      selectedTrip.activities || [],
      tripDays
    );
  }, [selectedTrip, currentTripPrediction]);

  // Render Category Checklist Group
  const renderChecklistCategory = (
    categoryKey: 'essentials' | 'comfort' | 'medication',
    categoryTitle: string,
    categoryIcon: string
  ) => {
    if (!selectedTrip) return null;
    const items = (selectedTrip.checklist || []).filter(
      (item) => item.category === categoryKey
    );

    if (items.length === 0) return null;

    return (
      <View style={styles.categorySection} key={categoryKey}>
        <View style={styles.categoryHeaderRow}>
          <Ionicons name={categoryIcon as any} size={16} color={colors.rose} style={{ marginRight: 6 }} />
          <Text style={styles.categoryHeaderTitle}>{categoryTitle.toUpperCase()}</Text>
          <Text style={styles.categoryCountBadge}>
            {items.filter((i) => i.packed).length}/{items.length}
          </Text>
        </View>

        {items.map((item) => (
          <View key={item.id} style={[styles.checklistItemRow, item.packed && styles.checklistItemPacked]}>
            <TouchableOpacity
              style={styles.checkTouchArea}
              onPress={() => handleToggleItem(item.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkBox, item.packed && styles.checkBoxChecked]}>
                {item.packed ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, item.packed && styles.itemTitlePacked]}>
                  {item.name}
                </Text>
                {item.description ? (
                  <Text style={styles.itemDescription}>{item.description}</Text>
                ) : null}
              </View>
            </TouchableOpacity>

            <View style={styles.itemRightControls}>
              {/* Quantity Stepper */}
              <View style={styles.quantityContainer}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => handleQuantityChange(item.id, -1)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.qtyBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.qtyDisplay}>{item.quantity || 1}</Text>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => handleQuantityChange(item.id, 1)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              {item.custom ? (
                <TouchableOpacity
                  style={styles.removeItemBtn}
                  onPress={() => handleRemoveItem(item.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle" size={18} color="#d98282" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    );
  };

  // ==========================================
  // VIEW: Add / Edit Trip Form
  // ==========================================
  if (currentView === 'form') {
    const isEdit = Boolean(editingTripId);
    const tripDays =
      isValidDateString(formStart) && isValidDateString(formEnd) && formEnd >= formStart
        ? diffDays(formStart, formEnd) + 1
        : 1;

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Top Header */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => setCurrentView(selectedTrip ? 'detail' : 'list')}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={colors.plum} />
          </TouchableOpacity>
          <View>
            <Text style={styles.brandSubtitle}>PADZYRA TRAVEL</Text>
            <Text style={styles.brandTitle}>{isEdit ? 'Edit Trip Plan' : 'Plan a New Trip'}</Text>
          </View>
        </View>

        <Card style={styles.formCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="airplane" size={18} color={colors.plum} style={{ marginRight: 6 }} />
            <Text style={styles.cardHeader}>TRIP DETAILS</Text>
          </View>

          <InputField
            label="Trip Name (Optional)"
            placeholder="e.g. Goa Vacation, Office Summit"
            value={formName}
            onChangeText={setFormName}
          />

          <InputField
            label="Destination (Optional)"
            placeholder="e.g. Goa, Manali, Mumbai"
            value={formDestination}
            onChangeText={setFormDestination}
          />

          {/* Quick Presets */}
          <Text style={styles.fieldLabel}>Quick Duration Presets</Text>
          <View style={styles.presetsRow}>
            <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(2)}>
              <Text style={styles.presetChipText}>Weekend (2d)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(4)}>
              <Text style={styles.presetChipText}>Break (4d)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(7)}>
              <Text style={styles.presetChipText}>1 Week (7d)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(14)}>
              <Text style={styles.presetChipText}>2 Weeks (14d)</Text>
            </TouchableOpacity>
          </View>

          {/* Date Pickers */}
          <View style={styles.datesRow}>
            <View style={{ flex: 1, marginRight: 6 }}>
              <InputField
                label="Start Date (YYYY-MM-DD)"
                placeholder="YYYY-MM-DD"
                value={formStart}
                onChangeText={(text) => {
                  setFormStart(text);
                  setFormError('');
                }}
              />
              <View style={styles.stepperRow}>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustDate('start', -1)}>
                  <Text style={styles.stepperText}>-1d</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustDate('start', 1)}>
                  <Text style={styles.stepperText}>+1d</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustDate('start', 7)}>
                  <Text style={styles.stepperText}>+1w</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flex: 1, marginLeft: 6 }}>
              <InputField
                label="End Date (YYYY-MM-DD)"
                placeholder="YYYY-MM-DD"
                value={formEnd}
                onChangeText={(text) => {
                  setFormEnd(text);
                  setFormError('');
                }}
              />
              <View style={styles.stepperRow}>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustDate('end', -1)}>
                  <Text style={styles.stepperText}>-1d</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustDate('end', 1)}>
                  <Text style={styles.stepperText}>+1d</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustDate('end', 7)}>
                  <Text style={styles.stepperText}>+1w</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Trip Duration Feedback */}
          <View style={styles.durationSummaryPill}>
            <Ionicons name="calendar" size={14} color={colors.rose} style={{ marginRight: 6 }} />
            <Text style={styles.durationSummaryText}>
              Duration: <Text style={{ fontWeight: '800' }}>{tripDays} {tripDays === 1 ? 'day' : 'days'}</Text>
              {formStart && formEnd ? ` (${formStart} to ${formEnd})` : ''}
            </Text>
          </View>

          {/* Travel Activities */}
          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Travel Activities (Optional)</Text>
          <Text style={styles.fieldSubLabel}>
            Select your planned activities to receive tailored packing quantities and hygiene tips:
          </Text>

          <View style={styles.activitiesContainer}>
            {ACTIVITY_OPTIONS.map((act) => {
              const isSelected = formActivities.includes(act.id);
              return (
                <TouchableOpacity
                  key={act.id}
                  style={[styles.activityChip, isSelected && styles.activityChipSelected]}
                  onPress={() => toggleActivity(act.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={act.icon as any}
                    size={16}
                    color={isSelected ? colors.white : colors.plum}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.activityChipText, isSelected && styles.activityChipTextSelected]}>
                    {act.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {formError ? (
            <View style={styles.errorAlertBox}>
              <Ionicons name="alert-circle" size={16} color={colors.warn} style={{ marginRight: 6 }} />
              <Text style={styles.errorAlertText}>{formError}</Text>
            </View>
          ) : null}

          <View style={styles.formActions}>
            <PrimaryButton
              title={isEdit ? 'Save Changes' : 'Generate Travel Plan'}
              icon={<Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />}
              onPress={handleSaveTrip}
              loading={savingTrip}
              style={{ flex: 1, marginRight: 6 }}
            />
            <PrimaryButton
              title="Cancel"
              variant="ghost"
              onPress={() => setCurrentView(selectedTrip ? 'detail' : 'list')}
              style={{ flex: 1, marginLeft: 6 }}
            />
          </View>
        </Card>

        <View style={{ height: 100 }} />
      </ScrollView>
    );
  }

  // ==========================================
  // VIEW: Trip Details, Prediction & Checklist
  // ==========================================
  if (currentView === 'detail' && selectedTrip) {
    const tripDays = diffDays(selectedTrip.start, selectedTrip.end) + 1;
    const prediction = currentTripPrediction;
    const checklist = selectedTrip.checklist || [];
    const packedCount = checklist.filter((i) => i.packed).length;
    const totalCount = checklist.length;
    const progressPercent = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;

    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadAllData();
            }}
            tintColor={colors.pink}
          />
        }
      >
        {/* Navigation Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setCurrentView('list')} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={colors.plum} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandSubtitle}>PADZYRA TRAVEL PLANNER</Text>
            <Text style={styles.brandTitle} numberOfLines={1}>
              {selectedTrip.name || selectedTrip.destination || 'Scheduled Trip'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => openEditForm(selectedTrip)} style={styles.iconActionBtn} activeOpacity={0.7}>
            <Ionicons name="pencil-outline" size={18} color={colors.rose} />
          </TouchableOpacity>
        </View>

        {/* Trip Header Summary Card */}
        <Card style={styles.tripHeaderCard}>
          <View style={styles.tripMetaRow}>
            <View style={styles.tripIconBubble}>
              <Ionicons name="airplane" size={20} color={colors.plum} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tripDatesHeader}>
                {selectedTrip.start} – {selectedTrip.end}
              </Text>
              <View style={styles.subMetaRow}>
                <View style={styles.durationPill}>
                  <Text style={styles.durationText}>{tripDays} {tripDays === 1 ? 'day' : 'days'}</Text>
                </View>
                {selectedTrip.destination ? (
                  <View style={styles.destinationPill}>
                    <Ionicons name="location-outline" size={12} color={colors.plum} style={{ marginRight: 3 }} />
                    <Text style={styles.destinationText}>{selectedTrip.destination}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* Activities List */}
          {selectedTrip.activities && selectedTrip.activities.length > 0 ? (
            <View style={styles.activitiesPillsRow}>
              {selectedTrip.activities.map((actId) => {
                const opt = ACTIVITY_OPTIONS.find((a) => a.id === actId);
                return (
                  <View key={actId} style={styles.activityBadge}>
                    <Ionicons name={(opt?.icon || 'pricetag-outline') as any} size={12} color={colors.plum} style={{ marginRight: 4 }} />
                    <Text style={styles.activityBadgeText}>{opt?.label || actId}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </Card>

        {/* ==========================================
            SECTION: Period Overlap Prediction & Visual Timeline
           ========================================== */}
        <Card style={styles.predictionCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="analytics" size={18} color={colors.plum} style={{ marginRight: 6 }} />
            <Text style={styles.cardHeader}>PERIOD OVERLAP ESTIMATE</Text>
          </View>

          {prediction ? (
            <>
              {/* Overlap Status Badge */}
              <View
                style={[
                  styles.statusBadgeLarge,
                  prediction.status === 'overlap' && styles.statusBadgeOverlap,
                  prediction.status === 'unlikely' && styles.statusBadgeUnlikely,
                  prediction.status === 'unavailable' && styles.statusBadgeUnavailable,
                ]}
              >
                <Ionicons
                  name={
                    prediction.status === 'overlap'
                      ? 'warning-outline'
                      : prediction.status === 'unlikely'
                      ? 'checkmark-circle-outline'
                      : 'help-circle-outline'
                  }
                  size={20}
                  color={
                    prediction.status === 'overlap'
                      ? '#b22b5d'
                      : prediction.status === 'unlikely'
                      ? '#2b8253'
                      : '#6e4f68'
                  }
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.statusBadgeText,
                    prediction.status === 'overlap' && styles.statusTextOverlap,
                    prediction.status === 'unlikely' && styles.statusTextUnlikely,
                    prediction.status === 'unavailable' && styles.statusTextUnavailable,
                  ]}
                >
                  {prediction.label}
                </Text>
              </View>

              {/* Qualitative Explanation */}
              <Text style={styles.predictionExplanation}>{prediction.explanation}</Text>

              {/* Visual Timeline Comparison */}
              {prediction.estimatedPeriodWindow ? (
                <View style={styles.timelineBox}>
                  <Text style={styles.timelineTitle}>CYCLE & TRAVEL TIMELINE</Text>

                  {/* Travel Window Bar */}
                  <View style={styles.timelineTrackRow}>
                    <Text style={styles.timelineTrackLabel}>Trip:</Text>
                    <View style={styles.timelineBarTrip}>
                      <Text style={styles.timelineBarText}>
                        {selectedTrip.start} to {selectedTrip.end} ({tripDays}d)
                      </Text>
                    </View>
                  </View>

                  {/* Period Window Bar */}
                  <View style={styles.timelineTrackRow}>
                    <Text style={styles.timelineTrackLabel}>Period:</Text>
                    <View
                      style={[
                        styles.timelineBarPeriod,
                        prediction.status === 'overlap' ? styles.timelineBarPeriodOverlap : null,
                      ]}
                    >
                      <Text style={styles.timelineBarText}>
                        Est. {prediction.estimatedPeriodWindow.start} to {prediction.estimatedPeriodWindow.end}
                        {prediction.bufferDays > 0 ? ` (±${prediction.bufferDays}d)` : ''}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.cycleBaselineNote}>
                    Based on your ~{prediction.stats.avgCycleLength}d cycle and ~{prediction.stats.avgPeriodLength}d flow length.
                    {prediction.regularity === 'variable'
                      ? ' History indicates slight cycle variability, reflected in buffer window.'
                      : ''}
                  </Text>
                </View>
              ) : (
                <View style={styles.noDataBox}>
                  <Text style={styles.noDataTitle}>No Cycle History Recorded Yet</Text>
                  <Text style={styles.noDataText}>
                    To calculate estimated overlap, Padzyra needs at least one past period start date.
                  </Text>
                  <TouchableOpacity
                    style={styles.logCycleActionBtn}
                    onPress={() => setShowQuickCycleModal(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add-circle-outline" size={16} color={colors.white} style={{ marginRight: 6 }} />
                    <Text style={styles.logCycleActionBtnText}>Log Last Period Date</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Honest Medical Disclaimer */}
              <View style={styles.disclaimerBox}>
                <Ionicons name="information-circle-outline" size={14} color="#8a5f7e" style={{ marginRight: 5 }} />
                <Text style={styles.disclaimerText}>{prediction.disclaimer}</Text>
              </View>
            </>
          ) : (
            <ActivityIndicator size="small" color={colors.pink} />
          )}
        </Card>

        {/* Quick Cycle Log Modal for First-time / Missing cycle data users */}
        {showQuickCycleModal ? (
          <Card style={styles.quickCycleModalCard}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="calendar" size={16} color={colors.plum} style={{ marginRight: 6 }} />
              <Text style={styles.cardHeader}>LOG LAST PERIOD START</Text>
            </View>
            <Text style={styles.fieldSubLabel}>
              Enter the date your last menstrual cycle began (YYYY-MM-DD):
            </Text>
            <InputField
              label="Start Date"
              placeholder="YYYY-MM-DD"
              value={quickCycleStart}
              onChangeText={setQuickCycleStart}
            />
            <View style={styles.formActions}>
              <PrimaryButton
                title="Save & Calculate"
                onPress={handleSaveQuickCycle}
                loading={loggingQuickCycle}
                style={{ flex: 1, marginRight: 6 }}
              />
              <PrimaryButton
                title="Cancel"
                variant="ghost"
                onPress={() => setShowQuickCycleModal(false)}
                style={{ flex: 1, marginLeft: 6 }}
              />
            </View>
          </Card>
        ) : null}

        {/* ==========================================
            SECTION: Personalized Travel Preparation Tips
           ========================================== */}
        {currentTripTips.length > 0 ? (
          <Card style={styles.tipsCard}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="sparkles" size={18} color="#cb6995" style={{ marginRight: 6 }} />
              <Text style={styles.cardHeader}>PERSONALIZED TRAVEL PREPARATION</Text>
            </View>

            {currentTripTips.map((tip) => (
              <View key={tip.id} style={styles.tipItemRow}>
                <View style={styles.tipIconBubble}>
                  <Ionicons name={tip.icon as any} size={16} color={colors.plum} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipItemTitle}>{tip.title}</Text>
                  <Text style={styles.tipItemBody}>{tip.tip}</Text>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {/* ==========================================
            SECTION: Smart Packing Checklist
           ========================================== */}
        <Card style={styles.checklistCard}>
          <View style={styles.checklistHeaderRow}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="checkbox-outline" size={18} color={colors.plum} style={{ marginRight: 6 }} />
                <Text style={styles.cardHeader}>TRAVEL PACKING CHECKLIST</Text>
              </View>
              <Text style={styles.checklistProgressText}>
                {packedCount} of {totalCount} items packed ({progressPercent}%)
              </Text>
            </View>

            <TouchableOpacity style={styles.resetBtn} onPress={handleResetChecklist} activeOpacity={0.7}>
              <Ionicons name="refresh-outline" size={14} color={colors.rose} style={{ marginRight: 4 }} />
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>

          {/* Categories */}
          {renderChecklistCategory('essentials', 'Period Essentials', 'medkit-outline')}
          {renderChecklistCategory('comfort', 'Comfort & Personal Care', 'heart-outline')}
          {renderChecklistCategory('medication', 'Medication & Health', 'fitness-outline')}

          {/* Add Custom Item Modal / Box */}
          {showAddCustomItem ? (
            <View style={styles.addCustomBox}>
              <Text style={styles.addCustomTitle}>Add Custom Item</Text>
              <InputField
                label="Item Name"
                placeholder="e.g. Dark chocolate, Extra zip bag"
                value={customItemName}
                onChangeText={setCustomItemName}
              />
              <View style={styles.categoryPickerRow}>
                <TouchableOpacity
                  style={[
                    styles.catChoiceChip,
                    customItemCategory === 'essentials' && styles.catChoiceChipActive,
                  ]}
                  onPress={() => setCustomItemCategory('essentials')}
                >
                  <Text style={[styles.catChoiceText, customItemCategory === 'essentials' && styles.catChoiceTextActive]}>
                    Essentials
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.catChoiceChip,
                    customItemCategory === 'comfort' && styles.catChoiceChipActive,
                  ]}
                  onPress={() => setCustomItemCategory('comfort')}
                >
                  <Text style={[styles.catChoiceText, customItemCategory === 'comfort' && styles.catChoiceTextActive]}>
                    Comfort
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.catChoiceChip,
                    customItemCategory === 'medication' && styles.catChoiceChipActive,
                  ]}
                  onPress={() => setCustomItemCategory('medication')}
                >
                  <Text style={[styles.catChoiceText, customItemCategory === 'medication' && styles.catChoiceTextActive]}>
                    Health
                  </Text>
                </TouchableOpacity>
              </View>

              <InputField
                label="Quantity"
                placeholder="1"
                value={customItemQty}
                onChangeText={setCustomItemQty}
                keyboardType="numeric"
              />

              <View style={styles.formActions}>
                <PrimaryButton
                  title="Add to List"
                  onPress={handleAddCustomItem}
                  style={{ flex: 1, marginRight: 6 }}
                />
                <PrimaryButton
                  title="Cancel"
                  variant="ghost"
                  onPress={() => setShowAddCustomItem(false)}
                  style={{ flex: 1, marginLeft: 6 }}
                />
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addCustomTriggerBtn}
              onPress={() => setShowAddCustomItem(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={17} color={colors.rose} style={{ marginRight: 6 }} />
              <Text style={styles.addCustomTriggerText}>Add Custom Packing Item</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* Delete Trip Section */}
        <TouchableOpacity
          style={styles.deleteTripFooterBtn}
          onPress={() => handleDeleteTrip(selectedTrip.id)}
          disabled={deletingId === selectedTrip.id}
          activeOpacity={0.7}
        >
          {deletingId === selectedTrip.id ? (
            <ActivityIndicator size="small" color={colors.warn} />
          ) : (
            <>
              <Ionicons name="trash-outline" size={16} color={colors.warn} style={{ marginRight: 6 }} />
              <Text style={styles.deleteTripFooterText}>Delete This Trip</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    );
  }

  // ==========================================
  // VIEW: My Trips List (Default Landing View)
  // ==========================================
  const activeTripList =
    tripFilter === 'upcoming' ? categorizedTrips.upcoming : categorizedTrips.past;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadAllData();
          }}
          tintColor={colors.pink}
        />
      }
    >
      {/* Top Bar */}
      <View style={styles.topBar}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={colors.plum} />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.brandSubtitle}>PADZYRA TRAVEL</Text>
          <Text style={styles.brandTitle}>Period Travel Planner</Text>
        </View>
      </View>

      {/* Feature Value Banner Card */}
      <Card style={styles.tipCard}>
        <View style={styles.tipHeader}>
          <Ionicons name="sparkles" size={16} color="#dc97c4" style={{ marginRight: 6 }} />
          <Text style={styles.tipTitle}>SMART PERIOD TRAVEL PLANNING</Text>
        </View>
        <Text style={styles.tipText}>
          Plan vacations, business travels, and weekend getaways with confidence. Check estimated cycle overlap and pack a tailored menstrual emergency kit.
        </Text>
      </Card>

      {/* Plan New Trip Action Button */}
      <PrimaryButton
        title="Plan an Upcoming Trip"
        icon={<Ionicons name="add-circle-outline" size={19} color={colors.white} />}
        onPress={openAddForm}
        style={{ marginBottom: 16 }}
      />

      {/* Upcoming / Past Segment Control */}
      <View style={styles.filterSegmentContainer}>
        <TouchableOpacity
          style={[styles.filterSegmentBtn, tripFilter === 'upcoming' && styles.filterSegmentBtnActive]}
          onPress={() => setTripFilter('upcoming')}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterSegmentText, tripFilter === 'upcoming' && styles.filterSegmentTextActive]}>
            Upcoming Trips ({categorizedTrips.upcoming.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterSegmentBtn, tripFilter === 'past' && styles.filterSegmentBtnActive]}
          onPress={() => setTripFilter('past')}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterSegmentText, tripFilter === 'past' && styles.filterSegmentTextActive]}>
            Past Trips ({categorizedTrips.past.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Trips List Container */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="briefcase-outline" size={17} color={colors.rose} style={{ marginRight: 6 }} />
          <Text style={styles.cardHeader}>
            {tripFilter === 'upcoming' ? 'UPCOMING TRAVEL SCHEDULE' : 'COMPLETED TRIPS'}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color={colors.pink} style={{ marginVertical: 24 }} />
        ) : activeTripList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name={tripFilter === 'upcoming' ? 'airplane-outline' : 'calendar-outline'}
              size={42}
              color={colors.rose}
              style={{ opacity: 0.6, marginBottom: 10 }}
            />
            <Text style={styles.emptyText}>
              {tripFilter === 'upcoming' ? 'No upcoming trips planned yet.' : 'No past trips on record.'}
            </Text>
            <Text style={styles.emptySub}>
              {tripFilter === 'upcoming'
                ? 'Add your vacation or work travels to preview cycle overlap and packing checklists.'
                : 'Trips that have ended will appear here for your travel history.'}
            </Text>
            {tripFilter === 'upcoming' ? (
              <TouchableOpacity style={styles.emptyActionBtn} onPress={openAddForm} activeOpacity={0.7}>
                <Ionicons name="add" size={16} color={colors.plum} style={{ marginRight: 4 }} />
                <Text style={styles.emptyActionBtnText}>Create Your First Trip</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          activeTripList.map((trip) => {
            const tripDays = diffDays(trip.start, trip.end) + 1;
            const prediction = predictPeriodTravelOverlap(
              trip.start,
              trip.end,
              cycles,
              userProfile.cycleLength,
              userProfile.periodLength
            );

            const checklist = trip.checklist || [];
            const packedCount = checklist.filter((i) => i.packed).length;
            const totalCount = checklist.length;
            const progressPercent = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;

            return (
              <TouchableOpacity
                key={trip.id}
                style={styles.tripListItem}
                onPress={() => {
                  setSelectedTrip(trip);
                  setCurrentView('detail');
                }}
                activeOpacity={0.8}
              >
                <View style={styles.tripItemTopRow}>
                  <View style={styles.tripIconBubble}>
                    <Ionicons name="airplane" size={18} color={colors.plum} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tripTitleText} numberOfLines={1}>
                      {trip.name || trip.destination || 'Scheduled Trip'}
                    </Text>
                    <Text style={styles.tripDateRangeText}>
                      {trip.start} – {trip.end}
                    </Text>
                  </View>

                  {/* Overlap Status Badge */}
                  <View
                    style={[
                      styles.statusPill,
                      prediction.status === 'overlap' && styles.statusPillOverlap,
                      prediction.status === 'unlikely' && styles.statusPillUnlikely,
                      prediction.status === 'unavailable' && styles.statusPillUnavailable,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        prediction.status === 'overlap' && styles.statusPillTextOverlap,
                        prediction.status === 'unlikely' && styles.statusPillTextUnlikely,
                        prediction.status === 'unavailable' && styles.statusPillTextUnavailable,
                      ]}
                    >
                      {prediction.status === 'overlap'
                        ? '🌸 Overlap'
                        : prediction.status === 'unlikely'
                        ? '🌿 Unlikely'
                        : '⏳ No Cycle'}
                    </Text>
                  </View>
                </View>

                {/* Sub row with destination & days */}
                <View style={styles.tripBadgesRow}>
                  <View style={styles.durationPill}>
                    <Text style={styles.durationText}>{tripDays} {tripDays === 1 ? 'day' : 'days'}</Text>
                  </View>
                  {trip.destination ? (
                    <View style={styles.destinationPill}>
                      <Ionicons name="location-outline" size={11} color={colors.plum} style={{ marginRight: 2 }} />
                      <Text style={styles.destinationText}>{trip.destination}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Packing Progress Mini Bar */}
                {totalCount > 0 ? (
                  <View style={styles.miniProgressContainer}>
                    <View style={styles.miniProgressHeader}>
                      <Text style={styles.miniProgressLabel}>Packing Checklist</Text>
                      <Text style={styles.miniProgressCount}>
                        {packedCount}/{totalCount} packed ({progressPercent}%)
                      </Text>
                    </View>
                    <View style={styles.miniProgressTrack}>
                      <View style={[styles.miniProgressFill, { width: `${progressPercent}%` }]} />
                    </View>
                  </View>
                ) : null}

                {/* Arrow hint to open */}
                <View style={styles.tripCardFooter}>
                  <Text style={styles.tapToOpenText}>View prediction & checklist</Text>
                  <Ionicons name="chevron-forward" size={15} color={colors.rose} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </Card>

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
    paddingTop: 18,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  backBtn: {
    padding: 8,
    marginRight: 10,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.rose,
    letterSpacing: 1.5,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.plum,
    letterSpacing: -0.4,
  },
  iconActionBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tipCard: {
    backgroundColor: '#fff7fb',
    borderColor: '#f0c7db',
    borderWidth: 1.5,
    marginBottom: 14,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  tipTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.plum,
    letterSpacing: 1,
  },
  tipText: {
    fontSize: 13,
    color: colors.rose,
    lineHeight: 19,
  },
  filterSegmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterSegmentBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 10,
  },
  filterSegmentBtnActive: {
    backgroundColor: colors.plum,
  },
  filterSegmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.plum,
  },
  filterSegmentTextActive: {
    color: colors.white,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardHeader: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.plum,
    letterSpacing: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 26,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.plum,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: colors.rose,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7e6f0',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ebd2e2',
  },
  emptyActionBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.plum,
  },
  tripListItem: {
    backgroundColor: '#fffcfd',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 12,
  },
  tripItemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripIconBubble: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f6e7f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  tripTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.plum,
  },
  tripDateRangeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.rose,
    marginTop: 2,
  },
  tripBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 6,
  },
  durationPill: {
    backgroundColor: '#f2e5ed',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.plum,
  },
  destinationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdf0f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  destinationText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.plum,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f5f0f3',
  },
  statusPillOverlap: {
    backgroundColor: '#fdecf2',
  },
  statusPillUnlikely: {
    backgroundColor: '#eaf6ef',
  },
  statusPillUnavailable: {
    backgroundColor: '#f2edf2',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.plum,
  },
  statusPillTextOverlap: {
    color: '#b22b5d',
  },
  statusPillTextUnlikely: {
    color: '#267b4d',
  },
  statusPillTextUnavailable: {
    color: '#6e4f68',
  },
  miniProgressContainer: {
    backgroundColor: '#faf2f6',
    padding: 8,
    borderRadius: 10,
    marginBottom: 8,
  },
  miniProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  miniProgressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.plum,
  },
  miniProgressCount: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.rose,
  },
  miniProgressTrack: {
    height: 6,
    backgroundColor: '#ebd8e3',
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: 6,
    backgroundColor: colors.pink,
    borderRadius: 3,
  },
  tripCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 4,
  },
  tapToOpenText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.rose,
    marginRight: 4,
  },

  // Form Styles
  formCard: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.plum,
    marginBottom: 8,
  },
  fieldSubLabel: {
    fontSize: 12,
    color: colors.rose,
    marginBottom: 10,
    lineHeight: 16,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  presetChip: {
    backgroundColor: '#f8e9f2',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#e8cadc',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.plum,
  },
  datesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: -8,
    marginBottom: 12,
  },
  stepperBtn: {
    backgroundColor: '#f2e4ed',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stepperText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.plum,
  },
  durationSummaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef1f7',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f0d3e2',
    marginBottom: 6,
  },
  durationSummaryText: {
    fontSize: 12,
    color: colors.plum,
  },
  activitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  activityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.4,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  activityChipSelected: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
  },
  activityChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.plum,
  },
  activityChipTextSelected: {
    color: colors.white,
  },
  errorAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdeeed',
    borderWidth: 1,
    borderColor: '#facdca',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  errorAlertText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warn,
    flex: 1,
  },
  formActions: {
    flexDirection: 'row',
    marginTop: 8,
  },

  // Detail View Styles
  tripHeaderCard: {
    marginBottom: 14,
    backgroundColor: '#fffbfc',
  },
  tripMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripDatesHeader: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.plum,
  },
  subMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  activitiesPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f7e6f0',
  },
  activityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9edf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activityBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.plum,
  },

  // Prediction Styles
  predictionCard: {
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#f2d4e4',
  },
  statusBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  statusBadgeOverlap: {
    backgroundColor: '#fdecf2',
    borderWidth: 1.2,
    borderColor: '#f9cadb',
  },
  statusBadgeUnlikely: {
    backgroundColor: '#edf7f1',
    borderWidth: 1.2,
    borderColor: '#c6ebd4',
  },
  statusBadgeUnavailable: {
    backgroundColor: '#f5eff4',
    borderWidth: 1.2,
    borderColor: '#e8dbe6',
  },
  statusBadgeText: {
    fontSize: 16,
    fontWeight: '900',
  },
  statusTextOverlap: {
    color: '#b22b5d',
  },
  statusTextUnlikely: {
    color: '#267b4d',
  },
  statusTextUnavailable: {
    color: '#6e4f68',
  },
  predictionExplanation: {
    fontSize: 13,
    color: colors.plum,
    lineHeight: 19,
    marginBottom: 12,
  },
  timelineBox: {
    backgroundColor: '#faf1f6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  timelineTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.rose,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  timelineTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  timelineTrackLabel: {
    width: 50,
    fontSize: 11,
    fontWeight: '800',
    color: colors.plum,
  },
  timelineBarTrip: {
    flex: 1,
    backgroundColor: '#60284e',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 7,
  },
  timelineBarPeriod: {
    flex: 1,
    backgroundColor: '#9a537f',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 7,
  },
  timelineBarPeriodOverlap: {
    backgroundColor: '#d3366c',
  },
  timelineBarText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  cycleBaselineNote: {
    fontSize: 11,
    color: colors.rose,
    marginTop: 4,
    lineHeight: 15,
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fbf7fa',
    padding: 9,
    borderRadius: 9,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#8a5f7e',
    lineHeight: 15,
    flex: 1,
  },
  noDataBox: {
    backgroundColor: '#faf1f6',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  noDataTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.plum,
    marginBottom: 4,
  },
  noDataText: {
    fontSize: 12,
    color: colors.rose,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 10,
  },
  logCycleActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.plum,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 9,
  },
  logCycleActionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.white,
  },
  quickCycleModalCard: {
    marginBottom: 14,
    backgroundColor: '#fff7fc',
    borderColor: colors.pink,
    borderWidth: 1.5,
  },

  // Travel Tips Card
  tipsCard: {
    marginBottom: 14,
    backgroundColor: '#fffcfd',
  },
  tipItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tipIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#f8e9f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  tipItemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.plum,
    marginBottom: 2,
  },
  tipItemBody: {
    fontSize: 12,
    color: colors.rose,
    lineHeight: 17,
  },

  // Checklist Styles
  checklistCard: {
    marginBottom: 14,
  },
  checklistHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  checklistProgressText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.rose,
    marginTop: 2,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: '#f7e7f0',
  },
  resetBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.rose,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#f0d9e6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: 8,
    backgroundColor: colors.pink,
    borderRadius: 4,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#faf2f7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  categoryHeaderTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.plum,
    letterSpacing: 0.8,
    flex: 1,
  },
  categoryCountBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.rose,
  },
  checklistItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#f4dfeb',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  checklistItemPacked: {
    backgroundColor: '#fcf6f9',
    borderColor: '#ebd6e2',
  },
  checkTouchArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.8,
    borderColor: '#d07aaa',
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkBoxChecked: {
    backgroundColor: colors.pink,
    borderColor: colors.pink,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  itemTitlePacked: {
    color: '#a38199',
    textDecorationLine: 'line-through',
  },
  itemDescription: {
    fontSize: 11,
    color: '#9e7b95',
    marginTop: 1,
  },
  itemRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f6eaf1',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginRight: 6,
  },
  qtyBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  qtyBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.plum,
  },
  qtyDisplay: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.plum,
    paddingHorizontal: 4,
    minWidth: 16,
    textAlign: 'center',
  },
  removeItemBtn: {
    padding: 4,
  },
  addCustomTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff4fa',
    borderWidth: 1.2,
    borderColor: '#f0cddf',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 4,
  },
  addCustomTriggerText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.rose,
  },
  addCustomBox: {
    backgroundColor: '#fbf2f7',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  addCustomTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.plum,
    marginBottom: 8,
  },
  categoryPickerRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  catChoiceChip: {
    flex: 1,
    paddingVertical: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    alignItems: 'center',
  },
  catChoiceChipActive: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
  },
  catChoiceText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.plum,
  },
  catChoiceTextActive: {
    color: colors.white,
  },
  deleteTripFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  deleteTripFooterText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.warn,
  },
});
