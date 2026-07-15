import {
  getTransactionLinkSourceOptions,
  getTransactionLinkSourceScopes,
  getTransactionLinkTargetOptions,
  getTransactionLinkTargetScopes,
  type TransactionLinkSourceOption,
  type TransactionLinkSourceScope,
  type TransactionLinkTargetOption,
  type TransactionLinkTargetScope,
} from './transactionLinkAllocationForm';
import {
  createTransactionLinkAllocationStatusContext,
  getTransactionLineLinkAllocationStatus,
  getTransactionLinkAllocationStatus,
  type ScopedTransactionLinkAllocationStatus,
  type TransactionLinkAllocationStatusContext,
} from './transactionLinkAllocationStatus';
import {
  getExpenseLinkTargetCandidates,
  getIncomeLinkSourceCandidates,
  matchTransactionLinkCandidateSearch,
  type ExpenseLinkTargetCandidate,
  type IncomeLinkSourceCandidate,
} from './transactionLinking';
import { compareTransactionsDescending } from './aggregates';
import { getAccountDisplayName } from './accountThemes';
import { getSubcategoryColor, getSubcategoryIcon } from './categories';
import { formatMoney, normalizeCurrencyCode } from './money';
import {
  formatTransactionShortDate,
  getTransactionAmountTone,
  type TransactionAmountTone,
} from './transactionDisplay';
import type {
  AppSnapshot,
  CurrencyCode,
  Transaction,
  TransactionLinkBatchInput,
} from './types';

export const DEFAULT_TRANSACTION_LINK_CANDIDATE_FILTER = 'open' as const;
export const TRANSACTION_LINK_CANDIDATE_PAGE_SIZE = 20;

export type TransactionLinkCandidateFilter = 'open' | 'partial' | 'settled' | 'all';
export type TransactionLinkCandidateParentKind = 'parent' | 'split' | 'mixed';
export type TransactionLinkCandidatePresentation = {
  accountName: string | null;
  amountLabel: string;
  amountTone: TransactionAmountTone;
  dateLabel: string;
  iconColor: string | null;
  iconName: string | null;
  parentLabel: string;
  statusLabel: string;
  title: string;
};

export type ExpenseLinkTargetCandidateView = ExpenseLinkTargetCandidate & {
  iconCategoryId: string | null;
  iconSubcategoryId: string | null;
  lineCount: number;
  parentKind: TransactionLinkCandidateParentKind;
  presentation: TransactionLinkCandidatePresentation;
  selectable: boolean;
  signedAmountMinor: number;
  status: ScopedTransactionLinkAllocationStatus;
};

export type IncomeLinkSourceCandidateView = IncomeLinkSourceCandidate & {
  iconCategoryId: string | null;
  iconSubcategoryId: string | null;
  lineCount: number;
  parentKind: TransactionLinkCandidateParentKind;
  presentation: TransactionLinkCandidatePresentation;
  selectable: boolean;
  signedAmountMinor: number;
  status: ScopedTransactionLinkAllocationStatus;
};

export type TransactionLinkSourceScopeView = TransactionLinkSourceScope & {
  status: ScopedTransactionLinkAllocationStatus;
};

export type TransactionLinkTargetScopeView = TransactionLinkTargetScope & {
  status: ScopedTransactionLinkAllocationStatus;
};

export type TransactionLinkSourceOptionView = TransactionLinkSourceOption & {
  status: ScopedTransactionLinkAllocationStatus;
};

export type TransactionLinkTargetOptionView = TransactionLinkTargetOption & {
  status: ScopedTransactionLinkAllocationStatus;
};

export type TransactionLinkCandidateStatusBuckets<T> = Record<TransactionLinkCandidateFilter, T[]>;

type CandidateDerivationInput = {
  snapshot: Pick<AppSnapshot, 'accounts' | 'categories' | 'transactions' | 'transactionLines' | 'transactionLinks'>;
  currencyCode: CurrencyCode;
  currentTransaction: Transaction;
  draftChanges: TransactionLinkBatchInput;
  filter: TransactionLinkCandidateFilter;
  query: string;
  statusContext?: TransactionLinkAllocationStatusContext;
};

type CandidatePreparationInput = Omit<CandidateDerivationInput, 'filter' | 'query'>;

