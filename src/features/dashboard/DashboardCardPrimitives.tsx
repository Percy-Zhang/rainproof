import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, spacing, typography } from '../../theme/tokens';

export function DashboardHeaderAction({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [dashboardCardStyles.headerAction, pressed && dashboardCardStyles.pressedRow]}
    >
      <Text style={dashboardCardStyles.headerActionText}>{label}</Text>
    </Pressable>
  );
}

export function DashboardHeaderIconAction({
  accessibilityLabel,
  icon,
  onPress,
  testID,
}: {
  accessibilityLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [dashboardCardStyles.headerIconAction, pressed && dashboardCardStyles.pressedRow]}
    >
      <Ionicons name={icon} size={19} color={colors.primaryDark} />
    </Pressable>
  );
}

export const dashboardCardStyles = StyleSheet.create({
  cardTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '800',
  },
  compactCard: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  currencySectionLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
  },
  headerAction: {
    alignItems: 'center',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: spacing.sm,
  },
  headerActionText: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '900',
  },
  headerIconAction: {
    alignItems: 'center',
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  pressedRow: {
    opacity: 0.78,
  },
  sectionCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 30,
  },
  smallMuted: {
    color: colors.muted,
    fontSize: typography.small,
  },
});
