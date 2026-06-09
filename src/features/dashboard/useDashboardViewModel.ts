import { useEffect, useMemo, useState } from 'react';

import {
  getBudgetUsageDisplayRows,
  getBudgetUsagesForPeriods,
  getDashboardBudgetSummaryData,
  sortBudgetUsagesByDisplayOrder,
  type BudgetUsageDisplayRow,
} from '../../domain/budgets';
import { defaultCategories } from '../../domain/categories';
import {
  getRenderableDashboardCardIds,
  type DashboardCardAvailability,
} from '../../domain/dashboardCards';
import {
  getDashboardBalanceTotals,
  getDashboardCashFlowByCurrency,
  getDashboardTopSpendingByCurrency,
  type DashboardTopSpendingCurrencyGroup,
} from '../../domain/dashboardFinancial';
import { getDashboardRecurringSummary } from '../../domain/dashboardRecurring';
import {
  getDashboardAccountPreview,
  getDashboardInitialSelectedAccountIds,
  getDashboardRecentTransactions,
  getDashboardSelectedAccountIds,
  toggleDashboardAccountSelection,
} from '../../domain/dashboard';
import {
  getCreditCardPortfolioSummary,
  type CreditCardCurrencySummary,
} from '../../domain/creditCards';
import { getDateRangeForPreset } from '../../domain/dates';
import type {
  Account,
  AccountBalance,
  AppSnapshot,
  CashFlowSummary,
  CategoryDefinition,
  CurrencyTotal,
  DashboardCardId,
  UpcomingRecurringItem,
} from '../../domain/types';

export type DashboardBudgetProgressData = {
  activeBudgetCount: number;
  rows: BudgetUsageDisplayRow[];
};

export type DashboardViewModel = {
  accountById: Map<string, Account>;
  accountPreview: AccountBalance[];
  budgetProgress: DashboardBudgetProgressData;
  categories: CategoryDefinition[];
  creditCardSummaries: CreditCardCurrencySummary[];
  dashboardBalanceTotals: CurrencyTotal[];
  dashboardCardIds: DashboardCardId[];
  dashboardCashFlow: CashFlowSummary[];
  dashboardTopSpending: DashboardTopSpendingCurrencyGroup[];
  hasAnyAccounts: boolean;
  recentTransactions: ReturnType<typeof getDashboardRecentTransactions>;
  recurringSummary: {
    activeCount: number;
    rows: UpcomingRecurringItem[];
  };
  selectedAccountIds: string[];
  showCurrencyCodes: boolean;
  toggleAccount: (accountId: string) => void;
};

