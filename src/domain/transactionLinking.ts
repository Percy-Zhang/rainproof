import { getAccountDisplayName } from './accountThemes';
import { compareTransactionsDescending } from './aggregates';
import { formatMoney, normalizeCurrencyCode } from './money';
import { formatTransactionShortDate, getSplitLineChildDisplayText } from './transactionDisplay';
import { getTransactionLinkAllocationStatus } from './transactionLinkAllocationStatus';
import { getCategory, getSubcategory, getSubcategoryName } from './categories';
import type {
  CategoryDefinition,
  Account,
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
  searchMatchesParent: boolean;
  searchMatchedLineIds: string[];
  searchIndex: TransactionLinkCandidateSearchIndex;
};

export type IncomeLinkSourceCandidate = {
  transaction: Transaction;
  amountMinor: number;
  currencyCode: CurrencyCode;
  accountId: string;
  eligible: boolean;
  disabledReason: string;
  isLinked: boolean;
  searchMatchesParent: boolean;
  searchMatchedLineIds: string[];
  searchIndex: TransactionLinkCandidateSearchIndex;
};

export type TransactionLinkCandidateSearchIndex = {
  parentText: string;
  lineTextById: Readonly<Record<string, string>>;
};

export type TransactionLinkEditSummary = {
  linked: boolean;
  title: string;
  detail: string;
  secondaryDetail: string;
};

type TransactionLinkEndpoint = 'source' | 'target';

export type TransactionLinkEndpointDisplay = {
  kind: 'parent' | 'split-line' | 'missing';
  title: string;
  metadata: string;
  dateLabel: string;
  context: string;
  label: string;
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

export function getTransactionLinkEndpointSignedAmountMinor({
  transactionId,
  lineId,
  currencyCode,
  lines,
}: {
  transactionId: string;
  lineId: string | null;
  currencyCode: CurrencyCode;
  lines: TransactionLine[];
}): number {
  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode);
  if (lineId) {
    const line = lines.find(
      (item) =>
        item.id === lineId &&
        item.transactionId === transactionId &&
        normalizeCurrencyCode(item.currencyCode) === normalizedCurrencyCode,
    );
    return line?.amountMinor ?? 0;
  }

  return lines
    .filter(
      (line) =>
        line.transactionId === transactionId &&
        normalizeCurrencyCode(line.currencyCode) === normalizedCurrencyCode,
    )
    .reduce((sum, line) => sum + line.amountMinor, 0);
}