export function deriveExpenseLinkTargetCandidateViews({
  filter,
  query,
  ...input
}: CandidateDerivationInput): ExpenseLinkTargetCandidateView[] {
  return filterPreparedExpenseLinkTargetCandidateViews(
    prepareExpenseLinkTargetCandidateViews(input),
    { filter, query },
  );
}

export function prepareExpenseLinkTargetCandidateViews({
  snapshot,
  currencyCode,
  currentTransaction,
  draftChanges,
  statusContext,
}: CandidatePreparationInput): ExpenseLinkTargetCandidateView[] {
  const parentPresentations = createCandidateParentPresentationLookup(snapshot.transactionLines);
  const presentationContext = createCandidatePresentationContext(snapshot);
  const context = statusContext ?? createTransactionLinkAllocationStatusContext({
    lines: snapshot.transactionLines,
    persistedLinks: snapshot.transactionLinks,
    draftChanges,
  });
  return getExpenseLinkTargetCandidates({
    sourceTransactionId: currentTransaction.id,
    sourceCurrencyCode: currencyCode,
    transactions: snapshot.transactions,
    lines: snapshot.transactionLines,
    transactionLinks: snapshot.transactionLinks,
    categories: snapshot.categories,
    accounts: snapshot.accounts,
    query: '',
  })
    .map((candidate) => {
      const status = getTransactionLinkAllocationStatus({
        transactionId: candidate.transaction.id,
        currencyCode: candidate.currencyCode,
        side: 'target',
        lines: snapshot.transactionLines,
        persistedLinks: snapshot.transactionLinks,
        draftChanges,
        context,
      });
      const parentPresentation = getCandidateParentPresentation(
        candidate.transaction.id,
        candidate.currencyCode,
        parentPresentations,
      );
      const signedAmountMinor = -candidate.amountMinor;
      return {
        ...candidate,
        isLinked: status.allocatedMinor > 0,
        eligible: candidate.eligible,
        selectable: candidate.eligible && parentPresentation.parentKind === 'parent' && status.remainingMinor > 0,
        disabledReason: candidate.eligible && status.remainingMinor <= 0 ? 'Settled' : candidate.disabledReason,
        ...parentPresentation,
        presentation: createCandidatePresentation({
          candidate,
          context: presentationContext,
          parentPresentation,
          signedAmountMinor,
          status,
        }),
        signedAmountMinor,
        status,
      };
    })
    .sort((left, right) => compareTransactionsDescending(left.transaction, right.transaction));
}

export function deriveIncomeLinkSourceCandidateViews({
  filter,
  query,
  ...input
}: CandidateDerivationInput): IncomeLinkSourceCandidateView[] {
  return filterPreparedIncomeLinkSourceCandidateViews(
    prepareIncomeLinkSourceCandidateViews(input),
    { filter, query },
  );
}

export function prepareIncomeLinkSourceCandidateViews({
  snapshot,
  currencyCode,
  currentTransaction,
  draftChanges,
  statusContext,
}: CandidatePreparationInput): IncomeLinkSourceCandidateView[] {
  const parentPresentations = createCandidateParentPresentationLookup(snapshot.transactionLines);
  const presentationContext = createCandidatePresentationContext(snapshot);
  const context = statusContext ?? createTransactionLinkAllocationStatusContext({
    lines: snapshot.transactionLines,
    persistedLinks: snapshot.transactionLinks,
    draftChanges,
  });
  return getIncomeLinkSourceCandidates({
    targetTransactionId: currentTransaction.id,
    targetCurrencyCode: currencyCode,
    transactions: snapshot.transactions,
    lines: snapshot.transactionLines,
    transactionLinks: snapshot.transactionLinks,
    categories: snapshot.categories,
    accounts: snapshot.accounts,
    query: '',
  })
    .map((candidate) => {
      const status = getTransactionLinkAllocationStatus({
        transactionId: candidate.transaction.id,
        currencyCode: candidate.currencyCode,
        side: 'source',
        lines: snapshot.transactionLines,
        persistedLinks: snapshot.transactionLinks,
        draftChanges,
        context,
      });
      const parentPresentation = getCandidateParentPresentation(
        candidate.transaction.id,
        candidate.currencyCode,
        parentPresentations,
      );
      const signedAmountMinor = candidate.amountMinor;
      return {
        ...candidate,
        isLinked: status.allocatedMinor > 0,
        eligible: candidate.eligible,
        selectable: candidate.eligible && parentPresentation.parentKind === 'parent' && status.remainingMinor > 0,
        disabledReason: candidate.eligible && status.remainingMinor <= 0 ? 'Settled' : candidate.disabledReason,
        ...parentPresentation,
        presentation: createCandidatePresentation({
          candidate,
          context: presentationContext,
          parentPresentation,
          signedAmountMinor,
          status,
        }),
        signedAmountMinor,
        status,
      };
    })
    .sort((left, right) => compareTransactionsDescending(left.transaction, right.transaction));
}

