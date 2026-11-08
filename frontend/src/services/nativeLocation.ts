import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy?: number;
  displayName: string;
  locality?: string;
  isFallback?: boolean;
}

export interface PresetCity {
  id: string;
  name: string;
  shortName: string;
  lat: number;
  lng: number;
}

export const PRESET_CITIES: PresetCity[] = [
  { id: 'indore', name: 'Indore, Madhya Pradesh', shortName: 'Indore', lat: 22.7196, lng: 75.8577 },
  { id: 'bengaluru', name: 'Bengaluru, Karnataka', shortName: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
  { id: 'bhopal', name: 'Bhopal, Madhya Pradesh', shortName: 'Bhopal', lat: 23.2599, lng: 77.4126 },
  { id: 'delhi', name: 'New Delhi, NCR', shortName: 'Delhi', lat: 28.6139, lng: 77.2090 },
  { id: 'mumbai', name: 'Mumbai, Maharashtra', shortName: 'Mumbai', lat: 19.0760, lng: 72.8777 },
  { id: 'pune', name: 'Pune, Maharashtra', shortName: 'Pune', lat: 18.5204, lng: 73.8567 },
];

const KNOWN_CITIES: { [key: string]: { name: string; lat: number; lng: number } } = {
  indore: { name: 'Indore, Madhya Pradesh', lat: 22.7196, lng: 75.8577 },
  'vijay nagar': { name: 'Vijay Nagar, Indore', lat: 22.7533, lng: 75.8937 },
  palasia: { name: 'Palasia, Indore', lat: 22.7244, lng: 75.8839 },
  rajwada: { name: 'Rajwada, Indore', lat: 22.7196, lng: 75.8577 },
  bhawarkua: { name: 'Bhawarkua, Indore', lat: 22.6926, lng: 75.8676 },
  chappan: { name: 'Chappan Dukan, Indore', lat: 22.7240, lng: 75.8770 },
  bhopal: { name: 'Bhopal, Madhya Pradesh', lat: 23.2599, lng: 77.4126 },
  ujjain: { name: 'Ujjain, Madhya Pradesh', lat: 23.1765, lng: 75.7885 },
  dewas: { name: 'Dewas, Madhya Pradesh', lat: 22.9676, lng: 76.0534 },
  bengaluru: { name: 'Bengaluru, Karnataka', lat: 12.9716, lng: 77.5946 },
  bangalore: { name: 'Bengaluru, Karnataka', lat: 12.9716, lng: 77.5946 },
  mumbai: { name: 'Mumbai, Maharashtra', lat: 19.0760, lng: 72.8777 },
  delhi: { name: 'New Delhi, NCR', lat: 28.6139, lng: 77.2090 },
  'new delhi': { name: 'New Delhi, NCR', lat: 28.6139, lng: 77.2090 },
  noida: { name: 'Noida, Uttar Pradesh', lat: 28.5355, lng: 77.3910 },
  gurgaon: { name: 'Gurugram, Haryana', lat: 28.4595, lng: 77.0266 },
  gurugram: { name: 'Gurugram, Haryana', lat: 28.4595, lng: 77.0266 },
  pune: { name: 'Pune, Maharashtra', lat: 18.5204, lng: 73.8567 },
  hyderabad: { name: 'Hyderabad, Telangana', lat: 17.3850, lng: 78.4867 },
  chennai: { name: 'Chennai, Tamil Nadu', lat: 13.0827, lng: 80.2707 },
  jaipur: { name: 'Jaipur, Rajasthan', lat: 26.9124, lng: 75.7873 },
  ahmedabad: { name: 'Ahmedabad, Gujarat', lat: 23.0225, lng: 72.5714 },
  kolkata: { name: 'Kolkata, West Bengal', lat: 22.5726, lng: 88.3639 },
};

export const NativeLocationService = {
  /**
   * Request Android runtime location permissions
   */
  async requestPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      const fineGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      if (fineGranted) return true;

      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);

      return (
        granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED ||
        granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED
      );
    } catch {
      return false;
    }
  },

  /**
   * Fetch live hardware GPS location from Android device
   */
  async getCurrentLocation(): Promise<LocationResult> {
    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      throw new Error('Location permission denied. Please enable GPS permissions in settings.');
    }

    // 1. Try NativeLocation Android Bridge
    const { NativeLocation } = NativeModules;
    if (NativeLocation && typeof NativeLocation.getCurrentPosition === 'function') {
      try {
        const raw: any = await NativeLocation.getCurrentPosition();
        let displayName = raw.displayName;

        if (!displayName && raw.latitude && raw.longitude) {
          displayName = await this.reverseGeocode(raw.latitude, raw.longitude);
        }

        return {
          latitude: raw.latitude,
          longitude: raw.longitude,
          accuracy: raw.accuracy,
          displayName: displayName || `GPS (${raw.latitude.toFixed(2)}°, ${raw.longitude.toFixed(2)}°)`,
          locality: raw.locality,
        };
      } catch (err: any) {
        // Native threw (e.g. GPS off or timeout) - continue to fallbacks
        if (err?.code === 'DISABLED') {
          throw new Error('Device GPS is turned off. Please turn on Location in quick settings.');
        }
      }
    }

    // 2. Try HTML5 Geolocation (browser, WebView, or polyfilled)
    const geo = (globalThis as any).navigator?.geolocation;
    if (geo && typeof geo.getCurrentPosition === 'function') {
      try {
        const pos: any = await new Promise((resolve, reject) => {
          geo.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 6000,
            maximumAge: 10000,
          });
        });

        if (pos?.coords) {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const displayName = await this.reverseGeocode(lat, lng);
          return {
            latitude: lat,
            longitude: lng,
            accuracy: pos.coords.accuracy,
            displayName: displayName || `GPS (${lat.toFixed(2)}°, ${lng.toFixed(2)}°)`,
          };
        }
      } catch {
        // Continue to fallback
      }
    }

    throw new Error('Could not acquire live GPS fix. Please turn on Location or select your city below.');
  },

  /**
   * Reverse geocode coordinates to human-readable address
   */
  async reverseGeocode(lat: number, lng: number): Promise<string> {
    // Quick check if near known Indian cities
    for (const city of Object.values(KNOWN_CITIES)) {
      const dLat = Math.abs(lat - city.lat);
      const dLng = Math.abs(lng - city.lng);
      if (dLat < 0.12 && dLng < 0.12) {
        return city.name;
      }
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        {
          headers: { 'User-Agent': 'PadzyraApp/1.0' },
          signal: controller.signal,
        }
      );
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const area = addr.suburb || addr.neighbourhood || addr.road || '';
        const city = addr.city || addr.town || addr.village || addr.county || '';
        const label = [area, city].filter(Boolean).join(', ');
        if (label) return label;
        if (data.display_name) {
          return data.display_name.split(',').slice(0, 2).join(',').trim();
        }
      }
    } catch {
      // ignore
    }

    return `Location (${lat.toFixed(2)}°, ${lng.toFixed(2)}°)`;
  },

  /**
   * Geocode a search query (e.g. "Indore", "Palasia Indore", "MG Road")
   */
  async geocodeQuery(query: string): Promise<LocationResult | null> {
    if (!query || !query.trim()) return null;
    const clean = query.trim().toLowerCase();

    // 1. Direct local matching
    for (const [key, val] of Object.entries(KNOWN_CITIES)) {
      if (clean === key || clean.includes(key) || key.includes(clean)) {
        return {
          latitude: val.lat,
          longitude: val.lng,
          displayName: val.name,
        };
      }
    }

    // 2. Remote Nominatim Geocoding
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        {
          headers: { 'User-Agent': 'PadzyraApp/1.0' },
          signal: controller.signal,
        }
      );
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          if (!isNaN(lat) && !isNaN(lng)) {
            const shortName = data[0].display_name.split(',').slice(0, 2).join(',').trim();
            return {
              latitude: lat,
              longitude: lng,
              displayName: shortName,
            };
          }
        }
      }
    } catch {
      // ignore
    }

    return null;
  },
};
