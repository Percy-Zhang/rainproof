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
import { logDevPerfDuration, timeDevPerf, timeDevPerfAsync } from '../performance';
import { createSQLiteFinanceRepository, type FinanceRepository } from '../storage/repository';
import { getDeviceDefaultCurrencyCode } from './deviceCurrency';
import {
  canPatchSnapshotAfterAddTransaction,
  canPatchSnapshotAfterDeleteTransaction,
  canPatchSnapshotAfterEditTransaction,
  getRollbackForDeleteTransaction,
  getRollbackForEditTransaction,
  isSnapshotAfterDeleteTransaction,
  patchSnapshotAfterDeleteTransactionWithRollback,
  patchSnapshotAfterEditTransactionWithRollback,
  patchSnapshotAfterAddTransaction,
  rollbackSnapshotAfterOptimisticDeleteTransaction,
  rollbackSnapshotAfterOptimisticEditTransaction,
  rollbackSnapshotAfterOptimisticAddTransaction,
  type OptimisticDeleteTransactionRollback,
  type OptimisticEditTransactionRollback,
} from './rainproofSnapshotPatches';

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
  updateTransaction(input: UpdateTransactionInput, options?: { optimistic?: boolean }): Promise<void>;
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

type MutationResult = {
  patchSnapshot?: (snapshot: AppSnapshot) => AppSnapshot | null;
};

