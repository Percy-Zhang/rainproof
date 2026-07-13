import { normalizeCurrencyCode, parseMoneyInput } from './money';
import { isTransactionLineLinked, isTransactionParentLinked } from './transactionLinks';
import type {
  CurrencyCode,
  NewTransactionLinkInput,
  Transaction,
  TransactionLine,
  TransactionLink,
  TransactionLinkBatchInput,
  TransactionLinkType,
  UpdateTransactionLinkInput,
} from './types';

export type TransactionLinkAllocationDraft = {
  id: string;
  existingLinkId?: string;
  sourceLineId: string | null;
  targetTransactionId: string;
  targetLineId: string | null;
  linkType: TransactionLinkType;
  amount: string;
  currencyCode: CurrencyCode;
};

export type TransactionLinkSourceScope = {
  id: string;
  sourceLineId: string | null;
  amountMinor: number;
  currencyCode: CurrencyCode;
  line?: TransactionLine;
  isLinked: boolean;
};

export type TransactionLinkTargetScope = {
  id: string;
  targetLineId: string | null;
  amountMinor: number;
  currencyCode: CurrencyCode;
  line?: TransactionLine;
  isLinked: boolean;
};

export type TransactionLinkTargetOption = {
  id: string;
  transaction: Transaction;
  targetLineId: string | null;
  amountMinor: number;
  currencyCode: CurrencyCode;
  accountId: string;
  categoryId: string;
  subcategoryId: string;
  line?: TransactionLine;
  eligible: boolean;
  disabledReason: string;
  isLinked: boolean;
};

export type TransactionLinkSourceOption = {
  id: string;
  transaction: Transaction;
  sourceLineId: string | null;
  amountMinor: number;
  currencyCode: CurrencyCode;
  accountId: string;
  line?: TransactionLine;
  eligible: boolean;
  disabledReason: string;
  isLinked: boolean;
};

export type TransactionLinkAllocationChanges = {
  toAdd: NewTransactionLinkInput[];
  toUpdate: UpdateTransactionLinkInput[];
  deleteIds: string[];
};

export type ExpenseTransactionLinkAllocationDraft = {
  id: string;
  existingLinkId?: string;
  sourceTransactionId: string;
  sourceLineId: string | null;
  targetLineId: string | null;
  linkType: TransactionLinkType;
  amount: string;
  currencyCode: CurrencyCode;
};

export function getTransactionLinkSourceScopes(
  transaction: Transaction,
  lines: TransactionLine[],
  transactionLinks: TransactionLink[] = [],
): TransactionLinkSourceScope[] {
  if (transaction.kind !== 'income') {
    return [];
  }

  const incomeLines = lines.filter((line) => line.transactionId === transaction.id && line.amountMinor > 0);
  if (!incomeLines.length) {
    return [];
  }

  const currencyCode = normalizeCurrencyCode(incomeLines[0].currencyCode);
  const sameCurrencyLines = incomeLines.filter((line) => normalizeCurrencyCode(line.currencyCode) === currencyCode);
  const wholeAmountMinor = sameCurrencyLines.reduce((sum, line) => sum + line.amountMinor, 0);
  const scopes: TransactionLinkSourceScope[] = [
    {
      id: 'source:whole',
      sourceLineId: null,
      amountMinor: wholeAmountMinor,
      currencyCode,
      isLinked: isTransactionParentLinked(transaction.id, transactionLinks),
    },
  ];

  if (sameCurrencyLines.length > 1) {
    scopes.push(
      ...sameCurrencyLines.map((line) => ({
        id: `source:${line.id}`,
        sourceLineId: line.id,
        amountMinor: line.amountMinor,
        currencyCode: normalizeCurrencyCode(line.currencyCode),
        line,
        isLinked: isTransactionLineLinked(line.id, transactionLinks),
      })),
    );
  }

  return scopes;
}

