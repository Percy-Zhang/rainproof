import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { getAccountBalances } from '../../domain/aggregates';
import { getSelectableAccounts, getSelectableAccountIds } from '../../domain/accountSelection';
import { getBalanceHistoryPoints } from '../../domain/balanceHistory';
import { defaultCategories } from '../../domain/categories';
import { getEffectiveDisplayCurrency } from '../../domain/currency';
import {
  getDateRangeForPreset,
  getInclusiveDateRange,
  getPreviousEquivalentDateRange,
  toDateInputValue,
} from '../../domain/dates';
import { getForecastBalanceProjection } from '../../domain/forecastBalance';
import {
  getStatsInitialSelectedAccountIds,
  getStatsSelectedAccountIdsForCurrency,
  getStatsSelectedCurrencyCodes,
  resolveStatsCurrencyScope,
} from '../../domain/statsAccountSelection';
import {
  getNextStatsDonutSelectionId,
  getStatsDonutViewModel,
  type StatsDonutMode,
} from '../../domain/statsChart';
import { getStatsCategoryChanges } from '../../domain/statsCategoryChanges';
import {
  getStatsCashFlowWaterfall,
  type StatsCashFlowWaterfallStep,
} from '../../domain/statsCashFlowWaterfall';
import { getStatsReport, type StatsReportKind } from '../../domain/statsReports';
import { getStatsTransactionAmountDistribution } from '../../domain/statsTransactionAmountDistribution';
import {
  getStatsMonthlyTrendSummary,
  getStatsRollupMonthlyTrend,
} from '../../domain/statsTrends';
import { getUpcomingPaymentForecastOccurrences } from '../../domain/upcomingPaymentForecast';
import type { AppSnapshot } from '../../domain/types';
import type { RootStackParamList } from '../../navigation/routes';
import type { PeriodCarouselOption, PeriodOption } from '../transactions/PeriodCarousel';
import {
  getStatsBalanceHistoryDisplayPoints,
  getStatsBalanceHistoryForecastRange,
  type StatsBalanceHistoryMode,
} from './statsBalanceHistory';

export type StatsRangeMode = 'preset' | 'custom';
export type StatsDatePickerTarget = 'start' | 'end';

