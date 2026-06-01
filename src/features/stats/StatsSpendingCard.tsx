import { Text, View } from 'react-native';

import { ActionButton, Card } from '../../components/ui';
import { formatMoney } from '../../domain/money';
import type { StatsDonutMode, StatsDonutViewModel } from '../../domain/statsChart';
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
  spendingDonut,
  spendingDonutMode,
}: {
  currencyCode: string;
  onOpenDrilldown?: () => void;
  onOpenDetailedView: () => void;
  onOpenTransaction?: (transactionId: string) => void;
  onReturnToCategories: () => void;
  onSelectRollup: (rollupId: string) => void;
  spendingDonut: StatsDonutViewModel;
  spendingDonutMode: StatsDonutMode;
}) {
  const selectedSpendingRollup = spendingDonut.selectedRollup;
  const hasSpending = spendingDonut.rollups.some((rollup) => rollup.netAmountMinor > 0);
  const recentMatchesTitle = selectedSpendingRollup ? 'Recent matches' : 'Recent spending';
  const recentMatchesDetail = selectedSpendingRollup
    ? `${selectedSpendingRollup.label} - ${formatMoney(selectedSpendingRollup.netAmountMinor, currencyCode)}`
    : `All spending - ${formatMoney(spendingDonut.totalNetAmountMinor, currencyCode)}`;

  return (
    <Card testID="spending-chart-card">
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>Spending</Text>
          {spendingDonutMode === 'subcategory' && spendingDonut.selectedCategoryRollup ? (
            <Text numberOfLines={1} style={styles.cardSubtitle}>
              {spendingDonut.selectedCategoryRollup.label}
            </Text>
          ) : null}
        </View>
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

      <StatsDonutChart
        currencyCode={currencyCode}
        emptyLabel={spendingDonut.emptyLabel}
        rollups={spendingDonut.rollups}
        selectedRollupId={selectedSpendingRollup?.id}
        onSelectRollup={onSelectRollup}
      />

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
