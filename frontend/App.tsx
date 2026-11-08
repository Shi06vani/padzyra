import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  ActivityIndicator,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { colors } from './src/theme/colors';
import { LoginScreen } from './src/screens/LoginScreen';
import { OtpScreen } from './src/screens/OtpScreen';
import { PinLockScreen } from './src/screens/PinLockScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { DatesScreen } from './src/screens/DatesScreen';
import { NowScreen } from './src/screens/NowScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ActivityScreen } from './src/screens/ActivityScreen';
import { ThreadsScreen } from './src/screens/ThreadsScreen';
import { ShopScreen } from './src/screens/ShopScreen';
import { ShopOrdersScreen } from './src/screens/ShopOrdersScreen';
import { BottomTabBar, TabKey } from './src/components/BottomTabBar';
import { PadzyraApi } from './src/api/client';
import { AppLockProvider, useAppLock } from './src/context/AppLockContext';
import { AppLockScreen } from './src/screens/AppLockScreen';
import { EmergencyScreen } from './src/screens/EmergencyScreen';
import { PushNotificationService } from './src/services/pushNotificationService';

type AppFlowState = 'loading' | 'login' | 'otp' | 'pinLock' | 'main';

function AppContent() {
  const insets = useSafeAreaInsets();
  const [flowState, setFlowState] = useState<AppFlowState>('loading');
  const [authIdentifier, setAuthIdentifier] = useState('');
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [userRole, setUserRole] = useState<'girl' | 'shop'>('girl');
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [hasExistingPin, setHasExistingPin] = useState(false);
  const [currentTab, setCurrentTab] = useState<TabKey>('home');
  const [showEmergency, setShowEmergency] = useState(false);
  const { isLocked } = useAppLock();

  const checkInitialAuth = useCallback(async () => {
    try {
      // Fast check (1.2s timeout) so app doesn't hang on loading spinner
      const statusPromise = PadzyraApi.getAuthStatus();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Auth check timeout')), 1200)
      );
      const status: any = await Promise.race([statusPromise, timeoutPromise]);
      if (status && status.authenticated) {
        setUserRole(status.role || 'girl');
        setCurrentTab(status.role === 'shop' ? 'shop' : 'home');
        if (status.email) setAuthIdentifier(status.email);

        if (status.role === 'girl' && status.pinSet && !status.pinUnlocked) {
          setIsSettingPin(false);
          setHasExistingPin(true);
          setFlowState('pinLock');
        } else {
          setFlowState('main');
        }
      } else {
        setFlowState('login');
      }
    } catch {
      setFlowState('login');
    }
  }, []);

  useEffect(() => {
    checkInitialAuth();
  }, [checkInitialAuth]);

  // Login -> OTP flow
  const handleOtpRequested = (
    identifier: string,
    role: 'girl' | 'shop',
    method: 'email' | 'phone' = 'email'
  ) => {
    setAuthIdentifier(identifier);
    setAuthMethod(method);
    setUserRole(role);
    setFlowState('otp');
  };

  // OTP verified
  const handleOtpVerified = async (user: { id: string; role: 'girl' | 'shop' }) => {
    setUserRole(user.role);
    setCurrentTab(user.role === 'shop' ? 'shop' : 'home');

    if (user.role === 'girl') {
      try {
        const me = await PadzyraApi.getMe();
        if (!me.pin) {
          setIsSettingPin(true);
          setHasExistingPin(false);
          setFlowState('pinLock');
          return;
        }

        const status = await PadzyraApi.getAuthStatus();
        if (status.pinSet && !status.pinUnlocked) {
          setIsSettingPin(false);
          setHasExistingPin(true);
          setFlowState('pinLock');
          return;
        }
      } catch {
        // continue
      }
    }
    setFlowState('main');
  };

  // PIN unlocked / set
  const handlePinUnlocked = () => {
    setIsSettingPin(false);
    setHasExistingPin(true);
    setFlowState('main');
  };

  // Set / Change PIN requested from Settings or flow
  const handleSetPinRequested = (existing = false) => {
    setIsSettingPin(true);
    setHasExistingPin(existing);
    setFlowState('pinLock');
  };

  // Logout
  const handleLogout = () => {
    setFlowState('login');
    setCurrentTab('home');
  };

  // Forgot PIN fallback
  const handleForgotPin = async () => {
    try {
      await PadzyraApi.logout();
    } catch {
      // ignore
    }
    setFlowState('login');
    setCurrentTab('home');
  };

  if (flowState === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: colors.blush }]}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {flowState === 'login' && (
        <LoginScreen onOtpRequested={handleOtpRequested} />
      )}

      {flowState === 'otp' && (
        <OtpScreen
          identifier={authIdentifier}
          method={authMethod}
          role={userRole}
          onVerified={handleOtpVerified}
          onBackToLogin={() => setFlowState('login')}
        />
      )}

      {flowState === 'pinLock' && (
        <PinLockScreen
          isSettingPin={isSettingPin}
          hasExistingPin={hasExistingPin}
          userEmail={authIdentifier}
          onUnlocked={handlePinUnlocked}
          onForgotPin={handleForgotPin}
          onLogout={handleLogout}
          onCancel={isSettingPin ? () => setFlowState('main') : undefined}
        />
      )}

      {flowState === 'main' && (
        isLocked ? (
          <AppLockScreen onEmergencyLogout={handleLogout} />
        ) : showEmergency ? (
          <EmergencyScreen
            onBack={() => setShowEmergency(false)}
            onGoToActivity={() => {
              setShowEmergency(false);
              setCurrentTab('activity');
            }}
          />
        ) : (
          <View style={styles.mainContainer}>
            <View style={styles.tabContent}>
              {userRole === 'shop' ? (
                <>
                  {currentTab === 'shop' && <ShopScreen />}
                  {currentTab === 'shop-orders' && <ShopOrdersScreen />}
                  {currentTab === 'settings' && (
                    <SettingsScreen
                      onLogout={handleLogout}
                      onSetPinRequested={(hasPin) => handleSetPinRequested(Boolean(hasPin))}
                    />
                  )}
                </>
              ) : (
                <>
                  {currentTab === 'home' && (
                    <HomeScreen
                      onNavigateToNow={() => setCurrentTab('now')}
                      onNavigateToEmergency={() => setShowEmergency(true)}
                      onNavigateToTab={(tab) => setCurrentTab(tab)}
                      onRequestPin={() => {
                        setIsSettingPin(false);
                        setHasExistingPin(true);
                        setFlowState('pinLock');
                      }}
                    />
                  )}
                  {currentTab === 'calendar' && <DatesScreen />}
                  {currentTab === 'threads' && <ThreadsScreen />}
                  {currentTab === 'now' && (
                    <NowScreen
                      onOrderSuccess={() => setCurrentTab('activity')}
                      onNavigateToEmergency={() => setShowEmergency(true)}
                    />
                  )}
                  {currentTab === 'activity' && (
                    <ActivityScreen onNavigateToNow={() => setCurrentTab('now')} />
                  )}
                  {currentTab === 'settings' && (
                    <SettingsScreen
                      onLogout={handleLogout}
                      onSetPinRequested={(hasPin) => handleSetPinRequested(Boolean(hasPin))}
                      onNavigateToActivity={() => setCurrentTab('activity')}
                    />
                  )}
                </>
              )}
            </View>

            <BottomTabBar
              currentTab={currentTab}
              onSelectTab={setCurrentTab}
              role={userRole}
            />
          </View>
        )
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppLockProvider>
        <AppContent />
      </AppLockProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.blush,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainContainer: {
    flex: 1,
    position: 'relative',
  },
  tabContent: {
    flex: 1,
  },
});
