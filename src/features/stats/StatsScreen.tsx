import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SectionHeader } from '../../components/ui';
import type { AppSnapshot } from '../../domain/types';
import type { RootStackParamList } from '../../navigation/routes';
import { StatsBottomControls } from './StatsBottomControls';
import { StatsCategoryColorsCard } from './StatsCategoryColorsCard';
import {
  CashFlowCard,
  GrossNetSpendingCard,
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
  snapshot: AppSnapshot;
  onOpenTransaction?: (transactionId: string) => void;
  onOpenStatsDrilldown?: (params: RootStackParamList['StatsDrilldown']) => void;
  showHeader?: boolean;
};

export function StatsScreen({
  snapshot,
  onOpenTransaction,
  onOpenStatsDrilldown,
  showHeader = true,
}: StatsScreenProps) {
  const insets = useSafeAreaInsets();
  const viewModel = useStatsViewModel({
    bottomInset: insets.bottom,
    onOpenStatsDrilldown,
    snapshot,
  });

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: viewModel.bottomPadding }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {showHeader ? (
          <SectionHeader
            title="Statistics"
            detail="Shared period, currency, and account filters for spending and cash flow."
          />
        ) : null}

        <CashFlowCard cashFlow={viewModel.cashFlow} currencyCode={viewModel.currencyCode} />
        <MonthlyAveragesCard
          currencyCode={viewModel.currencyCode}
          monthlyTrendSummary={viewModel.monthlyTrendSummary}
        />
        <GrossNetSpendingCard
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
        <StatsCategoryColorsCard categories={viewModel.categories} />
      </ScrollView>

      <StatsBottomControls
        accountsForCurrency={viewModel.accountsForCurrency}
        currencies={viewModel.currencies}
        currencyCode={viewModel.currencyCode}
        customEndDate={viewModel.customEndDate}
        customStartDate={viewModel.customStartDate}
        datePickerTarget={viewModel.datePickerTarget}
        effectiveAccountId={viewModel.effectiveAccountId}
        onChangeCurrency={viewModel.changeCurrency}
        onCloseDatePicker={() => viewModel.setDatePickerTarget(null)}
        onDatePickerChange={viewModel.handleDatePickerChange}
        onOpenDatePicker={viewModel.setDatePickerTarget}
        onSelectAccount={viewModel.setAccountId}
        onSelectPeriodOption={viewModel.selectPeriodOption}
        rangeMode={viewModel.rangeMode}
        selectedPeriodOption={viewModel.selectedPeriodOption}
        showCurrencyCodes={viewModel.showCurrencyCodes}
      />
    </View>
  );
}
