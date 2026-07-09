import { Pressable, Text, View } from 'react-native';

import { ActionButton, Card } from '../../components/ui';
import { formatMoney } from '../../domain/money';
import type { StatsDonutMode, StatsDonutViewModel } from '../../domain/statsChart';
import type { StatsReportKind } from '../../domain/statsReports';
import { StatsRecentMatchRow } from './StatsReportRows';
import { statsStyles as styles } from './StatsScreenStyles';
import { StatsDonutChart } from './StatsDonutChart';

export function StatsSpendingCard({
  currencyCode,
  onOpenDrilldown,
  onOpenDetailedView,
  onOpenTransaction,
  onReturnToCategories,
  onSelectRollup,
  onSelectStatsReportKind,
  spendingDonut,
  spendingDonutMode,
  statsReportKind,
}: {
  currencyCode: string;
  onOpenDrilldown?: () => void;
  onOpenDetailedView: () => void;
  onOpenTransaction?: (transactionId: string) => void;
  onReturnToCategories: () => void;
  onSelectRollup: (rollupId: string) => void;
  onSelectStatsReportKind: (reportKind: StatsReportKind) => void;
  spendingDonut: StatsDonutViewModel;
  spendingDonutMode: StatsDonutMode;
  statsReportKind: StatsReportKind;
}) {
  const selectedSpendingRollup = spendingDonut.selectedRollup;
  const hasSpending = spendingDonut.rollups.some((rollup) => rollup.netAmountMinor > 0);
  const reportCopy = getStatsReportKindCopy(statsReportKind);
  const recentMatchesTitle = selectedSpendingRollup ? 'Recent matches' : `Recent ${reportCopy.lower}`;
  const recentMatchesDetail = selectedSpendingRollup
    ? `${selectedSpendingRollup.label} - ${formatMoney(selectedSpendingRollup.netAmountMinor, currencyCode)}`
    : `All ${reportCopy.lower} - ${formatMoney(spendingDonut.totalNetAmountMinor, currencyCode)}`;

  return (
    <Card testID="spending-chart-card">
      <View style={styles.cardHeaderRow}>
        <View style={[styles.cardHeaderText, styles.chartCardHeaderText]}>
          <Text style={styles.cardTitle}>{reportCopy.title}</Text>
          {spendingDonutMode === 'subcategory' && spendingDonut.selectedCategoryRollup ? (
            <Text numberOfLines={1} style={styles.cardSubtitle}>
              {spendingDonut.selectedCategoryRollup.label}
            </Text>
          ) : null}
        </View>
        <View style={styles.chartHeaderActions}>
          {spendingDonutMode === 'subcategory' ? (
            <ActionButton variant="ghost" onPress={onReturnToCategories}>
              Back to categories
            </ActionButton>
          ) : (
            <ActionButton
              disabled={!spendingDonut.canShowDetailedView}
              variant="secondary"
              onPress={onOpenDetailedView}
            >
              Detailed view
            </ActionButton>
          )}
        </View>
      </View>

      <StatsDonutChart
        accessibilityLabel={`Select ${reportCopy.lower} slice`}
        currencyCode={currencyCode}
        emptyLabel={spendingDonut.emptyLabel}
        rollups={spendingDonut.rollups}
        selectedRollupId={selectedSpendingRollup?.id}
        totalLabel={`Total ${reportCopy.lower}`}
        onSelectRollup={onSelectRollup}
      />

      <View style={styles.reportKindSwitchRow} testID="stats-report-mode-row">
        <StatsReportKindSwitch
          selectedReportKind={statsReportKind}
          onSelectReportKind={onSelectStatsReportKind}
        />
      </View>

      {hasSpending ? (
        <View style={styles.matchSection}>
          <View style={styles.matchHeaderRow}>
            <View style={styles.matchHeaderText}>
              <Text style={styles.matchTitle}>{recentMatchesTitle}</Text>
              <Text style={styles.matchDetail}>{recentMatchesDetail}</Text>
            </View>
            {selectedSpendingRollup && onOpenDrilldown ? (
              <ActionButton variant="ghost" onPress={onOpenDrilldown}>
                See all
              </ActionButton>
            ) : null}
          </View>

          {spendingDonut.recentRows.length ? (
            <View style={styles.matchRows}>
              {spendingDonut.recentRows.map((row) => (
                <StatsRecentMatchRow
                  key={row.lineId}
                  row={row}
                  onOpenTransaction={onOpenTransaction}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No matching transactions.</Text>
          )}
        </View>
      ) : null}
    </Card>
  );
}

function StatsReportKindSwitch({
  selectedReportKind,
  onSelectReportKind,
}: {
  selectedReportKind: StatsReportKind;
  onSelectReportKind: (reportKind: StatsReportKind) => void;
}) {
  return (
    <View accessibilityLabel="Statistics report mode" style={styles.reportKindSwitch}>
      {(['expense', 'income'] as const).map((reportKind) => {
        const selected = selectedReportKind === reportKind;
        const label = reportKind === 'expense' ? 'Expenses' : 'Income';

        return (
          <Pressable
            key={reportKind}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelectReportKind(reportKind)}
            style={({ pressed }) => [
              styles.reportKindOption,
              selected && styles.reportKindOptionSelected,
              pressed && styles.pressed,
            ]}
            testID={`stats-report-mode-${reportKind}`}
          >
            <Text style={[styles.reportKindOptionText, selected && styles.reportKindOptionTextSelected]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function getStatsReportKindCopy(reportKind: StatsReportKind): { lower: string; title: string } {
  return reportKind === 'expense'
    ? { lower: 'expenses', title: 'Expenses' }
    : { lower: 'income', title: 'Income' };
}
