import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Platform } from 'react-native';

import {
  compareTransactionDisplayEntriesDescending,
  getBalanceAfterDisplayEntriesForEntries,
  getTransactionDisplayEntries,
} from '../../domain/aggregates';
import { getInitialSelectedAccountIds, getSelectableAccounts, getSelectableAccountIds } from '../../domain/accountSelection';
import { defaultCategories } from '../../domain/categories';
import { getDateRangeForPreset, getInclusiveDateRange, isWithinDateRange, toDateInputValue } from '../../domain/dates';
import {
  filterTransactionDisplayEntriesBySearch,
  groupTransactionDisplayEntries,
  type TransactionDisplayGroup,
} from '../../domain/transactionList';
import { getTransactionGroupGranularity } from '../../domain/transactionGrouping';
import type { AppSnapshot } from '../../domain/types';
import { timeDevPerf } from '../../performance';
import type { PeriodCarouselOption, PeriodOption } from './PeriodCarousel';

type RangeMode = 'preset' | 'custom';

type CachedTransactionsListDerivation = {
  accounts: AppSnapshot['accounts'];
  balanceAfterByEntryId: Record<string, number>;
  cacheKey: string;
  categories: AppSnapshot['categories'];
  groups: TransactionDisplayGroup[];
  transactionLines: AppSnapshot['transactionLines'];
  transactionLinks: AppSnapshot['transactionLinks'];
  transactions: AppSnapshot['transactions'];
};

let cachedTransactionsListDerivation: CachedTransactionsListDerivation | null = null;

