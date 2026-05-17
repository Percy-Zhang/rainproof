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
import { Card, Chip, ProgressBar, SectionHeader } from '../../components/ui';
import {
  getCashFlowSummary,
  getSpendingByCategory,
} from '../../domain/aggregates';
import { defaultCategories, getCategory } from '../../domain/categories';
import { getCurrenciesInUse } from '../../domain/currency';
import { getDateRangeForPreset, getInclusiveDateRange, toDateInputValue } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import type { Account, AppSnapshot } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import {
  PeriodCarousel,
  type PeriodCarouselOption,
  type PeriodOption,
} from '../transactions/PeriodCarousel';

type StatsScreenProps = {
  snapshot: AppSnapshot;
};

type RangeMode = 'preset' | 'custom';
type DatePickerTarget = 'start' | 'end';

export function StatsScreen({ snapshot }: StatsScreenProps) {
  const insets = useSafeAreaInsets();
  const [preset, setPreset] = useState<PeriodOption>('last_month');
  const [rangeMode, setRangeMode] = useState<RangeMode>('preset');
  const [customStartDate, setCustomStartDate] = useState(() =>
    toDateInputValue(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
  );
  const [customEndDate, setCustomEndDate] = useState(() => toDateInputValue(new Date()));
  const [datePickerTarget, setDatePickerTarget] = useState<DatePickerTarget | null>(null);
  const [currencyCode, setCurrencyCode] = useState(snapshot.defaultCurrencyCode);
  const [accountId, setAccountId] = useState('all');
  const showCurrencyCodes = snapshot.settings.multiCurrencyEnabled;
  const categories = snapshot.categories ?? defaultCategories;
  const selectedPeriodOption: PeriodCarouselOption = rangeMode === 'custom' ? 'custom' : preset;

  const currencies = useMemo(
    () =>
      getCurrenciesInUse([
        snapshot.defaultCurrencyCode,
        ...snapshot.accounts.map((account) => account.currencyCode),
        ...snapshot.budgets.map((budget) => budget.currencyCode),
      ]),
    [snapshot],
  );
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
  const accountIds = effectiveAccountId === 'all' ? undefined : [effectiveAccountId];
  const spending = getSpendingByCategory({
    transactions: snapshot.transactions,
    lines: snapshot.transactionLines,
    transactionLinks: snapshot.transactionLinks,
    range,
    currencyCode,
    accountIds,
  });
  const cashFlow = getCashFlowSummary({
    transactions: snapshot.transactions,
    lines: snapshot.transactionLines,
    transactionLinks: snapshot.transactionLinks,
    range,
    currencyCode,
    accountIds,
  });
  const maxSpending = Math.max(...spending.map((item) => item.amountMinor), 1);
  const bottomPadding = (showCurrencyCodes ? 330 : rangeMode === 'custom' ? 280 : 230) + insets.bottom;

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

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader title="Statistics" detail="Shared period, currency, and account filters for spending and cash flow." />

        <Card testID="cash-flow-card">
          <Text style={styles.cardTitle}>Cash flow</Text>
          <View style={styles.flowGrid}>
            <Metric label="Income" value={formatMoney(cashFlow.incomeMinor, currencyCode)} tone="income" />
            <Metric label="Spending" value={formatMoney(cashFlow.expenseMinor, currencyCode)} tone="expense" />
            <Metric label="Net" value={formatMoney(cashFlow.netMinor, currencyCode)} />
          </View>
        </Card>

        <Card testID="spending-chart-card">
          <Text style={styles.cardTitle}>Spending by category</Text>
          {spending.length ? (
            spending.map((item) => {
              const category = getCategory(item.categoryId, categories);
              return (
                <View key={item.categoryId} style={styles.chartRow}>
                  <View style={styles.rowBetween}>
                    <View style={styles.categoryTitleRow}>
                      <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                      <Text style={styles.categoryName}>{category.name}</Text>
                    </View>
                    <Text style={styles.amountText}>{formatMoney(item.amountMinor, currencyCode)}</Text>
                  </View>
                  <ProgressBar percentage={(item.amountMinor / maxSpending) * 100} color={category.color} />
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No spending in this period.</Text>
          )}
        </Card>

        <Card testID="category-colors-card">
          <Text style={styles.cardTitle}>Category colors</Text>
          <View style={styles.categoryGrid}>
            {categories.map((category) => (
              <View key={category.id} style={styles.categoryPill}>
                <View style={[styles.swatch, { backgroundColor: category.color }]} />
                <Text style={styles.categoryPillText}>{category.name}</Text>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>

      <BottomSelectorPanel testID="stats-bottom-controls">
        {showCurrencyCodes ? (
          <View style={styles.controlBlock}>
            <Text style={styles.label}>Currency</Text>
            <View style={styles.wrap}>
              {currencies.map((currency) => (
                <Chip key={currency} selected={currencyCode === currency} onPress={() => changeCurrency(currency)}>
                  {currency}
                </Chip>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.controlBlock}>
          <Text style={styles.label}>Accounts</Text>
          <AccountFilterCarousel
            accounts={accountsForCurrency}
            allSelected={effectiveAccountId === 'all'}
            selectedAccountIds={effectiveAccountId === 'all' ? [] : [effectiveAccountId]}
            showCurrencyCodes={showCurrencyCodes}
            getAccountLabel={accountLabel}
            onPressAccount={setAccountId}
            onPressAll={() => setAccountId('all')}
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

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'income' | 'expense' }) {
  return (
    <View style={[styles.metric, tone === 'income' && styles.metricIncome, tone === 'expense' && styles.metricExpense]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text
        style={[
          styles.metricValue,
          tone === 'income' && styles.metricValueIncome,
          tone === 'expense' && styles.metricValueExpense,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function DateSelector({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.dateSelector, pressed && styles.pressed]}
    >
      <Text style={styles.dateSelectorLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.dateSelectorValue}>{value}</Text>
    </Pressable>
  );
}

function accountLabel(account: Account, showCurrencyCodes: boolean): string {
  return showCurrencyCodes ? `${account.name} (${account.currencyCode})` : account.name;
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
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  dateSelectorLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
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
    width: '100%',
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
  cardTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '800',
  },
  flowGrid: {
    gap: spacing.sm,
  },
  metric: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  metricIncome: {
    backgroundColor: '#E4F3EF',
    borderColor: colors.success,
  },
  metricExpense: {
    backgroundColor: '#F8E8E8',
    borderColor: colors.danger,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
  },
  metricValue: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '900',
  },
  metricValueIncome: {
    color: colors.success,
  },
  metricValueExpense: {
    color: colors.danger,
  },
  chartRow: {
    gap: spacing.sm,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  categoryTitleRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minWidth: 0,
  },
  categoryDot: {
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  categoryName: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '800',
    minWidth: 0,
  },
  amountText: {
    color: colors.ink,
    flexShrink: 0,
    fontSize: typography.body,
    fontWeight: '800',
    textAlign: 'right',
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryPill: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  swatch: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  categoryPillText: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
  },
});
