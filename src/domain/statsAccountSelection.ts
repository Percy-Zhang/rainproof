import { getInitialSelectedAccountIds } from './accountSelection';
import type { Account, CurrencyCode } from './types';

export function getStatsInitialSelectedAccountIds(
  accounts: Account[],
  defaultSelectedAccountIds?: string[],
): string[] {
  return getInitialSelectedAccountIds(accounts, defaultSelectedAccountIds);
}

export function getStatsSelectedCurrencyCodes(
  accounts: Account[],
  selectedAccountIds: string[],
): CurrencyCode[] {
  const selectedAccountIdSet = new Set(selectedAccountIds);
  const selectedCurrencyCodes: CurrencyCode[] = [];
  const selectedCurrencySet = new Set<CurrencyCode>();

  for (const account of accounts) {
    if (!selectedAccountIdSet.has(account.id) || selectedCurrencySet.has(account.currencyCode)) {
      continue;
    }

    selectedCurrencySet.add(account.currencyCode);
    selectedCurrencyCodes.push(account.currencyCode);
  }

  return selectedCurrencyCodes;
}

export function resolveStatsCurrencyScope({
  fallbackCurrencyCode,
  requestedCurrencyCode,
  selectedCurrencyCodes,
}: {
  fallbackCurrencyCode: CurrencyCode;
  requestedCurrencyCode: CurrencyCode;
  selectedCurrencyCodes: CurrencyCode[];
}): CurrencyCode {
  if (selectedCurrencyCodes.includes(requestedCurrencyCode)) {
    return requestedCurrencyCode;
  }

  return selectedCurrencyCodes[0] ?? fallbackCurrencyCode;
}

export function getStatsSelectedAccountIdsForCurrency({
  accounts,
  currencyCode,
  selectedAccountIds,
}: {
  accounts: Account[];
  currencyCode: CurrencyCode;
  selectedAccountIds: string[];
}): string[] {
  const selectedAccountIdSet = new Set(selectedAccountIds);

  return accounts
    .filter((account) => selectedAccountIdSet.has(account.id) && account.currencyCode === currencyCode)
    .map((account) => account.id);
}
