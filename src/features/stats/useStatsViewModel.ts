import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { getCashFlowSummary } from '../../domain/aggregates';
import { getSelectableAccounts, getSelectableAccountIds } from '../../domain/accountSelection';
import { defaultCategories } from '../../domain/categories';
import { getEffectiveDisplayCurrency } from '../../domain/currency';
import { getDateRangeForPreset, getInclusiveDateRange, toDateInputValue } from '../../domain/dates';
import {
  getStatsInitialSelectedAccountIds,
  getStatsSelectedAccountIdsForCurrency,
  getStatsSelectedCurrencyCodes,
  resolveStatsCurrencyScope,
} from '../../domain/statsAccountSelection';
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
  const [spendingDonutMode, setSpendingDonutMode] = useState<StatsDonutMode>('category');
  const [selectedSpendingCategoryRollupId, setSelectedSpendingCategoryRollupId] = useState('');
  const [selectedSpendingSubcategoryRollupId, setSelectedSpendingSubcategoryRollupId] = useState('');
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
  const cashFlow = useMemo(() => {
    if (!accountIds.length) {
      return {
        currencyCode,
        incomeMinor: 0,
        expenseMinor: 0,
        netMinor: 0,
      };
    }

    return getCashFlowSummary({
      transactions: snapshot.transactions,
      lines: snapshot.transactionLines,
      transactionLinks: snapshot.transactionLinks,
      range,
      currencyCode,
      accountIds,
    });
  }, [
    accountIds,
    currencyCode,
    range,
    snapshot.transactionLines,
    snapshot.transactionLinks,
    snapshot.transactions,
  ]);
  const bottomPadding = (rangeMode === 'custom' ? 220 : 140) + bottomInset;

  function selectPeriodOption(option: PeriodCarouselOption) {
    if (option === 'custom') {
      setRangeMode('custom');
    } else {
      setPreset(option);
      setRangeMode('preset');
    }
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
    bottomPadding,
    cashFlow,
    categories,
    clearSelectedAccounts,
    currencyCode,
    customEndDate,
    customStartDate,
    datePickerTarget,
    handleDatePickerChange,
    monthlyTrendSummary,
    openSpendingDetailedView,
    openSpendingDrilldown,
    rangeMode,
    returnToSpendingCategories,
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
    toggleAccount,
  };
}

function areAccountIdListsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((accountId, index) => accountId === right[index]);
}
