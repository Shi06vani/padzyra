import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { colors } from '../theme/colors';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { BrandHeader } from '../components/BrandHeader';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { Checkbox } from '../components/Checkbox';
import { PrimaryButton } from '../components/PrimaryButton';
import { PadzyraApi, ApiConfig } from '../api/client';

interface LoginScreenProps {
  onOtpRequested: (identifier: string, role: 'girl' | 'shop', method: 'email' | 'phone') => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onOtpRequested }) => {
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isMedicalShop, setIsMedicalShop] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Host config modal for easy emulator / LAN testing
  const [showConfig, setShowConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState(ApiConfig.getBaseUrl());

  const handleContinue = async () => {
    const role = isMedicalShop ? 'shop' : 'girl';

    if (authMethod === 'phone') {
      const trimmedPhone = phone.trim();
      const digitsOnly = trimmedPhone.replace(/\D/g, '');
      if (!trimmedPhone || digitsOnly.length < 10) {
        setErrorMessage('Please enter a valid 10-digit mobile number');
        return;
      }

      setLoading(true);
      setErrorMessage('');

      try {
        await PadzyraApi.requestPhoneOtp(trimmedPhone, 'login');
        onOtpRequested(trimmedPhone, role, 'phone');
      } catch (error: any) {
        const msg = error?.message;
        if (msg === 'Aborted' || msg?.includes('Network request failed') || msg?.includes('connect')) {
          setErrorMessage('Unable to connect. Please make sure the server is running.');
        } else {
          setErrorMessage(msg || 'Unable to send SMS code. Please try again.');
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address');
      return;
    }
    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      await PadzyraApi.requestOtp(trimmedEmail, 'login');
      onOtpRequested(trimmedEmail, role, 'email');
    } catch (error: any) {
      const msg = error?.message;
      if (msg === 'Aborted' || msg?.includes('Network request failed') || msg?.includes('connect')) {
        setErrorMessage('Unable to connect. Please make sure the server is running.');
      } else {
        setErrorMessage(msg || 'Unable to send OTP. Please try again.');
      }
    } finally {
      setLoading(false);
    }
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
          <BrandHeader />

          <Card style={styles.cardContainer}>
            {/* Auth Method Selector */}
            <View style={styles.authMethodToggle}>
              <TouchableOpacity
                style={[styles.authMethodTab, authMethod === 'email' && styles.authMethodTabActive]}
                onPress={() => {
                  setAuthMethod('email');
                  setErrorMessage('');
                }}
              >
                <Ionicons
                  name="mail-outline"
                  size={15}
                  color={authMethod === 'email' ? colors.white : colors.rose}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.authMethodText, authMethod === 'email' && styles.authMethodTextActive]}>
                  Email
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.authMethodTab, authMethod === 'phone' && styles.authMethodTabActive]}
                onPress={() => {
                  setAuthMethod('phone');
                  setErrorMessage('');
                }}
              >
                <Ionicons
                  name="call-outline"
                  size={15}
                  color={authMethod === 'phone' ? colors.white : colors.rose}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.authMethodText, authMethod === 'phone' && styles.authMethodTextActive]}>
                  Phone OTP
                </Text>
              </TouchableOpacity>
            </View>

            {authMethod === 'email' ? (
              <InputField
                label="Email"
                placeholder="name@example.com"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errorMessage) setErrorMessage('');
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="done"
                onSubmitEditing={handleContinue}
              />
            ) : (
              <InputField
                label="Mobile Phone"
                placeholder="+91 98765 43210"
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  if (errorMessage) setErrorMessage('');
                }}
                keyboardType="phone-pad"
                returnKeyType="done"
                onSubmitEditing={handleContinue}
              />
            )}

            <Checkbox
              label="I have a medical shop"
              checked={isMedicalShop}
              onChange={setIsMedicalShop}
            />

            <PrimaryButton
              title="Continue"
              icon={<Ionicons name="arrow-forward-outline" size={18} color={colors.white} />}
              onPress={handleContinue}
              loading={loading}
              style={styles.continueButton}
            />

            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}
          </Card>

          {/* Environment Switcher Trigger */}
          <TouchableOpacity
            style={styles.serverConfigTrigger}
            onPress={() => {
              setServerUrl(ApiConfig.getBaseUrl());
              setShowConfig(true);
            }}
          >
            <View style={styles.serverBadge}>
              <View
                style={[
                  styles.statusDot,
                  ApiConfig.isProduction() ? styles.statusDotLive : styles.statusDotLocal,
                ]}
              />
              <Text style={styles.serverConfigText}>
                Server: {ApiConfig.isProduction() ? 'Production (Live)' : 'Local Host'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Server Environment Modal */}
      <Modal
        visible={showConfig}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfig(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Backend Server</Text>
            <Text style={styles.modalSubtitle}>
              Select the backend environment or customize the URL:
            </Text>

            <View style={styles.envPresetRow}>
              <TouchableOpacity
                style={[
                  styles.envPresetBtn,
                  serverUrl.includes('onrender.com') && styles.envPresetBtnActive,
                ]}
                onPress={() => setServerUrl(ApiConfig.PRODUCTION_URL)}
              >
                <Text
                  style={[
                    styles.envPresetText,
                    serverUrl.includes('onrender.com') && styles.envPresetTextActive,
                  ]}
                >
                  🌐 Production Live
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.envPresetBtn,
                  !serverUrl.includes('onrender.com') && styles.envPresetBtnActive,
                ]}
                onPress={() => setServerUrl(ApiConfig.LOCAL_URL)}
              >
                <Text
                  style={[
                    styles.envPresetText,
                    !serverUrl.includes('onrender.com') && styles.envPresetTextActive,
                  ]}
                >
                  💻 Local Host
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              value={serverUrl}
              onChangeText={setServerUrl}
              style={styles.modalInput}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="https://..."
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowConfig(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSave}
                onPress={() => {
                  ApiConfig.setBaseUrl(serverUrl);
                  setServerUrl(ApiConfig.getBaseUrl());
                  setShowConfig(false);
                }}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    maxWidth: 400,
    alignItems: 'center',
  },
  cardContainer: {
    width: '100%',
    padding: 22,
  },
  authMethodToggle: {
    flexDirection: 'row',
    backgroundColor: '#eedde7',
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
  },
  authMethodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  authMethodTabActive: {
    backgroundColor: colors.plum,
    shadowColor: colors.plum,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  authMethodText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.rose,
  },
  authMethodTextActive: {
    color: colors.white,
  },
  continueButton: {
    marginTop: 8,
  },
  errorText: {
    color: colors.warn,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 14,
  },
  serverConfigTrigger: {
    marginTop: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  serverBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eedde7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusDotLive: {
    backgroundColor: '#10b981',
  },
  statusDotLocal: {
    backgroundColor: '#f59e0b',
  },
  serverConfigText: {
    color: colors.plum,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  envPresetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  envPresetBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    backgroundColor: colors.blush,
  },
  envPresetBtnActive: {
    borderColor: colors.plum,
    backgroundColor: '#eedde7',
  },
  envPresetText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.rose,
  },
  envPresetTextActive: {
    color: colors.plum,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(74, 48, 72, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.plum,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.rose,
    marginBottom: 16,
    lineHeight: 18,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancel: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  modalCancelText: {
    color: colors.rose,
    fontWeight: '700',
  },
  modalSave: {
    backgroundColor: colors.plum,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  modalSaveText: {
    color: colors.white,
    fontWeight: '800',
  },
});
