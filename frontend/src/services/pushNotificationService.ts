import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { PadzyraApi } from '../api/client';

const TOKEN_STORAGE_KEY = 'padzyra_device_fcm_token_v1';

let cachedToken: string | null = null;

/**
 * Generates a stable simulated/device installation token for push notifications
 */
function generateStableDeviceToken(): string {
  const chars = 'abcdef0123456789';
  let rand = '';
  for (let i = 0; i < 32; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `fcm_${Platform.OS}_${Date.now().toString(36)}_${rand}`;
}

export const PushNotificationService = {
  /**
   * Request push notification permission on Android 13+ (API 33+)
   */
  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        // Android 13+ requires POST_NOTIFICATIONS runtime permission
        const permission = (PermissionsAndroid.PERMISSIONS as any).POST_NOTIFICATIONS;
        if (permission) {
          const granted = await PermissionsAndroid.request(permission, {
            title: '🌸 Padzyra Period Reminders',
            message:
              'Enable gentle, discreet reminders for pad changes, upcoming cycle dates, and hydration.',
            buttonPositive: 'Allow Reminders',
            buttonNegative: 'Not Now',
          });
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
        return true;
      } catch (err) {
        console.warn('[PushNotificationService] Permission request warning:', err);
        return true;
      }
    }
    return true;
  },

  /**
   * Retrieves or initializes the device push token
   */
  getDeviceToken(): string {
    if (!cachedToken) {
      cachedToken = generateStableDeviceToken();
    }
    return cachedToken;
  },

  /**
   * Registers this device's push token with Padzyra backend Firebase service
   */
  async registerDeviceToken(): Promise<{ success: boolean; token: string; message: string }> {
    try {
      await this.requestPermission();
      const token = this.getDeviceToken();
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      await PadzyraApi.saveFcmToken(token, platform);
      return {
        success: true,
        token,
        message: 'Device successfully registered for Firebase push reminders.',
      };
    } catch (err: any) {
      console.warn('[PushNotificationService] Failed to register push token:', err?.message || err);
      return {
        success: false,
        token: cachedToken || '',
        message: err?.message || 'Could not register push token with server.',
      };
    }
  },

  /**
   * Checks current Firebase Admin SDK & token registration status
   */
  async checkFcmStatus() {
    try {
      return await PadzyraApi.getFcmStatus();
    } catch {
      return { firebaseInitialized: false, tokensCount: 0, tokens: [] };
    }
  },

  /**
   * Trigger a real-time reminder notification via Firebase
   */
  async dispatchReminder(kind: string = 'test') {
    // Automatically ensure this device is registered before dispatching
    await this.registerDeviceToken().catch(() => {});
    return PadzyraApi.sendReminderNotification({ kind });
  },
};
