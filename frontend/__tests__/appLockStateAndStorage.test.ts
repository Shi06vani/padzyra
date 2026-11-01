import {
  AppLockController,
  AppLockState,
} from '../src/services/appLockController';
import {
  AppLockStorageService,
  DEFAULT_APP_LOCK_CONFIG,
  AppLockConfig,
} from '../src/services/appLockStorage';
import { MockNativeBiometrics } from '../src/services/biometricNativeBridge';

describe('AppLockState Machine and Secure Storage', () => {
  beforeEach(() => {
    MockNativeBiometrics.resetMockStorage();
  });

  describe('AppLockController State Machine', () => {
    test('initializes with default initializing state', () => {
      const controller = new AppLockController();
      expect(controller.getState()).toBe('initializing');
    });

    test('permits valid lifecycle transitions', () => {
      const controller = new AppLockController('initializing');

      // Cold launch with app lock enabled
      expect(controller.transition('locked', 'App Lock enabled on startup')).toBe(true);
      expect(controller.getState()).toBe('locked');

      // User initiates biometric unlock
      expect(controller.transition('authenticating', 'Prompt triggered')).toBe(true);
      expect(controller.getState()).toBe('authenticating');

      // Native prompt succeeds
      expect(controller.transition('unlocked', 'Biometric verified')).toBe(true);
      expect(controller.getState()).toBe('unlocked');

      // Backgrounded beyond timeout
      expect(controller.transition('locked', 'Timeout elapsed')).toBe(true);
      expect(controller.getState()).toBe('locked');
    });

    test('handles authentication failure and retry loop', () => {
      const controller = new AppLockController('locked');

      expect(controller.transition('authenticating')).toBe(true);
      // User cancels prompt
      expect(controller.transition('authentication_failed', 'User canceled')).toBe(true);
      expect(controller.getState()).toBe('authentication_failed');

      // User presses retry button
      expect(controller.transition('authenticating', 'Retry pressed')).toBe(true);
      expect(controller.getState()).toBe('authenticating');

      // Success on retry
      expect(controller.transition('unlocked', 'Success on retry')).toBe(true);
      expect(controller.getState()).toBe('unlocked');
    });

    test('rejects invalid or unsafe state transitions', () => {
      const controller = new AppLockController('authenticating');
      // Cannot jump from authenticating directly to initializing
      expect(controller.transition('initializing')).toBe(false);
      expect(controller.getState()).toBe('authenticating');
    });

    test('records complete audit history of state transitions', () => {
      const controller = new AppLockController('initializing');
      controller.transition('locked', 'Launch');
      controller.transition('authenticating', 'Prompt');
      controller.transition('unlocked', 'Success');

      const history = controller.getHistory();
      expect(history.length).toBe(3);
      expect(history[0].from).toBe('initializing');
      expect(history[0].to).toBe('locked');
      expect(history[2].to).toBe('unlocked');
      expect(history[2].reason).toBe('Success');
      expect(history[2].timestamp).toBeGreaterThan(0);
    });
  });

  describe('Auto-Lock Timeout Logic (shouldAutoLock)', () => {
    test('immediate mode (0s) locks whenever app was backgrounded', () => {
      const now = Date.now();
      const lastBg = now - 50; // only 50ms ago
      expect(AppLockController.shouldAutoLock(lastBg, 0, now)).toBe(true);
    });

    test('1 minute mode (60s) preserves unlocked state within grace period', () => {
      const now = 1000000;
      const lastBg30sAgo = now - 30 * 1000; // 30s elapsed
      expect(AppLockController.shouldAutoLock(lastBg30sAgo, 60, now)).toBe(false);
    });

    test('1 minute mode (60s) locks after 60s has elapsed', () => {
      const now = 1000000;
      const lastBg65sAgo = now - 65 * 1000; // 65s elapsed
      expect(AppLockController.shouldAutoLock(lastBg65sAgo, 60, now)).toBe(true);
    });

    test('5 minutes (300s) and 15 minutes (900s) timeout boundaries', () => {
      const now = 2000000;
      // 4 minutes elapsed -> not locked for 5m setting
      expect(AppLockController.shouldAutoLock(now - 240 * 1000, 300, now)).toBe(false);
      // 6 minutes elapsed -> locked for 5m setting
      expect(AppLockController.shouldAutoLock(now - 360 * 1000, 300, now)).toBe(true);

      // 14 minutes elapsed -> not locked for 15m setting
      expect(AppLockController.shouldAutoLock(now - 840 * 1000, 900, now)).toBe(false);
      // 16 minutes elapsed -> locked for 15m setting
      expect(AppLockController.shouldAutoLock(now - 960 * 1000, 900, now)).toBe(true);
    });

    test('fails closed if timestamp is invalid or 0', () => {
      expect(AppLockController.shouldAutoLock(0, 60)).toBe(true);
      expect(AppLockController.shouldAutoLock(-1, 60)).toBe(true);
    });
  });

  describe('AppLockStorageService', () => {
    test('returns default configuration when no saved config exists', async () => {
      const config = await AppLockStorageService.loadConfig();
      expect(config.enabled).toBe(false);
      expect(config.biometricEnabled).toBe(true);
      expect(config.autoLockTimeout).toBe(0);
      expect(config.taskSwitcherProtection).toBe(true);
    });

    test('persists and reloads modified configuration cleanly', async () => {
      const customConfig: AppLockConfig = {
        enabled: true,
        biometricEnabled: false,
        autoLockTimeout: 300,
        taskSwitcherProtection: false,
      };

      const saveSuccess = await AppLockStorageService.saveConfig(customConfig);
      expect(saveSuccess).toBe(true);

      const loaded = await AppLockStorageService.loadConfig();
      expect(loaded.enabled).toBe(true);
      expect(loaded.biometricEnabled).toBe(false);
      expect(loaded.autoLockTimeout).toBe(300);
      expect(loaded.taskSwitcherProtection).toBe(false);
    });

    test('fails closed on corrupted storage payload without crashing', async () => {
      // Intentionally insert corrupted non-JSON string
      const bridge = require('../src/services/biometricNativeBridge').getNativeBiometrics();
      await bridge.setSecureItem('padzyra_app_lock_config_v1', '{corrupt:json:');

      const config = await AppLockStorageService.loadConfig();
      expect(config).toEqual(DEFAULT_APP_LOCK_CONFIG);
    });

    test('clears saved configuration completely on clearConfig', async () => {
      await AppLockStorageService.saveConfig({
        enabled: true,
        biometricEnabled: true,
        autoLockTimeout: 60,
        taskSwitcherProtection: true,
      });

      await AppLockStorageService.clearConfig();
      const config = await AppLockStorageService.loadConfig();
      expect(config.enabled).toBe(false);
    });
  });
});
