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
import { getUniqueOrderedIds, haveIdsInSameOrder } from '../domain/reorder';
import type {
  AccountBalance,
  AddTransactionDefaults,
  AppSnapshot,
  BudgetUsage,
  CashFlowSummary,
  CreateUpcomingPaymentTransactionInput,
  CurrencyTotal,
  NewAccountInput,
  NewBudgetInput,
  NewRecurringItemInput,
  NewTransactionTemplateInput,
  NewTransactionLinkInput,
  NewTransactionInput,
  RainyDayProgress,
  SpendingByCategory,
  TransactionLinkBatchInput,
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
import type {
  BackupRestoreProgressReporter,
  RainproofBackup,
} from '../domain/backupExport';
import { logDevPerfDuration, timeDevPerf, timeDevPerfAsync } from '../performance';
import { createSQLiteFinanceRepository, type FinanceRepository } from '../storage/repository';
import { getDeviceDefaultCurrencyCode } from './deviceCurrency';
import {
  canPatchSnapshotAfterAddTransaction,
  canPatchSnapshotAfterAddTransactionLink,
  canPatchSnapshotAfterDeleteTransaction,
  canPatchSnapshotAfterTransactionLinkBatch,
  canPatchSnapshotAfterUpdateTransactionLink,
  getRollbackForRecurringItemStateChange,
  getRollbackForDeleteTransaction,
  getRollbackForDeleteTransactionLink,
  getRollbackForEditTransaction,
  getRollbackForTransactionLinkBatch,
  getRollbackForUpdateTransactionLink,
  isSnapshotAfterDeleteTransaction,
  patchSnapshotAfterAddTransactionLink,
  patchSnapshotAfterDeleteTransactionWithRollback,
  patchSnapshotAfterEditTransactionWithRollback,
  patchSnapshotAfterDeleteTransactionLinkWithRollback,
  patchSnapshotAfterRecurringItemStateChangeWithRollback,
  patchSnapshotAfterTransactionLinkBatchWithRollback,
  patchSnapshotAfterUpdateTransactionLinkWithRollback,
  patchSnapshotAfterAddTransaction,
  rollbackSnapshotAfterOptimisticAddTransactionLink,
  rollbackSnapshotAfterOptimisticDeleteTransaction,
  rollbackSnapshotAfterOptimisticDeleteTransactionLink,
  rollbackSnapshotAfterOptimisticEditTransaction,
  rollbackSnapshotAfterOptimisticRecurringItemStateChange,
  rollbackSnapshotAfterOptimisticTransactionLinkBatch,
  rollbackSnapshotAfterOptimisticUpdateTransactionLink,
  rollbackSnapshotAfterOptimisticAddTransaction,
  type OptimisticDeleteTransactionRollback,
  type OptimisticEditTransactionRollback,
  type OptimisticRecurringItemStateRollback,
  type OptimisticTransactionLinkBatchRollback,
  type OptimisticTransactionLinkRollback,
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
  updateTransaction(input: UpdateTransactionInput, options?: UpdateTransactionMutationOptions): Promise<void>;
  deleteTransaction(transactionId: string): Promise<void>;
  addTransactionLink(input: NewTransactionLinkInput, options?: TransactionLinkMutationOptions): Promise<void>;
  updateTransactionLink(input: UpdateTransactionLinkInput, options?: TransactionLinkMutationOptions): Promise<void>;
  deleteTransactionLink(linkId: string, options?: TransactionLinkMutationOptions): Promise<void>;
  saveTransactionLinkBatch(input: TransactionLinkBatchInput): Promise<void>;
  addBudget(input: NewBudgetInput): Promise<void>;
  updateBudget(input: UpdateBudgetInput): Promise<void>;
  updateBudgetOrder(budgetIds: string[]): Promise<void>;
  archiveBudget(budgetId: string): Promise<void>;
  addRecurringItem(input: NewRecurringItemInput): Promise<void>;
  updateRecurringItem(input: UpdateRecurringItemInput): Promise<void>;
  updateUpcomingPaymentDueDate(input: UpdateRecurringItemInput): Promise<void>;
  createUpcomingPaymentTransaction(input: CreateUpcomingPaymentTransactionInput): Promise<void>;
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
  restoreBackup(
    backup: RainproofBackup,
    onProgress?: BackupRestoreProgressReporter,
  ): Promise<void>;
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
type AddTransactionLinkPersistenceRecord = ReturnType<FinanceRepository['prepareAddTransactionLink']>;
type UpdateTransactionLinkPersistenceRecord = ReturnType<FinanceRepository['prepareUpdateTransactionLink']>;
type TransactionLinkBatchPersistenceRecords = ReturnType<FinanceRepository['prepareTransactionLinkBatch']>;
type BackgroundWriteQueueRef = {
  current: Promise<void>;
};
type TransactionLinkMutationOptions = {
  optimistic?: boolean;
};
type UpdateTransactionMutationOptions = {
  optimistic?: boolean;
  transactionLinkBatch?: TransactionLinkBatchInput;
  transactionLinkDeleteIds?: string[];
};
type OptimisticTransactionActionLabel =
  | 'addTransaction'
  | 'createUpcomingPaymentTransaction'
  | 'updateTransaction'
  | 'deleteTransaction'
  | 'addTransactionLink'
  | 'updateTransactionLink'
  | 'deleteTransactionLink'
  | 'saveTransactionLinkBatch'
  | 'updateUpcomingPaymentDueDate';

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
  const dashboardSelectedAccountIdsWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const dashboardSelectedAccountIdsUpdateTokenRef = useRef(0);
  const budgetOrderWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const budgetOrderUpdateTokenRef = useRef(0);
  const accountOrderWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const accountOrderUpdateTokenRef = useRef(0);
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
    logDevPerfDuration('rainproofData.refresh', startedAt, () => getSnapshotPerfCounts(nextSnapshot));
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
              logDevPerfDuration(`rainproofData.${label}.patch`, patchStartedAt, () => getSnapshotPerfCounts(patchedSnapshot));
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
    (input: UpdateTransactionInput, options: UpdateTransactionMutationOptions = {}): Promise<void> => {
      const repository = repositoryRef.current;
      if (!repository) {
        return Promise.resolve();
      }

      const metadata = getNewTransactionInputPerfMetadata(input);
      const startedAt = Date.now();

      try {
        if (
          options.optimistic === false ||
          options.transactionLinkDeleteIds?.length
        ) {
          return withFullRefreshActionTiming('updateTransaction', startedAt, persistUpdateTransactionWithSaving({
            input,
            refresh,
            repository,
            setSaving,
            transactionLinkBatch: options.transactionLinkBatch,
            transactionLinkDeleteIds: options.transactionLinkDeleteIds,
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
            transactionLinkBatch: options.transactionLinkBatch,
          }));
        }

        const optimisticRecords = timeDevPerf(
          'rainproofData.updateTransaction.optimisticBuild',
          () => repository.prepareUpdateTransaction(input, existingTransaction, existingLines),
          metadata,
        );
        const rollback = getRollbackForEditTransaction(previousSnapshot, input.id);
        const transactionPatch = { input, ...optimisticRecords };
        const transactionLinkBatch = options.transactionLinkBatch &&
          hasTransactionLinkBatchChanges(options.transactionLinkBatch)
          ? options.transactionLinkBatch
          : undefined;
        const projectedTransactionSnapshot = rollback
          ? patchSnapshotAfterEditTransactionWithRollback(previousSnapshot, transactionPatch, rollback)
          : null;
        let optimisticLinkRecords: TransactionLinkBatchPersistenceRecords | undefined;
        let linkRollback: OptimisticTransactionLinkBatchRollback | undefined;
        let canPatchOptimistically = Boolean(projectedTransactionSnapshot);

        if (
          projectedTransactionSnapshot &&
          transactionLinkBatch
        ) {
          optimisticLinkRecords = timeDevPerf(
            'rainproofData.updateTransaction.linkBatchOptimisticBuild',
            () => repository.prepareTransactionLinkBatch(
              transactionLinkBatch,
              projectedTransactionSnapshot,
            ),
            getTransactionLinkBatchPerfMetadata(transactionLinkBatch),
          );
          linkRollback = getRollbackForTransactionLinkBatch(
            projectedTransactionSnapshot,
            optimisticLinkRecords,
          ) ?? undefined;
          const snapshotWithLinks = linkRollback
            ? patchSnapshotAfterTransactionLinkBatchWithRollback(
                projectedTransactionSnapshot,
                optimisticLinkRecords,
                linkRollback,
              )
            : null;
          canPatchOptimistically = Boolean(snapshotWithLinks);
        }

        if (!rollback || !canPatchOptimistically) {
          return withFullRefreshActionTiming('updateTransaction', startedAt, persistUpdateTransactionWithSaving({
            input,
            refresh,
            repository,
            setSaving,
            transactionLinkBatch,
          }));
        }

        scheduleOptimisticMutationTask(() => {
          applyAcceptedOptimisticEditTransaction({
            applySnapshotPatch,
            input,
            optimisticRecords,
            optimisticLinkRecords,
            refresh,
            repository,
            rollback,
            linkRollback,
            setError,
            transactionLinkBatch,
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

  const addTransactionLinkOptimistically = useCallback(
    (input: NewTransactionLinkInput, options: TransactionLinkMutationOptions = {}): Promise<void> => {
      const repository = repositoryRef.current;
      if (!repository) {
        return Promise.resolve();
      }

      const metadata = getTransactionLinkInputPerfMetadata(input);
      const startedAt = Date.now();

      try {
        if (options.optimistic === false) {
          return withFullRefreshActionTiming('addTransactionLink', startedAt, persistAddTransactionLinkWithSaving({
            input,
            refresh,
            repository,
            setSaving,
          }));
        }

        const previousSnapshot = snapshotRef.current;
        if (!previousSnapshot) {
          return withFullRefreshActionTiming('addTransactionLink', startedAt, persistAddTransactionLinkWithSaving({
            input,
            refresh,
            repository,
            setSaving,
          }));
        }

        const optimisticLink = timeDevPerf(
          'rainproofData.addTransactionLink.optimisticBuild',
          () => repository.prepareAddTransactionLink(input, previousSnapshot),
          metadata,
        );
        if (!canPatchSnapshotAfterAddTransactionLink(previousSnapshot, optimisticLink)) {
          return withFullRefreshActionTiming('addTransactionLink', startedAt, persistAddTransactionLinkWithSaving({
            input,
            refresh,
            repository,
            setSaving,
          }));
        }

        scheduleOptimisticMutationTask(() => {
          applyAcceptedOptimisticAddTransactionLink({
            applySnapshotPatch,
            input,
            optimisticLink,
            refresh,
            repository,
            setError,
            transactionWriteQueueRef,
          });
        });

        logDevPerfDuration('rainproofData.addTransactionLink.accepted', startedAt, {
          ...metadata,
          refresh: 'optimistic',
        });
        logDevPerfDuration('rainproofData.addTransactionLink.perceived', startedAt, { refresh: 'accepted' });
        logDevPerfDuration('rainproofData.addTransactionLink.total', startedAt);
        return Promise.resolve();
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Could not link transaction.';
        setError(message);
        return Promise.reject(new Error(message));
      }
    },
    [applySnapshotPatch, refresh],
  );

  const updateTransactionLinkOptimistically = useCallback(
    (input: UpdateTransactionLinkInput, options: TransactionLinkMutationOptions = {}): Promise<void> => {
      const repository = repositoryRef.current;
      if (!repository) {
        return Promise.resolve();
      }

      const metadata = getTransactionLinkInputPerfMetadata(input);
      const startedAt = Date.now();

      try {
        if (options.optimistic === false) {
          return withFullRefreshActionTiming('updateTransactionLink', startedAt, persistUpdateTransactionLinkWithSaving({
            input,
            refresh,
            repository,
            setSaving,
          }));
        }

        const previousSnapshot = snapshotRef.current;
        const existingLink = previousSnapshot?.transactionLinks.find((link) => link.id === input.id);
        const rollback = previousSnapshot ? getRollbackForUpdateTransactionLink(previousSnapshot, input.id) : null;
        if (!previousSnapshot || !existingLink || !rollback) {
          return withFullRefreshActionTiming('updateTransactionLink', startedAt, persistUpdateTransactionLinkWithSaving({
            input,
            refresh,
            repository,
            setSaving,
          }));
        }

        const optimisticLink = timeDevPerf(
          'rainproofData.updateTransactionLink.optimisticBuild',
          () => repository.prepareUpdateTransactionLink(input, existingLink, previousSnapshot),
          metadata,
        );
        if (!canPatchSnapshotAfterUpdateTransactionLink(previousSnapshot, optimisticLink, rollback)) {
          return withFullRefreshActionTiming('updateTransactionLink', startedAt, persistUpdateTransactionLinkWithSaving({
            input,
            refresh,
            repository,
            setSaving,
          }));
        }

        scheduleOptimisticMutationTask(() => {
          applyAcceptedOptimisticUpdateTransactionLink({
            applySnapshotPatch,
            input,
            optimisticLink,
            refresh,
            repository,
            rollback,
            setError,
            transactionWriteQueueRef,
          });
        });

        logDevPerfDuration('rainproofData.updateTransactionLink.accepted', startedAt, {
          ...metadata,
          refresh: 'optimistic',
        });
        logDevPerfDuration('rainproofData.updateTransactionLink.perceived', startedAt, { refresh: 'accepted' });
        logDevPerfDuration('rainproofData.updateTransactionLink.total', startedAt);
        return Promise.resolve();
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Could not update transaction link.';
        setError(message);
        return Promise.reject(new Error(message));
      }
    },
    [applySnapshotPatch, refresh],
  );

  const deleteTransactionLinkOptimistically = useCallback(
    (linkId: string, options: TransactionLinkMutationOptions = {}): Promise<void> => {
      const repository = repositoryRef.current;
      if (!repository) {
        return Promise.resolve();
      }

      const startedAt = Date.now();

      try {
        if (options.optimistic === false) {
          return withFullRefreshActionTiming('deleteTransactionLink', startedAt, persistDeleteTransactionLinkWithSaving({
            linkId,
            refresh,
            repository,
            setSaving,
          }));
        }

        const previousSnapshot = snapshotRef.current;
        const rollback = previousSnapshot ? getRollbackForDeleteTransactionLink(previousSnapshot, linkId) : null;
        if (!previousSnapshot || !rollback) {
          return withFullRefreshActionTiming('deleteTransactionLink', startedAt, persistDeleteTransactionLinkWithSaving({
            linkId,
            refresh,
            repository,
            setSaving,
          }));
        }

        scheduleOptimisticMutationTask(() => {
          applyAcceptedOptimisticDeleteTransactionLink({
            applySnapshotPatch,
            refresh,
            repository,
            rollback,
            setError,
            transactionWriteQueueRef,
          });
        });

        logDevPerfDuration('rainproofData.deleteTransactionLink.accepted', startedAt, {
          lineLevel: Boolean(rollback.item.sourceLineId || rollback.item.targetLineId),
          refresh: 'optimistic',
        });
        logDevPerfDuration('rainproofData.deleteTransactionLink.perceived', startedAt, { refresh: 'accepted' });
        logDevPerfDuration('rainproofData.deleteTransactionLink.total', startedAt);
        return Promise.resolve();
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Could not unlink transaction.';
        setError(message);
        return Promise.reject(new Error(message));
      }
    },
    [applySnapshotPatch, refresh],
  );

  const saveTransactionLinkBatchOptimistically = useCallback(
    (input: TransactionLinkBatchInput): Promise<void> => {
      const repository = repositoryRef.current;
      if (!repository) {
        return Promise.resolve();
      }

      const metadata = getTransactionLinkBatchPerfMetadata(input);
      const startedAt = Date.now();

      try {
        const previousSnapshot = snapshotRef.current;
        if (!previousSnapshot) {
          logDevPerfDuration('rainproofData.saveTransactionLinkBatch.fallback', startedAt, {
            ...metadata,
            reason: 'missing-snapshot',
          });
          return withFullRefreshActionTiming('saveTransactionLinkBatch', startedAt, persistTransactionLinkBatchWithSaving({
            input,
            refresh,
            repository,
            setSaving,
          }));
        }

        const optimisticRecords = timeDevPerf(
          'rainproofData.saveTransactionLinkBatch.optimisticBuild',
          () => repository.prepareTransactionLinkBatch(input, previousSnapshot),
          metadata,
        );
        const rollback = getRollbackForTransactionLinkBatch(previousSnapshot, optimisticRecords);
        const canPatchOptimistically = rollback &&
          canPatchSnapshotAfterTransactionLinkBatch(previousSnapshot, optimisticRecords, rollback);

        if (!rollback || !canPatchOptimistically) {
          logDevPerfDuration('rainproofData.saveTransactionLinkBatch.fallback', startedAt, {
            ...metadata,
            reason: rollback ? 'unsafe-patch' : 'missing-rollback',
          });
          return withFullRefreshActionTiming('saveTransactionLinkBatch', startedAt, persistTransactionLinkBatchWithSaving({
            input,
            refresh,
            repository,
            setSaving,
          }));
        }

        scheduleOptimisticMutationTask(() => {
          applyAcceptedOptimisticTransactionLinkBatch({
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

        logDevPerfDuration('rainproofData.saveTransactionLinkBatch.accepted', startedAt, {
          ...metadata,
          refresh: 'optimistic',
        });
        logDevPerfDuration('rainproofData.saveTransactionLinkBatch.perceived', startedAt, { refresh: 'accepted' });
        logDevPerfDuration('rainproofData.saveTransactionLinkBatch.total', startedAt);
        return Promise.resolve();
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Could not save transaction links.';
        setError(message);
        return Promise.reject(new Error(message));
      }
    },
    [applySnapshotPatch, refresh],
  );

  const updateUpcomingPaymentDueDateOptimistically = useCallback(
    (input: UpdateRecurringItemInput): Promise<void> => {
      const repository = repositoryRef.current;
      const previousSnapshot = snapshotRef.current;
      const startedAt = Date.now();

      if (!repository) {
        return Promise.resolve();
      }

      if (!previousSnapshot) {
        return withFullRefreshActionTiming(
          'updateUpcomingPaymentDueDate',
          startedAt,
          persistRecurringItemUpdateWithSaving({ input, refresh, repository, setSaving }),
        );
      }

      const rollback = getRollbackForRecurringItemStateChange(previousSnapshot, input.id);
      if (!rollback) {
        return withFullRefreshActionTiming(
          'updateUpcomingPaymentDueDate',
          startedAt,
          persistRecurringItemUpdateWithSaving({ input, refresh, repository, setSaving }),
        );
      }

      scheduleOptimisticMutationTask(() => {
        applyAcceptedOptimisticUpcomingPaymentDueDate({
          applySnapshotPatch,
          input,
          refresh,
          repository,
          rollback,
          setError,
          transactionWriteQueueRef,
        });
      });

      logDevPerfDuration('rainproofData.updateUpcomingPaymentDueDate.accepted', startedAt, { refresh: 'optimistic' });
      logDevPerfDuration('rainproofData.updateUpcomingPaymentDueDate.perceived', startedAt, { refresh: 'accepted' });
      logDevPerfDuration('rainproofData.updateUpcomingPaymentDueDate.total', startedAt);
      return Promise.resolve();
    },
    [applySnapshotPatch, refresh],
  );

  const createUpcomingPaymentTransactionOptimistically = useCallback(
    (input: CreateUpcomingPaymentTransactionInput): Promise<void> => {
      const repository = repositoryRef.current;
      const previousSnapshot = snapshotRef.current;
      const startedAt = Date.now();

      if (!repository) {
        return Promise.resolve();
      }

      if (!previousSnapshot) {
        return withFullRefreshActionTiming(
          'createUpcomingPaymentTransaction',
          startedAt,
          persistUpcomingPaymentTransactionWithSaving({ input, refresh, repository, setSaving }),
        );
      }

      try {
        const optimisticRecords = timeDevPerf(
          'rainproofData.createUpcomingPaymentTransaction.optimisticBuild',
          () => repository.prepareAddTransaction(input.transactionInput),
          getNewTransactionInputPerfMetadata(input.transactionInput),
        );
        const rollback = getRollbackForRecurringItemStateChange(previousSnapshot, input.recurringItemId);
        const canPatchOptimistically = rollback &&
          canPatchSnapshotAfterAddTransaction(previousSnapshot, {
            addTransactionDefaults: input.addTransactionDefaults,
            input: input.transactionInput,
            lines: optimisticRecords.lines,
            transaction: optimisticRecords.transaction,
          }) &&
          patchSnapshotAfterRecurringItemStateChangeWithRollback(
            previousSnapshot,
            input.recurringItemInput,
            rollback,
          ) !== null;

        if (!rollback || !canPatchOptimistically) {
          return withFullRefreshActionTiming(
            'createUpcomingPaymentTransaction',
            startedAt,
            persistUpcomingPaymentTransactionWithSaving({ input, refresh, repository, setSaving }),
          );
        }

        scheduleOptimisticMutationTask(() => {
          applyAcceptedOptimisticUpcomingPaymentTransaction({
            applySnapshotPatch,
            input,
            optimisticRecords,
            previousAddTransactionDefaults: previousSnapshot.settings.addTransactionDefaults,
            refresh,
            repository,
            rollback,
            setError,
            transactionWriteQueueRef,
          });
        });

        logDevPerfDuration('rainproofData.createUpcomingPaymentTransaction.accepted', startedAt, {
          ...getNewTransactionInputPerfMetadata(input.transactionInput),
          refresh: 'optimistic',
        });
        logDevPerfDuration('rainproofData.createUpcomingPaymentTransaction.perceived', startedAt, { refresh: 'accepted' });
        logDevPerfDuration('rainproofData.createUpcomingPaymentTransaction.total', startedAt);
        return Promise.resolve();
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Could not create upcoming payment transaction.';
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
    }, () => getSnapshotPerfCounts(snapshot));
  }, [snapshot]);

  const updateBudgetOrderOptimistically = useCallback((budgetIds: string[]): Promise<void> => {
    const repository = repositoryRef.current;
    const currentSnapshot = snapshotRef.current;
    const nextBudgetIds = getUniqueOrderedIds(budgetIds);
    if (!repository || !currentSnapshot || !nextBudgetIds.length) {
      return Promise.resolve();
    }

    const currentActiveBudgetIds = currentSnapshot.budgets
      .filter((budget) => budget.isActive)
      .map((budget) => budget.id);
    if (haveIdsInSameOrder(currentActiveBudgetIds, nextBudgetIds)) {
      budgetOrderUpdateTokenRef.current += 1;
      return Promise.resolve();
    }

    const updateToken = budgetOrderUpdateTokenRef.current + 1;
    budgetOrderUpdateTokenRef.current = updateToken;

    scheduleOptimisticMutationTask(() => {
      applySnapshotPatch(patchBudgetOrder(nextBudgetIds, () => budgetOrderUpdateTokenRef.current === updateToken));
      enqueueLatestBackgroundWrite({
        onFailure: async (caught) => {
          if (budgetOrderUpdateTokenRef.current !== updateToken) {
            return;
          }

          setError(caught instanceof Error ? caught.message : 'Could not save budget order.');
          try {
            await refresh();
          } catch (refreshError) {
            setError(refreshError instanceof Error ? refreshError.message : 'Could not refresh budgets.');
          }
        },
        onSuccess: () => {
          if (budgetOrderUpdateTokenRef.current === updateToken) {
            setError('');
          }
        },
        queueRef: budgetOrderWriteQueueRef,
        updateToken,
        updateTokenRef: budgetOrderUpdateTokenRef,
        write: () => repository.updateBudgetOrder(nextBudgetIds),
      });
    });

    return Promise.resolve();
  }, [applySnapshotPatch, refresh]);

  const updateAccountOrderOptimistically = useCallback((accountIds: string[]): Promise<void> => {
    const repository = repositoryRef.current;
    const currentSnapshot = snapshotRef.current;
    const nextAccountIds = getUniqueOrderedIds(accountIds);
    if (!repository || !currentSnapshot || !nextAccountIds.length) {
      return Promise.resolve();
    }

    const currentAccountIds = currentSnapshot.accounts.map((account) => account.id);
    if (haveIdsInSameOrder(currentAccountIds, nextAccountIds)) {
      accountOrderUpdateTokenRef.current += 1;
      return Promise.resolve();
    }

    const updateToken = accountOrderUpdateTokenRef.current + 1;
    accountOrderUpdateTokenRef.current = updateToken;

    scheduleOptimisticMutationTask(() => {
      applySnapshotPatch(patchAccountOrder(nextAccountIds, () => accountOrderUpdateTokenRef.current === updateToken));
      enqueueLatestBackgroundWrite({
        onFailure: async (caught) => {
          if (accountOrderUpdateTokenRef.current !== updateToken) {
            return;
          }

          setError(caught instanceof Error ? caught.message : 'Could not save account order.');
          try {
            await refresh();
          } catch (refreshError) {
            setError(refreshError instanceof Error ? refreshError.message : 'Could not refresh accounts.');
          }
        },
        onSuccess: () => {
          if (accountOrderUpdateTokenRef.current === updateToken) {
            setError('');
          }
        },
        queueRef: accountOrderWriteQueueRef,
        updateToken,
        updateTokenRef: accountOrderUpdateTokenRef,
        write: () => repository.updateAccountOrder(nextAccountIds),
      });
    });

    return Promise.resolve();
  }, [applySnapshotPatch, refresh]);

  const actions = useMemo<RainproofActions>(
    () => ({
      addAccount: (input) => runMutation((repository) => repository.addAccount(input)),
      updateAccount: (input) => runMutation((repository) => repository.updateAccount(input)),
      addTransaction: addTransactionOptimistically,
      updateTransaction: updateTransactionOptimistically,
      deleteTransaction: deleteTransactionOptimistically,
      addTransactionLink: addTransactionLinkOptimistically,
      updateTransactionLink: updateTransactionLinkOptimistically,
      deleteTransactionLink: deleteTransactionLinkOptimistically,
      saveTransactionLinkBatch: saveTransactionLinkBatchOptimistically,
      addBudget: (input) => runMutation((repository) => repository.addBudget(input)),
      updateBudget: (input) => runMutation((repository) => repository.updateBudget(input)),
      updateBudgetOrder: updateBudgetOrderOptimistically,
      archiveBudget: (budgetId) => runMutation((repository) => repository.archiveBudget(budgetId)),
      addRecurringItem: (input) => runMutation((repository) => repository.addRecurringItem(input)),
      updateRecurringItem: (input) =>
        runMutation((repository) => repository.updateRecurringItem(input), { rethrow: true }),
      updateUpcomingPaymentDueDate: updateUpcomingPaymentDueDateOptimistically,
      createUpcomingPaymentTransaction: createUpcomingPaymentTransactionOptimistically,
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
      updateDashboardSelectedAccountIds: (accountIds) => {
        const updateToken = dashboardSelectedAccountIdsUpdateTokenRef.current + 1;
        dashboardSelectedAccountIdsUpdateTokenRef.current = updateToken;
        const nextAccountIds = [...accountIds];

        return runMutation(
          async (repository) => {
            const write = dashboardSelectedAccountIdsWriteQueueRef.current
              .catch(() => undefined)
              .then(async () => {
                if (dashboardSelectedAccountIdsUpdateTokenRef.current !== updateToken) {
                  return;
                }

                await repository.updateDashboardSelectedAccountIds(nextAccountIds);
              });

            dashboardSelectedAccountIdsWriteQueueRef.current = write.catch(() => undefined);
            try {
              await write;
            } catch (caught) {
              await refresh();
              throw caught;
            }

            return {
              patchSnapshot: patchDashboardSelectedAccountIdsSetting(
                nextAccountIds,
                () => dashboardSelectedAccountIdsUpdateTokenRef.current === updateToken,
              ),
            };
          },
          {
            label: 'updateDashboardSelectedAccountIds',
            showSaving: false,
          },
        );
      },
      updateAccountDashboardVisibility: (accountId, showOnDashboard) =>
        runMutation((repository) => repository.updateAccountDashboardVisibility(accountId, showOnDashboard)),
      updateAccountOrder: updateAccountOrderOptimistically,
      closeAccount: (accountId) => runMutation((repository) => repository.closeAccount(accountId)),
      reopenAccount: (accountId) => runMutation((repository) => repository.reopenAccount(accountId)),
      deleteAccount: (accountId) => runMutation((repository) => repository.deleteAccount(accountId)),
      restoreBackup: async (backup, onProgress) => {
        await onProgress?.('prepare-restore');
        await runMutation(
          async (repository) => {
            await onProgress?.('restore-data');
            await repository.restoreBackup(backup);
            await onProgress?.('refresh-state');
          },
          {
            label: 'restoreBackup',
            rethrow: true,
          },
        );
        await onProgress?.('finish');
      },
      refresh,
    }),
    [
      addTransactionLinkOptimistically,
      addTransactionOptimistically,
      createUpcomingPaymentTransactionOptimistically,
      deleteTransactionLinkOptimistically,
      deleteTransactionOptimistically,
      refresh,
      runMutation,
      saveTransactionLinkBatchOptimistically,
      updateAccountOrderOptimistically,
      updateBudgetOrderOptimistically,
      updateUpcomingPaymentDueDateOptimistically,
      updateTransactionLinkOptimistically,
      updateTransactionOptimistically,
    ],
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

function patchDashboardSelectedAccountIdsSetting(accountIds: string[], shouldPatch: () => boolean) {
  const nextAccountIds = [...accountIds];

  return (snapshot: AppSnapshot): AppSnapshot => {
    if (!shouldPatch()) {
      return snapshot;
    }

    if (areStringArraysEqual(snapshot.settings.dashboardSelectedAccountIds, nextAccountIds)) {
      return snapshot;
    }

    return {
      ...snapshot,
      settings: {
        ...snapshot.settings,
        dashboardSelectedAccountIds: nextAccountIds,
      },
    };
  };
}

function patchBudgetOrder(budgetIds: string[], shouldPatch: () => boolean) {
  const nextBudgetIds = getUniqueOrderedIds(budgetIds);

  return (snapshot: AppSnapshot): AppSnapshot => {
    if (!shouldPatch()) {
      return snapshot;
    }

    const nextBudgets = reorderSortableItems(snapshot.budgets, nextBudgetIds);
    if (nextBudgets === snapshot.budgets) {
      return snapshot;
    }

    return {
      ...snapshot,
      budgets: nextBudgets,
    };
  };
}

function patchAccountOrder(accountIds: string[], shouldPatch: () => boolean) {
  const nextAccountIds = getUniqueOrderedIds(accountIds);

  return (snapshot: AppSnapshot): AppSnapshot => {
    if (!shouldPatch()) {
      return snapshot;
    }

    const nextAccounts = reorderSortableItems(snapshot.accounts, nextAccountIds);
    if (nextAccounts === snapshot.accounts) {
      return snapshot;
    }

    return {
      ...snapshot,
      accounts: nextAccounts,
    };
  };
}

function reorderSortableItems<T extends { id: string; sortOrder: number }>(
  items: T[],
  preferredIds: readonly string[],
): T[] {
  const currentIds = items.map((item) => item.id);
  const preferredIdSet = new Set(preferredIds);
  const nextIds = [
    ...preferredIds.filter((id) => currentIds.includes(id)),
    ...currentIds.filter((id) => !preferredIdSet.has(id)),
  ];

  if (
    haveIdsInSameOrder(currentIds, nextIds) &&
    items.every((item, index) => item.sortOrder === index)
  ) {
    return items;
  }

  const itemById = new Map(items.map((item) => [item.id, item]));
  return nextIds
    .map((id, index) => {
      const item = itemById.get(id);
      if (!item) {
        return null;
      }

      return item.sortOrder === index ? item : { ...item, sortOrder: index };
    })
    .filter((item): item is T => Boolean(item));
}

function areStringArraysEqual(left: string[] | null | undefined, right: string[]): boolean {
  return Array.isArray(left) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index]);
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

function getTransactionLinkInputPerfMetadata(input: NewTransactionLinkInput | UpdateTransactionLinkInput) {
  return {
    lineLevel: Boolean(input.sourceLineId || input.targetLineId),
    linkType: input.linkType,
  };
}

function getTransactionLinkBatchPerfMetadata(input: TransactionLinkBatchInput) {
  const linkInputs = [...input.toAdd, ...input.toUpdate];
  return {
    adds: input.toAdd.length,
    deletes: input.deleteIds.length,
    lineLevel: linkInputs.some((linkInput) => Boolean(linkInput.sourceLineId || linkInput.targetLineId)),
    updates: input.toUpdate.length,
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

function enqueueLatestBackgroundWrite({
  onFailure,
  onSuccess,
  queueRef,
  updateToken,
  updateTokenRef,
  write,
}: {
  onFailure: (caught: unknown) => Promise<void>;
  onSuccess: () => void;
  queueRef: BackgroundWriteQueueRef;
  updateToken: number;
  updateTokenRef: { current: number };
  write: () => Promise<void>;
}): void {
  const nextWrite = queueRef.current
    .catch(() => undefined)
    .then(async () => {
      if (updateTokenRef.current !== updateToken) {
        return;
      }

      await write();
    });

  queueRef.current = nextWrite.catch(() => undefined);
  void nextWrite
    .then(() => {
      if (updateTokenRef.current === updateToken) {
        onSuccess();
      }
    })
    .catch(onFailure);
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
    () => getSnapshotPerfCounts(optimisticSnapshot),
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

function applyAcceptedOptimisticUpcomingPaymentDueDate({
  applySnapshotPatch,
  input,
  refresh,
  repository,
  rollback,
  setError,
  transactionWriteQueueRef,
}: {
  applySnapshotPatch: (patchSnapshot: (snapshot: AppSnapshot) => AppSnapshot | null) => AppSnapshot | null;
  input: UpdateRecurringItemInput;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  rollback: OptimisticRecurringItemStateRollback;
  setError: (message: string) => void;
  transactionWriteQueueRef: BackgroundWriteQueueRef;
}): void {
  const optimisticPatchStartedAt = Date.now();
  const optimisticSnapshot = applySnapshotPatch((currentSnapshot) =>
    patchSnapshotAfterRecurringItemStateChangeWithRollback(currentSnapshot, input, rollback),
  );

  if (!optimisticSnapshot) {
    void persistRecurringItemUpdateWithFullRefresh({ input, refresh, repository }).catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'Could not move the upcoming payment due date.');
    });
    return;
  }

  const optimisticItem = optimisticSnapshot.recurringItems.find((item) => item.id === input.id);
  if (!optimisticItem) {
    void refresh().catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'Could not refresh upcoming payments.');
    });
    return;
  }

  logDevPerfDuration('rainproofData.updateUpcomingPaymentDueDate.optimisticPatch', optimisticPatchStartedAt, {
    recurring: optimisticSnapshot.recurringItems.length,
    refresh: 'patched',
  });
  setError('');

  enqueueBackgroundWrite(transactionWriteQueueRef, async () => {
    await persistOptimisticUpcomingPaymentDueDate({
      input,
      optimisticItem,
      refresh,
      repository,
      rollback,
      rollbackPatch: (itemRollback, item) => applySnapshotPatch((currentSnapshot) =>
        rollbackSnapshotAfterOptimisticRecurringItemStateChange(currentSnapshot, itemRollback, item),
      ),
      setError,
    });
  });
}

function applyAcceptedOptimisticUpcomingPaymentTransaction({
  applySnapshotPatch,
  input,
  optimisticRecords,
  previousAddTransactionDefaults,
  refresh,
  repository,
  rollback,
  setError,
  transactionWriteQueueRef,
}: {
  applySnapshotPatch: (patchSnapshot: (snapshot: AppSnapshot) => AppSnapshot | null) => AppSnapshot | null;
  input: CreateUpcomingPaymentTransactionInput;
  optimisticRecords: AddTransactionPersistenceRecords;
  previousAddTransactionDefaults?: AddTransactionDefaults;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  rollback: OptimisticRecurringItemStateRollback;
  setError: (message: string) => void;
  transactionWriteQueueRef: BackgroundWriteQueueRef;
}): void {
  const optimisticPatchStartedAt = Date.now();
  const optimisticSnapshot = applySnapshotPatch((currentSnapshot) => {
    const withTransaction = patchSnapshotAfterAddTransaction(currentSnapshot, {
      addTransactionDefaults: input.addTransactionDefaults,
      input: input.transactionInput,
      lines: optimisticRecords.lines,
      transaction: optimisticRecords.transaction,
    });
    if (!withTransaction) {
      return null;
    }

    return patchSnapshotAfterRecurringItemStateChangeWithRollback(withTransaction, input.recurringItemInput, rollback);
  });

  if (!optimisticSnapshot) {
    void persistUpcomingPaymentTransactionWithFullRefresh({
      input,
      optimisticRecords,
      refresh,
      repository,
    }).catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'Could not create upcoming payment transaction.');
    });
    return;
  }

  const optimisticItem = optimisticSnapshot.recurringItems.find((item) => item.id === input.recurringItemId);
  if (!optimisticItem) {
    void refresh().catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'Could not refresh upcoming payments.');
    });
    return;
  }

  logDevPerfDuration(
    'rainproofData.createUpcomingPaymentTransaction.optimisticPatch',
    optimisticPatchStartedAt,
    () => getSnapshotPerfCounts(optimisticSnapshot),
  );
  setError('');

  enqueueBackgroundWrite(transactionWriteQueueRef, async () => {
    await persistOptimisticUpcomingPaymentTransaction({
      input,
      optimisticItem,
      optimisticRecords,
      refresh,
      repository,
      rollback,
      rollbackPatch: (itemRollback, item, records) => applySnapshotPatch((currentSnapshot) => {
        const withoutTransaction = rollbackSnapshotAfterOptimisticAddTransaction(currentSnapshot, {
          lineIds: records.lines.map((line) => line.id),
          optimisticAddTransactionDefaults: input.addTransactionDefaults,
          previousAddTransactionDefaults,
          transactionId: records.transaction.id,
        });
        if (!withoutTransaction) {
          return null;
        }

        return rollbackSnapshotAfterOptimisticRecurringItemStateChange(withoutTransaction, itemRollback, item);
      }),
      setError,
    });
  });
}

function applyAcceptedOptimisticEditTransaction({
  applySnapshotPatch,
  input,
  linkRollback,
  optimisticLinkRecords,
  optimisticRecords,
  refresh,
  repository,
  rollback,
  setError,
  transactionLinkBatch,
  transactionWriteQueueRef,
}: {
  applySnapshotPatch: (patchSnapshot: (snapshot: AppSnapshot) => AppSnapshot | null) => AppSnapshot | null;
  input: UpdateTransactionInput;
  linkRollback?: OptimisticTransactionLinkBatchRollback;
  optimisticLinkRecords?: TransactionLinkBatchPersistenceRecords;
  optimisticRecords: UpdateTransactionPersistenceRecords;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  rollback: OptimisticEditTransactionRollback;
  setError: (message: string) => void;
  transactionLinkBatch?: TransactionLinkBatchInput;
  transactionWriteQueueRef: BackgroundWriteQueueRef;
}): void {
  const optimisticPatchStartedAt = Date.now();
  const optimisticSnapshot = applySnapshotPatch((currentSnapshot) => {
    const snapshotWithTransaction = patchSnapshotAfterEditTransactionWithRollback(currentSnapshot, {
      input,
      ...optimisticRecords,
    }, rollback);
    if (!snapshotWithTransaction) {
      return null;
    }

    return optimisticLinkRecords && linkRollback
      ? patchSnapshotAfterTransactionLinkBatchWithRollback(
          snapshotWithTransaction,
          optimisticLinkRecords,
          linkRollback,
        )
      : snapshotWithTransaction;
  });

  if (!optimisticSnapshot) {
    void persistUpdateTransactionWithFullRefresh({
      input,
      refresh,
      repository,
      transactionLinkBatch,
    }).catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'Could not update transaction.');
    });
    return;
  }

  logDevPerfDuration(
    'rainproofData.updateTransaction.optimisticPatch',
    optimisticPatchStartedAt,
    () => ({
      ...getSnapshotPerfCounts(optimisticSnapshot),
      insertedLines: optimisticRecords.insertedLineIds.length,
      removedLines: optimisticRecords.removedLineIds.length,
    }),
  );
  setError('');

  enqueueBackgroundWrite(transactionWriteQueueRef, async () => {
    await persistOptimisticEditTransaction({
      input,
      optimisticLinkRecords,
      optimisticRecords,
      refresh,
      repository,
      rollback,
      rollbackPatch: (editRollback, records) => applySnapshotPatch((currentSnapshot) => {
        const snapshotWithoutLinkBatch = optimisticLinkRecords && linkRollback
          ? rollbackSnapshotAfterOptimisticTransactionLinkBatch(
              currentSnapshot,
              linkRollback,
              optimisticLinkRecords,
            )
          : currentSnapshot;
        if (!snapshotWithoutLinkBatch) {
          return null;
        }

        return rollbackSnapshotAfterOptimisticEditTransaction(
          snapshotWithoutLinkBatch,
          editRollback,
          { input, ...records },
        );
      }),
      setError,
      transactionLinkBatch,
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
    () => ({
      ...getSnapshotPerfCounts(optimisticSnapshot),
      linksRemoved: rollback.links.length,
      linesRemoved: rollback.lines.length,
    }),
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

function applyAcceptedOptimisticAddTransactionLink({
  applySnapshotPatch,
  input,
  optimisticLink,
  refresh,
  repository,
  setError,
  transactionWriteQueueRef,
}: {
  applySnapshotPatch: (patchSnapshot: (snapshot: AppSnapshot) => AppSnapshot | null) => AppSnapshot | null;
  input: NewTransactionLinkInput;
  optimisticLink: AddTransactionLinkPersistenceRecord;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  setError: (message: string) => void;
  transactionWriteQueueRef: BackgroundWriteQueueRef;
}): void {
  const optimisticPatchStartedAt = Date.now();
  const optimisticSnapshot = applySnapshotPatch((currentSnapshot) =>
    patchSnapshotAfterAddTransactionLink(currentSnapshot, optimisticLink),
  );

  if (!optimisticSnapshot) {
    void persistAddTransactionLinkWithFullRefresh({
      input,
      refresh,
      repository,
    }).catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'Could not link transaction.');
    });
    return;
  }

  logDevPerfDuration(
    'rainproofData.addTransactionLink.optimisticPatch',
    optimisticPatchStartedAt,
    () => getSnapshotPerfCounts(optimisticSnapshot),
  );
  setError('');

  enqueueBackgroundWrite(transactionWriteQueueRef, async () => {
    await persistOptimisticAddTransactionLink({
      input,
      optimisticLink,
      refresh,
      repository,
      rollbackPatch: (link) => applySnapshotPatch((currentSnapshot) =>
        rollbackSnapshotAfterOptimisticAddTransactionLink(currentSnapshot, link),
      ),
      setError,
    });
  });
}

function applyAcceptedOptimisticUpdateTransactionLink({
  applySnapshotPatch,
  input,
  optimisticLink,
  refresh,
  repository,
  rollback,
  setError,
  transactionWriteQueueRef,
}: {
  applySnapshotPatch: (patchSnapshot: (snapshot: AppSnapshot) => AppSnapshot | null) => AppSnapshot | null;
  input: UpdateTransactionLinkInput;
  optimisticLink: UpdateTransactionLinkPersistenceRecord;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  rollback: OptimisticTransactionLinkRollback;
  setError: (message: string) => void;
  transactionWriteQueueRef: BackgroundWriteQueueRef;
}): void {
  const optimisticPatchStartedAt = Date.now();
  const optimisticSnapshot = applySnapshotPatch((currentSnapshot) =>
    patchSnapshotAfterUpdateTransactionLinkWithRollback(currentSnapshot, optimisticLink, rollback),
  );

  if (!optimisticSnapshot) {
    void persistUpdateTransactionLinkWithFullRefresh({
      input,
      refresh,
      repository,
    }).catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'Could not update transaction link.');
    });
    return;
  }

  logDevPerfDuration(
    'rainproofData.updateTransactionLink.optimisticPatch',
    optimisticPatchStartedAt,
    () => getSnapshotPerfCounts(optimisticSnapshot),
  );
  setError('');

  enqueueBackgroundWrite(transactionWriteQueueRef, async () => {
    await persistOptimisticUpdateTransactionLink({
      input,
      optimisticLink,
      refresh,
      repository,
      rollback,
      rollbackPatch: (linkRollback, link) => applySnapshotPatch((currentSnapshot) =>
        rollbackSnapshotAfterOptimisticUpdateTransactionLink(currentSnapshot, linkRollback, link),
      ),
      setError,
    });
  });
}

