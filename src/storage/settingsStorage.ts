import { defaultCategories, sanitizeCategoryCatalog } from '../domain/categories';
import { getDefaultEnabledCurrencyCodes, uniqueCurrencyCodes } from '../domain/currencyCatalog';
import { normalizeDefaultCurrencyMode } from '../domain/currency';
import { normalizeCurrencyCode } from '../domain/money';
import type { UpdateAppSettingsInput, UpdateCategoryCatalogInput } from '../domain/types';
import type { RepositoryDatabase } from './database';
import { safeParseCurrencyCodes, safeParseNullableStringArray, type CountRow, type SettingRow } from './mappers';

export const DEFAULT_CURRENCY_MODE_SETTING_KEY = 'default_currency_mode';

export async function initializeRequiredSettings(
  db: RepositoryDatabase,
  currencyCode: string,
): Promise<void> {
  await db.runAsync(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
    'default_currency_code',
    currencyCode,
  );
  await db.runAsync(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
    DEFAULT_CURRENCY_MODE_SETTING_KEY,
    'auto',
  );
  await db.runAsync(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
    'multi_currency_enabled',
    'false',
  );
  await db.runAsync(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
    'enabled_currency_codes',
    JSON.stringify(getDefaultEnabledCurrencyCodes(currencyCode)),
  );
  await db.runAsync(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
    'category_catalog_json',
    JSON.stringify(defaultCategories),
  );
}

export async function updateSettingsStorage(
  db: RepositoryDatabase,
  input: UpdateAppSettingsInput,
): Promise<void> {
  const defaultCurrencyCode = normalizeCurrencyCode(input.defaultCurrencyCode);
  const enabledCurrencyCodes = uniqueCurrencyCodes([
    defaultCurrencyCode,
    ...input.enabledCurrencyCodes,
  ]);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO settings (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      'default_currency_code',
      defaultCurrencyCode,
    );
    await db.runAsync(
      `INSERT INTO settings (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      DEFAULT_CURRENCY_MODE_SETTING_KEY,
      'manual',
    );
    await db.runAsync(
      `INSERT INTO settings (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      'multi_currency_enabled',
      input.multiCurrencyEnabled ? 'true' : 'false',
    );
    await db.runAsync(
      `INSERT INTO settings (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      'enabled_currency_codes',
      JSON.stringify(enabledCurrencyCodes),
    );
  });
}

export async function promoteAutomaticDefaultCurrencyForFirstAccount(
  db: RepositoryDatabase,
  currencyCode: string,
): Promise<boolean> {
  const accountCount = await db.getFirstAsync<CountRow>('SELECT COUNT(*) as count FROM accounts');
  if ((accountCount?.count ?? 0) !== 1) {
    return false;
  }

  const defaultCurrencyMode = normalizeDefaultCurrencyMode(
    (await db.getFirstAsync<SettingRow>(
      'SELECT value FROM settings WHERE key = ?',
      DEFAULT_CURRENCY_MODE_SETTING_KEY,
    ))?.value,
  );
  if (defaultCurrencyMode === 'manual') {
    return false;
  }

  const nextDefaultCurrencyCode = normalizeCurrencyCode(currencyCode);
  const storedEnabledCurrencyCodes = safeParseCurrencyCodes(
    (await db.getFirstAsync<SettingRow>(
      'SELECT value FROM settings WHERE key = ?',
      'enabled_currency_codes',
    ))?.value,
  );
  const enabledCurrencyCodes = uniqueCurrencyCodes([nextDefaultCurrencyCode, ...storedEnabledCurrencyCodes]);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO settings (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      'default_currency_code',
      nextDefaultCurrencyCode,
    );
    await db.runAsync(
      `INSERT INTO settings (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      DEFAULT_CURRENCY_MODE_SETTING_KEY,
      'auto',
    );
    await db.runAsync(
      `INSERT INTO settings (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      'enabled_currency_codes',
      JSON.stringify(enabledCurrencyCodes),
    );
  });

  return true;
}

export async function updateCategoryCatalogStorage(
  db: RepositoryDatabase,
  input: UpdateCategoryCatalogInput,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    'category_catalog_json',
    JSON.stringify(sanitizeCategoryCatalog(input.categories)),
  );
}

export async function updateDashboardSelectedAccountIdsStorage(
  db: RepositoryDatabase,
  accountIds: string[],
): Promise<void> {
  await db.runAsync(
    `INSERT INTO settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    'dashboard_selected_account_ids',
    JSON.stringify(accountIds),
  );
}

export async function addAccountToStoredDashboardSelection(
  db: RepositoryDatabase,
  accountId: string,
): Promise<void> {
  const setting = await db.getFirstAsync<SettingRow>(
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

  await updateDashboardSelectedAccountIdsStorage(db, [...selectedAccountIds, accountId]);
}
