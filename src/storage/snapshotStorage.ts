import { sanitizeCategoryCatalog } from '../domain/categories';
import { normalizeAddTransactionDefaults } from '../domain/addTransactionDefaults';
import { uniqueCurrencyCodes } from '../domain/currencyCatalog';
import { getEffectiveDisplayCurrency, normalizeDefaultCurrencyMode } from '../domain/currency';
import { normalizeDashboardCardSettings } from '../domain/dashboardCards';
import { normalizeCurrencyCode } from '../domain/money';
import type { AppSnapshot, RainyDayFund } from '../domain/types';
import type { RepositoryDatabase } from './database';
import { ADD_TRANSACTION_DEFAULTS_SETTING_KEY } from './settingsStorage';
import {
  type AccountRow,
  type BudgetRow,
  type LinkedAccountRow,
  mapAccount,
  mapBudget,
  mapRainyDayFund,
  mapRecurringItem,
  mapTransactionTemplate,
  mapTransactionTemplateLine,
  mapTransaction,
  mapTransactionLine,
  mapTransactionLink,
  type RainyDayFundRow,
  type RecurringItemRow,
  safeParseCurrencyCodes,
  safeParseJson,
  safeParseNullableStringArray,
  type SettingRow,
  type TransactionLineRow,
  type TransactionLinkRow,
  type TransactionRow,
  type TransactionTemplateLineRow,
  type TransactionTemplateRow,
} from './mappers';

