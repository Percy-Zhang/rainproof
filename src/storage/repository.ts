import { normalizeCurrencyCode } from '../domain/money';
import type {
  AppSnapshot,
  NewAccountInput,
  NewBudgetInput,
  Budget,
  CreateRecurringTransactionInput,
  CreateUpcomingPaymentTransactionInput,
  NewRecurringItemInput,
  NewTransactionTemplateInput,
  RecurringItem,
  TransactionTemplate,
  NewTransactionInput,
  NewTransactionLinkInput,
  Transaction,
  TransactionLinkBatchInput,
  TransactionLink,
  TransactionLine,
  UpdateAccountInput,
  UpdateAddTransactionDefaultsInput,
  UpdateAppSettingsInput,
  UpdateCategoryCatalogInput,
  UpdateDashboardCardSettingsInput,
  UpdateBudgetInput,
  UpdateRecurringItemInput,
  UpdateTransactionTemplateInput,
  UpdateRainyDayFundInput,
  UpdateTransactionInput,
  UpdateTransactionLinkInput,
} from '../domain/types';
import type { RainproofBackup } from '../domain/backupExport';
import {
  addAccountStorage,
  closeAccountStorage,
  deleteAccountStorage,
  ensureAccountSortOrderStorage,
  reopenAccountStorage,
  updateAccountDashboardVisibilityStorage,
  updateAccountOrderStorage,
  updateAccountStorage,
} from './accountStorage';
import type { RepositoryDatabase } from './database';
import type { CountRow } from './mappers';
import { ensureRecurringItemsUpcomingPaymentCompatibility, runMigrations } from './migrations';
import {
  addBudgetStorage,
  addRecurringItemStorage,
  archiveBudgetStorage,
  archiveRecurringItemStorage,
  deleteRecurringItemStorage,
  listBudgetsStorage,
  listRecurringItemsStorage,
  updateBudgetOrderStorage,
  updateBudgetStorage,
  updateRecurringItemStorage,
} from './planningStorage';
import { ensureRainyDayFund, updateRainyDayFundStorage } from './rainyDayStorage';
import {
  createUpcomingPaymentTransactionStorage,
  createRecurringTransactionStorage,
  undoLatestRecurringTransactionStorage,
} from './recurringTransactionStorage';
import {
  ensureDemoSampleDataVersionStorage,
  seedDemoFirstRunStorage,
} from './seedStorage';
import {
  initializeRequiredSettings,
  updateAddTransactionDefaultsStorage,
  updateCategoryCatalogStorage,
  updateDashboardCardSettingsStorage,
  updateDashboardSelectedAccountIdsStorage,
  updateSettingsStorage,
} from './settingsStorage';
import { getSnapshotStorage } from './snapshotStorage';
import {
  addTransactionLinkStorage,
  createAddTransactionLinkStorageRecord,
  createTransactionLinkBatchStorageRecords,
  createUpdateTransactionLinkStorageRecord,
  deleteTransactionLinkStorage,
  getTransactionLinksForSourceTransactionStorage,
  getTransactionLinksForTargetTransactionStorage,
  getTransactionLinksForTransactionStorage,
  getTransactionLinksStorage,
  removeTransactionLinksForTransactionStorage,
  saveTransactionLinkBatchStorage,
  type TransactionLinkBatchStorageRecords,
  updateTransactionLinkStorage,
} from './transactionLinkStorage';
import {
  addTransactionStorage,
  createAddTransactionStorageRecords,
  createUpdateTransactionStorageRecords,
  type AddTransactionStorageResult,
  type UpdateTransactionStorageOptions,
  type UpdateTransactionStorageResult,
  deleteTransactionStorage,
  updateTransactionStorage,
} from './transactionStorage';
import {
  addTransactionTemplateStorage,
  archiveTransactionTemplateStorage,
  deleteTransactionTemplateStorage,
  listTransactionTemplatesStorage,
  updateTransactionTemplateStorage,
} from './transactionTemplateStorage';
import { shouldSeedDemoData } from './seedConfig';
import { restoreRainproofBackupStorage } from './backupRestoreStorage';

export type { RepositoryDatabase } from './database';

