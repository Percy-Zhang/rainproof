import { StyleSheet, Text, View, Pressable } from 'react-native';

import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { Card, ProgressBar } from '../../components/ui';
import { getDashboardCardDefinition } from '../../domain/dashboardCards';
import { formatMoney } from '../../domain/money';
import { colors, spacing, typography } from '../../theme/tokens';
import { dashboardCardStyles } from './DashboardCardPrimitives';
import type { DashboardBudgetProgressData } from './useDashboardViewModel';

export function BudgetProgressDashboardCard({
  budgetProgress,
  showCurrencyCodes,
  onOpenBudgets,
}: {
  budgetProgress: DashboardBudgetProgressData;
  showCurrencyCodes: boolean;
  onOpenBudgets: () => void;
}) {
  if (!budgetProgress.activeBudgetCount) {
    return null;
  }

  return (
    <Card testID="dashboard-budget-progress-card" style={dashboardCardStyles.compactCard}>
      <Pressable
        accessibilityRole="button"
        onPress={onOpenBudgets}
        style={({ pressed }) => [styles.budgetProgressContent, pressed && dashboardCardStyles.pressedRow]}
      >
        <View style={dashboardCardStyles.sectionCardHeader}>
          <View style={dashboardCardStyles.headerText}>
            <Text style={dashboardCardStyles.cardTitle}>{getDashboardCardDefinition('budgetProgress').title}</Text>
            <Text style={dashboardCardStyles.smallMuted}>
              {budgetProgress.activeBudgetCount === 1
                ? '1 active budget'
                : `${budgetProgress.activeBudgetCount} active budgets`}
            </Text>
          </View>
          <Text style={dashboardCardStyles.headerActionText}>View</Text>
        </View>

        <View style={styles.budgetProgressRows}>
          {budgetProgress.rows.map((row) => (
            <BudgetProgressRow key={row.id} row={row} showCurrencyCodes={showCurrencyCodes} />
          ))}
        </View>
      </Pressable>
    </Card>
  );
}

function BudgetProgressRow({
  row,
  showCurrencyCodes,
}: {
  row: DashboardBudgetProgressData['rows'][number];
  showCurrencyCodes: boolean;
}) {
  const progressColor = getBudgetStatusColor(row.status);
  const statusLabel = getBudgetStatusLabel(row);

  return (
    <View style={styles.budgetProgressRow}>
      <View style={styles.budgetProgressRowHeader}>
        <CategoryIconBadge color={row.color} icon={row.icon} size="sm" />
        <View style={styles.budgetProgressText}>
          <Text numberOfLines={1} style={styles.budgetProgressName}>{row.budget.name}</Text>
          <Text numberOfLines={1} style={styles.budgetProgressScope}>{row.scopeLabel}</Text>
        </View>
        <View style={styles.budgetProgressStatus}>
          <Text style={[styles.budgetProgressStatusText, { color: progressColor }]}>{statusLabel}</Text>
          <Text style={styles.budgetProgressPercent}>{Math.min(row.percentageUsed, 999)}%</Text>
        </View>
      </View>
      <ProgressBar percentage={row.percentageUsed} color={progressColor} />
      <View style={styles.budgetProgressAmounts}>
        <Text style={dashboardCardStyles.smallMuted}>
          Used {formatMoney(row.spentMinor, row.budget.currencyCode, { showCurrencyCode: showCurrencyCodes })}
        </Text>
        <Text style={dashboardCardStyles.smallMuted}>
          {row.remainingMinor < 0 ? 'Over ' : 'Left '}
          {formatMoney(Math.abs(row.remainingMinor), row.budget.currencyCode, { showCurrencyCode: showCurrencyCodes })}
        </Text>
      </View>
    </View>
  );
}

function getBudgetStatusLabel(row: DashboardBudgetProgressData['rows'][number]): string {
  if (row.remainingMinor < 0) {
    return 'Over';
  }

  if (row.status === 'near_limit') {
    return 'Near';
  }

  return 'Under';
}

function getBudgetStatusColor(status: DashboardBudgetProgressData['rows'][number]['status']): string {
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
  budgetProgressAmounts: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  budgetProgressContent: {
    borderRadius: 8,
    gap: spacing.sm,
  },
  budgetProgressName: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
  },
  budgetProgressPercent: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
    textAlign: 'right',
  },
  budgetProgressRow: {
    gap: spacing.xs,
  },
  budgetProgressRowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  budgetProgressRows: {
    gap: spacing.sm,
  },
  budgetProgressScope: {
    color: colors.muted,
    fontSize: typography.small,
  },
  budgetProgressStatus: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  budgetProgressStatusText: {
    fontSize: typography.small,
    fontWeight: '900',
    textAlign: 'right',
  },
  budgetProgressText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
});
