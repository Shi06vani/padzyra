import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme/colors';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAppLock } from '../context/AppLockContext';

interface AppLockScreenProps {
  onEmergencyLogout?: () => void;
}

export const AppLockScreen: React.FC<AppLockScreenProps> = ({ onEmergencyLogout }) => {
  const {
    isAuthenticating,
    capability,
    errorMessage,
    retryUnlock,
  } = useAppLock();

  // Prevent Android hardware back button from dismissing the lock screen
  useEffect(() => {
    const backAction = () => {
      return true; // Consume event, do not exit or navigate back
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, []);

  const biometryType = capability?.capability.biometryType || 'Biometrics';
  const displayTitle = capability?.displayTitle || 'Biometrics';

  let unlockIcon = 'finger-print-outline';
  if (biometryType === 'FaceID') {
    unlockIcon = 'scan-outline';
  } else if (biometryType === 'None') {
    unlockIcon = 'keypad-outline';
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View style={styles.brandContainer}>
          <Text style={styles.brandSubtitle}>PADZYRA</Text>
          <Text style={styles.brandTitle}>Private & Protected</Text>
        </View>

        <Card style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={48} color={colors.plum} />
          </View>

          <Text style={styles.lockTitle}>Padzyra is Locked</Text>
          <Text style={styles.lockSubtitle}>
            Your menstrual calendar, symptoms, and private health entries are protected on this device.
          </Text>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color="#9E2A2B" style={styles.errorIcon} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <PrimaryButton
            title={isAuthenticating ? 'Verifying...' : `Unlock with ${displayTitle}`}
            icon={
              isAuthenticating ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name={unlockIcon} size={20} color={colors.white} />
              )
            }
            onPress={retryUnlock}
            disabled={isAuthenticating}
            style={styles.unlockButton}
          />

          <TouchableOpacity
            style={styles.deviceFallbackBtn}
            onPress={retryUnlock}
            disabled={isAuthenticating}
            activeOpacity={0.7}
          >
            <Ionicons name="keypad-outline" size={16} color={colors.rose} style={{ marginRight: 6 }} />
            <Text style={styles.deviceFallbackText}>Use Device Passcode or Pattern</Text>
          </TouchableOpacity>
        </Card>

        {onEmergencyLogout ? (
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={onEmergencyLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={16} color={colors.plum} style={{ marginRight: 6 }} />
            <Text style={styles.logoutBtnText}>Sign out of account</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.securityNoteRow}>
          <Ionicons name="lock-closed-outline" size={13} color={colors.rose} style={{ marginRight: 4 }} />
          <Text style={styles.securityNoteText}>
            Local device security powered by {displayTitle}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.blush,
    zIndex: 9999,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.rose,
    letterSpacing: 2,
    marginBottom: 4,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.plum,
    letterSpacing: -0.5,
  },
  card: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
    borderRadius: 24,
    shadowColor: colors.plum,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FDECEF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#F7D4DD',
  },
  lockTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.plum,
    marginBottom: 8,
    textAlign: 'center',
  },
  lockSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
    marginBottom: 24,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F0',
    borderWidth: 1,
    borderColor: '#FFD6D6',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    width: '100%',
  },
  errorIcon: {
    marginRight: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#9E2A2B',
    lineHeight: 18,
  },
  unlockButton: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.pink,
  },
  deviceFallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  deviceFallbackText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.plum,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.plum,
    textDecorationLine: 'underline',
  },
  securityNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  securityNoteText: {
    fontSize: 12,
    color: colors.rose,
    fontWeight: '500',
  },
});