export type FinanceRepository = {
  initialize(defaultCurrencyCode: string): Promise<void>;
  getSnapshot(): Promise<AppSnapshot>;
  restoreBackup(backup: RainproofBackup): Promise<void>;
  addAccount(input: NewAccountInput): Promise<void>;
  updateAccount(input: UpdateAccountInput): Promise<void>;
  prepareAddTransaction(input: NewTransactionInput): AddTransactionStorageResult;
  addTransaction(input: NewTransactionInput, records?: AddTransactionStorageResult): Promise<AddTransactionStorageResult>;
  prepareUpdateTransaction(
    input: UpdateTransactionInput,
    existingTransaction: Transaction,
    existingLines: TransactionLine[],
  ): UpdateTransactionStorageResult;
  updateTransaction(
    input: UpdateTransactionInput,
    records?: UpdateTransactionStorageResult,
    options?: UpdateTransactionStorageOptions,
  ): Promise<UpdateTransactionStorageResult>;
  deleteTransaction(transactionId: string): Promise<void>;
  prepareAddTransactionLink(
    input: NewTransactionLinkInput,
    validationState: Pick<AppSnapshot, 'transactions' | 'transactionLines' | 'transactionLinks'>,
  ): TransactionLink;
  addTransactionLink(input: NewTransactionLinkInput, record?: TransactionLink): Promise<TransactionLink>;
  prepareUpdateTransactionLink(
    input: UpdateTransactionLinkInput,
    existingLink: TransactionLink,
    validationState: Pick<AppSnapshot, 'transactions' | 'transactionLines' | 'transactionLinks'>,
  ): TransactionLink;
  updateTransactionLink(input: UpdateTransactionLinkInput, record?: TransactionLink): Promise<TransactionLink>;
  deleteTransactionLink(linkId: string): Promise<void>;
  prepareTransactionLinkBatch(
    input: TransactionLinkBatchInput,
    validationState: Pick<AppSnapshot, 'transactions' | 'transactionLines' | 'transactionLinks'>,
  ): TransactionLinkBatchStorageRecords;
  saveTransactionLinkBatch(
    input: TransactionLinkBatchInput,
    records?: TransactionLinkBatchStorageRecords,
  ): Promise<TransactionLinkBatchStorageRecords>;
  getTransactionLinks(): Promise<TransactionLink[]>;
  getTransactionLinksForSourceTransaction(transactionId: string): Promise<TransactionLink[]>;
  getTransactionLinksForTargetTransaction(transactionId: string): Promise<TransactionLink[]>;
  getTransactionLinksForTransaction(transactionId: string): Promise<TransactionLink[]>;
  removeTransactionLinksForTransaction(transactionId: string): Promise<void>;
  listBudgets(): Promise<Budget[]>;
  addBudget(input: NewBudgetInput): Promise<void>;
  updateBudget(input: UpdateBudgetInput): Promise<void>;
  updateBudgetOrder(budgetIds: string[]): Promise<void>;
  archiveBudget(budgetId: string): Promise<void>;
  listRecurringItems(): Promise<RecurringItem[]>;
  addRecurringItem(input: NewRecurringItemInput): Promise<void>;
  updateRecurringItem(input: UpdateRecurringItemInput): Promise<void>;
  createUpcomingPaymentTransaction(
    input: CreateUpcomingPaymentTransactionInput,
    records?: AddTransactionStorageResult,
  ): Promise<void>;
  createRecurringTransaction(input: CreateRecurringTransactionInput): Promise<void>;
  undoLatestRecurringTransaction(recurringItemId: string): Promise<boolean>;
  archiveRecurringItem(recurringItemId: string): Promise<void>;
  deleteRecurringItem(recurringItemId: string): Promise<void>;
  listTransactionTemplates(): Promise<TransactionTemplate[]>;
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
};

export async function createSQLiteFinanceRepository(): Promise<FinanceRepository> {
  const SQLiteModule = await import('expo-sqlite');
  const db = await SQLiteModule.openDatabaseAsync('rainproof.db');
  return createSQLiteFinanceRepositoryForDatabase(db);
}

export function createSQLiteFinanceRepositoryForDatabase(db: RepositoryDatabase): FinanceRepository {
  return new SQLiteFinanceRepository(db);
}

class SQLiteFinanceRepository implements FinanceRepository {
  private recurringItemsSchemaReady = false;

  constructor(private readonly db: RepositoryDatabase) {}

  async initialize(defaultCurrencyCode: string): Promise<void> {
    const currencyCode = normalizeCurrencyCode(defaultCurrencyCode);

    await runMigrations(this.db);
    await this.ensureRecurringItemsSchemaReady();
    await initializeRequiredSettings(this.db, currencyCode);

    const seedDemoData = shouldSeedDemoData();
    const accountCount = await this.db.getFirstAsync<CountRow>('SELECT COUNT(*) as count FROM accounts');
    if (!accountCount?.count && seedDemoData) {
      await seedDemoFirstRunStorage(this.db, currencyCode);
    }

    await ensureRainyDayFund(this.db, currencyCode);
    if (seedDemoData) {
      await ensureDemoSampleDataVersionStorage(this.db, currencyCode);
    }
    await ensureAccountSortOrderStorage(this.db);
  }

