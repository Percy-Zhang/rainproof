import { getAccountDisplayName } from './accountThemes';
import {
  formatCreditCardBalanceLabel,
  getCreditCardBalanceSummary,
} from './creditCards';
import { formatMoney } from './money';
import type { Account, CurrencyCode } from './types';

export type AccountSelectionSummary = {
  detail: string;
  headline: string;
};

export function getSelectableAccounts(accounts: Account[]): Account[] {
  return accounts.filter((account) => !account.isArchived);
}

export function getSelectableAccountIds(accounts: Account[]): string[] {
  return getSelectableAccounts(accounts).map((account) => account.id);
}

export function getInitialSelectedAccountIds(
  accounts: Account[],
  defaultSelectedAccountIds?: string[],
): string[] {
  const selectableAccountIds = getSelectableAccountIds(accounts);
  if (!defaultSelectedAccountIds) {
    return selectableAccountIds;
  }

  const selectableAccountIdSet = new Set(selectableAccountIds);
  return defaultSelectedAccountIds.filter((accountId) => selectableAccountIdSet.has(accountId));
}

export function getAccountSelectionSummary(
  accounts: Account[],
  selectedAccountIds: string[],
): AccountSelectionSummary {
  const selectedAccountIdSet = new Set(selectedAccountIds);
  const selectedAccounts = getSelectableAccounts(accounts).filter((account) => selectedAccountIdSet.has(account.id));
  const selectedCount = selectedAccounts.length;

  if (!selectedCount) {
    return {
      headline: 'No accounts selected',
      detail: 'No accounts selected',
    };
  }

  const currencyLabel = getCurrencySummary(selectedAccounts);
  if (selectedCount === 1) {
    return {
      headline: getAccountDisplayName(selectedAccounts[0]),
      detail: currencyLabel,
    };
  }

  return {
    headline: `${getAccountDisplayName(selectedAccounts[0])} + ${selectedCount - 1} more`,
    detail: `${selectedCount} accounts - ${currencyLabel}`,
  };
}

export function getAccountSelectionBalanceLabel(account: Account, balanceMinor?: number): string {
  if (balanceMinor === undefined) {
    return account.currencyCode;
  }

  const creditCardSummary = getCreditCardBalanceSummary({ account, balanceMinor });
  return creditCardSummary
    ? formatCreditCardBalanceLabel({ account, balanceMinor }, { showCurrencyCode: true })
    : formatMoney(balanceMinor, account.currencyCode, { showCurrencyCode: true });
}

function getCurrencySummary(accounts: Account[]): string {
  const currencyCodes: CurrencyCode[] = [];
  const currencyCodeSet = new Set<CurrencyCode>();

  for (const account of accounts) {
    if (currencyCodeSet.has(account.currencyCode)) {
      continue;
    }

    currencyCodeSet.add(account.currencyCode);
    currencyCodes.push(account.currencyCode);
  }

  return currencyCodes.join(', ');
}
