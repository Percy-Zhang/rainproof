import { normalizeCurrencyCode } from './money';
import type {
  CurrencyCode,
  NewTransactionLinkInput,
  TransactionLine,
  TransactionLink,
  TransactionLinkBatchInput,
} from './types';

export type TransactionLinkAllocationSide = 'source' | 'target';
export type TransactionLinkAllocationState = 'unlinked' | 'partial' | 'settled';

export type ScopedTransactionLinkAllocationStatus = {
  scope: 'transaction' | 'line';
  side: TransactionLinkAllocationSide;
  transactionId: string;
  lineId: string | null;
  currencyCode: CurrencyCode;
  originalMinor: number;
  allocatedMinor: number;
  remainingMinor: number;
  directAllocatedMinor: number;
  directRemainingMinor: number;
  wholeScopeAllocatedMinor: number;
  otherLineAllocatedMinor: number;
  parentAllocatedMinor: number;
  parentRemainingMinor: number;
  linkCount: number;
  wholeScopeLinkCount: number;
  parentLinkCount: number;
  overAllocatedMinor: number;
  parentOverAllocatedMinor: number;
  invalidLinkCount: number;
  invalidDraftChangeCount: number;
  scopeExists: boolean;
  status: TransactionLinkAllocationState;
};

type AllocationStatusInput = {
  transactionId: string;
  currencyCode: CurrencyCode;
  side: TransactionLinkAllocationSide;
  lines: Pick<TransactionLine, 'id' | 'transactionId' | 'amountMinor' | 'currencyCode'>[];
  persistedLinks: TransactionLink[];
  draftChanges?: TransactionLinkBatchInput;
  context?: TransactionLinkAllocationStatusContext;
};

export type TransactionLinkAllocationStatusContext = {
  invalidDraftChangeCount: number;
  linesByScopeKey: Map<string, AllocationStatusInput['lines']>;
  linksByScopeKey: Map<string, EffectiveTransactionLink[]>;
};

type EffectiveTransactionLink = Pick<
  TransactionLink,
  | 'id'
  | 'sourceTransactionId'
  | 'targetTransactionId'
  | 'sourceLineId'
  | 'targetLineId'
  | 'linkType'
  | 'amountMinor'
  | 'currencyCode'
>;

export function getTransactionLinkAllocationStatus(
  input: AllocationStatusInput,
): ScopedTransactionLinkAllocationStatus {
  return getScopedTransactionLinkAllocationStatus({ ...input, lineId: null });
}

export function getTransactionLineLinkAllocationStatus(
  input: AllocationStatusInput & { lineId: string },
): ScopedTransactionLinkAllocationStatus {
  return getScopedTransactionLinkAllocationStatus(input);
}

export function createTransactionLinkAllocationStatusContext({
  lines,
  persistedLinks,
  draftChanges,
}: Pick<AllocationStatusInput, 'lines' | 'persistedLinks' | 'draftChanges'>): TransactionLinkAllocationStatusContext {
  const effective = getEffectiveTransactionLinks(persistedLinks, draftChanges);
  const linesByScopeKey = new Map<string, AllocationStatusInput['lines']>();
  const linksByScopeKey = new Map<string, EffectiveTransactionLink[]>();

  for (const line of lines) {
    if (line.amountMinor === 0) {
      continue;
    }
    const side: TransactionLinkAllocationSide = line.amountMinor > 0 ? 'source' : 'target';
    appendToIndex(linesByScopeKey, getScopeKey(line.transactionId, line.currencyCode, side), line);
  }

  for (const link of effective.links) {
    appendToIndex(
      linksByScopeKey,
      getScopeKey(link.sourceTransactionId.trim(), link.currencyCode, 'source'),
      link,
    );
    appendToIndex(
      linksByScopeKey,
      getScopeKey(link.targetTransactionId.trim(), link.currencyCode, 'target'),
      link,
    );
  }

  return {
    invalidDraftChangeCount: effective.invalidDraftChangeCount,
    linesByScopeKey,
    linksByScopeKey,
  };
}

