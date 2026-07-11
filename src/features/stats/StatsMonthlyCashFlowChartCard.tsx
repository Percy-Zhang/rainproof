import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/ui';
import { formatMoney } from '../../domain/money';
import type { StatsMonthlyTrendBucket, StatsMonthlyTrendSummary } from '../../domain/statsTrends';
import { colors, spacing, typography } from '../../theme/tokens';
import { formatSignedMoney } from './StatsScreenUtils';

const BAR_HEIGHT = 104;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function StatsMonthlyCashFlowChartCard({
  currencyCode,
  monthlyTrendSummary,
  onSelectMonth,
  selectedMonthKey,
}: {
  currencyCode: string;
  monthlyTrendSummary: StatsMonthlyTrendSummary;
  onSelectMonth: (monthKey: string) => void;
  selectedMonthKey: string | null;
}) {
  const buckets = monthlyTrendSummary.buckets;
  const chartScrollRef = useRef<ScrollView>(null);
  const maxAmountMinor = buckets.reduce(
    (maximum, bucket) => Math.max(maximum, bucket.incomeNetMinor, bucket.spendingNetMinor),
    0,
  );
  const selectedBucket = buckets.find((bucket) => bucket.monthKey === selectedMonthKey) ?? buckets.at(-1);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => chartScrollRef.current?.scrollToEnd?.({ animated: false }));
    return () => cancelAnimationFrame(frameId);
  }, [buckets]);

  return (
    <Card testID="monthly-trend-card">
      <View style={styles.headerRow}>
        <Text style={styles.title}>Monthly cash flow</Text>
        <View accessibilityLabel="Income and spending chart legend" style={styles.legend}>
          <LegendItem color={colors.success} label="Income" />
          <LegendItem color={colors.danger} label="Spending" />
        </View>
      </View>

      {buckets.length && maxAmountMinor > 0 ? (
        <>
          <ScrollView
            contentContainerStyle={styles.chartContent}
            horizontal
            nestedScrollEnabled
            ref={chartScrollRef}
            showsHorizontalScrollIndicator={false}
            testID="monthly-cash-flow-chart-scroll"
          >
            {buckets.map((bucket, index) => {
              const labels = getMonthGroupLabels(bucket.monthKey, buckets[index - 1]?.monthKey);

              return (
                <MonthBarGroup
                  key={bucket.monthKey}
                  bucket={bucket}
                  currencyCode={currencyCode}
                  maxAmountMinor={maxAmountMinor}
                  monthLabel={labels.monthLabel}
                  onPress={() => onSelectMonth(bucket.monthKey)}
                  selected={bucket.monthKey === selectedBucket?.monthKey}
                  yearLabel={labels.yearLabel}
                />
              );
            })}
          </ScrollView>

          {selectedBucket ? (
            <SelectedMonthDetail bucket={selectedBucket} currencyCode={currencyCode} />
          ) : null}
        </>
      ) : (
        <Text style={styles.emptyText} testID="monthly-cash-flow-empty">
          No monthly cash-flow activity for this filter.
        </Text>
      )}
    </Card>
  );
}

