import { Text, View } from 'react-native';

import { Card } from '../../components/ui';
import { formatMoney } from '../../domain/money';
import type { StatsReportKind } from '../../domain/statsReports';
import type {
  StatsMonthlyTrendBucket,
  StatsMonthlyTrendSummary,
  StatsRollupMonthlyTrend,
  StatsRollupTrendBucket,
} from '../../domain/statsTrends';
import { statsStyles as styles } from './StatsScreenStyles';
import { formatSignedMoney, getNetTone } from './StatsScreenUtils';

export function MonthlyCashFlowTrendCard({
  currencyCode,
  monthlyTrendSummary,
}: {
  currencyCode: string;
  monthlyTrendSummary: StatsMonthlyTrendSummary;
}) {
  return (
    <Card testID="monthly-trend-card">
      <Text style={styles.cardTitle}>Monthly cash-flow trend</Text>
      {monthlyTrendSummary.buckets.length ? (
        <View style={styles.trendRows}>
          {monthlyTrendSummary.buckets.map((bucket) => (
            <MonthlyTrendRow key={bucket.monthKey} bucket={bucket} currencyCode={currencyCode} />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>No monthly trend data for this filter.</Text>
      )}
    </Card>
  );
}

export function SelectedSpendingTrendCard({
  currencyCode,
  reportKind,
  selectedSpendingTrend,
}: {
  currencyCode: string;
  reportKind: StatsReportKind;
  selectedSpendingTrend: StatsRollupMonthlyTrend;
}) {
  if (!selectedSpendingTrend.rollup) {
    return null;
  }

  return (
    <Card testID="selected-spending-trend-card">
      <View style={styles.cardHeaderText}>
        <Text style={styles.cardTitle}>Selected {reportKind === 'expense' ? 'expense' : 'income'} trend</Text>
        <Text style={styles.cardSubtitle}>
          {selectedSpendingTrend.rollup.label} - monthly net {reportKind === 'expense' ? 'spending' : 'income'}
        </Text>
      </View>
      <View style={styles.trendRows}>
        {selectedSpendingTrend.buckets.map((bucket) => (
          <RollupTrendRow
            key={bucket.monthKey}
            bucket={bucket}
            currencyCode={currencyCode}
            reportKind={reportKind}
          />
        ))}
      </View>
    </Card>
  );
}

function MonthlyTrendRow({ bucket, currencyCode }: { bucket: StatsMonthlyTrendBucket; currencyCode: string }) {
  return (
    <View style={styles.trendRow}>
      <Text style={styles.trendMonth}>{bucket.monthLabel}</Text>
      <View style={styles.trendValues}>
        <TrendValue label="Income" value={formatMoney(bucket.incomeNetMinor, currencyCode)} tone="income" />
        <TrendValue label="Spending" value={formatMoney(bucket.spendingNetMinor, currencyCode)} tone="expense" />
        <TrendValue
          label="Net"
          value={formatSignedMoney(bucket.netCashFlowMinor, currencyCode)}
          tone={getNetTone(bucket.netCashFlowMinor)}
        />
      </View>
    </View>
  );
}

function RollupTrendRow({
  bucket,
  currencyCode,
  reportKind,
}: {
  bucket: StatsRollupTrendBucket;
  currencyCode: string;
  reportKind: StatsReportKind;
}) {
  const detail = bucket.grossAmountMinor !== bucket.netAmountMinor
    ? `Gross ${formatMoney(bucket.grossAmountMinor, currencyCode)}`
    : `${bucket.lineCount} records`;

  return (
    <View style={styles.trendRow}>
      <Text style={styles.trendMonth}>{bucket.monthLabel}</Text>
      <View style={styles.trendValues}>
        <TrendValue label="Net" value={formatMoney(bucket.netAmountMinor, currencyCode)} tone={reportKind} />
        <TrendValue label={detail} value="" />
      </View>
    </View>
  );
}

function TrendValue({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'income' | 'expense';
}) {
  return (
    <View style={styles.trendValue}>
      <Text style={styles.trendLabel}>{label}</Text>
      {value ? (
        <Text style={[styles.trendAmount, tone === 'income' && styles.trendIncome, tone === 'expense' && styles.trendExpense]}>
          {value}
        </Text>
      ) : null}
    </View>
  );
}
