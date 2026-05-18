import {
  normalizeAccountIconName,
  normalizeAccountThemeColor,
} from '../domain/accountThemes';
import { normalizeCurrencyCode } from '../domain/money';
import type { NewAccountInput, UpdateAccountInput } from '../domain/types';
import type { RepositoryDatabase } from './database';
import { createLocalId } from './ids';
import type { AccountRow, CountRow, RainyDayFundRow } from './mappers';
import { linkAccountToRainyFundIfCompatible } from './rainyDayStorage';
import { addAccountToStoredDashboardSelection } from './settingsStorage';

export async function addAccountStorage(
  db: RepositoryDatabase,
  input: NewAccountInput,
): Promise<void> {
  const now = new Date().toISOString();
  const id = createLocalId('acct');
  const currencyCode = normalizeCurrencyCode(input.currencyCode);

  await db.runAsync(
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
    await getNextAccountSortOrder(db),
    now,
    now,
  );

  if (input.includeInRainyDay) {
    await linkAccountToRainyFundIfCompatible(db, id, currencyCode);
  }

  await addAccountToStoredDashboardSelection(db, id);
}

export async function updateAccountStorage(
  db: RepositoryDatabase,
  input: UpdateAccountInput,
): Promise<void> {
  const now = new Date().toISOString();
  const existingAccount = await db.getFirstAsync<AccountRow>('SELECT * FROM accounts WHERE id = ?', input.id);
  await db.runAsync(
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

  const account = await db.getFirstAsync<AccountRow>('SELECT * FROM accounts WHERE id = ?', input.id);
  const fund = await db.getFirstAsync<RainyDayFundRow>('SELECT * FROM rainy_day_funds LIMIT 1');
  if (!account || !fund) {
    return;
  }

  await db.runAsync(
    'DELETE FROM rainy_day_fund_accounts WHERE account_id = ?',
    input.id,
  );
  if (input.includeInRainyDay && account.currency_code === fund.currency_code) {
    await db.runAsync(
      'INSERT OR IGNORE INTO rainy_day_fund_accounts (fund_id, account_id) VALUES (?, ?)',
      fund.id,
      input.id,
    );
  }
}

export async function updateAccountDashboardVisibilityStorage(
  db: RepositoryDatabase,
  accountId: string,
  showOnDashboard: boolean,
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE accounts SET show_on_dashboard = ?, updated_at = ? WHERE id = ? AND is_archived = 0',
    showOnDashboard ? 1 : 0,
    now,
    accountId,
  );
}

export async function updateAccountOrderStorage(
  db: RepositoryDatabase,
  accountIds: string[],
): Promise<void> {
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    for (const [index, accountId] of accountIds.entries()) {
      await db.runAsync(
        'UPDATE accounts SET sort_order = ?, updated_at = ? WHERE id = ?',
        index,
        now,
        accountId,
      );
    }
  });
}

export async function closeAccountStorage(
  db: RepositoryDatabase,
  accountId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE accounts SET is_archived = 1, include_in_rainy_day = 0, show_on_dashboard = 0, updated_at = ? WHERE id = ?',
      now,
      accountId,
    );
    await db.runAsync('DELETE FROM rainy_day_fund_accounts WHERE account_id = ?', accountId);
  });
}

export async function reopenAccountStorage(
  db: RepositoryDatabase,
  accountId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE accounts SET is_archived = 0, updated_at = ? WHERE id = ?',
    now,
    accountId,
  );
}

export async function deleteAccountStorage(
  db: RepositoryDatabase,
  accountId: string,
): Promise<void> {
  const lineCount = await db.getFirstAsync<CountRow>(
    'SELECT COUNT(*) as count FROM transaction_lines WHERE account_id = ?',
    accountId,
  );

  if ((lineCount?.count ?? 0) > 0) {
    throw new Error('Close accounts with transaction history instead of deleting them.');
  }

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM rainy_day_fund_accounts WHERE account_id = ?', accountId);
    await db.runAsync('DELETE FROM accounts WHERE id = ?', accountId);
  });
}

export async function ensureAccountSortOrderStorage(db: RepositoryDatabase): Promise<void> {
  const accounts = await db.getAllAsync<{ id: string; sort_order: number }>(
    'SELECT id, sort_order FROM accounts ORDER BY created_at ASC',
  );

  if (accounts.length <= 1 || accounts.some((account) => account.sort_order !== 0)) {
    return;
  }

  await updateAccountOrderStorage(db, accounts.map((account) => account.id));
}

async function getNextAccountSortOrder(db: RepositoryDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ next_sort_order: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 as next_sort_order FROM accounts',
  );
  return row?.next_sort_order ?? 0;
}
