import { isWithinDateRange } from './dates';
import {
  getLinkedStatsAdjustments,
  type LinkedStatsAdjustments,
} from './linkedStats';
import type {
  CurrencyCode,
  DateRange,
  Transaction,
  TransactionLine,
  TransactionLink,
} from './types';

export type DashboardSelectedAccountContext = {
  incomeExpenseCurrencyCodes: CurrencyCode[];
  linkedStatsAdjustments: LinkedStatsAdjustments;
  range: DateRange;
  selectedAccountIdSet: Set<string>;
  selectedAccountIds: string[];
  selectedLines: TransactionLine[];
  selectedLinesByTransactionId: Map<string, TransactionLine[]>;
  spendingCurrencyCodes: CurrencyCode[];
  transactionById: Map<string, Transaction>;
  transactionLinks: TransactionLink[];
  transactions: Transaction[];
};

export function buildDashboardSelectedAccountContext({
  lines,
  range,
  selectedAccountIds,
  transactionLinks = [],
  transactions,
}: {
  lines: TransactionLine[];
  range: DateRange;
  selectedAccountIds: string[];
  transactionLinks?: TransactionLink[];
  transactions: Transaction[];
}): DashboardSelectedAccountContext {
  const selectedAccountIdSet = new Set(selectedAccountIds);
  const transactionById = selectedAccountIds.length
    ? new Map(transactions.map((transaction) => [transaction.id, transaction]))
    : new Map<string, Transaction>();
  const selectedLines: TransactionLine[] = [];
  const selectedLinesByTransactionId = new Map<string, TransactionLine[]>();
  const incomeExpenseCurrencyCodes = new Set<CurrencyCode>();
  const spendingCurrencyCodes = new Set<CurrencyCode>();

  if (selectedAccountIds.length) {
    for (const line of lines) {
      if (!selectedAccountIdSet.has(line.accountId)) {
        continue;
      }

      selectedLines.push(line);
      const existingLines = selectedLinesByTransactionId.get(line.transactionId);
      if (existingLines) {
        existingLines.push(line);
      } else {
        selectedLinesByTransactionId.set(line.transactionId, [line]);
      }

      const transaction = transactionById.get(line.transactionId);
      if (
        !transaction ||
        transaction.kind === 'transfer' ||
        !isWithinDateRange(transaction.datetime, range)
      ) {
        continue;
      }

      incomeExpenseCurrencyCodes.add(line.currencyCode);
      if (line.amountMinor < 0) {
        spendingCurrencyCodes.add(line.currencyCode);
      }
    }
  }

  return {
    incomeExpenseCurrencyCodes: sortCurrencyCodes(incomeExpenseCurrencyCodes),
    linkedStatsAdjustments: selectedAccountIds.length
      ? getLinkedStatsAdjustments({ transactions, lines, transactionLinks })
      : createEmptyLinkedStatsAdjustments(),
    range,
    selectedAccountIdSet,
    selectedAccountIds: [...selectedAccountIds],
    selectedLines,
    selectedLinesByTransactionId,
    spendingCurrencyCodes: sortCurrencyCodes(spendingCurrencyCodes),
    transactionById,
    transactionLinks,
    transactions,
  };
}

function sortCurrencyCodes(currencyCodes: Set<CurrencyCode>): CurrencyCode[] {
  return Array.from(currencyCodes).sort((left, right) => left.localeCompare(right));
}

function createEmptyLinkedStatsAdjustments(): LinkedStatsAdjustments {
  return {
    expenseLineReductionMinorByLineId: new Map(),
    incomeLineExclusionMinorByLineId: new Map(),
    ignoredCurrencyMismatchLinkIds: [],
    overpayments: [],
  };
}