  async getSnapshot(): Promise<AppSnapshot> {
    await this.ensureRecurringItemsSchemaReady();
    return getSnapshotStorage(this.db);
  }

  async restoreBackup(backup: RainproofBackup): Promise<void> {
    await this.ensureRecurringItemsSchemaReady();
    return restoreRainproofBackupStorage(this.db, backup.data);
  }

  async addAccount(input: NewAccountInput): Promise<void> {
    return addAccountStorage(this.db, input);
  }

  async updateAccount(input: UpdateAccountInput): Promise<void> {
    return updateAccountStorage(this.db, input);
  }

  prepareAddTransaction(input: NewTransactionInput): AddTransactionStorageResult {
    return createAddTransactionStorageRecords(input);
  }

  async addTransaction(
    input: NewTransactionInput,
    records?: AddTransactionStorageResult,
  ): Promise<AddTransactionStorageResult> {
    return addTransactionStorage(this.db, input, records);
  }

  prepareUpdateTransaction(
    input: UpdateTransactionInput,
    existingTransaction: Transaction,
    existingLines: TransactionLine[],
  ): UpdateTransactionStorageResult {
    return createUpdateTransactionStorageRecords(input, existingTransaction, existingLines);
  }

  async updateTransaction(
    input: UpdateTransactionInput,
    records?: UpdateTransactionStorageResult,
    options?: UpdateTransactionStorageOptions,
  ): Promise<UpdateTransactionStorageResult> {
    return updateTransactionStorage(this.db, input, records, options);
  }

  async deleteTransaction(transactionId: string): Promise<void> {
    return deleteTransactionStorage(this.db, transactionId);
  }

  prepareAddTransactionLink(
    input: NewTransactionLinkInput,
    validationState: Pick<AppSnapshot, 'transactions' | 'transactionLines' | 'transactionLinks'>,
  ): TransactionLink {
    return createAddTransactionLinkStorageRecord(input, {
      transactions: validationState.transactions,
      lines: validationState.transactionLines,
      links: validationState.transactionLinks,
    });
  }

  async addTransactionLink(input: NewTransactionLinkInput, record?: TransactionLink): Promise<TransactionLink> {
    return addTransactionLinkStorage(this.db, input, record);
  }

  prepareUpdateTransactionLink(
    input: UpdateTransactionLinkInput,
    existingLink: TransactionLink,
    validationState: Pick<AppSnapshot, 'transactions' | 'transactionLines' | 'transactionLinks'>,
  ): TransactionLink {
    return createUpdateTransactionLinkStorageRecord(input, existingLink, {
      transactions: validationState.transactions,
      lines: validationState.transactionLines,
      links: validationState.transactionLinks,
    });
  }

  async updateTransactionLink(input: UpdateTransactionLinkInput, record?: TransactionLink): Promise<TransactionLink> {
    return updateTransactionLinkStorage(this.db, input, record);
  }

  async deleteTransactionLink(linkId: string): Promise<void> {
    return deleteTransactionLinkStorage(this.db, linkId);
  }

  prepareTransactionLinkBatch(
    input: TransactionLinkBatchInput,
    validationState: Pick<AppSnapshot, 'transactions' | 'transactionLines' | 'transactionLinks'>,
  ): TransactionLinkBatchStorageRecords {
    return createTransactionLinkBatchStorageRecords(input, {
      transactions: validationState.transactions,
      lines: validationState.transactionLines,
      links: validationState.transactionLinks,
    });
  }

  async saveTransactionLinkBatch(
    input: TransactionLinkBatchInput,
    records?: TransactionLinkBatchStorageRecords,
  ): Promise<TransactionLinkBatchStorageRecords> {
    return saveTransactionLinkBatchStorage(this.db, input, records);
  }

  async getTransactionLinks(): Promise<TransactionLink[]> {
    return getTransactionLinksStorage(this.db);
  }

  async getTransactionLinksForSourceTransaction(transactionId: string): Promise<TransactionLink[]> {
    return getTransactionLinksForSourceTransactionStorage(this.db, transactionId);
  }

  async getTransactionLinksForTargetTransaction(transactionId: string): Promise<TransactionLink[]> {
    return getTransactionLinksForTargetTransactionStorage(this.db, transactionId);
  }

  async getTransactionLinksForTransaction(transactionId: string): Promise<TransactionLink[]> {
    return getTransactionLinksForTransactionStorage(this.db, transactionId);
  }

  async removeTransactionLinksForTransaction(transactionId: string): Promise<void> {
    return removeTransactionLinksForTransactionStorage(this.db, transactionId);
  }

  async addBudget(input: NewBudgetInput): Promise<void> {
    return addBudgetStorage(this.db, input);
  }