type AddTransactionPersistenceRecords = ReturnType<FinanceRepository['prepareAddTransaction']>;
type UpdateTransactionPersistenceRecords = ReturnType<FinanceRepository['prepareUpdateTransaction']>;
type BackgroundWriteQueueRef = {
  current: Promise<void>;
};
type OptimisticTransactionActionLabel = 'addTransaction' | 'updateTransaction' | 'deleteTransaction';

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
  const snapshotRef = useRef<AppSnapshot | null>(null);
  const transactionWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
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
    snapshotRef.current = nextSnapshot;
    setSnapshot(nextSnapshot);
    logDevPerfDuration('rainproofData.refresh', startedAt, getSnapshotPerfCounts(nextSnapshot));
  }, []);

  const applySnapshotPatch = useCallback((patchSnapshot: (snapshot: AppSnapshot) => AppSnapshot | null) => {
    const currentSnapshot = snapshotRef.current;
    if (!currentSnapshot) {
      return null;
    }

    const nextSnapshot = patchSnapshot(currentSnapshot);
    if (!nextSnapshot) {
      return null;
    }

    snapshotRef.current = nextSnapshot;
    setSnapshot(nextSnapshot);
    return nextSnapshot;
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
          snapshotRef.current = nextSnapshot;
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
    async (mutation: (repository: FinanceRepository) => Promise<MutationResult | void>, options: MutationOptions = {}) => {
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
        const mutationResult = await mutation(repository);
        logDevPerfDuration(`rainproofData.${label}.write`, writeStartedAt);
        const refreshStartedAt = Date.now();
        let refreshMode: 'full' | 'patched' = 'full';
        if (mutationResult?.patchSnapshot) {
          const patchStartedAt = Date.now();
          try {
            const patchedSnapshot = applySnapshotPatch(mutationResult.patchSnapshot);
            if (patchedSnapshot) {
              refreshMode = 'patched';
              logDevPerfDuration(`rainproofData.${label}.patch`, patchStartedAt, getSnapshotPerfCounts(patchedSnapshot));
            }
          } catch {
            refreshMode = 'full';
          }
        }

        if (refreshMode === 'full') {
          await refresh();
        }
        logDevPerfDuration(`rainproofData.${label}.refresh`, refreshStartedAt, { refresh: refreshMode });
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
    [applySnapshotPatch, refresh],
  );

  const addTransactionOptimistically = useCallback(
    (input: NewTransactionInput, addTransactionDefaults?: AddTransactionDefaults): Promise<void> => {
      const repository = repositoryRef.current;
      if (!repository) {
        return Promise.resolve();
      }

      const metadata = getNewTransactionInputPerfMetadata(input);
      const startedAt = Date.now();

      try {
        const previousSnapshot = snapshotRef.current;
        if (!previousSnapshot) {
          return withFullRefreshActionTiming('addTransaction', startedAt, persistAddTransactionWithSaving({
            addTransactionDefaults,
            input,
            refresh,
            repository,
            setSaving,
          }));
        }

        const optimisticRecords = timeDevPerf(
          'rainproofData.addTransaction.optimisticBuild',
          () => repository.prepareAddTransaction(input),
          metadata,
        );
        const canPatchOptimistically = canPatchSnapshotAfterAddTransaction(previousSnapshot, {
          addTransactionDefaults,
          input,
          lines: optimisticRecords.lines,
          transaction: optimisticRecords.transaction,
        });

        if (!canPatchOptimistically) {
          return withFullRefreshActionTiming('addTransaction', startedAt, persistAddTransactionWithSaving({
            addTransactionDefaults,
            input,
            refresh,
            repository,
            setSaving,
          }));
        }

        scheduleOptimisticMutationTask(() => {
          applyAcceptedOptimisticAddTransaction({
            addTransactionDefaults,
            input,
            optimisticRecords,
            applySnapshotPatch,
            previousAddTransactionDefaults: previousSnapshot.settings.addTransactionDefaults,
            refresh,
            repository,
            setError,
            transactionWriteQueueRef,
          });
        });

        logDevPerfDuration('rainproofData.addTransaction.accepted', startedAt, { refresh: 'optimistic' });
        logDevPerfDuration('rainproofData.addTransaction.perceived', startedAt, { refresh: 'accepted' });
        logDevPerfDuration('rainproofData.addTransaction.total', startedAt);
        return Promise.resolve();
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Could not add transaction.';
        setError(message);
        return Promise.reject(new Error(message));
      }
    },
    [applySnapshotPatch, refresh],
  );

  const updateTransactionOptimistically = useCallback(
    (input: UpdateTransactionInput, options: { optimistic?: boolean } = {}): Promise<void> => {
      const repository = repositoryRef.current;
      if (!repository) {
        return Promise.resolve();
      }

      const metadata = getNewTransactionInputPerfMetadata(input);
      const startedAt = Date.now();

      try {
        if (options.optimistic === false) {
          return withFullRefreshActionTiming('updateTransaction', startedAt, persistUpdateTransactionWithSaving({
            input,
            refresh,
            repository,
            setSaving,
          }));
        }

        const previousSnapshot = snapshotRef.current;
        const existingTransaction = previousSnapshot?.transactions.find((transaction) => transaction.id === input.id);
        const existingLines = previousSnapshot?.transactionLines.filter((line) => line.transactionId === input.id) ?? [];
        if (!previousSnapshot || !existingTransaction || !existingLines.length) {
          return withFullRefreshActionTiming('updateTransaction', startedAt, persistUpdateTransactionWithSaving({
            input,
            refresh,
            repository,
            setSaving,
          }));
        }

        const optimisticRecords = timeDevPerf(
          'rainproofData.updateTransaction.optimisticBuild',
          () => repository.prepareUpdateTransaction(input, existingTransaction, existingLines),
          metadata,
        );
        const rollback = getRollbackForEditTransaction(previousSnapshot, input.id);
        const canPatchOptimistically = rollback &&
          canPatchSnapshotAfterEditTransaction(previousSnapshot, {
            input,
            ...optimisticRecords,
          });

        if (!rollback || !canPatchOptimistically) {
          return withFullRefreshActionTiming('updateTransaction', startedAt, persistUpdateTransactionWithSaving({
            input,
            refresh,
            repository,
            setSaving,
          }));
        }

        scheduleOptimisticMutationTask(() => {
          applyAcceptedOptimisticEditTransaction({
            applySnapshotPatch,
            input,
            optimisticRecords,
            refresh,
            repository,
            rollback,
            setError,
            transactionWriteQueueRef,
          });
        });

        logDevPerfDuration('rainproofData.updateTransaction.accepted', startedAt, {
          insertedLines: optimisticRecords.insertedLineIds.length,
          removedLines: optimisticRecords.removedLineIds.length,
          refresh: 'optimistic',
        });
        logDevPerfDuration('rainproofData.updateTransaction.perceived', startedAt, { refresh: 'accepted' });
        logDevPerfDuration('rainproofData.updateTransaction.total', startedAt);
        return Promise.resolve();
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Could not update transaction.';
        setError(message);
        return Promise.reject(new Error(message));
      }
    },
    [applySnapshotPatch, refresh],
  );

  const deleteTransactionOptimistically = useCallback(
    (transactionId: string): Promise<void> => {
      const repository = repositoryRef.current;
      if (!repository) {
        return Promise.resolve();
      }

      const startedAt = Date.now();

      try {
        const previousSnapshot = snapshotRef.current;
        if (!previousSnapshot || !canPatchSnapshotAfterDeleteTransaction(previousSnapshot, transactionId)) {
          return withFullRefreshActionTiming('deleteTransaction', startedAt, persistDeleteTransactionWithSaving({
            refresh,
            repository,
            setSaving,
            transactionId,
          }));
        }

        const rollback = getRollbackForDeleteTransaction(previousSnapshot, transactionId);
        if (!rollback) {
          return withFullRefreshActionTiming('deleteTransaction', startedAt, persistDeleteTransactionWithSaving({
            refresh,
            repository,
            setSaving,
            transactionId,
          }));
        }

        scheduleOptimisticMutationTask(() => {
          applyAcceptedOptimisticDeleteTransaction({
            applySnapshotPatch,
            getSnapshot: () => snapshotRef.current,
            refresh,
            repository,
            rollback,
            setError,
            transactionWriteQueueRef,
          });
        });

        logDevPerfDuration('rainproofData.deleteTransaction.accepted', startedAt, {
          links: rollback.links.length,
          lines: rollback.lines.length,
          refresh: 'optimistic',
        });
        logDevPerfDuration('rainproofData.deleteTransaction.perceived', startedAt, { refresh: 'accepted' });
        logDevPerfDuration('rainproofData.deleteTransaction.total', startedAt);
        return Promise.resolve();
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Could not delete transaction.';
        setError(message);
        return Promise.reject(new Error(message));
      }
    },
    [applySnapshotPatch, refresh],
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
      addTransaction: addTransactionOptimistically,
      updateTransaction: updateTransactionOptimistically,
      deleteTransaction: deleteTransactionOptimistically,
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
    [addTransactionOptimistically, deleteTransactionOptimistically, refresh, runMutation, updateTransactionOptimistically],
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

function getNewTransactionInputPerfMetadata(input: NewTransactionInput) {
  return {
    kind: input.kind,
    lines: input.lines.length,
    split: input.kind !== 'transfer' && input.lines.length > 1,
    transfer: input.kind === 'transfer',
    crossCurrencyTransfer: input.kind === 'transfer' && new Set(input.lines.map((line) => line.currencyCode)).size > 1,
  };
}

function enqueueBackgroundWrite(
  queueRef: BackgroundWriteQueueRef,
  write: () => Promise<void>,
): void {
  const nextWrite = queueRef.current.then(write, write);
  queueRef.current = nextWrite.catch(() => undefined);
  void nextWrite;
}

function scheduleOptimisticMutationTask(task: () => void): void {
  setTimeout(task, 0);
}

function withFullRefreshActionTiming<T>(
  label: OptimisticTransactionActionLabel,
  startedAt: number,
  action: Promise<T>,
): Promise<T> {
  return action.finally(() => {
    logDevPerfDuration(`rainproofData.${label}.perceived`, startedAt, { refresh: 'full' });
    logDevPerfDuration(`rainproofData.${label}.total`, startedAt);
  });
}

function applyAcceptedOptimisticAddTransaction({
  addTransactionDefaults,
  applySnapshotPatch,
  input,
  optimisticRecords,
  previousAddTransactionDefaults,
  refresh,
  repository,
  setError,
  transactionWriteQueueRef,
}: {
  addTransactionDefaults?: AddTransactionDefaults;
  applySnapshotPatch: (patchSnapshot: (snapshot: AppSnapshot) => AppSnapshot | null) => AppSnapshot | null;
  input: NewTransactionInput;
  optimisticRecords: AddTransactionPersistenceRecords;
  previousAddTransactionDefaults?: AddTransactionDefaults;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  setError: (message: string) => void;
  transactionWriteQueueRef: BackgroundWriteQueueRef;
}): void {
  const optimisticPatchStartedAt = Date.now();
  const optimisticSnapshot = applySnapshotPatch((currentSnapshot) =>
    patchSnapshotAfterAddTransaction(currentSnapshot, {
      addTransactionDefaults,
      input,
      lines: optimisticRecords.lines,
      transaction: optimisticRecords.transaction,
    }),
  );

  if (!optimisticSnapshot) {
    void persistAddTransactionWithFullRefresh({
      addTransactionDefaults,
      input,
      refresh,
      repository,
    }).catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'Could not save transaction.');
    });
    return;
  }

  logDevPerfDuration(
    'rainproofData.addTransaction.optimisticPatch',
    optimisticPatchStartedAt,
    getSnapshotPerfCounts(optimisticSnapshot),
  );
  setError('');

  enqueueBackgroundWrite(transactionWriteQueueRef, async () => {
    await persistOptimisticAddTransaction({
      addTransactionDefaults,
      input,
      optimisticRecords,
      refresh,
      repository,
      rollbackPatch: (records) => applySnapshotPatch((currentSnapshot) =>
        rollbackSnapshotAfterOptimisticAddTransaction(currentSnapshot, {
          lineIds: records.lines.map((line) => line.id),
          optimisticAddTransactionDefaults: addTransactionDefaults,
          previousAddTransactionDefaults,
          transactionId: records.transaction.id,
        }),
      ),
      setError,
    });
  });
}

