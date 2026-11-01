#import "BiometricModule.h"
#import <UIKit/UIKit.h>

@implementation BiometricModule

RCT_EXPORT_MODULE(PadzyraBiometrics);

+ (BOOL)requiresMainQueueSetup
{
    return YES;
}

RCT_EXPORT_METHOD(getBiometricCapability:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    LAContext *context = [[LAContext alloc] init];
    NSError *authError = nil;

    BOOL canAuthBiometric = [context canEvaluatePolicy:LAPolicyDeviceOwnerAuthenticationWithBiometrics error:&authError];
    BOOL canAuthPasscode = [context canEvaluatePolicy:LAPolicyDeviceOwnerAuthentication error:nil];

    NSMutableDictionary *result = [NSMutableDictionary dictionary];
    NSMutableArray *availableMethods = [NSMutableArray array];

    NSString *biometryType = @"None";
    if (@available(iOS 11.0, *)) {
        if (context.biometryType == LABiometryTypeFaceID) {
            biometryType = @"FaceID";
        } else if (context.biometryType == LABiometryTypeTouchID) {
            biometryType = @"TouchID";
        }
    }

    result[@"biometryType"] = biometryType;
    result[@"fallbackAvailable"] = @(canAuthPasscode);
    if (canAuthPasscode) {
        [availableMethods addObject:@"device_passcode"];
    }

    if (canAuthBiometric) {
        result[@"supported"] = @YES;
        result[@"enrolled"] = @YES;
        result[@"statusDetails"] = [NSString stringWithFormat:@"%@ is available and enrolled.", biometryType];
        [availableMethods addObject:@"biometric"];
    } else {
        if (authError) {
            switch (authError.code) {
                case LAErrorBiometryNotEnrolled:
                    result[@"supported"] = @YES;
                    result[@"enrolled"] = @NO;
                    result[@"statusDetails"] = [NSString stringWithFormat:@"%@ hardware is present, but no biometric is enrolled in device Settings.", biometryType];
                    break;
                case LAErrorBiometryNotAvailable:
                    result[@"supported"] = @NO;
                    result[@"enrolled"] = @NO;
                    result[@"statusDetails"] = @"Biometric authentication is not supported or not available on this device.";
                    break;
                case LAErrorBiometryLockout:
                    result[@"supported"] = @YES;
                    result[@"enrolled"] = @YES;
                    result[@"statusDetails"] = @"Biometric authentication is locked out due to multiple failed attempts. Device passcode required.";
                    break;
                default:
                    result[@"supported"] = @NO;
                    result[@"enrolled"] = @NO;
                    result[@"statusDetails"] = authError.localizedDescription ?: @"Biometrics unavailable.";
                    break;
            }
        } else {
            result[@"supported"] = @NO;
            result[@"enrolled"] = @NO;
            result[@"statusDetails"] = @"Biometric capability unavailable.";
        }
    }

    result[@"availableMethods"] = availableMethods;
    resolve(result);
}

RCT_EXPORT_METHOD(authenticate:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    LAContext *context = [[LAContext alloc] init];

    NSString *reason = options[@"reason"] ?: options[@"title"] ?: @"Unlock Padzyra to view your private cycle data";
    NSString *cancelTitle = options[@"negativeButtonText"] ?: @"Cancel";
    BOOL allowPasscode = [options[@"allowDeviceCredentials"] boolValue];

    context.localizedCancelTitle = cancelTitle;

    LAPolicy policy = allowPasscode ? LAPolicyDeviceOwnerAuthentication : LAPolicyDeviceOwnerAuthenticationWithBiometrics;

    [context evaluatePolicy:policy
            localizedReason:reason
                      reply:^(BOOL success, NSError * _Nullable error) {
        dispatch_async(dispatch_get_main_queue(), ^{
            NSMutableDictionary *result = [NSMutableDictionary dictionary];
            if (success) {
                result[@"success"] = @YES;
                result[@"type"] = @"biometric";
                resolve(result);
            } else {
                result[@"success"] = @NO;
                result[@"errorCode"] = @(error.code);
                result[@"message"] = error.localizedDescription ?: @"Authentication failed";

                switch (error.code) {
                    case LAErrorUserCancel:
                    case LAErrorSystemCancel:
                    case LAErrorAppCancel:
                        result[@"status"] = @"canceled";
                        break;
                    case LAErrorBiometryLockout:
                        result[@"status"] = @"lockout";
                        break;
                    case LAErrorBiometryNotEnrolled:
                        result[@"status"] = @"not_enrolled";
                        break;
                    case LAErrorBiometryNotAvailable:
                        result[@"status"] = @"unavailable";
                        break;
                    case LAErrorAuthenticationFailed:
                        result[@"status"] = @"failed";
                        break;
                    case LAErrorPasscodeNotSet:
                        result[@"status"] = @"passcode_not_set";
                        break;
                    default:
                        result[@"status"] = @"error";
                        break;
                }
                resolve(result);
            }
        });
    }];
}

