import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import {
  compareTransactionDisplayEntriesDescending,
  getBalanceAfterDisplayEntries,
  getTransactionDisplayEntries,
} from '../../domain/aggregates';
import { getInitialSelectedAccountIds, getSelectableAccounts, getSelectableAccountIds } from '../../domain/accountSelection';
import { defaultCategories } from '../../domain/categories';
import { getDateRangeForPreset, getInclusiveDateRange, isWithinDateRange, toDateInputValue } from '../../domain/dates';
import {
  filterTransactionDisplayEntriesBySearch,
  groupTransactionDisplayEntries,
} from '../../domain/transactionList';
import { getTransactionGroupGranularity } from '../../domain/transactionGrouping';
import type { AppSnapshot } from '../../domain/types';
import type { PeriodCarouselOption, PeriodOption } from './PeriodCarousel';

type RangeMode = 'preset' | 'custom';

export type TransactionDatePickerTarget = 'start' | 'end';

export type TransactionPeriodState = {
  customEndDate: string;
  customStartDate: string;
  preset: PeriodOption;
  rangeMode: RangeMode;
};

export function createDefaultTransactionPeriodState(): TransactionPeriodState {
  return {
    customEndDate: toDateInputValue(new Date()),
    customStartDate: toDateInputValue(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
    preset: 'last_month',
    rangeMode: 'preset',
  };
}

export function useTransactionsViewModel({
  bottomInset,
  defaultSelectedAccountIds,
  onPeriodStateChange,
  periodState,
  snapshot,
}: {
  bottomInset: number;
  defaultSelectedAccountIds?: string[];
  onPeriodStateChange: (periodState: TransactionPeriodState) => void;
  periodState: TransactionPeriodState;
  snapshot: AppSnapshot;
}) {
  const [datePickerTarget, setDatePickerTarget] = useState<TransactionDatePickerTarget | null>(null);
  const initialSelectedAccountIds = useMemo(
    () => getTransactionsInitialSelectedAccountIds(snapshot.accounts, defaultSelectedAccountIds),
    [defaultSelectedAccountIds, snapshot.accounts],
  );
  const selectableAccounts = useMemo(() => getSelectableAccounts(snapshot.accounts), [snapshot.accounts]);
  const [selectedAccountIds, setSelectedAccountIds] = useState(initialSelectedAccountIds);
  const [hasLocalAccountOverride, setHasLocalAccountOverride] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { customEndDate, customStartDate, preset, rangeMode } = periodState;
  const showCurrencyCodes = snapshot.settings.multiCurrencyEnabled;
  const categories = snapshot.categories ?? defaultCategories;
  const range = useMemo(
    () =>
      rangeMode === 'custom'
        ? getInclusiveDateRange(customStartDate, customEndDate)
        : getDateRangeForPreset(preset),
    [customEndDate, customStartDate, preset, rangeMode],
  );
  const balanceAfterByEntryId = useMemo(
    () =>
      getBalanceAfterDisplayEntries({
        accounts: snapshot.accounts,
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
      }),
    [snapshot.accounts, snapshot.transactionLines, snapshot.transactions],
  );
  const groups = useMemo(() => {
    const entries = getTransactionDisplayEntries({
      transactions: snapshot.transactions,
      lines: snapshot.transactionLines,
      accountIds: selectedAccountIds,
    })
      .filter((entry) => isWithinDateRange(entry.transaction.datetime, range));
    const searchedEntries = filterTransactionDisplayEntriesBySearch({
      entries,
      query: searchQuery,
      accounts: snapshot.accounts,
      categories,
    }).sort(compareTransactionDisplayEntriesDescending);

    return groupTransactionDisplayEntries(searchedEntries, getTransactionGroupGranularity(range));
  }, [
    categories,
    range,
    searchQuery,
    selectedAccountIds,
    snapshot.accounts,
    snapshot.transactionLines,
    snapshot.transactions,
  ]);
  const selectedPeriodOption: PeriodCarouselOption = rangeMode === 'custom' ? 'custom' : preset;
  const bottomPadding = (rangeMode === 'custom' ? 220 : 140) + bottomInset;
  const emptyMessage = selectedAccountIds.length
    ? searchQuery.trim()
      ? 'No transactions match this search.'
      : 'No transactions in this period.'
    : 'No accounts selected.';

  useEffect(() => {
    if (hasLocalAccountOverride) {
      return;
    }

    setSelectedAccountIds((currentIds) =>
      areAccountIdListsEqual(currentIds, initialSelectedAccountIds) ? currentIds : initialSelectedAccountIds,
    );
  }, [hasLocalAccountOverride, initialSelectedAccountIds]);

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

  function handleDatePickerChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (event.type === 'dismissed') {
      setDatePickerTarget(null);
      return;
    }

    if (!selectedDate || !datePickerTarget) {
      return;
    }

    const nextValue = toDateInputValue(selectedDate);
    if (datePickerTarget === 'start') {
      updatePeriodState({ customStartDate: nextValue });
    } else {
      updatePeriodState({ customEndDate: nextValue });
    }

    if (Platform.OS === 'android') {
      setDatePickerTarget(null);
    }
  }

  function selectPeriodOption(option: PeriodCarouselOption) {
    if (option === 'custom') {
      updatePeriodState({ rangeMode: 'custom' });
    } else {
      updatePeriodState({ preset: option, rangeMode: 'preset' });
    }
  }

  function updatePeriodState(nextState: Partial<TransactionPeriodState>) {
    onPeriodStateChange({
      ...periodState,
      ...nextState,
    });
  }

  return {
    balanceAfterByEntryId,
    bottomPadding,
    categories,
    customEndDate,
    customStartDate,
    datePickerTarget,
    emptyMessage,
    groups,
    handleDatePickerChange,
    rangeMode,
    searchQuery,
    selectedAccountIds,
    selectedPeriodOption,
    selectableAccounts,
    setDatePickerTarget,
    setSearchQuery,
    showCurrencyCodes,
    toggleAccount,
    selectAllAccounts,
    clearSelectedAccounts,
    selectPeriodOption,
  };
}

export function getTransactionsInitialSelectedAccountIds(
  accounts: AppSnapshot['accounts'],
  defaultSelectedAccountIds?: string[],
): string[] {
  return getInitialSelectedAccountIds(accounts, defaultSelectedAccountIds);
}

function areAccountIdListsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((accountId, index) => accountId === right[index]);
}
