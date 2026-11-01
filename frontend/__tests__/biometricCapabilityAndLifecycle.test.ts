import {
  BiometricCapabilityService,
} from '../src/services/biometricCapabilityService';
import {
  MockNativeBiometrics,
  getNativeBiometrics,
} from '../src/services/biometricNativeBridge';

describe('Biometric Capability and Authentication Handling', () => {
  beforeEach(() => {
    MockNativeBiometrics.resetMockStorage();
    MockNativeBiometrics.setMockCapability({
      supported: true,
      enrolled: true,
      availableMethods: ['biometric', 'device_credential'],
      biometryType: 'FaceID',
      fallbackAvailable: true,
      statusDetails: 'Face ID is active',
    });
  });

  describe('BiometricCapabilityService', () => {
    test('reports Face ID correctly when supported and enrolled', async () => {
      MockNativeBiometrics.setMockCapability({
        supported: true,
        enrolled: true,
        biometryType: 'FaceID',
      });

      const result = await BiometricCapabilityService.checkCapability();
      expect(result.canEnableBiometrics).toBe(true);
      expect(result.displayTitle).toBe('Face ID');
      expect(result.iconName).toBe('scan-outline');
      expect(result.helperText).toContain('enrolled and ready');
    });

    test('reports Touch ID correctly when supported and enrolled', async () => {
      MockNativeBiometrics.setMockCapability({
        supported: true,
        enrolled: true,
        biometryType: 'TouchID',
      });

      const result = await BiometricCapabilityService.checkCapability();
      expect(result.canEnableBiometrics).toBe(true);
      expect(result.displayTitle).toBe('Touch ID');
      expect(result.iconName).toBe('finger-print-outline');
    });

    test('reports Android Biometrics (Fingerprint / Face) correctly', async () => {
      MockNativeBiometrics.setMockCapability({
        supported: true,
        enrolled: true,
        biometryType: 'Biometrics',
      });

      const result = await BiometricCapabilityService.checkCapability();
      expect(result.canEnableBiometrics).toBe(true);
      expect(result.displayTitle).toBe('Fingerprint / Face');
      expect(result.iconName).toBe('finger-print-outline');
    });

    test('detects when biometric hardware is present but no credentials enrolled', async () => {
      MockNativeBiometrics.setMockCapability({
        supported: true,
        enrolled: false,
        biometryType: 'FaceID',
      });

      const result = await BiometricCapabilityService.checkCapability();
      expect(result.canEnableBiometrics).toBe(false);
      expect(result.helperText).toContain('no biometric credentials are registered');
      expect(result.helperText).toContain('phone Settings');
    });

    test('detects when device has no biometric hardware', async () => {
      MockNativeBiometrics.setMockCapability({
        supported: false,
        enrolled: false,
        biometryType: 'None',
      });

      const result = await BiometricCapabilityService.checkCapability();
      expect(result.canEnableBiometrics).toBe(false);
      expect(result.displayTitle).toBe('Device Lock');
      expect(result.helperText).toContain('not supported by your device hardware');
    });

    test('verifies device passcode fallback availability', async () => {
      MockNativeBiometrics.setMockCapability({
        supported: true,
        enrolled: true,
        fallbackAvailable: true,
      });

      const result = await BiometricCapabilityService.checkCapability();
      expect(result.capability.fallbackAvailable).toBe(true);
      expect(result.capability.availableMethods).toContain('device_credential');
    });
  });

  describe('Native Biometric Authentication Responses', () => {
    test('handles successful authentication result', async () => {
      const bridge = getNativeBiometrics();
      const res = await bridge.authenticate({
        title: 'Unlock Padzyra',
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('success');
      expect(res.type).toBe('biometric');
    });

    test('handles authentication rejection when not enrolled', async () => {
      MockNativeBiometrics.setMockCapability({
        supported: true,
        enrolled: false,
      });

      const bridge = getNativeBiometrics();
      const res = await bridge.authenticate({
        title: 'Unlock Padzyra',
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('not_enrolled');
    });

    test('handles hardware unavailable response', async () => {
      MockNativeBiometrics.setMockCapability({
        supported: false,
        enrolled: false,
      });

      const bridge = getNativeBiometrics();
      const res = await bridge.authenticate({
        title: 'Unlock Padzyra',
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('unavailable');
    });

    test('toggles task switcher window protection flag', async () => {
      const bridge = getNativeBiometrics();
      const enabledResult = await bridge.setSecureFlag(true);
      expect(enabledResult).toBe(true);

      const disabledResult = await bridge.setSecureFlag(false);
      expect(disabledResult).toBe(true);
    });
  });
});
