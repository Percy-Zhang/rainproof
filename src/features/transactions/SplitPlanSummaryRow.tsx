import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { sharedStyles } from '../../theme/sharedStyles';
import { colors, spacing } from '../../theme/tokens';

type SplitPlanSummaryRowProps = {
  detail: string;
  onPress: () => void;
  testID?: string;
  title: string;
};

export function SplitPlanSummaryRow({
  detail,
  onPress,
  testID,
  title,
}: SplitPlanSummaryRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [sharedStyles.rowSurface, styles.selectorRow, pressed && sharedStyles.pressed]}
      testID={testID}
    >
      <View style={styles.emptyIcon}>
        <Ionicons name="git-branch-outline" size={18} color={colors.primaryDark} />
      </View>
      <View style={styles.selectorText}>
        <Text numberOfLines={1} style={sharedStyles.strongBodyText}>{title}</Text>
        <Text numberOfLines={1} style={sharedStyles.mutedSmallText}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  selectorRow: {
    gap: spacing.sm,
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectorText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
});
