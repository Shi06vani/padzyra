import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  AppLockConfig,
  AppLockStorageService,
  DEFAULT_APP_LOCK_CONFIG,
} from '../services/appLockStorage';
import {
  AppLockController,
  AppLockState,
} from '../services/appLockController';
import {
  BiometricCapabilityService,
  FormattedBiometricStatus,
} from '../services/biometricCapabilityService';
import { getNativeBiometrics } from '../services/biometricNativeBridge';

interface AppLockContextType {
  state: AppLockState;
  config: AppLockConfig;
  capability: FormattedBiometricStatus | null;
  errorMessage: string | null;
  isLocked: boolean;
  isAuthenticating: boolean;
  updateConfig: (partial: Partial<AppLockConfig>) => Promise<boolean>;
  triggerBiometricUnlock: () => Promise<boolean>;
  retryUnlock: () => Promise<boolean>;
  resetToUnlocked: () => void;
  recheckCapability: () => Promise<void>;
  testBiometrics: () => Promise<{ success: boolean; message: string }>;
}

const AppLockContext = createContext<AppLockContextType | null>(null);

export const AppLockProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppLockConfig>(DEFAULT_APP_LOCK_CONFIG);
  const [state, setState] = useState<AppLockState>('initializing');
  const [capability, setCapability] = useState<FormattedBiometricStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const controllerRef = useRef(new AppLockController('initializing'));
  const lastBackgroundTime = useRef<number>(0);
  const appStateRef = useRef<AppStateStatus>((AppState.currentState as AppStateStatus) || 'active');
  const isPromptActive = useRef<boolean>(false);

  const setControllerState = useCallback((nextState: AppLockState, reason?: string) => {
    const success = controllerRef.current.transition(nextState, reason);
    if (success) {
      setState(nextState);
    }
  }, []);

  // Capability check
  const recheckCapability = useCallback(async () => {
    const cap = await BiometricCapabilityService.checkCapability();
    setCapability(cap);
  }, []);

  // Initialize configuration and capability
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const [loadedConfig, cap] = await Promise.all([
          AppLockStorageService.loadConfig(),
          BiometricCapabilityService.checkCapability(),
        ]);

        if (!isMounted) return;

        setConfig(loadedConfig);
        setCapability(cap);

        // Apply task switcher protection flag if configured
        if (loadedConfig.enabled && loadedConfig.taskSwitcherProtection) {
          getNativeBiometrics().setSecureFlag(true).catch(() => {});
        }

        if (loadedConfig.enabled) {
          setControllerState('locked', 'Initial launch with App Lock enabled');
        } else {
          setControllerState('disabled', 'App Lock disabled in settings');
        }
      } catch {
        if (!isMounted) return;
        setControllerState('disabled', 'Init error fallback');
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [setControllerState]);

  // Trigger native biometric authentication prompt
  const triggerBiometricUnlock = useCallback(async (): Promise<boolean> => {
    if (isPromptActive.current) {
      return false;
    }

    isPromptActive.current = true;
    setControllerState('authenticating', 'Starting biometric prompt');
    setErrorMessage(null);

    try {
      const bridge = getNativeBiometrics();
      const result = await bridge.authenticate({
        title: 'Unlock Padzyra',
        subtitle: 'Verify your identity to access your private cycle data',
        description: 'Padzyra uses your device biometric or passcode to keep your logs confidential.',
        negativeButtonText: 'Cancel',
        allowDeviceCredentials: true,
      });

      if (result.success) {
        setControllerState('unlocked', 'Native authentication succeeded');
        setErrorMessage(null);
        isPromptActive.current = false;
        return true;
      }

      // Handle specific error statuses
      let msg = 'Authentication could not be completed.';
      if (result.status === 'canceled') {
        msg = 'Authentication was canceled. Tap below to unlock.';
      } else if (result.status === 'lockout') {
        msg = 'Biometrics locked out due to multiple attempts. Please unlock with your phone passcode.';
      } else if (result.status === 'not_enrolled') {
        msg = 'No biometric enrolled on this device. Please set up fingerprint or face unlock in phone Settings.';
      } else if (result.message) {
        msg = result.message;
      }

      setErrorMessage(msg);
      setControllerState('authentication_failed', result.status || 'Authentication failed');
      isPromptActive.current = false;
      return false;
    } catch (err: any) {
      setErrorMessage(err?.message || 'Authentication error occurred.');
      setControllerState('authentication_failed', 'Native error thrown');
      isPromptActive.current = false;
      return false;
    }
  }, [setControllerState]);

  // Retry unlock
  const retryUnlock = useCallback(async () => {
    return triggerBiometricUnlock();
  }, [triggerBiometricUnlock]);

  // Automatic prompt on lock if biometric is enabled
  useEffect(() => {
    if (state === 'locked' && config.enabled && config.biometricEnabled) {
      // Delay slightly for smooth transition into view
      const timer = setTimeout(() => {
        triggerBiometricUnlock();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [state, config.enabled, config.biometricEnabled, triggerBiometricUnlock]);

  // Handle AppState lifecycle transitions
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const prevAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      // App entering background or inactive
      if (
        (prevAppState === 'active' || prevAppState === 'inactive') &&
        (nextAppState === 'background' || nextAppState === 'inactive')
      ) {
        lastBackgroundTime.current = Date.now();

        if (config.enabled && config.autoLockTimeout === 0) {
          // Immediate mode
          setControllerState('locked', 'Backgrounded in immediate auto-lock mode');
        }
      }

      // App returning to active foreground
      if (
        (prevAppState === 'background' || prevAppState === 'inactive') &&
        nextAppState === 'active'
      ) {
        if (config.enabled && controllerRef.current.getState() !== 'locked') {
          const shouldLock = AppLockController.shouldAutoLock(
            lastBackgroundTime.current,
            config.autoLockTimeout
          );

          if (shouldLock) {
            setControllerState('locked', 'Returned to active after timeout elapsed');
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [config.enabled, config.autoLockTimeout, setControllerState]);

  // Update App Lock configuration
  const updateConfig = useCallback(
    async (partial: Partial<AppLockConfig>): Promise<boolean> => {
      const nextConfig: AppLockConfig = { ...config, ...partial };
      const saved = await AppLockStorageService.saveConfig(nextConfig);

      if (saved) {
        setConfig(nextConfig);

        // Update task switcher protection
        getNativeBiometrics()
          .setSecureFlag(nextConfig.enabled && nextConfig.taskSwitcherProtection)
          .catch(() => {});

        if (!nextConfig.enabled) {
          setControllerState('disabled', 'User disabled App Lock');
        } else if (state === 'disabled') {
          setControllerState('unlocked', 'User enabled App Lock in settings');
        }
        return true;
      }
      return false;
    },
    [config, state, setControllerState]
  );

  // Reset to unlocked (e.g. after password/pin or testing)
  const resetToUnlocked = useCallback(() => {
    setControllerState('unlocked', 'Explicit reset to unlocked');
  }, [setControllerState]);

  // Test biometrics inside settings with feedback
  const testBiometrics = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    try {
      const bridge = getNativeBiometrics();
      const res = await bridge.authenticate({
        title: 'Padzyra Biometric Test',
        subtitle: 'Testing biometric authentication setup',
        negativeButtonText: 'Cancel',
        allowDeviceCredentials: true,
      });

      if (res.success) {
        return { success: true, message: 'Biometric verification successful!' };
      }
      return { success: false, message: res.message || 'Verification was canceled or failed.' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Biometric test error.' };
    }
  }, []);

  const isLocked = state === 'locked' || state === 'authenticating' || state === 'authentication_failed';
  const isAuthenticating = state === 'authenticating';

  return (
    <AppLockContext.Provider
      value={{
        state,
        config,
        capability,
        errorMessage,
        isLocked,
        isAuthenticating,
        updateConfig,
        triggerBiometricUnlock,
        retryUnlock,
        resetToUnlocked,
        recheckCapability,
        testBiometrics,
      }}
    >
      {children}
    </AppLockContext.Provider>
  );
};

export const useAppLock = (): AppLockContextType => {
  const context = useContext(AppLockContext);
  if (!context) {
    throw new Error('useAppLock must be used within an AppLockProvider');
  }
  return context;
};