function applyAcceptedOptimisticEditTransaction({
  applySnapshotPatch,
  input,
  optimisticRecords,
  refresh,
  repository,
  rollback,
  setError,
  transactionWriteQueueRef,
}: {
  applySnapshotPatch: (patchSnapshot: (snapshot: AppSnapshot) => AppSnapshot | null) => AppSnapshot | null;
  input: UpdateTransactionInput;
  optimisticRecords: UpdateTransactionPersistenceRecords;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  rollback: OptimisticEditTransactionRollback;
  setError: (message: string) => void;
  transactionWriteQueueRef: BackgroundWriteQueueRef;
}): void {
  const optimisticPatchStartedAt = Date.now();
  const optimisticSnapshot = applySnapshotPatch((currentSnapshot) =>
    patchSnapshotAfterEditTransactionWithRollback(currentSnapshot, {
      input,
      ...optimisticRecords,
    }, rollback),
  );

  if (!optimisticSnapshot) {
    void persistUpdateTransactionWithFullRefresh({
      input,
      refresh,
      repository,
    }).catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'Could not update transaction.');
    });
    return;
  }

  logDevPerfDuration(
    'rainproofData.updateTransaction.optimisticPatch',
    optimisticPatchStartedAt,
    {
      ...getSnapshotPerfCounts(optimisticSnapshot),
      insertedLines: optimisticRecords.insertedLineIds.length,
      removedLines: optimisticRecords.removedLineIds.length,
    },
  );
  setError('');

  enqueueBackgroundWrite(transactionWriteQueueRef, async () => {
    await persistOptimisticEditTransaction({
      input,
      optimisticRecords,
      refresh,
      repository,
      rollback,
      rollbackPatch: (editRollback, records) => applySnapshotPatch((currentSnapshot) =>
        rollbackSnapshotAfterOptimisticEditTransaction(currentSnapshot, editRollback, {
          input,
          ...records,
        }),
      ),
      setError,
    });
  });
}

