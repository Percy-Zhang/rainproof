import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountFilterCarousel } from '../../components/AccountFilterCarousel';
import { BottomSelectorPanel } from '../../components/BottomSelectorPanel';
import { Card, SectionHeader } from '../../components/ui';
import {
  compareTransactionDisplayEntriesDescending,
  getBalanceAfterDisplayEntries,
  getTransactionDisplayEntries,
} from '../../domain/aggregates';
import { defaultCategories } from '../../domain/categories';
import { getDateRangeForPreset, getInclusiveDateRange, isWithinDateRange, toDateInputValue } from '../../domain/dates';
import {
  formatTransactionCurrencyTotals,
  getTransactionGroupCurrencyTotals,
  groupTransactionDisplayEntries,
  type TransactionDisplayGroup,
} from '../../domain/transactionList';
import {
  getTransactionGroupGranularity,
} from '../../domain/transactionGrouping';
import type { AppSnapshot } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import {
  PeriodCarousel,
  type PeriodCarouselOption,
  type PeriodOption,
} from './PeriodCarousel';
import { TransactionListItem } from './TransactionListItems';

type TransactionsScreenProps = {
  snapshot: AppSnapshot;
  periodState: TransactionPeriodState;
  onPeriodStateChange: (periodState: TransactionPeriodState) => void;
  onOpenTransaction: (transactionId: string) => void;
};

type RangeMode = 'preset' | 'custom';
type DatePickerTarget = 'start' | 'end';

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

export function TransactionsScreen({
  snapshot,
  periodState,
  onPeriodStateChange,
  onOpenTransaction,
}: TransactionsScreenProps) {
  const insets = useSafeAreaInsets();
  const [datePickerTarget, setDatePickerTarget] = useState<DatePickerTarget | null>(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState(() => snapshot.accounts.map((account) => account.id));
  const { customEndDate, customStartDate, preset, rangeMode } = periodState;
  const showCurrencyCodes = snapshot.settings.multiCurrencyEnabled;
  const categories = snapshot.categories ?? defaultCategories;
  const allAccountsSelected = selectedAccountIds.length === snapshot.accounts.length;
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
      .filter((entry) => isWithinDateRange(entry.transaction.datetime, range))
      .sort(compareTransactionDisplayEntriesDescending);

    return groupTransactionDisplayEntries(entries, getTransactionGroupGranularity(range));
  }, [range, selectedAccountIds, snapshot.transactionLines, snapshot.transactions]);
  const selectedPeriodOption: PeriodCarouselOption = rangeMode === 'custom' ? 'custom' : preset;
  const bottomPadding = (rangeMode === 'custom' ? 280 : 220) + insets.bottom;

  function toggleAllAccounts() {
    setSelectedAccountIds(allAccountsSelected ? [] : snapshot.accounts.map((account) => account.id));
  }

  function toggleAccount(accountId: string) {
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

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader title="Transactions" detail="Review transactions by period and account." />

        <Card testID="transaction-list-card">
          <Text style={styles.cardTitle}>Transactions</Text>

          {groups.length ? (
            <View style={styles.groups}>
              {groups.map((group) => (
                <View key={group.key} style={styles.group}>
                  <GroupBreak
                    group={group}
                    showCurrencyCodes={showCurrencyCodes}
                  />
                  <View style={styles.transactionRows}>
                    {group.entries.map((entry, index) => (
                      <TransactionListItem
                        key={entry.id}
                        entry={entry}
                        accounts={snapshot.accounts}
                        categories={categories}
                        balanceAfterMinor={balanceAfterByEntryId[entry.id] ?? 0}
                        contextAccountId={selectedAccountIds.length === 1 ? selectedAccountIds[0] : undefined}
                        firstInGroup={index === 0}
                        showCurrencyCodes={showCurrencyCodes}
                        onPress={() => onOpenTransaction(entry.transaction.id)}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>
              {selectedAccountIds.length ? 'No transactions in this period.' : 'No accounts selected.'}
            </Text>
          )}
        </Card>
      </ScrollView>

      <BottomSelectorPanel testID="transactions-bottom-controls">
        <View style={styles.controlBlock}>
          <Text style={styles.label}>Accounts</Text>
          <AccountFilterCarousel
            accounts={snapshot.accounts}
            allSelected={allAccountsSelected}
            selectedAccountIds={selectedAccountIds}
            showCurrencyCodes={showCurrencyCodes}
            onPressAccount={toggleAccount}
            onPressAll={toggleAllAccounts}
          />
        </View>

        {rangeMode === 'custom' ? (
          <View style={styles.customRangeRow}>
            <DateSelector label="From" value={customStartDate} onPress={() => setDatePickerTarget('start')} />
            <DateSelector label="To" value={customEndDate} onPress={() => setDatePickerTarget('end')} />
            {datePickerTarget ? (
              Platform.OS === 'android' ? (
                <DateTimePicker
                  value={new Date(`${datePickerTarget === 'start' ? customStartDate : customEndDate}T12:00:00`)}
                  mode="date"
                  display="calendar"
                  onChange={handleDatePickerChange}
                />
              ) : (
                <View style={styles.datePickerPanel}>
                  <DateTimePicker
                    value={new Date(`${datePickerTarget === 'start' ? customStartDate : customEndDate}T12:00:00`)}
                    mode="date"
                    display="compact"
                    onChange={handleDatePickerChange}
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setDatePickerTarget(null)}
                    style={({ pressed }) => [styles.datePickerDone, pressed && styles.pressed]}
                  >
                    <Text style={styles.datePickerDoneText}>Done</Text>
                  </Pressable>
                </View>
              )
            ) : null}
          </View>
        ) : null}

        <PeriodCarousel selectedOption={selectedPeriodOption} onSelectOption={selectPeriodOption} />
      </BottomSelectorPanel>
    </View>
  );
}

function DateSelector({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.dateSelector, pressed && styles.pressed]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.dateSelectorValue}>{value}</Text>
    </Pressable>
  );
}

function GroupBreak({
  group,
  showCurrencyCodes,
}: {
  group: TransactionDisplayGroup;
  showCurrencyCodes: boolean;
}) {
  const netTotals = getTransactionGroupCurrencyTotals(group.entries);

  return (
    <View style={styles.groupBreak}>
      <Text style={styles.groupTitle}>{group.label}</Text>
      <Text style={styles.groupTotal}>Total: {formatTransactionCurrencyTotals(netTotals, showCurrencyCodes)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  controlBlock: {
    gap: spacing.xs,
  },
  label: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '800',
  },
  customRange: {
    gap: spacing.sm,
  },
  customRangeRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dateSelector: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minWidth: 130,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dateSelectorValue: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '800',
  },
  datePickerPanel: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: spacing.xs,
  },
  datePickerDone: {
    alignItems: 'center',
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  datePickerDoneText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
  },
  groups: {
    gap: spacing.md,
  },
  group: {
    gap: 0,
  },
  groupBreak: {
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  groupTitle: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
  },
  groupTotal: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '900',
  },
  transactionRows: {
    gap: 0,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
  },
  pressed: {
    opacity: 0.78,
  },
});
