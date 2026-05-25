import { parseMoneyInput } from './money';
import type { Account, AccountType } from './types';

export const manualAccountTypes: AccountType[] = ['checking', 'savings', 'cash', 'credit_card'];

export function getAccountTypeLabel(accountType: AccountType): string {
  return accountType
    .split('_')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

export function parseOptionalOpeningBalance(input: string): number {
  return input.trim() ? parseMoneyInput(input) : 0;
}

export function parseOptionalCreditLimit(input: string): number | null {
  if (!input.trim()) {
    return null;
  }

  const amountMinor = parseMoneyInput(input);
  if (amountMinor <= 0) {
    return null;
  }

  return amountMinor;
}

export function formatOptionalMoneyInput(amountMinor: number | null | undefined): string {
  return amountMinor && amountMinor > 0 ? (amountMinor / 100).toFixed(2) : '';
}

export function getInstitutionSuggestions(
  accounts: Account[],
  query: string,
  currentValue = '',
  limit = 4,
): string[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  return Array.from(new Set(accounts.map((account) => account.institutionName).filter(Boolean)))
    .filter((institution) => {
      const normalizedInstitution = institution.toLowerCase();
      return normalizedInstitution.includes(normalizedQuery) && institution !== currentValue;
    })
    .slice(0, limit);
}
