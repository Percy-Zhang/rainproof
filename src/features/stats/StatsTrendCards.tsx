import { Text, View } from 'react-native';

import { Card } from '../../components/ui';
import { formatMoney } from '../../domain/money';
import type { StatsReportKind } from '../../domain/statsReports';
import type {
  StatsRollupMonthlyTrend,
  StatsRollupTrendBucket,
} from '../../domain/statsTrends';
import { statsStyles as styles } from './StatsScreenStyles';

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
