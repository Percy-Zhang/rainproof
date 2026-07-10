import { getAccountBalances } from './aggregates';
import { toDateInputValue } from './dates';
import { normalizeCurrencyCode } from './money';
import type { Account, CurrencyCode, DateRange, Transaction, TransactionLine } from './types';

export type BalanceHistoryPoint = {
  date: string;
  balanceMinor: number;
};

export type BalanceHistoryInput = {
  accounts: Account[];
  transactions: Transaction[];
  transactionLines: TransactionLine[];
  accountIds: string[];
  currencyCode: CurrencyCode;
  range: DateRange;
  now?: Date;
};

export function getBalanceHistoryPoints({
  accounts,
  transactions,
  transactionLines,
  accountIds,
  currencyCode,
  range,
  now = new Date(),
}: BalanceHistoryInput): BalanceHistoryPoint[] {
  if (!accountIds.length) {
    return [];
  }

  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode);
  const requestedAccountIds = new Set(accountIds);
  const currentBalances = getAccountBalances(accounts, transactionLines);
  const eligibleAccountIds = new Set(
    currentBalances
      .filter(
        (balance) =>
          requestedAccountIds.has(balance.account.id) &&
          normalizeCurrencyCode(balance.account.currencyCode) === normalizedCurrencyCode,
      )
      .map((balance) => balance.account.id),
  );

  if (!eligibleAccountIds.size) {
    return [];
  }

  const startDay = startOfLocalDay(new Date(range.startIso));
  const rangeEndDay = getInclusiveEndDay(range.endIso);
  const anchorDay = startOfLocalDay(now);
  const lastPointDay = rangeEndDay < anchorDay ? rangeEndDay : anchorDay;

  if (lastPointDay < startDay) {
    return [];
  }

  const currentBalanceMinor = currentBalances
    .filter((balance) => eligibleAccountIds.has(balance.account.id))
    .reduce((sum, balance) => sum + balance.balanceMinor, 0);
  const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const deltasByDay = getSelectedCurrencyDeltasByDay({
    transactionById,
    transactionLines,
    eligibleAccountIds,
    currencyCode: normalizedCurrencyCode,
  });
  const points: BalanceHistoryPoint[] = [];
  let runningBalanceMinor = currentBalanceMinor;

  for (let day = anchorDay; day >= startDay; day = addLocalDays(day, -1)) {
    const dayKey = toDateInputValue(day);

    if (day <= lastPointDay) {
      points.push({
        date: dayKey,
        balanceMinor: runningBalanceMinor,
      });
    }

    runningBalanceMinor -= deltasByDay.get(dayKey) ?? 0;
  }

  return points.reverse();
}

function getSelectedCurrencyDeltasByDay({
  transactionById,
  transactionLines,
  eligibleAccountIds,
  currencyCode,
}: {
  transactionById: Map<string, Transaction>;
  transactionLines: TransactionLine[];
  eligibleAccountIds: Set<string>;
  currencyCode: CurrencyCode;
}): Map<string, number> {
  const deltasByDay = new Map<string, number>();

  for (const line of transactionLines) {
    if (
      !eligibleAccountIds.has(line.accountId) ||
      normalizeCurrencyCode(line.currencyCode) !== currencyCode
    ) {
      continue;
    }

    const transaction = transactionById.get(line.transactionId);
    if (!transaction) {
      continue;
    }

    const dayKey = toDateInputValue(new Date(transaction.datetime));
    deltasByDay.set(dayKey, (deltasByDay.get(dayKey) ?? 0) + line.amountMinor);
  }

  return deltasByDay;
}

function getInclusiveEndDay(endIso: string): Date {
  return startOfLocalDay(new Date(new Date(endIso).getTime() - 1));
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
