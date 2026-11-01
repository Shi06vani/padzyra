package com.padzyra

import android.app.Activity
import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.view.WindowManager
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import java.util.concurrent.Executor

class BiometricModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val PREFS_FILE = "padzyra_secure_app_lock"
    private var sharedPreferences: SharedPreferences? = null

    init {
        initSecureStorage()
    }

    override fun getName(): String = "PadzyraBiometrics"

    private fun initSecureStorage() {
        try {
            val masterKey = MasterKey.Builder(reactContext)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            sharedPreferences = EncryptedSharedPreferences.create(
                reactContext,
                PREFS_FILE,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            // Fallback to private SharedPreferences if EncryptedSharedPreferences fails on emulator
            try {
                sharedPreferences = reactContext.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)
            } catch (_: Exception) {
                sharedPreferences = null
            }
        }
    }

    @ReactMethod
    fun getBiometricCapability(promise: Promise) {
        try {
            val biometricManager = BiometricManager.from(reactContext)
            val strongAuth = BIOMETRIC_STRONG
            val withCredential = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                BIOMETRIC_STRONG or DEVICE_CREDENTIAL
            } else {
                BIOMETRIC_WEAK
            }

            val canAuthResult = biometricManager.canAuthenticate(strongAuth)
            val result: WritableMap = Arguments.createMap()

            val availableMethods = Arguments.createArray()

            when (canAuthResult) {
                BiometricManager.BIOMETRIC_SUCCESS -> {
                    result.putBoolean("supported", true)
                    result.putBoolean("enrolled", true)
                    result.putString("biometryType", "Biometrics")
                    result.putString("statusDetails", "Biometric authentication is ready and enrolled.")
                    result.putInt("statusCode", canAuthResult)
                    availableMethods.pushString("biometric")
                }
                BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> {
                    result.putBoolean("supported", true)
                    result.putBoolean("enrolled", false)
                    result.putString("biometryType", "Biometrics")
                    result.putString("statusDetails", "Biometric hardware is available, but no fingerprints or face templates are enrolled in device settings.")
                    result.putInt("statusCode", canAuthResult)
                }
                BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> {
                    result.putBoolean("supported", false)
                    result.putBoolean("enrolled", false)
                    result.putString("biometryType", "None")
                    result.putString("statusDetails", "This device does not have biometric authentication hardware.")
                    result.putInt("statusCode", canAuthResult)
                }
                BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> {
                    result.putBoolean("supported", true)
                    result.putBoolean("enrolled", false)
                    result.putString("biometryType", "Biometrics")
                    result.putString("statusDetails", "Biometric sensor is temporarily unavailable or busy.")
                    result.putInt("statusCode", canAuthResult)
                }
                BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED -> {
                    result.putBoolean("supported", false)
                    result.putBoolean("enrolled", false)
                    result.putString("biometryType", "None")
                    result.putString("statusDetails", "A security update is required to use biometric hardware.")
                    result.putInt("statusCode", canAuthResult)
                }
                else -> {
                    result.putBoolean("supported", false)
                    result.putBoolean("enrolled", false)
                    result.putString("biometryType", "None")
                    result.putString("statusDetails", "Biometric capability could not be determined.")
                    result.putInt("statusCode", canAuthResult)
                }
            }

            // Check if device credentials (PIN/pattern/password) can be used as fallback
            val credentialCheck = biometricManager.canAuthenticate(DEVICE_CREDENTIAL)
            val fallbackAvailable = credentialCheck == BiometricManager.BIOMETRIC_SUCCESS
            result.putBoolean("fallbackAvailable", fallbackAvailable)
            if (fallbackAvailable) {
                availableMethods.pushString("device_credential")
            }

            result.putArray("availableMethods", availableMethods)
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("CAPABILITY_ERROR", e.localizedMessage, e)
        }
    }

    @ReactMethod
    fun authenticate(options: ReadableMap, promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity == null || activity !is FragmentActivity) {
            promise.reject("ACTIVITY_ERROR", "Current activity is not available or not a FragmentActivity")
            return
        }

        val title = if (options.hasKey("title")) options.getString("title") else "Unlock Padzyra"
        val subtitle = if (options.hasKey("subtitle")) options.getString("subtitle") else "Verify your identity to access your private cycle data"
        val description = if (options.hasKey("description")) options.getString("description") else null
        val negativeButtonText = if (options.hasKey("negativeButtonText")) options.getString("negativeButtonText") else "Cancel"
        val allowDeviceCredentials = options.hasKey("allowDeviceCredentials") && options.getBoolean("allowDeviceCredentials")

        activity.runOnUiThread {
            try {
                val executor: Executor = ContextCompat.getMainExecutor(activity)

                var promptHandled = false

                val callback = object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        super.onAuthenticationSucceeded(result)
                        if (promptHandled) return
                        promptHandled = true

                        val resultMap = Arguments.createMap()
                        resultMap.putBoolean("success", true)
                        resultMap.putString("type", "biometric")
                        promise.resolve(resultMap)
                    }

                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        super.onAuthenticationError(errorCode, errString)
                        if (promptHandled) return
                        promptHandled = true

                        val resultMap = Arguments.createMap()
                        resultMap.putBoolean("success", false)
                        resultMap.putInt("errorCode", errorCode)
                        resultMap.putString("message", errString.toString())

                        when (errorCode) {
                            BiometricPrompt.ERROR_USER_CANCELED,
                            BiometricPrompt.ERROR_NEGATIVE_BUTTON -> {
                                resultMap.putString("status", "canceled")
                            }
                            BiometricPrompt.ERROR_LOCKOUT,
                            BiometricPrompt.ERROR_LOCKOUT_PERMANENT -> {
                                resultMap.putString("status", "lockout")
                            }
                            BiometricPrompt.ERROR_NO_BIOMETRICS -> {
                                resultMap.putString("status", "not_enrolled")
                            }
                            BiometricPrompt.ERROR_HW_NOT_PRESENT,
                            BiometricPrompt.ERROR_HW_UNAVAILABLE -> {
                                resultMap.putString("status", "unavailable")
                            }
                            else -> {
                                resultMap.putString("status", "error")
                            }
                        }

                        promise.resolve(resultMap)
                    }

                    override fun onAuthenticationFailed() {
                        super.onAuthenticationFailed()
                        // User presented wrong finger/face; BiometricPrompt stays open and allows retry
                    }
                }

                val biometricPrompt = BiometricPrompt(activity, executor, callback)
                val promptInfoBuilder = BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title ?: "Unlock Padzyra")

                if (!subtitle.isNullOrEmpty()) {
                    promptInfoBuilder.setSubtitle(subtitle)
                }
                if (!description.isNullOrEmpty()) {
                    promptInfoBuilder.setDescription(description)
                }

                if (allowDeviceCredentials && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    promptInfoBuilder.setAllowedAuthenticators(BIOMETRIC_STRONG or DEVICE_CREDENTIAL)
                } else if (allowDeviceCredentials && Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
                    // Deprecated method for Android P and below
                    @Suppress("DEPRECATION")
                    promptInfoBuilder.setDeviceCredentialAllowed(true)
                } else {
                    promptInfoBuilder.setNegativeButtonText(negativeButtonText ?: "Cancel")
                    promptInfoBuilder.setAllowedAuthenticators(BIOMETRIC_STRONG)
                }

                biometricPrompt.authenticate(promptInfoBuilder.build())
            } catch (e: Exception) {
                promise.reject("AUTH_EXCEPTION", e.localizedMessage, e)
            }
        }
    }

    @ReactMethod
    fun setSecureFlag(enable: Boolean, promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.resolve(false)
            return
        }

        activity.runOnUiThread {
            try {
                if (enable) {
                    activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
                } else {
                    activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                }
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("FLAG_SECURE_ERROR", e.localizedMessage, e)
            }
        }
    }

    @ReactMethod
    fun setSecureItem(key: String, value: String, promise: Promise) {
        try {
            if (sharedPreferences == null) {
                initSecureStorage()
            }
            val prefs = sharedPreferences
            if (prefs == null) {
                promise.reject("STORAGE_UNAVAILABLE", "Secure storage is not available")
                return
            }
            prefs.edit().putString(key, value).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STORAGE_SET_ERROR", e.localizedMessage, e)
        }
    }

    @ReactMethod
    fun getSecureItem(key: String, promise: Promise) {
        try {
            if (sharedPreferences == null) {
                initSecureStorage()
            }
            val prefs = sharedPreferences
            if (prefs == null) {
                promise.reject("STORAGE_UNAVAILABLE", "Secure storage is not available")
                return
            }
            val value = prefs.getString(key, null)
            promise.resolve(value)
        } catch (e: Exception) {
            promise.reject("STORAGE_GET_ERROR", e.localizedMessage, e)
        }
    }

    @ReactMethod
    fun removeSecureItem(key: String, promise: Promise) {
        try {
            if (sharedPreferences == null) {
                initSecureStorage()
            }
            val prefs = sharedPreferences
            if (prefs == null) {
                promise.reject("STORAGE_UNAVAILABLE", "Secure storage is not available")
                return
            }
            prefs.edit().remove(key).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STORAGE_REMOVE_ERROR", e.localizedMessage, e)
        }
    }
}