export function filterPreparedExpenseLinkTargetCandidateViews(
  candidates: ExpenseLinkTargetCandidateView[],
  input: Pick<CandidateDerivationInput, 'filter' | 'query'>,
): ExpenseLinkTargetCandidateView[] {
  return filterExpenseLinkTargetCandidateViewsByStatus(
    searchPreparedExpenseLinkTargetCandidateViews(candidates, input.query),
    input.filter,
  );
}

export function filterPreparedIncomeLinkSourceCandidateViews(
  candidates: IncomeLinkSourceCandidateView[],
  input: Pick<CandidateDerivationInput, 'filter' | 'query'>,
): IncomeLinkSourceCandidateView[] {
  return filterIncomeLinkSourceCandidateViewsByStatus(
    searchPreparedIncomeLinkSourceCandidateViews(candidates, input.query),
    input.filter,
  );
}

export function searchPreparedExpenseLinkTargetCandidateViews(
  candidates: ExpenseLinkTargetCandidateView[],
  query: string,
): ExpenseLinkTargetCandidateView[] {
  return searchPreparedCandidateViews(candidates, query);
}

export function searchPreparedIncomeLinkSourceCandidateViews(
  candidates: IncomeLinkSourceCandidateView[],
  query: string,
): IncomeLinkSourceCandidateView[] {
  return searchPreparedCandidateViews(candidates, query);
}

export function filterExpenseLinkTargetCandidateViewsByStatus(
  candidates: ExpenseLinkTargetCandidateView[],
  filter: TransactionLinkCandidateFilter,
): ExpenseLinkTargetCandidateView[] {
  return candidates.filter((candidate) => candidateMatchesFilter(candidate, filter));
}

export function filterIncomeLinkSourceCandidateViewsByStatus(
  candidates: IncomeLinkSourceCandidateView[],
  filter: TransactionLinkCandidateFilter,
): IncomeLinkSourceCandidateView[] {
  return candidates.filter((candidate) => candidateMatchesFilter(candidate, filter));
}

function searchPreparedCandidateViews<T extends ExpenseLinkTargetCandidateView | IncomeLinkSourceCandidateView>(
  candidates: T[],
  query: string,
): T[] {
  if (!query.trim()) {
    return candidates;
  }

  return candidates.flatMap((candidate) => {
    const searchMatch = matchTransactionLinkCandidateSearch(candidate.searchIndex, query);
    if (!searchMatch.parentMatches && !searchMatch.lineIds.length) {
      return [];
    }
    return [{
      ...candidate,
      searchMatchesParent: searchMatch.parentMatches,
      searchMatchedLineIds: searchMatch.lineIds,
    }];
  });
}

export function getTransactionLinkCandidateStatusBuckets<
  T extends ExpenseLinkTargetCandidateView | IncomeLinkSourceCandidateView,
>(candidates: T[]): TransactionLinkCandidateStatusBuckets<T> {
  const buckets: TransactionLinkCandidateStatusBuckets<T> = {
    all: [],
    open: [],
    partial: [],
    settled: [],
  };

  for (const candidate of candidates) {
    if (!candidateMatchesFilter(candidate, 'all')) {
      continue;
    }
    buckets.all.push(candidate);
    if (candidate.status.status === 'settled') {
      buckets.settled.push(candidate);
    } else if (candidate.status.status === 'partial') {
      buckets.partial.push(candidate);
    } else if (candidate.status.status === 'unlinked') {
      buckets.open.push(candidate);
    }
  }

  return buckets;
}

