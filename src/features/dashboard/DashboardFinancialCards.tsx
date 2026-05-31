import { StyleSheet, Text, View } from 'react-native';

import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { Card } from '../../components/ui';
import { getDashboardCardDefinition } from '../../domain/dashboardCards';
import { formatMoney } from '../../domain/money';
import type {
  CategoryDefinition,
  CurrencyTotal,
} from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { dashboardCardStyles } from './DashboardCardPrimitives';
import { CreditMetric, getNetMetricTone } from './DashboardCreditCardsCard';
import type { DashboardViewModel } from './useDashboardViewModel';

export function BalanceSummaryCard({
  showCurrencyCodes,
  totalsByCurrency,
}: {
  showCurrencyCodes: boolean;
  totalsByCurrency: CurrencyTotal[];
}) {
  return (
    <Card testID="dashboard-balance-summary-card" style={dashboardCardStyles.compactCard}>
      <Text style={dashboardCardStyles.cardTitle}>{getDashboardCardDefinition('balanceSummary').title}</Text>
      {totalsByCurrency.length ? (
        <View style={styles.metricRows}>
          {totalsByCurrency.map((total) => (
            <View key={total.currencyCode} style={styles.metricRow}>
              <Text style={styles.metricLabel}>{total.currencyCode}</Text>
              <Text style={styles.metricValue}>
                {formatMoney(total.amountMinor, total.currencyCode, { showCurrencyCode: showCurrencyCodes })}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={dashboardCardStyles.emptyText}>Add accounts to see your balances.</Text>
      )}
    </Card>
  );
}

export function CashFlowCard({
  cashFlow,
  showCurrencyCodes,
}: {
  cashFlow: DashboardViewModel['dashboardCashFlow'];
  showCurrencyCodes: boolean;
}) {
  return (
    <Card testID="dashboard-cash-flow-card" style={dashboardCardStyles.compactCard}>
      <Text style={dashboardCardStyles.cardTitle}>{getDashboardCardDefinition('cashFlow').title}</Text>
      {cashFlow.length ? (
        <View style={styles.cashFlowGroups}>
          {cashFlow.map((summary) => (
            <View key={summary.currencyCode} style={styles.cashFlowGroup}>
              <Text style={dashboardCardStyles.currencySectionLabel}>{summary.currencyCode}</Text>
              <View style={styles.creditSummaryMetrics}>
                <CreditMetric
                  label="Income"
                  value={formatMoney(summary.incomeMinor, summary.currencyCode, { showCurrencyCode: showCurrencyCodes })}
                  tone="income"
                />
                <CreditMetric
                  label="Spending"
                  value={formatMoney(summary.expenseMinor, summary.currencyCode, { showCurrencyCode: showCurrencyCodes })}
                  tone="expense"
                />
                <CreditMetric
                  label="Net"
                  value={formatMoney(summary.netMinor, summary.currencyCode, { showCurrencyCode: showCurrencyCodes })}
                  tone={getNetMetricTone(summary.netMinor)}
                />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={dashboardCardStyles.emptyText}>No income or spending in the current month.</Text>
      )}
    </Card>
  );
}

export function TopSpendingCard({
  categories,
  topSpendingByCurrency,
  showCurrencyCodes,
}: {
  categories: CategoryDefinition[];
  topSpendingByCurrency: DashboardViewModel['dashboardTopSpending'];
  showCurrencyCodes: boolean;
}) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return (
    <Card testID="dashboard-top-spending-card" style={dashboardCardStyles.compactCard}>
      <Text style={dashboardCardStyles.cardTitle}>{getDashboardCardDefinition('topSpending').title}</Text>
      {topSpendingByCurrency.length ? (
        <View style={styles.topSpendingCurrencyGroups}>
          {topSpendingByCurrency.map((group) => (
            <View key={group.currencyCode} style={styles.topSpendingCurrencyGroup}>
              <Text style={dashboardCardStyles.currencySectionLabel}>{group.currencyCode}</Text>
              <View style={styles.topSpendingRows}>
                {group.rows.map((item) => (
                  <View key={`${item.currencyCode}-${item.categoryId}`} style={styles.topSpendingRow}>
                    <CategoryIconBadge
                      color={categoryById.get(item.categoryId)?.color ?? colors.muted}
                      icon={categoryById.get(item.categoryId)?.icon ?? 'pricetag-outline'}
                      size="sm"
                    />
                    <Text numberOfLines={1} style={styles.topSpendingLabel}>
                      {categoryById.get(item.categoryId)?.name ?? 'Uncategorized'}
                    </Text>
                    <Text style={styles.topSpendingAmount}>
                      {formatMoney(item.amountMinor, item.currencyCode, { showCurrencyCode: showCurrencyCodes })}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={dashboardCardStyles.emptyText}>No spending in the current month.</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  cashFlowGroup: {
    gap: spacing.sm,
  },
  cashFlowGroups: {
    gap: spacing.md,
  },
  creditSummaryMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: typography.small,
    fontWeight: '800',
  },
  metricRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  metricRows: {
    gap: spacing.sm,
  },
  metricValue: {
    color: colors.ink,
    flexShrink: 0,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
  },
  topSpendingAmount: {
    color: colors.ink,
    flexShrink: 0,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
  },
  topSpendingCurrencyGroup: {
    gap: spacing.sm,
  },
  topSpendingCurrencyGroups: {
    gap: spacing.md,
  },
  topSpendingLabel: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '800',
  },
  topSpendingRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  topSpendingRows: {
    gap: spacing.sm,
  },
});
