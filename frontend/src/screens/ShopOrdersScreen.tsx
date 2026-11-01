import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme/colors';
import { Card } from '../components/Card';
import { PadzyraApi } from '../api/client';

export const ShopOrdersScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);

  const loadOrders = async () => {
    try {
      const data = await PadzyraApi.getShopOrders();
      setOrders(data || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleStatusUpdate = async (
    orderId: string,
    status: 'accepted' | 'ready' | 'cancelled'
  ) => {
    try {
      await PadzyraApi.updateShopOrderStatus(orderId, status);
      loadOrders();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not update order status');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadOrders();
          }}
          tintColor={colors.pink}
        />
      }
    >
      <View style={styles.topBar}>
        <Text style={styles.brandSubtitle}>PADZYRA PARTNER</Text>
        <Text style={styles.brandTitle}>Incoming Orders</Text>
      </View>

      <View style={styles.privacyBanner}>
        <Ionicons name="shield-checkmark" size={16} color={colors.plum} style={{ marginRight: 8 }} />
        <Text style={styles.privacyBannerText}>
          Customer Privacy Protected: Customer identity and cycle data are 100% confidential. Hand over pads using Order # only.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.pink} style={{ marginTop: 40 }} />
      ) : orders.length === 0 ? (
        <Card>
          <View style={styles.emptyContainer}>
            <Ionicons name="file-tray-outline" size={36} color={colors.rose} style={{ marginBottom: 8, opacity: 0.7 }} />
            <Text style={styles.emptyText}>No emergency pad orders right now.</Text>
          </View>
        </Card>
      ) : (
        orders.map((ord) => (
          <Card key={ord.id} style={styles.orderCard}>
            <View style={styles.orderHeader}>
              <View style={styles.orderNumRow}>
                <Ionicons name="receipt-outline" size={16} color={colors.plum} style={{ marginRight: 6 }} />
                <Text style={styles.orderNum}>Order #{ord.orderNumber}</Text>
              </View>
              <View style={[styles.statusPill, ord.status === 'ready' && styles.statusReady]}>
                <Text style={styles.statusText}>{ord.status.toUpperCase()}</Text>
              </View>
            </View>

            <Text style={styles.orderDetail}>
              {ord.kind} ({ord.size}) × {ord.qty}
            </Text>

            {ord.address ? (
              <View style={styles.noteRow}>
                <Ionicons name="chatbubble-ellipses-outline" size={13} color={colors.rose} style={{ marginRight: 4 }} />
                <Text style={styles.orderNote}>Note: {ord.address}</Text>
              </View>
            ) : null}

            {ord.phone ? (
              <View style={styles.phoneRow}>
                <Ionicons name="shield-outline" size={13} color={colors.rose} style={{ marginRight: 4 }} />
                <Text style={styles.orderContact}>Phone (Masked): {ord.phone}</Text>
              </View>
            ) : null}

            {/* Action buttons depending on order status */}
            <View style={styles.actionsRow}>
              {ord.status === 'pending' ? (
                <>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnPrimary]}
                    onPress={() => handleStatusUpdate(ord.id, 'accepted')}
                  >
                    <View style={styles.btnContent}>
                      <Ionicons name="checkmark-outline" size={15} color={colors.white} style={{ marginRight: 4 }} />
                      <Text style={styles.btnPrimaryText}>Accept</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnGhost]}
                    onPress={() => handleStatusUpdate(ord.id, 'cancelled')}
                  >
                    <View style={styles.btnContent}>
                      <Ionicons name="close-outline" size={15} color={colors.rose} style={{ marginRight: 4 }} />
                      <Text style={styles.btnGhostText}>Cancel</Text>
                    </View>
                  </TouchableOpacity>
                </>
              ) : ord.status === 'accepted' ? (
                <>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnPrimary]}
                    onPress={() => handleStatusUpdate(ord.id, 'ready')}
                  >
                    <View style={styles.btnContent}>
                      <Ionicons name="checkmark-done-outline" size={15} color={colors.white} style={{ marginRight: 4 }} />
                      <Text style={styles.btnPrimaryText}>Mark Ready</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnGhost]}
                    onPress={() => handleStatusUpdate(ord.id, 'cancelled')}
                  >
                    <View style={styles.btnContent}>
                      <Ionicons name="close-outline" size={15} color={colors.rose} style={{ marginRight: 4 }} />
                      <Text style={styles.btnGhostText}>Cancel</Text>
                    </View>
                  </TouchableOpacity>
                </>
              ) : ord.status === 'ready' ? (
                <TouchableOpacity
                  style={[styles.btn, styles.btnGhost]}
                  onPress={() => handleStatusUpdate(ord.id, 'cancelled')}
                >
                  <View style={styles.btnContent}>
                    <Ionicons name="close-outline" size={15} color={colors.rose} style={{ marginRight: 4 }} />
                    <Text style={styles.btnGhostText}>Cancel</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>
          </Card>
        ))
      )}

      <View style={{ height: 90 }} />
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
    paddingTop: 20,
    maxWidth: 440,
    alignSelf: 'center',
    width: '100%',
  },
  topBar: {
    marginBottom: 16,
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.rose,
    letterSpacing: 1.5,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.plum,
    letterSpacing: -0.5,
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eedde7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2cbd9',
  },
  privacyBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.plum,
    fontWeight: '600',
    lineHeight: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    color: colors.rose,
    fontStyle: 'italic',
  },
  orderCard: {
    marginBottom: 14,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderNumRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderNum: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  statusPill: {
    backgroundColor: '#f3e5f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusReady: {
    backgroundColor: colors.successBg,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.plum,
  },
  orderDetail: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderNote: {
    fontSize: 13,
    color: colors.ink,
    fontStyle: 'italic',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderContact: {
    fontSize: 13,
    color: colors.rose,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: colors.plum,
  },
  btnPrimaryText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
  },
  btnGhost: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  btnGhostText: {
    color: colors.rose,
    fontWeight: '700',
    fontSize: 14,
  },
});