export function getTransactionLinkSourceScopeViews({
  transaction,
  snapshot,
  draftChanges,
  statusContext,
}: {
  transaction: Transaction;
  snapshot: Pick<AppSnapshot, 'transactionLines' | 'transactionLinks'>;
  draftChanges: TransactionLinkBatchInput;
  statusContext?: TransactionLinkAllocationStatusContext;
}): TransactionLinkSourceScopeView[] {
  const context = statusContext ?? createTransactionLinkAllocationStatusContext({
    lines: snapshot.transactionLines,
    persistedLinks: snapshot.transactionLinks,
    draftChanges,
  });
  return getTransactionLinkSourceScopes(transaction, snapshot.transactionLines, snapshot.transactionLinks)
    .map((scope) => {
      const status = getScopeStatus({
        transactionId: transaction.id,
        lineId: scope.sourceLineId,
        currencyCode: scope.currencyCode,
        side: 'source',
        snapshot,
        draftChanges,
        context,
      });
      return { ...scope, isLinked: status.allocatedMinor > 0, status };
    });
}

export function getTransactionLinkTargetScopeViews({
  transaction,
  snapshot,
  draftChanges,
  statusContext,
}: {
  transaction: Transaction;
  snapshot: Pick<AppSnapshot, 'transactionLines' | 'transactionLinks'>;
  draftChanges: TransactionLinkBatchInput;
  statusContext?: TransactionLinkAllocationStatusContext;
}): TransactionLinkTargetScopeView[] {
  const context = statusContext ?? createTransactionLinkAllocationStatusContext({
    lines: snapshot.transactionLines,
    persistedLinks: snapshot.transactionLinks,
    draftChanges,
  });
  return getTransactionLinkTargetScopes(transaction, snapshot.transactionLines, snapshot.transactionLinks)
    .map((scope) => {
      const status = getScopeStatus({
        transactionId: transaction.id,
        lineId: scope.targetLineId,
        currencyCode: scope.currencyCode,
        side: 'target',
        snapshot,
        draftChanges,
        context,
      });
      return { ...scope, isLinked: status.allocatedMinor > 0, status };
    });
}

export function getTransactionLinkTargetOptionViews({
  transaction,
  currencyCode,
  snapshot,
  draftChanges,
  statusContext,
}: {
  transaction: Transaction;
  currencyCode: CurrencyCode;
  snapshot: Pick<AppSnapshot, 'transactionLines' | 'transactionLinks'>;
  draftChanges: TransactionLinkBatchInput;
  statusContext?: TransactionLinkAllocationStatusContext;
}): TransactionLinkTargetOptionView[] {
  const context = statusContext ?? createTransactionLinkAllocationStatusContext({
    lines: snapshot.transactionLines,
    persistedLinks: snapshot.transactionLinks,
    draftChanges,
  });
  return getTransactionLinkTargetOptions({
    transaction,
    lines: snapshot.transactionLines,
    currencyCode,
    transactionLinks: snapshot.transactionLinks,
  }).map((option) => {
    const status = getScopeStatus({
      transactionId: transaction.id,
      lineId: option.targetLineId,
      currencyCode,
      side: 'target',
      snapshot,
      draftChanges,
      context,
    });
    return {
      ...option,
      isLinked: status.allocatedMinor > 0,
      eligible: status.remainingMinor > 0,
      disabledReason: status.remainingMinor > 0 ? '' : 'Settled',
      status,
    };
  });
}

export function getTransactionLinkSourceOptionViews({
  transaction,
  currencyCode,
  snapshot,
  draftChanges,
  statusContext,
}: {
  transaction: Transaction;
  currencyCode: CurrencyCode;
  snapshot: Pick<AppSnapshot, 'transactionLines' | 'transactionLinks'>;
  draftChanges: TransactionLinkBatchInput;
  statusContext?: TransactionLinkAllocationStatusContext;
}): TransactionLinkSourceOptionView[] {
  const context = statusContext ?? createTransactionLinkAllocationStatusContext({
    lines: snapshot.transactionLines,
    persistedLinks: snapshot.transactionLinks,
    draftChanges,
  });
  return getTransactionLinkSourceOptions({
    transaction,
    lines: snapshot.transactionLines,
    currencyCode,
    transactionLinks: snapshot.transactionLinks,
  }).map((option) => {
    const status = getScopeStatus({
      transactionId: transaction.id,
      lineId: option.sourceLineId,
      currencyCode,
      side: 'source',
      snapshot,
      draftChanges,
      context,
    });
    return {
      ...option,
      isLinked: status.allocatedMinor > 0,
      eligible: status.remainingMinor > 0,
      disabledReason: status.remainingMinor > 0 ? '' : 'Settled',
      status,
    };
  });
}