export function getExpenseLinkTargetCandidates({
  sourceTransactionId,
  sourceCurrencyCode,
  transactions,
  lines,
  transactionLinks = [],
  query,
  categories,
  accounts,
}: {
  sourceTransactionId: string;
  sourceCurrencyCode: CurrencyCode | null;
  transactions: Transaction[];
  lines: TransactionLine[];
  transactionLinks?: TransactionLink[];
  query: string;
  categories?: CategoryDefinition[];
  accounts?: Account[];
}): ExpenseLinkTargetCandidate[] {
  const normalizedQuery = normalizeLinkSearchText(query);
  const normalizedSourceCurrencyCode = sourceCurrencyCode ? normalizeCurrencyCode(sourceCurrencyCode) : null;
  const linesByTransactionId = groupLinesByTransactionId(lines);
  const linkedParentTransactionIds = new Set(transactionLinks
    .filter((link) => !normalizeOptionalId(link.targetLineId))
    .map((link) => link.targetTransactionId));

  return transactions
    .filter((transaction) => transaction.kind !== 'transfer' && transaction.id !== sourceTransactionId)
    .map((transaction) => {
      const transactionLines = linesByTransactionId.get(transaction.id) ?? [];
      const allExpenseLines = transactionLines.filter((line) => line.amountMinor < 0);
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
      const searchIndex = createTransactionLinkCandidateSearchIndex({
        transaction,
        lines: displayLines,
        categories,
        accounts,
        parentValues: [
          ...getLineCategorySearchValues(firstLine, categories),
          currencyCode,
          ...getAmountSearchValues(amountMinor, currencyCode),
        ],
      });
      const searchMatch = matchTransactionLinkCandidateSearch(searchIndex, normalizedQuery);

      return {
        transaction,
        amountMinor,
        currencyCode,
        accountId: firstLine?.accountId ?? '',
        categoryId: firstLine?.categoryId ?? '',
        subcategoryId: firstLine?.subcategoryId ?? '',
        eligible,
        disabledReason: eligible ? '' : 'Different currency',
        isLinked: linkedParentTransactionIds.has(transaction.id),
        searchMatchesParent: searchMatch.parentMatches,
        searchMatchedLineIds: searchMatch.lineIds,
        searchIndex,
      };
    })
    .filter((candidate) => candidate.amountMinor > 0)
    .filter((candidate) => {
      if (!normalizedQuery) {
        return true;
      }

      return candidate.searchMatchesParent || candidate.searchMatchedLineIds.length > 0;
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
  categories,
  accounts,
}: {
  targetTransactionId: string;
  targetCurrencyCode: CurrencyCode | null;
  transactions: Transaction[];
  lines: TransactionLine[];
  transactionLinks: TransactionLink[];
  query: string;
  categories?: CategoryDefinition[];
  accounts?: Account[];
}): IncomeLinkSourceCandidate[] {
  const normalizedQuery = normalizeLinkSearchText(query);
  const normalizedTargetCurrencyCode = targetCurrencyCode ? normalizeCurrencyCode(targetCurrencyCode) : null;
  const linesByTransactionId = groupLinesByTransactionId(lines);
  const linkedParentTransactionIds = new Set(transactionLinks
    .filter((link) => !normalizeOptionalId(link.sourceLineId))
    .map((link) => link.sourceTransactionId));

  return transactions
    .filter((transaction) => transaction.kind !== 'transfer' && transaction.id !== targetTransactionId)
    .map((transaction) => {
      const transactionLines = linesByTransactionId.get(transaction.id) ?? [];
      const allIncomeLines = transactionLines.filter((line) => line.amountMinor > 0);
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
      const searchIndex = createTransactionLinkCandidateSearchIndex({
        transaction,
        lines: displayLines,
        categories,
        accounts,
        parentValues: [currencyCode, ...getAmountSearchValues(amountMinor, currencyCode)],
      });
      const searchMatch = matchTransactionLinkCandidateSearch(searchIndex, normalizedQuery);

      return {
        transaction,
        amountMinor,
        currencyCode,
        accountId: firstLine?.accountId ?? '',
        eligible: currencyMatches,
        disabledReason: currencyMatches ? '' : 'Different currency',
        isLinked: linkedParentTransactionIds.has(transaction.id),
        searchMatchesParent: searchMatch.parentMatches,
        searchMatchedLineIds: searchMatch.lineIds,
        searchIndex,
      };
    })
    .filter((candidate) => candidate.amountMinor > 0)
    .filter((candidate) => {
      if (!normalizedQuery) {
        return true;
      }

      return candidate.searchMatchesParent || candidate.searchMatchedLineIds.length > 0;
    })
    .sort(compareIncomeSourceCandidatesDescending);
}

export type LinkCandidateSearchMatch = {
  parentMatches: boolean;
  lineIds: string[];
};

export function createTransactionLinkCandidateSearchIndex({
  transaction,
  lines,
  categories,
  accounts,
  parentValues,
}: {
  transaction: Transaction;
  lines: TransactionLine[];
  categories?: CategoryDefinition[];
  accounts?: Account[];
  parentValues: string[];
}): TransactionLinkCandidateSearchIndex {
  const lineTextById: Record<string, string> = {};
  for (const line of lines) {
    lineTextById[line.id] = createNormalizedSearchText(getLineSearchValues(line, categories, accounts));
  }

  return {
    parentText: createNormalizedSearchText([
      transaction.title,
      transaction.notes,
      ...transaction.labels,
      ...parentValues,
    ]),
    lineTextById,
  };
}

export function matchTransactionLinkCandidateSearch(
  searchIndex: TransactionLinkCandidateSearchIndex,
  query: string,
): LinkCandidateSearchMatch {
  const normalizedQuery = normalizeLinkSearchText(query);
  if (!normalizedQuery) {
    return { parentMatches: true, lineIds: [] };
  }

  const lineIds = Object.entries(searchIndex.lineTextById)
    .filter(([, text]) => text.includes(normalizedQuery))
    .map(([lineId]) => lineId);

  return { parentMatches: searchIndex.parentText.includes(normalizedQuery), lineIds };
}

function getLineSearchValues(
  line: TransactionLine,
  categories?: CategoryDefinition[],
  accounts?: Account[],
): string[] {
  const account = accounts?.find((item) => item.id === line.accountId);
  return [
    line.note,
    line.externalParty,
    line.currencyCode,
    account ? getAccountDisplayName(account) : '',
    ...getAmountSearchValues(Math.abs(line.amountMinor), line.currencyCode),
    ...getLineCategorySearchValues(line, categories),
  ];
}

function getAmountSearchValues(amountMinor: number, currencyCode: CurrencyCode): string[] {
  const fixedAmount = (Math.abs(amountMinor) / 100).toFixed(2);
  return [
    String(Math.abs(amountMinor)),
    fixedAmount,
    fixedAmount.replace(/\.00$/, ''),
    formatMoney(Math.abs(amountMinor), currencyCode),
  ];
}

function getLineCategorySearchValues(
  line: TransactionLine | undefined,
  categories?: CategoryDefinition[],
): string[] {
  if (!line) {
    return [];
  }

  return [
    line.categoryId,
    line.subcategoryId,
    line.categoryId ? getCategory(line.categoryId, categories).name : '',
    line.subcategoryId ? getSubcategoryName(line.categoryId, line.subcategoryId, categories) : '',
  ];
}

function createNormalizedSearchText(values: string[]): string {
  return values.map(normalizeLinkSearchText).filter(Boolean).join('\n');
}

function normalizeLinkSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function groupLinesByTransactionId(lines: TransactionLine[]): Map<string, TransactionLine[]> {
  const linesByTransactionId = new Map<string, TransactionLine[]>();

  for (const line of lines) {
    const existingLines = linesByTransactionId.get(line.transactionId);
    if (existingLines) {
      existingLines.push(line);
    } else {
      linesByTransactionId.set(line.transactionId, [line]);
    }
  }

  return linesByTransactionId;
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
  categories?: CategoryDefinition[];
}): TransactionLinkEditSummary {
  const transaction = transactions.find((item) => item.id === transactionId);

  if (transaction?.kind === 'income') {
    const sourceLinks = transactionLinks.filter((link) => link.sourceTransactionId === transactionId);
    if (!sourceLinks.length) {
      return {
        linked: false,
        title: 'Link to expense',
        detail: 'No linked expenses yet.',
        secondaryDetail: '',
      };
    }

    const currencyCode = sourceLinks[0].currencyCode;
    const status = getTransactionLinkAllocationStatus({
      transactionId,
      currencyCode,
      side: 'source',
      lines,
      persistedLinks: transactionLinks,
    });
    return {
      linked: true,
      title: `${formatAllocationState(status.status)} · ${status.linkCount} ${status.linkCount === 1 ? 'use' : 'uses'}`,
      detail: `Received: ${formatAmount(status.originalMinor, currencyCode)} / Allocated: ${formatAmount(status.allocatedMinor, currencyCode)} / Available: ${formatAmount(status.remainingMinor, currencyCode)}`,
      secondaryDetail: '',
    };
  }

  if (transaction?.kind === 'expense') {
    const targetLinks = transactionLinks.filter((link) => link.targetTransactionId === transactionId);
    if (!targetLinks.length) {
      return {
        linked: false,
        title: 'Link money received',
        detail: 'No linked payments yet.',
        secondaryDetail: '',
      };
    }

    const currencyCode = targetLinks[0].currencyCode;
    const status = getTransactionLinkAllocationStatus({
      transactionId,
      currencyCode,
      side: 'target',
      lines,
      persistedLinks: transactionLinks,
    });

    return {
      linked: true,
      title: `${formatAllocationState(status.status)} · ${status.linkCount} ${status.linkCount === 1 ? 'payment' : 'payments'}`,
      detail: `Original: ${formatAmount(status.originalMinor, currencyCode)} / Allocated: ${formatAmount(status.allocatedMinor, currencyCode)} / Remaining: ${formatAmount(status.remainingMinor, currencyCode)}`,
      secondaryDetail: '',
    };
  }

  return {
    linked: false,
    title: 'Link transaction',
    detail: 'Transfers cannot be linked',
    secondaryDetail: '',
  };
}

