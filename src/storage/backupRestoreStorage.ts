import type { RainproofBackupData } from '../domain/backupExport';
import type { RepositoryDatabase } from './database';
import { ADD_TRANSACTION_DEFAULTS_SETTING_KEY, DEFAULT_CURRENCY_MODE_SETTING_KEY } from './settingsStorage';

const RESTORED_SETTING_KEYS = [
  'default_currency_code',
  DEFAULT_CURRENCY_MODE_SETTING_KEY,
  'multi_currency_enabled',
  'enabled_currency_codes',
  'category_catalog_json',
  'dashboard_selected_account_ids',
  'dashboard_card_settings',
  ADD_TRANSACTION_DEFAULTS_SETTING_KEY,
] as const;

const RESTORED_TABLES_IN_DELETE_ORDER = [
  'rainy_day_fund_accounts',
  'transaction_links',
  'recurring_transaction_history',
  'transaction_template_lines',
  'transaction_lines',
  'transactions',
  'budgets',
  'recurring_items',
  'transaction_templates',
  'rainy_day_funds',
  'accounts',
] as const;

export async function restoreRainproofBackupStorage(
  db: RepositoryDatabase,
  data: RainproofBackupData,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await clearRestoredData(db);
    await restoreSettings(db, data);
    await restoreAccounts(db, data);
    await restoreTransactions(db, data);
    await restoreBudgets(db, data);
    await restoreRecurringItems(db, data);
    await restoreTemplates(db, data);
    await restoreRainyDayFund(db, data);
  });
}

async function clearRestoredData(db: RepositoryDatabase): Promise<void> {
  for (const tableName of RESTORED_TABLES_IN_DELETE_ORDER) {
    await db.runAsync(`DELETE FROM ${tableName}`);
  }
  await db.runAsync(
    `DELETE FROM settings WHERE key IN (${RESTORED_SETTING_KEYS.map(() => '?').join(', ')})`,
    ...RESTORED_SETTING_KEYS,
  );
}

async function restoreSettings(db: RepositoryDatabase, data: RainproofBackupData): Promise<void> {
  for (const [key, value] of getRestoredSettingRows(data)) {
    await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', key, value);
  }
}

function getRestoredSettingRows(data: RainproofBackupData): [string, string][] {
  const settings = data.settings;
  const values: [string, string][] = [
    ['default_currency_code', data.defaultCurrencyCode],
    [DEFAULT_CURRENCY_MODE_SETTING_KEY, settings.defaultCurrencyMode],
    ['multi_currency_enabled', settings.multiCurrencyEnabled ? 'true' : 'false'],
    ['enabled_currency_codes', JSON.stringify(settings.enabledCurrencyCodes)],
    ['category_catalog_json', JSON.stringify(data.categories)],
    ['dashboard_selected_account_ids', JSON.stringify(settings.dashboardSelectedAccountIds)],
  ];
  if (settings.dashboardCardSettings) {
    values.push(['dashboard_card_settings', JSON.stringify(settings.dashboardCardSettings)]);
  }
  if (settings.addTransactionDefaults) {
    values.push([ADD_TRANSACTION_DEFAULTS_SETTING_KEY, JSON.stringify(settings.addTransactionDefaults)]);
  }

  return values;
}

