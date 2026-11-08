import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme/colors';
import { BrandHeader } from '../components/BrandHeader';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import { PadzyraApi } from '../api/client';

interface PinLockScreenProps {
  isSettingPin?: boolean;
  hasExistingPin?: boolean;
  userEmail?: string;
  onUnlocked: () => void;
  onForgotPin?: () => void;
  onLogout?: () => void;
  onCancel?: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({
  isSettingPin = false,
  hasExistingPin = false,
  userEmail,
  onUnlocked,
  onForgotPin,
  onLogout,
  onCancel,
}) => {
  // Main PIN form states
  const [pin, setPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Destination info from server
  const [knownDestination, setKnownDestination] = useState(userEmail || '');

  // Forgot / Reset PIN Modal states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'verify'>('request');
  const [resetMethod, setResetMethod] = useState<'email' | 'phone'>('email');
  const [resetIdentifier, setResetIdentifier] = useState(userEmail || '');
  const [resetMaskedTarget, setResetMaskedTarget] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPin, setResetNewPin] = useState('');
  const [resetConfirmPin, setResetConfirmPin] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devTestCode, setDevTestCode] = useState('');

  // Fetch auth destination on mount
  useEffect(() => {
    PadzyraApi.getAuthStatus()
      .then((status) => {
        if (status) {
          if (status.destination) {
            setKnownDestination(status.destination);
            setResetMaskedTarget(status.destination);
          } else if (status.email) {
            setKnownDestination(status.email);
            setResetMaskedTarget(status.email);
            setResetIdentifier(status.email);
          }
        }
      })
      .catch(() => {
        // ignore background status fetch error
      });
  }, []);

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Handle Main PIN Submit (Unlock / Set / Change)
  const handleSubmit = async () => {
    setErrorMessage('');
    const trimmedPin = pin.trim();

    if (isSettingPin) {
      if (hasExistingPin) {
        // Changing existing PIN
        const trimmedCurrent = currentPin.trim();
        if (!trimmedCurrent || trimmedCurrent.length < 4) {
          setErrorMessage('Please enter your current 4-digit PIN');
          return;
        }
        if (!trimmedPin || trimmedPin.length < 4) {
          setErrorMessage('Please enter a new 4-digit PIN');
          return;
        }
        if (trimmedPin !== confirmPin.trim()) {
          setErrorMessage('New PIN and confirmation PIN do not match');
          return;
        }
        if (trimmedPin === trimmedCurrent) {
          setErrorMessage('New PIN must be different from your current PIN');
          return;
        }

        setLoading(true);
        try {
          await PadzyraApi.updateMe({ pin: trimmedPin, current: trimmedCurrent });
          Alert.alert('PIN Updated', 'Your 4-digit security PIN has been changed successfully.');
          onUnlocked();
        } catch (error: any) {
          setErrorMessage(error?.message || 'Failed to update PIN. Please check your current PIN.');
        } finally {
          setLoading(false);
        }
      } else {
        // Setting PIN for the first time
        if (!trimmedPin || trimmedPin.length < 4) {
          setErrorMessage('Please enter a 4-digit PIN');
          return;
        }
        if (trimmedPin !== confirmPin.trim()) {
          setErrorMessage('PINs do not match. Please re-enter.');
          return;
        }

        setLoading(true);
        try {
          await PadzyraApi.updateMe({ pin: trimmedPin });
          onUnlocked();
        } catch (error: any) {
          setErrorMessage(error?.message || 'Failed to set PIN. Please try again.');
        } finally {
          setLoading(false);
        }
      }
    } else {
      // Unlocking app with PIN
      if (!trimmedPin || trimmedPin.length < 4) {
        setErrorMessage('Please enter your 4-digit PIN');
        return;
      }

      setLoading(true);
      try {
        await PadzyraApi.unlockPin(trimmedPin);
        onUnlocked();
      } catch (error: any) {
        setErrorMessage(error?.message || 'Incorrect PIN. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  // Open Forgot PIN flow
  const handleOpenForgotPin = () => {
    setResetError('');
    setResetSuccess('');
    setResetCode('');
    setResetNewPin('');
    setResetConfirmPin('');
    setResetStep('request');
    setShowForgotModal(true);
  };

  // Request OTP for PIN Reset
  const handleRequestOtp = async () => {
    setResetLoading(true);
    setResetError('');
    setResetSuccess('');

    try {
      const trimmedId = resetIdentifier.trim();
      const res = await PadzyraApi.requestPinResetOtp(
        trimmedId ? { identifier: trimmedId, method: resetMethod } : undefined
      );

      const target = res.destination || knownDestination || trimmedId || 'your registered account';
      setResetMaskedTarget(target);
      setDevTestCode(res.testCode || '');
      setResendCooldown(res.retryAfter || 45);
      setResetStep('verify');
      setResetSuccess(`Verification code sent to ${target}`);
      setTimeout(() => setResetSuccess(''), 5000);
    } catch (error: any) {
      setResetError(error?.message || 'Failed to send verification code. Please check your details.');
    } finally {
      setResetLoading(false);
    }
  };

  // Confirm OTP & Set New PIN
  const handlePerformResetPin = async () => {
    const trimmedCode = resetCode.trim();
    const trimmedNewPin = resetNewPin.trim();
    const trimmedConfirm = resetConfirmPin.trim();

    if (!trimmedCode || trimmedCode.length < 6) {
      setResetError('Please enter the 6-digit verification code');
      return;
    }
    if (!trimmedNewPin || trimmedNewPin.length < 4) {
      setResetError('Please enter a new 4-digit PIN');
      return;
    }
    if (trimmedNewPin !== trimmedConfirm) {
      setResetError('PINs do not match. Please re-enter.');
      return;
    }

    setResetLoading(true);
    setResetError('');
    setResetSuccess('');

    try {
      const trimmedId = resetIdentifier.trim();
      await PadzyraApi.resetPin({
        code: trimmedCode,
        newPin: trimmedNewPin,
        identifier: trimmedId || undefined,
        method: resetMethod,
      });

      setShowForgotModal(false);
      Alert.alert(
        'PIN Reset Successful',
        'Your security PIN has been reset successfully. Your app is now unlocked.',
        [{ text: 'Continue', onPress: onUnlocked }]
      );
    } catch (error: any) {
      setResetError(error?.message || 'Invalid verification code or failed to reset PIN.');
    } finally {
      setResetLoading(false);
    }
  };

  const getTitle = () => {
    if (isSettingPin) {
      return hasExistingPin ? 'Change Security PIN' : 'Create Security PIN';
    }
    return 'Enter Security PIN';
  };

  const getSubtitle = () => {
    if (isSettingPin) {
      return hasExistingPin
        ? 'Enter your current PIN and choose a new 4-digit PIN'
        : 'Set a 4-digit PIN to protect your personal calendar and health entries';
    }
    return 'Enter your PIN to view private period records';
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.centerWrapper}>
          <BrandHeader subtitle={getSubtitle()} />

          <Card style={styles.cardContainer}>
            <View style={styles.lockBadge}>
              <View style={styles.iconCircle}>
                <Ionicons
                  name={isSettingPin ? 'shield-checkmark' : 'lock-closed'}
                  size={32}
                  color={colors.plum}
                />
              </View>
              <Text style={styles.cardHeading}>{getTitle()}</Text>
            </View>

            {/* Current PIN field when changing PIN */}
            {isSettingPin && hasExistingPin ? (
              <View style={styles.fieldWrapper}>
                <InputField
                  label="Current PIN"
                  placeholder="••••"
                  value={currentPin}
                  onChangeText={(text) => {
                    setCurrentPin(text.replace(/[^0-9]/g, ''));
                    if (errorMessage) setErrorMessage('');
                  }}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry={!showPin}
                  autoFocus
                />
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleOpenForgotPin}
                  style={styles.forgotCurrentPinRow}
                >
                  <Text style={styles.forgotCurrentPinText}>Forgot Current PIN?</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Main PIN / New PIN input */}
            <InputField
              label={isSettingPin ? 'New 4-Digit PIN' : '4-Digit PIN'}
              placeholder="••••"
              value={pin}
              onChangeText={(text) => {
                setPin(text.replace(/[^0-9]/g, ''));
                if (errorMessage) setErrorMessage('');
              }}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry={!showPin}
              autoFocus={!isSettingPin || !hasExistingPin}
              returnKeyType={isSettingPin ? 'next' : 'done'}
              onSubmitEditing={isSettingPin ? undefined : handleSubmit}
            />

            {/* Confirm PIN field when setting or changing PIN */}
            {isSettingPin ? (
              <InputField
                label="Confirm 4-Digit PIN"
                placeholder="••••"
                value={confirmPin}
                onChangeText={(text) => {
                  setConfirmPin(text.replace(/[^0-9]/g, ''));
                  if (errorMessage) setErrorMessage('');
                }}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry={!showPin}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            ) : null}

            {/* Visibility Toggle */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShowPin(!showPin)}
              style={styles.toggleRow}
            >
              <Ionicons
                name={showPin ? 'eye-off-outline' : 'eye-outline'}
                size={16}
                color={colors.plum}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.toggleText}>{showPin ? 'Hide PIN' : 'Show PIN'}</Text>
            </TouchableOpacity>

            {/* Primary Action Button */}
            <PrimaryButton
              title={
                isSettingPin
                  ? hasExistingPin
                    ? 'Update PIN'
                    : 'Save & Continue'
                  : 'Unlock & Open'
              }
              icon={
                <Ionicons
                  name={isSettingPin ? 'checkmark-circle-outline' : 'lock-open-outline'}
                  size={18}
                  color={colors.white}
                />
              }
              onPress={handleSubmit}
              loading={loading}
              style={styles.openButton}
            />

            {/* Cancel Button if invoked from Settings */}
            {onCancel ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onCancel}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            ) : null}

            {/* Forgot PIN Button for Unlock Mode */}
            {!isSettingPin ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleOpenForgotPin}
                style={styles.forgotPinButton}
              >
                <Ionicons name="help-circle-outline" size={16} color={colors.rose} style={{ marginRight: 6 }} />
                <Text style={styles.forgotPinText}>Forgot PIN?</Text>
              </TouchableOpacity>
            ) : null}

            {/* Clean Error Display */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={18} color="#9E2A2B" style={styles.errorIcon} />
                <View style={styles.errorTextContainer}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                  {errorMessage.includes('Forgot PIN') || errorMessage.includes('locked') ? (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={handleOpenForgotPin}
                      style={styles.inlineResetBtn}
                    >
                      <Text style={styles.inlineResetText}>Reset PIN with OTP now →</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Switch Account / Logout fallback */}
            {onLogout && !isSettingPin ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  Alert.alert(
                    'Sign Out',
                    'Would you like to log out of this account and sign in with a different one?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Sign Out', style: 'destructive', onPress: onLogout },
                    ]
                  );
                }}
                style={styles.switchAccountBtn}
              >
                <Ionicons name="log-out-outline" size={14} color={colors.plum} style={{ marginRight: 6 }} />
                <Text style={styles.switchAccountText}>Sign in with another account</Text>
              </TouchableOpacity>
            ) : null}
          </Card>
        </View>
      </ScrollView>

      {/* ======================================================== */}
      {/* PROFESSIONAL FORGOT / RESET PIN MODAL                   */}
      {/* ======================================================== */}
      <Modal
        visible={showForgotModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForgotModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleBadge}>
                <Ionicons name="key" size={20} color={colors.plum} />
                <Text style={styles.modalTitle}>
                  {resetStep === 'request' ? 'Reset Security PIN' : 'Verify & Set New PIN'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowForgotModal(false)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={colors.plum} />
              </TouchableOpacity>
            </View>

            {/* STEP 1: Request OTP */}
            {resetStep === 'request' && (
              <View style={styles.modalBody}>
                <Text style={styles.modalSubtitle}>
                  We will send a 6-digit verification code to your registered account to securely reset your PIN.
                </Text>

                {resetMaskedTarget || knownDestination ? (
                  <View style={styles.targetPill}>
                    <Ionicons name="mail-outline" size={16} color={colors.plum} style={{ marginRight: 8 }} />
                    <Text style={styles.targetPillText}>
                      Sending code to: <Text style={styles.boldText}>{resetMaskedTarget || knownDestination}</Text>
                    </Text>
                  </View>
                ) : (
                  <View style={styles.unauthenticatedInputWrapper}>
                    <View style={styles.methodToggleRow}>
                      <TouchableOpacity
                        style={[
                          styles.methodTab,
                          resetMethod === 'email' && styles.methodTabActive,
                        ]}
                        onPress={() => setResetMethod('email')}
                      >
                        <Text
                          style={[
                            styles.methodTabText,
                            resetMethod === 'email' && styles.methodTabTextActive,
                          ]}
                        >
                          Email
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.methodTab,
                          resetMethod === 'phone' && styles.methodTabActive,
                        ]}
                        onPress={() => setResetMethod('phone')}
                      >
                        <Text
                          style={[
                            styles.methodTabText,
                            resetMethod === 'phone' && styles.methodTabTextActive,
                          ]}
                        >
                          Mobile
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <InputField
                      label={resetMethod === 'email' ? 'Registered Email' : 'Registered Mobile Number'}
                      placeholder={resetMethod === 'email' ? 'you@example.com' : '10-digit mobile number'}
                      value={resetIdentifier}
                      onChangeText={(t) => {
                        setResetIdentifier(t);
                        if (resetError) setResetError('');
                      }}
                      keyboardType={resetMethod === 'email' ? 'email-address' : 'phone-pad'}
                      autoCapitalize="none"
                    />
                  </View>
                )}

                {resetError ? (
                  <View style={styles.modalErrorBox}>
                    <Ionicons name="alert-circle-outline" size={16} color="#9E2A2B" style={{ marginRight: 6 }} />
                    <Text style={styles.modalErrorText}>{resetError}</Text>
                  </View>
                ) : null}

                <PrimaryButton
                  title="Send Verification Code"
                  icon={<Ionicons name="paper-plane-outline" size={18} color={colors.white} />}
                  onPress={handleRequestOtp}
                  loading={resetLoading}
                  style={styles.modalActionBtn}
                />

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setShowForgotModal(false)}
                  style={styles.modalDismissBtn}
                >
                  <Text style={styles.modalDismissText}>Back to PIN Entry</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 2: Verify Code & Set New PIN */}
            {resetStep === 'verify' && (
              <View style={styles.modalBody}>
                <Text style={styles.modalSubtitle}>
                  Enter the 6-digit code sent to <Text style={styles.boldText}>{resetMaskedTarget || knownDestination}</Text> and choose your new 4-digit PIN:
                </Text>

                {devTestCode ? (
                  <View style={styles.devHintBox}>
                    <Ionicons name="information-circle-outline" size={14} color={colors.plum} style={{ marginRight: 4 }} />
                    <Text style={styles.devHintText}>Dev Test Code: {devTestCode}</Text>
                  </View>
                ) : null}

                <InputField
                  label="6-Digit Verification Code"
                  placeholder="123456"
                  value={resetCode}
                  onChangeText={(t) => {
                    setResetCode(t.replace(/[^0-9]/g, ''));
                    if (resetError) setResetError('');
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />

                {/* Resend OTP Row */}
                <View style={styles.resendRow}>
                  {resendCooldown > 0 ? (
                    <Text style={styles.resendCooldownText}>
                      Resend code in <Text style={styles.boldText}>{resendCooldown}s</Text>
                    </Text>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={handleRequestOtp}
                      disabled={resetLoading}
                    >
                      <Text style={styles.resendActiveText}>Resend verification code</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <InputField
                  label="New 4-Digit Security PIN"
                  placeholder="••••"
                  value={resetNewPin}
                  onChangeText={(t) => {
                    setResetNewPin(t.replace(/[^0-9]/g, ''));
                    if (resetError) setResetError('');
                  }}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                />

                <InputField
                  label="Confirm New 4-Digit PIN"
                  placeholder="••••"
                  value={resetConfirmPin}
                  onChangeText={(t) => {
                    setResetConfirmPin(t.replace(/[^0-9]/g, ''));
                    if (resetError) setResetError('');
                  }}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                />

                {resetSuccess ? (
                  <View style={styles.modalSuccessBox}>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#2A6F45" style={{ marginRight: 6 }} />
                    <Text style={styles.modalSuccessText}>{resetSuccess}</Text>
                  </View>
                ) : null}

                {resetError ? (
                  <View style={styles.modalErrorBox}>
                    <Ionicons name="alert-circle-outline" size={16} color="#9E2A2B" style={{ marginRight: 6 }} />
                    <Text style={styles.modalErrorText}>{resetError}</Text>
                  </View>
                ) : null}

                <PrimaryButton
                  title="Reset PIN & Unlock"
                  icon={<Ionicons name="lock-open-outline" size={18} color={colors.white} />}
                  onPress={handlePerformResetPin}
                  loading={resetLoading}
                  style={styles.modalActionBtn}
                />

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setResetStep('request')}
                  style={styles.modalDismissBtn}
                >
                  <Text style={styles.modalDismissText}>← Back to Send Code</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: colors.blush,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  centerWrapper: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  cardContainer: {
    width: '100%',
    padding: 24,
    borderRadius: 20,
    shadowColor: colors.pink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  lockBadge: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fcebf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.plum,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  fieldWrapper: {
    width: '100%',
  },
  forgotCurrentPinRow: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 14,
    paddingVertical: 4,
  },
  forgotCurrentPinText: {
    color: colors.rose,
    fontSize: 13,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: -6,
    marginBottom: 18,
    paddingVertical: 4,
  },
  toggleText: {
    fontSize: 13,
    color: colors.plum,
    fontWeight: '600',
  },
  openButton: {
    marginTop: 4,
  },
  cancelButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: colors.plum,
    fontSize: 15,
    fontWeight: '600',
  },
  forgotPinButton: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  forgotPinText: {
    color: colors.rose,
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  switchAccountBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f7e3ef',
  },
  switchAccountText: {
    color: colors.plum,
    fontSize: 13,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff0f0',
    borderWidth: 1,
    borderColor: '#fcdcdc',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  errorIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  errorTextContainer: {
    flex: 1,
  },
  errorText: {
    color: '#9E2A2B',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  inlineResetBtn: {
    marginTop: 6,
  },
  inlineResetText: {
    color: colors.rose,
    fontSize: 13,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f7e3ef',
  },
  modalTitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.plum,
    marginLeft: 8,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    width: '100%',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6e5464',
    lineHeight: 20,
    marginBottom: 16,
  },
  boldText: {
    fontWeight: '700',
    color: colors.plum,
  },
  targetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fcebf4',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  targetPillText: {
    fontSize: 13,
    color: colors.plum,
    flexShrink: 1,
  },
  unauthenticatedInputWrapper: {
    width: '100%',
  },
  methodToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#f8e8f2',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  methodTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  methodTabActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  methodTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.plum,
  },
  methodTabTextActive: {
    fontWeight: '800',
    color: colors.rose,
  },
  devHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdf6ea',
    borderWidth: 1,
    borderColor: '#fae3c3',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  devHintText: {
    fontSize: 12,
    color: '#946200',
    fontWeight: '600',
  },
  resendRow: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 14,
  },
  resendCooldownText: {
    fontSize: 12,
    color: '#8b7280',
  },
  resendActiveText: {
    fontSize: 13,
    color: colors.rose,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  modalActionBtn: {
    marginTop: 12,
  },
  modalDismissBtn: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 6,
  },
  modalDismissText: {
    fontSize: 13,
    color: colors.plum,
    fontWeight: '600',
  },
  modalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff0f0',
    borderWidth: 1,
    borderColor: '#fcdcdc',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  modalErrorText: {
    color: '#9E2A2B',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  modalSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fff4',
    borderWidth: 1,
    borderColor: '#c6f6d5',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  modalSuccessText: {
    color: '#2A6F45',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
});
