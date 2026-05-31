import { Text, View } from 'react-native';

import { Card } from '../../components/ui';
import type { getCashFlowSummary } from '../../domain/aggregates';
import { formatMoney } from '../../domain/money';
import type { StatsMonthlyTrendSummary } from '../../domain/statsTrends';
import { statsStyles as styles } from './StatsScreenStyles';
import { formatSignedMoney, getNetTone } from './StatsScreenUtils';

type CashFlowSummary = ReturnType<typeof getCashFlowSummary>;

export function CashFlowCard({
  cashFlow,
  currencyCode,
}: {
  cashFlow: CashFlowSummary;
  currencyCode: string;
}) {
  return (
    <Card testID="cash-flow-card">
      <Text style={styles.cardTitle}>Cash flow</Text>
      <View style={styles.flowGrid}>
        <Metric label="Income" value={formatMoney(cashFlow.incomeMinor, currencyCode)} tone="income" />
        <Metric label="Spending" value={formatMoney(cashFlow.expenseMinor, currencyCode)} tone="expense" />
        <Metric label="Net" value={formatSignedMoney(cashFlow.netMinor, currencyCode)} tone={getNetTone(cashFlow.netMinor)} />
      </View>
    </Card>
  );
}

export function MonthlyAveragesCard({
  currencyCode,
  monthlyTrendSummary,
}: {
  currencyCode: string;
  monthlyTrendSummary: StatsMonthlyTrendSummary;
}) {
  return (
    <Card testID="monthly-averages-card">
      <View style={styles.cardHeaderText}>
        <Text style={styles.cardTitle}>Monthly averages</Text>
        <Text style={styles.cardSubtitle}>{monthlyTrendSummary.averages.basisLabel}</Text>
      </View>
      <View style={styles.flowGrid}>
        <Metric
          label="Income / mo"
          value={formatMoney(monthlyTrendSummary.averages.averageIncomeMinor, currencyCode)}
          tone="income"
        />
        <Metric
          label="Spending / mo"
          value={formatMoney(monthlyTrendSummary.averages.averageSpendingMinor, currencyCode)}
          tone="expense"
        />
        <Metric
          label="Net / mo"
          value={formatSignedMoney(monthlyTrendSummary.averages.averageNetCashFlowMinor, currencyCode)}
          tone={getNetTone(monthlyTrendSummary.averages.averageNetCashFlowMinor)}
        />
      </View>
      <Text style={styles.reportNote}>{monthlyTrendSummary.averages.note}</Text>
    </Card>
  );
}

export function GrossNetSpendingCard({
  currencyCode,
  monthlyTrendSummary,
}: {
  currencyCode: string;
  monthlyTrendSummary: StatsMonthlyTrendSummary;
}) {
  return (
    <Card testID="gross-net-spending-card">
      <Text style={styles.cardTitle}>Gross vs net spending</Text>
      <View style={styles.flowGrid}>
        <Metric
          label="Gross spending"
          value={formatMoney(monthlyTrendSummary.grossNetSpending.grossSpendingMinor, currencyCode)}
          tone="expense"
        />
        <Metric
          label="Linked back"
          value={formatMoney(monthlyTrendSummary.grossNetSpending.linkedAdjustmentMinor, currencyCode)}
          tone="income"
        />
        <Metric
          label="Net spending"
          value={formatMoney(monthlyTrendSummary.grossNetSpending.netSpendingMinor, currencyCode)}
          tone="expense"
        />
      </View>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'income' | 'expense' }) {
  return (
    <View style={[styles.metric, tone === 'income' && styles.metricIncome, tone === 'expense' && styles.metricExpense]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text
        style={[
          styles.metricValue,
          tone === 'income' && styles.metricValueIncome,
          tone === 'expense' && styles.metricValueExpense,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}
