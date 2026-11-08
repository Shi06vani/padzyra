import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme/colors';
import { Card } from '../components/Card';
import { PadzyraApi } from '../api/client';
import { PushNotificationService } from '../services/pushNotificationService';

interface ActivityScreenProps {
  onNavigateToNow?: () => void;
}

type ActivityTab = 'orders' | 'supplies' | 'alerts';

export const ActivityScreen: React.FC<ActivityScreenProps> = ({ onNavigateToNow }) => {
  const [activeTab, setActiveTab] = useState<ActivityTab>('orders');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [orders, setOrders] = useState<any[]>([]);
  const [suppliesHistory, setSuppliesHistory] = useState<any[]>([]);
  const [notificationHistory, setNotificationHistory] = useState<any[]>([]);
  const [todayAlert, setTodayAlert] = useState<any>(null);
  const [fcmStatus, setFcmStatus] = useState<any>(null);
  const [sendingReminder, setSendingReminder] = useState(false);

  // Copy code feedback
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Quick Restock form states
  const [showRestock, setShowRestock] = useState(false);
  const [restockKind, setRestockKind] = useState<'day' | 'night'>('day');
  const [restockQty, setRestockQty] = useState(2);
  const [restocking, setRestocking] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [ordersData, suppData, notifData, alertData, statusData] = await Promise.all([
        PadzyraApi.getOrders().catch(() => []),
        PadzyraApi.getSuppliesHistory(50).catch(() => []),
        PadzyraApi.getNotificationHistory().catch(() => []),
        PadzyraApi.getTodayAlert().catch(() => null),
        PadzyraApi.getFcmStatus().catch(() => null),
      ]);

      setOrders(ordersData || []);
      setSuppliesHistory(suppData || []);
      setNotificationHistory(notifData || []);
      setTodayAlert(alertData || null);
      setFcmStatus(statusData || null);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopyCode = (orderId: string) => {
    setCopiedOrderId(orderId);
    setTimeout(() => {
      setCopiedOrderId(null);
    }, 2500);
  };

  const handleCancelOrder = (orderId: string, orderNumber: string) => {
    Alert.alert(
      'Cancel Emergency Order',
      `Are you sure you want to cancel order #${orderNumber}? The pharmacy counter will be notified immediately.`,
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Yes, Cancel Order',
          style: 'destructive',
          onPress: async () => {
            try {
              await PadzyraApi.cancelOrder(orderId);
              Alert.alert('Order Cancelled', 'Your request has been cancelled.');
              loadData();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Could not cancel order');
            }
          },
        },
      ]
    );
  };

  const handleConfirmPickup = async (orderId: string, orderNumber: string) => {
    Alert.alert(
      'Confirm Counter Collection',
      `Have you collected package #${orderNumber} from the pharmacy counter?`,
      [
        { text: 'Not Yet', style: 'cancel' },
        {
          text: 'Yes, Collected',
          onPress: async () => {
            try {
              await PadzyraApi.markOrderPickedUp(orderId);
              Alert.alert('Discreet Pickup Complete', 'Order marked as collected and added to your bag log.');
              loadData();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Could not confirm pickup');
            }
          },
        },
      ]
    );
  };

  const handleDismissAlert = async () => {
    try {
      await PadzyraApi.dismissAlert();
      setTodayAlert(null);
    } catch {
      // Ignore
    }
  };

  const handleRegisterDevice = async () => {
    try {
      const res = await PushNotificationService.registerDeviceToken();
      Alert.alert(
        res.success ? 'Device Registered! 📱' : 'Registration Notice',
        res.message
      );
      const status = await PadzyraApi.getFcmStatus().catch(() => null);
      setFcmStatus(status || null);
    } catch (err: any) {
      Alert.alert('Registration Error', err?.message || 'Could not register device');
    }
  };

  const handleSendReminder = async (kind: string = 'test') => {
    setSendingReminder(true);
    try {
      const res = await PushNotificationService.dispatchReminder(kind);
      const fcmInfo = res.fcmResult;
      const count = fcmInfo?.successCount ?? 0;
      const fail = fcmInfo?.failureCount ?? 0;
      const noTokens = fcmInfo?.noTokens;

      let detailMsg = `"${res.title}"\n${res.body}`;
      if (noTokens) {
        detailMsg += `\n\n📱 Device Registered: No device tokens were found on this account previously, so this device was automatically registered! Push notifications will now arrive.`;
      } else {
        detailMsg += `\n\n🚀 Firebase Cloud Messaging: Successfully dispatched to ${count} active device(s)${fail > 0 ? `, ${fail} failed` : ''}.`;
      }

      Alert.alert('Period Reminder Dispatched! 🔔', detailMsg, [{ text: 'OK' }]);
      const [notifData, alertData, statusData] = await Promise.all([
        PadzyraApi.getNotificationHistory().catch(() => []),
        PadzyraApi.getTodayAlert().catch(() => null),
        PadzyraApi.getFcmStatus().catch(() => null),
      ]);
      setNotificationHistory(notifData || []);
      setTodayAlert(alertData || null);
      setFcmStatus(statusData || null);
    } catch (err: any) {
      Alert.alert('Reminder Error', err?.message || 'Could not send reminder');
    } finally {
      setSendingReminder(false);
    }
  };

  const handleQuickRestock = async () => {
    setRestocking(true);
    try {
      await PadzyraApi.pickupSupplies(restockKind, restockQty);
      Alert.alert('Bag Restocked', `Successfully added ${restockQty} ${restockKind} pad(s) to your pouch.`);
      setShowRestock(false);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not restock pads');
    } finally {
      setRestocking(false);
    }
  };

  const openDirections = (shop: any) => {
    if (!shop) return;
    const lat = shop.lat || 12.9716;
    const lng = shop.lng || 77.5946;
    const shopName = shop.name || 'Partner Pharmacy';
    const label = encodeURIComponent(shopName);
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${lat},${lng}`;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });

    Linking.openURL(url!).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return {
          label: 'COUNTER READY',
          color: '#2e7d32',
          bg: '#e8f5e9',
          border: '#a5d6a7',
          icon: 'gift-outline',
          subtext: 'Sealed & waiting at counter',
        };
      case 'accepted':
        return {
          label: 'PACKAGING',
          color: colors.plum,
          bg: '#f3e5f5',
          border: '#ce93d8',
          icon: 'cube-outline',
          subtext: 'Pharmacist preparing in opaque pouch',
        };
      case 'pending':
        return {
          label: 'DISPATCHED',
          color: '#e65100',
          bg: '#fff3e0',
          border: '#ffcc80',
          icon: 'time-outline',
          subtext: 'Awaiting pharmacy counter acknowledgement',
        };
      case 'picked-up':
      case 'picked_up':
        return {
          label: 'COLLECTED',
          color: '#00838f',
          bg: '#e0f7fa',
          border: '#80deea',
          icon: 'checkmark-done-circle-outline',
          subtext: 'Package safely picked up',
        };
      case 'cancelled':
        return {
          label: 'CANCELLED',
          color: '#757575',
          bg: '#eeeeee',
          border: '#e0e0e0',
          icon: 'close-circle-outline',
          subtext: 'Request cancelled',
        };
      default:
        return {
          label: status.toUpperCase(),
          color: colors.rose,
          bg: '#faf2f6',
          border: colors.line,
          icon: 'information-circle-outline',
          subtext: '',
        };
    }
  };

  // Partition orders into active and past
  const activeOrders = orders.filter((o) => ['pending', 'accepted', 'ready'].includes(o.status));
  const pastOrders = orders.filter((o) => !['pending', 'accepted', 'ready'].includes(o.status));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData();
          }}
          tintColor={colors.plum}
        />
      }
    >
      {/* Top Professional Header */}
      <View style={styles.topBar}>
        <View style={styles.topBarTextContainer}>
          <Text style={styles.brandTitle}>Orders & Activity</Text>
          <Text style={styles.brandSubtitle}>Discreet pharmacy pickups & pad history</Text>
        </View>

        <TouchableOpacity
          style={styles.headerRefreshBtn}
          onPress={() => {
            setRefreshing(true);
            loadData();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="sync-outline" size={18} color={colors.plum} />
        </TouchableOpacity>
      </View>

      {/* Confidential Dispatch Trust Banner */}
      <View style={styles.trustBanner}>
        <View style={styles.trustBannerHeader}>
          <Ionicons name="shield-checkmark" size={16} color={colors.plum} />
          <Text style={styles.trustBannerTitle}>100% Confidential Healthcare Dispatch</Text>
        </View>
        <View style={styles.trustPillsRow}>
          <View style={styles.trustPill}>
            <Ionicons name="lock-closed" size={11} color={colors.plum} />
            <Text style={styles.trustPillText}>No Names Shared</Text>
          </View>
          <View style={styles.trustPill}>
            <Ionicons name="cube" size={11} color={colors.plum} />
            <Text style={styles.trustPillText}>Sealed Opaque Pouch</Text>
          </View>
          <View style={styles.trustPill}>
            <Ionicons name="chatbubble-ellipses" size={11} color={colors.plum} />
            <Text style={styles.trustPillText}>Zero Questions Asked</Text>
          </View>
        </View>
      </View>

      {/* Segmented Sub-Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'orders' && styles.tabItemActive]}
          onPress={() => setActiveTab('orders')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="receipt-outline"
            size={16}
            color={activeTab === 'orders' ? colors.white : colors.rose}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabText, activeTab === 'orders' && styles.tabTextActive]}>
            Orders
          </Text>
          {activeOrders.length > 0 ? (
            <View style={styles.activeOrdersBadge}>
              <Text style={styles.activeOrdersBadgeText}>{activeOrders.length}</Text>
            </View>
          ) : (
            <Text style={[styles.tabCountMuted, activeTab === 'orders' && styles.tabCountActive]}>
              ({orders.length})
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'supplies' && styles.tabItemActive]}
          onPress={() => setActiveTab('supplies')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="cube-outline"
            size={16}
            color={activeTab === 'supplies' ? colors.white : colors.rose}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabText, activeTab === 'supplies' && styles.tabTextActive]}>
            Pad Log
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'alerts' && styles.tabItemActive]}
          onPress={() => setActiveTab('alerts')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="notifications-outline"
            size={16}
            color={activeTab === 'alerts' ? colors.white : colors.rose}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabText, activeTab === 'alerts' && styles.tabTextActive]}>
            Alerts
          </Text>
          {todayAlert && <View style={styles.alertDotIndicator} />}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.plum} />
          <Text style={styles.loadingText}>Syncing dispatch activity...</Text>
        </View>
      ) : null}

      {/* ================= TAB 1: EMERGENCY ORDERS ================= */}
      {!loading && activeTab === 'orders' && (
        <View>
          {/* Active Orders Section */}
          {activeOrders.length > 0 && (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.pulseDot} />
                <Text style={styles.sectionHeaderTitle}>ACTIVE EMERGENCY DISPATCH</Text>
                <View style={styles.activeCountTag}>
                  <Text style={styles.activeCountTagText}>
                    {activeOrders.length} In Progress
                  </Text>
                </View>
              </View>

              {activeOrders.map((order) => {
                const badge = getStatusBadge(order.status);
                const isPending = order.status === 'pending';
                const isAccepted = order.status === 'accepted';
                const isReady = order.status === 'ready';
                const shopObj = typeof order.shop === 'object' ? order.shop : null;
                const shopName = shopObj?.name || (typeof order.shop === 'string' ? order.shop : 'Partner Pharmacy');
                const shopAddress = shopObj?.address || order.address;
                const shopPhone = shopObj?.phone;
                const isCopied = copiedOrderId === order.id;

                return (
                  <View key={order.id} style={styles.ticketCard}>
                    {/* Perforation Left / Right Notches */}
                    <View style={styles.notchLeft} />
                    <View style={styles.notchRight} />

                    {/* Ticket Header */}
                    <View style={styles.ticketHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.pharmacyTitleRow}>
                          <Ionicons name="storefront" size={15} color={colors.plum} style={{ marginRight: 6 }} />
                          <Text style={styles.ticketPharmacyName} numberOfLines={1}>
                            {shopName}
                          </Text>
                          <Ionicons name="shield-checkmark" size={14} color="#2f7a52" style={{ marginLeft: 4 }} />
                        </View>
                        <Text style={styles.ticketTimestamp}>
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Requested just now'}
                        </Text>
                      </View>

                      {/* Status Pill */}
                      <View
                        style={[
                          styles.ticketStatusBadge,
                          { backgroundColor: badge.bg, borderColor: badge.border },
                        ]}
                      >
                        <Ionicons name={badge.icon} size={12} color={badge.color} style={{ marginRight: 4 }} />
                        <Text style={[styles.ticketStatusBadgeText, { color: badge.color }]}>
                          {badge.label}
                        </Text>
                      </View>
                    </View>

                    {/* Counter Pickup Code Spotlight Box */}
                    <View style={styles.counterCodeBox}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.counterCodeLabel}>DISCREET COUNTER PICKUP CODE</Text>
                        <Text style={styles.counterCodeText}>#{order.orderNumber}</Text>
                      </View>

                      <TouchableOpacity
                        style={[styles.copyCodeBtn, isCopied && styles.copyCodeBtnSuccess]}
                        onPress={() => handleCopyCode(order.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={isCopied ? 'checkmark' : 'copy-outline'}
                          size={14}
                          color={isCopied ? colors.white : colors.plum}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.copyCodeBtnText, isCopied && { color: colors.white }]}>
                          {isCopied ? 'Copied' : 'Copy'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Stepper Progress Bar */}
                    <View style={styles.stepperContainer}>
                      <View style={styles.stepItem}>
                        <View style={[styles.stepCircle, styles.stepCircleDone]}>
                          <Ionicons name="checkmark" size={11} color={colors.white} />
                        </View>
                        <Text style={styles.stepLabelActive}>Sent</Text>
                      </View>
                      <View style={[styles.stepTrack, (isAccepted || isReady) && styles.stepTrackActive]} />
                      <View style={styles.stepItem}>
                        <View
                          style={[
                            styles.stepCircle,
                            isAccepted && styles.stepCircleCurrent,
                            isReady && styles.stepCircleDone,
                          ]}
                        >
                          {isAccepted ? (
                            <ActivityIndicator size="small" color={colors.white} style={{ transform: [{ scale: 0.55 }] }} />
                          ) : isReady ? (
                            <Ionicons name="checkmark" size={11} color={colors.white} />
                          ) : (
                            <Text style={styles.stepNumber}>2</Text>
                          )}
                        </View>
                        <Text style={[styles.stepLabel, (isAccepted || isReady) && styles.stepLabelActive]}>
                          Packaging
                        </Text>
                      </View>
                      <View style={[styles.stepTrack, isReady && styles.stepTrackActive]} />
                      <View style={styles.stepItem}>
                        <View style={[styles.stepCircle, isReady && styles.stepCircleReady]}>
                          {isReady ? (
                            <Ionicons name="sparkles" size={11} color={colors.white} />
                          ) : (
                            <Text style={styles.stepNumber}>3</Text>
                          )}
                        </View>
                        <Text style={[styles.stepLabel, isReady && styles.stepLabelReady]}>
                          Ready
                        </Text>
                      </View>
                    </View>

                    {/* Itemized Specification Box */}
                    <View style={styles.specBox}>
                      <View style={styles.specRow}>
                        <Ionicons name="bag-handle-outline" size={15} color={colors.plum} style={{ marginRight: 8 }} />
                        <Text style={styles.specLabel}>Package:</Text>
                        <Text style={styles.specValue}>
                          {order.qty}x {order.kind === 'day' ? 'Day' : 'Night'} Pads ({order.size ? order.size.toUpperCase() : 'REGULAR'})
                        </Text>
                      </View>

                      {shopAddress && (
                        <View style={[styles.specRow, { marginTop: 6 }]}>
                          <Ionicons name="location-outline" size={15} color={colors.rose} style={{ marginRight: 8 }} />
                          <Text style={styles.specAddress} numberOfLines={2}>
                            {shopAddress}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Verbal Counter Pickup Phrase Banner */}
                    <View style={styles.verbalGuideBanner}>
                      <Ionicons name="chatbubbles-outline" size={15} color={colors.plum} style={{ marginRight: 8, marginTop: 1 }} />
                      <Text style={styles.verbalGuideText}>
                        Say to counter: <Text style={styles.verbalGuideBold}>"Padzyra pickup #{order.orderNumber}"</Text> or show this pass.
                      </Text>
                    </View>

                    {/* Primary & Secondary Action CTAs */}
                    <View style={styles.ticketActionsRow}>
                      {/* Mark Collected CTA */}
                      {(isReady || isAccepted) && (
                        <TouchableOpacity
                          style={styles.pickupSuccessBtn}
                          onPress={() => handleConfirmPickup(order.id, order.orderNumber)}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="checkmark-done" size={16} color={colors.white} style={{ marginRight: 6 }} />
                          <Text style={styles.pickupSuccessBtnText}>I Picked It Up</Text>
                        </TouchableOpacity>
                      )}

                      {/* Map Directions */}
                      <TouchableOpacity
                        style={styles.actionPillBtn}
                        onPress={() => openDirections(shopObj || { name: shopName, address: shopAddress })}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="navigate" size={14} color={colors.plum} style={{ marginRight: 5 }} />
                        <Text style={styles.actionPillBtnText}>Directions</Text>
                      </TouchableOpacity>

                      {/* Phone Call */}
                      {shopPhone && (
                        <TouchableOpacity
                          style={styles.actionPillBtn}
                          onPress={() => Linking.openURL(`tel:${shopPhone}`)}
                          activeOpacity={0.75}
                        >
                          <Ionicons name="call" size={14} color={colors.plum} style={{ marginRight: 5 }} />
                          <Text style={styles.actionPillBtnText}>Call</Text>
                        </TouchableOpacity>
                      )}

                      {/* Cancel Order */}
                      {isPending && (
                        <TouchableOpacity
                          style={styles.cancelPillBtn}
                          onPress={() => handleCancelOrder(order.id, order.orderNumber)}
                          activeOpacity={0.75}
                        >
                          <Ionicons name="close-circle-outline" size={14} color="#d32f2f" style={{ marginRight: 5 }} />
                          <Text style={styles.cancelPillBtnText}>Cancel</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Past Orders History Section */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="time-outline" size={15} color={colors.rose} style={{ marginRight: 6 }} />
              <Text style={styles.sectionHeaderTitle}>DISPATCH HISTORY & RECEIPTS</Text>
            </View>

            {pastOrders.length === 0 && activeOrders.length === 0 ? (
              <Card>
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="receipt-outline" size={36} color={colors.plum} />
                  </View>
                  <Text style={styles.emptyTitle}>No Emergency Orders Yet</Text>
                  <Text style={styles.emptySubtitle}>
                    When you request discreet emergency pads from a nearby partner pharmacy, your live packaging tracker and digital pickup pass will appear here.
                  </Text>
                  {onNavigateToNow && (
                    <TouchableOpacity
                      style={styles.emergencyCtaBtn}
                      onPress={onNavigateToNow}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="flash" size={16} color={colors.white} style={{ marginRight: 8 }} />
                      <Text style={styles.emergencyCtaBtnText}>Find Emergency Pads Nearby</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            ) : pastOrders.length === 0 ? (
              <Card>
                <View style={[styles.emptyContainer, { paddingVertical: 20 }]}>
                  <Ionicons name="checkmark-circle-outline" size={28} color="#2f7a52" style={{ marginBottom: 6 }} />
                  <Text style={styles.emptySubtitle}>No previous completed orders yet.</Text>
                </View>
              </Card>
            ) : (
              pastOrders.map((order) => {
                const badge = getStatusBadge(order.status);
                const shopObj = typeof order.shop === 'object' ? order.shop : null;
                const shopName = shopObj?.name || (typeof order.shop === 'string' ? order.shop : 'Partner Pharmacy');

                return (
                  <View key={order.id} style={styles.historyCard}>
                    <View style={styles.historyCardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={styles.historyOrderNumber}>Order #{order.orderNumber}</Text>
                          <View
                            style={[
                              styles.historyBadge,
                              { backgroundColor: badge.bg, borderColor: badge.border },
                            ]}
                          >
                            <Text style={[styles.historyBadgeText, { color: badge.color }]}>
                              {badge.label}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.historyTime}>
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.historyDetails}>
                      <View style={styles.historyDetailRow}>
                        <Ionicons name="bag-check-outline" size={14} color={colors.plum} style={{ marginRight: 6 }} />
                        <Text style={styles.historyDetailText}>
                          <Text style={{ fontWeight: '800' }}>{order.qty}x</Text> {order.kind} pads ({order.size || 'regular'})
                        </Text>
                      </View>
                      <View style={[styles.historyDetailRow, { marginTop: 4 }]}>
                        <Ionicons name="storefront-outline" size={14} color={colors.rose} style={{ marginRight: 6 }} />
                        <Text style={styles.historyDetailTextMuted} numberOfLines={1}>
                          {shopName}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
      )}

      {/* ================= TAB 2: PAD LOG / SUPPLIES ================= */}
      {!loading && activeTab === 'supplies' && (
        <View>
          {/* Quick Bag Restock Card */}
          <Card>
            <View style={styles.cardHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="bag-add-outline" size={16} color={colors.plum} style={{ marginRight: 6 }} />
                <Text style={styles.cardHeader}>ON-THE-GO BAG RESTOCK</Text>
              </View>
              <TouchableOpacity
                style={styles.toggleRestockBtn}
                onPress={() => setShowRestock(!showRestock)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={showRestock ? 'close' : 'add'}
                  size={14}
                  color={colors.plum}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.toggleRestockBtnText}>
                  {showRestock ? 'Cancel' : 'Add Pads'}
                </Text>
              </TouchableOpacity>
            </View>

            {showRestock ? (
              <View style={styles.restockFormBox}>
                <Text style={styles.restockFormLabel}>Select pad type to replenish in your bag:</Text>

                <View style={styles.chipsRow}>
                  {(['day', 'night'] as const).map((kind) => (
                    <TouchableOpacity
                      key={kind}
                      style={[styles.chip, restockKind === kind && styles.chipActive]}
                      onPress={() => setRestockKind(kind)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={kind === 'day' ? 'sunny-outline' : 'moon-outline'}
                        size={14}
                        color={restockKind === kind ? colors.white : colors.plum}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.chipText, restockKind === kind && styles.chipTextActive]}>
                        {kind === 'day' ? 'Day Pad (Light)' : 'Night Pad (Overnight)'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.restockFormLabel, { marginTop: 12 }]}>Quantity to add:</Text>
                <View style={styles.qtyRow}>
                  {[1, 2, 3, 5].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[styles.qtyChip, restockQty === num && styles.qtyChipActive]}
                      onPress={() => setRestockQty(num)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.qtyChipText, restockQty === num && styles.qtyChipTextActive]}>
                        +{num} {num === 1 ? 'Pad' : 'Pads'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.restockSubmitBtn}
                  onPress={handleQuickRestock}
                  disabled={restocking}
                  activeOpacity={0.85}
                >
                  {restocking ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Ionicons name="bag-check-outline" size={16} color={colors.white} style={{ marginRight: 6 }} />
                      <Text style={styles.restockSubmitBtnText}>Save Restock to Bag</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.mutedText}>
                Keep accurate inventory of what's inside your emergency bag pouch. Restocking here keeps your cycle alerts timely.
              </Text>
            )}
          </Card>

          {/* Supplies Usage Timeline */}
          {suppliesHistory.length === 0 ? (
            <Card>
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="cube-outline" size={36} color={colors.plum} />
                </View>
                <Text style={styles.emptyTitle}>No Pad Usage Logged Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Every time you use or pack a pad, your confidential history will be saved here to track monthly usage patterns.
                </Text>
              </View>
            </Card>
          ) : (
            <Card>
              <View style={styles.cardHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="time-outline" size={16} color={colors.rose} style={{ marginRight: 6 }} />
                  <Text style={styles.cardHeader}>USAGE & RESTOCK TIMELINE</Text>
                </View>
                <Text style={styles.logCountBadge}>{suppliesHistory.length} logs</Text>
              </View>

              {suppliesHistory.map((item, index) => {
                const isRestock = item.reason === 'pickup' || item.reason === 'restock';
                return (
                  <View
                    key={item.id || index}
                    style={[
                      styles.logItemRow,
                      index < suppliesHistory.length - 1 && styles.logItemBorder,
                    ]}
                  >
                    <View
                      style={[
                        styles.logIconBox,
                        { backgroundColor: isRestock ? '#e8f5e9' : '#fce4ec' },
                      ]}
                    >
                      <Ionicons
                        name={isRestock ? 'arrow-down-circle' : 'arrow-up-circle'}
                        size={18}
                        color={isRestock ? '#2e7d32' : colors.plum}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.logTitle}>
                        {isRestock ? `Added ${item.qty} ${item.kind} pad(s)` : `Used ${item.qty} ${item.kind} pad(s)`}
                      </Text>
                      <Text style={styles.logSubtitle}>
                        Location: {item.place ? item.place.toUpperCase() : 'BAG'} · {item.reason || 'manual log'}
                      </Text>
                    </View>

                    <Text style={styles.logDate}>
                      {item.usedOn || (item.createdAt ? new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '')}
                    </Text>
                  </View>
                );
              })}
            </Card>
          )}
        </View>
      )}

      {/* ================= TAB 3: ALERTS & REMINDERS ================= */}
      {!loading && activeTab === 'alerts' && (
        <View>
          {/* Active Today Alert */}
          {todayAlert && (
            <Card style={styles.todayAlertCard}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="sparkles" size={16} color={colors.plum} style={{ marginRight: 6 }} />
                  <Text style={[styles.cardHeader, { color: colors.plum }]}>TODAY'S REMINDER</Text>
                </View>
                <TouchableOpacity onPress={handleDismissAlert} activeOpacity={0.7}>
                  <Ionicons name="close" size={18} color={colors.rose} />
                </TouchableOpacity>
              </View>
              <Text style={styles.alertTitle}>{todayAlert.title || 'Cycle Check-in'}</Text>
              <Text style={styles.alertText}>{todayAlert.text || 'Keep an emergency pad in your bag today.'}</Text>
            </Card>
          )}

          {/* Discreet Privacy Shield Explanation */}
          <Card>
            <View style={styles.cardHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="shield-checkmark" size={16} color={colors.plum} style={{ marginRight: 6 }} />
                <Text style={styles.cardHeader}>DISCREET LOCKSCREEN REMINDERS</Text>
              </View>
            </View>
            <Text style={styles.mutedText}>
              Padzyra notifications are completely disguised as daily wellness reminders (such as hydration or posture checks) so your personal cycle schedule stays 100% private.
            </Text>
          </Card>

          {/* Firebase Cloud Messaging Reminder Trigger */}
          <Card>
            <View style={styles.cardHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="notifications-circle" size={18} color={colors.rose} style={{ marginRight: 6 }} />
                <Text style={styles.cardHeader}>FIREBASE PERIOD REMINDERS</Text>
              </View>
              <View style={[styles.fcmBadge, { backgroundColor: fcmStatus?.firebaseInitialized !== false ? '#e8f5e9' : '#fff3e0' }]}>
                <Ionicons name="flash-outline" size={11} color={fcmStatus?.firebaseInitialized !== false ? '#2e7d32' : '#e65100'} style={{ marginRight: 3 }} />
                <Text style={[styles.fcmBadgeText, { color: fcmStatus?.firebaseInitialized !== false ? '#2e7d32' : '#e65100' }]}>
                  {fcmStatus?.firebaseInitialized !== false ? 'FCM Connected' : 'FCM Ready'}
                </Text>
              </View>
            </View>
            <Text style={styles.mutedText}>
              Padzyra sends automated push notifications for pad change intervals, upcoming periods, hydration, and bedtime protection.
            </Text>

            {/* Device Registration Banner */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fcebf4', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, marginTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                <Ionicons name="phone-portrait-outline" size={15} color={colors.plum} style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 12, color: colors.plum, fontWeight: '600' }}>
                  {fcmStatus?.tokensCount != null
                    ? `${fcmStatus.tokensCount} device(s) registered`
                    : 'Device registered for alerts'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleRegisterDevice}
                activeOpacity={0.7}
                style={{ paddingVertical: 4, paddingHorizontal: 8, backgroundColor: colors.white, borderRadius: 8, borderWidth: 1, borderColor: '#f4a7c5' }}
              >
                <Text style={{ fontSize: 11, color: colors.rose, fontWeight: '700' }}>Register Device</Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.fcmSubmitBtn, { backgroundColor: colors.plum, marginBottom: 8 }]}
                activeOpacity={0.8}
                onPress={() => handleSendReminder('test')}
                disabled={sendingReminder}
              >
                {sendingReminder ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="paper-plane-outline" size={16} color={colors.white} style={{ marginRight: 6 }} />
                    <Text style={styles.fcmSubmitBtnText}>Send Test Reminder (Firebase)</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.plum, marginTop: 4, marginBottom: 6 }}>
                Trigger Real-Time Period Reminders:
              </Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <TouchableOpacity
                  style={[styles.trustPill, { borderColor: '#e11d48', backgroundColor: '#fff1f2', paddingVertical: 6 }]}
                  onPress={() => handleSendReminder('eve')}
                  disabled={sendingReminder}
                >
                  <Ionicons name="water" size={13} color="#e11d48" />
                  <Text style={[styles.trustPillText, { color: '#e11d48', fontWeight: '700' }]}>Period Tomorrow</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.trustPill, { borderColor: colors.rose, paddingVertical: 6 }]}
                  onPress={() => handleSendReminder('pack')}
                  disabled={sendingReminder}
                >
                  <Ionicons name="briefcase-outline" size={13} color={colors.plum} />
                  <Text style={[styles.trustPillText, { color: colors.plum }]}>In 2 Days</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.trustPill, { borderColor: colors.rose, paddingVertical: 6 }]}
                  onPress={() => handleSendReminder('chg14')}
                  disabled={sendingReminder}
                >
                  <Ionicons name="time-outline" size={13} color={colors.plum} />
                  <Text style={[styles.trustPillText, { color: colors.plum }]}>Pad Change (4h)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.trustPill, { borderColor: colors.rose, paddingVertical: 6 }]}
                  onPress={() => handleSendReminder('lunch')}
                  disabled={sendingReminder}
                >
                  <Ionicons name="restaurant-outline" size={13} color={colors.plum} />
                  <Text style={[styles.trustPillText, { color: colors.plum }]}>Lunchtime Check</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.trustPill, { borderColor: colors.rose, paddingVertical: 6 }]}
                  onPress={() => handleSendReminder('night')}
                  disabled={sendingReminder}
                >
                  <Ionicons name="moon-outline" size={13} color={colors.plum} />
                  <Text style={[styles.trustPillText, { color: colors.plum }]}>Night Pad</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.trustPill, { borderColor: colors.rose, paddingVertical: 6 }]}
                  onPress={() => handleSendReminder('heat')}
                  disabled={sendingReminder}
                >
                  <Ionicons name="flame-outline" size={13} color={colors.plum} />
                  <Text style={[styles.trustPillText, { color: colors.plum }]}>Warm Compress</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.trustPill, { borderColor: colors.rose, paddingVertical: 6 }]}
                  onPress={() => handleSendReminder('pms')}
                  disabled={sendingReminder}
                >
                  <Ionicons name="heart-outline" size={13} color={colors.plum} />
                  <Text style={[styles.trustPillText, { color: colors.plum }]}>PMS Self-Care</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.trustPill, { borderColor: '#d97706', paddingVertical: 6 }]}
                  onPress={() => handleSendReminder('low')}
                  disabled={sendingReminder}
                >
                  <Ionicons name="alert-circle-outline" size={13} color="#d97706" />
                  <Text style={[styles.trustPillText, { color: "#d97706" }]}>Low Pad Alert</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>

          {/* Notification History List */}
          {notificationHistory.length === 0 ? (
            <Card>
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="notifications-off-outline" size={36} color={colors.plum} />
                </View>
                <Text style={styles.emptyTitle}>No Dispatched Alerts Yet</Text>
                <Text style={styles.emptySubtitle}>
                  When discreet cycle reminders or pouch replenishment alerts are triggered, their delivery receipts will appear here.
                </Text>
              </View>
            </Card>
          ) : (
            <Card>
              <View style={styles.cardHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="list-outline" size={16} color={colors.rose} style={{ marginRight: 6 }} />
                  <Text style={styles.cardHeader}>NOTIFICATION DISPATCH HISTORY</Text>
                </View>
                <Text style={styles.logCountBadge}>{notificationHistory.length} alerts</Text>
              </View>

              {notificationHistory.map((notif, index) => (
                <View
                  key={notif.id || index}
                  style={[
                    styles.logItemRow,
                    index < notificationHistory.length - 1 && styles.logItemBorder,
                  ]}
                >
                  <View style={[styles.logIconBox, { backgroundColor: '#f3e5f5' }]}>
                    <Ionicons name="notifications-outline" size={18} color={colors.plum} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.logTitle}>
                      {notif.kind ? notif.kind.toUpperCase() : 'ALERT'} Prompt
                    </Text>
                    <Text style={styles.logSubtitle}>
                      Cycle Day Target: {notif.day}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.logDate}>
                      {new Date(notif.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </Text>
                    {notif.usedAt && (
                      <Ionicons name="checkmark-done" size={14} color="#2e7d32" style={{ marginTop: 2 }} />
                    )}
                  </View>
                </View>
              ))}
            </Card>
          )}
        </View>
      )}

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
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  topBarTextContainer: {
    flex: 1,
  },
  brandSubtitle: {
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '800',
    color: colors.rose,
    marginBottom: 2,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.ink,
  },
  headerRefreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustBanner: {
    backgroundColor: '#fbf4f8',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    marginBottom: 16,
  },
  trustBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  trustBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.plum,
    marginLeft: 6,
  },
  trustPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  trustPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eedde7',
  },
  trustPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.ink,
    marginLeft: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#eedde7',
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    backgroundColor: colors.plum,
    shadowColor: colors.plum,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.rose,
  },
  tabTextActive: {
    color: colors.white,
  },
  tabCountMuted: {
    fontSize: 11,
    color: colors.rose,
    marginLeft: 4,
  },
  tabCountActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  activeOrdersBadge: {
    backgroundColor: '#e65100',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: 6,
  },
  activeOrdersBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  alertDotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.pink,
    marginLeft: 6,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: colors.rose,
    marginTop: 10,
    fontWeight: '600',
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e65100',
    marginRight: 8,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: '800',
    color: colors.rose,
    flex: 1,
  },
  activeCountTag: {
    backgroundColor: '#fff3e0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffcc80',
  },
  activeCountTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#e65100',
  },
  // Ticket / Boarding Pass Styles
  ticketCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: colors.plum,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  notchLeft: {
    position: 'absolute',
    left: -10,
    top: '38%',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.blush,
    borderWidth: 1,
    borderColor: colors.line,
    zIndex: 10,
  },
  notchRight: {
    position: 'absolute',
    right: -10,
    top: '38%',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.blush,
    borderWidth: 1,
    borderColor: colors.line,
    zIndex: 10,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  pharmacyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ticketPharmacyName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
    maxWidth: 180,
  },
  ticketTimestamp: {
    fontSize: 11,
    color: colors.rose,
    marginTop: 2,
  },
  ticketStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  ticketStatusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  counterCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#faf2f6',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eedde7',
    marginBottom: 14,
  },
  counterCodeLabel: {
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '800',
    color: colors.rose,
    marginBottom: 2,
  },
  counterCodeText: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.plum,
    letterSpacing: 1.5,
  },
  copyCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.plum,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyCodeBtnSuccess: {
    backgroundColor: '#2e7d32',
    borderColor: '#2e7d32',
  },
  copyCodeBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.plum,
  },
  // Stepper
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  stepItem: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0e6ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepCircleCurrent: {
    backgroundColor: colors.plum,
  },
  stepCircleDone: {
    backgroundColor: '#2e7d32',
  },
  stepCircleReady: {
    backgroundColor: '#2e7d32',
  },
  stepNumber: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.rose,
  },
  stepLabel: {
    fontSize: 10,
    color: colors.rose,
    fontWeight: '600',
  },
  stepLabelActive: {
    color: colors.plum,
    fontWeight: '800',
  },
  stepLabelReady: {
    color: '#2e7d32',
    fontWeight: '800',
  },
  stepTrack: {
    flex: 1,
    height: 2,
    backgroundColor: '#eedde7',
    marginHorizontal: 6,
    marginBottom: 14,
  },
  stepTrackActive: {
    backgroundColor: '#2e7d32',
  },
  specBox: {
    backgroundColor: '#fbf4f8',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  specLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.rose,
    marginRight: 6,
  },
  specValue: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink,
  },
  specAddress: {
    fontSize: 11,
    color: colors.rose,
    flex: 1,
  },
  verbalGuideBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff9fa',
    borderWidth: 1,
    borderColor: '#fce4ec',
    borderRadius: 10,
    padding: 8,
    marginBottom: 14,
  },
  verbalGuideText: {
    fontSize: 11,
    color: colors.ink,
    lineHeight: 16,
    flex: 1,
  },
  verbalGuideBold: {
    fontWeight: '800',
    color: colors.plum,
  },
  ticketActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  pickupSuccessBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2e7d32',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  pickupSuccessBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  actionPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fbf4f8',
    borderWidth: 1,
    borderColor: '#eedde7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  actionPillBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.plum,
  },
  cancelPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#ffcdd2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  cancelPillBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d32f2f',
  },
  // History Cards
  historyCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  historyOrderNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
    marginRight: 8,
  },
  historyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  historyBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  historyTime: {
    fontSize: 10,
    color: colors.rose,
    marginTop: 2,
  },
  historyDetails: {
    backgroundColor: '#faf2f6',
    borderRadius: 8,
    padding: 8,
  },
  historyDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyDetailText: {
    fontSize: 12,
    color: colors.ink,
  },
  historyDetailTextMuted: {
    fontSize: 11,
    color: colors.rose,
  },
  // Empty states
  emptyContainer: {
    paddingVertical: 28,
    alignItems: 'center',
    textAlign: 'center',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#faf2f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#eedde7',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.ink,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.rose,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  emergencyCtaBtn: {
    flexDirection: 'row',
    backgroundColor: colors.plum,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: colors.plum,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  emergencyCtaBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  // Supplies Tab
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardHeader: {
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: '800',
    color: colors.rose,
  },
  logCountBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.rose,
  },
  mutedText: {
    fontSize: 13,
    color: colors.rose,
    lineHeight: 19,
  },
  toggleRestockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5ebf1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  toggleRestockBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.plum,
  },
  restockFormBox: {
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  restockFormLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 8,
  },
  chipActive: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
  },
  chipTextActive: {
    color: colors.white,
  },
  qtyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  qtyChip: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyChipActive: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
  },
  qtyChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  qtyChipTextActive: {
    color: colors.white,
  },
  restockSubmitBtn: {
    marginTop: 14,
    flexDirection: 'row',
    backgroundColor: colors.plum,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.plum,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  restockSubmitBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  logItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  logItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  logIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
  },
  logSubtitle: {
    fontSize: 11,
    color: colors.rose,
    marginTop: 2,
  },
  logDate: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.rose,
  },
  // Alerts Tab
  todayAlertCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.plum,
    marginBottom: 14,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 4,
  },
  alertText: {
    fontSize: 13,
    color: colors.rose,
    lineHeight: 18,
  },
  fcmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  fcmBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  fcmSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
  },
  fcmSubmitBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
});
