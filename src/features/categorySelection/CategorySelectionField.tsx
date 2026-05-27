import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { getTransparentColor } from '../../domain/accountThemes';
import { colors, spacing, typography } from '../../theme/tokens';

export function CategorySelectionField({
  color,
  empty = false,
  icon,
  iconColor,
  label,
  onPress,
  value,
}: {
  color: string;
  empty?: boolean;
  icon: string;
  iconColor?: string;
  label: string;
  onPress: () => void;
  value: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.selectorRow,
        {
          backgroundColor: empty ? colors.surface : getTransparentColor(color, '22'),
          borderColor: empty ? colors.faint : color,
        },
        pressed && styles.pressed,
      ]}
    >
      <CategoryIconBadge color={iconColor ?? color} icon={icon} size="sm" />
      <View style={styles.selectorTextBlock}>
        <Text style={styles.selectorLabel}>{label}</Text>
        <Text numberOfLines={1} style={[styles.selectorValue, empty && styles.emptyValue]}>{value}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  selectorRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectorTextBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  selectorLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  selectorValue: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '800',
  },
  emptyValue: {
    color: colors.muted,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
  },
});
