import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, Chip } from '../../components/ui';
import { getCategory, getSubcategoryName } from '../../domain/categories';
import {
  getStatsDrilldownData,
  getStatsDrilldownOpenTransactionId,
  type StatsDrilldownDisplayMode,
  type StatsDrilldownParentRow,
} from '../../domain/statsDrilldown';
import { getStatsReport, type StatsReportLineRow, type StatsReportSort } from '../../domain/statsReports';
import { getStatsMatchRowDetailText } from '../../domain/statsChart';
import { formatMoney } from '../../domain/money';
import { formatTransactionShortDate } from '../../domain/transactionDisplay';
import type { AppSnapshot } from '../../domain/types';
import type { RootStackParamList } from '../../navigation/routes';
import { colors, spacing, typography } from '../../theme/tokens';

type StatsDrilldownParams = RootStackParamList['StatsDrilldown'];

type StatsDrilldownScreenProps = {
  snapshot: AppSnapshot;
  params: StatsDrilldownParams;
  onOpenTransaction: (transactionId: string) => void;
  onBack: () => void;
};

const sortOptions: { value: StatsReportSort; label: string }[] = [
  { value: 'date_newest', label: 'Date newest' },
  { value: 'date_oldest', label: 'Date oldest' },
  { value: 'net_amount_highest', label: 'Net high' },
  { value: 'net_amount_lowest', label: 'Net low' },
  { value: 'gross_amount_highest', label: 'Gross high' },
  { value: 'gross_amount_lowest', label: 'Gross low' },
  { value: 'item_az', label: 'Item A-Z' },
  { value: 'item_za', label: 'Item Z-A' },
  { value: 'category_subcategory', label: 'Category' },
  { value: 'account', label: 'Account' },
];

