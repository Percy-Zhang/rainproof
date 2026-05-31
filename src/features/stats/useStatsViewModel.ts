import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { getCashFlowSummary } from '../../domain/aggregates';
import { defaultCategories } from '../../domain/categories';
import { getCurrenciesInUse, getEffectiveDisplayCurrency } from '../../domain/currency';
import { getDateRangeForPreset, getInclusiveDateRange, toDateInputValue } from '../../domain/dates';
import { getStatsDonutViewModel, type StatsDonutMode } from '../../domain/statsChart';
import { getStatsReport } from '../../domain/statsReports';
import {
  getStatsMonthlyTrendSummary,
  getStatsRollupMonthlyTrend,
} from '../../domain/statsTrends';
import type { AppSnapshot } from '../../domain/types';
import type { RootStackParamList } from '../../navigation/routes';
import type { PeriodCarouselOption, PeriodOption } from '../transactions/PeriodCarousel';

export type StatsRangeMode = 'preset' | 'custom';
export type StatsDatePickerTarget = 'start' | 'end';

export function useStatsViewModel({
  bottomInset,
  onOpenStatsDrilldown,
  snapshot,
}: {
  bottomInset: number;
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
  const [currencyCode, setCurrencyCode] = useState(effectiveDisplayCurrency);
  const [accountId, setAccountId] = useState('all');
  const [spendingDonutMode, setSpendingDonutMode] = useState<StatsDonutMode>('category');
  const [selectedSpendingCategoryRollupId, setSelectedSpendingCategoryRollupId] = useState('');
  const [selectedSpendingSubcategoryRollupId, setSelectedSpendingSubcategoryRollupId] = useState('');
  const showCurrencyCodes = snapshot.settings.multiCurrencyEnabled;
  const categories = snapshot.categories ?? defaultCategories;
  const selectedPeriodOption: PeriodCarouselOption = rangeMode === 'custom' ? 'custom' : preset;

  const currencies = useMemo(
    () =>
      getCurrenciesInUse([
        effectiveDisplayCurrency,
        ...snapshot.accounts.map((account) => account.currencyCode),
        ...snapshot.budgets.map((budget) => budget.currencyCode),
      ]),
    [effectiveDisplayCurrency, snapshot.accounts, snapshot.budgets],
  );

  useEffect(() => {
    const canKeepCurrency =
      currencies.includes(currencyCode) && (showCurrencyCodes || currencyCode === effectiveDisplayCurrency);
    if (!canKeepCurrency) {
      setCurrencyCode(effectiveDisplayCurrency);
      setAccountId('all');
    }
  }, [currencies, currencyCode, effectiveDisplayCurrency, showCurrencyCodes]);

  const accountsForCurrency = useMemo(
    () => snapshot.accounts.filter((account) => account.currencyCode === currencyCode),
    [currencyCode, snapshot.accounts],
  );
  const effectiveAccountId = accountsForCurrency.some((account) => account.id === accountId) ? accountId : 'all';
  const range = useMemo(
    () =>
      rangeMode === 'custom'
        ? getInclusiveDateRange(customStartDate, customEndDate)
        : getDateRangeForPreset(preset),
    [customEndDate, customStartDate, preset, rangeMode],
  );
  const accountIds = useMemo(
    () => (effectiveAccountId === 'all' ? undefined : [effectiveAccountId]),
    [effectiveAccountId],
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
  const monthlyTrendSummary = useMemo(() => getStatsMonthlyTrendSummary({
    incomeReport,
    expenseReport: spendingReport,
    range,
  }), [incomeReport, range, spendingReport]);
  const spendingDonut = useMemo(() => getStatsDonutViewModel({
    report: spendingReport,
    mode: spendingDonutMode,
    selectedCategoryRollupId: selectedSpendingCategoryRollupId,
    selectedSubcategoryRollupId: selectedSpendingSubcategoryRollupId,
    recentLimit: 5,
  }), [
    selectedSpendingCategoryRollupId,
    selectedSpendingSubcategoryRollupId,
    spendingDonutMode,
    spendingReport,
  ]);
  const selectedSpendingRollup = spendingDonut.selectedRollup;
  const selectedSpendingTrend = useMemo(() => getStatsRollupMonthlyTrend({
    report: spendingReport,
    rollupKind: spendingDonutMode,
    rollupId: selectedSpendingRollup?.id,
    range,
  }), [range, selectedSpendingRollup?.id, spendingDonutMode, spendingReport]);
  const cashFlow = useMemo(() => getCashFlowSummary({
    transactions: snapshot.transactions,
    lines: snapshot.transactionLines,
    transactionLinks: snapshot.transactionLinks,
    range,
    currencyCode,
    accountIds,
  }), [
    accountIds,
    currencyCode,
    range,
    snapshot.transactionLines,
    snapshot.transactionLinks,
    snapshot.transactions,
  ]);
  const bottomPadding = (showCurrencyCodes ? 330 : rangeMode === 'custom' ? 280 : 230) + bottomInset;

  function selectPeriodOption(option: PeriodCarouselOption) {
    if (option === 'custom') {
      setRangeMode('custom');
    } else {
      setPreset(option);
      setRangeMode('preset');
    }
  }

  function changeCurrency(nextCurrencyCode: string) {
    setCurrencyCode(nextCurrencyCode);
    setAccountId('all');
  }

  function selectSpendingRollup(rollupId: string) {
    if (spendingDonutMode === 'subcategory') {
      setSelectedSpendingSubcategoryRollupId(rollupId);
      return;
    }

    setSelectedSpendingCategoryRollupId(rollupId);
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

    onOpenStatsDrilldown({
      reportKind: 'expense',
      categoryId: selectedSpendingRollup.categoryId,
      subcategoryId: spendingDonutMode === 'subcategory' ? selectedSpendingRollup.subcategoryId : undefined,
      startIso: range.startIso,
      endIso: range.endIso,
      accountIds,
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

  return {
    accountIds,
    accountsForCurrency,
    bottomPadding,
    cashFlow,
    categories,
    changeCurrency,
    currencies,
    currencyCode,
    customEndDate,
    customStartDate,
    datePickerTarget,
    effectiveAccountId,
    handleDatePickerChange,
    monthlyTrendSummary,
    openSpendingDetailedView,
    openSpendingDrilldown,
    rangeMode,
    returnToSpendingCategories,
    selectedPeriodOption,
    selectedSpendingRollup,
    selectedSpendingTrend,
    selectPeriodOption,
    selectSpendingRollup,
    setAccountId,
    setDatePickerTarget,
    showCurrencyCodes,
    spendingDonut,
    spendingDonutMode,
  };
}