export function getTransactionLinkTargetOptions({
  transaction,
  lines,
  currencyCode,
  transactionLinks = [],
}: {
  transaction: Transaction;
  lines: TransactionLine[];
  currencyCode: CurrencyCode;
  transactionLinks?: TransactionLink[];
}): TransactionLinkTargetOption[] {
  if (transaction.kind !== 'expense') {
    return [];
  }

  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode);
  const expenseLines = lines.filter(
    (line) =>
      line.transactionId === transaction.id &&
      line.amountMinor < 0 &&
      normalizeCurrencyCode(line.currencyCode) === normalizedCurrencyCode,
  );
  if (!expenseLines.length) {
    return [];
  }

  const wholeAmountMinor = expenseLines.reduce((sum, line) => sum + Math.abs(line.amountMinor), 0);
  const firstLine = expenseLines[0];
  const options: TransactionLinkTargetOption[] = [
    {
      id: `${transaction.id}:whole`,
      transaction,
      targetLineId: null,
      amountMinor: wholeAmountMinor,
      currencyCode: normalizedCurrencyCode,
      accountId: firstLine.accountId,
      categoryId: firstLine.categoryId,
      subcategoryId: firstLine.subcategoryId,
      eligible: true,
      disabledReason: '',
      isLinked: isTransactionParentLinked(transaction.id, transactionLinks),
    },
  ];

  if (expenseLines.length > 1) {
    options.push(
      ...expenseLines.map((line) => ({
        id: `${transaction.id}:${line.id}`,
        transaction,
        targetLineId: line.id,
        amountMinor: Math.abs(line.amountMinor),
        currencyCode: normalizedCurrencyCode,
        accountId: line.accountId,
        categoryId: line.categoryId,
        subcategoryId: line.subcategoryId,
        line,
        eligible: true,
        disabledReason: '',
        isLinked: isTransactionLineLinked(line.id, transactionLinks),
      })),
    );
  }

  return options;
}

export function getTransactionLinkTargetScopes(
  transaction: Transaction,
  lines: TransactionLine[],
  transactionLinks: TransactionLink[] = [],
): TransactionLinkTargetScope[] {
  if (transaction.kind !== 'expense') {
    return [];
  }

  const expenseLines = lines.filter((line) => line.transactionId === transaction.id && line.amountMinor < 0);
  if (!expenseLines.length) {
    return [];
  }

  const currencyCode = normalizeCurrencyCode(expenseLines[0].currencyCode);
  const sameCurrencyLines = expenseLines.filter((line) => normalizeCurrencyCode(line.currencyCode) === currencyCode);
  const wholeAmountMinor = sameCurrencyLines.reduce((sum, line) => sum + Math.abs(line.amountMinor), 0);
  const scopes: TransactionLinkTargetScope[] = [
    {
      id: 'target:whole',
      targetLineId: null,
      amountMinor: wholeAmountMinor,
      currencyCode,
      isLinked: isTransactionParentLinked(transaction.id, transactionLinks),
    },
  ];

  if (sameCurrencyLines.length > 1) {
    scopes.push(
      ...sameCurrencyLines.map((line) => ({
        id: `target:${line.id}`,
        targetLineId: line.id,
        amountMinor: Math.abs(line.amountMinor),
        currencyCode: normalizeCurrencyCode(line.currencyCode),
        line,
        isLinked: isTransactionLineLinked(line.id, transactionLinks),
      })),
    );
  }

  return scopes;
}

export function getTransactionLinkSourceOptions({
  transaction,
  lines,
  currencyCode,
  transactionLinks = [],
}: {
  transaction: Transaction;
  lines: TransactionLine[];
  currencyCode: CurrencyCode;
  transactionLinks?: TransactionLink[];
}): TransactionLinkSourceOption[] {
  if (transaction.kind !== 'income') {
    return [];
  }

  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode);
  const incomeLines = lines.filter(
    (line) =>
      line.transactionId === transaction.id &&
      line.amountMinor > 0 &&
      normalizeCurrencyCode(line.currencyCode) === normalizedCurrencyCode,
  );
  if (!incomeLines.length) {
    return [];
  }

  const wholeAmountMinor = incomeLines.reduce((sum, line) => sum + line.amountMinor, 0);
  const firstLine = incomeLines[0];
  const options: TransactionLinkSourceOption[] = [
    {
      id: `${transaction.id}:whole`,
      transaction,
      sourceLineId: null,
      amountMinor: wholeAmountMinor,
      currencyCode: normalizedCurrencyCode,
      accountId: firstLine.accountId,
      eligible: true,
      disabledReason: '',
      isLinked: isTransactionParentLinked(transaction.id, transactionLinks),
    },
  ];

  if (incomeLines.length > 1) {
    options.push(
      ...incomeLines.map((line) => ({
        id: `${transaction.id}:${line.id}`,
        transaction,
        sourceLineId: line.id,
        amountMinor: line.amountMinor,
        currencyCode: normalizedCurrencyCode,
        accountId: line.accountId,
        line,
        eligible: true,
        disabledReason: '',
        isLinked: isTransactionLineLinked(line.id, transactionLinks),
      })),
    );
  }

  return options;
}

