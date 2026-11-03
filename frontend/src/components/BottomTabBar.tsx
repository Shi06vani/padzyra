import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme/colors';

export type TabKey =
  | 'home'
  | 'calendar'
  | 'threads'
  | 'now'
  | 'activity'
  | 'settings'
  | 'shop'
  | 'shop-orders';

interface TabItem {
  key: TabKey;
  label: string;
  icon: string;
  iconActive: string;
}

interface BottomTabBarProps {
  currentTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  role: 'girl' | 'shop';
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  currentTab,
  onSelectTab,
  role,
}) => {
  const insets = useSafeAreaInsets();

  const tabs: TabItem[] =
    role === 'shop'
      ? [
          { key: 'shop', label: 'Shop', icon: 'storefront-outline', iconActive: 'storefront' },
          { key: 'shop-orders', label: 'Orders', icon: 'receipt-outline', iconActive: 'receipt' },
          { key: 'settings', label: 'Profile', icon: 'person-outline', iconActive: 'person' },
        ]
      : [
          { key: 'home', label: 'Today', icon: 'flower-outline', iconActive: 'flower' },
          { key: 'calendar', label: 'Cycle', icon: 'calendar-outline', iconActive: 'calendar' },
          { key: 'now', label: 'Pharmacy', icon: 'storefront-outline', iconActive: 'storefront' },
          { key: 'threads', label: 'Community', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
          { key: 'settings', label: 'Profile', icon: 'person-outline', iconActive: 'person' },
        ];

  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8);

  return (
    <View style={[styles.floatingContainer, { bottom: bottomInset }]}>
      <View style={styles.bar}>
        {tabs.map((tab) => {
          // If current tab is 'activity', map it visually to 'now' (Care) tab
          const isActive = currentTab === tab.key || (currentTab === 'activity' && tab.key === 'now');
          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.7}
              onPress={() => onSelectTab(tab.key)}
              style={styles.tabButton}
            >
              <View style={[styles.iconWrapper, isActive && styles.iconWrapperActive]}>
                <Ionicons
                  name={isActive ? tab.iconActive : tab.icon}
                  size={20}
                  color={isActive ? colors.plum : colors.rose}
                />
              </View>
              <Text
                numberOfLines={1}
                style={[styles.tabText, isActive && styles.tabTextActive]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: 14,
    right: 14,
    alignItems: 'center',
    zIndex: 10,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingVertical: 7,
    paddingHorizontal: 8,
    shadowColor: '#4a1e3e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(235, 195, 215, 0.75)',
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    width: 44,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  iconWrapperActive: {
    backgroundColor: 'rgba(107, 61, 98, 0.10)',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.rose,
    letterSpacing: 0.2,
  },
  tabTextActive: {
    color: colors.plum,
    fontWeight: '800',
  },
});
