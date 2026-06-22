import { StyleSheet } from 'react-native';

import { colors, spacing, typography } from '../../theme/tokens';

export const transactionSearchPlaceholderColor = `${colors.muted}99`;

export const transactionsScreenStyles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  fixedFilter: {
    backgroundColor: colors.background,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    zIndex: 5,
  },
  listArea: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  searchCard: {
    gap: 0,
    padding: spacing.sm,
  },
  label: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  transactionListCard: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  transactionSectionList: {
    flex: 1,
  },
  transactionSectionListContent: {
    paddingBottom: spacing.md,
  },
  transactionSectionListTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '800',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  transactionContentInset: {
    paddingHorizontal: spacing.lg,
  },
  transactionRowInset: {
    paddingHorizontal: spacing.lg,
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
  transactionGroupSpacer: {
    height: spacing.md,
  },
  groupBreak: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  groupTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.small,
    fontWeight: '900',
    minWidth: 0,
  },
  groupTotal: {
    color: colors.primaryDark,
    flexShrink: 0,
    fontSize: typography.small,
    fontWeight: '900',
    textAlign: 'right',
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
  },
  transactionSkeleton: {
    gap: spacing.sm,
  },
  transactionSkeletonRow: {
    alignItems: 'center',
    borderTopColor: colors.faint,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 62,
    paddingVertical: spacing.sm,
  },
  transactionSkeletonIcon: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    height: 36,
    width: 36,
  },
  transactionSkeletonBody: {
    flex: 1,
    gap: spacing.xs,
  },
  transactionSkeletonLineWide: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
    height: 12,
    width: '72%',
  },
  transactionSkeletonLine: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
    height: 10,
    width: '48%',
  },
  transactionSkeletonAmount: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
    height: 12,
    width: 72,
  },
  pressed: {
    opacity: 0.78,
  },
});
