import { StyleSheet } from 'react-native';

import { colors, spacing, typography } from '../../theme/tokens';

export const statsStyles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
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
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
  dateSelectorLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
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
    width: '100%',
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
  cardTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '800',
  },
  cardHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  cardHeaderText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  cardSubtitle: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
  },
  flowGrid: {
    gap: spacing.sm,
  },
  metric: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  metricIncome: {
    backgroundColor: '#E4F3EF',
    borderColor: colors.success,
  },
  metricExpense: {
    backgroundColor: '#F8E8E8',
    borderColor: colors.danger,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
  },
  metricValue: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '900',
  },
  metricValueIncome: {
    color: colors.success,
  },
  metricValueExpense: {
    color: colors.danger,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
  },
  reportNote: {
    color: colors.muted,
    fontSize: typography.small,
  },
  trendRows: {
    gap: spacing.xs,
  },
  trendRow: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  trendMonth: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  trendValues: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  trendValue: {
    minWidth: 88,
  },
  trendLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
  },
  trendAmount: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
  },
  trendIncome: {
    color: colors.success,
  },
  trendExpense: {
    color: colors.danger,
  },
  matchSection: {
    gap: spacing.sm,
  },
  matchHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  matchHeaderText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  matchTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  matchDetail: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  matchRows: {
    gap: spacing.xs,
  },
  matchRow: {
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  matchIcon: {
    borderRadius: 999,
    height: 12,
    marginTop: 5,
    width: 12,
  },
  matchBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  transactionLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  matchRowTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '900',
    minWidth: 0,
  },
  matchAmount: {
    color: colors.danger,
    flexShrink: 0,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
  },
  matchLineDetail: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  matchMeta: {
    color: colors.muted,
    flexShrink: 1,
    fontSize: typography.small,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryPill: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  swatch: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  categoryPillText: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
  },
});