export function useDashboardViewModel({
  accountBalances,
  onUpdateSelectedAccountIds,
  snapshot,
}: {
  accountBalances: AccountBalance[];
  onUpdateSelectedAccountIds: (accountIds: string[]) => Promise<void>;
  snapshot: AppSnapshot;
}): DashboardViewModel {
  const hasAnyAccounts = snapshot.accounts.length > 0;
  const showCurrencyCodes = snapshot.settings.multiCurrencyEnabled;
  const categories = snapshot.categories ?? defaultCategories;
  const [selectedAccountIds, setSelectedAccountIds] = useState(() =>
    getDashboardSelectedAccountIds(accountBalances, snapshot.settings.dashboardSelectedAccountIds),
  );

  const accountById = useMemo(
    () => new Map(snapshot.accounts.map((account) => [account.id, account])),
    [snapshot.accounts],
  );
  const accountPreview = useMemo(() => getDashboardAccountPreview(accountBalances), [accountBalances]);
  const previewAccountIds = useMemo(
    () => accountPreview.map(({ account }) => account.id),
    [accountPreview],
  );
  const dashboardMonthRange = useMemo(() => getDateRangeForPreset('last_month'), []);
  const dashboardBalanceTotals = useMemo(
    () => getDashboardBalanceTotals({ accountBalances, selectedAccountIds }),
    [accountBalances, selectedAccountIds],
  );
  const dashboardCashFlow = useMemo(
    () => getDashboardCashFlowByCurrency({
      accountIds: selectedAccountIds,
      lines: snapshot.transactionLines,
      range: dashboardMonthRange,
      transactionLinks: snapshot.transactionLinks,
      transactions: snapshot.transactions,
    }),
    [dashboardMonthRange, selectedAccountIds, snapshot.transactionLines, snapshot.transactionLinks, snapshot.transactions],
  );
  const dashboardTopSpending = useMemo(
    () => getDashboardTopSpendingByCurrency({
      accountIds: selectedAccountIds,
      lines: snapshot.transactionLines,
      range: dashboardMonthRange,
      transactionLinks: snapshot.transactionLinks,
      transactions: snapshot.transactions,
    }),
    [dashboardMonthRange, selectedAccountIds, snapshot.transactionLines, snapshot.transactionLinks, snapshot.transactions],
  );
  const recentTransactions = useMemo(
    () =>
      getDashboardRecentTransactions({
        previewAccountIds,
        snapshot,
        selectedAccountIds,
      }),
    [previewAccountIds, selectedAccountIds, snapshot],
  );
  const creditCardSummaries = useMemo(
    () => getCreditCardPortfolioSummary(accountBalances),
    [accountBalances],
  );
  const budgetProgress = useMemo(
    () => getDashboardBudgetProgressData(snapshot, categories),
    [categories, snapshot],
  );
  const recurringSummary = useMemo(
    () => getDashboardRecurringSummary(snapshot.recurringItems, { limit: 4 }),
    [snapshot.recurringItems],
  );
  const cardAvailability = useMemo<DashboardCardAvailability>(() => ({
    budgetProgress: budgetProgress.activeBudgetCount > 0,
    creditCards: creditCardSummaries.length > 0,
    upcomingPayments: recurringSummary.activeCount > 0,
  }), [budgetProgress.activeBudgetCount, creditCardSummaries.length, recurringSummary.activeCount]);
  const dashboardCardIds = useMemo(
    () =>
      getRenderableDashboardCardIds(snapshot.settings.dashboardCardSettings, cardAvailability),
    [cardAvailability, snapshot.settings.dashboardCardSettings],
  );

  useEffect(() => {
    setSelectedAccountIds((currentIds) => {
      const nextIds =
        snapshot.settings.dashboardSelectedAccountIds === null
          ? getDashboardInitialSelectedAccountIds(accountBalances)
          : getDashboardSelectedAccountIds(accountBalances, snapshot.settings.dashboardSelectedAccountIds);
      return areSameIds(currentIds, nextIds) ? currentIds : nextIds;
    });
  }, [accountBalances, snapshot.settings.dashboardSelectedAccountIds]);

  function toggleAccount(accountId: string) {
    setSelectedAccountIds((currentIds) => {
      const nextIds = toggleDashboardAccountSelection(currentIds, accountId);
      void onUpdateSelectedAccountIds(nextIds);
      return nextIds;
    });
  }

  return {
    accountById,
    accountPreview,
    budgetProgress,
    categories,
    creditCardSummaries,
    dashboardBalanceTotals,
    dashboardCardIds,
    dashboardCashFlow,
    dashboardTopSpending,
    hasAnyAccounts,
    recentTransactions,
    recurringSummary,
    selectedAccountIds,
    showCurrencyCodes,
    toggleAccount,
  };
}

function getDashboardBudgetProgressData(
  snapshot: AppSnapshot,
  categories: CategoryDefinition[],
): DashboardBudgetProgressData {
  const activeBudgets = snapshot.budgets.filter((budget) => budget.isActive);
  if (!activeBudgets.length) {
    return { activeBudgetCount: 0, rows: [] };
  }

  const usages = getBudgetUsagesForPeriods({
    accounts: snapshot.accounts,
    budgets: activeBudgets,
    categories,
    transactionLines: snapshot.transactionLines,
    transactionLinks: snapshot.transactionLinks,
    transactions: snapshot.transactions,
  });
  const summary = getDashboardBudgetSummaryData(usages, 3);
  const orderedUsages = sortBudgetUsagesByDisplayOrder(
    usages.filter((usage) => usage.budget.isActive),
  ).slice(0, 3);

  return {
    activeBudgetCount: summary.activeBudgetCount,
    rows: getBudgetUsageDisplayRows(orderedUsages, categories),
  };
}

function areSameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}
