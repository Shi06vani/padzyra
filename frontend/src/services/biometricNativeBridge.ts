import { NativeModules, Platform } from 'react-native';

export interface BiometricCapability {
  supported: boolean;
  enrolled: boolean;
  availableMethods: string[];
  biometryType: 'FaceID' | 'TouchID' | 'Biometrics' | 'None';
  fallbackAvailable: boolean;
  statusDetails: string;
  statusCode?: number;
}

export interface BiometricAuthOptions {
  title?: string;
  subtitle?: string;
  description?: string;
  negativeButtonText?: string;
  allowDeviceCredentials?: boolean;
}

export interface BiometricAuthResult {
  success: boolean;
  type?: string;
  status?: 'success' | 'canceled' | 'lockout' | 'failed' | 'not_enrolled' | 'unavailable' | 'error';
  errorCode?: number;
  message?: string;
}

export interface NativeBiometricsInterface {
  getBiometricCapability(): Promise<BiometricCapability>;
  authenticate(options: BiometricAuthOptions): Promise<BiometricAuthResult>;
  setSecureFlag(enable: boolean): Promise<boolean>;
  setSecureItem(key: string, value: string): Promise<boolean>;
  getSecureItem(key: string): Promise<string | null>;
  removeSecureItem(key: string): Promise<boolean>;
}

// Fallback in-memory implementation for automated tests or when native module is mocked
let mockStorage: Record<string, string> = {};
let mockCapability: BiometricCapability = {
  supported: true,
  enrolled: true,
  availableMethods: ['biometric', 'device_credential'],
  biometryType: Platform.OS === 'ios' ? 'FaceID' : 'Biometrics',
  fallbackAvailable: true,
  statusDetails: 'Biometric capability is active (simulated).',
};

export const MockNativeBiometrics = {
  setMockCapability(cap: Partial<BiometricCapability>) {
    mockCapability = { ...mockCapability, ...cap };
  },
  resetMockStorage() {
    mockStorage = {};
  },
  getMockStorage() {
    return { ...mockStorage };
  },
};

const FallbackBiometrics: NativeBiometricsInterface = {
  async getBiometricCapability(): Promise<BiometricCapability> {
    return { ...mockCapability };
  },
  async authenticate(options: BiometricAuthOptions): Promise<BiometricAuthResult> {
    if (!mockCapability.enrolled || !mockCapability.supported) {
      return {
        success: false,
        status: mockCapability.supported ? 'not_enrolled' : 'unavailable',
        message: 'Biometrics unavailable or not enrolled',
      };
    }
    return {
      success: true,
      type: 'biometric',
      status: 'success',
    };
  },
  async setSecureFlag(enable: boolean): Promise<boolean> {
    return true;
  },
  async setSecureItem(key: string, value: string): Promise<boolean> {
    mockStorage[key] = value;
    return true;
  },
  async getSecureItem(key: string): Promise<string | null> {
    return mockStorage[key] ?? null;
  },
  async removeSecureItem(key: string): Promise<boolean> {
    delete mockStorage[key];
    return true;
  },
};

/**
 * Returns the native module if registered, or the fallback implementation.
 */
export function getNativeBiometrics(): NativeBiometricsInterface {
  const native = NativeModules.PadzyraBiometrics;
  if (native && typeof native.getBiometricCapability === 'function') {
    return native as NativeBiometricsInterface;
  }
  return FallbackBiometrics;
}