function getScopeStatus({
  transactionId,
  lineId,
  currencyCode,
  side,
  snapshot,
  draftChanges,
  context,
}: {
  transactionId: string;
  lineId: string | null;
  currencyCode: CurrencyCode;
  side: 'source' | 'target';
  snapshot: Pick<AppSnapshot, 'transactionLines' | 'transactionLinks'>;
  draftChanges: TransactionLinkBatchInput;
  context: TransactionLinkAllocationStatusContext;
}): ScopedTransactionLinkAllocationStatus {
  const input = {
    transactionId,
    currencyCode,
    side,
    lines: snapshot.transactionLines,
    persistedLinks: snapshot.transactionLinks,
    draftChanges,
    context,
  };
  return lineId
    ? getTransactionLineLinkAllocationStatus({ ...input, lineId })
    : getTransactionLinkAllocationStatus(input);
}

function candidateMatchesFilter(
  candidate: ExpenseLinkTargetCandidateView | IncomeLinkSourceCandidateView,
  filter: TransactionLinkCandidateFilter,
): boolean {
  if (!candidate.eligible && candidate.disabledReason === 'Different currency') {
    return false;
  }
  if (filter === 'all') {
    return true;
  }
  if (filter === 'settled') {
    return candidate.status.status === 'settled';
  }
  if (filter === 'partial') {
    return candidate.status.status === 'partial';
  }
  return candidate.status.status === 'unlinked';
}

export function getLinkAllocationEditableMaximumMinor({
  currentAmountMinor,
  sourceStatus,
  targetStatus,
}: {
  currentAmountMinor: number;
  sourceStatus: ScopedTransactionLinkAllocationStatus;
  targetStatus: ScopedTransactionLinkAllocationStatus;
}): number {
  const overAllocatedMinor = Math.max(
    sourceStatus.overAllocatedMinor,
    sourceStatus.parentOverAllocatedMinor,
    targetStatus.overAllocatedMinor,
    targetStatus.parentOverAllocatedMinor,
  );
  return Math.max(
    0,
    currentAmountMinor + Math.min(sourceStatus.remainingMinor, targetStatus.remainingMinor) - overAllocatedMinor,
  );
}

export function getDefaultLinkAllocationAmountMinor(
  sourceStatus: ScopedTransactionLinkAllocationStatus,
  targetStatus: ScopedTransactionLinkAllocationStatus,
): number {
  return Math.min(sourceStatus.remainingMinor, targetStatus.remainingMinor);
}

export function getTransactionLinkCandidateParentLabel(
  parentKind: TransactionLinkCandidateParentKind,
  lineCount: number,
): string {
  if (parentKind === 'mixed') {
    return `Mixed split parent · ${lineCount} lines`;
  }
  if (parentKind === 'split') {
    return `Split parent · ${lineCount} lines`;
  }
  return 'Parent transaction';
}

function getCandidateParentPresentation(
  transactionId: string,
  currencyCode: CurrencyCode,
  lookup: Map<string, CandidateParentPresentation>,
): CandidateParentPresentation {
  return lookup.get(getCandidateParentPresentationKey(transactionId, currencyCode)) ?? {
    iconCategoryId: null,
    iconSubcategoryId: null,
    lineCount: 0,
    parentKind: 'parent',
  };
}

type CandidateParentPresentation = {
  iconCategoryId: string | null;
  iconSubcategoryId: string | null;
  lineCount: number;
  parentKind: TransactionLinkCandidateParentKind;
};

type CandidatePresentationContext = {
  accountNames: Map<string, string>;
  categories: AppSnapshot['categories'];
  icons: Map<string, { color: string; name: string }>;
};

function createCandidatePresentationContext(
  snapshot: Pick<AppSnapshot, 'accounts' | 'categories'>,
): CandidatePresentationContext {
  return {
    accountNames: new Map(snapshot.accounts.map((account) => [account.id, getAccountDisplayName(account)])),
    categories: snapshot.categories,
    icons: new Map(),
  };
}

