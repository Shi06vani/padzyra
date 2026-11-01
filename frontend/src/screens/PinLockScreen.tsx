import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
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
  onUnlocked: () => void;
  onForgotPin?: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({
  isSettingPin = false,
  onUnlocked,
  onForgotPin,
}) => {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async () => {
    const trimmedPin = pin.trim();
    if (!trimmedPin || trimmedPin.length < 4) {
      setErrorMessage('Please enter a 4-digit PIN');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      if (isSettingPin) {
        await PadzyraApi.updateMe({ pin: trimmedPin });
        onUnlocked();
      } else {
        await PadzyraApi.unlockPin(trimmedPin);
        onUnlocked();
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Incorrect PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPinPress = () => {
    Alert.alert(
      'Forgot PIN?',
      'You can reset your security PIN by verifying your identity with an OTP code.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset PIN',
          style: 'destructive',
          onPress: () => {
            if (onForgotPin) onForgotPin();
          },
        },
      ]
    );
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
            subtitle={isSettingPin ? 'Set your 4-digit security PIN' : 'Enter your PIN'}
          />

          <Card style={styles.cardContainer}>
            <View style={styles.lockBadge}>
              <Ionicons
                name={isSettingPin ? 'shield-outline' : 'lock-closed-outline'}
                size={36}
                color={colors.plum}
              />
            </View>

            <InputField
              label="PIN"
              placeholder="••••"
              value={pin}
              onChangeText={(text) => {
                setPin(text.replace(/[^0-9]/g, ''));
                if (errorMessage) setErrorMessage('');
              }}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            <PrimaryButton
              title={isSettingPin ? 'Save & Open' : 'Open'}
              icon={<Ionicons name="lock-open-outline" size={18} color={colors.white} />}
              onPress={handleSubmit}
              loading={loading}
              style={styles.openButton}
            />

            {!isSettingPin && onForgotPin ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleForgotPinPress}
                style={styles.forgotPinButton}
              >
                <Text style={styles.forgotPinText}>Forgot PIN?</Text>
              </TouchableOpacity>
            ) : null}

            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}
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
  lockBadge: {
    alignItems: 'center',
    marginBottom: 12,
  },
  openButton: {
    marginTop: 8,
  },
  forgotPinButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  forgotPinText: {
    color: colors.rose,
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  errorText: {
    color: colors.warn,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 14,
  },
});
