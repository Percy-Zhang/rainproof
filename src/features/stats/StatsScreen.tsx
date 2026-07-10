import { useCallback, useRef, useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CompactAccountSelector,
  type CompactAccountSelectorMode,
} from '../../components/CompactAccountSelector';
import { Chip, SectionHeader } from '../../components/ui';
import type { AccountBalance, AppSnapshot } from '../../domain/types';
import type { RootStackParamList } from '../../navigation/routes';
import { StatsBalanceHistoryCard } from './StatsBalanceHistoryCard';
import { StatsBottomControls } from './StatsBottomControls';
import { StatsCategoryChangesCard } from './StatsCategoryChangesCard';
import { StatsCashFlowWaterfallCard } from './StatsCashFlowWaterfallCard';
import {
  CashFlowCard,
  MonthlyAveragesCard,
} from './StatsMetricCards';
import { statsStyles as styles } from './StatsScreenStyles';
import { StatsSpendingCard } from './StatsSpendingCard';
import { StatsTransactionAmountDistributionCard } from './StatsTransactionAmountDistributionCard';
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

const STATS_ACCOUNT_HEADER_DELTA_IGNORE_THRESHOLD = 8;
const STATS_ACCOUNT_HEADER_SCROLL_THRESHOLD = 48;
const STATS_ACCOUNT_HEADER_MANUAL_GUARD_MS = 420;
const STATS_ACCOUNT_HEADER_TRANSITION_GUARD_MS = 320;
const STATS_ACCOUNT_HEADER_TOP_RESET_OFFSET = 6;

export function StatsScreen({
  accountBalances,
  snapshot,
  defaultSelectedAccountIds,
  onOpenTransaction,
  onOpenStatsDrilldown,
  showHeader = true,
}: StatsScreenProps) {
  const insets = useSafeAreaInsets();
  const [accountMode, setAccountMode] = useState<CompactAccountSelectorMode>('peek');
  const accountModeRef = useRef<CompactAccountSelectorMode>('peek');
  const headerTransitionUntilRef = useRef(0);
  const manualHeaderLockUntilRef = useRef(0);
  const lastScrollOffsetYRef = useRef(0);
  const scrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const scrollDeltaRef = useRef(0);
  const viewModel = useStatsViewModel({
    bottomInset: insets.bottom,
    defaultSelectedAccountIds,
    onOpenStatsDrilldown,
    snapshot,
  });

  const setAccountModeSynced = useCallback((nextMode: CompactAccountSelectorMode) => {
    accountModeRef.current = nextMode;
    setAccountMode(nextMode);
  }, []);

  const resetScrollIntentTracking = useCallback((offsetY?: number) => {
    if (offsetY !== undefined) {
      lastScrollOffsetYRef.current = offsetY;
    }

    scrollDirectionRef.current = null;
    scrollDeltaRef.current = 0;
  }, []);

  const getRemainingHeaderGuardMs = useCallback(() => Math.max(
    0,
    Math.max(headerTransitionUntilRef.current, manualHeaderLockUntilRef.current) - Date.now(),
  ), []);

  const handleAccountExpandToggle = useCallback(() => {
    const currentMode = accountModeRef.current;
    const nextMode =
      currentMode === 'summary'
        ? 'peek'
        : currentMode === 'peek'
          ? 'expanded'
          : 'peek';

    manualHeaderLockUntilRef.current = Date.now() + STATS_ACCOUNT_HEADER_MANUAL_GUARD_MS;
    headerTransitionUntilRef.current = Date.now() + STATS_ACCOUNT_HEADER_TRANSITION_GUARD_MS;
    resetScrollIntentTracking();
    setAccountModeSynced(nextMode);
  }, [resetScrollIntentTracking, setAccountModeSynced]);

  const compactAccountHeaderFromScroll = useCallback(() => {
    if (accountModeRef.current === 'summary') {
      return;
    }

    headerTransitionUntilRef.current = Date.now() + STATS_ACCOUNT_HEADER_TRANSITION_GUARD_MS;
    setAccountModeSynced('summary');
  }, [setAccountModeSynced]);

  const handleStatsScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const previousOffsetY = lastScrollOffsetYRef.current;
    const deltaY = offsetY - previousOffsetY;
    lastScrollOffsetYRef.current = offsetY;

    if (Math.abs(deltaY) < STATS_ACCOUNT_HEADER_DELTA_IGNORE_THRESHOLD) {
      return;
    }

    if (offsetY <= STATS_ACCOUNT_HEADER_TOP_RESET_OFFSET) {
      resetScrollIntentTracking(offsetY);
      return;
    }

    if (getRemainingHeaderGuardMs() > 0) {
      return;
    }

    const nextDirection = deltaY > 0 ? 'down' : 'up';
    if (scrollDirectionRef.current !== nextDirection) {
      scrollDirectionRef.current = nextDirection;
      scrollDeltaRef.current = 0;
    }

    scrollDeltaRef.current += deltaY;
    if (nextDirection === 'down' && scrollDeltaRef.current >= STATS_ACCOUNT_HEADER_SCROLL_THRESHOLD) {
      scrollDeltaRef.current = 0;
      compactAccountHeaderFromScroll();
      return;
    }

    if (nextDirection === 'up' && scrollDeltaRef.current <= -STATS_ACCOUNT_HEADER_SCROLL_THRESHOLD) {
      scrollDeltaRef.current = 0;
    }
  }, [
    compactAccountHeaderFromScroll,
    getRemainingHeaderGuardMs,
    resetScrollIntentTracking,
  ]);

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
          mode={accountMode}
          onClearSelection={viewModel.clearSelectedAccounts}
          onPressExpandToggle={handleAccountExpandToggle}
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
        onScroll={handleStatsScroll}
        scrollEventThrottle={16}
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
          onSelectStatsReportKind={viewModel.selectStatsReportKind}
          spendingDonut={viewModel.spendingDonut}
          spendingDonutMode={viewModel.spendingDonutMode}
          statsReportKind={viewModel.statsReportKind}
        />
        <StatsBalanceHistoryCard
          currencyCode={viewModel.currencyCode}
          emptyLabel={viewModel.balanceHistoryEmptyLabel}
          mode={viewModel.balanceHistoryMode}
          onSelectMode={viewModel.selectBalanceHistoryMode}
          onSelectPoint={viewModel.selectBalanceHistoryPoint}
          points={viewModel.balanceHistoryPoints}
          selectedChangeMinor={viewModel.selectedBalanceHistoryChangeMinor}
          selectedPoint={viewModel.selectedBalanceHistoryPoint}
        />
        <StatsCategoryChangesCard
          currencyCode={viewModel.currencyCode}
          onOpenCategory={onOpenStatsDrilldown ? viewModel.openCategoryChangeDrilldown : undefined}
          reportKind={viewModel.statsReportKind}
          rows={viewModel.categoryChanges}
        />
        <StatsCashFlowWaterfallCard
          model={viewModel.cashFlowWaterfall}
          onOpenStep={onOpenStatsDrilldown ? viewModel.openCashFlowWaterfallStep : undefined}
        />
        <StatsTransactionAmountDistributionCard
          distribution={viewModel.transactionAmountDistribution}
        />
        <SelectedSpendingTrendCard
          currencyCode={viewModel.currencyCode}
          reportKind={viewModel.statsReportKind}
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
