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
import type {
  Account,
  AppSnapshot,
  CurrencyCode,
  Transaction,
  TransactionLinkBatchInput,
} from './types';

export const DEFAULT_TRANSACTION_LINK_CANDIDATE_FILTER = 'open' as const;
export const TRANSACTION_LINK_CANDIDATE_PAGE_SIZE = 20;

export type TransactionLinkCandidateFilter = 'open' | 'partial' | 'settled' | 'all';

export type ExpenseLinkTargetCandidateView = ExpenseLinkTargetCandidate & {
  exactCapacityMatch: boolean;
  externalPartyMatch: boolean;
  status: ScopedTransactionLinkAllocationStatus;
};

export type IncomeLinkSourceCandidateView = IncomeLinkSourceCandidate & {
  exactCapacityMatch: boolean;
  externalPartyMatch: boolean;
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

type CandidateDerivationInput = {
  snapshot: Pick<AppSnapshot, 'accounts' | 'categories' | 'transactions' | 'transactionLines' | 'transactionLinks'>;
  currencyCode: CurrencyCode;
  currentTransaction: Transaction;
  desiredAmountMinor: number;
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
  desiredAmountMinor,
  draftChanges,
  statusContext,
}: CandidatePreparationInput): ExpenseLinkTargetCandidateView[] {
  const context = statusContext ?? createTransactionLinkAllocationStatusContext({
    lines: snapshot.transactionLines,
    persistedLinks: snapshot.transactionLinks,
    draftChanges,
  });
  const currentParties = getTransactionExternalParties(currentTransaction.id, snapshot.transactionLines);
  const partiesByTransactionId = groupExternalPartiesByTransactionId(snapshot.transactionLines);

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
      return {
        ...candidate,
        isLinked: status.allocatedMinor > 0,
        eligible: candidate.eligible && status.remainingMinor > 0,
        disabledReason: candidate.eligible && status.remainingMinor <= 0 ? 'Settled' : candidate.disabledReason,
        exactCapacityMatch: desiredAmountMinor > 0 && status.remainingMinor === desiredAmountMinor,
        externalPartyMatch: hasMatchingExternalParty(candidate.transaction.id, currentParties, partiesByTransactionId),
        status,
      };
    })
    .sort((left, right) => compareCandidateViews({
      left,
      right,
      currentTransaction,
      desiredAmountMinor,
    }));
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
  desiredAmountMinor,
  draftChanges,
  statusContext,
}: CandidatePreparationInput): IncomeLinkSourceCandidateView[] {
  const context = statusContext ?? createTransactionLinkAllocationStatusContext({
    lines: snapshot.transactionLines,
    persistedLinks: snapshot.transactionLinks,
    draftChanges,
  });
  const currentParties = getTransactionExternalParties(currentTransaction.id, snapshot.transactionLines);
  const partiesByTransactionId = groupExternalPartiesByTransactionId(snapshot.transactionLines);

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
      return {
        ...candidate,
        isLinked: status.allocatedMinor > 0,
        eligible: candidate.eligible && status.remainingMinor > 0,
        disabledReason: candidate.eligible && status.remainingMinor <= 0 ? 'Settled' : candidate.disabledReason,
        exactCapacityMatch: desiredAmountMinor > 0 && status.remainingMinor === desiredAmountMinor,
        externalPartyMatch: hasMatchingExternalParty(candidate.transaction.id, currentParties, partiesByTransactionId),
        status,
      };
    })
    .sort((left, right) => compareCandidateViews({
      left,
      right,
      currentTransaction,
      desiredAmountMinor,
    }));
}

export function filterPreparedExpenseLinkTargetCandidateViews(
  candidates: ExpenseLinkTargetCandidateView[],
  input: Pick<CandidateDerivationInput, 'filter' | 'query'>,
): ExpenseLinkTargetCandidateView[] {
  return filterPreparedCandidateViews(candidates, input);
}

export function filterPreparedIncomeLinkSourceCandidateViews(
  candidates: IncomeLinkSourceCandidateView[],
  input: Pick<CandidateDerivationInput, 'filter' | 'query'>,
): IncomeLinkSourceCandidateView[] {
  return filterPreparedCandidateViews(candidates, input);
}

function filterPreparedCandidateViews<T extends ExpenseLinkTargetCandidateView | IncomeLinkSourceCandidateView>(
  candidates: T[],
  { filter, query }: Pick<CandidateDerivationInput, 'filter' | 'query'>,
): T[] {
  return candidates.flatMap((candidate) => {
    if (!candidateMatchesFilter(candidate, filter)) {
      return [];
    }
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

function compareCandidateViews({
  left,
  right,
  currentTransaction,
  desiredAmountMinor,
}: {
  left: ExpenseLinkTargetCandidateView | IncomeLinkSourceCandidateView;
  right: ExpenseLinkTargetCandidateView | IncomeLinkSourceCandidateView;
  currentTransaction: Transaction;
  desiredAmountMinor: number;
}): number {
  const exactDiff = Number(right.exactCapacityMatch) - Number(left.exactCapacityMatch);
  if (exactDiff) return exactDiff;
  const usableDiff = Number(right.status.remainingMinor > 0) - Number(left.status.remainingMinor > 0);
  if (usableDiff) return usableDiff;
  const partialDiff = Number(right.status.status === 'partial') - Number(left.status.status === 'partial');
  if (partialDiff) return partialDiff;
  const amountDiff = Math.abs(left.status.remainingMinor - desiredAmountMinor) -
    Math.abs(right.status.remainingMinor - desiredAmountMinor);
  if (amountDiff) return amountDiff;
  const partyDiff = Number(right.externalPartyMatch) - Number(left.externalPartyMatch);
  if (partyDiff) return partyDiff;
  const dateDistanceDiff = getDateDistance(left.transaction.datetime, currentTransaction.datetime) -
    getDateDistance(right.transaction.datetime, currentTransaction.datetime);
  if (dateDistanceDiff) return dateDistanceDiff;
  const datetimeDiff = getTime(right.transaction.datetime) - getTime(left.transaction.datetime);
  if (datetimeDiff) return datetimeDiff;
  return left.transaction.id.localeCompare(right.transaction.id);
}

function getTransactionExternalParties(transactionId: string, lines: AppSnapshot['transactionLines']): Set<string> {
  return new Set(lines
    .filter((line) => line.transactionId === transactionId)
    .map((line) => line.externalParty.trim().toLocaleLowerCase())
    .filter(Boolean));
}

function hasMatchingExternalParty(
  transactionId: string,
  currentParties: Set<string>,
  partiesByTransactionId: Map<string, Set<string>>,
): boolean {
  if (!currentParties.size) return false;
  const candidateParties = partiesByTransactionId.get(transactionId);
  return !!candidateParties && [...candidateParties].some((party) => currentParties.has(party));
}

function groupExternalPartiesByTransactionId(
  lines: AppSnapshot['transactionLines'],
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const line of lines) {
    const party = line.externalParty.trim().toLocaleLowerCase();
    if (!party) continue;
    const existing = result.get(line.transactionId);
    if (existing) existing.add(party);
    else result.set(line.transactionId, new Set([party]));
  }
  return result;
}

function getDateDistance(left: string, right: string): number {
  return Math.abs(getTime(left) - getTime(right));
}

function getTime(value: string): number {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
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

export function getAccountForCandidate(accountId: string, accounts: Account[]): Account | undefined {
  return accounts.find((account) => account.id === accountId);
}