export function StatsDrilldownScreen({ snapshot, params, onOpenTransaction, onBack }: StatsDrilldownScreenProps) {
  const [displayMode, setDisplayMode] = useState<StatsDrilldownDisplayMode>('parent');
  const [sort, setSort] = useState<StatsReportSort>(params.initialSort ?? 'date_newest');
  const report = useMemo(() => getStatsReport({
    reportKind: params.reportKind,
    transactions: snapshot.transactions,
    transactionLines: snapshot.transactionLines,
    transactionLinks: snapshot.transactionLinks,
    accounts: snapshot.accounts,
    categories: snapshot.categories,
    range: {
      startIso: params.startIso,
      endIso: params.endIso,
    },
    currencyCode: params.currencyCode,
    accountIds: params.accountIds,
  }), [params, snapshot.accounts, snapshot.categories, snapshot.transactionLines, snapshot.transactionLinks, snapshot.transactions]);
  const drilldown = useMemo(() => getStatsDrilldownData({
    report,
    categoryId: params.categoryId,
    subcategoryId: params.subcategoryId,
    sort,
  }), [params.categoryId, params.subcategoryId, report, sort]);
  const category = getCategory(params.categoryId, snapshot.categories);
  const title = params.subcategoryId
    ? getSubcategoryName(params.categoryId, params.subcategoryId, snapshot.categories)
    : category.name;
  const rowsShown = displayMode === 'parent' ? drilldown.parentRows.length : drilldown.lineRows.length;
  const totalNetMinor = drilldown.lineRows.reduce((sum, row) => sum + row.netAmountMinor, 0);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          testID="stats-drilldown-back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>Stats details</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.summaryCard} testID="stats-drilldown-summary">
          <Text style={styles.kicker}>{params.reportKind === 'expense' ? 'Spending drilldown' : 'Income drilldown'}</Text>
          <Text numberOfLines={2} style={styles.title}>{title}</Text>
          <View style={styles.summaryRow}>
            <SummaryMetric label="Total" value={formatSignedAmount(totalNetMinor, params.currencyCode, params.reportKind)} />
            <SummaryMetric label="Records" value={`${drilldown.lineRows.length}`} />
          </View>
        </Card>

        <Card style={styles.controlsCard}>
          <Text style={styles.controlTitle}>View</Text>
          <View style={styles.wrap}>
            <Chip selected={displayMode === 'parent'} onPress={() => setDisplayMode('parent')}>
              Parent transactions
            </Chip>
            <Chip selected={displayMode === 'line'} onPress={() => setDisplayMode('line')}>
              Split lines / records
            </Chip>
          </View>
          <Text style={styles.controlTitle}>Sort</Text>
          <ScrollView
            horizontal
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
          >
            <View style={styles.sortRow}>
              {sortOptions.map((option) => (
                <Chip key={option.value} selected={sort === option.value} onPress={() => setSort(option.value)}>
                  {option.label}
                </Chip>
              ))}
            </View>
          </ScrollView>
        </Card>

        <Card style={styles.resultsCard} testID="stats-drilldown-results">
          <View style={styles.resultsHeader}>
            <Text style={styles.cardTitle}>{displayMode === 'parent' ? 'Parent transactions' : 'Split lines / records'}</Text>
            <Text style={styles.resultCount}>{rowsShown}</Text>
          </View>

          {displayMode === 'parent' ? (
            drilldown.parentRows.length ? (
              <View style={styles.rows}>
                {drilldown.parentRows.map((row) => (
                  <ParentDrilldownRow
                    key={row.transactionId}
                    reportKind={params.reportKind}
                    row={row}
                    onPress={() => onOpenTransaction(getStatsDrilldownOpenTransactionId(row))}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>No matching parent transactions.</Text>
            )
          ) : drilldown.lineRows.length ? (
            <View style={styles.rows}>
              {drilldown.lineRows.map((row) => (
                <LineDrilldownRow
                  key={row.lineId}
                  row={row}
                  onPress={() => onOpenTransaction(getStatsDrilldownOpenTransactionId(row))}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No matching records.</Text>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryMetric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function ParentDrilldownRow({
  reportKind,
  row,
  onPress,
}: {
  reportKind: 'expense' | 'income';
  row: StatsDrilldownParentRow;
  onPress: () => void;
}) {
  const title = row.transactionTitle || row.primaryRow.lineItemName || row.primaryRow.subcategoryName;
  const lineSummary = row.lineCount > 1
    ? `${row.lineCount} matching records`
    : row.primaryRow.lineItemName;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      testID={`stats-drilldown-parent-${row.transactionId}`}
    >
      <View style={styles.rowBody}>
        <View style={styles.rowLine}>
          <Text numberOfLines={1} style={styles.rowTitle}>{title}</Text>
          <Text style={[styles.rowAmount, getAmountStyle(reportKind)]}>
            {formatSignedAmount(row.netAmountMinor, row.currencyCode, reportKind)}
          </Text>
        </View>
        <Text numberOfLines={1} style={styles.rowDetail}>
          {lineSummary} - {row.primaryRow.subcategoryName}
        </Text>
        <View style={styles.rowLine}>
          <Text numberOfLines={1} style={styles.rowMeta}>{row.accountName}</Text>
          <Text style={styles.rowMeta}>{formatTransactionShortDate(row.transactionDatetime)}</Text>
        </View>
        {row.grossAmountMinor !== row.netAmountMinor ? (
          <Text style={styles.rowMeta}>Gross {formatSignedAmount(row.grossAmountMinor, row.currencyCode, reportKind)}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function LineDrilldownRow({ row, onPress }: { row: StatsReportLineRow; onPress: () => void }) {
  const title = row.lineItemName || row.transactionTitle || row.subcategoryName;
  const parentTitle = row.transactionTitle && row.transactionTitle !== title ? row.transactionTitle : '';
  const lineDetail = getStatsMatchRowDetailText(row);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, row.isSplitTransaction && styles.splitLineRow, pressed && styles.pressed]}
      testID={`stats-drilldown-line-${row.lineId}`}
    >
      <View style={[styles.lineDot, { backgroundColor: row.subcategoryColor }]} />
      <View style={styles.rowBody}>
        <View style={styles.rowLine}>
          <Text numberOfLines={1} style={styles.rowTitle}>{title}</Text>
          <Text style={[styles.rowAmount, getAmountStyle(row.reportKind)]}>
            {formatSignedAmount(row.netAmountMinor, row.currencyCode, row.reportKind)}
          </Text>
        </View>
        {parentTitle ? <Text numberOfLines={1} style={styles.rowDetail}>{parentTitle}</Text> : null}
        <View style={styles.rowLine}>
          <Text numberOfLines={1} style={styles.rowMeta}>{lineDetail}</Text>
          <Text style={styles.rowMeta}>{formatTransactionShortDate(row.transactionDatetime)}</Text>
        </View>
        <Text numberOfLines={1} style={styles.rowMeta}>{row.accountName}</Text>
        {row.grossAmountMinor !== row.netAmountMinor ? (
          <Text style={styles.rowMeta}>Gross {formatSignedAmount(row.grossAmountMinor, row.currencyCode, row.reportKind)}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function formatSignedAmount(amountMinor: number, currencyCode: string, reportKind: 'expense' | 'income'): string {
  return `${reportKind === 'expense' ? '-' : '+'}${formatMoney(amountMinor, currencyCode)}`;
}

function getAmountStyle(reportKind: 'expense' | 'income') {
  return reportKind === 'expense' ? styles.expenseAmount : styles.incomeAmount;
}

const styles = StyleSheet.create({
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