function applyAcceptedOptimisticDeleteTransaction({
  applySnapshotPatch,
  getSnapshot,
  refresh,
  repository,
  rollback,
  setError,
  transactionWriteQueueRef,
}: {
  applySnapshotPatch: (patchSnapshot: (snapshot: AppSnapshot) => AppSnapshot | null) => AppSnapshot | null;
  getSnapshot: () => AppSnapshot | null;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  rollback: OptimisticDeleteTransactionRollback;
  setError: (message: string) => void;
  transactionWriteQueueRef: BackgroundWriteQueueRef;
}): void {
  const optimisticPatchStartedAt = Date.now();
  const optimisticSnapshot = applySnapshotPatch((currentSnapshot) =>
    patchSnapshotAfterDeleteTransactionWithRollback(currentSnapshot, rollback),
  );

  if (!optimisticSnapshot) {
    void persistDeleteTransactionWithFullRefresh({
      refresh,
      repository,
      transactionId: rollback.transaction.item.id,
    }).catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'Could not delete transaction.');
    });
    return;
  }

  logDevPerfDuration(
    'rainproofData.deleteTransaction.optimisticPatch',
    optimisticPatchStartedAt,
    {
      ...getSnapshotPerfCounts(optimisticSnapshot),
      linksRemoved: rollback.links.length,
      linesRemoved: rollback.lines.length,
    },
  );
  setError('');

  enqueueBackgroundWrite(transactionWriteQueueRef, async () => {
    await persistOptimisticDeleteTransaction({
      getSnapshot,
      refresh,
      repository,
      rollback,
      rollbackPatch: (deleteRollback) => applySnapshotPatch((currentSnapshot) =>
        rollbackSnapshotAfterOptimisticDeleteTransaction(currentSnapshot, deleteRollback),
      ),
      setError,
    });
  });
}

