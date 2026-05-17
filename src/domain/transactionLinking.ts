import { getLinkedStatsAdjustments } from './linkedStats';
import { normalizeCurrencyCode } from './money';
import type { CurrencyCode, Transaction, TransactionLine, TransactionLink, TransactionLinkType } from './types';

export type IncomeLinkTreatment = TransactionLinkType | 'normal';

export type TransactionLinkMoney = {
  amountMinor: number;
  currencyCode: CurrencyCode;
};

export type ExpenseLinkTargetCandidate = {
  transaction: Transaction;
  amountMinor: number;
  currencyCode: CurrencyCode;
  accountId: string;
  categoryId: string;
  subcategoryId: string;
  eligible: boolean;
  disabledReason: string;
};

export type IncomeLinkSourceCandidate = {
  transaction: Transaction;
  amountMinor: number;
  currencyCode: CurrencyCode;
  accountId: string;
  eligible: boolean;
  disabledReason: string;
};

export type TransactionLinkEditSummary = {
  linked: boolean;
  title: string;
  detail: string;
  secondaryDetail: string;
};

const linkTypeShortLabels: Record<TransactionLinkType, string> = {
  refund: 'Refund',
  reimbursement: 'Reimbursement',
  shared_expense_contribution: 'Shared expense contribution',
};

const incomeLinkPrefixes: Record<TransactionLinkType, string> = {
  refund: 'Refund for',
  reimbursement: 'Paid back for',
  shared_expense_contribution: 'Contribution toward',
};

export function getIncomeLinkTreatment(
  transactionId: string,
  transactionLinks: TransactionLink[],
): IncomeLinkTreatment {
  return transactionLinks.find((link) => link.sourceTransactionId === transactionId)?.linkType ?? 'normal';
}

export function getTransactionLinkSourceAmount(
  transactionId: string,
  lines: TransactionLine[],
): TransactionLinkMoney | null {
  const positiveLines = lines.filter((line) => line.transactionId === transactionId && line.amountMinor > 0);
  const currencyCode = normalizeCurrencyCode(positiveLines[0]?.currencyCode);
  const sameCurrencyLines = positiveLines.filter((line) => normalizeCurrencyCode(line.currencyCode) === currencyCode);
  const amountMinor = sameCurrencyLines.reduce((sum, line) => sum + line.amountMinor, 0);

  return amountMinor > 0 ? { amountMinor, currencyCode } : null;
}

export function getExpenseLinkTargetMoney(
  transactionId: string,
  lines: TransactionLine[],
  currencyCode?: CurrencyCode,
): TransactionLinkMoney | null {
  const normalizedCurrencyCode = currencyCode ? normalizeCurrencyCode(currencyCode) : '';
  const negativeLines = lines.filter(
    (line) =>
      line.transactionId === transactionId &&
      line.amountMinor < 0 &&
      (!normalizedCurrencyCode || normalizeCurrencyCode(line.currencyCode) === normalizedCurrencyCode),
  );
  const targetCurrencyCode = normalizeCurrencyCode(negativeLines[0]?.currencyCode);
  const amountMinor = negativeLines
    .filter((line) => normalizeCurrencyCode(line.currencyCode) === targetCurrencyCode)
    .reduce((sum, line) => sum + Math.abs(line.amountMinor), 0);

  return amountMinor > 0 ? { amountMinor, currencyCode: targetCurrencyCode } : null;
}