export async function getSnapshotStorage(db: RepositoryDatabase): Promise<AppSnapshot> {
  const defaultCurrency =
    (await db.getFirstAsync<SettingRow>(
      'SELECT value FROM settings WHERE key = ?',
      'default_currency_code',
    ))?.value ?? 'USD';
  const defaultCurrencyMode = normalizeDefaultCurrencyMode(
    (await db.getFirstAsync<SettingRow>(
      'SELECT value FROM settings WHERE key = ?',
      'default_currency_mode',
    ))?.value,
  );
  const accountRows = await db.getAllAsync<AccountRow>(
    'SELECT * FROM accounts ORDER BY sort_order ASC, created_at ASC',
  );
  const transactionRows = await db.getAllAsync<TransactionRow>(
    'SELECT * FROM transactions ORDER BY datetime DESC, created_at DESC, id DESC',
  );
  const lineRows = await db.getAllAsync<TransactionLineRow>(
    'SELECT * FROM transaction_lines ORDER BY created_at ASC',
  );
  const linkRows = await db.getAllAsync<TransactionLinkRow>(
    'SELECT * FROM transaction_links ORDER BY created_at ASC, id ASC',
  );
  const budgetRows = await db.getAllAsync<BudgetRow>(
    `SELECT * FROM budgets
     ORDER BY is_active DESC, currency_code ASC, scope_type ASC, name ASC, created_at ASC`,
  );
  const recurringItemRows = await db.getAllAsync<RecurringItemRow>(
    'SELECT * FROM recurring_items ORDER BY is_active DESC, next_due_date ASC, name ASC, id ASC',
  );
  const transactionTemplateRows = await db.getAllAsync<TransactionTemplateRow>(
    'SELECT * FROM transaction_templates ORDER BY is_active DESC, name ASC, created_at ASC, id ASC',
  );
  const transactionTemplateLineRows = await db.getAllAsync<TransactionTemplateLineRow>(
    'SELECT * FROM transaction_template_lines ORDER BY template_id ASC, sort_order ASC, created_at ASC, id ASC',
  );
  const storedEnabledCurrencyCodes = safeParseCurrencyCodes(
    (await db.getFirstAsync<SettingRow>(
      'SELECT value FROM settings WHERE key = ?',
      'enabled_currency_codes',
    ))?.value,
  );
  const dashboardSelectedAccountIds = safeParseNullableStringArray(
    (await db.getFirstAsync<SettingRow>(
      'SELECT value FROM settings WHERE key = ?',
      'dashboard_selected_account_ids',
    ))?.value,
  );
  const dashboardCardSettings = normalizeDashboardCardSettings(
    safeParseJson(
      (await db.getFirstAsync<SettingRow>(
        'SELECT value FROM settings WHERE key = ?',
        'dashboard_card_settings',
      ))?.value,
    ),
  );
  const addTransactionDefaults = normalizeAddTransactionDefaults(
    safeParseJson(
      (await db.getFirstAsync<SettingRow>(
        'SELECT value FROM settings WHERE key = ?',
        ADD_TRANSACTION_DEFAULTS_SETTING_KEY,
      ))?.value,
    ),
  );
  const categories = sanitizeCategoryCatalog(
    safeParseJson(
      (await db.getFirstAsync<SettingRow>(
        'SELECT value FROM settings WHERE key = ?',
        'category_catalog_json',
      ))?.value,
    ),
  );
  const storedDefaultCurrencyCode = normalizeCurrencyCode(defaultCurrency);
  const accountCurrencyCodes = uniqueCurrencyCodes(accountRows.map((account) => account.currency_code));
  const defaultCurrencyCode = getEffectiveDisplayCurrency({
    defaultCurrencyCode: storedDefaultCurrencyCode,
    defaultCurrencyMode,
    accountCurrencyCodes,
  });
  const fundRow = await db.getFirstAsync<RainyDayFundRow>('SELECT * FROM rainy_day_funds LIMIT 1');

  let rainyDayFund: RainyDayFund;
  if (fundRow) {
    const linkedRows = await db.getAllAsync<LinkedAccountRow>(
      'SELECT account_id FROM rainy_day_fund_accounts WHERE fund_id = ?',
      fundRow.id,
    );
    rainyDayFund = mapRainyDayFund(fundRow, linkedRows.map((row) => row.account_id));
  } else {
    const now = new Date().toISOString();
    rainyDayFund = {
      id: 'fund_missing',
      name: 'Rainy day fund',
      currencyCode: defaultCurrencyCode,
      goalMinor: 0,
      linkedAccountIds: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  const enabledCurrencyCodes = uniqueCurrencyCodes([
    defaultCurrencyCode,
    ...storedEnabledCurrencyCodes,
    ...accountRows.map((account) => account.currency_code),
  ]);

  const recurringItems = recurringItemRows.map(mapRecurringItem);
  const transactionTemplateLinesByTemplateId = groupTransactionTemplateLinesByTemplateId(transactionTemplateLineRows);

  return {
    defaultCurrencyCode,
    settings: {
      defaultCurrencyCode,
      defaultCurrencyMode,
      multiCurrencyEnabled: accountCurrencyCodes.length > 1,
      enabledCurrencyCodes,
      dashboardSelectedAccountIds,
      dashboardCardSettings,
      addTransactionDefaults,
    },
    categories,
    accounts: accountRows.map(mapAccount),
    transactions: transactionRows.map(mapTransaction),
    transactionLines: lineRows.map(mapTransactionLine),
    transactionLinks: linkRows.map(mapTransactionLink),
    budgets: budgetRows.map(mapBudget),
    recurringItems,
    recurringBills: recurringItems,
    transactionTemplates: transactionTemplateRows.map((row) =>
      mapTransactionTemplate(row, transactionTemplateLinesByTemplateId.get(row.id) ?? [])),
    rainyDayFund,
  };
}

function groupTransactionTemplateLinesByTemplateId(
  rows: TransactionTemplateLineRow[],
): Map<string, ReturnType<typeof mapTransactionTemplateLine>[]> {
  const result = new Map<string, ReturnType<typeof mapTransactionTemplateLine>[]>();

  for (const row of rows) {
    const line = mapTransactionTemplateLine(row);
    const existing = result.get(line.templateId) ?? [];
    existing.push(line);
    result.set(line.templateId, existing);
  }

  return result;
}