function MonthBarGroup({
  bucket,
  currencyCode,
  maxAmountMinor,
  monthLabel,
  onPress,
  selected,
  yearLabel,
}: {
  bucket: StatsMonthlyTrendBucket;
  currencyCode: string;
  maxAmountMinor: number;
  monthLabel: string;
  onPress: () => void;
  selected: boolean;
  yearLabel?: string;
}) {
  const incomeHeight = getBarHeight(bucket.incomeNetMinor, maxAmountMinor);
  const spendingHeight = getBarHeight(bucket.spendingNetMinor, maxAmountMinor);

  return (
    <Pressable
      accessibilityLabel={`${bucket.monthLabel}, Income ${formatMoney(bucket.incomeNetMinor, currencyCode)}, Spending ${formatMoney(bucket.spendingNetMinor, currencyCode)}, Net ${formatSignedMoney(bucket.netCashFlowMinor, currencyCode)}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.monthGroup,
        selected && styles.monthGroupSelected,
        pressed && styles.monthGroupPressed,
      ]}
      testID={`monthly-cash-flow-month-${bucket.monthKey}`}
    >
      <View accessible={false} style={styles.barArea}>
        <View
          style={[styles.bar, styles.incomeBar, { height: incomeHeight }]}
          testID={`monthly-cash-flow-income-bar-${bucket.monthKey}`}
        />
        <View
          style={[styles.bar, styles.spendingBar, { height: spendingHeight }]}
          testID={`monthly-cash-flow-spending-bar-${bucket.monthKey}`}
        />
      </View>
      <View style={styles.labelArea}>
        <Text
          numberOfLines={1}
          style={[styles.monthLabel, selected && styles.monthLabelSelected]}
          testID={`monthly-cash-flow-month-label-${bucket.monthKey}`}
        >
          {monthLabel}
        </Text>
        {yearLabel ? (
          <Text
            style={[styles.yearLabel, selected && styles.monthLabelSelected]}
            testID={`monthly-cash-flow-year-label-${bucket.monthKey}`}
          >
            {yearLabel}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function SelectedMonthDetail({
  bucket,
  currencyCode,
}: {
  bucket: StatsMonthlyTrendBucket;
  currencyCode: string;
}) {
  return (
    <View
      accessibilityLabel={`${bucket.monthLabel}. Income ${formatMoney(bucket.incomeNetMinor, currencyCode)}. Spending ${formatMoney(bucket.spendingNetMinor, currencyCode)}. Net ${formatSignedMoney(bucket.netCashFlowMinor, currencyCode)}.`}
      accessible
      style={styles.detail}
      testID="monthly-cash-flow-selected-detail"
    >
      <Text style={styles.detailMonth} testID="monthly-cash-flow-selected-month">
        {bucket.monthLabel}
      </Text>
      <View style={styles.detailValues}>
        <DetailValue
          label="Income"
          testID="monthly-cash-flow-selected-income"
          tone="income"
          value={formatMoney(bucket.incomeNetMinor, currencyCode)}
        />
        <DetailValue
          label="Spending"
          testID="monthly-cash-flow-selected-spending"
          tone="expense"
          value={formatMoney(bucket.spendingNetMinor, currencyCode)}
        />
        <DetailValue
          label="Net"
          testID="monthly-cash-flow-selected-net"
          tone={bucket.netCashFlowMinor > 0 ? 'income' : bucket.netCashFlowMinor < 0 ? 'expense' : undefined}
          value={formatSignedMoney(bucket.netCashFlowMinor, currencyCode)}
        />
      </View>
    </View>
  );
}

function DetailValue({
  label,
  testID,
  tone,
  value,
}: {
  label: string;
  testID: string;
  tone?: 'income' | 'expense';
  value: string;
}) {
  return (
    <View style={styles.detailValue}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        numberOfLines={1}
        style={[
          styles.detailAmount,
          tone === 'income' && styles.incomeText,
          tone === 'expense' && styles.expenseText,
        ]}
        testID={testID}
      >
        {value}
      </Text>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function getBarHeight(amountMinor: number, maximumMinor: number): number {
  if (amountMinor <= 0 || maximumMinor <= 0) {
    return 0;
  }

  return Math.max(3, (amountMinor / maximumMinor) * BAR_HEIGHT);
}

function getMonthGroupLabels(
  monthKey: string,
  previousMonthKey?: string,
): { monthLabel: string; yearLabel?: string } {
  const [year, month] = monthKey.split('-').map(Number);
  const monthLabel = MONTH_NAMES[month - 1] ?? monthKey;
  const previousYear = previousMonthKey?.slice(0, 4);

  return {
    monthLabel,
    yearLabel: !previousYear || previousYear !== String(year) ? String(year) : undefined,
  };
}

const styles = StyleSheet.create({
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  title: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '800',
  },
  legend: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  legendSwatch: {
    height: 8,
    width: 8,
  },
  legendLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
  },
  chartContent: {
    alignItems: 'flex-end',
    flexGrow: 1,
    gap: spacing.sm,
    justifyContent: 'space-around',
    paddingVertical: spacing.xs,
  },
  monthGroup: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    minHeight: BAR_HEIGHT + 46,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
    width: 54,
  },
  monthGroupSelected: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.primary,
  },
  monthGroupPressed: {
    opacity: 0.76,
  },
  barArea: {
    alignItems: 'flex-end',
    borderBottomColor: colors.faint,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 4,
    height: BAR_HEIGHT,
    justifyContent: 'center',
    width: 36,
  },
  bar: {
    width: 13,
  },
  incomeBar: {
    backgroundColor: colors.success,
  },
  spendingBar: {
    backgroundColor: colors.danger,
  },
  monthLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    lineHeight: 15,
    textAlign: 'center',
  },
  labelArea: {
    alignItems: 'center',
    height: 34,
    width: 54,
  },
  yearLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    lineHeight: 15,
    textAlign: 'center',
  },
  monthLabelSelected: {
    color: colors.primaryDark,
    fontWeight: '900',
  },
  detail: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  detailMonth: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  detailValues: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  detailValue: {
    flex: 1,
    minWidth: 78,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
  },
  detailAmount: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  incomeText: {
    color: colors.success,
  },
  expenseText: {
    color: colors.danger,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
  },
});
