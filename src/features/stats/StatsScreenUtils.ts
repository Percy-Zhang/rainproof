import { formatMoney } from '../../domain/money';
import type { StatsReportKind } from '../../domain/statsReports';
import type { Account } from '../../domain/types';

export function accountLabel(account: Account, showCurrencyCodes: boolean): string {
  return showCurrencyCodes ? `${account.name} (${account.currencyCode})` : account.name;
}

export function formatSignedMoney(amountMinor: number, currencyCode: string): string {
  return amountMinor > 0 ? `+${formatMoney(amountMinor, currencyCode)}` : formatMoney(amountMinor, currencyCode);
}

export function getNetTone(amountMinor: number): 'income' | 'expense' | undefined {
  if (amountMinor > 0) {
    return 'income';
  }

  if (amountMinor < 0) {
    return 'expense';
  }

  return undefined;
}

export function formatSignedReportAmount(
  amountMinor: number,
  currencyCode: string,
  reportKind: StatsReportKind,
): string {
  return `${reportKind === 'expense' ? '-' : '+'}${formatMoney(amountMinor, currencyCode)}`;
}
