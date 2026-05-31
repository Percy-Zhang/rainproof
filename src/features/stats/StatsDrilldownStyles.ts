import { StyleSheet } from 'react-native';

import { colors, spacing, typography } from '../../theme/tokens';

export const statsDrilldownStyles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  backButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 40,
    paddingRight: spacing.sm,
    width: 88,
  },
  backButtonText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '800',
  },
  headerTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.h3,
    fontWeight: '900',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 88,
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  summaryCard: {
    gap: spacing.sm,
  },
  kicker: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: typography.h2,
    fontWeight: '900',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryMetric: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  controlsCard: {
    gap: spacing.sm,
  },
  controlTitle: {
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
  sortRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  resultsCard: {
    gap: spacing.md,
  },
  resultsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '900',
  },
  resultCount: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '900',
  },
  rows: {
    gap: spacing.xs,
  },
  row: {
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  splitLineRow: {
    marginLeft: spacing.sm,
  },
  lineDot: {
    borderRadius: 999,
    height: 12,
    marginTop: 5,
    width: 12,
  },
  rowBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  rowTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '900',
    minWidth: 0,
  },
  rowAmount: {
    flexShrink: 0,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
  },
  expenseAmount: {
    color: colors.danger,
  },
  incomeAmount: {
    color: colors.success,
  },
  rowDetail: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  rowMeta: {
    color: colors.muted,
    flexShrink: 1,
    fontSize: typography.small,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
  },
  pressed: {
    opacity: 0.78,
  },
});
