import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRenderScopedAnimationSuppression } from '../../components/useRenderScopedAnimationSuppression';
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
  getDashboardCashFlowByCurrencyFromContext,
  getDashboardTopSpendingByCurrencyFromContext,
  type DashboardTopSpendingCurrencyGroup,
} from '../../domain/dashboardFinancial';
import { getDashboardRecurringSummary } from '../../domain/dashboardRecurring';
import {
  buildDashboardSelectedAccountContext,
  type DashboardSelectedAccountContext,
} from '../../domain/dashboardSelectedAccountContext';
import {
  getDashboardAccountPreview,
  getDashboardInitialSelectedAccountIds,
  getDashboardRecentTransactionsForData,
  getDashboardSelectedAccountIds,
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
  DateRange,
  DashboardCardId,
  Transaction,
  TransactionLine,
  TransactionLink,
  UpcomingRecurringItem,
} from '../../domain/types';
import { logDevPerfDuration, timeDevPerf } from '../../performance';

export type DashboardBudgetProgressData = {
  activeBudgetCount: number;
  rows: BudgetUsageDisplayRow[];
};

type DashboardSelectedAccountCardData = {
  dashboardBalanceTotals: CurrencyTotal[];
  dashboardCashFlow: CashFlowSummary[];
  dashboardTopSpending: DashboardTopSpendingCurrencyGroup[];
};

type DashboardRecentTransactions = ReturnType<typeof getDashboardRecentTransactionsForData>;

