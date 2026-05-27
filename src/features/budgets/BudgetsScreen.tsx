import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { ActionButton, Card, ProgressBar } from '../../components/ui';
import {
  getBudgetMonthlyRange,
  getBudgetUsageDisplayRows,
  getBudgetUsageFromStatsReport,
  type BudgetUsageDisplayRow,
} from '../../domain/budgets';
import { formatMoney } from '../../domain/money';
import { getStatsReport } from '../../domain/statsReports';
import type { AppSnapshot } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';

type BudgetsScreenProps = {
  snapshot: AppSnapshot;
  onAddBudget: () => void;
  onEditBudget: (budgetId: string) => void;
};

export function BudgetsScreen({
  snapshot,
  onAddBudget,
  onEditBudget,
}: BudgetsScreenProps) {
  const budgetRows = useMemo(
    () => getBudgetUsageRowsForSnapshot(snapshot),
    [snapshot],
  );

  return (
    <View style={styles.shell}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryRow}>
          <View style={styles.summaryText}>
            <Text style={styles.heading}>Monthly budgets</Text>
            <Text style={styles.subtle}>Monthly limits using net spending for the current calendar month.</Text>
          </View>
          <ActionButton onPress={onAddBudget} testID="add-budget">
            Add
          </ActionButton>
        </View>

        {budgetRows.length ? (
          <View style={styles.list}>
            {budgetRows.map((row) => (
              <BudgetUsageCard key={row.id} row={row} onPress={() => onEditBudget(row.id)} />
            ))}
          </View>
        ) : (
          <Card testID="budgets-empty-state">
            <View style={styles.emptyIcon}>
              <Ionicons name="wallet-outline" size={24} color={colors.primaryDark} />
            </View>
            <Text style={styles.emptyTitle}>No active budgets yet</Text>
            <Text style={styles.emptyText}>
              Add an overall, category, or subcategory monthly budget to track spending against this month.
            </Text>
            <ActionButton variant="secondary" onPress={onAddBudget}>
              Add first budget
            </ActionButton>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function BudgetUsageCard({
  row,
  onPress,
}: {
  row: BudgetUsageDisplayRow;
  onPress: () => void;
}) {
  const status = getStatusCopy(row);
  const progressColor = getBudgetStatusColor(row.status);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.budgetCard, pressed && styles.pressed]}
      testID={`budget-row-${row.id}`}
    >
      <View style={styles.budgetHeader}>
        <CategoryIconBadge color={row.color} icon={row.icon} size="md" />
        <View style={styles.budgetTitleWrap}>
          <Text numberOfLines={1} style={styles.budgetName}>{row.budget.name}</Text>
          <Text numberOfLines={1} style={styles.scopeText}>{row.scopeLabel} · {row.scopeDetail}</Text>
        </View>
        <Text style={[styles.statusPill, { color: progressColor }]}>{status.label}</Text>
      </View>

      <View style={styles.amountGrid}>
        <AmountBlock label="Used" value={formatMoney(row.spentMinor, row.budget.currencyCode)} />
        <AmountBlock label={status.remainingLabel} value={formatMoney(Math.abs(row.remainingMinor), row.budget.currencyCode)} tone={row.remainingMinor < 0 ? 'danger' : 'default'} />
        <AmountBlock label="Limit" value={formatMoney(row.budget.amountMinor, row.budget.currencyCode)} align="right" />
      </View>

      <ProgressBar percentage={row.percentageUsed} color={progressColor} />
      <Text style={styles.progressText}>{Math.min(row.percentageUsed, 999)}% used this month</Text>
    </Pressable>
  );
}

function AmountBlock({
  align = 'left',
  label,
  tone = 'default',
  value,
}: {
  align?: 'left' | 'right';
  label: string;
  tone?: 'default' | 'danger';
  value: string;
}) {
  return (
    <View style={[styles.amountBlock, align === 'right' && styles.amountBlockRight]}>
      <Text style={styles.amountLabel}>{label}</Text>
      <Text style={[styles.amountValue, tone === 'danger' && styles.dangerText]}>{value}</Text>
    </View>
  );
}

function getBudgetUsageRowsForSnapshot(snapshot: AppSnapshot): BudgetUsageDisplayRow[] {
  const activeBudgets = snapshot.budgets.filter((budget) => budget.isActive);
  const range = getBudgetMonthlyRange();
  const currencies = Array.from(new Set(activeBudgets.map((budget) => budget.currencyCode)));
  const usages = currencies.flatMap((currencyCode) => {
    const report = getStatsReport({
      reportKind: 'expense',
      transactions: snapshot.transactions,
      transactionLines: snapshot.transactionLines,
      transactionLinks: snapshot.transactionLinks,
      accounts: snapshot.accounts,
      categories: snapshot.categories,
      range,
      currencyCode,
    });

    return getBudgetUsageFromStatsReport({ budgets: activeBudgets, report });
  });

  return getBudgetUsageDisplayRows(usages, snapshot.categories).sort((left, right) => (
    getBudgetStatusRank(right.status) - getBudgetStatusRank(left.status) ||
    right.percentageUsed - left.percentageUsed ||
    left.budget.name.localeCompare(right.budget.name) ||
    left.budget.id.localeCompare(right.budget.id)
  ));
}

function getStatusCopy(row: BudgetUsageDisplayRow): { label: string; remainingLabel: string } {
  if (row.remainingMinor < 0) {
    return { label: 'Over', remainingLabel: 'Over by' };
  }

  if (row.status === 'near_limit') {
    return { label: 'Near limit', remainingLabel: 'Remaining' };
  }

  return { label: 'Under', remainingLabel: 'Remaining' };
}

function getBudgetStatusRank(status: BudgetUsageDisplayRow['status']): number {
  switch (status) {
    case 'over_budget':
      return 3;
    case 'near_limit':
      return 2;
    case 'under_budget':
      return 1;
  }
}

function getBudgetStatusColor(status: BudgetUsageDisplayRow['status']): string {
  switch (status) {
    case 'over_budget':
      return colors.danger;
    case 'near_limit':
      return '#9B6B12';
    case 'under_budget':
      return colors.success;
  }
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  summaryText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  heading: {
    color: colors.ink,
    fontSize: typography.h2,
    fontWeight: '900',
  },
  subtle: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
  },
  list: {
    gap: spacing.md,
  },
  budgetCard: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  budgetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  budgetTitleWrap: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  budgetName: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  scopeText: {
    color: colors.muted,
    fontSize: typography.small,
  },
  statusPill: {
    fontSize: typography.small,
    fontWeight: '900',
    textAlign: 'right',
  },
  amountGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  amountBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  amountBlockRight: {
    alignItems: 'flex-end',
  },
  amountLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  amountValue: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  dangerText: {
    color: colors.danger,
  },
  progressText: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 21,
  },
  pressed: {
    opacity: 0.78,
  },
});
