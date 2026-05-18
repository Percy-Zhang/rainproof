import { normalizeCurrencyCode } from '../domain/money';
import type {
  AppSnapshot,
  NewAccountInput,
  NewBudgetInput,
  NewRecurringBillInput,
  NewTransactionInput,
  NewTransactionLinkInput,
  TransactionLink,
  UpdateAccountInput,
  UpdateAppSettingsInput,
  UpdateCategoryCatalogInput,
  UpdateRainyDayFundInput,
  UpdateTransactionInput,
  UpdateTransactionLinkInput,
} from '../domain/types';
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
import { runMigrations } from './migrations';
import { addBudgetStorage, addRecurringBillStorage } from './planningStorage';
import { ensureRainyDayFund, updateRainyDayFundStorage } from './rainyDayStorage';
import {
  ensureDemoSampleDataVersionStorage,
  seedDemoFirstRunStorage,
} from './seedStorage';
import {
  initializeRequiredSettings,
  updateCategoryCatalogStorage,
  updateDashboardSelectedAccountIdsStorage,
  updateSettingsStorage,
} from './settingsStorage';
import { getSnapshotStorage } from './snapshotStorage';
import {
  addTransactionLinkStorage,
  deleteTransactionLinkStorage,
  getTransactionLinksForSourceTransactionStorage,
  getTransactionLinksForTargetTransactionStorage,
  getTransactionLinksForTransactionStorage,
  getTransactionLinksStorage,
  removeTransactionLinksForTransactionStorage,
  updateTransactionLinkStorage,
} from './transactionLinkStorage';
import {
  addTransactionStorage,
  deleteTransactionStorage,
  updateTransactionStorage,
} from './transactionStorage';
import { shouldSeedDemoData } from './seedConfig';

export type { RepositoryDatabase } from './database';

export type FinanceRepository = {
  initialize(defaultCurrencyCode: string): Promise<void>;
  getSnapshot(): Promise<AppSnapshot>;
  addAccount(input: NewAccountInput): Promise<void>;
  updateAccount(input: UpdateAccountInput): Promise<void>;
  addTransaction(input: NewTransactionInput): Promise<void>;
  updateTransaction(input: UpdateTransactionInput): Promise<void>;
  deleteTransaction(transactionId: string): Promise<void>;
  addTransactionLink(input: NewTransactionLinkInput): Promise<void>;
  updateTransactionLink(input: UpdateTransactionLinkInput): Promise<void>;
  deleteTransactionLink(linkId: string): Promise<void>;
  getTransactionLinks(): Promise<TransactionLink[]>;
  getTransactionLinksForSourceTransaction(transactionId: string): Promise<TransactionLink[]>;
  getTransactionLinksForTargetTransaction(transactionId: string): Promise<TransactionLink[]>;
  getTransactionLinksForTransaction(transactionId: string): Promise<TransactionLink[]>;
  removeTransactionLinksForTransaction(transactionId: string): Promise<void>;
  addBudget(input: NewBudgetInput): Promise<void>;
  addRecurringBill(input: NewRecurringBillInput): Promise<void>;
  updateRainyDayFund(input: UpdateRainyDayFundInput): Promise<void>;
  updateSettings(input: UpdateAppSettingsInput): Promise<void>;
  updateCategoryCatalog(input: UpdateCategoryCatalogInput): Promise<void>;
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
  constructor(private readonly db: RepositoryDatabase) {}

  async initialize(defaultCurrencyCode: string): Promise<void> {
    const currencyCode = normalizeCurrencyCode(defaultCurrencyCode);

    await runMigrations(this.db);
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
    return getSnapshotStorage(this.db);
  }

  async addAccount(input: NewAccountInput): Promise<void> {
    return addAccountStorage(this.db, input);
  }

  async updateAccount(input: UpdateAccountInput): Promise<void> {
    return updateAccountStorage(this.db, input);
  }

  async addTransaction(input: NewTransactionInput): Promise<void> {
    return addTransactionStorage(this.db, input);
  }

  async updateTransaction(input: UpdateTransactionInput): Promise<void> {
    return updateTransactionStorage(this.db, input);
  }

  async deleteTransaction(transactionId: string): Promise<void> {
    return deleteTransactionStorage(this.db, transactionId);
  }

  async addTransactionLink(input: NewTransactionLinkInput): Promise<void> {
    return addTransactionLinkStorage(this.db, input);
  }

  async updateTransactionLink(input: UpdateTransactionLinkInput): Promise<void> {
    return updateTransactionLinkStorage(this.db, input);
  }

  async deleteTransactionLink(linkId: string): Promise<void> {
    return deleteTransactionLinkStorage(this.db, linkId);
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

  async addRecurringBill(input: NewRecurringBillInput): Promise<void> {
    return addRecurringBillStorage(this.db, input);
  }

  async updateRainyDayFund(input: UpdateRainyDayFundInput): Promise<void> {
    return updateRainyDayFundStorage(this.db, input);
  }

  async updateSettings(input: UpdateAppSettingsInput): Promise<void> {
    return updateSettingsStorage(this.db, input);
  }

  async updateCategoryCatalog(input: UpdateCategoryCatalogInput): Promise<void> {
    return updateCategoryCatalogStorage(this.db, input);
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
}
