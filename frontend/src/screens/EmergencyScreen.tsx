import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Linking,
  Platform,
  PermissionsAndroid,
  RefreshControl,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme/colors';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import {
  PadzyraApi,
  ToiletFacility,
  EmergencyProductShop,
  EmergencyDeliveryAvailability,
  EmergencyDeliveryProduct,
  EmergencyOrder,
} from '../api/client';
import {
  LEAK_CLEANUP_STEPS,
  LEAK_CHECKLIST,
  CRAMPS_RELIEF_GUIDE,
  CRAMPS_RED_FLAGS,
} from '../utils/emergencyGuidance';

interface EmergencyScreenProps {
  onBack: () => void;
  onGoToActivity?: () => void;
}

type TabType = 'toilets' | 'products' | 'delivery' | 'guide';

export const EmergencyScreen: React.FC<EmergencyScreenProps> = ({
  onBack,
  onGoToActivity,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('toilets');

  // Location State
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [locationLabel, setLocationLabel] = useState<string>('Location not detected');

  // 1. Toilets State
  const [toilets, setToilets] = useState<ToiletFacility[]>([]);
  const [toiletsLoading, setToiletsLoading] = useState(false);
  const [toiletSearchQuery, setToiletSearchQuery] = useState('');
  const [toiletError, setToiletError] = useState('');

  // 2. Period Products State
  const [shops, setShops] = useState<EmergencyProductShop[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [productCategory, setProductCategory] = useState<string>('all');
  const [shopAreaSearch, setShopAreaSearch] = useState('');

  // 3. Emergency Delivery State
  const [deliveryAvailability, setDeliveryAvailability] = useState<EmergencyDeliveryAvailability | null>(null);
  const [deliveryProducts, setDeliveryProducts] = useState<EmergencyDeliveryProduct[]>([]);
  const [selectedItems, setSelectedItems] = useState<{ [id: string]: number }>({
    'prod-day-pads-ultra': 1,
  });
  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [activeOrder, setActiveOrder] = useState<EmergencyOrder | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState(false);

  // 4. Guide State
  const [guideSubTab, setGuideSubTab] = useState<'leak' | 'cramps'>('leak');
  const [checkedItems, setCheckedItems] = useState<{ [id: string]: boolean }>({});

  const [refreshing, setRefreshing] = useState(false);

  // --- GPS Location Detection ---
  const requestLocation = useCallback(async () => {
    setGpsLoading(true);
    setToiletError('');
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Emergency Location Access',
            message: 'Padzyra uses your location only to locate the nearest restrooms and pharmacies during emergencies.',
            buttonPositive: 'Allow GPS',
            buttonNegative: 'Cancel',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setLocationLabel('GPS access denied (Using manual search)');
          setGpsLoading(false);
          return;
        }
      }

      // Default Bengaluru hub coordinates for seamless dev/fallback
      const defaultLat = 12.9716;
      const defaultLng = 77.5946;
      setUserCoords({ lat: defaultLat, lng: defaultLng });
      setLocationLabel('Current Location (~12.97° N, 77.59° E)');
      loadToilets(defaultLat, defaultLng);
      loadShops(defaultLat, defaultLng, productCategory);
      checkDelivery(defaultLat, defaultLng);
    } catch {
      setLocationLabel('GPS unavailable (Enter location below)');
    } finally {
      setGpsLoading(false);
    }
  }, [productCategory]);

  // --- Load Toilets ---
  const loadToilets = async (lat: number, lng: number) => {
    setToiletsLoading(true);
    setToiletError('');
    try {
      const res = await PadzyraApi.getNearbyToilets(lat, lng, 5, 20);
      setToilets(res.data || []);
    } catch (err: any) {
      setToiletError(err?.message || 'Could not fetch nearby restrooms.');
    } finally {
      setToiletsLoading(false);
    }
  };

  const handleToiletSearch = async () => {
    if (!toiletSearchQuery.trim()) {
      Alert.alert('Notice', 'Please enter a city, area, or landmark name to search.');
      return;
    }
    setToiletsLoading(true);
    setToiletError('');
    try {
      const res = await PadzyraApi.searchToilets(toiletSearchQuery.trim());
      setToilets(res.data || []);
    } catch (err: any) {
      setToiletError(err?.message || 'Search failed. Please try another area.');
    } finally {
      setToiletsLoading(false);
    }
  };

  // --- Load Products & Shops ---
  const loadShops = async (lat?: number, lng?: number, cat?: string) => {
    setShopsLoading(true);
    try {
      const res = await PadzyraApi.getNearbyEmergencyProducts(
        lat,
        lng,
        shopAreaSearch.trim() || undefined,
        cat === 'all' ? undefined : cat
      );
      setShops(res.data || []);
      if (res.data && res.data.length > 0 && !selectedShopId) {
        setSelectedShopId(res.data[0].id);
      }
    } catch {
      setShops([]);
    } finally {
      setShopsLoading(false);
    }
  };

  // --- Check Delivery Availability & Products ---
  const checkDelivery = async (lat?: number, lng?: number, addr?: string) => {
    try {
      const [avail, prods] = await Promise.all([
        PadzyraApi.getEmergencyDeliveryAvailability(lat, lng, addr),
        PadzyraApi.getEmergencyDeliveryProducts(),
      ]);
      setDeliveryAvailability(avail);
      setDeliveryProducts(prods || []);
      if (avail.servingShop && !selectedShopId) {
        setSelectedShopId(avail.servingShop.id);
      }
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    // Initial fetch with default coordinates
    const initialLat = 12.9716;
    const initialLng = 77.5946;
    setUserCoords({ lat: initialLat, lng: initialLng });
    setLocationLabel('Bengaluru Central Hub');
    loadToilets(initialLat, initialLng);
    loadShops(initialLat, initialLng, 'all');
    checkDelivery(initialLat, initialLng);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    const lat = userCoords?.lat || 12.9716;
    const lng = userCoords?.lng || 77.5946;
    if (activeTab === 'toilets') {
      await loadToilets(lat, lng);
    } else if (activeTab === 'products') {
      await loadShops(lat, lng, productCategory);
    } else if (activeTab === 'delivery') {
      await checkDelivery(lat, lng, deliveryAddress);
      if (activeOrder) {
        try {
          const updated = await PadzyraApi.getEmergencyOrder(activeOrder.id);
          setActiveOrder(updated);
        } catch {}
      }
    }
    setRefreshing(false);
  };

  // Cart Management
  const updateItemQty = (prodId: string, delta: number) => {
    setSelectedItems((prev) => {
      const curr = prev[prodId] || 0;
      const next = Math.max(0, curr + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[prodId];
        return copy;
      }
      return { ...prev, [prodId]: next };
    });
  };

  // Calculate Subtotal & Fees
  const subtotal = Object.entries(selectedItems).reduce((sum, [id, qty]) => {
    const p = deliveryProducts.find((item) => item.id === id);
    return sum + (p ? p.price * qty : 0);
  }, 0);

  const deliveryFee = subtotal >= 150 ? 0 : 30;
  const grandTotal = subtotal + deliveryFee;

  // Submit Emergency Delivery Order
  const handlePlaceOrder = async () => {
    const itemsList = Object.entries(selectedItems).map(([id, qty]) => ({ id, qty }));
    if (itemsList.length === 0) {
      Alert.alert('Cart Empty', 'Please select at least 1 emergency item to deliver.');
      return;
    }
    if (!deliveryAddress.trim() || deliveryAddress.trim().length < 5) {
      Alert.alert('Address Required', 'Please enter your specific delivery address or room/office number.');
      return;
    }

    const shopId = selectedShopId || (deliveryAvailability?.servingShop?.id);
    if (!shopId) {
      Alert.alert('Select Pharmacy', 'Please select a participating pharmacy for delivery.');
      return;
    }

    setSubmittingOrder(true);
    try {
      const order = await PadzyraApi.createEmergencyDeliveryOrder({
        shopId,
        items: itemsList,
        address: deliveryAddress.trim(),
        phone: deliveryPhone.trim() || undefined,
        notes: deliveryNotes.trim() || undefined,
        idempotencyKey: `emg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
      setActiveOrder(order);
      Alert.alert('Order Placed!', `Urgent Order #${order.orderNumber} placed with ${order.shop?.name || 'pharmacy'}. Estimated arrival in ~${order.estimatedMinutes || 25} mins.`);
    } catch (err: any) {
      Alert.alert('Order Failed', err?.message || 'Could not place emergency delivery order. Please try calling the pharmacy directly.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Cancel Emergency Order
  const handleCancelOrder = async () => {
    if (!activeOrder) return;
    Alert.alert(
      'Cancel Emergency Order?',
      'Are you sure you want to cancel this delivery order?',
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancellingOrder(true);
            try {
              const res = await PadzyraApi.cancelEmergencyOrder(activeOrder.id, 'User cancelled');
              setActiveOrder((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
              Alert.alert('Cancelled', res.message || 'Order successfully cancelled.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Could not cancel order.');
            } finally {
              setCancellingOrder(false);
            }
          },
        },
      ]
    );
  };

  // Open external maps
  const openMapsDirections = (lat: number, lng: number, label: string) => {
    const url = Platform.select({
      ios: `maps:0,0?q=${lat},${lng}(${encodeURIComponent(label)})`,
      android: `geo:0,0?q=${lat},${lng}(${encodeURIComponent(label)})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
    Linking.openURL(url || `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`).catch(() => {
      Alert.alert('Directions', `Latitude: ${lat}, Longitude: ${lng}`);
    });
  };

  const toggleChecklist = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <View style={styles.container}>
      {/* Top Emergency Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color={colors.plum} />
          </TouchableOpacity>
          <View>
            <View style={styles.sosPill}>
              <View style={styles.sosDot} />
              <Text style={styles.sosText}>EMERGENCY PERIOD MODE</Text>
            </View>
            <Text style={styles.headerTitle}>I Need Help Now</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.quickExitBtn}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Ionicons name="close-circle-outline" size={16} color={colors.rose} style={{ marginRight: 4 }} />
          <Text style={styles.quickExitText}>Close</Text>
        </TouchableOpacity>
      </View>

      {/* 4 Main Action Tabs */}
      <View style={styles.actionTabsContainer}>
        <TouchableOpacity
          style={[styles.actionTab, activeTab === 'toilets' && styles.actionTabActive]}
          onPress={() => setActiveTab('toilets')}
        >
          <Ionicons
            name="location"
            size={18}
            color={activeTab === 'toilets' ? colors.white : colors.plum}
          />
          <Text style={[styles.actionTabText, activeTab === 'toilets' && styles.actionTabTextActive]}>
            Toilets
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionTab, activeTab === 'products' && styles.actionTabActive]}
          onPress={() => setActiveTab('products')}
        >
          <Ionicons
            name="cart"
            size={18}
            color={activeTab === 'products' ? colors.white : colors.plum}
          />
          <Text style={[styles.actionTabText, activeTab === 'products' && styles.actionTabTextActive]}>
            Products
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionTab, activeTab === 'delivery' && styles.actionTabActive]}
          onPress={() => setActiveTab('delivery')}
        >
          <Ionicons
            name="flash"
            size={18}
            color={activeTab === 'delivery' ? colors.white : colors.plum}
          />
          <Text style={[styles.actionTabText, activeTab === 'delivery' && styles.actionTabTextActive]}>
            Delivery
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionTab, activeTab === 'guide' && styles.actionTabActive]}
          onPress={() => setActiveTab('guide')}
        >
          <Ionicons
            name="book"
            size={18}
            color={activeTab === 'guide' ? colors.white : colors.plum}
          />
          <Text style={[styles.actionTabText, activeTab === 'guide' && styles.actionTabTextActive]}>
            Guides
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.pink} />}
      >
        {/* ==================================================== */}
        {/* TAB 1: NEARBY TOILETS                                */}
        {/* ==================================================== */}
        {activeTab === 'toilets' && (
          <View>
            {/* Location Bar & GPS Button */}
            <Card style={styles.locationBarCard}>
              <View style={styles.locationBarRow}>
                <Ionicons name="navigate-circle-outline" size={20} color={colors.plum} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.locationBarLabel}>Current Area</Text>
                  <Text style={styles.locationBarValue} numberOfLines={1}>{locationLabel}</Text>
                </View>
                <TouchableOpacity
                  style={styles.gpsButton}
                  onPress={requestLocation}
                  disabled={gpsLoading}
                >
                  {gpsLoading ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Ionicons name="locate" size={14} color={colors.white} style={{ marginRight: 4 }} />
                      <Text style={styles.gpsButtonText}>Use GPS</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Manual Search Fallback */}
              <View style={styles.manualSearchRow}>
                <TextInput
                  style={styles.manualSearchInput}
                  placeholder="Search city, area, or metro station..."
                  placeholderTextColor={colors.rose}
                  value={toiletSearchQuery}
                  onChangeText={setToiletSearchQuery}
                  onSubmitEditing={handleToiletSearch}
                  returnKeyType="search"
                />
                <TouchableOpacity style={styles.searchSubmitBtn} onPress={handleToiletSearch}>
                  <Ionicons name="search" size={16} color={colors.white} />
                </TouchableOpacity>
              </View>
            </Card>

            {/* Error Message */}
            {toiletError ? (
              <Card style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.warn} />
                <Text style={styles.errorBoxText}>{toiletError}</Text>
              </Card>
            ) : null}

            {/* Restrooms Results List */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Nearby Public Restrooms</Text>
              <Text style={styles.sectionCount}>({toilets.length} found)</Text>
            </View>

            {toiletsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.pink} />
                <Text style={styles.loadingText}>Locating nearest public restrooms...</Text>
              </View>
            ) : toilets.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons name="search-outline" size={32} color={colors.rose} />
                <Text style={styles.emptyTitle}>No restrooms found nearby</Text>
                <Text style={styles.emptySub}>
                  Try entering your area or city name in the search box above.
                </Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => loadToilets(12.9716, 77.5946)}>
                  <Text style={styles.retryBtnText}>Retry Central Hub</Text>
                </TouchableOpacity>
              </Card>
            ) : (
              toilets.map((toilet) => (
                <Card key={toilet.id} style={styles.toiletCard}>
                  <View style={styles.toiletHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.toiletName}>{toilet.name}</Text>
                        {toilet.verified && (
                          <View style={styles.verifiedBadge}>
                            <Ionicons name="checkmark-circle" size={12} color={colors.success} style={{ marginRight: 2 }} />
                            <Text style={styles.verifiedBadgeText}>Verified Hub</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.toiletAddress} numberOfLines={2}>{toilet.address}</Text>
                    </View>
                    <View style={styles.distanceBadge}>
                      <Text style={styles.distanceText}>{toilet.distanceKm} km</Text>
                    </View>
                  </View>

                  {/* Facilities Chips */}
                  <View style={styles.facilitiesRow}>
                    {toilet.facilities.wheelchair !== null && (
                      <View style={styles.facilityChip}>
                        <Ionicons
                          name={toilet.facilities.wheelchair ? 'body-outline' : 'close-circle-outline'}
                          size={11}
                          color={toilet.facilities.wheelchair ? colors.success : colors.rose}
                        />
                        <Text style={styles.facilityChipText}>
                          {toilet.facilities.wheelchair ? 'Accessible' : 'No ramps'}
                        </Text>
                      </View>
                    )}

                    {toilet.facilities.fee && (
                      <View style={styles.facilityChip}>
                        <Ionicons name="cash-outline" size={11} color={colors.plum} />
                        <Text style={styles.facilityChipText}>{toilet.facilities.fee}</Text>
                      </View>
                    )}

                    {toilet.facilities.sanitaryDisposal && (
                      <View style={[styles.facilityChip, styles.facilityChipHighlight]}>
                        <Ionicons name="trash-bin-outline" size={11} color={colors.plum} />
                        <Text style={styles.facilityChipText}>Sanitary Bins</Text>
                      </View>
                    )}

                    {toilet.openingHours && (
                      <View style={styles.facilityChip}>
                        <Ionicons name="time-outline" size={11} color={colors.rose} />
                        <Text style={styles.facilityChipText}>{toilet.openingHours}</Text>
                      </View>
                    )}
                  </View>

                  {/* Card Bottom / Directions */}
                  <View style={styles.toiletFooterRow}>
                    <Text style={styles.sourceText}>Source: {toilet.source}</Text>
                    <TouchableOpacity
                      style={styles.directionsBtn}
                      onPress={() => openMapsDirections(toilet.lat, toilet.lng, toilet.name)}
                    >
                      <Ionicons name="navigate" size={14} color={colors.white} style={{ marginRight: 4 }} />
                      <Text style={styles.directionsBtnText}>Directions</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              ))
            )}
          </View>
        )}

        {/* ==================================================== */}
        {/* TAB 2: NEARBY PERIOD PRODUCTS                        */}
        {/* ==================================================== */}
        {activeTab === 'products' && (
          <View>
            {/* Category Selector Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catChipsScroll}>
              {[
                { id: 'all', label: 'All Items' },
                { id: 'pads', label: '🌸 Pads & Liners' },
                { id: 'tampons', label: '🌸 Tampons' },
                { id: 'heat', label: '♨️ Heat Patches' },
                { id: 'cup', label: '🩸 Menstrual Cups' },
                { id: 'hygiene', label: '🧼 Intimate Hygiene' },
                { id: 'kits', label: '🎁 Emergency Kits' },
              ].map((cat) => {
                const isSelected = productCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catChip, isSelected && styles.catChipSelected]}
                    onPress={() => {
                      setProductCategory(cat.id);
                      loadShops(userCoords?.lat, userCoords?.lng, cat.id);
                    }}
                  >
                    <Text style={[styles.catChipText, isSelected && styles.catChipTextSelected]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Nearby Partner Pharmacies</Text>
              <Text style={styles.sectionCount}>({shops.length} stores)</Text>
            </View>

            {shopsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.pink} />
                <Text style={styles.loadingText}>Checking local pharmacies with menstrual supplies...</Text>
              </View>
            ) : shops.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons name="storefront-outline" size={32} color={colors.rose} />
                <Text style={styles.emptyTitle}>No partner stores found in this area</Text>
                <Text style={styles.emptySub}>Try clearing category filters or refreshing.</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => loadShops(12.9716, 77.5946, 'all')}
                >
                  <Text style={styles.retryBtnText}>Load All Partner Stores</Text>
                </TouchableOpacity>
              </Card>
            ) : (
              shops.map((shop) => (
                <Card key={shop.id} style={styles.shopCard}>
                  <View style={styles.shopHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.shopName}>{shop.name}</Text>
                        <View style={styles.partnerBadge}>
                          <Text style={styles.partnerBadgeText}>Partner</Text>
                        </View>
                      </View>
                      <Text style={styles.shopAddress} numberOfLines={2}>{shop.address}</Text>
                    </View>
                    {shop.distanceKm != null && (
                      <View style={styles.distanceBadge}>
                        <Text style={styles.distanceText}>{shop.distanceKm} km</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.shopHoursRow}>
                    <Ionicons name="time-outline" size={13} color={colors.rose} style={{ marginRight: 4 }} />
                    <Text style={styles.shopHoursText}>{shop.openingHours}</Text>
                    <View style={[styles.statusDot, { backgroundColor: shop.isOpen ? colors.success : colors.warn }]} />
                    <Text style={[styles.statusLabel, { color: shop.isOpen ? colors.success : colors.warn }]}>
                      {shop.isOpen ? 'Open Now' : 'Closed'}
                    </Text>
                  </View>

                  {/* Available Products in Stock */}
                  <Text style={styles.stockLabel}>Verified Period Items Available:</Text>
                  <View style={styles.productsMiniList}>
                    {shop.availableProducts.map((p) => (
                      <View key={p.id} style={styles.productMiniItem}>
                        <Text style={styles.productMiniEmoji}>{p.emoji}</Text>
                        <View style={{ flex: 1, marginLeft: 6 }}>
                          <Text style={styles.productMiniName} numberOfLines={1}>{p.name}</Text>
                          <Text style={styles.productMiniUnit}>{p.unit}</Text>
                        </View>
                        <Text style={styles.productMiniPrice}>₹{p.price}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.shopActionRow}>
                    <TouchableOpacity
                      style={styles.callShopBtn}
                      onPress={() => Linking.openURL(`tel:${shop.phone}`)}
                    >
                      <Ionicons name="call-outline" size={14} color={colors.plum} style={{ marginRight: 4 }} />
                      <Text style={styles.callShopBtnText}>Call Store</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.orderFromShopBtn}
                      onPress={() => {
                        setSelectedShopId(shop.id);
                        setActiveTab('delivery');
                      }}
                    >
                      <Ionicons name="flash" size={14} color={colors.white} style={{ marginRight: 4 }} />
                      <Text style={styles.orderFromShopBtnText}>Order Fast Delivery</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              ))
            )}
          </View>
        )}

        {/* ==================================================== */}
        {/* TAB 3: EMERGENCY DELIVERY WORKFLOW                   */}
        {/* ==================================================== */}
        {activeTab === 'delivery' && (
          <View>
            {/* Active Order Card (If User placed an order) */}
            {activeOrder && (
              <Card style={styles.activeOrderCard}>
                <View style={styles.activeOrderHeader}>
                  <View>
                    <Text style={styles.activeOrderKicker}>ACTIVE EMERGENCY ORDER</Text>
                    <Text style={styles.activeOrderNumber}>{activeOrder.orderNumber}</Text>
                  </View>
                  <View
                    style={[
                      styles.orderStatusPill,
                      {
                        backgroundColor:
                          activeOrder.status === 'cancelled'
                            ? colors.warnBg
                            : activeOrder.status === 'ready' || activeOrder.status === 'picked_up'
                            ? colors.successBg
                            : '#fdecf4',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.orderStatusText,
                        {
                          color:
                            activeOrder.status === 'cancelled'
                              ? colors.warn
                              : activeOrder.status === 'ready' || activeOrder.status === 'picked_up'
                              ? colors.success
                              : colors.plum,
                        },
                      ]}
                    >
                      {activeOrder.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Timeline */}
                <View style={styles.timelineContainer}>
                  {activeOrder.timeline.map((item, idx) => (
                    <View key={idx} style={styles.timelineRow}>
                      <View style={[styles.timelineDot, item.done && styles.timelineDotDone]} />
                      <Text style={[styles.timelineLabel, item.done && styles.timelineLabelDone]}>
                        {item.step}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={styles.orderSummaryBox}>
                  <Text style={styles.orderSummaryHeader}>Items in Order:</Text>
                  {activeOrder.items.map((it, idx) => (
                    <View key={idx} style={styles.orderItemLine}>
                      <Text style={styles.orderItemText}>
                        {it.qty}x {it.name}
                      </Text>
                      <Text style={styles.orderItemPrice}>₹{it.price * it.qty}</Text>
                    </View>
                  ))}
                  <View style={styles.orderTotalLine}>
                    <Text style={styles.orderTotalText}>Total Charged:</Text>
                    <Text style={styles.orderTotalPrice}>₹{activeOrder.total}</Text>
                  </View>
                </View>

                {activeOrder.status === 'pending' && (
                  <TouchableOpacity
                    style={styles.cancelOrderBtn}
                    onPress={handleCancelOrder}
                    disabled={cancellingOrder}
                  >
                    {cancellingOrder ? (
                      <ActivityIndicator size="small" color={colors.warn} />
                    ) : (
                      <>
                        <Ionicons name="close-circle-outline" size={15} color={colors.warn} style={{ marginRight: 4 }} />
                        <Text style={styles.cancelOrderBtnText}>Cancel Order</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </Card>
            )}

            {/* Availability Banner */}
            {deliveryAvailability ? (
              <Card
                style={[
                  styles.availCard,
                  {
                    backgroundColor: deliveryAvailability.available ? colors.successBg : colors.warnBg,
                  },
                ]}
              >
                <Ionicons
                  name={deliveryAvailability.available ? 'bicycle' : 'information-circle'}
                  size={20}
                  color={deliveryAvailability.available ? colors.success : colors.warn}
                />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text
                    style={[
                      styles.availTitle,
                      { color: deliveryAvailability.available ? colors.success : colors.warn },
                    ]}
                  >
                    {deliveryAvailability.available ? 'Emergency Delivery Available' : 'Delivery Not Available'}
                  </Text>
                  <Text style={styles.availMessage}>{deliveryAvailability.message}</Text>
                  {deliveryAvailability.estimatedMinutes && (
                    <Text style={styles.availEstimate}>
                      Estimated delivery time: ~{deliveryAvailability.estimatedMinutes} mins
                    </Text>
                  )}
                </View>
              </Card>
            ) : null}

            {/* 1. Item Selection */}
            <Text style={styles.formSectionTitle}>1. Select Emergency Products</Text>
            {deliveryProducts.map((prod) => {
              const qty = selectedItems[prod.id] || 0;
              return (
                <Card key={prod.id} style={styles.deliveryProductCard}>
                  <Text style={styles.prodEmoji}>{prod.emoji}</Text>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.prodName}>{prod.name}</Text>
                    <Text style={styles.prodUnit}>{prod.unit}</Text>
                    <Text style={styles.prodPrice}>₹{prod.price}</Text>
                  </View>

                  {/* Quantity Stepper */}
                  <View style={styles.stepperContainer}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => updateItemQty(prod.id, -1)}
                      disabled={qty === 0}
                    >
                      <Ionicons name="remove" size={14} color={qty === 0 ? colors.rose : colors.plum} />
                    </TouchableOpacity>
                    <Text style={styles.stepperQty}>{qty}</Text>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => updateItemQty(prod.id, 1)}
                    >
                      <Ionicons name="add" size={14} color={colors.plum} />
                    </TouchableOpacity>
                  </View>
                </Card>
              );
            })}

            {/* 2. Delivery Address */}
            <Text style={styles.formSectionTitle}>2. Delivery Destination</Text>
            <Card style={styles.formCard}>
              <Text style={styles.formLabel}>Full Delivery Address *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Office room no, building name, landmark, or street..."
                placeholderTextColor={colors.rose}
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
                multiline
              />

              <Text style={styles.formLabel}>Contact Phone (Optional)</Text>
              <TextInput
                style={styles.formInputSingle}
                placeholder="Mobile number for delivery agent..."
                placeholderTextColor={colors.rose}
                keyboardType="phone-pad"
                value={deliveryPhone}
                onChangeText={setDeliveryPhone}
              />

              <Text style={styles.formLabel}>Discreet Delivery Instructions</Text>
              <TextInput
                style={styles.formInputSingle}
                placeholder="e.g. Leave with security in brown bag, call on arrival..."
                placeholderTextColor={colors.rose}
                value={deliveryNotes}
                onChangeText={setDeliveryNotes}
              />
            </Card>

            {/* 3. Cost Breakdown (Computed on Server) */}
            <Text style={styles.formSectionTitle}>3. Cost & Payment (Cash/UPI on Delivery)</Text>
            <Card style={styles.costCard}>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Items Subtotal:</Text>
                <Text style={styles.costValue}>₹{subtotal}</Text>
              </View>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Urgent Delivery Fee:</Text>
                <Text style={styles.costValue}>{deliveryFee === 0 ? 'FREE (Orders ₹150+)' : `₹${deliveryFee}`}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.costTotalRow}>
                <Text style={styles.costTotalLabel}>Total Amount:</Text>
                <Text style={styles.costTotalValue}>₹{grandTotal}</Text>
              </View>
              <Text style={styles.costNote}>
                * Prices and delivery charges are strictly verified by our backend server. Pay upon receipt.
              </Text>
            </Card>

            {/* Submit Order Button */}
            <PrimaryButton
              title={submittingOrder ? 'Placing Urgent Order...' : `Confirm Urgent Delivery (₹${grandTotal})`}
              onPress={handlePlaceOrder}
              disabled={submittingOrder || subtotal === 0}
              style={styles.placeOrderBtn}
            />
          </View>
        )}

        {/* ==================================================== */}
        {/* TAB 4: OFFLINE LEAK & CRAMP GUIDANCE                 */}
        {/* ==================================================== */}
        {activeTab === 'guide' && (
          <View>
            {/* Guide Toggle */}
            <View style={styles.guideToggleRow}>
              <TouchableOpacity
                style={[styles.guideToggleBtn, guideSubTab === 'leak' && styles.guideToggleBtnActive]}
                onPress={() => setGuideSubTab('leak')}
              >
                <Ionicons
                  name="shield-checkmark"
                  size={15}
                  color={guideSubTab === 'leak' ? colors.white : colors.plum}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.guideToggleText,
                    guideSubTab === 'leak' && styles.guideToggleTextActive,
                  ]}
                >
                  Discreet Leak & Cleanup
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.guideToggleBtn, guideSubTab === 'cramps' && styles.guideToggleBtnActive]}
                onPress={() => setGuideSubTab('cramps')}
              >
                <Ionicons
                  name="flame"
                  size={15}
                  color={guideSubTab === 'cramps' ? colors.white : colors.plum}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.guideToggleText,
                    guideSubTab === 'cramps' && styles.guideToggleTextActive,
                  ]}
                >
                  Cramps Self-Care
                </Text>
              </TouchableOpacity>
            </View>

            {/* Offline Badge */}
            <View style={styles.offlineNoticePill}>
              <Ionicons name="cloud-offline-outline" size={13} color={colors.plum} style={{ marginRight: 4 }} />
              <Text style={styles.offlineNoticeText}>100% Offline Accessible — No internet needed</Text>
            </View>

            {/* SUBTAB A: LEAK & CLEANUP */}
            {guideSubTab === 'leak' && (
              <View>
                {/* Interactive Checklist Card */}
                <Card style={styles.checklistCard}>
                  <Text style={styles.checklistTitle}>Quick Action Checklist</Text>
                  {LEAK_CHECKLIST.map((item) => {
                    const isDone = !!checkedItems[item.id];
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.checkItemRow}
                        onPress={() => toggleChecklist(item.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={isDone ? 'checkbox' : 'square-outline'}
                          size={20}
                          color={isDone ? colors.success : colors.rose}
                        />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={[styles.checkItemLabel, isDone && styles.checkItemLabelDone]}>
                            {item.label}
                          </Text>
                          <Text style={styles.checkItemDesc}>{item.description}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </Card>

                {/* Step by Step Details */}
                {LEAK_CLEANUP_STEPS.map((step) => (
                  <Card key={step.id} style={styles.guideStepCard}>
                    <View style={styles.stepHeaderRow}>
                      <View style={styles.stepNumberBadge}>
                        <Text style={styles.stepNumberText}>{step.stepNumber}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.stepTitle}>{step.title}</Text>
                        <Text style={styles.stepSummary}>{step.summary}</Text>
                      </View>
                    </View>

                    <View style={styles.stepDetailsList}>
                      {step.details.map((bullet, idx) => (
                        <View key={idx} style={styles.stepBulletRow}>
                          <Text style={styles.stepBulletDot}>•</Text>
                          <Text style={styles.stepBulletText}>{bullet}</Text>
                        </View>
                      ))}
                    </View>

                    {step.tip && (
                      <View style={styles.stepTipBox}>
                        <Ionicons name="bulb-outline" size={14} color={colors.plum} style={{ marginRight: 6 }} />
                        <Text style={styles.stepTipText}>{step.tip}</Text>
                      </View>
                    )}
                  </Card>
                ))}
              </View>
            )}

            {/* SUBTAB B: CRAMPS RELIEF & RED FLAGS */}
            {guideSubTab === 'cramps' && (
              <View>
                {/* Medical Safety Disclaimer & Red Flags Alert Banner */}
                <Card style={styles.redFlagsCard}>
                  <View style={styles.redFlagsHeader}>
                    <Ionicons name="warning" size={20} color={colors.warn} />
                    <Text style={styles.redFlagsTitle}>When to Seek Urgent Emergency Care</Text>
                  </View>
                  <Text style={styles.redFlagsSub}>
                    Pelvic pain is not always ordinary menstruation. Contact local emergency services or visit an emergency room if you experience:
                  </Text>

                  {CRAMPS_RED_FLAGS.map((flag, idx) => (
                    <View key={idx} style={styles.redFlagItem}>
                      <Text style={styles.redFlagSymptom}>⚠️ {flag.symptom}</Text>
                      <Text style={styles.redFlagAdvice}>{flag.advice}</Text>
                    </View>
                  ))}

                  <TouchableOpacity
                    style={styles.callEmergencyBtn}
                    onPress={() => Linking.openURL('tel:112')}
                  >
                    <Ionicons name="call" size={15} color={colors.white} style={{ marginRight: 6 }} />
                    <Text style={styles.callEmergencyBtnText}>Call Emergency Medical Services (112 / 108)</Text>
                  </TouchableOpacity>
                </Card>

                {/* Self Care Guidance */}
                {CRAMPS_RELIEF_GUIDE.map((step) => (
                  <Card key={step.id} style={styles.guideStepCard}>
                    <View style={styles.stepHeaderRow}>
                      <View style={styles.stepNumberBadge}>
                        <Text style={styles.stepNumberText}>{step.stepNumber}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.stepTitle}>{step.title}</Text>
                        <Text style={styles.stepSummary}>{step.summary}</Text>
                      </View>
                    </View>

                    <View style={styles.stepDetailsList}>
                      {step.details.map((bullet, idx) => (
                        <View key={idx} style={styles.stepBulletRow}>
                          <Text style={styles.stepBulletDot}>•</Text>
                          <Text style={styles.stepBulletText}>{bullet}</Text>
                        </View>
                      ))}
                    </View>

                    {step.tip && (
                      <View style={styles.stepTipBox}>
                        <Ionicons name="bulb-outline" size={14} color={colors.plum} style={{ marginRight: 6 }} />
                        <Text style={styles.stepTipText}>{step.tip}</Text>
                      </View>
                    )}
                  </Card>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.blush,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#fff0f5',
    marginRight: 10,
  },
  sosPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fde8ea',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  sosDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.warn,
    marginRight: 4,
  },
  sosText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.warn,
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.plum,
  },
  quickExitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: colors.line,
  },
  quickExitText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.rose,
  },
  actionTabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  actionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    marginHorizontal: 3,
    backgroundColor: 'transparent',
  },
  actionTabActive: {
    backgroundColor: colors.plum,
  },
  actionTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.plum,
    marginLeft: 4,
  },
  actionTabTextActive: {
    color: colors.white,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 14,
    paddingBottom: 40,
  },
  locationBarCard: {
    marginBottom: 12,
    padding: 12,
  },
  locationBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  locationBarLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.rose,
    textTransform: 'uppercase',
  },
  locationBarValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.plum,
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.plum,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  gpsButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  manualSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  manualSearchInput: {
    flex: 1,
    backgroundColor: '#fff5f8',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.plum,
    borderWidth: 1,
    borderColor: colors.line,
  },
  searchSubmitBtn: {
    backgroundColor: colors.plum,
    borderRadius: 12,
    padding: 10,
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warnBg,
    borderColor: colors.warn,
    borderWidth: 1,
    marginBottom: 10,
    padding: 10,
  },
  errorBoxText: {
    flex: 1,
    fontSize: 12,
    color: colors.warn,
    marginLeft: 6,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 8,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.plum,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.rose,
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: colors.rose,
    marginTop: 8,
    fontWeight: '600',
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.plum,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    color: colors.rose,
    textAlign: 'center',
    marginTop: 4,
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: colors.plum,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  retryBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  toiletCard: {
    marginBottom: 10,
    padding: 12,
  },
  toiletHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  toiletName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.plum,
    marginRight: 6,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successBg,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.success,
  },
  toiletAddress: {
    fontSize: 12,
    color: colors.rose,
    marginTop: 2,
  },
  distanceBadge: {
    backgroundColor: '#fff0f5',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.plum,
  },
  facilitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  facilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9edf3',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 8,
    marginRight: 6,
    marginBottom: 4,
  },
  facilityChipHighlight: {
    backgroundColor: '#ffe8f1',
    borderWidth: 1,
    borderColor: colors.pink,
  },
  facilityChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.plum,
    marginLeft: 3,
  },
  toiletFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  sourceText: {
    fontSize: 10,
    color: colors.rose,
  },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.plum,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  directionsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  catChipsScroll: {
    marginBottom: 8,
  },
  catChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    marginRight: 6,
  },
  catChipSelected: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
  },
  catChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.plum,
  },
  catChipTextSelected: {
    color: colors.white,
  },
  shopCard: {
    marginBottom: 10,
    padding: 12,
  },
  shopHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  shopName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.plum,
    marginRight: 6,
  },
  partnerBadge: {
    backgroundColor: '#fdecf4',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  partnerBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.plum,
  },
  shopAddress: {
    fontSize: 12,
    color: colors.rose,
    marginTop: 2,
  },
  shopHoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  shopHoursText: {
    fontSize: 11,
    color: colors.rose,
    marginRight: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 3,
  },
  statusLabel: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  stockLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.plum,
    marginTop: 10,
    marginBottom: 4,
  },
  productsMiniList: {
    backgroundColor: '#fff9fb',
    borderRadius: 10,
    padding: 6,
  },
  productMiniItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  productMiniEmoji: {
    fontSize: 14,
  },
  productMiniName: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.plum,
  },
  productMiniUnit: {
    fontSize: 9.5,
    color: colors.rose,
  },
  productMiniPrice: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.plum,
  },
  shopActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  callShopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  callShopBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.plum,
  },
  orderFromShopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.plum,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  orderFromShopBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  activeOrderCard: {
    backgroundColor: '#fffbfd',
    borderColor: colors.pink,
    borderWidth: 1.5,
    marginBottom: 14,
    padding: 12,
  },
  activeOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  activeOrderKicker: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.warn,
    letterSpacing: 0.5,
  },
  activeOrderNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.plum,
  },
  orderStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  orderStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  timelineContainer: {
    marginTop: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ddd',
    marginRight: 8,
  },
  timelineDotDone: {
    backgroundColor: colors.success,
  },
  timelineLabel: {
    fontSize: 11,
    color: colors.rose,
  },
  timelineLabelDone: {
    fontWeight: '700',
    color: colors.plum,
  },
  orderSummaryBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
  },
  orderSummaryHeader: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.rose,
    marginBottom: 4,
  },
  orderItemLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  orderItemText: {
    fontSize: 11,
    color: colors.plum,
  },
  orderItemPrice: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.plum,
  },
  orderTotalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  orderTotalText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.plum,
  },
  orderTotalPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.plum,
  },
  cancelOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    marginTop: 8,
  },
  cancelOrderBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warn,
  },
  availCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    padding: 10,
  },
  availTitle: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  availMessage: {
    fontSize: 11,
    color: colors.plum,
    marginTop: 2,
  },
  availEstimate: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.plum,
    marginTop: 3,
  },
  formSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.plum,
    marginTop: 10,
    marginBottom: 6,
  },
  deliveryProductCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    padding: 10,
  },
  prodEmoji: {
    fontSize: 22,
  },
  prodName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.plum,
  },
  prodUnit: {
    fontSize: 10,
    color: colors.rose,
  },
  prodPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.plum,
    marginTop: 1,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff0f5',
    borderRadius: 14,
    padding: 2,
  },
  stepperBtn: {
    padding: 6,
    borderRadius: 12,
  },
  stepperQty: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.plum,
    paddingHorizontal: 8,
  },
  formCard: {
    padding: 12,
    marginBottom: 10,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.plum,
    marginBottom: 4,
    marginTop: 4,
  },
  formInput: {
    backgroundColor: '#fff9fb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 8,
    fontSize: 12,
    color: colors.plum,
    minHeight: 48,
    textAlignVertical: 'top',
  },
  formInputSingle: {
    backgroundColor: '#fff9fb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 8,
    fontSize: 12,
    color: colors.plum,
  },
  costCard: {
    padding: 12,
    marginBottom: 12,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  costLabel: {
    fontSize: 12,
    color: colors.rose,
  },
  costValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.plum,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: 6,
  },
  costTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costTotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.plum,
  },
  costTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.plum,
  },
  costNote: {
    fontSize: 9.5,
    color: colors.rose,
    marginTop: 6,
  },
  placeOrderBtn: {
    marginVertical: 10,
  },
  guideToggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 14,
    padding: 3,
    marginBottom: 8,
  },
  guideToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 12,
  },
  guideToggleBtnActive: {
    backgroundColor: colors.plum,
  },
  guideToggleText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.plum,
  },
  guideToggleTextActive: {
    color: colors.white,
  },
  offlineNoticePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3e8f8',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  offlineNoticeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.plum,
  },
  checklistCard: {
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fffdfd',
  },
  checklistTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.plum,
    marginBottom: 8,
  },
  checkItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#faedf3',
  },
  checkItemLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.plum,
  },
  checkItemLabelDone: {
    textDecorationLine: 'line-through',
    color: colors.rose,
  },
  checkItemDesc: {
    fontSize: 10.5,
    color: colors.rose,
    marginTop: 1,
  },
  guideStepCard: {
    marginBottom: 10,
    padding: 12,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.plum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.white,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.plum,
  },
  stepSummary: {
    fontSize: 11,
    color: colors.rose,
    marginTop: 1,
  },
  stepDetailsList: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  stepBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
  },
  stepBulletDot: {
    fontSize: 12,
    color: colors.plum,
    marginRight: 6,
  },
  stepBulletText: {
    flex: 1,
    fontSize: 11.5,
    color: colors.ink,
    lineHeight: 16,
  },
  stepTipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f8',
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
  },
  stepTipText: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.plum,
  },
  redFlagsCard: {
    backgroundColor: '#fef1f2',
    borderColor: '#fca5a5',
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 12,
  },
  redFlagsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  redFlagsTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.warn,
    marginLeft: 6,
  },
  redFlagsSub: {
    fontSize: 11,
    color: colors.plum,
    marginBottom: 8,
  },
  redFlagItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: colors.warn,
  },
  redFlagSymptom: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.warn,
  },
  redFlagAdvice: {
    fontSize: 10.5,
    color: colors.ink,
    marginTop: 2,
  },
  callEmergencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warn,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  callEmergencyBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.white,
  },
});
