import { StyleSheet } from 'react-native';

import { colors, spacing, typography } from '../../theme/tokens';

export const transactionSearchPlaceholderColor = `${colors.muted}99`;

export const transactionsScreenStyles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  controlBlock: {
    gap: spacing.xs,
  },
  label: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '800',
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typography.body,
    height: 44,
    includeFontPadding: false,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  customRangeRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dateSelector: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minWidth: 130,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dateSelectorValue: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '800',
  },
  datePickerPanel: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: spacing.xs,
  },
  datePickerDone: {
    alignItems: 'center',
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  datePickerDoneText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
  },
  groups: {
    gap: spacing.md,
  },
  group: {
    gap: 0,
  },
  groupBreak: {
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  groupTitle: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
  },
  groupTotal: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '900',
  },
  transactionRows: {
    gap: 0,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
  },
  pressed: {
    opacity: 0.78,
  },
});
