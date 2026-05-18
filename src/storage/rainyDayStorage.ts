import { normalizeCurrencyCode } from '../domain/money';
import type { UpdateRainyDayFundInput } from '../domain/types';
import type { RepositoryDatabase } from './database';
import { createLocalId } from './ids';
import type { AccountRow, CountRow, RainyDayFundRow } from './mappers';

export async function ensureRainyDayFund(
  db: RepositoryDatabase,
  currencyCode: string,
): Promise<void> {
  const existingFund = await db.getFirstAsync<RainyDayFundRow>('SELECT * FROM rainy_day_funds LIMIT 1');
  if (existingFund) {
    return;
  }

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO rainy_day_funds (
      id, name, currency_code, goal_minor, created_at, updated_at
    ) VALUES (?, 'Rainy day fund', ?, 0, ?, ?)`,
    createLocalId('fund'),
    normalizeCurrencyCode(currencyCode),
    now,
    now,
  );
}

export async function updateRainyDayFundStorage(
  db: RepositoryDatabase,
  input: UpdateRainyDayFundInput,
): Promise<void> {
  const now = new Date().toISOString();
  const fund = await db.getFirstAsync<RainyDayFundRow>('SELECT * FROM rainy_day_funds LIMIT 1');
  if (!fund) {
    throw new Error('Rainy day fund is missing.');
  }

  const currencyCode = normalizeCurrencyCode(input.currencyCode);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE rainy_day_funds SET currency_code = ?, goal_minor = ?, updated_at = ? WHERE id = ?',
      currencyCode,
      input.goalMinor,
      now,
      fund.id,
    );
    await db.runAsync('DELETE FROM rainy_day_fund_accounts WHERE fund_id = ?', fund.id);
    await db.runAsync('UPDATE accounts SET include_in_rainy_day = 0');

    for (const accountId of input.linkedAccountIds) {
      const account = await db.getFirstAsync<AccountRow>('SELECT * FROM accounts WHERE id = ?', accountId);
      if (account?.currency_code === currencyCode) {
        await db.runAsync(
          'INSERT OR IGNORE INTO rainy_day_fund_accounts (fund_id, account_id) VALUES (?, ?)',
          fund.id,
          accountId,
        );
        await db.runAsync(
          'UPDATE accounts SET include_in_rainy_day = 1, updated_at = ? WHERE id = ?',
          now,
          accountId,
        );
      }
    }
  });
}

export async function updateEmptyRainyDayFundCurrency(
  db: RepositoryDatabase,
  currencyCode: string,
): Promise<void> {
  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode);
  const fund = await db.getFirstAsync<RainyDayFundRow>('SELECT * FROM rainy_day_funds LIMIT 1');
  if (!fund || fund.goal_minor !== 0 || fund.currency_code === normalizedCurrencyCode) {
    return;
  }

  const linkedCount = await db.getFirstAsync<CountRow>(
    'SELECT COUNT(*) as count FROM rainy_day_fund_accounts WHERE fund_id = ?',
    fund.id,
  );
  if ((linkedCount?.count ?? 0) > 0) {
    return;
  }

  await db.runAsync(
    'UPDATE rainy_day_funds SET currency_code = ?, updated_at = ? WHERE id = ?',
    normalizedCurrencyCode,
    new Date().toISOString(),
    fund.id,
  );
}

export async function linkAccountToRainyFundIfCompatible(
  db: RepositoryDatabase,
  accountId: string,
  currencyCode: string,
): Promise<void> {
  const fund = await db.getFirstAsync<RainyDayFundRow>('SELECT * FROM rainy_day_funds LIMIT 1');
  if (fund?.currency_code === currencyCode) {
    await db.runAsync(
      'INSERT OR IGNORE INTO rainy_day_fund_accounts (fund_id, account_id) VALUES (?, ?)',
      fund.id,
      accountId,
    );
  }
}