function createCandidatePresentation({
  candidate,
  context,
  parentPresentation,
  signedAmountMinor,
  status,
}: {
  candidate: Pick<ExpenseLinkTargetCandidate, 'accountId' | 'currencyCode' | 'transaction'>;
  context: CandidatePresentationContext;
  parentPresentation: CandidateParentPresentation;
  signedAmountMinor: number;
  status: ScopedTransactionLinkAllocationStatus;
}): TransactionLinkCandidatePresentation {
  const icon = getCandidateIconPresentation(
    parentPresentation.iconCategoryId,
    parentPresentation.iconSubcategoryId,
    context,
  );
  return {
    accountName: context.accountNames.get(candidate.accountId) ?? null,
    amountLabel: formatSignedCandidateMoney(signedAmountMinor, candidate.currencyCode),
    amountTone: getTransactionAmountTone(signedAmountMinor),
    dateLabel: formatTransactionShortDate(candidate.transaction.datetime),
    iconColor: icon?.color ?? null,
    iconName: icon?.name ?? null,
    parentLabel: getTransactionLinkCandidateParentLabel(parentPresentation.parentKind, parentPresentation.lineCount),
    statusLabel: formatCandidateStatus(status, candidate.currencyCode),
    title: candidate.transaction.title || 'Transaction',
  };
}

function getCandidateIconPresentation(
  categoryId: string | null,
  subcategoryId: string | null,
  context: CandidatePresentationContext,
): { color: string; name: string } | null {
  if (!categoryId) {
    return null;
  }
  const key = `${categoryId}:${subcategoryId ?? ''}`;
  const cached = context.icons.get(key);
  if (cached) {
    return cached;
  }
  const icon = {
    color: getSubcategoryColor(categoryId, subcategoryId ?? '', context.categories),
    name: getSubcategoryIcon(categoryId, subcategoryId ?? '', context.categories),
  };
  context.icons.set(key, icon);
  return icon;
}

function formatCandidateStatus(status: ScopedTransactionLinkAllocationStatus, currencyCode: CurrencyCode): string {
  if (status.remainingMinor <= 0) {
    return 'Settled';
  }
  if (status.allocatedMinor > 0) {
    return `Linked ${formatMoney(status.allocatedMinor, currencyCode)} · Remaining ${formatMoney(status.remainingMinor, currencyCode)}`;
  }
  return `Remaining ${formatMoney(status.remainingMinor, currencyCode)}`;
}

function formatSignedCandidateMoney(amountMinor: number, currencyCode: CurrencyCode): string {
  const amount = formatMoney(Math.abs(amountMinor), currencyCode);
  return amountMinor < 0 ? `-${amount}` : `+${amount}`;
}

function createCandidateParentPresentationLookup(
  lines: AppSnapshot['transactionLines'],
): Map<string, CandidateParentPresentation> {
  const linesByScope = new Map<string, AppSnapshot['transactionLines']>();
  for (const line of lines) {
    if (line.amountMinor === 0) {
      continue;
    }
    const key = getCandidateParentPresentationKey(line.transactionId, line.currencyCode);
    const scopedLines = linesByScope.get(key);
    if (scopedLines) {
      scopedLines.push(line);
    } else {
      linesByScope.set(key, [line]);
    }
  }

  const presentations = new Map<string, CandidateParentPresentation>();
  for (const [key, transactionLines] of linesByScope) {
    presentations.set(key, createCandidateParentPresentation(transactionLines));
  }
  return presentations;
}

function createCandidateParentPresentation(
  transactionLines: AppSnapshot['transactionLines'],
): CandidateParentPresentation {
  const hasIncome = transactionLines.some((line) => line.amountMinor > 0);
  const hasExpense = transactionLines.some((line) => line.amountMinor < 0);
  const parentKind: TransactionLinkCandidateParentKind = hasIncome && hasExpense
    ? 'mixed'
    : transactionLines.length > 1
      ? 'split'
      : 'parent';
  const firstLine = transactionLines[0];
  const iconLine = parentKind === 'parent'
    ? firstLine
    : firstLine && transactionLines.every(
        (line) => line.categoryId === firstLine.categoryId && line.subcategoryId === firstLine.subcategoryId,
      )
      ? firstLine
      : undefined;
  return {
    iconCategoryId: iconLine?.categoryId ?? null,
    iconSubcategoryId: iconLine?.subcategoryId ?? null,
    lineCount: transactionLines.length,
    parentKind,
  };
}

function getCandidateParentPresentationKey(transactionId: string, currencyCode: CurrencyCode): string {
  return `${transactionId}:${normalizeCurrencyCode(currencyCode)}`;
}
