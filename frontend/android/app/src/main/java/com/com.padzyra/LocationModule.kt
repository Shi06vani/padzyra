package com.padzyra

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import java.util.Locale
import java.util.concurrent.Executors

class LocationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val bgExecutor = Executors.newSingleThreadExecutor()

    override fun getName(): String = "NativeLocation"

    @SuppressLint("MissingPermission")
    @ReactMethod
    fun getCurrentPosition(promise: Promise) {
        val fineGranted = ContextCompat.checkSelfPermission(
            reactContext,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        val coarseGranted = ContextCompat.checkSelfPermission(
            reactContext,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (!fineGranted && !coarseGranted) {
            promise.reject("PERMISSION_DENIED", "Location permission not granted. Please allow location access in settings.")
            return
        }

        val locationManager =
            reactContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        if (locationManager == null) {
            promise.reject("UNAVAILABLE", "Location service is not available on this device")
            return
        }

        // 1. Check last known location across all providers (GPS, Network, Passive)
        var bestLocation: Location? = null
        val providerCandidates = listOf(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER,
            LocationManager.PASSIVE_PROVIDER
        )

        for (provider in providerCandidates) {
            try {
                val loc = locationManager.getLastKnownLocation(provider) ?: continue
                if (bestLocation == null || loc.accuracy < bestLocation.accuracy) {
                    bestLocation = loc
                }
            } catch (_: Exception) {}
        }

        // If we have a recent last-known location (under 15 mins old with reasonable accuracy)
        val now = System.currentTimeMillis()
        if (bestLocation != null && (now - bestLocation.time) < 900000 && bestLocation.accuracy <= 300f) {
            sendLocationResponse(bestLocation, promise)
            return
        }

        // 2. Request active location updates on main thread
        val handler = Handler(Looper.getMainLooper())
        var resolved = false

        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                if (!resolved) {
                    resolved = true
                    try {
                        locationManager.removeUpdates(this)
                    } catch (_: Exception) {}
                    sendLocationResponse(location, promise)
                }
            }

            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
            override fun onProviderEnabled(provider: String) {}
            override fun onProviderDisabled(provider: String) {}
        }

        handler.post {
            try {
                var requested = false
                val isGpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
                val isNetworkEnabled = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)

                if (isNetworkEnabled) {
                    try {
                        locationManager.requestSingleUpdate(LocationManager.NETWORK_PROVIDER, listener, Looper.getMainLooper())
                        requested = true
                    } catch (_: Exception) {}
                }
                if (isGpsEnabled) {
                    try {
                        locationManager.requestSingleUpdate(LocationManager.GPS_PROVIDER, listener, Looper.getMainLooper())
                        requested = true
                    } catch (_: Exception) {}
                }

                if (!requested) {
                    if (bestLocation != null) {
                        sendLocationResponse(bestLocation, promise)
                    } else {
                        promise.reject("DISABLED", "GPS and Location are disabled. Please turn on Device Location in quick settings.")
                    }
                    return@post
                }

                // Timeout after 6 seconds: fall back to best known location or reject
                handler.postDelayed({
                    if (!resolved) {
                        resolved = true
                        try {
                            locationManager.removeUpdates(listener)
                        } catch (_: Exception) {}
                        if (bestLocation != null) {
                            sendLocationResponse(bestLocation, promise)
                        } else {
                            promise.reject("TIMEOUT", "Could not obtain GPS fix. Please ensure Location is enabled.")
                        }
                    }
                }, 6000)
            } catch (e: Exception) {
                if (!resolved) {
                    resolved = true
                    if (bestLocation != null) {
                        sendLocationResponse(bestLocation, promise)
                    } else {
                        promise.reject("ERROR", e.message ?: "Failed to retrieve location")
                    }
                }
            }
        }
    }

    private fun sendLocationResponse(loc: Location, promise: Promise) {
        bgExecutor.execute {
            val map: WritableMap = Arguments.createMap()
            map.putDouble("latitude", loc.latitude)
            map.putDouble("longitude", loc.longitude)
            map.putDouble("accuracy", loc.accuracy.toDouble())

            try {
                val geocoder = Geocoder(reactContext, Locale.getDefault())
                @Suppress("DEPRECATION")
                val addresses = geocoder.getFromLocation(loc.latitude, loc.longitude, 1)
                if (!addresses.isNullOrEmpty()) {
                    val addr = addresses[0]
                    val locality = addr.locality ?: addr.subAdminArea ?: addr.adminArea ?: ""
                    val subLocality = addr.subLocality ?: addr.thoroughfare ?: ""
                    val displayText = when {
                        subLocality.isNotBlank() && locality.isNotBlank() -> "$subLocality, $locality"
                        locality.isNotBlank() -> locality
                        else -> addr.getAddressLine(0)?.split(",")?.take(2)?.joinToString(",")?.trim() ?: ""
                    }
                    map.putString("locality", locality)
                    map.putString("subLocality", subLocality)
                    map.putString("displayName", displayText)
                }
            } catch (_: Exception) {}

            promise.resolve(map)
        }
    }
}
