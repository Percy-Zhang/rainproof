import { StyleSheet } from 'react-native';

import { colors, radii, spacing, typography } from './tokens';

export const sharedStyles = StyleSheet.create({
  surfaceCard: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  rowSurface: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
    paddingHorizontal: spacing.sm,
  },
  draggingSurface: {
    elevation: 8,
    opacity: 0.95,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  compactListCard: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: radii.sm,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  pressed: {
    opacity: 0.78,
  },
  mutedSmallText: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
  },
  strongBodyText: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  strongSmallText: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
  },
  uppercaseLabelText: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