type DashboardSelectedAccountCardInputs = {
  accountBalances: AccountBalance[];
  dashboardMonthRange: DateRange;
  previewAccountIds: string[];
  selectedAccountIds: string[];
  transactionLines: TransactionLine[];
  transactionLinks: TransactionLink[];
  transactions: Transaction[];
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
  recentTransactions: DashboardRecentTransactions;
  recurringSummary: {
    activeCount: number;
    rows: UpcomingRecurringItem[];
  };
  selectedAccountIds: string[];
  setSelectedAccounts: (accountIds: string[]) => void;
  showCurrencyCodes: boolean;
  suppressRecentTransactionAnimations: boolean;
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
  const initialSelectedAccountIds = getDashboardSelectedAccountIds(
    accountBalances,
    snapshot.settings.dashboardSelectedAccountIds,
  );
  const [selectedAccountIds, setSelectedAccountIds] = useState(() => initialSelectedAccountIds);
  const {
    suppressAnimations: suppressRecentTransactionAnimations,
    suppressNextRenderAnimations: suppressRecentAnimationsForAccountFilter,
  } = useRenderScopedAnimationSuppression();
  const pendingSelectedAccountIdsRef = useRef(initialSelectedAccountIds);
  const hasLocalPendingSelectionRef = useRef(false);

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
  const selectedAccountCardInputs = useMemo<DashboardSelectedAccountCardInputs>(
    () => ({
      accountBalances,
      dashboardMonthRange,
      previewAccountIds,
      selectedAccountIds,
      transactionLines: snapshot.transactionLines,
      transactionLinks: snapshot.transactionLinks,
      transactions: snapshot.transactions,
    }),
    [
      accountBalances,
      dashboardMonthRange,
      previewAccountIds,
      selectedAccountIds,
      snapshot.transactionLines,
      snapshot.transactionLinks,
      snapshot.transactions,
    ],
  );
  const selectedAccountCardInputsRef = useRef(selectedAccountCardInputs);
  const dashboardCardDerivationTokenRef = useRef(0);
  const [selectedAccountCardData, setSelectedAccountCardData] = useState(() =>
    deriveDashboardSelectedAccountCards(selectedAccountCardInputs),
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
  const recentTransactions = useMemo(
    () =>
      deriveDashboardRecentTransactionsForData({
        previewAccountIds,
        selectedAccountIds,
        transactionLines: snapshot.transactionLines,
        transactionLinks: snapshot.transactionLinks,
        transactions: snapshot.transactions,
      }),
    [
      previewAccountIds,
      selectedAccountIds,
      snapshot.transactionLines,
      snapshot.transactionLinks,
      snapshot.transactions,
    ],
  );

  useEffect(() => {
    const nextIds =
      snapshot.settings.dashboardSelectedAccountIds === null
        ? getDashboardInitialSelectedAccountIds(accountBalances)
        : getDashboardSelectedAccountIds(accountBalances, snapshot.settings.dashboardSelectedAccountIds);

    if (hasLocalPendingSelectionRef.current && !areSameIds(pendingSelectedAccountIdsRef.current, nextIds)) {
      return;
    }

    hasLocalPendingSelectionRef.current = false;
    pendingSelectedAccountIdsRef.current = nextIds;
    setSelectedAccountIds((currentIds) => (areSameIds(currentIds, nextIds) ? currentIds : nextIds));
  }, [accountBalances, snapshot.settings.dashboardSelectedAccountIds]);

  useEffect(() => {
    if (areDashboardSelectedAccountCardInputsEqual(selectedAccountCardInputsRef.current, selectedAccountCardInputs)) {
      return;
    }

    const derivationToken = dashboardCardDerivationTokenRef.current + 1;
    dashboardCardDerivationTokenRef.current = derivationToken;
    const timeoutId = setTimeout(() => {
      void deriveDashboardSelectedAccountCardsInStages(
        selectedAccountCardInputs,
        () => dashboardCardDerivationTokenRef.current !== derivationToken,
      ).then((nextData) => {
        if (!nextData || dashboardCardDerivationTokenRef.current !== derivationToken) {
          return;
        }

        selectedAccountCardInputsRef.current = selectedAccountCardInputs;
        setSelectedAccountCardData(nextData);
      });
    }, 0);

    return () => {
      dashboardCardDerivationTokenRef.current += 1;
      clearTimeout(timeoutId);
    };
  }, [selectedAccountCardInputs]);

  const acceptSelectedAccountIds = useCallback((nextIds: string[]) => {
    const startedAt = Date.now();
    const nextSelectedAccountIds = [...nextIds];
    suppressRecentAnimationsForAccountFilter();
    pendingSelectedAccountIdsRef.current = nextSelectedAccountIds;
    hasLocalPendingSelectionRef.current = true;
    setSelectedAccountIds((currentIds) =>
      areSameIds(currentIds, nextSelectedAccountIds) ? currentIds : nextSelectedAccountIds,
    );
    logDevPerfDuration('dashboard.accountSelection.accepted', startedAt, {
      selectedAccounts: nextSelectedAccountIds.length,
    });
    void onUpdateSelectedAccountIds(nextSelectedAccountIds);
  }, [onUpdateSelectedAccountIds, suppressRecentAnimationsForAccountFilter]);

  const setSelectedAccounts = useCallback((accountIds: string[]) => {
    acceptSelectedAccountIds(accountIds);
  }, [acceptSelectedAccountIds]);

  return {
    accountById,
    accountPreview,
    budgetProgress,
    categories,
    creditCardSummaries,
    dashboardBalanceTotals: selectedAccountCardData.dashboardBalanceTotals,
    dashboardCardIds,
    dashboardCashFlow: selectedAccountCardData.dashboardCashFlow,
    dashboardTopSpending: selectedAccountCardData.dashboardTopSpending,
    hasAnyAccounts,
    recentTransactions,
    recurringSummary,
    selectedAccountIds,
    setSelectedAccounts,
    showCurrencyCodes,
    suppressRecentTransactionAnimations,
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

function deriveDashboardSelectedAccountCards(
  inputs: DashboardSelectedAccountCardInputs,
): DashboardSelectedAccountCardData {
  const selectedAccountContext = deriveDashboardSelectedAccountContext(inputs);

  return {
    dashboardBalanceTotals: deriveDashboardBalanceTotals(inputs),
    dashboardCashFlow: deriveDashboardCashFlow(selectedAccountContext),
    dashboardTopSpending: deriveDashboardTopSpending(selectedAccountContext),
  };
}

async function deriveDashboardSelectedAccountCardsInStages(
  inputs: DashboardSelectedAccountCardInputs,
  isStale: () => boolean,
): Promise<DashboardSelectedAccountCardData | null> {
  const startedAt = Date.now();

  await yieldDashboardDerivationStage();
  if (isStale()) {
    return null;
  }
  const selectedAccountContext = deriveDashboardSelectedAccountContext(inputs);

  if (isStale()) {
    return null;
  }
  const dashboardBalanceTotals = deriveDashboardBalanceTotals(inputs);

  await yieldDashboardDerivationStage();
  if (isStale()) {
    return null;
  }
  const dashboardCashFlow = deriveDashboardCashFlow(selectedAccountContext);

  await yieldDashboardDerivationStage();
  if (isStale()) {
    return null;
  }
  const dashboardTopSpending = deriveDashboardTopSpending(selectedAccountContext);

  if (isStale()) {
    return null;
  }

  logDevPerfDuration('dashboard.derived.commit', startedAt, {
    selectedAccounts: inputs.selectedAccountIds.length,
  });

  return {
    dashboardBalanceTotals,
    dashboardCashFlow,
    dashboardTopSpending,
  };
}

function deriveDashboardSelectedAccountContext(
  inputs: DashboardSelectedAccountCardInputs,
): DashboardSelectedAccountContext {
  return timeDevPerf(
    'dashboard.derived.selectedAccountContext',
    () => buildDashboardSelectedAccountContext({
      lines: inputs.transactionLines,
      range: inputs.dashboardMonthRange,
      selectedAccountIds: inputs.selectedAccountIds,
      transactionLinks: inputs.transactionLinks,
      transactions: inputs.transactions,
    }),
    (context) => ({
      incomeExpenseCurrencies: context.incomeExpenseCurrencyCodes.length,
      selectedAccounts: context.selectedAccountIds.length,
      selectedLines: context.selectedLines.length,
      spendingCurrencies: context.spendingCurrencyCodes.length,
    }),
  );
}

function deriveDashboardBalanceTotals(inputs: DashboardSelectedAccountCardInputs): CurrencyTotal[] {
  return timeDevPerf(
    'dashboard.derived.balanceTotals',
    () => getDashboardBalanceTotals({
      accountBalances: inputs.accountBalances,
      selectedAccountIds: inputs.selectedAccountIds,
    }),
    (totals) => ({
      accounts: inputs.accountBalances.length,
      selectedAccounts: inputs.selectedAccountIds.length,
      currencyGroups: totals.length,
    }),
  );
}

function deriveDashboardCashFlow(context: DashboardSelectedAccountContext): CashFlowSummary[] {
  return timeDevPerf(
    'dashboard.derived.cashFlow',
    () => getDashboardCashFlowByCurrencyFromContext(context),
    (cashFlow) => ({
      selectedAccounts: context.selectedAccountIds.length,
      selectedLines: context.selectedLines.length,
      currencyGroups: cashFlow.length,
    }),
  );
}

function deriveDashboardTopSpending(context: DashboardSelectedAccountContext): DashboardTopSpendingCurrencyGroup[] {
  return timeDevPerf(
    'dashboard.derived.topSpending',
    () => getDashboardTopSpendingByCurrencyFromContext(context),
    (groups) => ({
      selectedAccounts: context.selectedAccountIds.length,
      selectedLines: context.selectedLines.length,
      currencyGroups: groups.length,
    }),
  );
}

function deriveDashboardRecentTransactionsForData({
  previewAccountIds,
  selectedAccountIds,
  transactionLines,
  transactionLinks,
  transactions,
}: {
  previewAccountIds: string[];
  selectedAccountIds: string[];
  transactionLines: TransactionLine[];
  transactionLinks: TransactionLink[];
  transactions: Transaction[];
}): DashboardRecentTransactions {
  return timeDevPerf(
    'dashboard.derived.recentTransactions',
    () =>
      getDashboardRecentTransactionsForData({
        lines: transactionLines,
        previewAccountIds,
        selectedAccountIds,
        transactionLinks,
        transactions,
      }),
    (entries) => ({
      selectedAccounts: selectedAccountIds.length,
      previewAccounts: previewAccountIds.length,
      transactions: transactions.length,
      lines: transactionLines.length,
      entries: entries.length,
    }),
  );
}

function areDashboardSelectedAccountCardInputsEqual(
  left: DashboardSelectedAccountCardInputs,
  right: DashboardSelectedAccountCardInputs,
): boolean {
  return areAccountBalancesEqual(left.accountBalances, right.accountBalances) &&
    left.dashboardMonthRange === right.dashboardMonthRange &&
    left.previewAccountIds === right.previewAccountIds &&
    left.transactionLines === right.transactionLines &&
    left.transactionLinks === right.transactionLinks &&
    left.transactions === right.transactions &&
    areSameIds(left.selectedAccountIds, right.selectedAccountIds);
}

function areAccountBalancesEqual(left: AccountBalance[], right: AccountBalance[]): boolean {
  return left.length === right.length &&
    left.every((item, index) => {
      const other = right[index];
      if (!other) {
        return false;
      }

      return item.balanceMinor === other.balanceMinor &&
        item.account.id === other.account.id &&
        item.account.currencyCode === other.account.currencyCode &&
        item.account.isArchived === other.account.isArchived;
    });
}

function yieldDashboardDerivationStage(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function areSameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}