async function persistDeleteTransactionWithSaving({
  refresh,
  repository,
  setSaving,
  transactionId,
}: {
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  setSaving: (saving: boolean) => void;
  transactionId: string;
}): Promise<void> {
  try {
    setSaving(true);
    await persistDeleteTransactionWithFullRefresh({
      refresh,
      repository,
      transactionId,
    });
  } finally {
    setSaving(false);
  }
}

async function persistDeleteTransactionWithFullRefresh({
  refresh,
  repository,
  transactionId,
}: {
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  transactionId: string;
}): Promise<void> {
  await timeDevPerfAsync(
    'rainproofData.deleteTransaction.repositoryDelete',
    () => repository.deleteTransaction(transactionId),
  );
  await refresh();
}

async function persistUpdateTransactionWithSaving({
  input,
  refresh,
  repository,
  setSaving,
}: {
  input: UpdateTransactionInput;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  setSaving: (saving: boolean) => void;
}): Promise<void> {
  try {
    setSaving(true);
    await persistUpdateTransactionWithFullRefresh({
      input,
      refresh,
      repository,
    });
  } finally {
    setSaving(false);
  }
}

async function persistUpdateTransactionWithFullRefresh({
  input,
  refresh,
  repository,
}: {
  input: UpdateTransactionInput;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
}): Promise<void> {
  await timeDevPerfAsync(
    'rainproofData.updateTransaction.repositoryUpdate',
    () => repository.updateTransaction(input),
    getNewTransactionInputPerfMetadata(input),
  );
  await refresh();
}

async function persistOptimisticEditTransaction({
  input,
  optimisticRecords,
  refresh,
  repository,
  rollback,
  rollbackPatch,
  setError,
}: {
  input: UpdateTransactionInput;
  optimisticRecords: UpdateTransactionPersistenceRecords;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  rollback: OptimisticEditTransactionRollback;
  rollbackPatch: (
    rollback: OptimisticEditTransactionRollback,
    records: UpdateTransactionPersistenceRecords,
  ) => AppSnapshot | null;
  setError: (message: string) => void;
}): Promise<void> {
  let transactionPersisted = false;

  try {
    const persistedRecords = await timeDevPerfAsync(
      'rainproofData.updateTransaction.backgroundWrite',
      async () => {
        const records = await timeDevPerfAsync(
          'rainproofData.updateTransaction.repositoryUpdate',
          () => repository.updateTransaction(input, optimisticRecords),
          getNewTransactionInputPerfMetadata(input),
        );
        transactionPersisted = true;
        return records;
      },
      getNewTransactionInputPerfMetadata(input),
    );

    const reconcileStartedAt = Date.now();
    if (areUpdateTransactionPersistenceRecordsEqual(persistedRecords, optimisticRecords)) {
      logDevPerfDuration('rainproofData.updateTransaction.reconcile', reconcileStartedAt, { refresh: 'none' });
      return;
    }

    await refresh();
    logDevPerfDuration('rainproofData.updateTransaction.reconcile', reconcileStartedAt, { refresh: 'full' });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Could not update transaction.';

    if (transactionPersisted) {
      const refreshStartedAt = Date.now();
      await refresh();
      logDevPerfDuration('rainproofData.updateTransaction.rollback', refreshStartedAt, { refresh: 'full' });
      setError(message);
      return;
    }

    const rollbackStartedAt = Date.now();
    const rolledBackSnapshot = rollbackPatch(rollback, optimisticRecords);
    if (rolledBackSnapshot) {
      logDevPerfDuration(
        'rainproofData.updateTransaction.rollback',
        rollbackStartedAt,
        {
          ...getSnapshotPerfCounts(rolledBackSnapshot),
          refresh: 'patched',
        },
      );
    } else {
      await refresh();
      logDevPerfDuration('rainproofData.updateTransaction.rollback', rollbackStartedAt, { refresh: 'full' });
    }
    setError(message);
  }
}

