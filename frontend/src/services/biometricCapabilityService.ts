import { getNativeBiometrics, BiometricCapability } from './biometricNativeBridge';

export interface FormattedBiometricStatus {
  capability: BiometricCapability;
  canEnableBiometrics: boolean;
  displayTitle: string;
  iconName: string;
  helperText: string;
}

export class BiometricCapabilityService {
  /**
   * Retrieves and formats the biometric capabilities of the current device.
   */
  static async checkCapability(): Promise<FormattedBiometricStatus> {
    try {
      const bridge = getNativeBiometrics();
      const cap = await bridge.getBiometricCapability();

      const canEnableBiometrics = Boolean(cap.supported && cap.enrolled);

      let displayTitle = 'Biometrics';
      let iconName = 'finger-print-outline';

      if (cap.biometryType === 'FaceID') {
        displayTitle = 'Face ID';
        iconName = 'scan-outline';
      } else if (cap.biometryType === 'TouchID') {
        displayTitle = 'Touch ID';
        iconName = 'finger-print-outline';
      } else if (cap.biometryType === 'Biometrics') {
        displayTitle = 'Fingerprint / Face';
        iconName = 'finger-print-outline';
      } else {
        displayTitle = 'Device Lock';
        iconName = 'lock-closed-outline';
      }

      let helperText = '';
      if (!cap.supported) {
        helperText = 'Biometric authentication is not supported by your device hardware.';
      } else if (!cap.enrolled) {
        helperText = `Your device supports ${displayTitle}, but no biometric credentials are registered. Set up biometrics in your phone Settings to enable this feature.`;
      } else {
        helperText = `${displayTitle} is enrolled and ready for quick, private unlocking.`;
      }

      return {
        capability: cap,
        canEnableBiometrics,
        displayTitle,
        iconName,
        helperText,
      };
    } catch (error: any) {
      // Fail closed
      return {
        capability: {
          supported: false,
          enrolled: false,
          availableMethods: [],
          biometryType: 'None',
          fallbackAvailable: false,
          statusDetails: error?.message || 'Capability detection failed',
        },
        canEnableBiometrics: false,
        displayTitle: 'Biometrics',
        iconName: 'shield-outline',
        helperText: 'Unable to detect device biometric capability. App lock will use device passcode fallback.',
      };
    }
  }
}