function formatAllocationState(status: 'unlinked' | 'partial' | 'settled'): string {
  if (status === 'partial') return 'Partial';
  if (status === 'settled') return 'Settled';
  return 'Open';
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

  return getTransactionLinkEndpointDisplay({
    transactionId,
    lineId,
    transactions,
    lines,
    categories,
  }).label;
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

export function getLinkedCounterpartDisplayForEndpoint({
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
}): TransactionLinkEndpointDisplay {
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
    return missingTransactionLinkEndpointDisplay;
  }

  const counterpartTransactionId = endpoint === 'source' ? link.targetTransactionId : link.sourceTransactionId;
  const counterpartLineId = endpoint === 'source' ? link.targetLineId : link.sourceLineId;
  return getTransactionLinkEndpointDisplay({
    transactionId: counterpartTransactionId,
    lineId: counterpartLineId,
    transactions,
    lines,
    categories,
  });
}

export function getTransactionLinkEndpointDisplay({
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
}): TransactionLinkEndpointDisplay {
  const transaction = transactions.find((item) => item.id === transactionId);
  if (!transaction) {
    return missingTransactionLinkEndpointDisplay;
  }

  const normalizedLineId = normalizeOptionalId(lineId);
  const dateLabel = formatTransactionShortDate(transaction.datetime);
  if (normalizedLineId) {
    const line = lines.find((item) => item.id === normalizedLineId && item.transactionId === transactionId);
    if (!line) {
      return missingTransactionLinkEndpointDisplay;
    }

    const title = getSplitLineLinkTitle(line, transaction, categories);
    const parentLabel = getParentTransactionLabel(transaction);
    const context = getSplitLineMetadataContext(line, title, parentLabel, categories);
    const parentContext = parentLabel && !isSameDisplayText(title, parentLabel) ? parentLabel : '';
    const labelTitle = parentContext ? `${title} · ${parentLabel}` : title;

    return {
      kind: 'split-line',
      title,
      metadata: context,
      dateLabel,
      context: [context, dateLabel].filter(Boolean).join(' / '),
      label: [labelTitle, dateLabel].filter(Boolean).join(' / '),
    };
  }

  const title = getParentTransactionLabel(transaction);
  return {
    kind: 'parent',
    title,
    metadata: '',
    dateLabel,
    context: dateLabel,
    label: [title, dateLabel].filter(Boolean).join(' / '),
  };
}

