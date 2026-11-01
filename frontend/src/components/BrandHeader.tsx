import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface BrandHeaderProps {
  subtitle?: string;
  compact?: boolean;
}

export const BrandHeader: React.FC<BrandHeaderProps> = ({
  subtitle = 'A quiet reminder, just for you.',
  compact = false,
}) => {
  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <Image
        source={require('../assets/logo.png')}
        style={[styles.logo, compact && styles.compactLogo]}
        resizeMode="contain"
      />
      <Text style={[styles.title, compact && styles.compactTitle]}>Padzyra</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 24,
  },
  compactContainer: {
    marginBottom: 12,
  },
  logo: {
    width: 88,
    height: 88,
    marginBottom: 8,
  },
  compactLogo: {
    width: 52,
    height: 52,
    marginBottom: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.plum,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  compactTitle: {
    fontSize: 22,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.rose,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});
