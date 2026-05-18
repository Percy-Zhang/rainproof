import * as SQLite from 'expo-sqlite';

import {
  normalizeAccountIconName,
  normalizeAccountThemeColor,
} from '../domain/accountThemes';
import { defaultCategories, sanitizeCategoryCatalog } from '../domain/categories';
import { getDefaultEnabledCurrencyCodes, uniqueCurrencyCodes } from '../domain/currencyCatalog';
import { normalizeCurrencyCode } from '../domain/money';
import { validateTransactionLinkInput } from '../domain/transactionLinks';
import type {
  AccountType,
  AppSnapshot,
  NewAccountInput,
  NewBudgetInput,
  NewRecurringBillInput,
  NewTransactionLinkInput,
  NewTransactionInput,
  RainyDayFund,
  Transaction,
  TransactionKind,
  TransactionLine,
  TransactionLink,
  UpdateCategoryCatalogInput,
  UpdateAppSettingsInput,
  UpdateAccountInput,
  UpdateRainyDayFundInput,
  UpdateTransactionLinkInput,
  UpdateTransactionInput,
} from '../domain/types';
import { createLocalId } from './ids';
import {
  type AccountRow,
  type BudgetRow,
  type CountRow,
  type LinkedAccountRow,
  mapAccount,
  mapBudget,
  mapRainyDayFund,
  mapRecurringBill,
  mapTransaction,
  mapTransactionLine,
  mapTransactionLink,
  type RainyDayFundRow,
  type RecurringBillRow,
  safeParseCurrencyCodes,
  safeParseJson,
  safeParseNullableStringArray,
  type SettingRow,
  type TableColumnRow,
  type TransactionLineRow,
  type TransactionLinkRow,
  type TransactionRow,
} from './mappers';
import { runMigrations } from './migrations';
import {
  getExpandedSampleAccounts,
  getExpandedSampleBudgets,
  getExpandedSampleRecurringBills,
  getExpandedSampleTransactions,
  SAMPLE_DATA_VERSION,
  type SeedTransactionLine,
} from './sampleData';
import { shouldSeedDemoData } from './seedConfig';

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
  const db = await SQLite.openDatabaseAsync('rainproof.db');
  return new SQLiteFinanceRepository(db);
}

class SQLiteFinanceRepository implements FinanceRepository {
  constructor(private readonly db: SQLite.SQLiteDatabase) {}

  async initialize(defaultCurrencyCode: string): Promise<void> {
    const currencyCode = normalizeCurrencyCode(defaultCurrencyCode);

    await runMigrations(this.db);
    await this.db.runAsync(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
      'default_currency_code',
      currencyCode,
    );
    await this.db.runAsync(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
      'multi_currency_enabled',
      'false',
    );
    await this.db.runAsync(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
      'enabled_currency_codes',
      JSON.stringify(getDefaultEnabledCurrencyCodes(currencyCode)),
    );
    await this.db.runAsync(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
      'category_catalog_json',
      JSON.stringify(defaultCategories),
    );

    const seedDemoData = shouldSeedDemoData();
    const accountCount = await this.db.getFirstAsync<CountRow>('SELECT COUNT(*) as count FROM accounts');
    if (!accountCount?.count && seedDemoData) {
      await this.seedDemoFirstRun(currencyCode);
    }

    await this.ensureRainyDayFund(currencyCode);
    if (seedDemoData) {
      await this.ensureDemoSampleDataVersion(currencyCode);
    }
    await this.ensureAccountSortOrder();
  }

