import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CategoryDefinition, SubcategoryDefinition } from '../domain/types';
import { colors, spacing, typography } from '../theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

export function CategoryIconBadge({
  color,
  icon,
  size = 'md',
}: {
  color: string;
  icon: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dimension = size === 'lg' ? 42 : size === 'sm' ? 30 : 36;
  const iconSize = size === 'lg' ? 24 : size === 'sm' ? 16 : 20;

  return (
    <View style={[styles.iconBadge, { backgroundColor: color, height: dimension, width: dimension }]}>
      <Ionicons name={icon as IconName} size={iconSize} color={colors.surface} />
    </View>
  );
}

export function CategoryRow({
  category,
  expanded,
  onPress,
  trailingIcon,
}: {
  category: CategoryDefinition;
  expanded?: boolean;
  onPress: () => void;
  trailingIcon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.categoryRow,
        { borderColor: expanded ? category.color : colors.faint },
        pressed && styles.pressed,
      ]}
    >
      <CategoryIconBadge color={category.color} icon={category.icon} size="lg" />
      <Text numberOfLines={1} style={styles.rowTitle}>{category.name}</Text>
      <Ionicons name={trailingIcon ?? (expanded ? 'chevron-up' : 'chevron-down')} size={18} color={colors.muted} />
    </Pressable>
  );
}

export function SubcategoryRow({
  color,
  icon,
  name,
  selected,
  onPress,
}: {
  color: string;
  icon: string;
  name: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.subcategoryRow,
        { borderColor: selected ? color : colors.faint },
        selected && styles.subcategoryRowSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.subcategoryAccent, { backgroundColor: color }]} />
      <CategoryIconBadge color={color} icon={icon} size="sm" />
      <Text numberOfLines={1} style={[styles.subcategoryTitle, selected && styles.subcategoryTitleSelected]}>
        {name}
      </Text>
    </Pressable>
  );
}

export function ColorPresetPicker({
  colors: colorOptions,
  selectedColor,
  onSelectColor,
}: {
  colors: string[];
  selectedColor: string;
  onSelectColor: (color: string) => void;
}) {
  return (
    <View style={styles.presetWrap}>
      {colorOptions.map((color) => (
        <Pressable
          accessibilityLabel={`Use color ${color}`}
          accessibilityRole="button"
          key={color}
          onPress={() => onSelectColor(color)}
          style={({ pressed }) => [
            styles.colorPreset,
            { backgroundColor: color },
            selectedColor === color && styles.colorPresetSelected,
            pressed && styles.pressed,
          ]}
        />
      ))}
    </View>
  );
}

export function IconPresetPicker({
  icons,
  selectedIcon,
  selectedColor,
  onSelectIcon,
}: {
  icons: string[];
  selectedIcon: string;
  selectedColor: string;
  onSelectIcon: (icon: string) => void;
}) {
  return (
    <View style={styles.presetWrap}>
      {icons.map((icon) => (
        <Pressable
          accessibilityLabel={`Use icon ${icon}`}
          accessibilityRole="button"
          key={icon}
          onPress={() => onSelectIcon(icon)}
          style={({ pressed }) => [
            styles.iconPreset,
            selectedIcon === icon && { borderColor: selectedColor, backgroundColor: '#F4FAFF' },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name={icon as IconName} size={18} color={selectedIcon === icon ? selectedColor : colors.muted} />
        </Pressable>
      ))}
    </View>
  );
}

export function getSubcategoryDisplay(subcategory: SubcategoryDefinition) {
  return {
    color: subcategory.color,
    icon: subcategory.icon,
    name: subcategory.name,
  };
}

const styles = StyleSheet.create({
  iconBadge: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
  },
  categoryRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '900',
    minWidth: 0,
  },
  subcategoryRow: {
    alignItems: 'center',
    backgroundColor: '#F8FCFF',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginLeft: spacing.lg,
    minHeight: 46,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  subcategoryRowSelected: {
    backgroundColor: colors.surfaceMuted,
  },
  subcategoryAccent: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 4,
  },
  subcategoryTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '800',
    minWidth: 0,
  },
  subcategoryTitleSelected: {
    color: colors.primaryDark,
  },
  presetWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  colorPreset: {
    borderColor: colors.surface,
    borderRadius: 999,
    borderWidth: 2,
    height: 28,
    width: 28,
  },
  colorPresetSelected: {
    borderColor: colors.ink,
  },
  iconPreset: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  pressed: {
    opacity: 0.78,
  },
});
