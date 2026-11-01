import { getNativeBiometrics } from './biometricNativeBridge';

export interface AppLockConfig {
  enabled: boolean;
  biometricEnabled: boolean;
  autoLockTimeout: number; // seconds: 0 = immediate, 60 = 1m, 300 = 5m, 900 = 15m
  taskSwitcherProtection: boolean;
}

export const AUTO_LOCK_TIMEOUT_OPTIONS = [
  { value: 0, label: 'Immediately' },
  { value: 60, label: 'After 1 minute' },
  { value: 300, label: 'After 5 minutes' },
  { value: 900, label: 'After 15 minutes' },
];

export const DEFAULT_APP_LOCK_CONFIG: AppLockConfig = {
  enabled: false,
  biometricEnabled: true,
  autoLockTimeout: 0,
  taskSwitcherProtection: true,
};

const STORAGE_KEY = 'padzyra_app_lock_config_v1';

export class AppLockStorageService {
  /**
   * Loads App Lock preferences from secure storage.
   * Fails closed: returns default configuration on read error or corrupted JSON.
   */
  static async loadConfig(): Promise<AppLockConfig> {
    try {
      const bridge = getNativeBiometrics();
      const raw = await bridge.getSecureItem(STORAGE_KEY);
      if (!raw) {
        return { ...DEFAULT_APP_LOCK_CONFIG };
      }

      const parsed = JSON.parse(raw);
      return {
        enabled: Boolean(parsed.enabled),
        biometricEnabled: parsed.biometricEnabled !== undefined ? Boolean(parsed.biometricEnabled) : true,
        autoLockTimeout: typeof parsed.autoLockTimeout === 'number' ? parsed.autoLockTimeout : 0,
        taskSwitcherProtection: parsed.taskSwitcherProtection !== undefined ? Boolean(parsed.taskSwitcherProtection) : true,
      };
    } catch {
      // Fail closed
      return { ...DEFAULT_APP_LOCK_CONFIG };
    }
  }

  /**
   * Persists App Lock preferences securely to Keychain / EncryptedSharedPreferences.
   */
  static async saveConfig(config: AppLockConfig): Promise<boolean> {
    try {
      const bridge = getNativeBiometrics();
      const payload = JSON.stringify({
        enabled: Boolean(config.enabled),
        biometricEnabled: Boolean(config.biometricEnabled),
        autoLockTimeout: config.autoLockTimeout,
        taskSwitcherProtection: Boolean(config.taskSwitcherProtection),
        updatedAt: Date.now(),
      });
      return await bridge.setSecureItem(STORAGE_KEY, payload);
    } catch {
      return false;
    }
  }

  /**
   * Clears saved App Lock preferences.
   */
  static async clearConfig(): Promise<boolean> {
    try {
      const bridge = getNativeBiometrics();
      return await bridge.removeSecureItem(STORAGE_KEY);
    } catch {
      return false;
    }
  }
}
