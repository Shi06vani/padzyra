import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme/colors';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import { PadzyraApi } from '../api/client';

export const ShopScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<any | null>(null);

  // Form states for creating a shop
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [creating, setCreating] = useState(false);

  const loadShop = async () => {
    try {
      const data = await PadzyraApi.getShopMe();
      setShop(data);
    } catch {
      setShop(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShop();
  }, []);

  const handleCreateShop = async () => {
    if (!name.trim() || !address.trim() || !phone.trim()) {
      Alert.alert('Required', 'Please fill name, address, and phone');
      return;
    }

    setCreating(true);
    try {
      const created = await PadzyraApi.createShop({
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        lat: 12.9716,
        lng: 77.5946,
      });
      setShop(created);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not register medical shop');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Text style={styles.brandSubtitle}>PADZYRA PARTNER</Text>
        <Text style={styles.brandTitle}>Medical Shop</Text>
      </View>

      {shop ? (
        <>
          <View style={styles.heroSection}>
            <Text style={styles.kicker}>SHOP CODE</Text>
            <Text style={styles.shopCode}>{shop.code}</Text>
            <Text style={styles.subText}>
              Share this code. Customers can save your shop to their discreet list.
            </Text>
          </View>

          <Card>
            <View style={styles.row}>
              <Ionicons name="storefront-outline" size={18} color={colors.plum} style={styles.rowIcon} />
              <Text style={styles.shopName}>{shop.name}</Text>
            </View>
            <View style={styles.row}>
              <Ionicons name="location-outline" size={15} color={colors.rose} style={styles.rowIcon} />
              <Text style={styles.shopAddress}>{shop.address}</Text>
            </View>
            <View style={styles.row}>
              <Ionicons name="call-outline" size={15} color={colors.rose} style={styles.rowIcon} />
              <Text style={styles.shopPhone}>Phone: {shop.phone}</Text>
            </View>
            {shop.opensAt ? (
              <View style={styles.row}>
                <Ionicons name="time-outline" size={15} color={colors.rose} style={styles.rowIcon} />
                <Text style={styles.shopHours}>
                  Hours: {shop.opensAt} - {shop.closesAt || ''}
                </Text>
              </View>
            ) : null}
          </Card>
        </>
      ) : (
        <Card>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="business-outline" size={16} color={colors.rose} style={{ marginRight: 6 }} />
            <Text style={styles.cardHeader}>REGISTER MEDICAL SHOP</Text>
          </View>
          <InputField
            label="Shop Name"
            placeholder="e.g. Apollo Pharmacy"
            value={name}
            onChangeText={setName}
          />
          <InputField
            label="Address"
            placeholder="Shop address & landmarks"
            value={address}
            onChangeText={setAddress}
          />
          <InputField
            label="Phone"
            placeholder="Contact phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <PrimaryButton
            title="Register Shop"
            icon={<Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />}
            onPress={handleCreateShop}
            loading={creating}
            style={{ marginTop: 12 }}
          />
        </Card>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.blush,
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
  heroSection: {
    alignItems: 'center',
    paddingVertical: 18,
    marginBottom: 14,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.rose,
    letterSpacing: 1,
    marginBottom: 4,
  },
  shopCode: {
    fontSize: 44,
    fontWeight: '900',
    color: colors.plum,
    letterSpacing: 1,
    marginVertical: 4,
  },
  subText: {
    fontSize: 14,
    color: colors.rose,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  rowIcon: {
    marginRight: 6,
  },
  shopName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    flex: 1,
  },
  shopAddress: {
    fontSize: 14,
    color: colors.rose,
    flex: 1,
  },
  shopPhone: {
    fontSize: 14,
    color: colors.ink,
    fontWeight: '600',
  },
  shopHours: {
    fontSize: 13,
    color: colors.rose,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.rose,
    letterSpacing: 1,
  },
});
