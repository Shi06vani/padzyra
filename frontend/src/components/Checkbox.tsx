import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme/colors';

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (newValue: boolean) => void;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, checked, onChange }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.container}
      onPress={() => onChange(!checked)}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.8,
    borderColor: '#d07aaa',
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  boxChecked: {
    backgroundColor: '#d07aaa',
  },
  checkmark: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900',
    marginTop: -2,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
});
