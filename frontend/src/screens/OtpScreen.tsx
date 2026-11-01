import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme/colors';
import { BrandHeader } from '../components/BrandHeader';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import { PadzyraApi } from '../api/client';

interface OtpScreenProps {
  identifier: string;
  method?: 'email' | 'phone';
  role: 'girl' | 'shop';
  onVerified: (user: { id: string; role: 'girl' | 'shop' }) => void;
  onBackToLogin: () => void;
}

export const OtpScreen: React.FC<OtpScreenProps> = ({
  identifier,
  method = 'email',
  role,
  onVerified,
  onBackToLogin,
}) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleVerify = async () => {
    const trimmedCode = code.trim();
    if (!trimmedCode || trimmedCode.length < 6) {
      setErrorMessage('Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const result =
        method === 'phone'
          ? await PadzyraApi.verifyPhoneOtp(identifier, trimmedCode, role)
          : await PadzyraApi.verifyOtp(identifier, trimmedCode, role);
      onVerified({ id: result.id, role: result.role });
    } catch (error: any) {
      setErrorMessage(error?.message || 'Invalid or expired code. Please try again.');
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
          <BrandHeader
            subtitle={
              method === 'phone'
                ? `Enter 6-digit code sent via SMS to ${identifier}`
                : `Enter 6-digit code sent to ${identifier}`
            }
          />

          <Card style={styles.cardContainer}>
            <InputField
              label="Code"
              placeholder="123456"
              value={code}
              onChangeText={(text) => {
                setCode(text.replace(/[^0-9]/g, ''));
                if (errorMessage) setErrorMessage('');
              }}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleVerify}
            />

            <PrimaryButton
              title="Continue"
              icon={<Ionicons name="checkmark-outline" size={18} color={colors.white} />}
              onPress={handleVerify}
              loading={loading}
              style={styles.continueButton}
            />

            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onBackToLogin}
              style={styles.backButton}
            >
              <View style={styles.backButtonContent}>
                <Ionicons name="arrow-back-outline" size={16} color="#b06f98" style={{ marginRight: 6 }} />
                <Text style={styles.backText}>Use another email</Text>
              </View>
            </TouchableOpacity>
          </Card>
        </View>
      </ScrollView>
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
  backButton: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 8,
  },
  backButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    color: '#b06f98',
    fontSize: 15,
    fontWeight: '800',
  },
});