async function persistOptimisticDeleteTransaction({
  getSnapshot,
  refresh,
  repository,
  rollback,
  rollbackPatch,
  setError,
}: {
  getSnapshot: () => AppSnapshot | null;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  rollback: OptimisticDeleteTransactionRollback;
  rollbackPatch: (rollback: OptimisticDeleteTransactionRollback) => AppSnapshot | null;
  setError: (message: string) => void;
}): Promise<void> {
  try {
    await timeDevPerfAsync(
      'rainproofData.deleteTransaction.backgroundWrite',
      () => repository.deleteTransaction(rollback.transaction.item.id),
      {
        links: rollback.links.length,
        lines: rollback.lines.length,
      },
    );

    const reconcileStartedAt = Date.now();
    const currentSnapshot = getSnapshot();
    if (currentSnapshot && isSnapshotAfterDeleteTransaction(currentSnapshot, rollback)) {
      logDevPerfDuration('rainproofData.deleteTransaction.reconcile', reconcileStartedAt, { refresh: 'none' });
      return;
    }

    await refresh();
    logDevPerfDuration('rainproofData.deleteTransaction.reconcile', reconcileStartedAt, { refresh: 'full' });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Could not delete transaction.';
    const rollbackStartedAt = Date.now();
    const rolledBackSnapshot = rollbackPatch(rollback);
    if (rolledBackSnapshot) {
      logDevPerfDuration(
        'rainproofData.deleteTransaction.rollback',
        rollbackStartedAt,
        {
          ...getSnapshotPerfCounts(rolledBackSnapshot),
          refresh: 'patched',
        },
      );
    } else {
      await refresh();
      logDevPerfDuration('rainproofData.deleteTransaction.rollback', rollbackStartedAt, { refresh: 'full' });
    }
    setError(message);
  }
}

async function persistAddTransactionWithSaving({
  addTransactionDefaults,
  input,
  refresh,
  repository,
  setSaving,
}: {
  addTransactionDefaults?: AddTransactionDefaults;
  input: NewTransactionInput;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  setSaving: (saving: boolean) => void;
}): Promise<void> {
  try {
    setSaving(true);
    await persistAddTransactionWithFullRefresh({
      addTransactionDefaults,
      input,
      refresh,
      repository,
    });
  } finally {
    setSaving(false);
  }
}

async function persistAddTransactionWithFullRefresh({
  addTransactionDefaults,
  input,
  refresh,
  repository,
}: {
  addTransactionDefaults?: AddTransactionDefaults;
  input: NewTransactionInput;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
}): Promise<void> {
  await persistAddTransactionRecords({
    addTransactionDefaults,
    input,
    repository,
  });
  await refresh();
}