export function getExpenseLinkTargetCandidates({
  sourceTransactionId,
  sourceCurrencyCode,
  transactions,
  lines,
  query,
}: {
  sourceTransactionId: string;
  sourceCurrencyCode: CurrencyCode | null;
  transactions: Transaction[];
  lines: TransactionLine[];
  query: string;
}): ExpenseLinkTargetCandidate[] {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedSourceCurrencyCode = sourceCurrencyCode ? normalizeCurrencyCode(sourceCurrencyCode) : null;

  return transactions
    .filter((transaction) => transaction.kind === 'expense' && transaction.id !== sourceTransactionId)
    .map((transaction) => {
      const allExpenseLines = lines.filter(
        (line) => line.transactionId === transaction.id && line.amountMinor < 0,
      );
      const matchingCurrencyLines = normalizedSourceCurrencyCode
        ? allExpenseLines.filter(
            (line) => normalizeCurrencyCode(line.currencyCode) === normalizedSourceCurrencyCode,
          )
        : [];
      const displayLines = matchingCurrencyLines.length ? matchingCurrencyLines : allExpenseLines;
      const firstLine = displayLines[0];
      const currencyCode = normalizeCurrencyCode(firstLine?.currencyCode);
      const amountMinor = displayLines
        .filter((line) => normalizeCurrencyCode(line.currencyCode) === currencyCode)
        .reduce((sum, line) => sum + Math.abs(line.amountMinor), 0);
      const eligible = !!normalizedSourceCurrencyCode && currencyCode === normalizedSourceCurrencyCode;

      return {
        transaction,
        amountMinor,
        currencyCode,
        accountId: firstLine?.accountId ?? '',
        categoryId: firstLine?.categoryId ?? '',
        subcategoryId: firstLine?.subcategoryId ?? '',
        eligible,
        disabledReason: eligible ? '' : 'Different currency',
      };
    })
    .filter((candidate) => candidate.amountMinor > 0)
    .filter((candidate) => {
      if (!normalizedQuery) {
        return true;
      }

      return [
        candidate.transaction.title,
        candidate.categoryId,
        candidate.subcategoryId,
        candidate.currencyCode,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    })
    .sort(compareCandidateTransactionsDescending);
}

export function getIncomeLinkSourceCandidates({
  targetTransactionId,
  targetCurrencyCode,
  transactions,
  lines,
  transactionLinks,
  query,
}: {
  targetTransactionId: string;
  targetCurrencyCode: CurrencyCode | null;
  transactions: Transaction[];
  lines: TransactionLine[];
  transactionLinks: TransactionLink[];
  query: string;
}): IncomeLinkSourceCandidate[] {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedTargetCurrencyCode = targetCurrencyCode ? normalizeCurrencyCode(targetCurrencyCode) : null;
  const sourceLinkByTransactionId = new Map(
    transactionLinks.map((link) => [link.sourceTransactionId, link]),
  );

  return transactions
    .filter((transaction) => transaction.kind === 'income' && transaction.id !== targetTransactionId)
    .map((transaction) => {
      const allIncomeLines = lines.filter(
        (line) => line.transactionId === transaction.id && line.amountMinor > 0,
      );
      const matchingCurrencyLines = normalizedTargetCurrencyCode
        ? allIncomeLines.filter(
            (line) => normalizeCurrencyCode(line.currencyCode) === normalizedTargetCurrencyCode,
          )
        : [];
      const displayLines = matchingCurrencyLines.length ? matchingCurrencyLines : allIncomeLines;
      const firstLine = displayLines[0];
      const currencyCode = normalizeCurrencyCode(firstLine?.currencyCode);
      const amountMinor = displayLines
        .filter((line) => normalizeCurrencyCode(line.currencyCode) === currencyCode)
        .reduce((sum, line) => sum + line.amountMinor, 0);
      const existingSourceLink = sourceLinkByTransactionId.get(transaction.id);
      const currencyMatches = !!normalizedTargetCurrencyCode && currencyCode === normalizedTargetCurrencyCode;
      const alreadyLinkedElsewhere =
        !!existingSourceLink && existingSourceLink.targetTransactionId !== targetTransactionId;

      return {
        transaction,
        amountMinor,
        currencyCode,
        accountId: firstLine?.accountId ?? '',
        eligible: currencyMatches && !alreadyLinkedElsewhere,
        disabledReason: !currencyMatches
          ? 'Different currency'
          : alreadyLinkedElsewhere
            ? 'Already linked'
            : '',
      };
    })
    .filter((candidate) => candidate.amountMinor > 0)
    .filter((candidate) => {
      if (!normalizedQuery) {
        return true;
      }

      return [
        candidate.transaction.title,
        candidate.currencyCode,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    })
    .sort(compareIncomeSourceCandidatesDescending);
}

export function getTransactionLinkEditSummary({
  transactionId,
  transactions,
  lines,
  transactionLinks,
  formatAmount,
}: {
  transactionId: string;
  transactions: Transaction[];
  lines: TransactionLine[];
  transactionLinks: TransactionLink[];
  formatAmount: (amountMinor: number, currencyCode: CurrencyCode) => string;
}): TransactionLinkEditSummary {
  const transaction = transactions.find((item) => item.id === transactionId);

  if (transaction?.kind === 'income') {
    const sourceLink = transactionLinks.find((link) => link.sourceTransactionId === transactionId);
    if (!sourceLink) {
      return {
        linked: false,
        title: 'Link to expense',
        detail: 'Refunds, reimbursements, shared costs',
        secondaryDetail: '',
      };
    }

    const target = transactions.find((item) => item.id === sourceLink.targetTransactionId);
    return {
      linked: true,
      title: `${incomeLinkPrefixes[sourceLink.linkType]}: ${target?.title || 'expense'}`,
      detail: `Linked amount: ${formatAmount(sourceLink.amountMinor, sourceLink.currencyCode)}`,
      secondaryDetail: '',
    };
  }

  if (transaction?.kind === 'expense') {
    const targetLinks = transactionLinks.filter((link) => link.targetTransactionId === transactionId);
    if (!targetLinks.length) {
      return {
        linked: false,
        title: 'Link money received',
        detail: 'Refunds, reimbursements, shared costs',
        secondaryDetail: '',
      };
    }

    const currencyCode = targetLinks[0].currencyCode;
    const originalAmountMinor = getExpenseLinkTargetMoney(transactionId, lines, currencyCode)?.amountMinor ?? 0;
    const linkedAmountMinor = targetLinks
      .filter((link) => normalizeCurrencyCode(link.currencyCode) === normalizeCurrencyCode(currencyCode))
      .reduce((sum, link) => sum + link.amountMinor, 0);
    const adjustments = getLinkedStatsAdjustments({ transactions, lines, transactionLinks });
    const countedAmountMinor = lines
      .filter(
        (line) =>
          line.transactionId === transactionId &&
          line.amountMinor < 0 &&
          normalizeCurrencyCode(line.currencyCode) === normalizeCurrencyCode(currencyCode),
      )
      .reduce(
        (sum, line) =>
          sum + Math.max(0, Math.abs(line.amountMinor) - (adjustments.expenseLineReductionMinorByLineId.get(line.id) ?? 0)),
        0,
      );
    const typeSummary = getLinkTypeAmountSummary(targetLinks, currencyCode, formatAmount);

    return {
      linked: true,
      title: `Money received back: ${formatAmount(linkedAmountMinor, currencyCode)}`,
      detail: `Original: ${formatAmount(originalAmountMinor, currencyCode)} / Counted in stats: ${formatAmount(countedAmountMinor, currencyCode)}`,
      secondaryDetail: typeSummary,
    };
  }

  return {
    linked: false,
    title: 'Link transaction',
    detail: 'Transfers cannot be linked',
    secondaryDetail: '',
  };
}

function getLinkTypeAmountSummary(
  links: TransactionLink[],
  currencyCode: CurrencyCode,
  formatAmount: (amountMinor: number, currencyCode: CurrencyCode) => string,
): string {
  const totals = new Map<TransactionLinkType, number>();
  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode);

  for (const link of links) {
    if (normalizeCurrencyCode(link.currencyCode) !== normalizedCurrencyCode) {
      continue;
    }

    totals.set(link.linkType, (totals.get(link.linkType) ?? 0) + link.amountMinor);
  }

  return (['refund', 'reimbursement', 'shared_expense_contribution'] as TransactionLinkType[])
    .filter((linkType) => (totals.get(linkType) ?? 0) > 0)
    .map((linkType) => `${linkTypeShortLabels[linkType]}: ${formatAmount(totals.get(linkType) ?? 0, currencyCode)}`)
    .join(' / ');
}

function compareCandidateTransactionsDescending(
  left: ExpenseLinkTargetCandidate,
  right: ExpenseLinkTargetCandidate,
): number {
  const datetimeDiff =
    new Date(right.transaction.datetime).getTime() - new Date(left.transaction.datetime).getTime();
  if (datetimeDiff !== 0) {
    return datetimeDiff;
  }

  const createdDiff =
    new Date(right.transaction.createdAt || 0).getTime() -
    new Date(left.transaction.createdAt || 0).getTime();
  if (createdDiff !== 0) {
    return createdDiff;
  }

  return right.transaction.id.localeCompare(left.transaction.id);
}

function compareIncomeSourceCandidatesDescending(
  left: IncomeLinkSourceCandidate,
  right: IncomeLinkSourceCandidate,
): number {
  const datetimeDiff =
    new Date(right.transaction.datetime).getTime() - new Date(left.transaction.datetime).getTime();
  if (datetimeDiff !== 0) {
    return datetimeDiff;
  }

  const createdDiff =
    new Date(right.transaction.createdAt || 0).getTime() -
    new Date(left.transaction.createdAt || 0).getTime();
  if (createdDiff !== 0) {
    return createdDiff;
  }

  return right.transaction.id.localeCompare(left.transaction.id);
}