RCT_EXPORT_METHOD(setSecureFlag:(BOOL)enable
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    // On iOS, privacy masking in task switcher is handled via UIWindow snapshot protection
    resolve(@(YES));
}

RCT_EXPORT_METHOD(setSecureItem:(NSString *)key
                  value:(NSString *)value
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (!key || !value) {
        reject(@"INVALID_ARGS", @"Key and value must not be nil", nil);
        return;
    }

    NSData *data = [value dataUsingEncoding:NSUTF8StringEncoding];
    NSDictionary *query = @{
        (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
        (__bridge id)kSecAttrService: @"com.padzyra.applock",
        (__bridge id)kSecAttrAccount: key,
    };

    SecItemDelete((__bridge CFDictionaryRef)query);

    NSMutableDictionary *attributes = [query mutableCopy];
    attributes[(__bridge id)kSecValueData] = data;
    attributes[(__bridge id)kSecAttrAccessible] = (__bridge id)kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly;

    OSStatus status = SecItemAdd((__bridge CFDictionaryRef)attributes, NULL);
    if (status == errSecSuccess) {
        resolve(@YES);
    } else {
        reject(@"KEYCHAIN_SET_ERROR", [NSString stringWithFormat:@"SecItemAdd returned %d", (int)status], nil);
    }
}

RCT_EXPORT_METHOD(getSecureItem:(NSString *)key
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (!key) {
        reject(@"INVALID_ARGS", @"Key must not be nil", nil);
        return;
    }

    NSDictionary *query = @{
        (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
        (__bridge id)kSecAttrService: @"com.padzyra.applock",
        (__bridge id)kSecAttrAccount: key,
        (__bridge id)kSecReturnData: @YES,
        (__bridge id)kSecMatchLimit: (__bridge id)kSecMatchLimitOne,
    };

    CFTypeRef resultRef = NULL;
    OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &resultRef);

    if (status == errSecSuccess) {
        NSData *data = (__bridge_transfer NSData *)resultRef;
        NSString *value = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        resolve(value);
    } else if (status == errSecItemNotFound) {
        resolve([NSNull null]);
    } else {
        reject(@"KEYCHAIN_GET_ERROR", [NSString stringWithFormat:@"SecItemCopyMatching returned %d", (int)status], nil);
    }
}

RCT_EXPORT_METHOD(removeSecureItem:(NSString *)key
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (!key) {
        reject(@"INVALID_ARGS", @"Key must not be nil", nil);
        return;
    }

    NSDictionary *query = @{
        (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
        (__bridge id)kSecAttrService: @"com.padzyra.applock",
        (__bridge id)kSecAttrAccount: key,
    };

    OSStatus status = SecItemDelete((__bridge CFDictionaryRef)query);
    if (status == errSecSuccess || status == errSecItemNotFound) {
        resolve(@YES);
    } else {
        reject(@"KEYCHAIN_DELETE_ERROR", [NSString stringWithFormat:@"SecItemDelete returned %d", (int)status], nil);
    }
}

@end
