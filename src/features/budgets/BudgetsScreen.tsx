import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card, Chip, FormError, ProgressBar, SectionHeader, TextField } from '../../components/ui';
import { getBudgetUsage, getSpendingByCategory } from '../../domain/aggregates';
import { defaultCategories, getCategory } from '../../domain/categories';
import { getCurrenciesInUse } from '../../domain/currency';
import { getDateRangeForPreset } from '../../domain/dates';
import { formatMoney, normalizeCurrencyCode, parseMoneyInput } from '../../domain/money';
import type {
  AppSnapshot,
  NewBudgetInput,
  NewRecurringBillInput,
  UpdateRainyDayFundInput,
} from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';

type BudgetsScreenProps = {
  snapshot: AppSnapshot;
  onAddBudget: (input: NewBudgetInput) => Promise<void>;
  onAddRecurringBill: (input: NewRecurringBillInput) => Promise<void>;
  onUpdateRainyDayFund: (input: UpdateRainyDayFundInput) => Promise<void>;
};

export function BudgetsScreen({
  snapshot,
  onAddBudget,
  onAddRecurringBill,
  onUpdateRainyDayFund,
}: BudgetsScreenProps) {
  const currencies = useMemo(
    () =>
      getCurrenciesInUse([
        snapshot.defaultCurrencyCode,
        snapshot.rainyDayFund.currencyCode,
        ...snapshot.accounts.map((account) => account.currencyCode),
      ]),
    [snapshot],
  );
  const [budgetCategoryId, setBudgetCategoryId] = useState('food');
  const [budgetCurrency, setBudgetCurrency] = useState(snapshot.defaultCurrencyCode);
  const [budgetLimit, setBudgetLimit] = useState('');
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billCategoryId, setBillCategoryId] = useState('bills');
  const [billAccountId, setBillAccountId] = useState(snapshot.accounts[0]?.id ?? '');
  const [billDueDay, setBillDueDay] = useState('1');
  const [rainyCurrency, setRainyCurrency] = useState(snapshot.rainyDayFund.currencyCode);
  const [rainyGoal, setRainyGoal] = useState(formatMoney(snapshot.rainyDayFund.goalMinor, snapshot.rainyDayFund.currencyCode).replace(`${snapshot.rainyDayFund.currencyCode} `, ''));
  const [linkedAccountIds, setLinkedAccountIds] = useState(snapshot.rainyDayFund.linkedAccountIds);
  const [error, setError] = useState('');
  const showCurrencyCodes = snapshot.settings.multiCurrencyEnabled;
  const categories = snapshot.categories ?? defaultCategories;

  const selectedBillAccount = snapshot.accounts.find((account) => account.id === billAccountId) ?? snapshot.accounts[0];
  const monthRange = getDateRangeForPreset('last_month');
  const monthSpending = getSpendingByCategory({
    transactions: snapshot.transactions,
    lines: snapshot.transactionLines,
    transactionLinks: snapshot.transactionLinks,
    range: monthRange,
    currencyCode: budgetCurrency,
  });
  const budgetUsage = getBudgetUsage(
    snapshot.budgets.filter((budget) => budget.currencyCode === budgetCurrency),
    monthSpending,
  );

  async function submitBudget() {
    try {
      await onAddBudget({
        categoryId: budgetCategoryId,
        currencyCode: normalizeCurrencyCode(budgetCurrency, snapshot.defaultCurrencyCode),
        monthlyLimitMinor: parseMoneyInput(budgetLimit),
      });
      setBudgetLimit('');
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save budget.');
    }
  }

  async function submitBill() {
    try {
      if (!selectedBillAccount) {
        throw new Error('Add an account before adding bills.');
      }

      await onAddRecurringBill({
        name: billName,
        amountMinor: parseMoneyInput(billAmount),
        currencyCode: selectedBillAccount.currencyCode,
        accountId: selectedBillAccount.id,
        categoryId: billCategoryId,
        dueDay: Number(billDueDay),
      });
      setBillName('');
      setBillAmount('');
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add bill.');
    }
  }

  async function submitRainyFund() {
    try {
      await onUpdateRainyDayFund({
        currencyCode: normalizeCurrencyCode(rainyCurrency, snapshot.defaultCurrencyCode),
        goalMinor: parseMoneyInput(rainyGoal),
        linkedAccountIds,
      });
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update rainy day fund.');
    }
  }

  return (
    <View style={styles.stack}>
      <SectionHeader title="Budgets" detail="Monthly category limits are tracked per currency." />

      <Card testID="budget-form">
        <Text style={styles.cardTitle}>Monthly limit</Text>
        <Text style={styles.label}>Category</Text>
        <View style={styles.wrap}>
          {categories
            .filter((category) => category.type !== 'income')
            .map((category) => (
              <Chip key={category.id} selected={budgetCategoryId === category.id} onPress={() => setBudgetCategoryId(category.id)}>
                {category.name}
              </Chip>
            ))}
        </View>
        {showCurrencyCodes ? (
          <>
            <Text style={styles.label}>Currency</Text>
            <View style={styles.wrap}>
              {currencies.map((currency) => (
                <Chip key={currency} selected={budgetCurrency === currency} onPress={() => setBudgetCurrency(currency)}>
                  {currency}
                </Chip>
              ))}
            </View>
          </>
        ) : null}
        <TextField
          label="Monthly limit"
          value={budgetLimit}
          onChangeText={setBudgetLimit}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <ActionButton onPress={submitBudget} testID="save-budget">
          Save budget
        </ActionButton>
      </Card>

      {budgetUsage.length ? (
        <Card testID="budget-list">
          <Text style={styles.cardTitle}>Used vs remaining</Text>
          {budgetUsage.map((usage) => {
            const category = getCategory(usage.budget.categoryId, categories);
            return (
              <View key={usage.budget.id} style={styles.budgetRow}>
                <View style={styles.rowBetween}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <Text style={styles.amountText}>
                    {formatMoney(usage.remainingMinor, usage.budget.currencyCode)} left
                  </Text>
                </View>
                <ProgressBar percentage={usage.percentageUsed} color={usage.percentageUsed >= 100 ? colors.danger : category.color} />
                <Text style={styles.metaText}>
                  {formatMoney(usage.spentMinor, usage.budget.currencyCode)} of{' '}
                  {formatMoney(usage.budget.monthlyLimitMinor, usage.budget.currencyCode)}
                </Text>
              </View>
            );
          })}
        </Card>
      ) : null}

      <SectionHeader title="Recurring bills" />
      <Card testID="bill-form">
        <TextField label="Name" value={billName} onChangeText={setBillName} placeholder="Internet, Rent, Insurance" />
        <TextField label="Amount" value={billAmount} onChangeText={setBillAmount} keyboardType="decimal-pad" />
        <Text style={styles.label}>Account</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {snapshot.accounts.map((account) => (
            <Chip key={account.id} selected={billAccountId === account.id} onPress={() => setBillAccountId(account.id)}>
              {showCurrencyCodes ? `${account.name} (${account.currencyCode})` : account.name}
            </Chip>
          ))}
        </ScrollView>
        <Text style={styles.label}>Category</Text>
        <View style={styles.wrap}>
          {categories
            .filter((category) => category.type !== 'income')
            .map((category) => (
              <Chip key={category.id} selected={billCategoryId === category.id} onPress={() => setBillCategoryId(category.id)}>
                {category.name}
              </Chip>
            ))}
        </View>
        <TextField label="Due day" value={billDueDay} onChangeText={setBillDueDay} keyboardType="number-pad" />
        <ActionButton onPress={submitBill} testID="save-bill">
          Add bill
        </ActionButton>
      </Card>

      <Card testID="bill-list">
        <Text style={styles.cardTitle}>Bills</Text>
        {snapshot.recurringBills.map((bill) => (
          <View key={bill.id} style={styles.rowBetween}>
            <View style={styles.billText}>
              <Text style={styles.categoryName}>{bill.name}</Text>
              <Text style={styles.metaText}>Due day {bill.dueDay} - {getCategory(bill.categoryId, categories).name}</Text>
            </View>
            <Text style={styles.amountText}>{formatMoney(bill.amountMinor, bill.currencyCode)}</Text>
          </View>
        ))}
      </Card>

      <SectionHeader title="Rainy day fund" detail="Only linked accounts in the fund currency count toward progress." />
      <Card testID="rainy-fund-form">
        {showCurrencyCodes ? (
          <>
            <Text style={styles.label}>Currency</Text>
            <View style={styles.wrap}>
              {currencies.map((currency) => (
                <Chip key={currency} selected={rainyCurrency === currency} onPress={() => setRainyCurrency(currency)}>
                  {currency}
                </Chip>
              ))}
            </View>
          </>
        ) : null}
        <TextField label="Goal" value={rainyGoal} onChangeText={setRainyGoal} keyboardType="decimal-pad" />
        <Text style={styles.label}>Linked accounts</Text>
        <View style={styles.wrap}>
          {snapshot.accounts
            .filter((account) => account.currencyCode === rainyCurrency)
            .map((account) => (
              <Chip
                key={account.id}
                selected={linkedAccountIds.includes(account.id)}
                onPress={() =>
                  setLinkedAccountIds((ids) =>
                    ids.includes(account.id) ? ids.filter((id) => id !== account.id) : [...ids, account.id],
                  )
                }
              >
                {account.name}
              </Chip>
            ))}
        </View>
        <FormError message={error} />
        <ActionButton onPress={submitRainyFund} testID="save-rainy-fund">
          Save rainy fund
        </ActionButton>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '800',
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
  chips: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  budgetRow: {
    gap: spacing.sm,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  categoryName: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '800',
  },
  amountText: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '800',
    textAlign: 'right',
  },
  metaText: {
    color: colors.muted,
    fontSize: typography.small,
  },
  billText: {
    flex: 1,
    gap: spacing.xs,
  },
});
