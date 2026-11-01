import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
  const tabs: TabItem[] =
    role === 'shop'
      ? [
          { key: 'shop', label: 'Shop', icon: 'storefront-outline', iconActive: 'storefront' },
          { key: 'shop-orders', label: 'Orders', icon: 'receipt-outline', iconActive: 'receipt' },
          { key: 'settings', label: 'Settings', icon: 'settings-outline', iconActive: 'settings' },
        ]
      : [
          { key: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home' },
          { key: 'calendar', label: 'Dates', icon: 'calendar-outline', iconActive: 'calendar' },
          { key: 'threads', label: 'Threads', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
          { key: 'now', label: 'Now', icon: 'flash-outline', iconActive: 'flash' },
          { key: 'activity', label: 'Activity', icon: 'receipt-outline', iconActive: 'receipt' },
          { key: 'settings', label: 'You', icon: 'person-outline', iconActive: 'person' },
        ];

  return (
    <View style={styles.floatingContainer}>
      <View style={styles.bar}>
        {tabs.map((tab) => {
          const isActive = currentTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.8}
              onPress={() => onSelectTab(tab.key)}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
            >
              <Ionicons
                name={isActive ? tab.iconActive : tab.icon}
                size={16}
                color={isActive ? colors.white : colors.rose}
                style={styles.tabIcon}
              />
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
    bottom: 16,
    left: 12,
    right: 12,
    alignItems: 'center',
    zIndex: 10,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 253, 252, 0.96)',
    borderRadius: 24,
    padding: 5,
    shadowColor: '#c98cb0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
    width: '100%',
    maxWidth: 440,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 2,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#dc97c4',
    shadowColor: colors.pink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  tabIcon: {
    marginBottom: 2,
  },
  tabText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.rose,
  },
  tabTextActive: {
    color: colors.white,
  },
});
