import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  PermissionsAndroid,
  Modal,
  TextInput,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme/colors';
import { Card } from '../components/Card';
import { PadzyraApi } from '../api/client';
import { PeriodStoreSection, EssentialItem } from '../components/PeriodStoreSection';
import { NativeLocationService } from '../services/nativeLocation';

interface NowScreenProps {
  onOrderSuccess: () => void;
  onNavigateToEmergency?: () => void;
}

export const NowScreen: React.FC<NowScreenProps> = ({
  onOrderSuccess,
  onNavigateToEmergency,
}) => {
  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState<any[]>([]);
  const [orderSent, setOrderSent] = useState<any | null>(null);

  // Top level screen toggle: 'store' (Period Care Store) vs 'locator' (Pharmacy Locator)
  const [mainView, setMainView] = useState<'store' | 'locator'>('store');

  // GPS Location states
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [locationLabel, setLocationLabel] = useState<string>('Detecting location...');

  // Search & Filter states
  const [activeFilter, setActiveFilter] = useState<'nearby' | 'saved'>('nearby');
  const [areaSearch, setAreaSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<'all' | 'close' | 'open'>('all');

  // Shop Code input
  const [shopCodeInput, setShopCodeInput] = useState('');
  const [isSavingCode, setIsSavingCode] = useState(false);
  const [showCodeBox, setShowCodeBox] = useState(false);

  // Emergency Order Customization Modal (Store & Locator)
  const [selectedShop, setSelectedShop] = useState<any | null>(null);
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [orderKind, setOrderKind] = useState<string>('day');
  const [orderSize, setOrderSize] = useState<string>('regular');
  const [orderQty, setOrderQty] = useState<number>(2);
  const [orderNote, setOrderNote] = useState<string>('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Period Essentials Store Checkout Modal
  const [storeModalVisible, setStoreModalVisible] = useState(false);
  const [selectedItemForOrder, setSelectedItemForOrder] = useState<EssentialItem | null>(null);
  const [selectedItemVariant, setSelectedItemVariant] = useState<string | undefined>(undefined);
  const [selectedItemQty, setSelectedItemQty] = useState<number>(1);
  const [storeOrderShop, setStoreOrderShop] = useState<any | null>(null);

  const loadShopsForLocation = useCallback(async (lat?: number, lng?: number) => {
    setLoading(true);
    try {
      if (activeFilter === 'saved') {
        const data = await PadzyraApi.getSavedShops();
        setShops(data || []);
      } else {
        const queryLat = lat ?? userLocation?.lat ?? 12.9716;
        const queryLng = lng ?? userLocation?.lng ?? 77.5946;
        const data = await PadzyraApi.getNearbyShops(queryLat, queryLng);
        setShops(data || []);
      }
    } catch {
      setShops([]);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, userLocation]);

  const requestGpsLocation = useCallback(async () => {
    setGpsLoading(true);
    try {
      const loc = await NativeLocationService.getCurrentLocation();
      setUserLocation({ lat: loc.latitude, lng: loc.longitude });
      const display = loc.displayName
        ? `📍 ${loc.displayName}`
        : `📍 GPS (${loc.latitude.toFixed(2)}°, ${loc.longitude.toFixed(2)}°)`;
      setLocationLabel(display);
      loadShopsForLocation(loc.latitude, loc.longitude);
    } catch (err: any) {
      setLocationLabel('📍 GPS Off (Search area below)');
      Alert.alert(
        'Location Required',
        err?.message || 'Could not fetch device GPS. Please enable Location in your device settings, or search your area name below.'
      );
    } finally {
      setGpsLoading(false);
    }
  }, [loadShopsForLocation]);

  useEffect(() => {
    requestGpsLocation();
  }, [requestGpsLocation]);

  const handleAreaSearch = async () => {
    if (!areaSearch.trim()) {
      loadShopsForLocation();
      return;
    }
    setIsSearching(true);
    try {
      const results = await PadzyraApi.searchShops({ area: areaSearch.trim() });
      setShops(results || []);
    } catch (err: any) {
      Alert.alert('Search Notice', err?.message || 'Could not find partner pharmacies in this area');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveShopCode = async () => {
    const code = shopCodeInput.trim().toUpperCase();
    if (!code) {
      Alert.alert('Required', 'Please enter a 12-character pharmacy code');
      return;
    }
    setIsSavingCode(true);
    try {
      const saved = await PadzyraApi.saveShopByCode(code);
      setShopCodeInput('');
      setShowCodeBox(false);
      Alert.alert('Pharmacy Saved', `${saved.name || 'Store'} has been added to your saved list.`);
      if (activeFilter === 'saved') loadShopsForLocation();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Invalid or unknown partner pharmacy code');
    } finally {
      setIsSavingCode(false);
    }
  };

  const handleToggleSaveShop = async (shop: any) => {
    try {
      if (shop.saved || activeFilter === 'saved') {
        await PadzyraApi.removeSavedShop(shop.id);
        Alert.alert('Removed', `${shop.name} removed from saved list.`);
      } else if (shop.code) {
        await PadzyraApi.saveShopByCode(shop.code);
        Alert.alert('Saved', `${shop.name} added to your saved list.`);
      }
      loadShopsForLocation();
    } catch (err: any) {
      Alert.alert('Notice', err?.message || 'Could not update saved status');
    }
  };

  const openOrderModal = (shop: any) => {
    setSelectedShop(shop);
    setOrderModalVisible(true);
  };

  const handleConfirmOrder = async () => {
    if (!selectedShop) return;
    setSubmittingOrder(true);
    try {
      const order = await PadzyraApi.createOrder(selectedShop.id, orderQty, {
        kind: orderKind,
        size: orderSize,
        address: orderNote.trim() || undefined,
      });

      const isPad = orderKind === 'day' || orderKind === 'night';
      const formattedName = isPad
        ? `${orderQty}x ${orderKind === 'day' ? 'Day' : 'Night'} Pads (${orderSize.toUpperCase()})`
        : `${orderQty}x ${orderKind} (${orderSize})`;

      setOrderSent({
        ...order,
        productName: formattedName,
        shopName: selectedShop.name,
        shopAddress: selectedShop.address,
        shopPhone: selectedShop.phone,
        shopLat: selectedShop.lat,
        shopLng: selectedShop.lng,
        qty: orderQty,
        kind: orderKind,
        size: orderSize,
      });
      setOrderModalVisible(false);
      setOrderNote('');
    } catch (err: any) {
      Alert.alert('Order Notice', err?.message || 'Could not dispatch emergency pickup request');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleOpenStoreOrder = (item: EssentialItem, variant?: string, qty: number = 1) => {
    setSelectedItemForOrder(item);
    setSelectedItemVariant(variant);
    setSelectedItemQty(qty);
    const defaultShop = shops.length > 0 ? shops[0] : null;
    setStoreOrderShop(defaultShop);
    setStoreModalVisible(true);
  };

  const handleConfirmStoreOrder = async () => {
    if (!selectedItemForOrder) return;
    const targetShop = storeOrderShop || (shops.length > 0 ? shops[0] : {
      id: 'shop-central',
      name: 'Padzyra Partner Pharmacy',
      address: 'Express Discreet Pickup Counter',
      phone: '+91 98765 43210',
    });

    setSubmittingOrder(true);
    try {
      const order = await PadzyraApi.createOrder(targetShop.id, selectedItemQty, {
        kind: selectedItemForOrder.name,
        size: selectedItemVariant || selectedItemForOrder.unit,
        address: orderNote.trim() || undefined,
      });

      setOrderSent({
        ...order,
        productName: `${selectedItemQty}x ${selectedItemForOrder.name}${selectedItemVariant ? ` (${selectedItemVariant})` : ''}`,
        productEmoji: selectedItemForOrder.emoji,
        productPrice: selectedItemForOrder.price * selectedItemQty,
        shopName: targetShop.name,
        shopAddress: targetShop.address,
        shopPhone: targetShop.phone,
        shopLat: targetShop.lat,
        shopLng: targetShop.lng,
        qty: selectedItemQty,
        kind: selectedItemForOrder.category,
        size: selectedItemVariant || selectedItemForOrder.unit,
      });
      setStoreModalVisible(false);
      setOrderNote('');
    } catch (err: any) {
      Alert.alert('Order Notice', err?.message || 'Could not dispatch order to counter');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const openDirectionsInMaps = (shop: any) => {
    const lat = shop.lat || shop.shopLat;
    const lng = shop.lng || shop.shopLng;
    const label = encodeURIComponent(shop.name || shop.shopName || 'Pharmacy');
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${label})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
    Linking.openURL(url!).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    });
  };

  const filteredShops = shops.filter((s) => {
    if (selectedQuickFilter === 'close') {
      const distance = s.km ?? (s.distanceMeters ? s.distanceMeters / 1000 : 99);
      return distance <= 1.2;
    }
    return true;
  });

  // ==========================================
  // DIGITAL PICKUP PASS (SUCCESS VIEW)
  // ==========================================
  if (orderSent) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Pass Header */}
        <View style={styles.passHeader}>
          <View style={styles.passSecurityPill}>
            <Ionicons name="shield-checkmark" size={14} color={colors.success} style={{ marginRight: 6 }} />
            <Text style={styles.passSecurityText}>CONFIDENTIAL COUNTER PICKUP</Text>
          </View>
          <Text style={styles.passTitle}>Digital Pickup Pass</Text>
          <Text style={styles.passSubtitle}>
            Your request has been dispatched. Simply show this counter code to the pharmacist.
          </Text>
        </View>

        {/* Boarding Pass Ticket */}
        <View style={styles.ticketCard}>
          {/* Top Token Segment */}
          <View style={styles.ticketTop}>
            <View style={styles.ticketCodeHeader}>
              <Text style={styles.ticketCodeLabel}>DISCREET COUNTER CODE</Text>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={() => {
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2500);
                }}
              >
                <Ionicons
                  name={copiedCode ? 'checkmark' : 'copy-outline'}
                  size={14}
                  color={copiedCode ? colors.success : colors.plum}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.copyBtnText, copiedCode && { color: colors.success }]}>
                  {copiedCode ? 'Copied' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.ticketBigCode}>
              #{orderSent.orderNumber || 'PZ-EMG'}
            </Text>

            <View style={styles.statusPillRow}>
              <View style={styles.liveIndicatorDot} />
              <Text style={styles.statusPillText}>DISPATCHED · READY IN ~5 MINS</Text>
            </View>
          </View>

          {/* Perforated Divider */}
          <View style={styles.perforatedLine}>
            <View style={styles.notchLeft} />
            <View style={styles.dashedLine} />
            <View style={styles.notchRight} />
          </View>

          {/* Ticket Body: Order & Pharmacy Details */}
          <View style={styles.ticketBottom}>
            {/* Timeline Progress */}
            <View style={styles.progressContainer}>
              <View style={styles.progressStep}>
                <View style={[styles.progressCircle, styles.progressCircleDone]}>
                  <Ionicons name="checkmark" size={12} color={colors.white} />
                </View>
                <Text style={styles.progressTextActive}>Dispatched</Text>
              </View>
              <View style={styles.progressTrackActive} />
              <View style={styles.progressStep}>
                <View style={[styles.progressCircle, styles.progressCircleActive]}>
                  <ActivityIndicator size="small" color={colors.white} style={{ transform: [{ scale: 0.6 }] }} />
                </View>
                <Text style={styles.progressTextActive}>Packaging</Text>
              </View>
              <View style={styles.progressTrack} />
              <View style={styles.progressStep}>
                <View style={styles.progressCircle}>
                  <Text style={styles.progressStepNum}>3</Text>
                </View>
                <Text style={styles.progressText}>Counter Ready</Text>
              </View>
            </View>

            {/* Item summary */}
            <View style={styles.passDetailsBox}>
              <View style={styles.passDetailRow}>
                <Text style={styles.passDetailLabel}>Package Details</Text>
                <Text style={[styles.passDetailValue, { maxWidth: '65%', textAlign: 'right' }]}>
                  {orderSent.productName
                    ? orderSent.productName
                    : `${orderSent.qty}x ${orderSent.kind === 'day' ? 'Day' : orderSent.kind === 'night' ? 'Night' : orderSent.kind} Pads (${orderSent.size?.toUpperCase()})`}
                </Text>
              </View>
              {orderSent.productPrice != null && (
                <View style={styles.passDetailRow}>
                  <Text style={styles.passDetailLabel}>Total Price</Text>
                  <Text style={[styles.passDetailValue, { color: colors.plum, fontWeight: '900' }]}>
                    ₹{orderSent.productPrice}
                  </Text>
                </View>
              )}
              <View style={styles.passDetailRow}>
                <Text style={styles.passDetailLabel}>Packaging</Text>
                <Text style={styles.passDetailValue}>Opaque sealed paper pouch</Text>
              </View>
              <View style={[styles.passDetailRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                <Text style={styles.passDetailLabel}>Partner Pharmacy</Text>
                <Text style={[styles.passDetailValue, { color: colors.plum, fontWeight: '800' }]}>
                  {orderSent.shopName}
                </Text>
              </View>
              <Text style={styles.pharmacyAddressText}>{orderSent.shopAddress}</Text>
            </View>

            {/* Counter instructions notice */}
            <View style={styles.instructionsBanner}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.plum} style={{ marginRight: 8, marginTop: 2 }} />
              <Text style={styles.instructionsText}>
                No medical questions will be asked. Just say "Padzyra pickup #{orderSent.orderNumber}" or flash this screen.
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.passActions}>
          {orderSent.shopLat && orderSent.shopLng ? (
            <TouchableOpacity
              style={styles.passPrimaryBtn}
              onPress={() => openDirectionsInMaps(orderSent)}
              activeOpacity={0.85}
            >
              <Ionicons name="navigate" size={18} color={colors.white} style={{ marginRight: 8 }} />
              <Text style={styles.passPrimaryBtnText}>Start Walking Directions</Text>
            </TouchableOpacity>
          ) : null}

          {orderSent.shopPhone ? (
            <TouchableOpacity
              style={styles.passSecondaryBtn}
              onPress={() => Linking.openURL(`tel:${orderSent.shopPhone}`)}
              activeOpacity={0.7}
            >
              <Ionicons name="call-outline" size={16} color={colors.plum} style={{ marginRight: 6 }} />
              <Text style={styles.passSecondaryBtnText}>Call Pharmacy Counter</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.passGhostBtn}
            onPress={() => {
              setOrderSent(null);
              onOrderSuccess();
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="time-outline" size={16} color={colors.rose} style={{ marginRight: 6 }} />
            <Text style={styles.passGhostBtnText}>View in Live Activity & Orders</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ==========================================
  // MAIN STORE LOCATOR VIEW
  // ==========================================
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Clean Top Header */}
      <View style={styles.topBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <Text style={styles.brandTitle}>Care & Essentials</Text>
          <View style={styles.discreetBadge}>
            <Ionicons name="shield-checkmark" size={12} color={colors.success} style={{ marginRight: 4 }} />
            <Text style={styles.discreetBadgeText}>Discreet</Text>
          </View>
        </View>
        <Text style={styles.brandSubtitle}>
          Period essentials, relief care & pharmacy pickup counters
        </Text>
      </View>

      {/* Emergency Period Mode Banner */}
      {onNavigateToEmergency && (
        <TouchableOpacity
          style={styles.emergencyBanner}
          activeOpacity={0.88}
          onPress={onNavigateToEmergency}
        >
          <View style={styles.emergencyBannerIcon}>
            <Ionicons name="alert-circle" size={20} color={colors.white} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.emergencyBannerTitle}>Emergency Care</Text>
              <View style={styles.emergencyBannerPill}>
                <Text style={styles.emergencyBannerPillText}>FAST ASSIST</Text>
              </View>
            </View>
            <Text style={styles.emergencyBannerSub}>
              Public clean restrooms, nearby pads & leak guidance
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#b91c1c" />
        </TouchableOpacity>
      )}

      {/* Main Mode Toggle: Period Care Store vs Pharmacy Locator */}
      <View style={styles.mainNavSegmentContainer}>
        <TouchableOpacity
          style={[styles.mainNavSegment, mainView === 'store' && styles.mainNavSegmentActive]}
          onPress={() => setMainView('store')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="bag-handle-outline"
            size={15}
            color={mainView === 'store' ? colors.white : colors.plum}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.mainNavSegmentText, mainView === 'store' && styles.mainNavSegmentTextActive]}>
            Care Store
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mainNavSegment, mainView === 'locator' && styles.mainNavSegmentActive]}
          onPress={() => setMainView('locator')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="location-outline"
            size={15}
            color={mainView === 'locator' ? colors.white : colors.plum}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.mainNavSegmentText, mainView === 'locator' && styles.mainNavSegmentTextActive]}>
            Counter Locator
          </Text>
        </TouchableOpacity>
      </View>

      {mainView === 'store' ? (
        <PeriodStoreSection
          onOrderItem={handleOpenStoreOrder}
          nearestShopName={shops[0]?.name}
        />
      ) : (
        <>
          {/* GPS Status Card */}
      <View style={styles.gpsCard}>
        <View style={styles.gpsLeft}>
          <View style={styles.gpsPulseDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.gpsStatusTitle}>Live Location</Text>
            <Text style={styles.gpsStatusCoords} numberOfLines={1}>
              {locationLabel}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.gpsRefreshBtn}
          onPress={requestGpsLocation}
          disabled={gpsLoading}
          activeOpacity={0.7}
        >
          {gpsLoading ? (
            <ActivityIndicator size="small" color={colors.plum} />
          ) : (
            <Ionicons name="locate-outline" size={16} color={colors.plum} />
          )}
          <Text style={styles.gpsRefreshBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented Filter: Nearby vs Saved */}
      <View style={styles.filterSegmentContainer}>
        <TouchableOpacity
          style={[styles.filterSegment, activeFilter === 'nearby' && styles.filterSegmentActive]}
          onPress={() => setActiveFilter('nearby')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="compass-outline"
            size={16}
            color={activeFilter === 'nearby' ? colors.white : colors.plum}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.filterSegmentText, activeFilter === 'nearby' && styles.filterSegmentTextActive]}>
            Nearby Pharmacies
          </Text>
          {shops.length > 0 && activeFilter === 'nearby' && (
            <View style={styles.countBadgeActive}>
              <Text style={styles.countBadgeTextActive}>{shops.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterSegment, activeFilter === 'saved' && styles.filterSegmentActive]}
          onPress={() => setActiveFilter('saved')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="bookmark-outline"
            size={16}
            color={activeFilter === 'saved' ? colors.white : colors.plum}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.filterSegmentText, activeFilter === 'saved' && styles.filterSegmentTextActive]}>
            Saved Stores
          </Text>
          {shops.length > 0 && activeFilter === 'saved' && (
            <View style={styles.countBadgeActive}>
              <Text style={styles.countBadgeTextActive}>{shops.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search Bar with Clear & Submit */}
      <View style={styles.searchBarContainer}>
        <Ionicons name="search" size={18} color={colors.rose} style={{ marginLeft: 14 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by area or landmark (e.g. Indiranagar)"
          placeholderTextColor={colors.rose}
          value={areaSearch}
          onChangeText={setAreaSearch}
          onSubmitEditing={handleAreaSearch}
          returnKeyType="search"
        />
        {areaSearch.length > 0 && (
          <TouchableOpacity
            style={styles.clearSearchBtn}
            onPress={() => {
              setAreaSearch('');
              loadShopsForLocation();
            }}
          >
            <Ionicons name="close-circle" size={16} color={colors.rose} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.searchActionBtn}
          onPress={handleAreaSearch}
          disabled={isSearching}
          activeOpacity={0.7}
        >
          {isSearching ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.searchActionText}>Find</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Quick Filter Pills */}
      <View style={styles.quickFilterRow}>
        <TouchableOpacity
          style={[styles.quickFilterChip, selectedQuickFilter === 'all' && styles.quickFilterChipActive]}
          onPress={() => setSelectedQuickFilter('all')}
        >
          <Text style={[styles.quickFilterText, selectedQuickFilter === 'all' && styles.quickFilterTextActive]}>
            All Partners
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickFilterChip, selectedQuickFilter === 'close' && styles.quickFilterChipActive]}
          onPress={() => setSelectedQuickFilter('close')}
        >
          <Ionicons
            name="walk-outline"
            size={13}
            color={selectedQuickFilter === 'close' ? colors.white : colors.plum}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.quickFilterText, selectedQuickFilter === 'close' && styles.quickFilterTextActive]}>
            Under 1 km
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickFilterCodeToggle, showCodeBox && styles.quickFilterCodeToggleActive]}
          onPress={() => setShowCodeBox(!showCodeBox)}
        >
          <Ionicons
            name={showCodeBox ? 'close' : 'keypad-outline'}
            size={13}
            color={colors.plum}
            style={{ marginRight: 4 }}
          />
          <Text style={styles.quickFilterCodeToggleText}>
            {showCodeBox ? 'Close Code' : '+ Add Code'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Save Partner Pharmacy by Code Card */}
      {showCodeBox && (
        <Card style={styles.codeCard}>
          <View style={styles.codeHeader}>
            <View style={styles.codeHeaderIconWrap}>
              <Ionicons name="keypad" size={16} color={colors.plum} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.codeTitle}>Save Pharmacy by Partner Code</Text>
              <Text style={styles.codeSubtitle}>
                Look for the 12-digit code displayed at the pharmacy counter.
              </Text>
            </View>
          </View>

          <View style={styles.codeInputRow}>
            <TextInput
              style={styles.codeInput}
              placeholder="e.g. MED-7821-BLR"
              placeholderTextColor={colors.rose}
              value={shopCodeInput}
              onChangeText={setShopCodeInput}
              autoCapitalize="characters"
              maxLength={16}
            />
            <TouchableOpacity
              style={styles.codeSaveBtn}
              onPress={handleSaveShopCode}
              disabled={isSavingCode}
              activeOpacity={0.8}
            >
              {isSavingCode ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.codeSaveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </Card>
      )}

      {/* Partner Pharmacies List */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>
          {activeFilter === 'nearby' ? 'Pharmacies Near You' : 'Your Saved Pharmacies'}
        </Text>
        <Text style={styles.sectionSubtitle}>
          {filteredShops.length} {filteredShops.length === 1 ? 'store available' : 'stores available'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.plum} />
          <Text style={styles.loaderText}>Locating verified partner pharmacies...</Text>
        </View>
      ) : filteredShops.length === 0 ? (
        <Card style={styles.emptyCard}>
          <View style={styles.emptyIconBadge}>
            <Ionicons name="medkit-outline" size={36} color={colors.rose} />
          </View>
          <Text style={styles.emptyTitle}>
            {activeFilter === 'saved' ? 'No Saved Pharmacies Yet' : 'No Partner Stores In This Radius'}
          </Text>
          <Text style={styles.emptyDescription}>
            {activeFilter === 'saved'
              ? 'Save pharmacy codes displayed at partner counters for instant 1-tap emergency pickup.'
              : 'Try searching by an adjacent neighborhood name, or update your GPS above.'}
          </Text>
          <TouchableOpacity
            style={styles.emptyActionBtn}
            onPress={() => {
              setAreaSearch('');
              setSelectedQuickFilter('all');
              loadShopsForLocation();
            }}
          >
            <Text style={styles.emptyActionBtnText}>Reset Filters</Text>
          </TouchableOpacity>
        </Card>
      ) : (
        filteredShops.map((shop) => {
          const distanceKm = shop.km != null
            ? shop.km
            : shop.distanceMeters
            ? (shop.distanceMeters / 1000).toFixed(1)
            : null;
          const walkingMins = distanceKm ? Math.max(3, Math.round(Number(distanceKm) * 12)) : null;

          return (
            <Card key={shop.id} style={styles.pharmacyCard}>
              {/* Card Top: Verified Badge & Favorite Icon */}
              <View style={styles.pharmacyHeaderRow}>
                <View style={styles.pharmacyTitleBlock}>
                  <View style={styles.verifiedBadgeRow}>
                    <Ionicons name="shield-checkmark" size={13} color={colors.success} style={{ marginRight: 4 }} />
                    <Text style={styles.verifiedText}>VERIFIED PARTNER</Text>
                  </View>
                  <Text style={styles.pharmacyName}>{shop.name}</Text>
                </View>

                <TouchableOpacity
                  style={styles.bookmarkBtn}
                  onPress={() => handleToggleSaveShop(shop)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={shop.saved || activeFilter === 'saved' ? 'bookmark' : 'bookmark-outline'}
                    size={20}
                    color={shop.saved || activeFilter === 'saved' ? colors.plum : colors.rose}
                  />
                </TouchableOpacity>
              </View>

              {/* Distance & Time Pills */}
              <View style={styles.metaPillsRow}>
                {distanceKm && (
                  <View style={styles.distancePill}>
                    <Ionicons name="walk" size={12} color={colors.plum} style={{ marginRight: 4 }} />
                    <Text style={styles.distancePillText}>
                      {distanceKm} km · ~{walkingMins} min walk
                    </Text>
                  </View>
                )}
                <View style={styles.hoursPill}>
                  <View style={styles.hoursDot} />
                  <Text style={styles.hoursPillText}>
                    {shop.opensAt && shop.closesAt ? `${shop.opensAt} - ${shop.closesAt}` : 'Open Now'}
                  </Text>
                </View>
              </View>

              {/* Address Row */}
              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={15} color={colors.rose} style={styles.addressIcon} />
                <Text style={styles.addressText} numberOfLines={2}>
                  {shop.address}
                </Text>
              </View>

              {/* Discreet Stock Assurance Banner */}
              <View style={styles.assuranceBanner}>
                <Ionicons name="cube-outline" size={13} color={colors.plum} style={{ marginRight: 5 }} />
                <Text style={styles.assuranceText}>
                  Day & Night Pads In Stock · Sealed Kraft Pouch Ready
                </Text>
              </View>

              {/* Action Buttons Row */}
              <View style={styles.cardActionsContainer}>
                {shop.lat && shop.lng && (
                  <TouchableOpacity
                    style={styles.secondaryActionBtn}
                    onPress={() => openDirectionsInMaps(shop)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="navigate-outline" size={15} color={colors.plum} style={{ marginRight: 4 }} />
                    <Text style={styles.secondaryActionBtnText}>Directions</Text>
                  </TouchableOpacity>
                )}

                {shop.phone && (
                  <TouchableOpacity
                    style={styles.iconCircleBtn}
                    onPress={() => Linking.openURL(`tel:${shop.phone}`)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="call-outline" size={16} color={colors.plum} />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.primaryOrderBtn}
                  onPress={() => openOrderModal(shop)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="flash" size={15} color={colors.white} style={{ marginRight: 6 }} />
                  <Text style={styles.primaryOrderBtnText}>Discreet Pickup</Text>
                </TouchableOpacity>
              </View>
            </Card>
          );
        })
      )}
        </>
      )}

      {/* ========================================== */}
      {/* PERIOD ESSENTIALS STORE CHECKOUT MODAL     */}
      {/* ========================================== */}
      <Modal visible={storeModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalDragBar} />

            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.modalKickerRow}>
                  <Ionicons name="sparkles" size={12} color={colors.plum} style={{ marginRight: 4 }} />
                  <Text style={styles.modalKicker}>EXPRESS PERIOD ESSENTIAL</Text>
                </View>
                <Text style={styles.modalStoreName}>
                  {selectedItemForOrder?.name}
                </Text>
                <Text style={styles.modalStoreAddress} numberOfLines={1}>
                  {selectedItemForOrder?.tagline}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setStoreModalVisible(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={colors.plum} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBodyScroll}>
              {/* Product preview box */}
              <View style={styles.storePreviewCard}>
                <View style={[styles.storePreviewIconBox, { backgroundColor: `${selectedItemForOrder?.badgeColor || colors.plum}15` }]}>
                  <Ionicons
                    name={((selectedItemForOrder as any)?.icon || 'shield-outline') as any}
                    size={28}
                    color={selectedItemForOrder?.badgeColor || colors.plum}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.storePreviewTitle}>{selectedItemForOrder?.name}</Text>
                  <Text style={styles.storePreviewUnit}>{selectedItemForOrder?.unit}</Text>
                  <Text style={styles.storePreviewPrice}>
                    ₹{(selectedItemForOrder?.price || 0) * selectedItemQty}
                  </Text>
                </View>
              </View>

              {/* Variant / Size Selector (if available) */}
              {selectedItemForOrder?.sizes && selectedItemForOrder.sizes.length > 0 && (
                <View style={{ marginTop: 14 }}>
                  <Text style={styles.modalSectionHeading}>SELECT SIZE / OPTION</Text>
                  <View style={styles.pillSelectorRow}>
                    {selectedItemForOrder?.sizes?.map((sz) => {
                      const isSel = selectedItemVariant === sz;
                      return (
                        <TouchableOpacity
                          key={sz}
                          style={[styles.sizePill, isSel && styles.sizePillSelected]}
                          onPress={() => setSelectedItemVariant(sz)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.sizePillText, isSel && styles.sizePillTextSelected]}>
                            {sz}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Quantity Selector */}
              <Text style={[styles.modalSectionHeading, { marginTop: 16 }]}>QUANTITY</Text>
              <View style={styles.pillSelectorRow}>
                {[1, 2, 3].map((q) => {
                  const isSel = selectedItemQty === q;
                  return (
                    <TouchableOpacity
                      key={q}
                      style={[styles.qtyCard, isSel && styles.qtyCardSelected]}
                      onPress={() => setSelectedItemQty(q)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.qtyNum, isSel && styles.qtyNumSelected]}>
                        {q} {q === 1 ? 'Pack' : 'Packs'}
                      </Text>
                      <Text style={[styles.qtyDesc, isSel && styles.qtyDescSelected]}>
                        ₹{(selectedItemForOrder?.price || 0) * q}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Pickup Counter selection */}
              <Text style={[styles.modalSectionHeading, { marginTop: 16 }]}>
                DISCREET PICKUP COUNTER
              </Text>
              {shops.length > 0 ? (
                <View style={styles.storePickersWrap}>
                  {shops.slice(0, 3).map((sh) => {
                    const isShopSel = (storeOrderShop?.id || shops[0]?.id) === sh.id;
                    return (
                      <TouchableOpacity
                        key={sh.id}
                        style={[styles.shopChoiceCard, isShopSel && styles.shopChoiceCardSelected]}
                        onPress={() => setStoreOrderShop(sh)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={isShopSel ? 'radio-button-on' : 'radio-button-off'}
                          size={16}
                          color={isShopSel ? colors.plum : colors.rose}
                          style={{ marginRight: 8 }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.shopChoiceName, isShopSel && styles.shopChoiceNameSelected]}>
                            {sh.name}
                          </Text>
                          <Text style={styles.shopChoiceAddress} numberOfLines={1}>
                            {sh.address}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.noticeFallbackBox}>
                  <Text style={styles.noticeFallbackText}>
                    Verified partner pharmacy counter assigned automatically upon confirmation.
                  </Text>
                </View>
              )}

              {/* Confidential packaging notice */}
              <View style={[styles.packagingGuaranteeBox, { marginTop: 16 }]}>
                <Ionicons name="shield-checkmark" size={18} color={colors.success} style={{ marginRight: 10, marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.guaranteeTitle}>Discreet Packaging Guarantee</Text>
                  <Text style={styles.guaranteeText}>
                    Packaged in an unmarked, opaque sealed kraft paper bag. The counter will only check your secret 4-digit code.
                  </Text>
                </View>
              </View>

              {/* Counter Instruction Note */}
              <Text style={[styles.modalSectionHeading, { marginTop: 16 }]}>
                COUNTER INSTRUCTION (OPTIONAL)
              </Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="e.g. Double bag, picking up in 10 mins"
                placeholderTextColor={colors.rose}
                value={orderNote}
                onChangeText={setOrderNote}
                maxLength={80}
              />

              {/* Submit / Confirm */}
              <View style={styles.modalSubmitContainer}>
                <View style={styles.modalSummaryRow}>
                  <Text style={styles.modalSummaryText}>
                    Total Amount:{' '}
                    <Text style={{ fontWeight: '900', color: colors.plum }}>
                      ₹{(selectedItemForOrder?.price || 0) * selectedItemQty}
                    </Text>
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={handleConfirmStoreOrder}
                  disabled={submittingOrder}
                  activeOpacity={0.85}
                >
                  {submittingOrder ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color={colors.white} style={{ marginRight: 8 }} />
                      <Text style={styles.modalConfirmBtnText}>
                        Order for Counter Pickup · ₹{(selectedItemForOrder?.price || 0) * selectedItemQty}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================== */}
      {/* EMERGENCY ORDER CUSTOMIZATION MODAL        */}
      {/* ========================================== */}
      <Modal visible={orderModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {/* Drag Bar */}
            <View style={styles.modalDragBar} />

            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.modalKickerRow}>
                  <Ionicons name="flash" size={12} color={colors.plum} style={{ marginRight: 4 }} />
                  <Text style={styles.modalKicker}>EMERGENCY COUNTER REQUEST</Text>
                </View>
                <Text style={styles.modalStoreName}>{selectedShop?.name}</Text>
                <Text style={styles.modalStoreAddress} numberOfLines={1}>
                  {selectedShop?.address}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setOrderModalVisible(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={colors.plum} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBodyScroll}>
              {/* Step 1: Pad or Other Essential Item Selection */}
              <Text style={styles.modalSectionHeading}>1. SELECT EMERGENCY ITEM</Text>
              <View style={styles.typeSelectionGrid}>
                <TouchableOpacity
                  style={[styles.typeCard, orderKind === 'day' && styles.typeCardSelected]}
                  onPress={() => {
                    setOrderKind('day');
                    setOrderSize('regular');
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.typeCardHeader}>
                    <View style={[styles.typeIconBadge, orderKind === 'day' && styles.typeIconBadgeSelected]}>
                      <Ionicons
                        name="sunny"
                        size={18}
                        color={orderKind === 'day' ? colors.white : colors.plum}
                      />
                    </View>
                    {orderKind === 'day' && (
                      <Ionicons name="checkmark-circle" size={18} color={colors.plum} />
                    )}
                  </View>
                  <Text style={[styles.typeTitle, orderKind === 'day' && styles.typeTitleSelected]}>
                    Day Pad
                  </Text>
                  <Text style={styles.typeSubtitle}>Light & active, ultra-thin wings, discreet fit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.typeCard, orderKind === 'night' && styles.typeCardSelected]}
                  onPress={() => {
                    setOrderKind('night');
                    setOrderSize('night');
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.typeCardHeader}>
                    <View style={[styles.typeIconBadge, orderKind === 'night' && styles.typeIconBadgeSelected]}>
                      <Ionicons
                        name="moon"
                        size={18}
                        color={orderKind === 'night' ? colors.white : colors.plum}
                      />
                    </View>
                    {orderKind === 'night' && (
                      <Ionicons name="checkmark-circle" size={18} color={colors.plum} />
                    )}
                  </View>
                  <Text style={[styles.typeTitle, orderKind === 'night' && styles.typeTitleSelected]}>
                    Night Pad
                  </Text>
                  <Text style={styles.typeSubtitle}>Extra length, maximum absorbency protection</Text>
                </TouchableOpacity>
              </View>

              {/* Other Period Things Quick Selector */}
              <Text style={[styles.modalSectionHeading, { marginTop: 14 }]}>
                OR OTHER PERIOD ESSENTIALS
              </Text>
              <View style={styles.otherItemsRow}>
                {[
                  { id: '70% Dark Belgian Chocolate Bar', label: '🍫 Dark Chocolate', size: '80g Bar' },
                  { id: 'Plush Velvet Hot Water Bag', label: '♨️ Hot Water Bag', size: '2 Litre Bag' },
                  { id: 'Medical-Grade Silicone Menstrual Cup', label: '🩸 Menstrual Cup', size: 'Medium' },
                  { id: 'Ayurvedic Cramp Relief Roll-On', label: '🌿 Cramp Roll-On', size: '10ml Roll-On' },
                  { id: 'Complete SOS Period Comfort Box', label: '🎁 SOS Comfort Box', size: 'Full Rescue Box' },
                ].map((item) => {
                  const isSel = orderKind === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.otherItemChip, isSel && styles.otherItemChipSelected]}
                      onPress={() => {
                        setOrderKind(item.id);
                        setOrderSize(item.size);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.otherItemChipText, isSel && styles.otherItemChipTextSelected]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Step 2: Pad Size / Option */}
              <Text style={[styles.modalSectionHeading, { marginTop: 16 }]}>2. SIZE / OPTION</Text>
              <View style={styles.pillSelectorRow}>
                {(orderKind === 'day' || orderKind === 'night'
                  ? ['regular', 'xl', 'night']
                  : orderKind === 'Medical-Grade Silicone Menstrual Cup'
                  ? ['Small', 'Medium', 'Large']
                  : [orderSize]
                ).map((sz) => {
                  const isSelected = orderSize === sz;
                  const label =
                    sz === 'regular'
                      ? 'Regular (240mm)'
                      : sz === 'xl'
                      ? 'XL (280mm)'
                      : sz === 'night'
                      ? 'XXL (320mm)'
                      : sz;
                  return (
                    <TouchableOpacity
                      key={sz}
                      style={[styles.sizePill, isSelected && styles.sizePillSelected]}
                      onPress={() => setOrderSize(sz)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.sizePillText, isSelected && styles.sizePillTextSelected]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Step 3: Quantity */}
              <Text style={[styles.modalSectionHeading, { marginTop: 16 }]}>3. QUANTITY</Text>
              <View style={styles.pillSelectorRow}>
                {[1, 2, 4].map((qty) => {
                  const isSelected = orderQty === qty;
                  const desc = qty === 1 ? 'Quick Relief' : qty === 2 ? 'Recommended' : 'Supply Pack';
                  return (
                    <TouchableOpacity
                      key={qty}
                      style={[styles.qtyCard, isSelected && styles.qtyCardSelected]}
                      onPress={() => setOrderQty(qty)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.qtyNum, isSelected && styles.qtyNumSelected]}>
                        {qty} {qty === 1 ? 'Pad' : 'Pads'}
                      </Text>
                      <Text style={[styles.qtyDesc, isSelected && styles.qtyDescSelected]}>
                        {desc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Confidential Packaging Guarantee Card */}
              <View style={styles.packagingGuaranteeBox}>
                <Ionicons name="shield-checkmark" size={18} color={colors.success} style={{ marginRight: 10, marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.guaranteeTitle}>Discreet Packaging Guarantee</Text>
                  <Text style={styles.guaranteeText}>
                    Packaged in an unmarked, opaque kraft paper bag. The counter will only refer to your 4-digit code.
                  </Text>
                </View>
              </View>

              {/* Step 4: Optional Note for Counter */}
              <Text style={[styles.modalSectionHeading, { marginTop: 16 }]}>
                4. COUNTER INSTRUCTION (OPTIONAL)
              </Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="e.g. Double wrap in brown bag, picking up in 5 mins"
                placeholderTextColor={colors.rose}
                value={orderNote}
                onChangeText={setOrderNote}
                maxLength={80}
              />

              {/* Quick suggestion tags */}
              <View style={styles.quickNoteTagsRow}>
                {['Double paper bag', 'Arriving in 5 mins', 'Keep at front desk'].map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={styles.quickNoteTag}
                    onPress={() => setOrderNote(tag)}
                  >
                    <Text style={styles.quickNoteTagText}>+ {tag}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Order Summary & Submit Button */}
              <View style={styles.modalSubmitContainer}>
                <View style={styles.modalSummaryRow}>
                  <Text style={styles.modalSummaryText}>
                    Requesting:{' '}
                    <Text style={{ fontWeight: '800', color: colors.plum }}>
                      {orderQty}x{' '}
                      {orderKind === 'day'
                        ? 'Day Pads'
                        : orderKind === 'night'
                        ? 'Night Pads'
                        : orderKind}{' '}
                      ({orderSize.toUpperCase()})
                    </Text>
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={handleConfirmOrder}
                  disabled={submittingOrder}
                  activeOpacity={0.85}
                >
                  {submittingOrder ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color={colors.white} style={{ marginRight: 8 }} />
                      <Text style={styles.modalConfirmBtnText}>Send Emergency Request</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.blush,
  },
  content: {
    padding: 16,
    paddingTop: 18,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },

  // Brand Header
  topBar: {
    marginBottom: 14,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.plum,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  brandBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  discreetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(154, 112, 143, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  discreetBadgeText: {
    color: colors.rose,
    fontSize: 10,
    fontWeight: '700',
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  brandSubtitle: {
    fontSize: 13,
    color: colors.rose,
    lineHeight: 18,
    fontWeight: '500',
  },

  // GPS Card
  gpsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  gpsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  gpsPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
    marginRight: 10,
  },
  gpsStatusTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.rose,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gpsStatusCoords: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 1,
  },
  gpsRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(107, 61, 98, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  gpsRefreshBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.plum,
    marginLeft: 4,
  },

  // Segmented Tab
  filterSegmentContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
  },
  filterSegmentActive: {
    backgroundColor: colors.plum,
    shadowColor: colors.plum,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  filterSegmentText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.plum,
  },
  filterSegmentTextActive: {
    color: colors.white,
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: 6,
  },
  countBadgeTextActive: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
  },

  // Search Bar
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 10,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 10,
    fontSize: 13,
    color: colors.ink,
    fontWeight: '600',
  },
  clearSearchBtn: {
    padding: 6,
  },
  searchActionBtn: {
    backgroundColor: colors.plum,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  searchActionText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },

  // Quick Filters
  quickFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  quickFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  quickFilterChipActive: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
  },
  quickFilterText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.plum,
  },
  quickFilterTextActive: {
    color: colors.white,
  },
  quickFilterCodeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'dashed',
    marginLeft: 'auto',
  },
  quickFilterCodeToggleActive: {
    backgroundColor: '#faedf5',
    borderColor: colors.plum,
  },
  quickFilterCodeToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.plum,
  },

  // Code Card
  codeCard: {
    marginBottom: 14,
    backgroundColor: '#fef7fb',
    borderColor: '#eec7dd',
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  codeHeaderIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f5e0ee',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  codeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
  },
  codeSubtitle: {
    fontSize: 11,
    color: colors.rose,
    marginTop: 2,
  },
  codeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeInput: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  codeSaveBtn: {
    backgroundColor: colors.plum,
    paddingHorizontal: 18,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeSaveBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },

  // Section Header
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.rose,
    fontWeight: '600',
  },

  // Loader & Empty states
  loaderContainer: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  loaderText: {
    marginTop: 10,
    fontSize: 13,
    color: colors.rose,
    fontWeight: '600',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  emptyIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#faedf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyDescription: {
    fontSize: 12,
    color: colors.rose,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyActionBtn: {
    backgroundColor: colors.plum,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  emptyActionBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },

  // Pharmacy Card
  pharmacyCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  pharmacyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pharmacyTitleBlock: {
    flex: 1,
    marginRight: 8,
  },
  verifiedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.success,
    letterSpacing: 0.5,
  },
  pharmacyName: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.ink,
    lineHeight: 22,
  },
  bookmarkBtn: {
    padding: 4,
  },
  metaPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#faeef6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  distancePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.plum,
  },
  hoursPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f7f3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  hoursDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: 5,
  },
  hoursPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  addressIcon: {
    marginRight: 6,
    marginTop: 2,
  },
  addressText: {
    fontSize: 12,
    color: colors.rose,
    flex: 1,
    lineHeight: 17,
  },
  assuranceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7fc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f3ddeb',
    marginBottom: 12,
  },
  assuranceText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.plum,
    flex: 1,
  },
  cardActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(107, 61, 98, 0.08)',
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 10,
  },
  secondaryActionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.plum,
  },
  iconCircleBtn: {
    backgroundColor: 'rgba(107, 61, 98, 0.08)',
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryOrderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.plum,
    height: 38,
    borderRadius: 10,
    paddingHorizontal: 12,
    shadowColor: colors.plum,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  primaryOrderBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },

  // Modal Sheet
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(44, 24, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  modalDragBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5d0dc',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  modalKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  modalKicker: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.plum,
    letterSpacing: 0.8,
  },
  modalStoreName: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.ink,
  },
  modalStoreAddress: {
    fontSize: 12,
    color: colors.rose,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#faedf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  modalBodyScroll: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  modalSectionHeading: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.plum,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  typeSelectionGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  typeCard: {
    flex: 1,
    backgroundColor: '#fffdfd',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  typeCardSelected: {
    borderColor: colors.plum,
    backgroundColor: '#fcf2f8',
  },
  typeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#faedf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconBadgeSelected: {
    backgroundColor: colors.plum,
  },
  typeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 3,
  },
  typeTitleSelected: {
    color: colors.plum,
  },
  typeSubtitle: {
    fontSize: 11,
    color: colors.rose,
    lineHeight: 15,
  },

  // Pills Row
  pillSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sizePill: {
    flex: 1,
    backgroundColor: colors.white,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  sizePillSelected: {
    borderColor: colors.plum,
    backgroundColor: colors.plum,
  },
  sizePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
  },
  sizePillTextSelected: {
    color: colors.white,
    fontWeight: '800',
  },

  // Quantity Cards
  qtyCard: {
    flex: 1,
    backgroundColor: colors.white,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  qtyCardSelected: {
    borderColor: colors.plum,
    backgroundColor: '#fbf0f6',
  },
  qtyNum: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.ink,
    marginBottom: 2,
  },
  qtyNumSelected: {
    color: colors.plum,
  },
  qtyDesc: {
    fontSize: 10,
    color: colors.rose,
    fontWeight: '600',
  },
  qtyDescSelected: {
    color: colors.plum,
  },

  // Packaging guarantee
  packagingGuaranteeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f2f9f5',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#ccead7',
  },
  guaranteeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.success,
    marginBottom: 2,
  },
  guaranteeText: {
    fontSize: 11,
    color: '#38664b',
    lineHeight: 15,
  },

  // Note
  modalTextInput: {
    backgroundColor: '#fffdfd',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: colors.ink,
  },
  quickNoteTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  quickNoteTag: {
    backgroundColor: 'rgba(107, 61, 98, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quickNoteTagText: {
    fontSize: 11,
    color: colors.plum,
    fontWeight: '700',
  },

  // Modal Submit
  modalSubmitContainer: {
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginBottom: 20,
  },
  modalSummaryRow: {
    marginBottom: 10,
  },
  modalSummaryText: {
    fontSize: 13,
    color: colors.ink,
  },
  modalConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.plum,
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: colors.plum,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  modalConfirmBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
  },

  // ==========================================
  // DIGITAL PASS STYLES
  // ==========================================
  passHeader: {
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  passSecurityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e7f7ee',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  passSecurityText: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  passTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  passSubtitle: {
    fontSize: 13,
    color: colors.rose,
    textAlign: 'center',
    lineHeight: 18,
  },
  ticketCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eed8e6',
  },
  ticketTop: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#fef9fc',
  },
  ticketCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 6,
  },
  ticketCodeLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.rose,
    letterSpacing: 1,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(107, 61, 98, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.plum,
  },
  ticketBigCode: {
    fontSize: 34,
    fontWeight: '900',
    color: colors.plum,
    letterSpacing: 2,
    marginVertical: 4,
  },
  statusPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: 4,
  },
  liveIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.5,
  },

  // Perforation
  perforatedLine: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    height: 20,
    backgroundColor: colors.white,
  },
  notchLeft: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.blush,
    marginLeft: -10,
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderColor: '#e8cde0',
    borderStyle: 'dashed',
  },
  notchRight: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.blush,
    marginRight: -10,
  },

  ticketBottom: {
    padding: 20,
    paddingTop: 10,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  progressStep: {
    alignItems: 'center',
  },
  progressCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0e3ec',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  progressCircleDone: {
    backgroundColor: colors.success,
  },
  progressCircleActive: {
    backgroundColor: colors.plum,
  },
  progressStepNum: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.rose,
  },
  progressText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.rose,
  },
  progressTextActive: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.ink,
  },
  progressTrack: {
    flex: 1,
    height: 2,
    backgroundColor: '#f0e3ec',
    marginHorizontal: 4,
    marginBottom: 16,
  },
  progressTrackActive: {
    flex: 1,
    height: 2,
    backgroundColor: colors.plum,
    marginHorizontal: 4,
    marginBottom: 16,
  },

  passDetailsBox: {
    backgroundColor: '#faf3f8',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  passDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f2e3ee',
  },
  passDetailLabel: {
    fontSize: 12,
    color: colors.rose,
    fontWeight: '600',
  },
  passDetailValue: {
    fontSize: 12,
    color: colors.ink,
    fontWeight: '700',
  },
  pharmacyAddressText: {
    fontSize: 11,
    color: colors.rose,
    marginTop: 2,
  },
  instructionsBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f6eff4',
    padding: 12,
    borderRadius: 10,
  },
  instructionsText: {
    fontSize: 12,
    color: colors.ink,
    lineHeight: 16,
    flex: 1,
    fontWeight: '600',
  },

  // Pass Action buttons
  passActions: {
    gap: 10,
    marginBottom: 30,
  },
  passPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.plum,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: colors.plum,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  passPrimaryBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  passSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.plum,
  },
  passSecondaryBtnText: {
    color: colors.plum,
    fontSize: 13,
    fontWeight: '800',
  },
  passGhostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  passGhostBtnText: {
    color: colors.rose,
    fontSize: 13,
    fontWeight: '700',
  },

  // Main Nav Segment (Store vs Locator)
  mainNavSegmentContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#edd1e4',
  },
  mainNavSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  mainNavSegmentActive: {
    backgroundColor: colors.plum,
    shadowColor: colors.plum,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  mainNavSegmentText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.plum,
  },
  mainNavSegmentTextActive: {
    color: colors.white,
  },

  // Store modal styles
  storePreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fbf4f9',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f2dceb',
  },
  storePreviewIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#f6dceb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(243, 213, 228, 0.7)',
  },
  storePreviewTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
  },
  storePreviewUnit: {
    fontSize: 11,
    color: colors.rose,
    marginTop: 2,
  },
  storePreviewPrice: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.plum,
    marginTop: 4,
  },
  storePickersWrap: {
    gap: 8,
  },
  shopChoiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  shopChoiceCardSelected: {
    borderColor: colors.plum,
    backgroundColor: '#fcf6fa',
  },
  shopChoiceName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  shopChoiceNameSelected: {
    color: colors.plum,
    fontWeight: '800',
  },
  shopChoiceAddress: {
    fontSize: 10,
    color: colors.rose,
    marginTop: 2,
  },
  noticeFallbackBox: {
    backgroundColor: '#faf2f8',
    padding: 10,
    borderRadius: 8,
  },
  noticeFallbackText: {
    fontSize: 11,
    color: colors.plum,
    fontWeight: '600',
  },

  // Other items quick chips in pharmacy modal
  otherItemsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  otherItemChip: {
    backgroundColor: '#f7edf4',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ebd2e3',
  },
  otherItemChipSelected: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
  },
  otherItemChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.plum,
  },
  otherItemChipTextSelected: {
    color: colors.white,
  },
  emergencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    borderColor: '#fda4af',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#e11d48',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  emergencyBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e11d48',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#9f1239',
  },
  emergencyBannerPill: {
    backgroundColor: '#ffe4e6',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#f43f5e',
  },
  emergencyBannerPillText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#e11d48',
    letterSpacing: 0.5,
  },
  emergencyBannerSub: {
    fontSize: 11,
    color: '#881337',
    marginTop: 2,
    fontWeight: '500',
  },
});