function getScopedTransactionLinkAllocationStatus({
  transactionId,
  currencyCode,
  side,
  lines,
  persistedLinks,
  draftChanges,
  context,
  lineId,
}: AllocationStatusInput & { lineId: string | null }): ScopedTransactionLinkAllocationStatus {
  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode);
  const statusContext = context ?? createTransactionLinkAllocationStatusContext({
    lines,
    persistedLinks,
    draftChanges,
  });
  const scopeKey = getScopeKey(transactionId, normalizedCurrencyCode, side);
  const transactionLines = statusContext.linesByScopeKey.get(scopeKey) ?? [];
  const parentOriginalMinor = transactionLines.reduce(
    (sum, line) => sum + Math.abs(line.amountMinor),
    0,
  );
  const requestedLine = lineId
    ? transactionLines.find((line) => line.id === lineId)
    : undefined;
  const originalMinor = lineId ? Math.abs(requestedLine?.amountMinor ?? 0) : parentOriginalMinor;
  const lineIds = new Set(transactionLines.map((line) => line.id));
  const relevantLinks = statusContext.linksByScopeKey.get(scopeKey) ?? [];
  const validLinks: EffectiveTransactionLink[] = [];
  let invalidLinkCount = 0;

  for (const link of relevantLinks) {
    const endpointLineId = normalizeOptionalId(getLinkLineId(link, side));
    if (
      !Number.isSafeInteger(link.amountMinor) ||
      link.amountMinor <= 0 ||
      (endpointLineId !== null && !lineIds.has(endpointLineId))
    ) {
      invalidLinkCount += 1;
      continue;
    }

    validLinks.push(link);
  }

  const wholeScopeLinks = validLinks.filter((link) => !normalizeOptionalId(getLinkLineId(link, side)));
  const lineScopeLinks = validLinks.filter((link) => !!normalizeOptionalId(getLinkLineId(link, side)));
  const directLinks = lineId
    ? lineScopeLinks.filter((link) => normalizeOptionalId(getLinkLineId(link, side)) === lineId)
    : validLinks;
  const directAllocatedMinor = sumLinkAmounts(directLinks);
  const wholeScopeAllocatedMinor = sumLinkAmounts(wholeScopeLinks);
  const parentAllocatedMinor = sumLinkAmounts(validLinks);
  const otherLineAllocatedMinor = lineId
    ? sumLinkAmounts(
        lineScopeLinks.filter((link) => normalizeOptionalId(getLinkLineId(link, side)) !== lineId),
      )
    : sumLinkAmounts(lineScopeLinks);
  const directRemainingMinor = Math.max(0, originalMinor - directAllocatedMinor);
  const parentRemainingMinor = Math.max(0, parentOriginalMinor - parentAllocatedMinor);
  const remainingMinor = lineId
    ? Math.min(directRemainingMinor, parentRemainingMinor)
    : parentRemainingMinor;
  const allocatedMinor = directAllocatedMinor;

  return {
    scope: lineId ? 'line' : 'transaction',
    side,
    transactionId,
    lineId,
    currencyCode: normalizedCurrencyCode,
    originalMinor,
    allocatedMinor,
    remainingMinor,
    directAllocatedMinor,
    directRemainingMinor,
    wholeScopeAllocatedMinor,
    otherLineAllocatedMinor,
    parentAllocatedMinor,
    parentRemainingMinor,
    linkCount: directLinks.length,
    wholeScopeLinkCount: wholeScopeLinks.length,
    parentLinkCount: validLinks.length,
    overAllocatedMinor: Math.max(0, directAllocatedMinor - originalMinor),
    parentOverAllocatedMinor: Math.max(0, parentAllocatedMinor - parentOriginalMinor),
    invalidLinkCount,
    invalidDraftChangeCount: statusContext.invalidDraftChangeCount,
    scopeExists: lineId ? !!requestedLine : transactionLines.length > 0,
    status: getAllocationState(allocatedMinor, remainingMinor),
  };
}

function appendToIndex<T>(index: Map<string, T[]>, key: string, value: T): void {
  const existing = index.get(key);
  if (existing) {
    existing.push(value);
  } else {
    index.set(key, [value]);
  }
}

function getScopeKey(
  transactionId: string,
  currencyCode: CurrencyCode,
  side: TransactionLinkAllocationSide,
): string {
  return `${side}\u0000${transactionId}\u0000${normalizeCurrencyCode(currencyCode)}`;
}

function getEffectiveTransactionLinks(
  persistedLinks: TransactionLink[],
  draftChanges?: TransactionLinkBatchInput,
): { links: EffectiveTransactionLink[]; invalidDraftChangeCount: number } {
  const linksById = new Map<string, EffectiveTransactionLink>(
    persistedLinks.map((link) => [link.id, link]),
  );
  if (!draftChanges) {
    return { links: [...linksById.values()], invalidDraftChangeCount: 0 };
  }

  const deleteIds = new Set(draftChanges.deleteIds);
  const seenUpdateIds = new Set<string>();
  let invalidDraftChangeCount = 0;

  for (const linkId of deleteIds) {
    if (!linksById.delete(linkId)) {
      invalidDraftChangeCount += 1;
    }
  }

  for (const update of draftChanges.toUpdate) {
    if (seenUpdateIds.has(update.id) || deleteIds.has(update.id)) {
      invalidDraftChangeCount += 1;
      continue;
    }

    seenUpdateIds.add(update.id);
    if (!linksById.has(update.id)) {
      invalidDraftChangeCount += 1;
      continue;
    }

    linksById.set(update.id, toEffectiveLink(update.id, update));
  }

  draftChanges.toAdd.forEach((input, index) => {
    linksById.set(`draft:add:${index}`, toEffectiveLink(`draft:add:${index}`, input));
  });

  return { links: [...linksById.values()], invalidDraftChangeCount };
}

function toEffectiveLink(id: string, input: NewTransactionLinkInput): EffectiveTransactionLink {
  return {
    id,
    sourceTransactionId: input.sourceTransactionId.trim(),
    targetTransactionId: input.targetTransactionId.trim(),
    sourceLineId: normalizeOptionalId(input.sourceLineId),
    targetLineId: normalizeOptionalId(input.targetLineId),
    linkType: input.linkType,
    amountMinor: input.amountMinor,
    currencyCode: normalizeCurrencyCode(input.currencyCode),
  };
}

function getLinkLineId(
  link: EffectiveTransactionLink,
  side: TransactionLinkAllocationSide,
): string | null | undefined {
  return side === 'source' ? link.sourceLineId : link.targetLineId;
}

function sumLinkAmounts(links: EffectiveTransactionLink[]): number {
  return links.reduce((sum, link) => sum + link.amountMinor, 0);
}

function getAllocationState(
  allocatedMinor: number,
  remainingMinor: number,
): TransactionLinkAllocationState {
  if (allocatedMinor <= 0) {
    return 'unlinked';
  }

  return remainingMinor > 0 ? 'partial' : 'settled';
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized || null;
}