  async getSnapshot(): Promise<AppSnapshot> {
    const defaultCurrency =
      (await this.db.getFirstAsync<SettingRow>(
        'SELECT value FROM settings WHERE key = ?',
        'default_currency_code',
      ))?.value ?? 'USD';
    const accountRows = await this.db.getAllAsync<AccountRow>(
      'SELECT * FROM accounts ORDER BY sort_order ASC, created_at ASC',
    );
    const transactionRows = await this.db.getAllAsync<TransactionRow>(
      'SELECT * FROM transactions ORDER BY datetime DESC, created_at DESC, id DESC',
    );
    const lineRows = await this.db.getAllAsync<TransactionLineRow>(
      'SELECT * FROM transaction_lines ORDER BY created_at ASC',
    );
    const linkRows = await this.db.getAllAsync<TransactionLinkRow>(
      'SELECT * FROM transaction_links ORDER BY created_at ASC, id ASC',
    );
    const budgetRows = await this.db.getAllAsync<BudgetRow>('SELECT * FROM budgets ORDER BY category_id ASC');
    const billRows = await this.db.getAllAsync<RecurringBillRow>(
      'SELECT * FROM recurring_bills ORDER BY due_day ASC',
    );
    const storedEnabledCurrencyCodes = safeParseCurrencyCodes(
      (await this.db.getFirstAsync<SettingRow>(
        'SELECT value FROM settings WHERE key = ?',
        'enabled_currency_codes',
      ))?.value,
    );
    const dashboardSelectedAccountIds = safeParseNullableStringArray(
      (await this.db.getFirstAsync<SettingRow>(
        'SELECT value FROM settings WHERE key = ?',
        'dashboard_selected_account_ids',
      ))?.value,
    );
    const categories = sanitizeCategoryCatalog(
      safeParseJson(
        (await this.db.getFirstAsync<SettingRow>(
          'SELECT value FROM settings WHERE key = ?',
          'category_catalog_json',
        ))?.value,
      ),
    );
    const fundRow = await this.db.getFirstAsync<RainyDayFundRow>('SELECT * FROM rainy_day_funds LIMIT 1');

    let rainyDayFund: RainyDayFund;
    if (fundRow) {
      const linkedRows = await this.db.getAllAsync<LinkedAccountRow>(
        'SELECT account_id FROM rainy_day_fund_accounts WHERE fund_id = ?',
        fundRow.id,
      );
      rainyDayFund = mapRainyDayFund(fundRow, linkedRows.map((row) => row.account_id));
    } else {
      const now = new Date().toISOString();
      rainyDayFund = {
        id: 'fund_missing',
        name: 'Rainy day fund',
        currencyCode: normalizeCurrencyCode(defaultCurrency),
        goalMinor: 0,
        linkedAccountIds: [],
        createdAt: now,
        updatedAt: now,
      };
    }

    const defaultCurrencyCode = normalizeCurrencyCode(defaultCurrency);
    const enabledCurrencyCodes = uniqueCurrencyCodes([
      defaultCurrencyCode,
      ...storedEnabledCurrencyCodes,
      ...accountRows.map((account) => account.currency_code),
    ]);
    const accountCurrencyCodes = uniqueCurrencyCodes(accountRows.map((account) => account.currency_code));

    return {
      defaultCurrencyCode,
      settings: {
        defaultCurrencyCode,
        multiCurrencyEnabled: accountCurrencyCodes.length > 1,
        enabledCurrencyCodes,
        dashboardSelectedAccountIds,
      },
      categories,
      accounts: accountRows.map(mapAccount),
      transactions: transactionRows.map(mapTransaction),
      transactionLines: lineRows.map(mapTransactionLine),
      transactionLinks: linkRows.map(mapTransactionLink),
      budgets: budgetRows.map(mapBudget),
      recurringBills: billRows.map(mapRecurringBill),
      rainyDayFund,
    };
  }