function applyAcceptedOptimisticDeleteTransactionLink({
  applySnapshotPatch,
  refresh,
  repository,
  rollback,
  setError,
  transactionWriteQueueRef,
}: {
  applySnapshotPatch: (patchSnapshot: (snapshot: AppSnapshot) => AppSnapshot | null) => AppSnapshot | null;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  rollback: OptimisticTransactionLinkRollback;
  setError: (message: string) => void;
  transactionWriteQueueRef: BackgroundWriteQueueRef;
}): void {
  const optimisticPatchStartedAt = Date.now();
  const optimisticSnapshot = applySnapshotPatch((currentSnapshot) =>
    patchSnapshotAfterDeleteTransactionLinkWithRollback(currentSnapshot, rollback),
  );

  if (!optimisticSnapshot) {
    void persistDeleteTransactionLinkWithFullRefresh({
      linkId: rollback.item.id,
      refresh,
      repository,
    }).catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'Could not unlink transaction.');
    });
    return;
  }

  logDevPerfDuration(
    'rainproofData.deleteTransactionLink.optimisticPatch',
    optimisticPatchStartedAt,
    () => getSnapshotPerfCounts(optimisticSnapshot),
  );
  setError('');

  enqueueBackgroundWrite(transactionWriteQueueRef, async () => {
    await persistOptimisticDeleteTransactionLink({
      refresh,
      repository,
      rollback,
      rollbackPatch: (linkRollback) => applySnapshotPatch((currentSnapshot) =>
        rollbackSnapshotAfterOptimisticDeleteTransactionLink(currentSnapshot, linkRollback),
      ),
      setError,
    });
  });
}