export function createTransactionLinkAllocationDrafts(
  sourceTransactionId: string,
  transactionLinks: TransactionLink[],
): TransactionLinkAllocationDraft[] {
  return transactionLinks
    .filter((link) => link.sourceTransactionId === sourceTransactionId)
    .map((link) => ({
      id: link.id,
      existingLinkId: link.id,
      sourceLineId: link.sourceLineId ?? null,
      targetTransactionId: link.targetTransactionId,
      targetLineId: link.targetLineId ?? null,
      linkType: link.linkType,
      amount: formatMinorInput(link.amountMinor),
      currencyCode: link.currencyCode,
    }));
}

export function createExpenseTransactionLinkAllocationDrafts(
  targetTransactionId: string,
  transactionLinks: TransactionLink[],
): ExpenseTransactionLinkAllocationDraft[] {
  return transactionLinks
    .filter((link) => link.targetTransactionId === targetTransactionId)
    .map((link) => ({
      id: link.id,
      existingLinkId: link.id,
      sourceTransactionId: link.sourceTransactionId,
      sourceLineId: link.sourceLineId ?? null,
      targetLineId: link.targetLineId ?? null,
      linkType: link.linkType,
      amount: formatMinorInput(link.amountMinor),
      currencyCode: link.currencyCode,
    }));
}

export function getAllocationAmountMinor(draft: Pick<TransactionLinkAllocationDraft, 'amount'>): number {
  try {
    return Math.abs(parseMoneyInput(draft.amount));
  } catch {
    return 0;
  }
}

export function isValidTransactionLinkAllocationAmount(
  draft: Pick<TransactionLinkAllocationDraft, 'amount'>,
): boolean {
  try {
    return parseMoneyInput(draft.amount) > 0;
  } catch {
    return false;
  }
}

export function getAllocatedAmountMinor(
  allocations: TransactionLinkAllocationDraft[],
  sourceLineId: string | null,
): number {
  return allocations
    .filter((allocation) => (sourceLineId ? allocation.sourceLineId === sourceLineId : true))
    .reduce((sum, allocation) => sum + getAllocationAmountMinor(allocation), 0);
}

export function getTargetAllocatedAmountMinor(
  allocations: ExpenseTransactionLinkAllocationDraft[],
  targetLineId: string | null,
): number {
  return allocations
    .filter((allocation) => (targetLineId ? allocation.targetLineId === targetLineId : true))
    .reduce((sum, allocation) => sum + getAllocationAmountMinor(allocation), 0);
}

export function getTransactionLinkAllocationChanges({
  sourceTransactionId,
  existingLinks,
  allocations,
}: {
  sourceTransactionId: string;
  existingLinks: TransactionLink[];
  allocations: TransactionLinkAllocationDraft[];
}): TransactionLinkAllocationChanges {
  const existingSourceLinks = existingLinks.filter((link) => link.sourceTransactionId === sourceTransactionId);
  const draftExistingIds = new Set(
    allocations
      .map((allocation) => allocation.existingLinkId)
      .filter((id): id is string => !!id),
  );
  const deleteIds = existingSourceLinks
    .filter((link) => !draftExistingIds.has(link.id))
    .map((link) => link.id);
  const toAdd: NewTransactionLinkInput[] = [];
  const toUpdate: UpdateTransactionLinkInput[] = [];

  for (const allocation of allocations) {
    const amountMinor = parsePositiveAllocationAmount(allocation.amount);
    const input = {
      sourceTransactionId,
      targetTransactionId: allocation.targetTransactionId,
      sourceLineId: allocation.sourceLineId,
      targetLineId: allocation.targetLineId,
      linkType: allocation.linkType,
      amountMinor,
      currencyCode: allocation.currencyCode,
    };

    if (allocation.existingLinkId) {
      toUpdate.push({ id: allocation.existingLinkId, ...input });
    } else {
      toAdd.push(input);
    }
  }

  return { toAdd, toUpdate, deleteIds };
}

