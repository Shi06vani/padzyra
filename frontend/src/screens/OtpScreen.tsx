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
  const [resendCooldown, setResendCooldown] = useState(30);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');

  // Countdown timer for resend
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setErrorMessage('');
    setResendSuccess('');

    try {
      if (method === 'phone') {
        await PadzyraApi.requestPhoneOtp(identifier, 'login');
      } else {
        await PadzyraApi.requestOtp(identifier, 'login');
      }
      setResendCooldown(45);
      setResendSuccess('New verification code sent!');
      setTimeout(() => setResendSuccess(''), 4000);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to resend code. Please wait and try again.');
    } finally {
      setResending(false);
    }
  };

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
            subtitle={`Verification code sent to\n${identifier}`}
          />

          <Card style={styles.cardContainer}>
            <InputField
              label="Verification Code"
              placeholder="Enter 6-digit code"
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
              title="Verify & Continue"
              icon={<Ionicons name="checkmark-outline" size={18} color={colors.white} />}
              onPress={handleVerify}
              loading={loading}
              style={styles.continueButton}
            />

            {resendSuccess ? (
              <Text style={styles.resendSuccessText}>{resendSuccess}</Text>
            ) : null}

            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}

            {/* Resend OTP Section */}
            <View style={styles.resendRow}>
              <Text style={styles.resendPromptText}>Didn't receive code? </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={resendCooldown > 0 || resending}
                onPress={handleResend}
              >
                <Text
                  style={[
                    styles.resendActionText,
                    resendCooldown > 0 && styles.resendActionDisabled,
                  ]}
                >
                  {resending
                    ? 'Sending...'
                    : resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : 'Resend Code'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onBackToLogin}
              style={styles.backButton}
            >
              <View style={styles.backButtonContent}>
                <Ionicons name="arrow-back-outline" size={16} color="#b06f98" style={{ marginRight: 6 }} />
                <Text style={styles.backText}>Back to Login</Text>
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
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  resendPromptText: {
    color: colors.rose,
    fontSize: 14,
    fontWeight: '500',
  },
  resendActionText: {
    color: colors.plum,
    fontSize: 14,
    fontWeight: '800',
  },
  resendActionDisabled: {
    color: colors.rose,
    fontWeight: '500',
    opacity: 0.7,
  },
  resendSuccessText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
  },
});
