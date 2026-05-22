import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
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
import { ActionButton, Card, Chip, SectionHeader } from '../../components/ui';
import {
  getCashFlowSummary,
} from '../../domain/aggregates';
import { defaultCategories } from '../../domain/categories';
import { getCurrenciesInUse, getEffectiveDisplayCurrency } from '../../domain/currency';
import { getDateRangeForPreset, getInclusiveDateRange, toDateInputValue } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import {
  getStatsReport,
  type StatsReportLineRow,
} from '../../domain/statsReports';
import { getStatsDonutViewModel, getStatsMatchRowDetailText, type StatsDonutMode } from '../../domain/statsChart';
import { formatTransactionShortDate } from '../../domain/transactionDisplay';
import type { Account, AppSnapshot } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import {
  PeriodCarousel,
  type PeriodCarouselOption,
  type PeriodOption,
} from '../transactions/PeriodCarousel';
import { StatsDonutChart } from './StatsDonutChart';

type StatsScreenProps = {
  snapshot: AppSnapshot;
  onOpenTransaction?: (transactionId: string) => void;
  showHeader?: boolean;
};

type RangeMode = 'preset' | 'custom';
type DatePickerTarget = 'start' | 'end';

export function StatsScreen({ snapshot, onOpenTransaction, showHeader = true }: StatsScreenProps) {
  const insets = useSafeAreaInsets();
  const [preset, setPreset] = useState<PeriodOption>('last_month');
  const [rangeMode, setRangeMode] = useState<RangeMode>('preset');
  const [customStartDate, setCustomStartDate] = useState(() =>
    toDateInputValue(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
  );
  const [customEndDate, setCustomEndDate] = useState(() => toDateInputValue(new Date()));
  const [datePickerTarget, setDatePickerTarget] = useState<DatePickerTarget | null>(null);
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
  const spendingDonut = getStatsDonutViewModel({
    report: spendingReport,
    mode: spendingDonutMode,
    selectedCategoryRollupId: selectedSpendingCategoryRollupId,
    selectedSubcategoryRollupId: selectedSpendingSubcategoryRollupId,
    recentLimit: 5,
  });
  const selectedSpendingRollup = spendingDonut.selectedRollup;
  const selectedSpendingRows = spendingDonut.recentRows;
  const cashFlow = getCashFlowSummary({
    transactions: snapshot.transactions,
    lines: snapshot.transactionLines,
    transactionLinks: snapshot.transactionLinks,
    range,
    currencyCode,
    accountIds,
  });
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
        {showHeader ? (
          <SectionHeader
            title="Statistics"
            detail="Shared period, currency, and account filters for spending and cash flow."
          />
        ) : null}

        <Card testID="cash-flow-card">
          <Text style={styles.cardTitle}>Cash flow</Text>
          <View style={styles.flowGrid}>
            <Metric label="Income" value={formatMoney(cashFlow.incomeMinor, currencyCode)} tone="income" />
            <Metric label="Spending" value={formatMoney(cashFlow.expenseMinor, currencyCode)} tone="expense" />
            <Metric label="Net" value={formatMoney(cashFlow.netMinor, currencyCode)} />
          </View>
        </Card>

        <Card testID="spending-chart-card">
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Spending</Text>
              {spendingDonutMode === 'subcategory' && spendingDonut.selectedCategoryRollup ? (
                <Text numberOfLines={1} style={styles.cardSubtitle}>
                  {spendingDonut.selectedCategoryRollup.label}
                </Text>
              ) : null}
            </View>
            {spendingDonutMode === 'subcategory' ? (
              <ActionButton variant="ghost" onPress={returnToSpendingCategories}>
                Back to categories
              </ActionButton>
            ) : (
              <ActionButton
                disabled={!spendingDonut.canShowDetailedView}
                variant="secondary"
                onPress={openSpendingDetailedView}
              >
                Detailed view
              </ActionButton>
            )}
          </View>

          <StatsDonutChart
            currencyCode={currencyCode}
            emptyLabel={spendingDonut.emptyLabel}
            rollups={spendingDonut.rollups}
            selectedRollupId={selectedSpendingRollup?.id}
            onSelectRollup={selectSpendingRollup}
          />

          {selectedSpendingRollup ? (
            <View style={styles.matchSection}>
              <View style={styles.matchHeaderRow}>
                <View style={styles.matchHeaderText}>
                  <Text style={styles.matchTitle}>Recent matches</Text>
                  <Text style={styles.matchDetail}>
                    {selectedSpendingRollup.label} - {formatMoney(selectedSpendingRollup.netAmountMinor, currencyCode)}
                  </Text>
                </View>
              </View>

              {selectedSpendingRows.length ? (
                <View style={styles.matchRows}>
                  {selectedSpendingRows.map((row) => (
                    <StatsMatchRow
                      key={row.lineId}
                      row={row}
                      onOpenTransaction={onOpenTransaction}
                    />
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>No matching transactions.</Text>
              )}
            </View>
          ) : null}
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

function StatsMatchRow({
  row,
  onOpenTransaction,
}: {
  row: StatsReportLineRow;
  onOpenTransaction?: (transactionId: string) => void;
}) {
  const title = row.transactionTitle || row.lineItemName || row.subcategoryName;
  const lineDetail = getStatsMatchRowDetailText(row);
  const amountPrefix = row.reportKind === 'expense' ? '-' : '+';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onOpenTransaction}
      onPress={() => onOpenTransaction?.(row.transactionId)}
      style={({ pressed }) => [styles.matchRow, pressed && styles.pressed]}
      testID={`stats-match-row-${row.lineId}`}
    >
      <View style={[styles.matchIcon, { backgroundColor: row.subcategoryColor }]} />
      <View style={styles.matchBody}>
        <View style={styles.transactionLine}>
          <Text numberOfLines={1} style={styles.matchRowTitle}>
            {row.lineItemName}
          </Text>
          <Text style={styles.matchAmount}>
            {amountPrefix}{formatMoney(row.netAmountMinor, row.currencyCode)}
          </Text>
        </View>
        <Text numberOfLines={1} style={styles.matchLineDetail}>
          {title}
        </Text>
        <View style={styles.transactionLine}>
          <Text numberOfLines={1} style={styles.matchMeta}>
            {lineDetail}
          </Text>
          <Text style={styles.matchMeta}>{formatTransactionShortDate(row.transactionDatetime)}</Text>
        </View>
      </View>
    </Pressable>
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
  cardHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  cardHeaderText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  cardSubtitle: {
    color: colors.muted,
    fontSize: typography.small,
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
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
  },
  matchSection: {
    gap: spacing.sm,
  },
  matchHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  matchHeaderText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  matchTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  matchDetail: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  matchRows: {
    gap: spacing.xs,
  },
  matchRow: {
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  matchIcon: {
    borderRadius: 999,
    height: 12,
    marginTop: 5,
    width: 12,
  },
  matchBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  transactionLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  matchRowTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '900',
    minWidth: 0,
  },
  matchAmount: {
    color: colors.danger,
    flexShrink: 0,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
  },
  matchLineDetail: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  matchMeta: {
    color: colors.muted,
    flexShrink: 1,
    fontSize: typography.small,
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