export function useStatsViewModel({
  bottomInset,
  defaultSelectedAccountIds,
  onOpenStatsDrilldown,
  snapshot,
}: {
  bottomInset: number;
  defaultSelectedAccountIds?: string[];
  onOpenStatsDrilldown?: (params: RootStackParamList['StatsDrilldown']) => void;
  snapshot: AppSnapshot;
}) {
  const [preset, setPreset] = useState<PeriodOption>('last_month');
  const [rangeMode, setRangeMode] = useState<StatsRangeMode>('preset');
  const [customStartDate, setCustomStartDate] = useState(() =>
    toDateInputValue(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
  );
  const [customEndDate, setCustomEndDate] = useState(() => toDateInputValue(new Date()));
  const [datePickerTarget, setDatePickerTarget] = useState<StatsDatePickerTarget | null>(null);
  const effectiveDisplayCurrency = useMemo(
    () =>
      getEffectiveDisplayCurrency({
        defaultCurrencyCode: snapshot.defaultCurrencyCode,
        defaultCurrencyMode: snapshot.settings.defaultCurrencyMode,
        accountCurrencyCodes: snapshot.accounts.map((account) => account.currencyCode),
      }),
    [snapshot.accounts, snapshot.defaultCurrencyCode, snapshot.settings.defaultCurrencyMode],
  );
  const initialSelectedAccountIds = useMemo(
    () => getStatsInitialSelectedAccountIds(snapshot.accounts, defaultSelectedAccountIds),
    [defaultSelectedAccountIds, snapshot.accounts],
  );
  const selectableAccounts = useMemo(() => getSelectableAccounts(snapshot.accounts), [snapshot.accounts]);
  const [selectedAccountIds, setSelectedAccountIds] = useState(initialSelectedAccountIds);
  const [hasLocalAccountOverride, setHasLocalAccountOverride] = useState(false);
  const [requestedCurrencyCode, setRequestedCurrencyCode] = useState(effectiveDisplayCurrency);
  const [statsReportKind, setStatsReportKind] = useState<StatsReportKind>('expense');
  const [spendingDonutMode, setSpendingDonutMode] = useState<StatsDonutMode>('category');
  const [selectedSpendingCategoryRollupId, setSelectedSpendingCategoryRollupId] = useState<string | null>('');
  const [selectedSpendingSubcategoryRollupId, setSelectedSpendingSubcategoryRollupId] = useState<string | null>('');
  const [balanceHistoryMode, setBalanceHistoryMode] = useState<StatsBalanceHistoryMode>('history');
  const [selectedBalanceHistoryPointId, setSelectedBalanceHistoryPointId] = useState('');
  const [selectedMonthlyCashFlowMonthKey, setSelectedMonthlyCashFlowMonthKey] = useState('');
  const statsNow = useMemo(() => new Date(), []);
  const categories = snapshot.categories ?? defaultCategories;
  const selectedPeriodOption: PeriodCarouselOption = rangeMode === 'custom' ? 'custom' : preset;

  useEffect(() => {
    if (hasLocalAccountOverride) {
      return;
    }

    setSelectedAccountIds((currentIds) =>
      areAccountIdListsEqual(currentIds, initialSelectedAccountIds) ? currentIds : initialSelectedAccountIds,
    );
  }, [hasLocalAccountOverride, initialSelectedAccountIds]);

  const availableCurrencyCodes = useMemo(
    () => getStatsSelectedCurrencyCodes(snapshot.accounts, selectedAccountIds),
    [selectedAccountIds, snapshot.accounts],
  );
  const currencyCode = useMemo(
    () =>
      resolveStatsCurrencyScope({
        fallbackCurrencyCode: effectiveDisplayCurrency,
        requestedCurrencyCode,
        selectedCurrencyCodes: availableCurrencyCodes,
      }),
    [availableCurrencyCodes, effectiveDisplayCurrency, requestedCurrencyCode],
  );

  useEffect(() => {
    if (requestedCurrencyCode !== currencyCode) {
      setRequestedCurrencyCode(currencyCode);
    }
  }, [currencyCode, requestedCurrencyCode]);

  const accountIds = useMemo(
    () =>
      getStatsSelectedAccountIdsForCurrency({
        accounts: snapshot.accounts,
        currencyCode,
        selectedAccountIds,
      }),
    [currencyCode, selectedAccountIds, snapshot.accounts],
  );
  const range = useMemo(
    () =>
      rangeMode === 'custom'
        ? getInclusiveDateRange(customStartDate, customEndDate)
        : getDateRangeForPreset(preset),
    [customEndDate, customStartDate, preset, rangeMode],
  );
  const spendingReport = useMemo(() => getStatsReport({
    reportKind: 'expense',
    transactions: snapshot.transactions,
    transactionLines: snapshot.transactionLines,
    transactionLinks: snapshot.transactionLinks,
    accounts: snapshot.accounts,
    categories,
    range,
    currencyCode,
    accountIds,
  }), [
    accountIds,
    categories,
    currencyCode,
    range,
    snapshot.accounts,
    snapshot.transactionLines,
    snapshot.transactionLinks,
    snapshot.transactions,
  ]);
  const incomeReport = useMemo(() => getStatsReport({
    reportKind: 'income',
    transactions: snapshot.transactions,
    transactionLines: snapshot.transactionLines,
    transactionLinks: snapshot.transactionLinks,
    accounts: snapshot.accounts,
    categories,
    range,
    currencyCode,
    accountIds,
  }), [
    accountIds,
    categories,
    currencyCode,
    range,
    snapshot.accounts,
    snapshot.transactionLines,
    snapshot.transactionLinks,
    snapshot.transactions,
  ]);
  const cashFlowWaterfall = useMemo(() => getStatsCashFlowWaterfall({
    accounts: snapshot.accounts,
    accountIds,
    currencyCode,
    expenseReport: spendingReport,
    incomeReport,
    range,
    transactionLines: snapshot.transactionLines,
    transactions: snapshot.transactions,
  }), [
    accountIds,
    currencyCode,
    incomeReport,
    range,
    snapshot.accounts,
    snapshot.transactionLines,
    snapshot.transactions,
    spendingReport,
  ]);
  const monthlyTrendSummary = useMemo(() => getStatsMonthlyTrendSummary({
    incomeReport,
    expenseReport: spendingReport,
    range,
  }), [incomeReport, range, spendingReport]);
  const selectedMonthlyCashFlowMonth = useMemo(
    () =>
      monthlyTrendSummary.buckets.find((bucket) => bucket.monthKey === selectedMonthlyCashFlowMonthKey) ??
      monthlyTrendSummary.buckets.at(-1),
    [monthlyTrendSummary.buckets, selectedMonthlyCashFlowMonthKey],
  );
  const activeStatsReport = statsReportKind === 'income' ? incomeReport : spendingReport;
  const transactionAmountDistribution = useMemo(
    () => getStatsTransactionAmountDistribution({
      accountIds,
      currencyCode,
      range,
      reportKind: statsReportKind,
      transactionLines: snapshot.transactionLines,
      transactions: snapshot.transactions,
    }),
    [
      accountIds,
      currencyCode,
      range,
      snapshot.transactionLines,
      snapshot.transactions,
      statsReportKind,
    ],
  );
  const previousRange = useMemo(() => getPreviousEquivalentDateRange(range), [range]);
  const previousStatsReport = useMemo(() => getStatsReport({
    reportKind: statsReportKind,
    transactions: snapshot.transactions,
    transactionLines: snapshot.transactionLines,
    transactionLinks: snapshot.transactionLinks,
    accounts: snapshot.accounts,
    categories,
    range: previousRange,
    currencyCode,
    accountIds,
  }), [
    accountIds,
    categories,
    currencyCode,
    previousRange,
    snapshot.accounts,
    snapshot.transactionLines,
    snapshot.transactionLinks,
    snapshot.transactions,
    statsReportKind,
  ]);
  const categoryChanges = useMemo(() => getStatsCategoryChanges({
    currentReport: activeStatsReport,
    previousReport: previousStatsReport,
  }), [activeStatsReport, previousStatsReport]);
  const spendingDonut = useMemo(() => getStatsDonutViewModel({
    report: activeStatsReport,
    mode: spendingDonutMode,
    selectedCategoryRollupId: selectedSpendingCategoryRollupId,
    selectedSubcategoryRollupId: selectedSpendingSubcategoryRollupId,
    recentLimit: 5,
  }), [
    activeStatsReport,
    selectedSpendingCategoryRollupId,
    selectedSpendingSubcategoryRollupId,
    spendingDonutMode,
  ]);
  const selectedSpendingRollup = spendingDonut.selectedRollup;
  const selectedSpendingTrend = useMemo(() => {
    if (!selectedSpendingRollup) {
      return {
        buckets: [],
        totalGrossAmountMinor: 0,
        totalNetAmountMinor: 0,
        averageNetAmountMinor: 0,
      };
    }

    return getStatsRollupMonthlyTrend({
      report: activeStatsReport,
      rollupKind: spendingDonutMode,
      rollupId: selectedSpendingRollup.id,
      range,
    });
  }, [activeStatsReport, range, selectedSpendingRollup, spendingDonutMode]);
  const balanceHistoryPoints = useMemo(() => getBalanceHistoryPoints({
    accounts: snapshot.accounts,
    transactions: snapshot.transactions,
    transactionLines: snapshot.transactionLines,
    accountIds,
    currencyCode,
    range,
    now: statsNow,
  }), [
    accountIds,
    currencyCode,
    range,
    snapshot.accounts,
    snapshot.transactionLines,
    snapshot.transactions,
    statsNow,
  ]);
  const currentSelectedBalanceMinor = useMemo(() => {
    const selectedAccountIdsForCurrency = new Set(accountIds);

    return getAccountBalances(snapshot.accounts, snapshot.transactionLines)
      .filter(
        ({ account }) =>
          selectedAccountIdsForCurrency.has(account.id) &&
          account.currencyCode === currencyCode,
      )
      .reduce((sum, accountBalance) => sum + accountBalance.balanceMinor, 0);
  }, [accountIds, currencyCode, snapshot.accounts, snapshot.transactionLines]);
  const balanceHistoryForecastRange = useMemo(
    () => getStatsBalanceHistoryForecastRange({ range, now: statsNow }),
    [range, statsNow],
  );
  const balanceHistoryForecastOccurrences = useMemo(() => getUpcomingPaymentForecastOccurrences({
    accountIds,
    accounts: snapshot.accounts,
    currencyCode,
    range: balanceHistoryForecastRange,
    recurringItems: snapshot.recurringItems,
  }), [
    accountIds,
    balanceHistoryForecastRange,
    currencyCode,
    snapshot.accounts,
    snapshot.recurringItems,
  ]);
  const balanceHistoryForecastProjection = useMemo(() => getForecastBalanceProjection({
    occurrences: balanceHistoryForecastOccurrences,
    range: balanceHistoryForecastRange,
    startingBalanceMinor: currentSelectedBalanceMinor,
  }), [
    balanceHistoryForecastOccurrences,
    balanceHistoryForecastRange,
    currentSelectedBalanceMinor,
  ]);
  const balanceHistoryDisplay = useMemo(() => getStatsBalanceHistoryDisplayPoints({
    currentBalanceMinor: currentSelectedBalanceMinor,
    forecastEvents: balanceHistoryForecastProjection.events,
    forecastPoints: balanceHistoryForecastProjection.points,
    historyPoints: balanceHistoryPoints,
    mode: balanceHistoryMode,
    now: statsNow,
  }), [
    balanceHistoryForecastProjection.events,
    balanceHistoryForecastProjection.points,
    balanceHistoryMode,
    balanceHistoryPoints,
    currentSelectedBalanceMinor,
    statsNow,
  ]);
  const selectedBalanceHistoryPoint = useMemo(
    () =>
      balanceHistoryDisplay.points.find((point) => point.id === selectedBalanceHistoryPointId) ??
      balanceHistoryDisplay.points.find((point) => point.id === balanceHistoryDisplay.defaultSelectedPointId) ??
      balanceHistoryDisplay.points.at(-1),
    [balanceHistoryDisplay.defaultSelectedPointId, balanceHistoryDisplay.points, selectedBalanceHistoryPointId],
  );
  const selectedBalanceHistoryIndex = selectedBalanceHistoryPoint
    ? balanceHistoryDisplay.points.findIndex((point) => point.id === selectedBalanceHistoryPoint.id)
    : -1;
  const selectedBalanceHistoryChangeMinor =
    selectedBalanceHistoryPoint?.kind === 'forecast'
      ? selectedBalanceHistoryPoint.event?.netChangeMinor ?? 0
      : selectedBalanceHistoryPoint?.kind === 'today'
        ? 0
        : selectedBalanceHistoryIndex > 0 && selectedBalanceHistoryPoint
          ? selectedBalanceHistoryPoint.balanceMinor -
            balanceHistoryDisplay.points[selectedBalanceHistoryIndex - 1].balanceMinor
          : 0;
  const balanceHistoryEmptyLabel = accountIds.length
    ? balanceHistoryMode === 'forecast'
      ? 'No forecast available for the selected accounts and currency.'
      : 'No balance history for the selected accounts and currency.'
    : `Select a ${currencyCode} account to see balance history.`;
  const bottomPadding = (rangeMode === 'custom' ? 220 : 140) + bottomInset;

  useEffect(() => {
    setSelectedBalanceHistoryPointId(balanceHistoryDisplay.defaultSelectedPointId);
  }, [balanceHistoryDisplay]);

  useEffect(() => {
    setSelectedMonthlyCashFlowMonthKey((currentMonthKey) =>
      monthlyTrendSummary.buckets.some((bucket) => bucket.monthKey === currentMonthKey)
        ? currentMonthKey
        : monthlyTrendSummary.buckets.at(-1)?.monthKey ?? '',
    );
  }, [monthlyTrendSummary.buckets]);

  function selectPeriodOption(option: PeriodCarouselOption) {
    if (option === 'custom') {
      setRangeMode('custom');
    } else {
      setPreset(option);
      setRangeMode('preset');
    }
  }

  function selectStatsReportKind(nextReportKind: StatsReportKind) {
    if (nextReportKind === statsReportKind) {
      return;
    }

    setStatsReportKind(nextReportKind);
    setSpendingDonutMode('category');
    setSelectedSpendingCategoryRollupId(null);
    setSelectedSpendingSubcategoryRollupId('');
  }

  function selectSpendingRollup(rollupId: string) {
    if (spendingDonutMode === 'subcategory') {
      setSelectedSpendingSubcategoryRollupId(
        getNextStatsDonutSelectionId(spendingDonut.selectedRollup?.id, rollupId),
      );
      return;
    }

    setSelectedSpendingCategoryRollupId(
      getNextStatsDonutSelectionId(spendingDonut.selectedRollup?.id, rollupId),
    );
  }

  function openSpendingDetailedView() {
    if (!spendingDonut.selectedCategoryRollup) {
      return;
    }

    setSelectedSpendingCategoryRollupId(spendingDonut.selectedCategoryRollup.id);
    setSelectedSpendingSubcategoryRollupId('');
    setSpendingDonutMode('subcategory');
  }

  function returnToSpendingCategories() {
    setSpendingDonutMode('category');
    setSelectedSpendingSubcategoryRollupId('');
  }

  function openSpendingDrilldown() {
    if (!selectedSpendingRollup || !onOpenStatsDrilldown) {
      return;
    }

    openStatsCategoryDrilldown(
      selectedSpendingRollup.categoryId,
      spendingDonutMode === 'subcategory' ? selectedSpendingRollup.subcategoryId : undefined,
    );
  }

  function openCategoryChangeDrilldown(categoryId: string) {
    openStatsCategoryDrilldown(categoryId);
  }

  function openCashFlowWaterfallStep(step: StatsCashFlowWaterfallStep) {
    if (!step.categoryId || !step.drilldownReportKind) {
      return;
    }

    openStatsCategoryDrilldown(step.categoryId, undefined, step.drilldownReportKind);
  }

  function openStatsCategoryDrilldown(
    categoryId: string,
    subcategoryId?: string,
    reportKind: StatsReportKind = statsReportKind,
  ) {
    onOpenStatsDrilldown?.({
      reportKind,
      categoryId,
      subcategoryId,
      startIso: range.startIso,
      endIso: range.endIso,
      accountIds: accountIds.length ? accountIds : [],
      currencyCode,
      initialSort: 'date_newest',
    });
  }

  function handleDatePickerChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (event.type === 'dismissed') {
      setDatePickerTarget(null);
      return;
    }

    if (!selectedDate || !datePickerTarget) {
      return;
    }

    const nextDate = toDateInputValue(selectedDate);
    if (datePickerTarget === 'start') {
      setCustomStartDate(nextDate);
    } else {
      setCustomEndDate(nextDate);
    }

    if (Platform.OS === 'android') {
      setDatePickerTarget(null);
    }
  }

  function selectAllAccounts() {
    setHasLocalAccountOverride(true);
    setSelectedAccountIds(getSelectableAccountIds(snapshot.accounts));
  }

  function clearSelectedAccounts() {
    setHasLocalAccountOverride(true);
    setSelectedAccountIds([]);
  }

  function toggleAccount(accountId: string) {
    setHasLocalAccountOverride(true);
    setSelectedAccountIds((currentIds) =>
      currentIds.includes(accountId)
        ? currentIds.filter((id) => id !== accountId)
        : [...currentIds, accountId],
    );
  }

  return {
    accountIds,
    availableCurrencyCodes,
    balanceHistoryEmptyLabel,
    balanceHistoryMode,
    balanceHistoryPoints: balanceHistoryDisplay.points,
    bottomPadding,
    cashFlowWaterfall,
    categoryChanges,
    categories,
    clearSelectedAccounts,
    currencyCode,
    customEndDate,
    customStartDate,
    datePickerTarget,
    handleDatePickerChange,
    monthlyTrendSummary,
    openCategoryChangeDrilldown,
    openCashFlowWaterfallStep,
    openSpendingDetailedView,
    openSpendingDrilldown,
    rangeMode,
    returnToSpendingCategories,
    selectBalanceHistoryMode: setBalanceHistoryMode,
    selectBalanceHistoryPoint: setSelectedBalanceHistoryPointId,
    selectMonthlyCashFlowMonth: setSelectedMonthlyCashFlowMonthKey,
    selectStatsReportKind,
    selectedBalanceHistoryChangeMinor,
    selectedBalanceHistoryPoint,
    selectedMonthlyCashFlowMonthKey: selectedMonthlyCashFlowMonth?.monthKey ?? null,
    selectedPeriodOption,
    selectedAccountIds,
    selectedSpendingRollup,
    selectedSpendingTrend,
    selectableAccounts,
    selectAllAccounts,
    selectCurrencyScope: setRequestedCurrencyCode,
    selectPeriodOption,
    selectSpendingRollup,
    setDatePickerTarget,
    spendingDonut,
    spendingDonutMode,
    statsReportKind,
    toggleAccount,
    transactionAmountDistribution,
  };
}

function areAccountIdListsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((accountId, index) => accountId === right[index]);
}
