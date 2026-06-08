import { getLinkedStatsAdjustments } from './linkedStats';
import { normalizeCurrencyCode } from './money';
import { formatTransactionShortDate, getSplitLineChildDisplayText } from './transactionDisplay';
import { isTransactionParentLinked } from './transactionLinks';
import type {
  CategoryDefinition,
  CurrencyCode,
  Transaction,
  TransactionLine,
  TransactionLink,
  TransactionLinkType,
} from './types';

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
  isLinked: boolean;
};

export type IncomeLinkSourceCandidate = {
  transaction: Transaction;
  amountMinor: number;
  currencyCode: CurrencyCode;
  accountId: string;
  eligible: boolean;
  disabledReason: string;
  isLinked: boolean;
};

export type TransactionLinkEditSummary = {
  linked: boolean;
  title: string;
  detail: string;
  secondaryDetail: string;
};

type TransactionLinkEndpoint = 'source' | 'target';

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

const expenseLinkPrefixes: Record<TransactionLinkType, string> = {
  refund: 'Refund from',
  reimbursement: 'Paid back by',
  shared_expense_contribution: 'Contribution from',
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
  transactionLinks = [],
  query,
}: {
  sourceTransactionId: string;
  sourceCurrencyCode: CurrencyCode | null;
  transactions: Transaction[];
  lines: TransactionLine[];
  transactionLinks?: TransactionLink[];
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
        isLinked: isTransactionParentLinked(transaction.id, transactionLinks),
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
      const currencyMatches = !!normalizedTargetCurrencyCode && currencyCode === normalizedTargetCurrencyCode;

      return {
        transaction,
        amountMinor,
        currencyCode,
        accountId: firstLine?.accountId ?? '',
        eligible: currencyMatches,
        disabledReason: currencyMatches ? '' : 'Different currency',
        isLinked: isTransactionParentLinked(transaction.id, transactionLinks),
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
  categories,
}: {
  transactionId: string;
  transactions: Transaction[];
  lines: TransactionLine[];
  transactionLinks: TransactionLink[];
  formatAmount: (amountMinor: number, currencyCode: CurrencyCode) => string;
  categories?: CategoryDefinition[];
}): TransactionLinkEditSummary {
  const transaction = transactions.find((item) => item.id === transactionId);

  if (transaction?.kind === 'income') {
    const sourceLinks = transactionLinks.filter((link) => link.sourceTransactionId === transactionId);
    if (!sourceLinks.length) {
      return {
        linked: false,
        title: 'Link to expense',
        detail: 'No linked expense yet. Add refunds, reimbursements, or shared costs.',
        secondaryDetail: '',
      };
    }

    const sourceLink = sourceLinks[0];
    const currencyCode = sourceLink.currencyCode;
    const linkedAmountMinor = sourceLinks
      .filter((link) => normalizeCurrencyCode(link.currencyCode) === normalizeCurrencyCode(currencyCode))
      .reduce((sum, link) => sum + link.amountMinor, 0);
    const targetLabel = getTransactionLinkCounterpartDisplayLabel({
      link: sourceLink,
      endpoint: 'target',
      transactions,
      lines,
      categories,
    });
    return {
      linked: true,
      title: sourceLinks.length === 1 ? 'Linked transaction' : `Linked to ${sourceLinks.length} expenses`,
      detail: sourceLinks.length === 1
        ? `${incomeLinkPrefixes[sourceLink.linkType]}: ${targetLabel || 'expense'}`
        : `Linked amount: ${formatAmount(linkedAmountMinor, currencyCode)}`,
      secondaryDetail: sourceLinks.length === 1
        ? `Linked amount: ${formatAmount(linkedAmountMinor, currencyCode)}`
        : getLinkTypeAmountSummary(sourceLinks, currencyCode, formatAmount),
    };
  }

  if (transaction?.kind === 'expense') {
    const targetLinks = transactionLinks.filter((link) => link.targetTransactionId === transactionId);
    if (!targetLinks.length) {
      return {
        linked: false,
        title: 'Link money received',
        detail: 'No linked money received yet. Add refunds, reimbursements, or shared costs.',
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
    const sourceLabel = getTransactionLinkCounterpartDisplayLabel({
      link: targetLinks[0],
      endpoint: 'source',
      transactions,
      lines,
      categories,
    });

    return {
      linked: true,
      title: targetLinks.length === 1 ? 'Linked transaction' : `Linked to ${targetLinks.length} incoming payments`,
      detail: targetLinks.length === 1
        ? `${expenseLinkPrefixes[targetLinks[0].linkType]}: ${sourceLabel || 'income'} / Received back: ${formatAmount(linkedAmountMinor, currencyCode)}`
        : `Money received back: ${formatAmount(linkedAmountMinor, currencyCode)}`,
      secondaryDetail: [
        `Original: ${formatAmount(originalAmountMinor, currencyCode)} / Counted in stats: ${formatAmount(countedAmountMinor, currencyCode)}`,
        targetLinks.length > 1 ? typeSummary : '',
      ].filter(Boolean).join(' / '),
    };
  }

  return {
    linked: false,
    title: 'Link transaction',
    detail: 'Transfers cannot be linked',
    secondaryDetail: '',
  };
}

export function getTransactionLinkCounterpartDisplayLabel({
  link,
  endpoint,
  transactions,
  lines,
  categories,
}: {
  link: TransactionLink;
  endpoint: TransactionLinkEndpoint;
  transactions: Transaction[];
  lines: TransactionLine[];
  categories?: CategoryDefinition[];
}): string {
  const transactionId = endpoint === 'source' ? link.sourceTransactionId : link.targetTransactionId;
  const lineId = endpoint === 'source' ? link.sourceLineId : link.targetLineId;

  return getTransactionLinkEndpointDisplayLabel({
    transactionId,
    lineId,
    transactions,
    lines,
    categories,
  });
}

export function getLinkedCounterpartDisplayLabelForEndpoint({
  endpoint,
  transactionId,
  lineId,
  transactions,
  lines,
  transactionLinks,
  categories,
}: {
  endpoint: TransactionLinkEndpoint;
  transactionId: string;
  lineId?: string | null;
  transactions: Transaction[];
  lines: TransactionLine[];
  transactionLinks: TransactionLink[];
  categories?: CategoryDefinition[];
}): string {
  const normalizedLineId = normalizeOptionalId(lineId);
  const link = transactionLinks.find((candidate) => {
    if (endpoint === 'source') {
      return candidate.sourceTransactionId === transactionId &&
        normalizeOptionalId(candidate.sourceLineId) === normalizedLineId;
    }

    return candidate.targetTransactionId === transactionId &&
      normalizeOptionalId(candidate.targetLineId) === normalizedLineId;
  });

  if (!link) {
    return '';
  }

  return getTransactionLinkCounterpartDisplayLabel({
    link,
    endpoint: endpoint === 'source' ? 'target' : 'source',
    transactions,
    lines,
    categories,
  });
}

function getTransactionLinkEndpointDisplayLabel({
  transactionId,
  lineId,
  transactions,
  lines,
  categories,
}: {
  transactionId: string;
  lineId?: string | null;
  transactions: Transaction[];
  lines: TransactionLine[];
  categories?: CategoryDefinition[];
}): string {
  const transaction = transactions.find((item) => item.id === transactionId);
  if (!transaction) {
    return '';
  }

  const normalizedLineId = normalizeOptionalId(lineId);
  if (normalizedLineId) {
    const line = lines.find((item) => item.id === normalizedLineId && item.transactionId === transactionId);
    if (!line) {
      return '';
    }

    return `${getSplitLineLinkLabel(line, transaction, categories)} / ${formatTransactionShortDate(transaction.datetime)}`;
  }

  return `${getParentTransactionLabel(transaction)} / ${formatTransactionShortDate(transaction.datetime)}`;
}

function getSplitLineLinkLabel(
  line: TransactionLine,
  transaction: Transaction,
  categories?: CategoryDefinition[],
): string {
  const parentLabel = getParentTransactionLabel(transaction);
  const splitDisplayText = getSplitLineChildDisplayText(line, parentLabel, categories);
  const lineItemLabel = line.note.trim() || splitDisplayText.secondaryText || splitDisplayText.title;

  if (!parentLabel || isSameDisplayText(lineItemLabel, parentLabel)) {
    return lineItemLabel;
  }

  return `${lineItemLabel} · ${parentLabel}`;
}

function getParentTransactionLabel(transaction: Transaction): string {
  return transaction.title.trim() || transaction.kind;
}

function isSameDisplayText(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed || null;
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
