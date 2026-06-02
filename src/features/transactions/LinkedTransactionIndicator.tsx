import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme/tokens';

type LinkedTransactionIndicatorProps = {
  compact?: boolean;
  label?: boolean;
  testID?: string;
};

export function LinkedTransactionIndicator({
  compact = false,
  label = false,
  testID,
}: LinkedTransactionIndicatorProps) {
  return (
    <View
      accessibilityLabel="Linked transaction"
      accessibilityRole="image"
      accessible
      style={[
        styles.indicator,
        compact && styles.indicatorCompact,
        label && styles.indicatorWithLabel,
      ]}
      testID={testID}
    >
      <Ionicons name="link-outline" size={compact ? 12 : 13} color={colors.primaryDark} />
      {label ? <Text style={styles.label}>Linked</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  indicator: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 999,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  indicatorCompact: {
    height: 18,
    width: 18,
  },
  indicatorWithLabel: {
    flexDirection: 'row',
    gap: spacing.xs,
    height: 24,
    paddingHorizontal: spacing.xs,
    width: 'auto',
  },
  label: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '900',
  },
});