const ACCOUNT_FILTER_APPLY_DELAY_MS = 80;
const SEARCH_FILTER_APPLY_DELAY_MS = 180;

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
  deferListDerivation = false,
  defaultSelectedAccountIds,
  onPeriodStateChange,
  periodState,
  snapshot,
}: {
  bottomInset: number;
  deferListDerivation?: boolean;
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
  const [appliedSelectedAccountIds, setAppliedSelectedAccountIds] = useState(initialSelectedAccountIds);
  const [hasLocalAccountOverride, setHasLocalAccountOverride] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const filterApplyTokenRef = useRef(0);
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
  const cacheKey = getTransactionsListCacheKey({
    endIso: range.endIso,
    searchQuery: appliedSearchQuery,
    selectedAccountIds: appliedSelectedAccountIds,
    startIso: range.startIso,
  });
  const cachedListDerivation = useMemo(
    () =>
      deferListDerivation
        ? getCachedTransactionsListDerivation({
          accounts: snapshot.accounts,
          cacheKey,
          categories,
          transactionLines: snapshot.transactionLines,
          transactionLinks: snapshot.transactionLinks,
          transactions: snapshot.transactions,
        })
        : null,
    [
      cacheKey,
      categories,
      deferListDerivation,
      snapshot.accounts,
      snapshot.transactionLines,
      snapshot.transactionLinks,
      snapshot.transactions,
    ],
  );
  const displayEntries = useMemo(() => {
    return timeDevPerf(
      'transactionsViewModel.entries',
      () => {
        if (deferListDerivation) {
          return [];
        }

        return deriveTransactionDisplayEntries({
          accountIds: appliedSelectedAccountIds,
          range,
          snapshot,
        });
      },
      (entries) => ({
        selectedAccounts: appliedSelectedAccountIds.length,
        transactions: snapshot.transactions.length,
        visibleTransactions: new Set(entries.map((entry) => entry.transaction.id)).size,
        lines: snapshot.transactionLines.length,
        links: snapshot.transactionLinks.length,
        entries: entries.length,
      }),
    );
  }, [
    deferListDerivation,
    range,
    appliedSelectedAccountIds,
    snapshot.transactionLines,
    snapshot.transactionLinks,
    snapshot.transactions,
  ]);
  const visibleEntries = useMemo(() => {
    return timeDevPerf(
      'transactionsViewModel.filterSearch',
      () => {
        return deriveVisibleTransactionEntries({
          entries: displayEntries,
          categories,
          searchQuery: appliedSearchQuery,
          snapshot,
        });
      },
      (entries) => ({
        accounts: snapshot.accounts.length,
        entries: displayEntries.length,
        searchedEntries: entries.length,
      }),
    );
  }, [
    categories,
    displayEntries,
    appliedSearchQuery,
    snapshot.accounts,
  ]);
  const balanceAfterByEntryId = useMemo(
    () =>
      timeDevPerf(
        'transactionsViewModel.balanceAfter',
        () =>
          deriveBalanceAfterByEntryId({
            entries: visibleEntries,
            snapshot,
          }),
        {
          accounts: snapshot.accounts.length,
          transactions: snapshot.transactions.length,
          lines: snapshot.transactionLines.length,
          entries: visibleEntries.length,
        },
      ),
    [snapshot.accounts, snapshot.transactionLines, snapshot.transactions, visibleEntries],
  );
  const groups = useMemo(() => {
    return timeDevPerf(
      'transactionsViewModel.groups',
      () => groupTransactionDisplayEntries(visibleEntries, getTransactionGroupGranularity(range)),
      (nextGroups) => ({
        entries: visibleEntries.length,
        groups: nextGroups.length,
      }),
    );
  }, [
    range,
    visibleEntries,
  ]);
  useEffect(() => {
    if (deferListDerivation) {
      return;
    }

    setCachedTransactionsListDerivation({
      accounts: snapshot.accounts,
      balanceAfterByEntryId,
      cacheKey,
      categories,
      groups,
      transactionLines: snapshot.transactionLines,
      transactionLinks: snapshot.transactionLinks,
      transactions: snapshot.transactions,
    });
  }, [
    balanceAfterByEntryId,
    cacheKey,
    categories,
    deferListDerivation,
    groups,
    snapshot.accounts,
    snapshot.transactionLines,
    snapshot.transactionLinks,
    snapshot.transactions,
  ]);
  const renderedBalanceAfterByEntryId = cachedListDerivation?.balanceAfterByEntryId ?? balanceAfterByEntryId;
  const renderedGroups = cachedListDerivation?.groups ?? groups;
  const selectedPeriodOption: PeriodCarouselOption = rangeMode === 'custom' ? 'custom' : preset;
  const bottomPadding = (rangeMode === 'custom' ? 220 : 140) + bottomInset;
  const emptyMessage = appliedSelectedAccountIds.length
    ? appliedSearchQuery.trim()
      ? 'No transactions match this search.'
      : 'No transactions in this period.'
    : 'No accounts selected.';

  useEffect(() => {
    if (
      areAccountIdListsEqual(appliedSelectedAccountIds, selectedAccountIds) &&
      appliedSearchQuery === searchQuery
    ) {
      return;
    }

    let interactionTask: { cancel?: () => void } | null = null;
    const applyToken = filterApplyTokenRef.current + 1;
    filterApplyTokenRef.current = applyToken;
    const delayMs = appliedSearchQuery === searchQuery ? ACCOUNT_FILTER_APPLY_DELAY_MS : SEARCH_FILTER_APPLY_DELAY_MS;
    const timeoutId = setTimeout(() => {
      interactionTask = InteractionManager.runAfterInteractions(() => {
        if (filterApplyTokenRef.current !== applyToken) {
          return;
        }

        setAppliedSelectedAccountIds((currentIds) =>
          areAccountIdListsEqual(currentIds, selectedAccountIds) ? currentIds : selectedAccountIds,
        );
        setAppliedSearchQuery((currentQuery) => (currentQuery === searchQuery ? currentQuery : searchQuery));
      });
    }, delayMs);

    return () => {
      filterApplyTokenRef.current += 1;
      clearTimeout(timeoutId);
      interactionTask?.cancel?.();
    };
  }, [
    appliedSearchQuery,
    appliedSelectedAccountIds,
    searchQuery,
    selectedAccountIds,
  ]);

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
    balanceAfterByEntryId: renderedBalanceAfterByEntryId,
    bottomPadding,
    categories,
    customEndDate,
    customStartDate,
    datePickerTarget,
    emptyMessage,
    groups: renderedGroups,
    handleDatePickerChange,
    isListDeferred: deferListDerivation && !cachedListDerivation,
    listSelectedAccountIds: appliedSelectedAccountIds,
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

function deriveTransactionDisplayEntries({
  accountIds,
  range,
  snapshot,
}: {
  accountIds: string[];
  range: ReturnType<typeof getDateRangeForPreset>;
  snapshot: AppSnapshot;
}) {
  const transactionsInRange = snapshot.transactions.filter((transaction) =>
    isWithinDateRange(transaction.datetime, range));
  return getTransactionDisplayEntries({
    transactions: transactionsInRange,
    lines: snapshot.transactionLines,
    transactionLinks: snapshot.transactionLinks,
    accountIds,
  });
}

function deriveVisibleTransactionEntries({
  categories,
  entries,
  searchQuery,
  snapshot,
}: {
  categories: AppSnapshot['categories'];
  entries: ReturnType<typeof getTransactionDisplayEntries>;
  searchQuery: string;
  snapshot: AppSnapshot;
}) {
  const searchedEntries = filterTransactionDisplayEntriesBySearch({
    entries,
    query: searchQuery,
    accounts: snapshot.accounts,
    categories,
  });
  return [...searchedEntries].sort(compareTransactionDisplayEntriesDescending);
}

function deriveBalanceAfterByEntryId({
  entries,
  snapshot,
}: {
  entries: ReturnType<typeof getTransactionDisplayEntries>;
  snapshot: AppSnapshot;
}) {
  return getBalanceAfterDisplayEntriesForEntries({
    accounts: snapshot.accounts,
    transactions: snapshot.transactions,
    lines: snapshot.transactionLines,
    entries,
  });
}

function getTransactionsListCacheKey({
  endIso,
  searchQuery,
  selectedAccountIds,
  startIso,
}: {
  endIso: string;
  searchQuery: string;
  selectedAccountIds: string[];
  startIso: string;
}): string {
  return [
    startIso,
    endIso,
    selectedAccountIds.join('\u001f'),
    searchQuery,
  ].join('\u001e');
}

function getCachedTransactionsListDerivation({
  accounts,
  cacheKey,
  categories,
  transactionLines,
  transactionLinks,
  transactions,
}: {
  accounts: AppSnapshot['accounts'];
  cacheKey: string;
  categories: AppSnapshot['categories'];
  transactionLines: AppSnapshot['transactionLines'];
  transactionLinks: AppSnapshot['transactionLinks'];
  transactions: AppSnapshot['transactions'];
}): CachedTransactionsListDerivation | null {
  if (
    cachedTransactionsListDerivation?.accounts !== accounts ||
    cachedTransactionsListDerivation.cacheKey !== cacheKey ||
    cachedTransactionsListDerivation.categories !== categories ||
    cachedTransactionsListDerivation.transactionLines !== transactionLines ||
    cachedTransactionsListDerivation.transactionLinks !== transactionLinks ||
    cachedTransactionsListDerivation.transactions !== transactions
  ) {
    return null;
  }

  return cachedTransactionsListDerivation;
}

function setCachedTransactionsListDerivation(nextCache: CachedTransactionsListDerivation): void {
  cachedTransactionsListDerivation = nextCache;
}