  async addAccount(input: NewAccountInput): Promise<void> {
    const now = new Date().toISOString();
    const id = createLocalId('acct');
    const currencyCode = normalizeCurrencyCode(input.currencyCode);

    await this.db.runAsync(
      `INSERT INTO accounts (
        id, name, nickname, type, currency_code, opening_balance_minor, notes, institution_name,
        include_in_rainy_day, theme_color, icon_name, show_on_dashboard, sort_order, is_archived, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      id,
      input.name.trim() || 'New account',
      input.nickname?.trim() ?? '',
      input.type,
      currencyCode,
      input.openingBalanceMinor,
      input.notes?.trim() ?? '',
      input.institutionName?.trim() ?? '',
      input.includeInRainyDay ? 1 : 0,
      normalizeAccountThemeColor(input.themeColor),
      normalizeAccountIconName(input.iconName, input.type),
      input.showOnDashboard === false ? 0 : 1,
      await this.getNextAccountSortOrder(),
      now,
      now,
    );

    if (input.includeInRainyDay) {
      await this.linkAccountToRainyFundIfCompatible(id, currencyCode);
    }

    await this.addAccountToStoredDashboardSelection(id);
  }

  async updateAccount(input: UpdateAccountInput): Promise<void> {
    const now = new Date().toISOString();
    const existingAccount = await this.db.getFirstAsync<AccountRow>('SELECT * FROM accounts WHERE id = ?', input.id);
    await this.db.runAsync(
      `UPDATE accounts
       SET name = ?, nickname = ?, notes = ?, institution_name = ?, include_in_rainy_day = ?,
           theme_color = ?, icon_name = ?, updated_at = ?
       WHERE id = ?`,
      input.name.trim() || 'Untitled account',
      input.nickname.trim(),
      input.notes.trim(),
      input.institutionName.trim(),
      input.includeInRainyDay ? 1 : 0,
      normalizeAccountThemeColor(input.themeColor),
      normalizeAccountIconName(input.iconName, existingAccount?.type),
      now,
      input.id,
    );

    const account = await this.db.getFirstAsync<AccountRow>('SELECT * FROM accounts WHERE id = ?', input.id);
    const fund = await this.db.getFirstAsync<RainyDayFundRow>('SELECT * FROM rainy_day_funds LIMIT 1');
    if (!account || !fund) {
      return;
    }

    await this.db.runAsync(
      'DELETE FROM rainy_day_fund_accounts WHERE account_id = ?',
      input.id,
    );
    if (input.includeInRainyDay && account.currency_code === fund.currency_code) {
      await this.db.runAsync(
        'INSERT OR IGNORE INTO rainy_day_fund_accounts (fund_id, account_id) VALUES (?, ?)',
        fund.id,
        input.id,
      );
    }
  }

  async addTransaction(input: NewTransactionInput): Promise<void> {
    if (!input.lines.length) {
      throw new Error('Add at least one transaction line.');
    }

    const now = new Date().toISOString();
    const transactionId = createLocalId('txn');

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO transactions (
          id, kind, title, datetime, notes, labels_json, group_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        transactionId,
        input.kind,
        input.title.trim() || fallbackTransactionTitle(input.kind),
        input.datetime,
        input.notes?.trim() ?? '',
        JSON.stringify(input.labels ?? []),
        input.groupId?.trim() ?? '',
        now,
        now,
      );

      for (const line of input.lines) {
        await this.db.runAsync(
          `INSERT INTO transaction_lines (
            id, transaction_id, account_id, amount_minor, currency_code, category_id,
            subcategory_id, external_party, transfer_peer_account_id, note, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          createLocalId('line'),
          transactionId,
          line.accountId,
          line.amountMinor,
          normalizeCurrencyCode(line.currencyCode),
          line.categoryId ?? '',
          line.subcategoryId ?? '',
          line.externalParty?.trim() ?? '',
          line.transferPeerAccountId ?? '',
          line.note?.trim() ?? '',
          now,
        );
      }
    });
  }

  async updateTransaction(input: UpdateTransactionInput): Promise<void> {
    if (!input.lines.length) {
      throw new Error('Add at least one transaction line.');
    }

    const now = new Date().toISOString();
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `UPDATE transactions
         SET kind = ?, title = ?, datetime = ?, notes = ?, labels_json = ?, group_id = ?, updated_at = ?
         WHERE id = ?`,
        input.kind,
        input.title.trim() || fallbackTransactionTitle(input.kind),
        input.datetime,
        input.notes?.trim() ?? '',
        JSON.stringify(input.labels ?? []),
        input.groupId?.trim() ?? '',
        now,
        input.id,
      );

      await this.db.runAsync('DELETE FROM transaction_lines WHERE transaction_id = ?', input.id);

      for (const line of input.lines) {
        await this.db.runAsync(
          `INSERT INTO transaction_lines (
            id, transaction_id, account_id, amount_minor, currency_code, category_id,
            subcategory_id, external_party, transfer_peer_account_id, note, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          createLocalId('line'),
          input.id,
          line.accountId,
          line.amountMinor,
          normalizeCurrencyCode(line.currencyCode),
          line.categoryId ?? '',
          line.subcategoryId ?? '',
          line.externalParty?.trim() ?? '',
          line.transferPeerAccountId ?? '',
          line.note?.trim() ?? '',
          now,
        );
      }
    });
  }

  async deleteTransaction(transactionId: string): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      const transaction = await this.db.getFirstAsync<TransactionRow>(
        'SELECT * FROM transactions WHERE id = ?',
        transactionId,
      );
      if (!transaction) {
        throw new Error('Transaction not found.');
      }

      await this.removeTransactionLinksForTransaction(transactionId);
      await this.deleteTransactionLinkedRecords(transactionId);
      await this.db.runAsync('DELETE FROM transaction_lines WHERE transaction_id = ?', transactionId);
      await this.db.runAsync('DELETE FROM transactions WHERE id = ?', transactionId);
    });
  }

  async addTransactionLink(input: NewTransactionLinkInput): Promise<void> {
    const now = new Date().toISOString();

    await this.db.withTransactionAsync(async () => {
      const { transactions, lines, links } = await this.getTransactionLinkValidationState();
      const validated = validateTransactionLinkInput({
        input,
        transactions,
        lines,
        existingLinks: links,
      });

      await this.db.runAsync(
        `INSERT INTO transaction_links (
          id, source_transaction_id, target_transaction_id, link_type, amount_minor,
          currency_code, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        createLocalId('link'),
        validated.sourceTransactionId,
        validated.targetTransactionId,
        validated.linkType,
        validated.amountMinor,
        validated.currencyCode,
        now,
        now,
      );
    });
  }

  async updateTransactionLink(input: UpdateTransactionLinkInput): Promise<void> {
    const now = new Date().toISOString();

    await this.db.withTransactionAsync(async () => {
      const existingLink = await this.db.getFirstAsync<TransactionLinkRow>(
        'SELECT * FROM transaction_links WHERE id = ?',
        input.id,
      );
      if (!existingLink) {
        throw new Error('Transaction link not found.');
      }

      const { transactions, lines, links } = await this.getTransactionLinkValidationState();
      const validated = validateTransactionLinkInput({
        input,
        transactions,
        lines,
        existingLinks: links,
        currentLinkId: input.id,
      });

      await this.db.runAsync(
        `UPDATE transaction_links
         SET source_transaction_id = ?, target_transaction_id = ?, link_type = ?,
             amount_minor = ?, currency_code = ?, updated_at = ?
         WHERE id = ?`,
        validated.sourceTransactionId,
        validated.targetTransactionId,
        validated.linkType,
        validated.amountMinor,
        validated.currencyCode,
        now,
        input.id,
      );
    });
  }

  async deleteTransactionLink(linkId: string): Promise<void> {
    await this.db.runAsync('DELETE FROM transaction_links WHERE id = ?', linkId);
  }

  async getTransactionLinks(): Promise<TransactionLink[]> {
    return this.getAllTransactionLinks();
  }

  async getTransactionLinksForSourceTransaction(transactionId: string): Promise<TransactionLink[]> {
    const rows = await this.db.getAllAsync<TransactionLinkRow>(
      'SELECT * FROM transaction_links WHERE source_transaction_id = ? ORDER BY created_at ASC, id ASC',
      transactionId,
    );
    return rows.map(mapTransactionLink);
  }

  async getTransactionLinksForTargetTransaction(transactionId: string): Promise<TransactionLink[]> {
    const rows = await this.db.getAllAsync<TransactionLinkRow>(
      'SELECT * FROM transaction_links WHERE target_transaction_id = ? ORDER BY created_at ASC, id ASC',
      transactionId,
    );
    return rows.map(mapTransactionLink);
  }

  async getTransactionLinksForTransaction(transactionId: string): Promise<TransactionLink[]> {
    const rows = await this.db.getAllAsync<TransactionLinkRow>(
      `SELECT * FROM transaction_links
       WHERE source_transaction_id = ? OR target_transaction_id = ?
       ORDER BY created_at ASC, id ASC`,
      transactionId,
      transactionId,
    );
    return rows.map(mapTransactionLink);
  }

  async removeTransactionLinksForTransaction(transactionId: string): Promise<void> {
    await this.db.runAsync(
      'DELETE FROM transaction_links WHERE source_transaction_id = ? OR target_transaction_id = ?',
      transactionId,
      transactionId,
    );
  }

  async addBudget(input: NewBudgetInput): Promise<void> {
    const now = new Date().toISOString();
    await this.db.runAsync(
      `INSERT INTO budgets (
        id, category_id, currency_code, monthly_limit_minor, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(category_id, currency_code)
      DO UPDATE SET monthly_limit_minor = excluded.monthly_limit_minor, updated_at = excluded.updated_at`,
      createLocalId('budget'),
      input.categoryId,
      normalizeCurrencyCode(input.currencyCode),
      input.monthlyLimitMinor,
      now,
      now,
    );
  }

  async addRecurringBill(input: NewRecurringBillInput): Promise<void> {
    const now = new Date().toISOString();
    await this.db.runAsync(
      `INSERT INTO recurring_bills (
        id, name, amount_minor, currency_code, account_id, category_id, due_day,
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      createLocalId('bill'),
      input.name.trim() || 'Recurring bill',
      input.amountMinor,
      normalizeCurrencyCode(input.currencyCode),
      input.accountId,
      input.categoryId,
      Math.min(Math.max(input.dueDay, 1), 28),
      now,
      now,
    );
  }

  async updateRainyDayFund(input: UpdateRainyDayFundInput): Promise<void> {
    const now = new Date().toISOString();
    const fund = await this.db.getFirstAsync<RainyDayFundRow>('SELECT * FROM rainy_day_funds LIMIT 1');
    if (!fund) {
      throw new Error('Rainy day fund is missing.');
    }

    const currencyCode = normalizeCurrencyCode(input.currencyCode);
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        'UPDATE rainy_day_funds SET currency_code = ?, goal_minor = ?, updated_at = ? WHERE id = ?',
        currencyCode,
        input.goalMinor,
        now,
        fund.id,
      );
      await this.db.runAsync('DELETE FROM rainy_day_fund_accounts WHERE fund_id = ?', fund.id);
      await this.db.runAsync('UPDATE accounts SET include_in_rainy_day = 0');

      for (const accountId of input.linkedAccountIds) {
        const account = await this.db.getFirstAsync<AccountRow>('SELECT * FROM accounts WHERE id = ?', accountId);
        if (account?.currency_code === currencyCode) {
          await this.db.runAsync(
            'INSERT OR IGNORE INTO rainy_day_fund_accounts (fund_id, account_id) VALUES (?, ?)',
            fund.id,
            accountId,
          );
          await this.db.runAsync(
            'UPDATE accounts SET include_in_rainy_day = 1, updated_at = ? WHERE id = ?',
            now,
            accountId,
          );
        }
      }
    });
  }

  async updateSettings(input: UpdateAppSettingsInput): Promise<void> {
    const defaultCurrencyCode = normalizeCurrencyCode(input.defaultCurrencyCode);
    const enabledCurrencyCodes = uniqueCurrencyCodes([
      defaultCurrencyCode,
      ...input.enabledCurrencyCodes,
    ]);

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO settings (key, value)
         VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        'default_currency_code',
        defaultCurrencyCode,
      );
      await this.db.runAsync(
        `INSERT INTO settings (key, value)
         VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        'multi_currency_enabled',
        input.multiCurrencyEnabled ? 'true' : 'false',
      );
      await this.db.runAsync(
        `INSERT INTO settings (key, value)
         VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        'enabled_currency_codes',
        JSON.stringify(enabledCurrencyCodes),
      );
    });
  }

  async updateCategoryCatalog(input: UpdateCategoryCatalogInput): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO settings (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      'category_catalog_json',
      JSON.stringify(sanitizeCategoryCatalog(input.categories)),
    );
  }

  async updateDashboardSelectedAccountIds(accountIds: string[]): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO settings (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      'dashboard_selected_account_ids',
      JSON.stringify(accountIds),
    );
  }

  async updateAccountDashboardVisibility(accountId: string, showOnDashboard: boolean): Promise<void> {
    const now = new Date().toISOString();
    await this.db.runAsync(
      'UPDATE accounts SET show_on_dashboard = ?, updated_at = ? WHERE id = ? AND is_archived = 0',
      showOnDashboard ? 1 : 0,
      now,
      accountId,
    );
  }

  async updateAccountOrder(accountIds: string[]): Promise<void> {
    const now = new Date().toISOString();

    await this.db.withTransactionAsync(async () => {
      for (const [index, accountId] of accountIds.entries()) {
        await this.db.runAsync(
          'UPDATE accounts SET sort_order = ?, updated_at = ? WHERE id = ?',
          index,
          now,
          accountId,
        );
      }
    });
  }

  async closeAccount(accountId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        'UPDATE accounts SET is_archived = 1, include_in_rainy_day = 0, show_on_dashboard = 0, updated_at = ? WHERE id = ?',
        now,
        accountId,
      );
      await this.db.runAsync('DELETE FROM rainy_day_fund_accounts WHERE account_id = ?', accountId);
    });
  }

  async reopenAccount(accountId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.runAsync(
      'UPDATE accounts SET is_archived = 0, updated_at = ? WHERE id = ?',
      now,
      accountId,
    );
  }

  async deleteAccount(accountId: string): Promise<void> {
    const lineCount = await this.db.getFirstAsync<CountRow>(
      'SELECT COUNT(*) as count FROM transaction_lines WHERE account_id = ?',
      accountId,
    );

    if ((lineCount?.count ?? 0) > 0) {
      throw new Error('Close accounts with transaction history instead of deleting them.');
    }

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM rainy_day_fund_accounts WHERE account_id = ?', accountId);
      await this.db.runAsync('DELETE FROM accounts WHERE id = ?', accountId);
    });
  }

  private async ensureAccountSortOrder(): Promise<void> {
    const accounts = await this.db.getAllAsync<{ id: string; sort_order: number }>(
      'SELECT id, sort_order FROM accounts ORDER BY created_at ASC',
    );

    if (accounts.length <= 1 || accounts.some((account) => account.sort_order !== 0)) {
      return;
    }

    await this.updateAccountOrder(accounts.map((account) => account.id));
  }

  private async getNextAccountSortOrder(): Promise<number> {
    const row = await this.db.getFirstAsync<{ next_sort_order: number }>(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 as next_sort_order FROM accounts',
    );
    return row?.next_sort_order ?? 0;
  }

  private async getAllTransactionLinks(): Promise<TransactionLink[]> {
    const rows = await this.db.getAllAsync<TransactionLinkRow>(
      'SELECT * FROM transaction_links ORDER BY created_at ASC, id ASC',
    );
    return rows.map(mapTransactionLink);
  }

  private async getTransactionLinkValidationState(): Promise<{
    transactions: Transaction[];
    lines: TransactionLine[];
    links: TransactionLink[];
  }> {
    const transactionRows = await this.db.getAllAsync<TransactionRow>('SELECT * FROM transactions');
    const lineRows = await this.db.getAllAsync<TransactionLineRow>('SELECT * FROM transaction_lines');
    const linkRows = await this.db.getAllAsync<TransactionLinkRow>('SELECT * FROM transaction_links');

    return {
      transactions: transactionRows.map(mapTransaction),
      lines: lineRows.map(mapTransactionLine),
      links: linkRows.map(mapTransactionLink),
    };
  }

  private async deleteTransactionLinkedRecords(transactionId: string): Promise<void> {
    const columns = await this.db.getAllAsync<TableColumnRow>('PRAGMA table_info(transaction_links)');
    const linkColumns = columns
      .map((column) => column.name)
      .filter((columnName) =>
        [
          'transaction_id',
          'source_transaction_id',
          'target_transaction_id',
          'linked_transaction_id',
          'refund_transaction_id',
          'reimbursement_transaction_id',
          'contribution_transaction_id',
        ].includes(columnName),
      );

    if (!linkColumns.length) {
      return;
    }

    await this.db.runAsync(
      `DELETE FROM transaction_links WHERE ${linkColumns.map((columnName) => `${columnName} = ?`).join(' OR ')}`,
      ...linkColumns.map(() => transactionId),
    );
  }

  private async ensureRainyDayFund(currencyCode: string): Promise<void> {
    const existingFund = await this.db.getFirstAsync<RainyDayFundRow>('SELECT * FROM rainy_day_funds LIMIT 1');
    if (existingFund) {
      return;
    }

    const now = new Date().toISOString();
    await this.db.runAsync(
      `INSERT INTO rainy_day_funds (
        id, name, currency_code, goal_minor, created_at, updated_at
      ) VALUES (?, 'Rainy day fund', ?, 0, ?, ?)`,
      createLocalId('fund'),
      normalizeCurrencyCode(currencyCode),
      now,
      now,
    );
  }

  private async seedDemoFirstRun(currencyCode: string): Promise<void> {
    const now = new Date().toISOString();
    const everydayId = createLocalId('acct');
    const rainyId = createLocalId('acct');
    const groceryTxnId = createLocalId('txn');
    const salaryTxnId = createLocalId('txn');
    const transferTxnId = createLocalId('txn');
    const fundId = createLocalId('fund');

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO accounts (
          id, name, nickname, type, currency_code, opening_balance_minor, notes, institution_name,
          include_in_rainy_day, theme_color, sort_order, is_archived, created_at, updated_at
        ) VALUES (?, 'Everyday', '', 'checking', ?, 245000, 'Daily spending account.', '', 0, '#1876A8', 0, 0, ?, ?)`,
        everydayId,
        currencyCode,
        now,
        now,
      );
      await this.db.runAsync(
        `INSERT INTO accounts (
          id, name, nickname, type, currency_code, opening_balance_minor, notes, institution_name,
          include_in_rainy_day, theme_color, sort_order, is_archived, created_at, updated_at
        ) VALUES (?, 'Rainy Day', '', 'savings', ?, 80000, 'Emergency savings account.', '', 1, '#5E9C92', 1, 0, ?, ?)`,
        rainyId,
        currencyCode,
        now,
        now,
      );
      await this.db.runAsync(
        `INSERT INTO rainy_day_funds (
          id, name, currency_code, goal_minor, created_at, updated_at
        ) VALUES (?, 'Rainy day fund', ?, 1000000, ?, ?)`,
        fundId,
        currencyCode,
        now,
        now,
      );
      await this.db.runAsync(
        'INSERT INTO rainy_day_fund_accounts (fund_id, account_id) VALUES (?, ?)',
        fundId,
        rainyId,
      );

      await this.insertSeedTransaction(salaryTxnId, 'income', 'Salary', now, [
        [everydayId, 320000, currencyCode, 'income', 'salary'],
      ]);
      await this.insertSeedTransaction(groceryTxnId, 'expense', 'Groceries', now, [
        [everydayId, -8640, currencyCode, 'food', 'groceries'],
      ]);
      await this.insertSeedTransaction(transferTxnId, 'transfer', 'Rainy day transfer', now, [
        [everydayId, -25000, currencyCode, '', '', rainyId],
        [rainyId, 25000, currencyCode, '', '', everydayId],
      ]);

      await this.db.runAsync(
        `INSERT INTO budgets (
          id, category_id, currency_code, monthly_limit_minor, created_at, updated_at
        ) VALUES (?, 'food', ?, 70000, ?, ?)`,
        createLocalId('budget'),
        currencyCode,
        now,
        now,
      );
      await this.db.runAsync(
        `INSERT INTO recurring_bills (
          id, name, amount_minor, currency_code, account_id, category_id, due_day,
          is_active, created_at, updated_at
        ) VALUES (?, 'Internet', 8900, ?, ?, 'bills', 12, 1, ?, ?)`,
        createLocalId('bill'),
        currencyCode,
        everydayId,
        now,
        now,
      );
    });
  }

  private async ensureDemoSampleDataVersion(currencyCode: string): Promise<void> {
    const currentVersion = Number(
      (await this.db.getFirstAsync<SettingRow>(
        'SELECT value FROM settings WHERE key = ?',
        'sample_data_version',
      ))?.value ?? '0',
    );

    if (currentVersion >= SAMPLE_DATA_VERSION) {
      return;
    }

    await this.seedExpandedSampleData(currencyCode);
    await this.db.runAsync(
      `INSERT INTO settings (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      'sample_data_version',
      String(SAMPLE_DATA_VERSION),
    );
  }

  private async seedExpandedSampleData(currencyCode: string): Promise<void> {
    const now = new Date();
    const nowIso = now.toISOString();
    const everydayId = await this.findAccountIdByName('Everyday');
    const rainyId = await this.findAccountIdByName('Rainy Day');

    if (!everydayId || !rainyId) {
      return;
    }

    const billsId = createLocalId('acct');
    const travelId = createLocalId('acct');
    const usdCashId = createLocalId('acct');
    const creditCardId = createLocalId('acct');

    await this.db.withTransactionAsync(async () => {
      for (const account of getExpandedSampleAccounts({
        billsId,
        creditCardId,
        currencyCode,
        nowIso,
        travelId,
        usdCashId,
      })) {
        await this.insertSeedAccount(account);
      }

      for (const transaction of getExpandedSampleTransactions({
        billsId,
        creditCardId,
        currencyCode,
        everydayId,
        now,
        rainyId,
        travelId,
        usdCashId,
      })) {
        await this.insertSeedTransaction(
          createLocalId('txn'),
          transaction.kind,
          transaction.title,
          transaction.datetime,
          transaction.lines,
        );
      }

      for (const budget of getExpandedSampleBudgets(currencyCode)) {
        await this.upsertSeedBudget(
          budget.categoryId,
          budget.currencyCode,
          budget.monthlyLimitMinor,
          nowIso,
        );
      }

      for (const bill of getExpandedSampleRecurringBills({
        billsId,
        creditCardId,
        currencyCode,
        everydayId,
      })) {
        await this.insertSeedRecurringBill(
          bill.name,
          bill.amountMinor,
          bill.currencyCode,
          bill.accountId,
          bill.categoryId,
          bill.dueDay,
          nowIso,
        );
      }
    });
  }

  private async findAccountIdByName(name: string): Promise<string | null> {
    return (await this.db.getFirstAsync<{ id: string }>('SELECT id FROM accounts WHERE name = ? LIMIT 1', name))?.id ?? null;
  }

  private async insertSeedAccount({
    id,
    name,
    type,
    currencyCode,
    openingBalanceMinor,
    notes,
    institutionName,
    includeInRainyDay,
    themeColor,
    sortOrder,
    now,
  }: {
    id: string;
    name: string;
    type: AccountType;
    currencyCode: string;
    openingBalanceMinor: number;
    notes: string;
    institutionName: string;
    includeInRainyDay: boolean;
    themeColor: string;
    sortOrder: number;
    now: string;
  }): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO accounts (
        id, name, nickname, type, currency_code, opening_balance_minor, notes, institution_name,
        include_in_rainy_day, theme_color, sort_order, is_archived, created_at, updated_at
      ) VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      id,
      name,
      type,
      currencyCode,
      openingBalanceMinor,
      notes,
      institutionName,
      includeInRainyDay ? 1 : 0,
      normalizeAccountThemeColor(themeColor),
      sortOrder,
      now,
      now,
    );
  }

  private async upsertSeedBudget(
    categoryId: string,
    currencyCode: string,
    monthlyLimitMinor: number,
    now: string,
  ): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO budgets (
        id, category_id, currency_code, monthly_limit_minor, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(category_id, currency_code)
      DO UPDATE SET monthly_limit_minor = excluded.monthly_limit_minor, updated_at = excluded.updated_at`,
      createLocalId('budget'),
      categoryId,
      currencyCode,
      monthlyLimitMinor,
      now,
      now,
    );
  }

  private async insertSeedRecurringBill(
    name: string,
    amountMinor: number,
    currencyCode: string,
    accountId: string,
    categoryId: string,
    dueDay: number,
    now: string,
  ): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO recurring_bills (
        id, name, amount_minor, currency_code, account_id, category_id, due_day,
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      createLocalId('bill'),
      name,
      amountMinor,
      currencyCode,
      accountId,
      categoryId,
      dueDay,
      now,
      now,
    );
  }

  private async insertSeedTransaction(
    transactionId: string,
    kind: TransactionKind,
    title: string,
    now: string,
    lines: SeedTransactionLine[],
  ): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO transactions (
        id, kind, title, datetime, notes, labels_json, group_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, '', '[]', '', ?, ?)`,
      transactionId,
      kind,
      title,
      now,
      now,
      now,
    );

    for (const [accountId, amountMinor, currencyCode, categoryId, subcategoryId, peerAccountId = ''] of lines) {
      await this.db.runAsync(
        `INSERT INTO transaction_lines (
          id, transaction_id, account_id, amount_minor, currency_code, category_id,
          subcategory_id, external_party, transfer_peer_account_id, note, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, '', ?)`,
        createLocalId('line'),
        transactionId,
        accountId,
        amountMinor,
        currencyCode,
        categoryId,
        subcategoryId,
        peerAccountId,
        now,
      );
    }
  }

  private async linkAccountToRainyFundIfCompatible(accountId: string, currencyCode: string): Promise<void> {
    const fund = await this.db.getFirstAsync<RainyDayFundRow>('SELECT * FROM rainy_day_funds LIMIT 1');
    if (fund?.currency_code === currencyCode) {
      await this.db.runAsync(
        'INSERT OR IGNORE INTO rainy_day_fund_accounts (fund_id, account_id) VALUES (?, ?)',
        fund.id,
        accountId,
      );
    }
  }

  private async addAccountToStoredDashboardSelection(accountId: string): Promise<void> {
    const setting = await this.db.getFirstAsync<SettingRow>(
      'SELECT value FROM settings WHERE key = ?',
      'dashboard_selected_account_ids',
    );

    if (!setting) {
      return;
    }

    const selectedAccountIds = safeParseNullableStringArray(setting.value) ?? [];
    if (selectedAccountIds.includes(accountId)) {
      return;
    }

    await this.db.runAsync(
      `INSERT INTO settings (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      'dashboard_selected_account_ids',
      JSON.stringify([...selectedAccountIds, accountId]),
    );
  }
}

function fallbackTransactionTitle(kind: TransactionKind): string {
  if (kind === 'income') {
    return 'Income';
  }

  if (kind === 'transfer') {
    return 'Transfer';
  }

  return 'Expense';
}
