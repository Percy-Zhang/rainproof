import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getAccountBalances,
  getCashFlowSummary,
  getRainyDayProgress,
  getSpendingByCategory,
  getUpcomingBills,
  groupBalancesByCurrency,
} from '../domain/aggregates';
import { getBudgetUsagesForPeriods } from '../domain/budgets';
import { defaultCategories } from '../domain/categories';
import { getEffectiveDisplayCurrency } from '../domain/currency';
import { getDateRangeForPreset } from '../domain/dates';
import type {
  AccountBalance,
  AddTransactionDefaults,
  AppSnapshot,
  BudgetUsage,
  CashFlowSummary,
  CreateRecurringTransactionInput,
  CurrencyTotal,
  NewAccountInput,
  NewBudgetInput,
  NewRecurringItemInput,
  NewTransactionTemplateInput,
  NewTransactionLinkInput,
  NewTransactionInput,
  RainyDayProgress,
  SpendingByCategory,
  UpcomingBill,
  UpdateAppSettingsInput,
  UpdateCategoryCatalogInput,
  UpdateDashboardCardSettingsInput,
  UpdateAccountInput,
  UpdateAddTransactionDefaultsInput,
  UpdateBudgetInput,
  UpdateRecurringItemInput,
  UpdateTransactionTemplateInput,
  UpdateRainyDayFundInput,
  UpdateTransactionLinkInput,
  UpdateTransactionInput,
} from '../domain/types';
import type { RainproofBackup } from '../domain/backupExport';
import { logDevPerfDuration, timeDevPerf } from '../performance';
import { createSQLiteFinanceRepository, type FinanceRepository } from '../storage/repository';
import { getDeviceDefaultCurrencyCode } from './deviceCurrency';

type RainproofDerivedData = {
  accountBalances: AccountBalance[];
  totalsByCurrency: CurrencyTotal[];
  rainyDayProgress: RainyDayProgress | null;
  currentMonthSpending: SpendingByCategory[];
  budgetUsage: BudgetUsage[];
  upcomingBills: UpcomingBill[];
  cashFlow: CashFlowSummary | null;
};

type RainproofActions = {
  addAccount(input: NewAccountInput): Promise<void>;
  updateAccount(input: UpdateAccountInput): Promise<void>;
  addTransaction(input: NewTransactionInput, addTransactionDefaults?: AddTransactionDefaults): Promise<void>;
  updateTransaction(input: UpdateTransactionInput): Promise<void>;
  deleteTransaction(transactionId: string): Promise<void>;
  addTransactionLink(input: NewTransactionLinkInput): Promise<void>;
  updateTransactionLink(input: UpdateTransactionLinkInput): Promise<void>;
  deleteTransactionLink(linkId: string): Promise<void>;
  addBudget(input: NewBudgetInput): Promise<void>;
  updateBudget(input: UpdateBudgetInput): Promise<void>;
  updateBudgetOrder(budgetIds: string[]): Promise<void>;
  archiveBudget(budgetId: string): Promise<void>;
  addRecurringItem(input: NewRecurringItemInput): Promise<void>;
  updateRecurringItem(input: UpdateRecurringItemInput): Promise<void>;
  createRecurringTransaction(input: CreateRecurringTransactionInput): Promise<void>;
  undoLatestRecurringTransaction(recurringItemId: string): Promise<void>;
  archiveRecurringItem(recurringItemId: string): Promise<void>;
  deleteRecurringItem(recurringItemId: string): Promise<void>;
  addTransactionTemplate(input: NewTransactionTemplateInput): Promise<void>;
  updateTransactionTemplate(input: UpdateTransactionTemplateInput): Promise<void>;
  archiveTransactionTemplate(templateId: string): Promise<void>;
  deleteTransactionTemplate(templateId: string): Promise<void>;
  updateRainyDayFund(input: UpdateRainyDayFundInput): Promise<void>;
  updateSettings(input: UpdateAppSettingsInput): Promise<void>;
  updateAddTransactionDefaults(input: UpdateAddTransactionDefaultsInput): Promise<void>;
  updateCategoryCatalog(input: UpdateCategoryCatalogInput): Promise<void>;
  updateDashboardCardSettings(input: UpdateDashboardCardSettingsInput): Promise<void>;
  updateDashboardSelectedAccountIds(accountIds: string[]): Promise<void>;
  updateAccountDashboardVisibility(accountId: string, showOnDashboard: boolean): Promise<void>;
  updateAccountOrder(accountIds: string[]): Promise<void>;
  closeAccount(accountId: string): Promise<void>;
  reopenAccount(accountId: string): Promise<void>;
  deleteAccount(accountId: string): Promise<void>;
  restoreBackup(backup: RainproofBackup): Promise<void>;
  refresh(): Promise<void>;
};

type MutationOptions = {
  label?: string;
  showSaving?: boolean;
  rethrow?: boolean;
};

