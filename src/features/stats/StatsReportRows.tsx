import { Pressable, Text, View } from 'react-native';

import { getStatsDrilldownOpenTransactionId, type StatsDrilldownParentRow } from '../../domain/statsDrilldown';
import { getStatsMatchRowDetailText } from '../../domain/statsChart';
import type { StatsReportKind, StatsReportLineRow } from '../../domain/statsReports';
import { formatMoney } from '../../domain/money';
import { formatTransactionShortDate } from '../../domain/transactionDisplay';
import { statsDrilldownStyles as drilldownStyles } from './StatsDrilldownStyles';
import { statsStyles } from './StatsScreenStyles';
import { formatSignedReportAmount } from './StatsScreenUtils';

export function StatsRecentMatchRow({
  row,
  onOpenTransaction,
}: {
  row: StatsReportLineRow;
  onOpenTransaction?: (transactionId: string) => void;
}) {
  const title = row.transactionTitle || row.lineItemName || row.subcategoryName;
  const lineDetail = getStatsMatchRowDetailText(row);
  const amountPrefix = row.reportKind === 'expense' ? '-' : '+';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onOpenTransaction}
      onPress={() => onOpenTransaction?.(row.transactionId)}
      style={({ pressed }) => [statsStyles.matchRow, pressed && statsStyles.pressed]}
      testID={`stats-match-row-${row.lineId}`}
    >
      <View style={[statsStyles.matchIcon, { backgroundColor: row.subcategoryColor }]} />
      <View style={statsStyles.matchBody}>
        <View style={statsStyles.transactionLine}>
          <Text numberOfLines={1} style={statsStyles.matchRowTitle}>
            {row.lineItemName}
          </Text>
          <Text style={statsStyles.matchAmount}>
            {amountPrefix}{formatMoney(row.netAmountMinor, row.currencyCode)}
          </Text>
        </View>
        <Text numberOfLines={1} style={statsStyles.matchLineDetail}>
          {title}
        </Text>
        <View style={statsStyles.transactionLine}>
          <Text numberOfLines={1} style={statsStyles.matchMeta}>
            {lineDetail}
          </Text>
          <Text style={statsStyles.matchMeta}>{formatTransactionShortDate(row.transactionDatetime)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function StatsDrilldownParentRowItem({
  reportKind,
  row,
  onOpenTransaction,
}: {
  reportKind: StatsReportKind;
  row: StatsDrilldownParentRow;
  onOpenTransaction: (transactionId: string) => void;
}) {
  const title = row.transactionTitle || row.primaryRow.lineItemName || row.primaryRow.subcategoryName;
  const lineSummary = row.lineCount > 1
    ? `${row.lineCount} matching records`
    : row.primaryRow.lineItemName;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onOpenTransaction(getStatsDrilldownOpenTransactionId(row))}
      style={({ pressed }) => [drilldownStyles.row, pressed && drilldownStyles.pressed]}
      testID={`stats-drilldown-parent-${row.transactionId}`}
    >
      <View style={drilldownStyles.rowBody}>
        <View style={drilldownStyles.rowLine}>
          <Text numberOfLines={1} style={drilldownStyles.rowTitle}>{title}</Text>
          <Text style={[drilldownStyles.rowAmount, getDrilldownAmountStyle(reportKind)]}>
            {formatSignedReportAmount(row.netAmountMinor, row.currencyCode, reportKind)}
          </Text>
        </View>
        <Text numberOfLines={1} style={drilldownStyles.rowDetail}>
          {lineSummary} - {row.primaryRow.subcategoryName}
        </Text>
        <View style={drilldownStyles.rowLine}>
          <Text numberOfLines={1} style={drilldownStyles.rowMeta}>{row.accountName}</Text>
          <Text style={drilldownStyles.rowMeta}>{formatTransactionShortDate(row.transactionDatetime)}</Text>
        </View>
        {row.grossAmountMinor !== row.netAmountMinor ? (
          <Text style={drilldownStyles.rowMeta}>Gross {formatSignedReportAmount(row.grossAmountMinor, row.currencyCode, reportKind)}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function StatsDrilldownLineRowItem({
  row,
  onOpenTransaction,
}: {
  row: StatsReportLineRow;
  onOpenTransaction: (transactionId: string) => void;
}) {
  const title = row.lineItemName || row.transactionTitle || row.subcategoryName;
  const parentTitle = row.transactionTitle && row.transactionTitle !== title ? row.transactionTitle : '';
  const lineDetail = getStatsMatchRowDetailText(row);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onOpenTransaction(getStatsDrilldownOpenTransactionId(row))}
      style={({ pressed }) => [
        drilldownStyles.row,
        row.isSplitTransaction && drilldownStyles.splitLineRow,
        pressed && drilldownStyles.pressed,
      ]}
      testID={`stats-drilldown-line-${row.lineId}`}
    >
      <View style={[drilldownStyles.lineDot, { backgroundColor: row.subcategoryColor }]} />
      <View style={drilldownStyles.rowBody}>
        <View style={drilldownStyles.rowLine}>
          <Text numberOfLines={1} style={drilldownStyles.rowTitle}>{title}</Text>
          <Text style={[drilldownStyles.rowAmount, getDrilldownAmountStyle(row.reportKind)]}>
            {formatSignedReportAmount(row.netAmountMinor, row.currencyCode, row.reportKind)}
          </Text>
        </View>
        {parentTitle ? <Text numberOfLines={1} style={drilldownStyles.rowDetail}>{parentTitle}</Text> : null}
        <View style={drilldownStyles.rowLine}>
          <Text numberOfLines={1} style={drilldownStyles.rowMeta}>{lineDetail}</Text>
          <Text style={drilldownStyles.rowMeta}>{formatTransactionShortDate(row.transactionDatetime)}</Text>
        </View>
        <Text numberOfLines={1} style={drilldownStyles.rowMeta}>{row.accountName}</Text>
        {row.grossAmountMinor !== row.netAmountMinor ? (
          <Text style={drilldownStyles.rowMeta}>Gross {formatSignedReportAmount(row.grossAmountMinor, row.currencyCode, row.reportKind)}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function getDrilldownAmountStyle(reportKind: StatsReportKind) {
  return reportKind === 'expense' ? drilldownStyles.expenseAmount : drilldownStyles.incomeAmount;
}