async function persistOptimisticAddTransaction({
  addTransactionDefaults,
  input,
  optimisticRecords,
  refresh,
  repository,
  rollbackPatch,
  setError,
}: {
  addTransactionDefaults?: AddTransactionDefaults;
  input: NewTransactionInput;
  optimisticRecords: AddTransactionPersistenceRecords;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  rollbackPatch: (records: AddTransactionPersistenceRecords) => AppSnapshot | null;
  setError: (message: string) => void;
}): Promise<void> {
  let transactionPersisted = false;

  try {
    const persistedRecords = await timeDevPerfAsync(
      'rainproofData.addTransaction.backgroundWrite',
      async () => {
        const records = await timeDevPerfAsync(
          'rainproofData.addTransaction.repositoryAdd',
          () => repository.addTransaction(input, optimisticRecords),
          getNewTransactionInputPerfMetadata(input),
        );
        transactionPersisted = true;

        if (addTransactionDefaults) {
          await timeDevPerfAsync(
            'rainproofData.addTransaction.defaultsWrite',
            () => repository.updateAddTransactionDefaults({ addTransactionDefaults }),
            {
              hasAccountDefault: Boolean(addTransactionDefaults.lastManualAccountId),
              categoryDefaults: Object.keys(addTransactionDefaults.lastCategoryByKind ?? {}).length,
            },
          );
        }

        return records;
      },
      getNewTransactionInputPerfMetadata(input),
    );

    const reconcileStartedAt = Date.now();
    if (areAddTransactionPersistenceRecordsEqual(persistedRecords, optimisticRecords)) {
      logDevPerfDuration('rainproofData.addTransaction.reconcile', reconcileStartedAt, { refresh: 'none' });
      return;
    }

    await refresh();
    logDevPerfDuration('rainproofData.addTransaction.reconcile', reconcileStartedAt, { refresh: 'full' });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Could not save transaction.';

    if (transactionPersisted) {
      const refreshStartedAt = Date.now();
      await refresh();
      logDevPerfDuration('rainproofData.addTransaction.rollback', refreshStartedAt, { refresh: 'full' });
      setError(message);
      return;
    }

    const rollbackStartedAt = Date.now();
    const rolledBackSnapshot = rollbackPatch(optimisticRecords);
    if (rolledBackSnapshot) {
      logDevPerfDuration(
        'rainproofData.addTransaction.rollback',
        rollbackStartedAt,
        {
          ...getSnapshotPerfCounts(rolledBackSnapshot),
          refresh: 'patched',
        },
      );
    } else {
      await refresh();
      logDevPerfDuration('rainproofData.addTransaction.rollback', rollbackStartedAt, { refresh: 'full' });
    }
    setError(message);
  }
}

async function persistAddTransactionRecords({
  addTransactionDefaults,
  input,
  records,
  repository,
}: {
  addTransactionDefaults?: AddTransactionDefaults;
  input: NewTransactionInput;
  records?: AddTransactionPersistenceRecords;
  repository: FinanceRepository;
}): Promise<AddTransactionPersistenceRecords> {
  const persistedRecords = await timeDevPerfAsync(
    'rainproofData.addTransaction.repositoryAdd',
    () => repository.addTransaction(input, records),
    getNewTransactionInputPerfMetadata(input),
  );

  if (addTransactionDefaults) {
    await timeDevPerfAsync(
      'rainproofData.addTransaction.defaultsWrite',
      () => repository.updateAddTransactionDefaults({ addTransactionDefaults }),
      {
        hasAccountDefault: Boolean(addTransactionDefaults.lastManualAccountId),
        categoryDefaults: Object.keys(addTransactionDefaults.lastCategoryByKind ?? {}).length,
      },
    );
  }

  return persistedRecords;
}

function areAddTransactionPersistenceRecordsEqual(
  left: AddTransactionPersistenceRecords,
  right: AddTransactionPersistenceRecords,
): boolean {
  return JSON.stringify(left.transaction) === JSON.stringify(right.transaction) &&
    JSON.stringify(left.lines) === JSON.stringify(right.lines);
}

function areUpdateTransactionPersistenceRecordsEqual(
  left: UpdateTransactionPersistenceRecords,
  right: UpdateTransactionPersistenceRecords,
): boolean {
  return JSON.stringify(left.transaction) === JSON.stringify(right.transaction) &&
    JSON.stringify(left.lines) === JSON.stringify(right.lines) &&
    JSON.stringify(left.removedLineIds) === JSON.stringify(right.removedLineIds) &&
    JSON.stringify(left.insertedLineIds) === JSON.stringify(right.insertedLineIds) &&
    JSON.stringify(left.updatedLineIds) === JSON.stringify(right.updatedLineIds);
}