const missingTransactionLinkEndpointDisplay: TransactionLinkEndpointDisplay = {
  kind: 'missing',
  title: '',
  metadata: '',
  dateLabel: '',
  context: '',
  label: '',
};

function getSplitLineLinkTitle(
  line: TransactionLine,
  transaction: Transaction,
  categories?: CategoryDefinition[],
): string {
  const parentLabel = getParentTransactionLabel(transaction);
  const splitDisplayText = getSplitLineChildDisplayText(line, parentLabel, categories);
  return line.note.trim() || splitDisplayText.title;
}

function getSplitLineMetadataContext(
  line: TransactionLine,
  title: string,
  parentLabel: string,
  categories?: CategoryDefinition[],
): string {
  const subcategoryName = getSubcategory(line.categoryId, line.subcategoryId, categories)?.name.trim() ?? '';
  if (subcategoryName) {
    return isSameDisplayText(subcategoryName, title) ? '' : subcategoryName;
  }

  return parentLabel && !isSameDisplayText(parentLabel, title) ? parentLabel : '';
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

function compareCandidateTransactionsDescending(
  left: ExpenseLinkTargetCandidate,
  right: ExpenseLinkTargetCandidate,
): number {
  return compareTransactionsDescending(left.transaction, right.transaction);
}

function compareIncomeSourceCandidatesDescending(
  left: IncomeLinkSourceCandidate,
  right: IncomeLinkSourceCandidate,
): number {
  return compareTransactionsDescending(left.transaction, right.transaction);
}