export function getExpenseTransactionLinkAllocationChanges({
  targetTransactionId,
  existingLinks,
  allocations,
}: {
  targetTransactionId: string;
  existingLinks: TransactionLink[];
  allocations: ExpenseTransactionLinkAllocationDraft[];
}): TransactionLinkAllocationChanges {
  const existingTargetLinks = existingLinks.filter((link) => link.targetTransactionId === targetTransactionId);
  const draftExistingIds = new Set(
    allocations
      .map((allocation) => allocation.existingLinkId)
      .filter((id): id is string => !!id),
  );
  const deleteIds = existingTargetLinks
    .filter((link) => !draftExistingIds.has(link.id))
    .map((link) => link.id);
  const toAdd: NewTransactionLinkInput[] = [];
  const toUpdate: UpdateTransactionLinkInput[] = [];

  for (const allocation of allocations) {
    const amountMinor = parsePositiveAllocationAmount(allocation.amount);
    const input = {
      sourceTransactionId: allocation.sourceTransactionId,
      targetTransactionId,
      sourceLineId: allocation.sourceLineId,
      targetLineId: allocation.targetLineId,
      linkType: allocation.linkType,
      amountMinor,
      currencyCode: allocation.currencyCode,
    };

    if (allocation.existingLinkId) {
      toUpdate.push({ id: allocation.existingLinkId, ...input });
    } else {
      toAdd.push(input);
    }
  }

  return { toAdd, toUpdate, deleteIds };
}

export function getTransactionLinkAllocationDraftStatusChanges({
  sourceTransactionId,
  existingLinks,
  allocations,
}: {
  sourceTransactionId: string;
  existingLinks: TransactionLink[];
  allocations: TransactionLinkAllocationDraft[];
}): TransactionLinkBatchInput {
  return getTransactionLinkDraftStatusChanges({
    existingLinks: existingLinks.filter((link) => link.sourceTransactionId === sourceTransactionId),
    allocations: allocations.map((allocation) => ({
      existingLinkId: allocation.existingLinkId,
      input: {
        sourceTransactionId,
        targetTransactionId: allocation.targetTransactionId,
        sourceLineId: allocation.sourceLineId,
        targetLineId: allocation.targetLineId,
        linkType: allocation.linkType,
        amountMinor: getDraftStatusAmountMinor(allocation.amount),
        currencyCode: allocation.currencyCode,
      },
    })),
  });
}

export function getExpenseTransactionLinkAllocationDraftStatusChanges({
  targetTransactionId,
  existingLinks,
  allocations,
}: {
  targetTransactionId: string;
  existingLinks: TransactionLink[];
  allocations: ExpenseTransactionLinkAllocationDraft[];
}): TransactionLinkBatchInput {
  return getTransactionLinkDraftStatusChanges({
    existingLinks: existingLinks.filter((link) => link.targetTransactionId === targetTransactionId),
    allocations: allocations.map((allocation) => ({
      existingLinkId: allocation.existingLinkId,
      input: {
        sourceTransactionId: allocation.sourceTransactionId,
        targetTransactionId,
        sourceLineId: allocation.sourceLineId,
        targetLineId: allocation.targetLineId,
        linkType: allocation.linkType,
        amountMinor: getDraftStatusAmountMinor(allocation.amount),
        currencyCode: allocation.currencyCode,
      },
    })),
  });
}

function getTransactionLinkDraftStatusChanges({
  existingLinks,
  allocations,
}: {
  existingLinks: TransactionLink[];
  allocations: { existingLinkId?: string; input: NewTransactionLinkInput }[];
}): TransactionLinkBatchInput {
  const retainedIds = new Set(
    allocations.map((allocation) => allocation.existingLinkId).filter((id): id is string => !!id),
  );

  return {
    deleteIds: existingLinks.filter((link) => !retainedIds.has(link.id)).map((link) => link.id),
    toAdd: allocations.filter((allocation) => !allocation.existingLinkId).map((allocation) => allocation.input),
    toUpdate: allocations
      .filter((allocation): allocation is typeof allocation & { existingLinkId: string } => !!allocation.existingLinkId)
      .map((allocation) => ({ id: allocation.existingLinkId, ...allocation.input })),
  };
}

function parsePositiveAllocationAmount(amount: string): number {
  const amountMinor = parseMoneyInput(amount);
  if (amountMinor <= 0) {
    throw new Error('Link amount must be greater than zero.');
  }
  return amountMinor;
}

function getDraftStatusAmountMinor(amount: string): number {
  try {
    return parseMoneyInput(amount);
  } catch {
    return 0;
  }
}

export function formatMinorInput(amountMinor: number): string {
  const absolute = Math.abs(amountMinor);
  const whole = Math.floor(absolute / 100);
  const cents = String(absolute % 100).padStart(2, '0');
  return `${whole}.${cents}`;
}
