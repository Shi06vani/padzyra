import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme/colors';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import { PadzyraApi, ApiConfig } from '../api/client';
import { SubscriptionModal } from '../components/SubscriptionModal';
import { useAppLock } from '../context/AppLockContext';
import { AUTO_LOCK_TIMEOUT_OPTIONS } from '../services/appLockStorage';

interface SettingsScreenProps {
  onLogout: () => void;
  onSetPinRequested: (hasPin?: boolean) => void;
  onNavigateToActivity?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onLogout,
  onSetPinRequested,
  onNavigateToActivity,
}) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>({});
  const [expense, setExpense] = useState<{ used?: number; bought?: number; amount?: string | number } | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [showSubModal, setShowSubModal] = useState(false);

  // Form states
  const [padSize, setPadSize] = useState('regular');
  const [price, setPrice] = useState('15');
  const [discreet, setDiscreet] = useState(false);
  const [cycleLength, setCycleLength] = useState('28');
  const [periodLength, setPeriodLength] = useState('5');
  const [leaveHome, setLeaveHome] = useState('08:00');
  const [lunch, setLunch] = useState('13:00');
  const [quietStart, setQuietStart] = useState('');
  const [quietEnd, setQuietEnd] = useState('');
  const [heat, setHeat] = useState('');

  const [saving, setSaving] = useState(false);
  const [serverUrl, setServerUrl] = useState(ApiConfig.getBaseUrl());
  const [testingBiometrics, setTestingBiometrics] = useState(false);

  const {
    config: appLockConfig,
    capability: biometricCap,
    updateConfig: updateAppLockConfig,
    testBiometrics,
  } = useAppLock();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await PadzyraApi.getMe();
      if (data) {
        setUser(data);
        if (data.padSize) setPadSize(data.padSize);
        if (data.price !== undefined) setPrice(String(data.price));
        if (data.discreet !== undefined) setDiscreet(Boolean(data.discreet));
        if (data.cycleLength !== undefined) setCycleLength(String(data.cycleLength));
        if (data.periodLength !== undefined) setPeriodLength(String(data.periodLength));
        if (data.leaveHome) setLeaveHome(data.leaveHome);
        if (data.lunch) setLunch(data.lunch);
        if (data.quietStart) setQuietStart(data.quietStart);
        if (data.quietEnd) setQuietEnd(data.quietEnd);
        if (data.heat) setHeat(data.heat);

        if (data.role === 'girl' && data.pin) {
          PadzyraApi.getExpense()
            .then((exp) => setExpense(exp))
            .catch(() => {});
        }

        PadzyraApi.getCurrentSubscription()
          .then((sub) => {
            if (sub && sub.active) setSubscription(sub);
          })
          .catch(() => {});
      }
    } catch {
      // Continue with defaults
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: any = {
        padSize,
        price: parseFloat(price) || 15,
        leaveHome: leaveHome.trim() || '08:00',
        lunch: lunch.trim() || '13:00',
        quietStart: quietStart.trim() || null,
        quietEnd: quietEnd.trim() || null,
        heat: heat.trim() || null,
      };

      if (user.role === 'girl') {
        body.discreet = discreet;
        body.cycleLength = parseInt(cycleLength, 10) || 28;
        body.periodLength = parseInt(periodLength, 10) || 5;
      }

      await PadzyraApi.updateMe(body);
      ApiConfig.setBaseUrl(serverUrl);
      Alert.alert('Saved', 'Your settings and preferences have been updated.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await PadzyraApi.logout();
    } catch {
      // ignore
    } finally {
      onLogout();
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  const isGirl = user.role !== 'shop';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Text style={styles.brandTitle}>{isGirl ? 'Profile & Settings' : 'Partner Settings'}</Text>
        <Text style={styles.brandSubtitle}>Account, privacy, security & cycle preferences</Text>
      </View>

      {/* Monthly Expense Card (for girl role) */}
      {isGirl && expense ? (
        <Card>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="wallet-outline" size={16} color={colors.rose} style={styles.cardHeaderIcon} />
            <Text style={styles.cardHeader}>THIS MONTH</Text>
          </View>
          <View style={styles.expenseTiles}>
            <View style={styles.expenseTile}>
              <Text style={styles.expenseLabel}>Used</Text>
              <Text style={styles.expenseValue}>{expense.used ?? 0}</Text>
            </View>
            <View style={styles.expenseTile}>
              <Text style={styles.expenseLabel}>Picked up</Text>
              <Text style={styles.expenseValue}>{expense.bought ?? 0}</Text>
            </View>
            <View style={styles.expenseTile}>
              <Text style={styles.expenseLabel}>Amount</Text>
              <Text style={styles.expenseValue}>₹{expense.amount ?? 0}</Text>
            </View>
          </View>
        </Card>
      ) : null}

      {/* Account Info */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="person-circle-outline" size={16} color={colors.rose} style={styles.cardHeaderIcon} />
          <Text style={styles.cardHeader}>ACCOUNT</Text>
        </View>
        <Text style={styles.userEmail}>{user.email || 'user@padzyra.app'}</Text>
        <View style={styles.roleBadge}>
          <Ionicons
            name={user.role === 'shop' ? 'storefront-outline' : 'heart-outline'}
            size={13}
            color={colors.plum}
            style={{ marginRight: 4 }}
          />
          <Text style={styles.userRole}>
            {user.role === 'shop' ? 'Medical Shop Partner' : 'Personal Account'}
          </Text>
        </View>

        {onNavigateToActivity && isGirl ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onNavigateToActivity}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 14,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: colors.line,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="receipt-outline" size={18} color={colors.plum} style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.plum }}>
                Orders & Care Activity
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.rose} />
          </TouchableOpacity>
        ) : null}
      </Card>

      {/* Padzyra Plus & Membership (for personal girl account) */}
      {isGirl ? (
        <Card>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="ribbon-outline" size={17} color={colors.plum} style={styles.cardHeaderIcon} />
            <Text style={styles.cardHeader}>PADZYRA PLUS & MEMBERSHIP</Text>
          </View>

          {subscription?.active ? (
            <View style={styles.activeSubBox}>
              <View style={styles.activeSubTop}>
                <View>
                  <View style={styles.activePlanBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#2f7a52" style={{ marginRight: 4 }} />
                    <Text style={styles.activePlanBadgeText}>ACTIVE MEMBERSHIP</Text>
                  </View>
                  <Text style={styles.activePlanName}>{subscription.planName || 'Flow Care'}</Text>
                  <Text style={styles.activePlanFee}>₹{subscription.amount} / month</Text>
                </View>
                <TouchableOpacity
                  style={styles.changePlanBtn}
                  onPress={() => setShowSubModal(true)}
                >
                  <Text style={styles.changePlanBtnText}>Change Plan</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.subPerksList}>
                <Text style={styles.subPerkItem}>✓ 24/7 AI Gynec & Period Coach active</Text>
                <Text style={styles.subPerkItem}>✓ Unlimited anonymous period thoughts</Text>
                <Text style={styles.subPerkItem}>✓ Doctor cycle report export enabled</Text>
              </View>
            </View>
          ) : (
            <View style={styles.inactiveSubBox}>
              <View style={styles.inactiveSubHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inactiveSubTitle}>Upgrade to Padzyra Plus</Text>
                  <Text style={styles.inactiveSubSub}>
                    Unlock 24/7 AI Gynec Coach, Doctor Reports & VIP Sisterhood Badges.
                  </Text>
                </View>
                <View style={styles.subPriceTag}>
                  <Text style={styles.subPriceTagSmall}>From</Text>
                  <Text style={styles.subPriceTagBig}>₹50</Text>
                  <Text style={styles.subPriceTagSmall}>/mo</Text>
                </View>
              </View>

              <View style={styles.planBadgesRow}>
                <View style={styles.miniPlanChip}>
                  <Text style={styles.miniPlanChipText}>₹50 Starter</Text>
                </View>
                <View style={[styles.miniPlanChip, styles.miniPlanChipPopular]}>
                  <Text style={[styles.miniPlanChipText, { color: colors.white }]}>₹100 Pro</Text>
                </View>
                <View style={styles.miniPlanChip}>
                  <Text style={styles.miniPlanChipText}>₹250 VIP</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.explorePlansBtn}
                activeOpacity={0.85}
                onPress={() => setShowSubModal(true)}
              >
                <Text style={styles.explorePlansBtnText}>Explore Plans & Benefits</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.white} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          )}
        </Card>
      ) : null}

      {/* Cycle Settings (for personal girl account) */}
      {isGirl ? (
        <Card>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.rose} style={styles.cardHeaderIcon} />
            <Text style={styles.cardHeader}>CYCLE & HEALTH</Text>
          </View>

          <View style={styles.inputsRow}>
            <InputField
              label="Cycle length (days)"
              value={cycleLength}
              onChangeText={setCycleLength}
              keyboardType="numeric"
              containerStyle={{ flex: 1, marginRight: 8 }}
            />
            <InputField
              label="Period days"
              value={periodLength}
              onChangeText={setPeriodLength}
              keyboardType="numeric"
              containerStyle={{ flex: 1, marginLeft: 8 }}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Discreet Mode</Text>
              <Text style={styles.settingSub}>
                Hides cycle health terminology on screen
              </Text>
            </View>
            <Switch
              value={discreet}
              onValueChange={setDiscreet}
              trackColor={{ false: colors.line, true: '#dc97c4' }}
              thumbColor={colors.white}
            />
          </View>
        </Card>
      ) : null}

      {/* Preferences Card */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="options-outline" size={16} color={colors.rose} style={styles.cardHeaderIcon} />
          <Text style={styles.cardHeader}>PAD PREFERENCES</Text>
        </View>

        <Text style={styles.settingLabel}>Preferred Pad Size</Text>
        <View style={styles.sizesRow}>
          {['regular', 'xl', 'night'].map((size) => {
            const active = padSize === size;
            return (
              <TouchableOpacity
                key={size}
                style={[styles.sizeBtn, active && styles.sizeBtnActive]}
                onPress={() => setPadSize(size)}
              >
                <Text style={[styles.sizeText, active && styles.sizeTextActive]}>
                  {size.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <InputField
          label="Estimated price per pad (₹)"
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
          containerStyle={{ marginTop: 14 }}
        />
      </Card>

      {/* Schedule & Quiet Hours */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="time-outline" size={16} color={colors.rose} style={styles.cardHeaderIcon} />
          <Text style={styles.cardHeader}>SCHEDULE & QUIET HOURS</Text>
        </View>
        <Text style={styles.settingSub}>
          Quiet hours stay quiet, with a reminder at lunch and before leaving home.
        </Text>

        <View style={styles.inputsRow}>
          <InputField
            label="Leave home"
            placeholder="08:00"
            value={leaveHome}
            onChangeText={setLeaveHome}
            containerStyle={{ flex: 1, marginRight: 8 }}
          />
          <InputField
            label="Lunch change"
            placeholder="13:00"
            value={lunch}
            onChangeText={setLunch}
            containerStyle={{ flex: 1, marginLeft: 8 }}
          />
        </View>

        <View style={styles.inputsRow}>
          <InputField
            label="Quiet start"
            placeholder="e.g. 09:00"
            value={quietStart}
            onChangeText={setQuietStart}
            containerStyle={{ flex: 1, marginRight: 8 }}
          />
          <InputField
            label="Quiet end"
            placeholder="e.g. 15:00"
            value={quietEnd}
            onChangeText={setQuietEnd}
            containerStyle={{ flex: 1, marginLeft: 8 }}
          />
        </View>

        <InputField
          label="Heat reminder time (optional)"
          placeholder="e.g. 21:00"
          value={heat}
          onChangeText={setHeat}
        />

        <PrimaryButton
          title="Save Preferences"
          onPress={handleSave}
          loading={saving}
          icon={<Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />}
          style={{ marginTop: 10 }}
        />
      </Card>

      {/* App Lock & Biometric Security */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="lock-closed" size={16} color={colors.rose} style={styles.cardHeaderIcon} />
          <Text style={styles.cardHeader}>APP LOCK & PRIVACY SHIELD</Text>
        </View>
        <Text style={styles.settingSub}>
          Protect your private cycle diary, symptoms, and health logs whenever you switch apps or leave your phone unattended.
        </Text>

        <View style={[styles.switchRow, { marginTop: 12 }]}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.settingLabel}>Enable App Lock</Text>
            <Text style={styles.settingSub}>
              Require authentication to open Padzyra
            </Text>
          </View>
          <Switch
            value={appLockConfig.enabled}
            onValueChange={(val) => {
              updateAppLockConfig({ enabled: val });
            }}
            trackColor={{ false: colors.line, true: '#dc97c4' }}
            thumbColor={colors.white}
          />
        </View>

        {appLockConfig.enabled ? (
          <View style={styles.appLockOptionsBox}>
            {/* Biometric Toggle */}
            <View style={[styles.switchRow, { marginTop: 14 }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons
                    name={biometricCap?.iconName || 'finger-print-outline'}
                    size={16}
                    color={colors.plum}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.settingLabel}>
                    Unlock with {biometricCap?.displayTitle || 'Biometrics'}
                  </Text>
                </View>
                <Text style={styles.settingSub}>
                  {biometricCap?.helperText || 'Quick access using your enrolled biometric'}
                </Text>
              </View>
              <Switch
                value={appLockConfig.biometricEnabled}
                disabled={!biometricCap?.canEnableBiometrics}
                onValueChange={(val) => {
                  updateAppLockConfig({ biometricEnabled: val });
                }}
                trackColor={{ false: colors.line, true: '#dc97c4' }}
                thumbColor={colors.white}
              />
            </View>

            {/* Auto-Lock Timeout Selection */}
            <View style={{ marginTop: 16 }}>
              <Text style={styles.settingLabel}>Auto-Lock Timing</Text>
              <Text style={styles.settingSub}>
                How quickly Padzyra locks after leaving the app
              </Text>

              <View style={styles.timeoutOptionsRow}>
                {AUTO_LOCK_TIMEOUT_OPTIONS.map((opt) => {
                  const isSelected = appLockConfig.autoLockTimeout === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.timeoutChip,
                        isSelected && styles.timeoutChipActive,
                      ]}
                      onPress={() => updateAppLockConfig({ autoLockTimeout: opt.value })}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.timeoutChipText,
                          isSelected && styles.timeoutChipTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Task Switcher Protection Toggle */}
            <View style={[styles.switchRow, { marginTop: 16 }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.settingLabel}>App Switcher Protection</Text>
                <Text style={styles.settingSub}>
                  Hides screen preview in multitasking view to prevent shoulder surfing
                </Text>
              </View>
              <Switch
                value={appLockConfig.taskSwitcherProtection}
                onValueChange={(val) => {
                  updateAppLockConfig({ taskSwitcherProtection: val });
                }}
                trackColor={{ false: colors.line, true: '#dc97c4' }}
                thumbColor={colors.white}
              />
            </View>

            {/* Test Biometrics Button */}
            {biometricCap?.canEnableBiometrics ? (
              <TouchableOpacity
                style={styles.testBiometricsBtn}
                disabled={testingBiometrics}
                onPress={async () => {
                  setTestingBiometrics(true);
                  const res = await testBiometrics();
                  setTestingBiometrics(false);
                  Alert.alert(
                    res.success ? 'Biometric Test Passed' : 'Biometric Test Notice',
                    res.message
                  );
                }}
                activeOpacity={0.8}
              >
                {testingBiometrics ? (
                  <ActivityIndicator size="small" color={colors.plum} />
                ) : (
                  <>
                    <Ionicons
                      name="scan-outline"
                      size={16}
                      color={colors.plum}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.testBiometricsBtnText}>
                      Test {biometricCap?.displayTitle} Authentication
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={styles.securityDivider} />

        {/* Account 4-digit PIN */}
        <TouchableOpacity
          style={styles.actionRowBtn}
          onPress={() => onSetPinRequested(Boolean(user.pin))}
        >
          <View style={styles.actionRowLeft}>
            <Ionicons name="key-outline" size={18} color={colors.plum} style={{ marginRight: 10 }} />
            <Text style={styles.actionRowText}>
              {user.pin ? 'Change 4-digit Account PIN' : 'Set 4-digit Account PIN'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.rose} />
        </TouchableOpacity>
      </Card>

      {/* Server Connection */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="server-outline" size={16} color={colors.rose} style={styles.cardHeaderIcon} />
          <Text style={styles.cardHeader}>SERVER CONNECTION</Text>
        </View>
        <Text style={styles.settingSub}>
          Switch backend server between Production Live (Render) and Localhost development:
        </Text>

        <View style={styles.serverEnvRow}>
          <TouchableOpacity
            style={[
              styles.serverEnvBtn,
              serverUrl.includes('onrender.com') && styles.serverEnvBtnActive,
            ]}
            onPress={() => {
              setServerUrl(ApiConfig.PRODUCTION_URL);
              ApiConfig.setBaseUrl(ApiConfig.PRODUCTION_URL);
            }}
          >
            <Ionicons
              name="globe-outline"
              size={15}
              color={serverUrl.includes('onrender.com') ? colors.white : colors.plum}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.serverEnvText,
                serverUrl.includes('onrender.com') && styles.serverEnvTextActive,
              ]}
            >
              Production Live
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.serverEnvBtn,
              !serverUrl.includes('onrender.com') && styles.serverEnvBtnActive,
            ]}
            onPress={() => {
              setServerUrl(ApiConfig.LOCAL_URL);
              ApiConfig.setBaseUrl(ApiConfig.LOCAL_URL);
            }}
          >
            <Ionicons
              name="laptop-outline"
              size={15}
              color={!serverUrl.includes('onrender.com') ? colors.white : colors.plum}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.serverEnvText,
                !serverUrl.includes('onrender.com') && styles.serverEnvTextActive,
              ]}
            >
              Local Server
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          value={serverUrl}
          onChangeText={(text) => {
            setServerUrl(text);
            ApiConfig.setBaseUrl(text);
          }}
          style={styles.serverInput}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://..."
        />
      </Card>

      <PrimaryButton
        title="Logout"
        onPress={handleLogout}
        variant="ghost"
        icon={<Ionicons name="log-out-outline" size={18} color={colors.plum} />}
        style={styles.logoutBtn}
      />

      <View style={{ height: 100 }} />

      <SubscriptionModal
        visible={showSubModal}
        onClose={() => setShowSubModal(false)}
        currentPlanId={subscription?.planId}
        onSubscriptionSuccess={(plan) => {
          setSubscription({
            active: true,
            planId: plan.id,
            planName: plan.name,
            amount: plan.price,
          });
        }}
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
  center: {
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
  expenseTiles: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  expenseTile: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  expenseLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.rose,
    marginBottom: 4,
  },
  expenseValue: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.plum,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#f3e5f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  userRole: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.plum,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8d6a84',
    marginBottom: 8,
  },
  settingSub: {
    fontSize: 13,
    color: colors.rose,
    marginTop: 2,
    marginBottom: 10,
    lineHeight: 18,
  },
  sizesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sizeBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  sizeBtnActive: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
  },
  sizeText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
  },
  sizeTextActive: {
    color: colors.white,
  },
  inputsRow: {
    flexDirection: 'row',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  actionRowBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  actionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionRowText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.plum,
  },
  serverInput: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  logoutBtn: {
    marginTop: 10,
    marginBottom: 20,
  },
  activeSubBox: {
    backgroundColor: '#fbf3f8',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.2,
    borderColor: '#f2d3e5',
  },
  activeSubTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  activePlanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e7f6ee',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  activePlanBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2f7a52',
    letterSpacing: 0.5,
  },
  activePlanName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.plum,
  },
  activePlanFee: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.rose,
    marginTop: 2,
  },
  changePlanBtn: {
    backgroundColor: colors.white,
    borderWidth: 1.2,
    borderColor: colors.plum,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  changePlanBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.plum,
  },
  subPerksList: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f2d9e8',
    gap: 4,
  },
  subPerkItem: {
    fontSize: 12,
    color: colors.ink,
    fontWeight: '600',
  },
  inactiveSubBox: {},
  inactiveSubHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  inactiveSubTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.plum,
  },
  inactiveSubSub: {
    fontSize: 12,
    color: colors.rose,
    marginTop: 3,
    lineHeight: 16,
  },
  subPriceTag: {
    alignItems: 'center',
    backgroundColor: '#faedf4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 10,
  },
  subPriceTagSmall: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.rose,
  },
  subPriceTagBig: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.plum,
  },
  planBadgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 12,
  },
  miniPlanChip: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  miniPlanChipPopular: {
    backgroundColor: '#dc97c4',
    borderColor: '#dc97c4',
  },
  miniPlanChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.plum,
  },
  explorePlansBtn: {
    backgroundColor: colors.plum,
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  explorePlansBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.white,
  },
  appLockOptionsBox: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  timeoutOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  timeoutChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  timeoutChipActive: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
  },
  timeoutChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.plum,
  },
  timeoutChipTextActive: {
    color: colors.white,
  },
  testBiometricsBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F7E7F0',
    borderWidth: 1,
    borderColor: '#E6C8DB',
  },
  testBiometricsBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.plum,
  },
  securityDivider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: 16,
  },
  serverEnvRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    marginBottom: 12,
  },
  serverEnvBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  serverEnvBtnActive: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
  },
  serverEnvText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.plum,
  },
  serverEnvTextActive: {
    color: colors.white,
  },
});
