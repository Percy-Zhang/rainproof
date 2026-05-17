import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  accountIconPresets,
  normalizeAccountIconName,
  normalizeAccountThemeColor,
} from '../domain/accountThemes';
import type { Account, AccountType } from '../domain/types';
import { colors, spacing } from '../theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

export function AccountIconBadge({
  account,
  color,
  iconName,
  type,
  size = 'md',
}: {
  account?: Account;
  color?: string;
  iconName?: string;
  type?: AccountType;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dimension = size === 'lg' ? 42 : size === 'sm' ? 30 : 36;
  const iconSize = size === 'lg' ? 24 : size === 'sm' ? 16 : 20;
  const badgeColor = normalizeAccountThemeColor(color ?? account?.themeColor);
  const normalizedIcon = normalizeAccountIconName(iconName ?? account?.iconName, type ?? account?.type);

  return (
    <View style={[styles.iconBadge, { backgroundColor: badgeColor, height: dimension, width: dimension }]}>
      <Ionicons name={normalizedIcon as IconName} size={iconSize} color={colors.surface} />
    </View>
  );
}

export function AccountIconPicker({
  selectedColor,
  selectedIcon,
  onSelectIcon,
}: {
  selectedColor: string;
  selectedIcon: string;
  onSelectIcon: (iconName: string) => void;
}) {
  return (
    <View style={styles.pickerWrap}>
      {accountIconPresets.map((icon) => {
        const selected = normalizeAccountIconName(selectedIcon) === icon;
        return (
          <Pressable
            accessibilityLabel={`Use account icon ${icon}`}
            accessibilityRole="button"
            key={icon}
            onPress={() => onSelectIcon(icon)}
            style={({ pressed }) => [
              styles.iconOption,
              selected && { backgroundColor: `${selectedColor}18`, borderColor: selectedColor },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name={icon as IconName} size={20} color={selected ? selectedColor : colors.muted} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  iconBadge: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
  },
  pickerWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  iconOption: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  pressed: {
    opacity: 0.78,
  },
});