async function restoreAccounts(db: RepositoryDatabase, data: RainproofBackupData): Promise<void> {
  for (const account of data.accounts) {
    await db.runAsync(
      `INSERT INTO accounts (
        id, name, nickname, type, currency_code, opening_balance_minor, credit_limit_minor,
        notes, institution_name, include_in_rainy_day, theme_color, icon_name,
        show_on_dashboard, sort_order, is_archived, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      account.id,
      account.name,
      account.nickname,
      account.type,
      account.currencyCode,
      account.openingBalanceMinor,
      account.creditLimitMinor ?? null,
      account.notes,
      account.institutionName,
      account.includeInRainyDay ? 1 : 0,
      account.themeColor,
      account.iconName,
      account.showOnDashboard ? 1 : 0,
      account.sortOrder,
      account.isArchived ? 1 : 0,
      account.createdAt,
      account.updatedAt,
    );
  }
}

async function restoreTransactions(db: RepositoryDatabase, data: RainproofBackupData): Promise<void> {
  for (const transaction of data.transactions) {
    await db.runAsync(
      `INSERT INTO transactions (
        id, kind, title, datetime, notes, labels_json, group_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      transaction.id,
      transaction.kind,
      transaction.title,
      transaction.datetime,
      transaction.notes,
      JSON.stringify(transaction.labels),
      transaction.groupId,
      transaction.createdAt,
      transaction.updatedAt,
    );
  }

  for (const line of data.transactionLines) {
    await db.runAsync(
      `INSERT INTO transaction_lines (
        id, transaction_id, account_id, amount_minor, currency_code, category_id,
        subcategory_id, external_party, transfer_peer_account_id, note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      line.id,
      line.transactionId,
      line.accountId,
      line.amountMinor,
      line.currencyCode,
      line.categoryId,
      line.subcategoryId,
      line.externalParty,
      line.transferPeerAccountId,
      line.note,
      line.createdAt,
    );
  }

  for (const link of data.transactionLinks) {
    await db.runAsync(
      `INSERT INTO transaction_links (
        id, source_transaction_id, target_transaction_id, source_line_id, target_line_id,
        link_type, amount_minor, currency_code, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      link.id,
      link.sourceTransactionId,
      link.targetTransactionId,
      link.sourceLineId ?? null,
      link.targetLineId ?? null,
      link.linkType,
      link.amountMinor,
      link.currencyCode,
      link.createdAt,
      link.updatedAt,
    );
  }
}

async function restoreBudgets(db: RepositoryDatabase, data: RainproofBackupData): Promise<void> {
  for (const budget of data.budgets) {
    await db.runAsync(
      `INSERT INTO budgets (
        id, name, amount_minor, currency_code, period, scope_type, category_id,
        subcategory_id, scope_items_json, sort_order, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      budget.id,
      budget.name,
      budget.amountMinor,
      budget.currencyCode,
      budget.period,
      budget.scopeType,
      budget.categoryId,
      budget.subcategoryId,
      JSON.stringify(budget.scopeItems),
      budget.sortOrder,
      budget.isActive ? 1 : 0,
      budget.createdAt,
      budget.updatedAt,
    );
  }
}

async function restoreRecurringItems(db: RepositoryDatabase, data: RainproofBackupData): Promise<void> {
  for (const item of data.recurringItems) {
    await db.runAsync(
      `INSERT INTO recurring_items (
        id, name, kind, amount_minor, currency_code, account_id, category_id,
        subcategory_id, note, frequency, next_due_date, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      item.id,
      item.name,
      item.kind,
      item.amountMinor,
      item.currencyCode,
      item.accountId,
      item.categoryId,
      item.subcategoryId,
      item.note,
      item.frequency,
      item.nextDueDate,
      item.isActive ? 1 : 0,
      item.createdAt,
      item.updatedAt,
    );
  }

  for (const history of data.recurringTransactionHistory) {
    await db.runAsync(
      `INSERT INTO recurring_transaction_history (
        id, recurring_item_id, transaction_id, previous_next_due_date,
        advanced_next_due_date, sequence, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      history.id,
      history.recurringItemId,
      history.transactionId,
      history.previousNextDueDate,
      history.advancedNextDueDate,
      history.sequence,
      history.createdAt,
    );
  }
}

async function restoreTemplates(db: RepositoryDatabase, data: RainproofBackupData): Promise<void> {
  for (const template of data.transactionTemplates) {
    await db.runAsync(
      `INSERT INTO transaction_templates (
        id, name, kind, title, account_id, amount_minor, currency_code, category_id,
        subcategory_id, notes, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      template.id,
      template.name,
      template.kind,
      template.title,
      template.accountId,
      template.amountMinor,
      template.currencyCode,
      template.categoryId,
      template.subcategoryId,
      template.notes,
      template.isActive ? 1 : 0,
      template.createdAt,
      template.updatedAt,
    );

    for (const line of template.splitLines) {
      await db.runAsync(
        `INSERT INTO transaction_template_lines (
          id, template_id, kind, amount_minor, category_id, subcategory_id,
          note, sort_order, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        line.id,
        template.id,
        line.kind ?? null,
        line.amountMinor,
        line.categoryId,
        line.subcategoryId,
        line.note,
        line.sortOrder,
        line.createdAt,
      );
    }
  }
}

async function restoreRainyDayFund(db: RepositoryDatabase, data: RainproofBackupData): Promise<void> {
  const fund = data.rainyDayFund;
  await db.runAsync(
    `INSERT INTO rainy_day_funds (
      id, name, currency_code, goal_minor, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    fund.id,
    fund.name,
    fund.currencyCode,
    fund.goalMinor,
    fund.createdAt,
    fund.updatedAt,
  );
  for (const accountId of fund.linkedAccountIds) {
    await db.runAsync(
      'INSERT INTO rainy_day_fund_accounts (fund_id, account_id) VALUES (?, ?)',
      fund.id,
      accountId,
    );
  }
}
