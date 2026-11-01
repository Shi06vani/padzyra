import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
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
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({
  isSettingPin = false,
  onUnlocked,
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
  errorText: {
    color: colors.warn,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 14,
  },
});
