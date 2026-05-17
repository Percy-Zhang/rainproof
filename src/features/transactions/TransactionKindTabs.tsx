import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TransactionKind } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';

export function TransactionTypeTabs({
  kind,
  onChange,
}: {
  kind: TransactionKind;
  onChange: (kind: TransactionKind) => void;
}) {
  return (
    <View style={styles.kindTabs}>
      {(['expense', 'income', 'transfer'] as TransactionKind[]).map((option) => (
        <Pressable
          key={option}
          accessibilityRole="button"
          onPress={() => onChange(option)}
          style={({ pressed }) => [
            styles.kindButton,
            {
              backgroundColor: kind === option ? getTransactionKindTint(option) : colors.surface,
              borderColor: kind === option ? getTransactionKindColor(option) : colors.faint,
            },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.kindButtonText, { color: getTransactionKindColor(option) }]}>
            {formatTransactionKindLabel(option)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function getTransactionKindColor(kind: TransactionKind): string {
  if (kind === 'income') {
    return colors.success;
  }

  if (kind === 'expense') {
    return colors.danger;
  }

  return colors.primaryDark;
}

export function getTransactionKindTint(kind: TransactionKind): string {
  if (kind === 'income') {
    return '#E4F3EF';
  }

  if (kind === 'expense') {
    return '#F8E8E8';
  }

  return colors.surfaceMuted;
}

export function formatTransactionKindLabel(value: TransactionKind | string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

const styles = StyleSheet.create({
  kindTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  kindButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  kindButtonText: {
    fontSize: typography.body,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
  },
});