function applyAcceptedOptimisticTransactionLinkBatch({
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
  input: TransactionLinkBatchInput;
  optimisticRecords: TransactionLinkBatchPersistenceRecords;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  rollback: OptimisticTransactionLinkBatchRollback;
  setError: (message: string) => void;
  transactionWriteQueueRef: BackgroundWriteQueueRef;
}): void {
  const optimisticPatchStartedAt = Date.now();
  const optimisticSnapshot = applySnapshotPatch((currentSnapshot) =>
    patchSnapshotAfterTransactionLinkBatchWithRollback(currentSnapshot, optimisticRecords, rollback),
  );

  if (!optimisticSnapshot) {
    void persistTransactionLinkBatchWithFullRefresh({
      input,
      refresh,
      repository,
    }).catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'Could not save transaction links.');
    });
    return;
  }

  logDevPerfDuration(
    'rainproofData.saveTransactionLinkBatch.optimisticPatch',
    optimisticPatchStartedAt,
    () => ({
      ...getSnapshotPerfCounts(optimisticSnapshot),
      addedLinks: optimisticRecords.addedLinks.length,
      deletedLinks: optimisticRecords.deletedLinkIds.length,
      updatedLinks: optimisticRecords.updatedLinks.length,
    }),
  );
  setError('');

  enqueueBackgroundWrite(transactionWriteQueueRef, async () => {
    await persistOptimisticTransactionLinkBatch({
      input,
      optimisticRecords,
      refresh,
      repository,
      rollback,
      rollbackPatch: (batchRollback, records) => applySnapshotPatch((currentSnapshot) =>
        rollbackSnapshotAfterOptimisticTransactionLinkBatch(currentSnapshot, batchRollback, records),
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

async function persistAddTransactionLinkWithSaving({
  input,
  refresh,
  repository,
  setSaving,
}: {
  input: NewTransactionLinkInput;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  setSaving: (saving: boolean) => void;
}): Promise<void> {
  try {
    setSaving(true);
    await persistAddTransactionLinkWithFullRefresh({
      input,
      refresh,
      repository,
    });
  } finally {
    setSaving(false);
  }
}

async function persistAddTransactionLinkWithFullRefresh({
  input,
  refresh,
  repository,
}: {
  input: NewTransactionLinkInput;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
}): Promise<void> {
  await timeDevPerfAsync(
    'rainproofData.addTransactionLink.repositoryAdd',
    () => repository.addTransactionLink(input),
    getTransactionLinkInputPerfMetadata(input),
  );
  await refresh();
}

async function persistUpdateTransactionLinkWithSaving({
  input,
  refresh,
  repository,
  setSaving,
}: {
  input: UpdateTransactionLinkInput;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  setSaving: (saving: boolean) => void;
}): Promise<void> {
  try {
    setSaving(true);
    await persistUpdateTransactionLinkWithFullRefresh({
      input,
      refresh,
      repository,
    });
  } finally {
    setSaving(false);
  }
}

async function persistUpdateTransactionLinkWithFullRefresh({
  input,
  refresh,
  repository,
}: {
  input: UpdateTransactionLinkInput;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
}): Promise<void> {
  await timeDevPerfAsync(
    'rainproofData.updateTransactionLink.repositoryUpdate',
    () => repository.updateTransactionLink(input),
    getTransactionLinkInputPerfMetadata(input),
  );
  await refresh();
}

async function persistDeleteTransactionLinkWithSaving({
  linkId,
  refresh,
  repository,
  setSaving,
}: {
  linkId: string;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  setSaving: (saving: boolean) => void;
}): Promise<void> {
  try {
    setSaving(true);
    await persistDeleteTransactionLinkWithFullRefresh({
      linkId,
      refresh,
      repository,
    });
  } finally {
    setSaving(false);
  }
}

async function persistDeleteTransactionLinkWithFullRefresh({
  linkId,
  refresh,
  repository,
}: {
  linkId: string;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
}): Promise<void> {
  await timeDevPerfAsync(
    'rainproofData.deleteTransactionLink.repositoryDelete',
    () => repository.deleteTransactionLink(linkId),
  );
  await refresh();
}

async function persistOptimisticAddTransactionLink({
  input,
  optimisticLink,
  refresh,
  repository,
  rollbackPatch,
  setError,
}: {
  input: NewTransactionLinkInput;
  optimisticLink: AddTransactionLinkPersistenceRecord;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  rollbackPatch: (link: AddTransactionLinkPersistenceRecord) => AppSnapshot | null;
  setError: (message: string) => void;
}): Promise<void> {
  try {
    const persistedLink = await timeDevPerfAsync(
      'rainproofData.addTransactionLink.backgroundWrite',
      () => repository.addTransactionLink(input, optimisticLink),
      getTransactionLinkInputPerfMetadata(input),
    );

    const reconcileStartedAt = Date.now();
    if (areTransactionLinkPersistenceRecordsEqual(persistedLink, optimisticLink)) {
      logDevPerfDuration('rainproofData.addTransactionLink.reconcile', reconcileStartedAt, { refresh: 'none' });
      return;
    }

    await refresh();
    logDevPerfDuration('rainproofData.addTransactionLink.reconcile', reconcileStartedAt, { refresh: 'full' });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Could not link transaction.';
    const rollbackStartedAt = Date.now();
    const rolledBackSnapshot = rollbackPatch(optimisticLink);
    if (rolledBackSnapshot) {
      logDevPerfDuration(
        'rainproofData.addTransactionLink.rollback',
        rollbackStartedAt,
        () => ({
          ...getSnapshotPerfCounts(rolledBackSnapshot),
          refresh: 'patched',
        }),
      );
    } else {
      await refresh();
      logDevPerfDuration('rainproofData.addTransactionLink.rollback', rollbackStartedAt, { refresh: 'full' });
    }
    setError(message);
  }
}

async function persistOptimisticUpdateTransactionLink({
  input,
  optimisticLink,
  refresh,
  repository,
  rollback,
  rollbackPatch,
  setError,
}: {
  input: UpdateTransactionLinkInput;
  optimisticLink: UpdateTransactionLinkPersistenceRecord;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  rollback: OptimisticTransactionLinkRollback;
  rollbackPatch: (
    rollback: OptimisticTransactionLinkRollback,
    link: UpdateTransactionLinkPersistenceRecord,
  ) => AppSnapshot | null;
  setError: (message: string) => void;
}): Promise<void> {
  try {
    const persistedLink = await timeDevPerfAsync(
      'rainproofData.updateTransactionLink.backgroundWrite',
      () => repository.updateTransactionLink(input, optimisticLink),
      getTransactionLinkInputPerfMetadata(input),
    );

    const reconcileStartedAt = Date.now();
    if (areTransactionLinkPersistenceRecordsEqual(persistedLink, optimisticLink)) {
      logDevPerfDuration('rainproofData.updateTransactionLink.reconcile', reconcileStartedAt, { refresh: 'none' });
      return;
    }

    await refresh();
    logDevPerfDuration('rainproofData.updateTransactionLink.reconcile', reconcileStartedAt, { refresh: 'full' });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Could not update transaction link.';
    const rollbackStartedAt = Date.now();
    const rolledBackSnapshot = rollbackPatch(rollback, optimisticLink);
    if (rolledBackSnapshot) {
      logDevPerfDuration(
        'rainproofData.updateTransactionLink.rollback',
        rollbackStartedAt,
        () => ({
          ...getSnapshotPerfCounts(rolledBackSnapshot),
          refresh: 'patched',
        }),
      );
    } else {
      await refresh();
      logDevPerfDuration('rainproofData.updateTransactionLink.rollback', rollbackStartedAt, { refresh: 'full' });
    }
    setError(message);
  }
}

async function persistOptimisticDeleteTransactionLink({
  refresh,
  repository,
  rollback,
  rollbackPatch,
  setError,
}: {
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  rollback: OptimisticTransactionLinkRollback;
  rollbackPatch: (rollback: OptimisticTransactionLinkRollback) => AppSnapshot | null;
  setError: (message: string) => void;
}): Promise<void> {
  try {
    await timeDevPerfAsync(
      'rainproofData.deleteTransactionLink.backgroundWrite',
      () => repository.deleteTransactionLink(rollback.item.id),
      {
        lineLevel: Boolean(rollback.item.sourceLineId || rollback.item.targetLineId),
      },
    );

    const reconcileStartedAt = Date.now();
    logDevPerfDuration('rainproofData.deleteTransactionLink.reconcile', reconcileStartedAt, { refresh: 'none' });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Could not unlink transaction.';
    const rollbackStartedAt = Date.now();
    const rolledBackSnapshot = rollbackPatch(rollback);
    if (rolledBackSnapshot) {
      logDevPerfDuration(
        'rainproofData.deleteTransactionLink.rollback',
        rollbackStartedAt,
        () => ({
          ...getSnapshotPerfCounts(rolledBackSnapshot),
          refresh: 'patched',
        }),
      );
    } else {
      await refresh();
      logDevPerfDuration('rainproofData.deleteTransactionLink.rollback', rollbackStartedAt, { refresh: 'full' });
    }
    setError(message);
  }
}

async function persistTransactionLinkBatchWithSaving({
  input,
  refresh,
  repository,
  setSaving,
}: {
  input: TransactionLinkBatchInput;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  setSaving: (saving: boolean) => void;
}): Promise<void> {
  try {
    setSaving(true);
    await persistTransactionLinkBatchWithFullRefresh({
      input,
      refresh,
      repository,
    });
  } finally {
    setSaving(false);
  }
}

async function persistTransactionLinkBatchWithFullRefresh({
  input,
  refresh,
  repository,
}: {
  input: TransactionLinkBatchInput;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
}): Promise<void> {
  await timeDevPerfAsync(
    'rainproofData.saveTransactionLinkBatch.repositorySave',
    () => repository.saveTransactionLinkBatch(input),
    getTransactionLinkBatchPerfMetadata(input),
  );
  await refresh();
}

async function persistOptimisticTransactionLinkBatch({
  input,
  optimisticRecords,
  refresh,
  repository,
  rollback,
  rollbackPatch,
  setError,
}: {
  input: TransactionLinkBatchInput;
  optimisticRecords: TransactionLinkBatchPersistenceRecords;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  rollback: OptimisticTransactionLinkBatchRollback;
  rollbackPatch: (
    rollback: OptimisticTransactionLinkBatchRollback,
    records: TransactionLinkBatchPersistenceRecords,
  ) => AppSnapshot | null;
  setError: (message: string) => void;
}): Promise<void> {
  try {
    const persistedRecords = await timeDevPerfAsync(
      'rainproofData.saveTransactionLinkBatch.backgroundWrite',
      () => repository.saveTransactionLinkBatch(input, optimisticRecords),
      getTransactionLinkBatchPerfMetadata(input),
    );

    const reconcileStartedAt = Date.now();
    if (areTransactionLinkBatchPersistenceRecordsEqual(persistedRecords, optimisticRecords)) {
      logDevPerfDuration('rainproofData.saveTransactionLinkBatch.reconcile', reconcileStartedAt, { refresh: 'none' });
      return;
    }

    await refresh();
    logDevPerfDuration('rainproofData.saveTransactionLinkBatch.reconcile', reconcileStartedAt, { refresh: 'full' });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Could not save transaction links.';
    const rollbackStartedAt = Date.now();
    const rolledBackSnapshot = rollbackPatch(rollback, optimisticRecords);
    if (rolledBackSnapshot) {
      logDevPerfDuration(
        'rainproofData.saveTransactionLinkBatch.rollback',
        rollbackStartedAt,
        () => ({
          ...getSnapshotPerfCounts(rolledBackSnapshot),
          refresh: 'patched',
        }),
      );
    } else {
      await refresh();
      logDevPerfDuration('rainproofData.saveTransactionLinkBatch.rollback', rollbackStartedAt, { refresh: 'full' });
    }
    setError(message);
  }
}

async function persistUpdateTransactionWithSaving({
  input,
  refresh,
  repository,
  setSaving,
  transactionLinkBatch,
  transactionLinkDeleteIds,
}: {
  input: UpdateTransactionInput;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  setSaving: (saving: boolean) => void;
  transactionLinkBatch?: TransactionLinkBatchInput;
  transactionLinkDeleteIds?: string[];
}): Promise<void> {
  try {
    setSaving(true);
    await persistUpdateTransactionWithFullRefresh({
      input,
      refresh,
      repository,
      transactionLinkBatch,
      transactionLinkDeleteIds,
    });
  } finally {
    setSaving(false);
  }
}

async function persistUpdateTransactionWithFullRefresh({
  input,
  refresh,
  repository,
  transactionLinkBatch,
  transactionLinkDeleteIds,
}: {
  input: UpdateTransactionInput;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  transactionLinkBatch?: TransactionLinkBatchInput;
  transactionLinkDeleteIds?: string[];
}): Promise<void> {
  await timeDevPerfAsync(
    'rainproofData.updateTransaction.repositoryUpdate',
    () => repository.updateTransaction(input, undefined, { transactionLinkBatch, transactionLinkDeleteIds }),
    getNewTransactionInputPerfMetadata(input),
  );
  await refresh();
}

async function persistOptimisticEditTransaction({
  input,
  optimisticLinkRecords,
  optimisticRecords,
  refresh,
  repository,
  rollback,
  rollbackPatch,
  setError,
  transactionLinkBatch,
}: {
  input: UpdateTransactionInput;
  optimisticLinkRecords?: TransactionLinkBatchPersistenceRecords;
  optimisticRecords: UpdateTransactionPersistenceRecords;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  rollback: OptimisticEditTransactionRollback;
  rollbackPatch: (
    rollback: OptimisticEditTransactionRollback,
    records: UpdateTransactionPersistenceRecords,
  ) => AppSnapshot | null;
  setError: (message: string) => void;
  transactionLinkBatch?: TransactionLinkBatchInput;
}): Promise<void> {
  let transactionPersisted = false;

  try {
    const persistedRecords = await timeDevPerfAsync(
      'rainproofData.updateTransaction.backgroundWrite',
      async () => {
        const records = await timeDevPerfAsync(
          'rainproofData.updateTransaction.repositoryUpdate',
          () => repository.updateTransaction(input, optimisticRecords, {
            transactionLinkBatch,
            transactionLinkRecords: optimisticLinkRecords,
          }),
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
        () => ({
          ...getSnapshotPerfCounts(rolledBackSnapshot),
          refresh: 'patched',
        }),
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
        () => ({
          ...getSnapshotPerfCounts(rolledBackSnapshot),
          refresh: 'patched',
        }),
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
        () => ({
          ...getSnapshotPerfCounts(rolledBackSnapshot),
          refresh: 'patched',
        }),
      );
    } else {
      await refresh();
      logDevPerfDuration('rainproofData.addTransaction.rollback', rollbackStartedAt, { refresh: 'full' });
    }
    setError(message);
  }
}

function hasTransactionLinkBatchChanges(input?: TransactionLinkBatchInput): boolean {
  return !!input && (input.toAdd.length > 0 || input.toUpdate.length > 0 || input.deleteIds.length > 0);
}

async function persistOptimisticUpcomingPaymentDueDate({
  input,
  optimisticItem,
  refresh,
  repository,
  rollback,
  rollbackPatch,
  setError,
}: {
  input: UpdateRecurringItemInput;
  optimisticItem: OptimisticRecurringItemStateRollback['item'];
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  rollback: OptimisticRecurringItemStateRollback;
  rollbackPatch: (
    rollback: OptimisticRecurringItemStateRollback,
    optimisticItem: OptimisticRecurringItemStateRollback['item'],
  ) => AppSnapshot | null;
  setError: (message: string) => void;
}): Promise<void> {
  try {
    await timeDevPerfAsync(
      'rainproofData.updateUpcomingPaymentDueDate.backgroundWrite',
      () => repository.updateRecurringItem(input),
      { recurringItemId: input.id },
    );
    logDevPerfDuration('rainproofData.updateUpcomingPaymentDueDate.reconcile', Date.now(), { refresh: 'none' });
    setError('');
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Could not move the upcoming payment due date.';
    const rollbackStartedAt = Date.now();
    const rolledBackSnapshot = rollbackPatch(rollback, optimisticItem);
    if (rolledBackSnapshot) {
      logDevPerfDuration('rainproofData.updateUpcomingPaymentDueDate.rollback', rollbackStartedAt, { refresh: 'patched' });
    } else {
      await refresh();
      logDevPerfDuration('rainproofData.updateUpcomingPaymentDueDate.rollback', rollbackStartedAt, { refresh: 'full' });
    }
    setError(message);
  }
}

async function persistOptimisticUpcomingPaymentTransaction({
  input,
  optimisticItem,
  optimisticRecords,
  refresh,
  repository,
  rollback,
  rollbackPatch,
  setError,
}: {
  input: CreateUpcomingPaymentTransactionInput;
  optimisticItem: OptimisticRecurringItemStateRollback['item'];
  optimisticRecords: AddTransactionPersistenceRecords;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  rollback: OptimisticRecurringItemStateRollback;
  rollbackPatch: (
    rollback: OptimisticRecurringItemStateRollback,
    optimisticItem: OptimisticRecurringItemStateRollback['item'],
    records: AddTransactionPersistenceRecords,
  ) => AppSnapshot | null;
  setError: (message: string) => void;
}): Promise<void> {
  try {
    await timeDevPerfAsync(
      'rainproofData.createUpcomingPaymentTransaction.backgroundWrite',
      () => repository.createUpcomingPaymentTransaction(input, optimisticRecords),
      getNewTransactionInputPerfMetadata(input.transactionInput),
    );
    logDevPerfDuration('rainproofData.createUpcomingPaymentTransaction.reconcile', Date.now(), { refresh: 'none' });
    setError('');
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Could not create upcoming payment transaction.';
    const rollbackStartedAt = Date.now();
    const rolledBackSnapshot = rollbackPatch(rollback, optimisticItem, optimisticRecords);
    if (rolledBackSnapshot) {
      logDevPerfDuration('rainproofData.createUpcomingPaymentTransaction.rollback', rollbackStartedAt, {
        refresh: 'patched',
      });
    } else {
      await refresh();
      logDevPerfDuration('rainproofData.createUpcomingPaymentTransaction.rollback', rollbackStartedAt, {
        refresh: 'full',
      });
    }
    setError(message);
  }
}

async function persistRecurringItemUpdateWithSaving({
  input,
  refresh,
  repository,
  setSaving,
}: {
  input: UpdateRecurringItemInput;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  setSaving: (saving: boolean) => void;
}): Promise<void> {
  try {
    setSaving(true);
    await persistRecurringItemUpdateWithFullRefresh({ input, refresh, repository });
  } finally {
    setSaving(false);
  }
}

async function persistRecurringItemUpdateWithFullRefresh({
  input,
  refresh,
  repository,
}: {
  input: UpdateRecurringItemInput;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
}): Promise<void> {
  await repository.updateRecurringItem(input);
  await refresh();
}

async function persistUpcomingPaymentTransactionWithSaving({
  input,
  optimisticRecords,
  refresh,
  repository,
  setSaving,
}: {
  input: CreateUpcomingPaymentTransactionInput;
  optimisticRecords?: AddTransactionPersistenceRecords;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
  setSaving: (saving: boolean) => void;
}): Promise<void> {
  try {
    setSaving(true);
    await persistUpcomingPaymentTransactionWithFullRefresh({
      input,
      optimisticRecords,
      refresh,
      repository,
    });
  } finally {
    setSaving(false);
  }
}

async function persistUpcomingPaymentTransactionWithFullRefresh({
  input,
  optimisticRecords,
  refresh,
  repository,
}: {
  input: CreateUpcomingPaymentTransactionInput;
  optimisticRecords?: AddTransactionPersistenceRecords;
  refresh: () => Promise<void>;
  repository: FinanceRepository;
}): Promise<void> {
  await repository.createUpcomingPaymentTransaction(input, optimisticRecords);
  await refresh();
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

function areTransactionLinkPersistenceRecordsEqual(
  left: AddTransactionLinkPersistenceRecord | UpdateTransactionLinkPersistenceRecord,
  right: AddTransactionLinkPersistenceRecord | UpdateTransactionLinkPersistenceRecord,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function areTransactionLinkBatchPersistenceRecordsEqual(
  left: TransactionLinkBatchPersistenceRecords,
  right: TransactionLinkBatchPersistenceRecords,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
