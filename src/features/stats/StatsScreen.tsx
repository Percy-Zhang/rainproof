import { useCallback, useRef, useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import {
  CompactAccountSelector,
  type CompactAccountSelectorMode,
} from '../../components/CompactAccountSelector';
import { Chip, SectionHeader } from '../../components/ui';
import type { AccountBalance, AppSnapshot } from '../../domain/types';
import type { RootStackParamList } from '../../navigation/routes';
import { spacing } from '../../theme/tokens';
import { StatsBalanceHistoryCard } from './StatsBalanceHistoryCard';
import { StatsBottomControls } from './StatsBottomControls';
import { StatsCategoryChangesCard } from './StatsCategoryChangesCard';
import { StatsCashFlowWaterfallCard } from './StatsCashFlowWaterfallCard';
import { StatsMonthlyCashFlowChartCard } from './StatsMonthlyCashFlowChartCard';
import { StatsReportKindSwitch } from './StatsReportKindSwitch';
import { statsStyles as styles } from './StatsScreenStyles';
import { StatsSectionSelector, type StatsSection } from './StatsSectionSelector';
import { StatsSpendingCard } from './StatsSpendingCard';
import { StatsTransactionAmountDistributionCard } from './StatsTransactionAmountDistributionCard';
import { SelectedSpendingTrendCard } from './StatsTrendCards';
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
const STATS_SECTION_TRANSITION_DURATION_MS = 150;
const STATS_REPORT_KIND_REVEAL_HEIGHT = 42;
const STATS_REPORT_KIND_REVEAL_DURATION_MS = 150;
const STATS_SECTION_LAYOUT_TRANSITION = LinearTransition
  .duration(STATS_SECTION_TRANSITION_DURATION_MS)
  .easing(Easing.out(Easing.cubic))
  .reduceMotion(ReduceMotion.System);
const STATS_LOCAL_ENTERING = FadeIn
  .duration(150)
  .easing(Easing.out(Easing.cubic))
  .reduceMotion(ReduceMotion.System);
const STATS_LOCAL_EXITING = FadeOut
  .duration(120)
  .easing(Easing.in(Easing.cubic))
  .reduceMotion(ReduceMotion.System);

export function StatsScreen({
  accountBalances,
  snapshot,
  defaultSelectedAccountIds,
  onOpenTransaction,
  onOpenStatsDrilldown,
  showHeader = true,
}: StatsScreenProps) {
  const insets = useSafeAreaInsets();
  const [activeSection, setActiveSection] = useState<StatsSection>('breakdown');
  const activeSectionRef = useRef<StatsSection>('breakdown');
  const [accountMode, setAccountMode] = useState<CompactAccountSelectorMode>('peek');
  const accountModeRef = useRef<CompactAccountSelectorMode>('peek');
  const headerTransitionUntilRef = useRef(0);
  const manualHeaderLockUntilRef = useRef(0);
  const lastScrollOffsetYRef = useRef(0);
  const scrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const scrollDeltaRef = useRef(0);
  const sectionOpacity = useSharedValue(1);
  const reportKindVisibility = useSharedValue(1);
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

  const handleSelectSection = useCallback((nextSection: StatsSection) => {
    const currentSection = activeSectionRef.current;
    if (currentSection === nextSection) {
      return;
    }

    const currentUsesReportKind = statsSectionUsesReportKind(currentSection);
    const nextUsesReportKind = statsSectionUsesReportKind(nextSection);
    const timing = {
      duration: STATS_SECTION_TRANSITION_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    };

    cancelAnimation(sectionOpacity);
    sectionOpacity.value = 0.86;
    sectionOpacity.value = withTiming(1, timing);

    if (currentUsesReportKind !== nextUsesReportKind) {
      cancelAnimation(reportKindVisibility);
      reportKindVisibility.value = withTiming(nextUsesReportKind ? 1 : 0, {
        duration: STATS_REPORT_KIND_REVEAL_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      });
    }

    activeSectionRef.current = nextSection;
    setActiveSection(nextSection);
  }, [reportKindVisibility, sectionOpacity]);

  const sectionTransitionStyle = useAnimatedStyle(() => ({
    opacity: sectionOpacity.value,
  }));

  const reportKindVisible = statsSectionUsesReportKind(activeSection);

  return (
    <View style={styles.screen}>
      <View style={styles.fixedFilter}>
        {showHeader ? (
          <SectionHeader
            title="Statistics"
            detail="Review spending and cash flow by period and account."
          />
        ) : null}

        <StatsSectionSelector
          onSelectSection={handleSelectSection}
          selectedSection={activeSection}
        />

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

        <StatsReportKindReveal
          onSelectReportKind={viewModel.selectStatsReportKind}
          progress={reportKindVisibility}
          selectedReportKind={viewModel.statsReportKind}
          visible={reportKindVisible}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: viewModel.bottomPadding }]}
        keyboardShouldPersistTaps="handled"
        onScroll={handleStatsScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          layout={STATS_SECTION_LAYOUT_TRANSITION}
          style={[styles.sectionTransition, sectionTransitionStyle]}
          testID="stats-section-transition"
        >
          <StatsSectionContent
            activeSection={activeSection}
            onOpenStatsDrilldown={onOpenStatsDrilldown}
            onOpenTransaction={onOpenTransaction}
            viewModel={viewModel}
          />
        </Animated.View>
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

type StatsViewModel = ReturnType<typeof useStatsViewModel>;

function StatsReportKindReveal({
  onSelectReportKind,
  progress,
  selectedReportKind,
  visible,
}: {
  onSelectReportKind: StatsViewModel['selectStatsReportKind'];
  progress: SharedValue<number>;
  selectedReportKind: StatsViewModel['statsReportKind'];
  visible: boolean;
}) {
  const measuredHeight = useSharedValue(STATS_REPORT_KIND_REVEAL_HEIGHT);
  const animatedStyle = useAnimatedStyle(() => ({
    height: measuredHeight.value * progress.value,
    marginTop: -spacing.sm * (1 - progress.value),
    opacity: progress.value,
    transform: [{ translateY: -4 * (1 - progress.value) }],
  }));

  return (
    <Animated.View
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.reportKindReveal, animatedStyle]}
    >
      {visible ? (
        <Animated.View
          entering={STATS_LOCAL_ENTERING}
          exiting={STATS_LOCAL_EXITING}
          onLayout={(event) => {
            measuredHeight.value = event.nativeEvent.layout.height;
          }}
        >
          <StatsReportKindSwitch
            onSelectReportKind={onSelectReportKind}
            selectedReportKind={selectedReportKind}
          />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function StatsSectionContent({
  activeSection,
  onOpenStatsDrilldown,
  onOpenTransaction,
  viewModel,
}: {
  activeSection: StatsSection;
  onOpenStatsDrilldown?: StatsScreenProps['onOpenStatsDrilldown'];
  onOpenTransaction?: StatsScreenProps['onOpenTransaction'];
  viewModel: StatsViewModel;
}) {
  switch (activeSection) {
    case 'breakdown':
      return (
        <Animated.View
          layout={STATS_SECTION_LAYOUT_TRANSITION}
          style={styles.sectionContent}
          testID="stats-section-content-breakdown"
        >
          <StatsSpendingCard
            currencyCode={viewModel.currencyCode}
            onOpenDetailedView={viewModel.openSpendingDetailedView}
            onOpenDrilldown={onOpenStatsDrilldown ? viewModel.openSpendingDrilldown : undefined}
            onOpenTransaction={onOpenTransaction}
            onReturnToCategories={viewModel.returnToSpendingCategories}
            onSelectRollup={viewModel.selectSpendingRollup}
            spendingDonut={viewModel.spendingDonut}
            spendingDonutMode={viewModel.spendingDonutMode}
            statsReportKind={viewModel.statsReportKind}
          />
          {viewModel.selectedSpendingTrend.rollup ? (
            <Animated.View
              entering={STATS_LOCAL_ENTERING}
              exiting={STATS_LOCAL_EXITING}
              layout={STATS_SECTION_LAYOUT_TRANSITION}
            >
              <SelectedSpendingTrendCard
                currencyCode={viewModel.currencyCode}
                reportKind={viewModel.statsReportKind}
                selectedSpendingTrend={viewModel.selectedSpendingTrend}
              />
            </Animated.View>
          ) : null}
        </Animated.View>
      );
    case 'balance':
      return (
        <View style={styles.sectionContent} testID="stats-section-content-balance">
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
        </View>
      );
    case 'changes':
      return (
        <View style={styles.sectionContent} testID="stats-section-content-changes">
          <StatsCategoryChangesCard
            currencyCode={viewModel.currencyCode}
            onOpenCategory={onOpenStatsDrilldown ? viewModel.openCategoryChangeDrilldown : undefined}
            reportKind={viewModel.statsReportKind}
            rows={viewModel.categoryChanges}
          />
        </View>
      );
    case 'cashFlow':
      return (
        <View style={styles.sectionContent} testID="stats-section-content-cashFlow">
          <StatsMonthlyCashFlowChartCard
            currencyCode={viewModel.currencyCode}
            monthlyTrendSummary={viewModel.monthlyTrendSummary}
            onSelectMonth={viewModel.selectMonthlyCashFlowMonth}
            selectedMonthKey={viewModel.selectedMonthlyCashFlowMonthKey}
          />
          <StatsCashFlowWaterfallCard
            model={viewModel.cashFlowWaterfall}
            onOpenStep={onOpenStatsDrilldown ? viewModel.openCashFlowWaterfallStep : undefined}
          />
        </View>
      );
    case 'amounts':
      return (
        <View style={styles.sectionContent} testID="stats-section-content-amounts">
          <StatsTransactionAmountDistributionCard
            distribution={viewModel.transactionAmountDistribution}
          />
        </View>
      );
  }
}

function statsSectionUsesReportKind(section: StatsSection): boolean {
  return section === 'breakdown' || section === 'changes' || section === 'amounts';
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
