import { ScrollView, Text, View } from 'react-native';

import { Card, Chip } from '../../components/ui';
import type { StatsDrilldownData, StatsDrilldownDisplayMode } from '../../domain/statsDrilldown';
import type { StatsReportKind, StatsReportSort } from '../../domain/statsReports';
import { statsDrilldownStyles as styles } from './StatsDrilldownStyles';
import {
  StatsDrilldownLineRowItem,
  StatsDrilldownParentRowItem,
} from './StatsReportRows';
import { formatSignedReportAmount } from './StatsScreenUtils';

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

export function StatsDrilldownSummaryCard({
  currencyCode,
  reportKind,
  title,
  totalNetMinor,
  transactionCount,
}: {
  currencyCode: string;
  reportKind: StatsReportKind;
  title: string;
  totalNetMinor: number;
  transactionCount: number;
}) {
  return (
    <Card style={styles.summaryCard} testID="stats-drilldown-summary">
      <Text style={styles.kicker}>{reportKind === 'expense' ? 'Spending drilldown' : 'Income drilldown'}</Text>
      <Text numberOfLines={2} style={styles.title}>{title}</Text>
      <View style={styles.summaryRow}>
        <SummaryMetric label="Total" value={formatSignedReportAmount(totalNetMinor, currencyCode, reportKind)} />
        <SummaryMetric label="Records" value={`${transactionCount}`} />
      </View>
    </Card>
  );
}

export function StatsDrilldownControlsCard({
  displayMode,
  onChangeDisplayMode,
  onChangeSort,
  sort,
}: {
  displayMode: StatsDrilldownDisplayMode;
  onChangeDisplayMode: (displayMode: StatsDrilldownDisplayMode) => void;
  onChangeSort: (sort: StatsReportSort) => void;
  sort: StatsReportSort;
}) {
  return (
    <Card style={styles.controlsCard}>
      <Text style={styles.controlTitle}>View</Text>
      <View style={styles.wrap}>
        <Chip selected={displayMode === 'parent'} onPress={() => onChangeDisplayMode('parent')}>
          Parent transactions
        </Chip>
        <Chip selected={displayMode === 'line'} onPress={() => onChangeDisplayMode('line')}>
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
            <Chip key={option.value} selected={sort === option.value} onPress={() => onChangeSort(option.value)}>
              {option.label}
            </Chip>
          ))}
        </View>
      </ScrollView>
    </Card>
  );
}

export function StatsDrilldownResultsCard({
  displayMode,
  drilldown,
  onOpenTransaction,
  reportKind,
  rowsShown,
}: {
  displayMode: StatsDrilldownDisplayMode;
  drilldown: StatsDrilldownData;
  onOpenTransaction: (transactionId: string) => void;
  reportKind: StatsReportKind;
  rowsShown: number;
}) {
  return (
    <Card style={styles.resultsCard} testID="stats-drilldown-results">
      <View style={styles.resultsHeader}>
        <Text style={styles.cardTitle}>{displayMode === 'parent' ? 'Parent transactions' : 'Split lines / records'}</Text>
        <Text style={styles.resultCount}>{rowsShown}</Text>
      </View>

      {displayMode === 'parent' ? (
        drilldown.parentRows.length ? (
          <View style={styles.rows}>
            {drilldown.parentRows.map((row) => (
              <StatsDrilldownParentRowItem
                key={row.transactionId}
                reportKind={reportKind}
                row={row}
                onOpenTransaction={onOpenTransaction}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No matching parent transactions.</Text>
        )
      ) : drilldown.lineRows.length ? (
        <View style={styles.rows}>
          {drilldown.lineRows.map((row) => (
            <StatsDrilldownLineRowItem
              key={row.lineId}
              row={row}
              onOpenTransaction={onOpenTransaction}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>No matching records.</Text>
      )}
    </Card>
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