  async listBudgets(): Promise<Budget[]> {
    return listBudgetsStorage(this.db);
  }

  async updateBudget(input: UpdateBudgetInput): Promise<void> {
    return updateBudgetStorage(this.db, input);
  }

  async updateBudgetOrder(budgetIds: string[]): Promise<void> {
    return updateBudgetOrderStorage(this.db, budgetIds);
  }

  async archiveBudget(budgetId: string): Promise<void> {
    return archiveBudgetStorage(this.db, budgetId);
  }

  async listRecurringItems(): Promise<RecurringItem[]> {
    await this.ensureRecurringItemsSchemaReady();
    return listRecurringItemsStorage(this.db);
  }

  async addRecurringItem(input: NewRecurringItemInput): Promise<void> {
    await this.ensureRecurringItemsSchemaReady();
    return addRecurringItemStorage(this.db, input);
  }

  async updateRecurringItem(input: UpdateRecurringItemInput): Promise<void> {
    await this.ensureRecurringItemsSchemaReady();
    return updateRecurringItemStorage(this.db, input);
  }

  async createUpcomingPaymentTransaction(
    input: CreateUpcomingPaymentTransactionInput,
    records?: AddTransactionStorageResult,
  ): Promise<void> {
    await this.ensureRecurringItemsSchemaReady();
    return createUpcomingPaymentTransactionStorage(this.db, input, records);
  }

  async createRecurringTransaction(input: CreateRecurringTransactionInput): Promise<void> {
    return createRecurringTransactionStorage(this.db, input);
  }

  async undoLatestRecurringTransaction(recurringItemId: string): Promise<boolean> {
    return undoLatestRecurringTransactionStorage(this.db, recurringItemId);
  }

  async archiveRecurringItem(recurringItemId: string): Promise<void> {
    return archiveRecurringItemStorage(this.db, recurringItemId);
  }

  async deleteRecurringItem(recurringItemId: string): Promise<void> {
    return deleteRecurringItemStorage(this.db, recurringItemId);
  }

  async listTransactionTemplates(): Promise<TransactionTemplate[]> {
    return listTransactionTemplatesStorage(this.db);
  }

  async addTransactionTemplate(input: NewTransactionTemplateInput): Promise<void> {
    return addTransactionTemplateStorage(this.db, input);
  }

  async updateTransactionTemplate(input: UpdateTransactionTemplateInput): Promise<void> {
    return updateTransactionTemplateStorage(this.db, input);
  }

  async archiveTransactionTemplate(templateId: string): Promise<void> {
    return archiveTransactionTemplateStorage(this.db, templateId);
  }

  async deleteTransactionTemplate(templateId: string): Promise<void> {
    return deleteTransactionTemplateStorage(this.db, templateId);
  }

  async updateRainyDayFund(input: UpdateRainyDayFundInput): Promise<void> {
    return updateRainyDayFundStorage(this.db, input);
  }

  async updateSettings(input: UpdateAppSettingsInput): Promise<void> {
    return updateSettingsStorage(this.db, input);
  }

  async updateAddTransactionDefaults(input: UpdateAddTransactionDefaultsInput): Promise<void> {
    return updateAddTransactionDefaultsStorage(this.db, input);
  }

  async updateCategoryCatalog(input: UpdateCategoryCatalogInput): Promise<void> {
    return updateCategoryCatalogStorage(this.db, input);
  }

  async updateDashboardCardSettings(input: UpdateDashboardCardSettingsInput): Promise<void> {
    return updateDashboardCardSettingsStorage(this.db, input);
  }

  async updateDashboardSelectedAccountIds(accountIds: string[]): Promise<void> {
    return updateDashboardSelectedAccountIdsStorage(this.db, accountIds);
  }

  async updateAccountDashboardVisibility(accountId: string, showOnDashboard: boolean): Promise<void> {
    return updateAccountDashboardVisibilityStorage(this.db, accountId, showOnDashboard);
  }

  async updateAccountOrder(accountIds: string[]): Promise<void> {
    return updateAccountOrderStorage(this.db, accountIds);
  }

  async closeAccount(accountId: string): Promise<void> {
    return closeAccountStorage(this.db, accountId);
  }

  async reopenAccount(accountId: string): Promise<void> {
    return reopenAccountStorage(this.db, accountId);
  }

  async deleteAccount(accountId: string): Promise<void> {
    return deleteAccountStorage(this.db, accountId);
  }

  private async ensureRecurringItemsSchemaReady(): Promise<void> {
    if (this.recurringItemsSchemaReady) {
      return;
    }

    await ensureRecurringItemsUpcomingPaymentCompatibility(this.db);
    this.recurringItemsSchemaReady = true;
  }
}
