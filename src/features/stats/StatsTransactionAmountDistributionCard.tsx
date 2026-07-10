import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/ui';
import type {
  StatsTransactionAmountBucket,
  StatsTransactionAmountDistribution,
} from '../../domain/statsTransactionAmountDistribution';
import { getCurrencySymbol } from '../../domain/money';
import { colors, spacing, typography } from '../../theme/tokens';

export function StatsTransactionAmountDistributionCard({
  distribution,
}: {
  distribution: StatsTransactionAmountDistribution;
}) {
  const maxBucketCount = distribution.buckets.reduce(
    (maximum, bucket) => Math.max(maximum, bucket.count),
    0,
  );

  return (
    <Card testID="stats-transaction-amount-distribution-card">
      <View style={styles.header}>
        <Text style={styles.title}>Transaction amounts</Text>
        <Text style={styles.subtitle}>
          {distribution.reportKind === 'expense' ? 'Expense' : 'Income'} transactions by size
        </Text>
      </View>

      <View style={styles.rows}>
        {distribution.buckets.map((bucket) => (
          <AmountBucketRow
            key={bucket.id}
            bucket={bucket}
            currencyCode={distribution.currencyCode}
            maxBucketCount={maxBucketCount}
          />
        ))}
      </View>
    </Card>
  );
}

function AmountBucketRow({
  bucket,
  currencyCode,
  maxBucketCount,
}: {
  bucket: StatsTransactionAmountBucket;
  currencyCode: string;
  maxBucketCount: number;
}) {
  const label = formatBucketLabel(bucket, currencyCode);
  const barPercentage = maxBucketCount > 0 ? (bucket.count / maxBucketCount) * 100 : 0;

  return (
    <View
      accessibilityLabel={`${label}, ${bucket.count} ${bucket.count === 1 ? 'transaction' : 'transactions'}`}
      accessible
      style={styles.row}
      testID={`stats-transaction-amount-bucket-${bucket.id}`}
    >
      <Text numberOfLines={1} style={styles.bucketLabel}>
        {label}
      </Text>
      <View
        accessible={false}
        style={styles.barTrack}
        testID={`stats-transaction-amount-bucket-bar-${bucket.id}`}
      >
        {bucket.count > 0 ? (
          <View
            style={[styles.barFill, { width: toPercentage(barPercentage) }]}
            testID={`stats-transaction-amount-bucket-fill-${bucket.id}`}
          />
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        style={styles.count}
        testID={`stats-transaction-amount-bucket-count-${bucket.id}`}
      >
        {bucket.count}
      </Text>
    </View>
  );
}

function formatBucketLabel(bucket: StatsTransactionAmountBucket, currencyCode: string): string {
  const symbol = getCurrencySymbol(currencyCode);
  const minimum = formatWholeUnits(bucket.minMinor);

  if (bucket.maxExclusiveMinor === null) {
    return `${symbol}${minimum}+`;
  }

  return `${symbol}${minimum}\u2013${formatWholeUnits(bucket.maxExclusiveMinor)}`;
}

function formatWholeUnits(amountMinor: number): string {
  return Math.trunc(amountMinor / 100).toLocaleString('en-AU');
}

function toPercentage(value: number): `${number}%` {
  return `${Math.max(0, Math.min(100, value))}%`;
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
  title: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  rows: {
    gap: spacing.sm,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 26,
  },
  bucketLabel: {
    color: colors.ink,
    flexShrink: 0,
    fontSize: typography.small,
    fontWeight: '800',
    width: 72,
  },
  barTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    flex: 1,
    height: 9,
    minWidth: 44,
    overflow: 'hidden',
  },
  barFill: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: '100%',
  },
  count: {
    color: colors.ink,
    flexShrink: 0,
    fontSize: typography.small,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    textAlign: 'right',
    width: 30,
  },
});