export type RainproofDataState = {
  snapshot: AppSnapshot | null;
  derived: RainproofDerivedData;
  actions: RainproofActions;
  loading: boolean;
  saving: boolean;
  error: string;
};

const emptyDerived: RainproofDerivedData = {
  accountBalances: [],
  totalsByCurrency: [],
  rainyDayProgress: null,
  currentMonthSpending: [],
  budgetUsage: [],
  upcomingBills: [],
  cashFlow: null,
};

export function useRainproofData(): RainproofDataState {
  const repositoryRef = useRef<FinanceRepository | null>(null);
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository) {
      return;
    }

    const startedAt = Date.now();
    const nextSnapshot = await repository.getSnapshot();
    setSnapshot(nextSnapshot);
    logDevPerfDuration('rainproofData.refresh', startedAt, getSnapshotPerfCounts(nextSnapshot));
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        const repository = await createSQLiteFinanceRepository();
        await repository.initialize(getDeviceDefaultCurrencyCode());
        const nextSnapshot = await repository.getSnapshot();

        if (mounted) {
          repositoryRef.current = repository;
          setSnapshot(nextSnapshot);
          setError('');
        }
      } catch (caught) {
        if (mounted) {
          setError(caught instanceof Error ? caught.message : 'Could not load Rainproof.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const runMutation = useCallback(
    async (mutation: (repository: FinanceRepository) => Promise<void>, options: MutationOptions = {}) => {
      const repository = repositoryRef.current;
      if (!repository) {
        return;
      }

      const showSaving = options.showSaving !== false;
      const label = options.label ?? 'mutation';
      const startedAt = Date.now();

      try {
        if (showSaving) {
          setSaving(true);
        }
        const writeStartedAt = Date.now();
        await mutation(repository);
        logDevPerfDuration(`rainproofData.${label}.write`, writeStartedAt);
        await refresh();
        setError('');
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Something went wrong.';
        setError(message);
        if (options.rethrow) {
          throw new Error(message);
        }
      } finally {
        logDevPerfDuration(`rainproofData.${label}.total`, startedAt);
        if (showSaving) {
          setSaving(false);
        }
      }
    },
    [refresh],
  );

  const derived = useMemo<RainproofDerivedData>(() => {
    if (!snapshot) {
      return emptyDerived;
    }

    return timeDevPerf('rainproofData.derived', () => {
      const accountBalances = getAccountBalances(snapshot.accounts, snapshot.transactionLines);
      const totalsByCurrency = groupBalancesByCurrency(accountBalances);
      const rainyDayProgress = getRainyDayProgress(snapshot.rainyDayFund, accountBalances);
      const monthRange = getDateRangeForPreset('last_month');
      const currentCurrency = getEffectiveDisplayCurrency({
        defaultCurrencyCode: snapshot.defaultCurrencyCode,
        defaultCurrencyMode: snapshot.settings.defaultCurrencyMode,
        accountCurrencyCodes: snapshot.accounts.map((account) => account.currencyCode),
      });
      const currentMonthSpending = getSpendingByCategory({
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
        transactionLinks: snapshot.transactionLinks,
        range: monthRange,
        currencyCode: currentCurrency,
      });
      const budgetUsage = getBudgetUsagesForPeriods({
        accounts: snapshot.accounts,
        budgets: snapshot.budgets.filter((budget) => budget.currencyCode === currentCurrency),
        categories: snapshot.categories ?? defaultCategories,
        transactionLines: snapshot.transactionLines,
        transactionLinks: snapshot.transactionLinks,
        transactions: snapshot.transactions,
      });
      const upcomingBills = getUpcomingBills(snapshot.recurringItems);
      const cashFlow = getCashFlowSummary({
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
        transactionLinks: snapshot.transactionLinks,
        range: monthRange,
        currencyCode: currentCurrency,
      });

      return {
        accountBalances,
        totalsByCurrency,
        rainyDayProgress,
        currentMonthSpending,
        budgetUsage,
        upcomingBills,
        cashFlow,
      };
    }, getSnapshotPerfCounts(snapshot));
  }, [snapshot]);

  const actions = useMemo<RainproofActions>(
    () => ({
      addAccount: (input) => runMutation((repository) => repository.addAccount(input)),
      updateAccount: (input) => runMutation((repository) => repository.updateAccount(input)),
      addTransaction: (input, addTransactionDefaults) =>
        runMutation(async (repository) => {
          await repository.addTransaction(input);
          if (addTransactionDefaults) {
            await repository.updateAddTransactionDefaults({ addTransactionDefaults });
          }
        }, { label: 'addTransaction', rethrow: true }),
      updateTransaction: (input) =>
        runMutation((repository) => repository.updateTransaction(input), { label: 'updateTransaction', rethrow: true }),
      deleteTransaction: async (transactionId) => {
        const repository = repositoryRef.current;
        if (!repository) {
          return;
        }

        const startedAt = Date.now();
        try {
          setSaving(true);
          const writeStartedAt = Date.now();
          await repository.deleteTransaction(transactionId);
          logDevPerfDuration('rainproofData.deleteTransaction.write', writeStartedAt);
          await refresh();
          setError('');
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : 'Could not delete transaction.';
          setError(message);
          throw new Error(message);
        } finally {
          logDevPerfDuration('rainproofData.deleteTransaction.total', startedAt);
          setSaving(false);
        }
      },
      addTransactionLink: (input) =>
        runMutation((repository) => repository.addTransactionLink(input), { label: 'addTransactionLink', rethrow: true }),
      updateTransactionLink: (input) =>
        runMutation((repository) => repository.updateTransactionLink(input), {
          label: 'updateTransactionLink',
          rethrow: true,
        }),
      deleteTransactionLink: (linkId) =>
        runMutation((repository) => repository.deleteTransactionLink(linkId), {
          label: 'deleteTransactionLink',
          rethrow: true,
        }),
      addBudget: (input) => runMutation((repository) => repository.addBudget(input)),
      updateBudget: (input) => runMutation((repository) => repository.updateBudget(input)),
      updateBudgetOrder: (budgetIds) => runMutation((repository) => repository.updateBudgetOrder(budgetIds)),
      archiveBudget: (budgetId) => runMutation((repository) => repository.archiveBudget(budgetId)),
      addRecurringItem: (input) => runMutation((repository) => repository.addRecurringItem(input)),
      updateRecurringItem: (input) =>
        runMutation((repository) => repository.updateRecurringItem(input), { rethrow: true }),
      createRecurringTransaction: (input) =>
        runMutation((repository) => repository.createRecurringTransaction(input), { rethrow: true }),
      undoLatestRecurringTransaction: (recurringItemId) =>
        runMutation(async (repository) => {
          await repository.undoLatestRecurringTransaction(recurringItemId);
        }, { rethrow: true }),
      archiveRecurringItem: (recurringItemId) =>
        runMutation((repository) => repository.archiveRecurringItem(recurringItemId)),
      deleteRecurringItem: (recurringItemId) =>
        runMutation((repository) => repository.deleteRecurringItem(recurringItemId)),
      addTransactionTemplate: (input) =>
        runMutation((repository) => repository.addTransactionTemplate(input), {
          label: 'addTransactionTemplate',
          rethrow: true,
        }),
      updateTransactionTemplate: (input) =>
        runMutation((repository) => repository.updateTransactionTemplate(input), {
          label: 'updateTransactionTemplate',
          rethrow: true,
        }),
      archiveTransactionTemplate: (templateId) =>
        runMutation((repository) => repository.archiveTransactionTemplate(templateId), {
          label: 'archiveTransactionTemplate',
          rethrow: true,
        }),
      deleteTransactionTemplate: (templateId) =>
        runMutation((repository) => repository.deleteTransactionTemplate(templateId), {
          label: 'deleteTransactionTemplate',
          rethrow: true,
        }),
      updateRainyDayFund: (input) => runMutation((repository) => repository.updateRainyDayFund(input)),
      updateSettings: (input) => runMutation((repository) => repository.updateSettings(input)),
      updateAddTransactionDefaults: (input) =>
        runMutation((repository) => repository.updateAddTransactionDefaults(input), { showSaving: false }),
      updateCategoryCatalog: (input) => runMutation((repository) => repository.updateCategoryCatalog(input)),
      updateDashboardCardSettings: (input) =>
        runMutation((repository) => repository.updateDashboardCardSettings(input)),
      updateDashboardSelectedAccountIds: (accountIds) =>
        runMutation((repository) => repository.updateDashboardSelectedAccountIds(accountIds), { showSaving: false }),
      updateAccountDashboardVisibility: (accountId, showOnDashboard) =>
        runMutation((repository) => repository.updateAccountDashboardVisibility(accountId, showOnDashboard)),
      updateAccountOrder: (accountIds) => runMutation((repository) => repository.updateAccountOrder(accountIds)),
      closeAccount: (accountId) => runMutation((repository) => repository.closeAccount(accountId)),
      reopenAccount: (accountId) => runMutation((repository) => repository.reopenAccount(accountId)),
      deleteAccount: (accountId) => runMutation((repository) => repository.deleteAccount(accountId)),
      restoreBackup: (backup) => runMutation((repository) => repository.restoreBackup(backup), { rethrow: true }),
      refresh,
    }),
    [refresh, runMutation],
  );

  return {
    snapshot,
    derived,
    actions,
    loading,
    saving,
    error,
  };
}

function getSnapshotPerfCounts(snapshot: AppSnapshot) {
  return {
    accounts: snapshot.accounts.length,
    transactions: snapshot.transactions.length,
    lines: snapshot.transactionLines.length,
    links: snapshot.transactionLinks.length,
    budgets: snapshot.budgets.length,
    templates: snapshot.transactionTemplates.length,
    recurring: snapshot.recurringItems.length,
  };
}
