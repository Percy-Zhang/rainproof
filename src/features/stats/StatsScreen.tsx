import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CompactAccountSelector } from '../../components/CompactAccountSelector';
import { Chip, SectionHeader } from '../../components/ui';
import type { AccountBalance, AppSnapshot } from '../../domain/types';
import type { RootStackParamList } from '../../navigation/routes';
import { StatsBottomControls } from './StatsBottomControls';
import {
  CashFlowCard,
  MonthlyAveragesCard,
} from './StatsMetricCards';
import { statsStyles as styles } from './StatsScreenStyles';
import { StatsSpendingCard } from './StatsSpendingCard';
import {
  MonthlyCashFlowTrendCard,
  SelectedSpendingTrendCard,
} from './StatsTrendCards';
import { useStatsViewModel } from './useStatsViewModel';

type StatsScreenProps = {
  accountBalances: AccountBalance[];
  snapshot: AppSnapshot;
  defaultSelectedAccountIds?: string[];
  onOpenTransaction?: (transactionId: string) => void;
  onOpenStatsDrilldown?: (params: RootStackParamList['StatsDrilldown']) => void;
  showHeader?: boolean;
};

export function StatsScreen({
  accountBalances,
  snapshot,
  defaultSelectedAccountIds,
  onOpenTransaction,
  onOpenStatsDrilldown,
  showHeader = true,
}: StatsScreenProps) {
  const insets = useSafeAreaInsets();
  const viewModel = useStatsViewModel({
    bottomInset: insets.bottom,
    defaultSelectedAccountIds,
    onOpenStatsDrilldown,
    snapshot,
  });

  return (
    <View style={styles.screen}>
      <View style={styles.fixedFilter}>
        {showHeader ? (
          <SectionHeader
            title="Statistics"
            detail="Review spending and cash flow by period and account."
          />
        ) : null}

        <CompactAccountSelector
          accounts={viewModel.selectableAccounts}
          accountBalances={accountBalances}
          selectedAccountIds={viewModel.selectedAccountIds}
          title="Accounts"
          onClearSelection={viewModel.clearSelectedAccounts}
          onSelectAll={viewModel.selectAllAccounts}
          onToggleAccount={viewModel.toggleAccount}
          testID="stats-account-selector"
        />

        <StatsCurrencyScopeBar
          availableCurrencyCodes={viewModel.availableCurrencyCodes}
          currencyCode={viewModel.currencyCode}
          onSelectCurrencyScope={viewModel.selectCurrencyScope}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: viewModel.bottomPadding }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <CashFlowCard cashFlow={viewModel.cashFlow} currencyCode={viewModel.currencyCode} />
        <MonthlyAveragesCard
          currencyCode={viewModel.currencyCode}
          monthlyTrendSummary={viewModel.monthlyTrendSummary}
        />
        <MonthlyCashFlowTrendCard
          currencyCode={viewModel.currencyCode}
          monthlyTrendSummary={viewModel.monthlyTrendSummary}
        />
        <StatsSpendingCard
          currencyCode={viewModel.currencyCode}
          onOpenDetailedView={viewModel.openSpendingDetailedView}
          onOpenDrilldown={onOpenStatsDrilldown ? viewModel.openSpendingDrilldown : undefined}
          onOpenTransaction={onOpenTransaction}
          onReturnToCategories={viewModel.returnToSpendingCategories}
          onSelectRollup={viewModel.selectSpendingRollup}
          spendingDonut={viewModel.spendingDonut}
          spendingDonutMode={viewModel.spendingDonutMode}
        />
        <SelectedSpendingTrendCard
          currencyCode={viewModel.currencyCode}
          selectedSpendingTrend={viewModel.selectedSpendingTrend}
        />
      </ScrollView>

      <StatsBottomControls
        customEndDate={viewModel.customEndDate}
        customStartDate={viewModel.customStartDate}
        datePickerTarget={viewModel.datePickerTarget}
        onCloseDatePicker={() => viewModel.setDatePickerTarget(null)}
        onDatePickerChange={viewModel.handleDatePickerChange}
        onOpenDatePicker={viewModel.setDatePickerTarget}
        onSelectPeriodOption={viewModel.selectPeriodOption}
        rangeMode={viewModel.rangeMode}
        selectedPeriodOption={viewModel.selectedPeriodOption}
      />
    </View>
  );
}

function StatsCurrencyScopeBar({
  availableCurrencyCodes,
  currencyCode,
  onSelectCurrencyScope,
}: {
  availableCurrencyCodes: string[];
  currencyCode: string;
  onSelectCurrencyScope: (currencyCode: string) => void;
}) {
  if (availableCurrencyCodes.length <= 1) {
    return null;
  }

  return (
    <View style={styles.currencyScopeBar} testID="stats-currency-scope-card">
      <Text style={styles.currencyScopeLabel}>Currency</Text>
      <View style={styles.wrap}>
        {availableCurrencyCodes.map((availableCurrencyCode) => (
          <Chip
            key={availableCurrencyCode}
            selected={currencyCode === availableCurrencyCode}
            onPress={() => onSelectCurrencyScope(availableCurrencyCode)}
          >
            {availableCurrencyCode}
          </Chip>
        ))}
      </View>
    </View>
  );
}
