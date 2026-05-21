import {
  getDefaultCategoryForKind,
  getDefaultSubcategoryId,
  normalizeCategoryId,
  normalizeSubcategoryId,
} from './categories';
import { formatLongDateLabel, parseDateTimeInput, toDateInputValue, toTimeInputValue } from './dates';
import { parseLabelsInput } from './labels';
import { parseMoneyInput } from './money';
import {
  buildSplitTransactionLines,
  isSplitTransaction,
  sumSplitTransactionLinesMinor,
  validateSplitTransactionLines,
  type SplitTransactionDraftLine,
} from './splitTransactions';
import type {
  Account,
  AppSnapshot,
  NewTransactionInput,
  TransactionKind,
  TransactionLine,
  UpdateTransactionInput,
} from './types';

export const OUTSIDE_ACCOUNT_ID = 'outside';
export const OUTSIDE_MY_ACCOUNTS_LABEL = 'Outside my accounts';

export type TransactionEditDraft = {
  id: string;
  kind: TransactionKind;
  title: string;
  amount: string;
  date: string;
  time: string;
  accountId: string;
  targetAccountId: string;
  externalParty: string;
  categoryId: string;
  subcategoryId: string;
  notes: string;
  labels: string;
  groupId: string;
  lineId?: string;
  sourceLineId?: string;
  targetLineId?: string;
  splitLines?: TransactionEditSplitLineDraft[];
};

export type TransactionEditSplitLineDraft = {
  id: string;
  amount: string;
  categoryId: string;
  subcategoryId: string;
  note: string;
};

export function createTransactionEditDraft(snapshot: AppSnapshot, transactionId: string): TransactionEditDraft {
  const transaction = snapshot.transactions.find((item) => item.id === transactionId);
  if (!transaction) {
    throw new Error('Transaction not found.');
  }

  const lines = snapshot.transactionLines.filter((line) => line.transactionId === transaction.id);
  if (!lines.length) {
    throw new Error('Transaction has no lines.');
  }

  const dateValue = new Date(transaction.datetime);
  const defaultCategory = getDefaultCategoryForKind(transaction.kind, snapshot.categories);

  if (transaction.kind === 'transfer') {
    if (lines.length > 2) {
      throw new Error('Split transfer editing is not supported.');
    }

    const sourceLine = lines.find((line) => line.amountMinor < 0);
    const targetLine = lines.find((line) => line.amountMinor > 0 && line.accountId !== sourceLine?.accountId);
    const amountLine = sourceLine ?? targetLine ?? lines[0];

    return {
      id: transaction.id,
      kind: transaction.kind,
      title: transaction.title,
      amount: minorToInput(Math.abs(amountLine.amountMinor)),
      date: toDateInputValue(dateValue),
      time: toTimeInputValue(dateValue),
      accountId: sourceLine?.accountId ?? OUTSIDE_ACCOUNT_ID,
      targetAccountId: targetLine?.accountId ?? OUTSIDE_ACCOUNT_ID,
      externalParty: sourceLine?.externalParty || targetLine?.externalParty || OUTSIDE_MY_ACCOUNTS_LABEL,
      categoryId: '',
      subcategoryId: '',
      notes: transaction.notes,
      labels: transaction.labels.join(', '),
      groupId: transaction.groupId,
      sourceLineId: sourceLine?.id,
      targetLineId: targetLine?.id,
    };
  }

  if (isSplitTransaction(transaction, lines)) {
    validateSplitTransactionLines({ kind: transaction.kind, lines });
    const firstLine = lines[0];
    const categoryId = normalizeCategoryId(firstLine.categoryId || defaultCategory.id, snapshot.categories);

    return {
      id: transaction.id,
      kind: transaction.kind,
      title: transaction.title,
      amount: minorToInput(sumSplitTransactionLinesMinor(transaction.kind, lines)),
      date: toDateInputValue(dateValue),
      time: toTimeInputValue(dateValue),
      accountId: firstLine.accountId,
      targetAccountId: OUTSIDE_ACCOUNT_ID,
      externalParty: firstLine.externalParty || OUTSIDE_MY_ACCOUNTS_LABEL,
      categoryId,
      subcategoryId: normalizeSubcategoryId(
        categoryId,
        firstLine.subcategoryId || getDefaultSubcategoryId(defaultCategory),
        snapshot.categories,
      ),
      notes: transaction.notes,
      labels: transaction.labels.join(', '),
      groupId: transaction.groupId,
      splitLines: lines.map((line) => toTransactionEditSplitLineDraft(line, snapshot.categories)),
    };
  }

  if (lines.length !== 1) {
    throw new Error('Unsupported transaction line structure.');
  }

  const line = lines[0];
  const categoryId = normalizeCategoryId(line.categoryId || defaultCategory.id, snapshot.categories);
  return {
    id: transaction.id,
    kind: transaction.kind,
    title: transaction.title,
    amount: minorToInput(Math.abs(line.amountMinor)),
    date: toDateInputValue(dateValue),
    time: toTimeInputValue(dateValue),
    accountId: line.accountId,
    targetAccountId: OUTSIDE_ACCOUNT_ID,
    externalParty: line.externalParty || OUTSIDE_MY_ACCOUNTS_LABEL,
    categoryId,
    subcategoryId: normalizeSubcategoryId(
      categoryId,
      line.subcategoryId || getDefaultSubcategoryId(defaultCategory),
      snapshot.categories,
    ),
    notes: transaction.notes,
    labels: transaction.labels.join(', '),
    groupId: transaction.groupId,
    lineId: line.id,
  };
}

export function buildTransactionUpdateInput(
  draft: TransactionEditDraft,
  accounts: Account[],
): UpdateTransactionInput {
  const amountMinor = Math.abs(parseMoneyInput(draft.amount));
  if (amountMinor <= 0) {
    throw new Error('Amount must be greater than zero.');
  }

  const datetime = parseDateTimeInput(draft.date, draft.time);
  const labels = parseLabelsInput(draft.labels);

  if (draft.kind === 'transfer') {
    return {
      id: draft.id,
      kind: draft.kind,
      title: draft.title,
      datetime,
      notes: draft.notes,
      labels,
      groupId: draft.groupId,
      lines: buildTransferTransactionLines({
        amountMinor,
        accounts,
        externalParty: draft.externalParty,
        sourceAccountId: draft.accountId,
        sourceLineId: draft.sourceLineId,
        targetAccountId: draft.targetAccountId,
        targetLineId: draft.targetLineId,
      }),
    };
  }

  const account = accounts.find((item) => item.id === draft.accountId);
  if (!account) {
    throw new Error('Choose an account.');
  }

  if ((draft.splitLines?.length ?? 0) >= 2) {
    return {
      id: draft.id,
      kind: draft.kind,
      title: draft.title,
      datetime,
      notes: draft.notes,
      labels,
      groupId: draft.groupId,
      lines: buildSplitTransactionLines({
        kind: draft.kind,
        accountId: account.id,
        currencyCode: account.currencyCode,
        totalMinor: amountMinor,
        splitLines: (draft.splitLines ?? []).map(toSplitTransactionDraftLine),
      }),
    };
  }

  const normalSplitLine = draft.splitLines?.length === 1 ? draft.splitLines[0] : undefined;
  const categoryId = normalizeCategoryId(normalSplitLine?.categoryId ?? draft.categoryId);
  const subcategoryId = normalizeSubcategoryId(categoryId, normalSplitLine?.subcategoryId ?? draft.subcategoryId);

  if (!categoryId || !subcategoryId) {
    throw new Error('Choose a category and subcategory.');
  }

  return {
    id: draft.id,
    kind: draft.kind,
    title: draft.title,
    datetime,
    notes: draft.notes,
    labels,
    groupId: draft.groupId,
    lines: [
      {
        id: normalSplitLine?.id ?? draft.lineId,
        accountId: account.id,
        amountMinor: draft.kind === 'expense' ? -amountMinor : amountMinor,
        currencyCode: account.currencyCode,
        categoryId,
        subcategoryId,
        note: normalSplitLine?.note,
      },
    ],
  };
}

export function formatEditDateLabel(dateValue: string): string {
  return formatLongDateLabel(dateValue);
}

export function isOutsideAccountId(accountId: string): boolean {
  return accountId === OUTSIDE_ACCOUNT_ID || accountId === 'external';
}

export function getTransferAmountCurrencyCode({
  accounts,
  sourceAccountId,
  targetAccountId,
}: {
  accounts: Account[];
  sourceAccountId: string;
  targetAccountId: string;
}): string {
  const sourceAccount = isOutsideAccountId(sourceAccountId)
    ? undefined
    : accounts.find((account) => account.id === sourceAccountId);
  const targetAccount = isOutsideAccountId(targetAccountId)
    ? undefined
    : accounts.find((account) => account.id === targetAccountId);

  return sourceAccount?.currencyCode ?? targetAccount?.currencyCode ?? '';
}

export function buildTransferTransactionLines({
  amountMinor,
  accounts,
  externalParty,
  sourceAccountId,
  sourceLineId,
  targetAccountId,
  targetLineId,
}: {
  amountMinor: number;
  accounts: Account[];
  externalParty: string;
  sourceAccountId: string;
  sourceLineId?: string;
  targetAccountId: string;
  targetLineId?: string;
}): NewTransactionInput['lines'] {
  const sourceAccount = isOutsideAccountId(sourceAccountId)
    ? undefined
    : accounts.find((account) => account.id === sourceAccountId);
  const targetAccount = isOutsideAccountId(targetAccountId)
    ? undefined
    : accounts.find((account) => account.id === targetAccountId);
  const outsideLabel = externalParty.trim() || OUTSIDE_MY_ACCOUNTS_LABEL;

  if (!sourceAccount && !targetAccount) {
    throw new Error('Choose at least one account inside Rainproof.');
  }

  if (sourceAccount?.id === targetAccount?.id) {
    throw new Error('Source and destination accounts must be different.');
  }

  if (sourceAccount && targetAccount && sourceAccount.currencyCode !== targetAccount.currencyCode) {
    throw new Error('Transfers between different currencies need exchange rates. For now, choose accounts with the same currency.');
  }

  if (sourceAccount && !targetAccount) {
    return [
      {
        id: sourceLineId,
        accountId: sourceAccount.id,
        amountMinor: -amountMinor,
        currencyCode: sourceAccount.currencyCode,
        externalParty: outsideLabel,
      },
    ];
  }

  if (!sourceAccount && targetAccount) {
    return [
      {
        id: targetLineId,
        accountId: targetAccount.id,
        amountMinor,
        currencyCode: targetAccount.currencyCode,
        externalParty: outsideLabel,
      },
    ];
  }

  return [
    {
      id: sourceLineId,
      accountId: sourceAccount!.id,
      amountMinor: -amountMinor,
      currencyCode: sourceAccount!.currencyCode,
      transferPeerAccountId: targetAccount!.id,
    },
    {
      id: targetLineId,
      accountId: targetAccount!.id,
      amountMinor,
      currencyCode: targetAccount!.currencyCode,
      transferPeerAccountId: sourceAccount!.id,
    },
  ];
}

function toSplitTransactionDraftLine(line: TransactionEditSplitLineDraft): SplitTransactionDraftLine {
  const categoryId = normalizeCategoryId(line.categoryId);

  return {
    id: line.id,
    amountMinor: Math.abs(parseMoneyInput(line.amount)),
    categoryId,
    subcategoryId: normalizeSubcategoryId(categoryId, line.subcategoryId),
    note: line.note,
  };
}

function toTransactionEditSplitLineDraft(
  line: TransactionLine,
  categories: AppSnapshot['categories'],
): TransactionEditSplitLineDraft {
  const categoryId = normalizeCategoryId(line.categoryId, categories);

  return {
    id: line.id,
    amount: minorToInput(Math.abs(line.amountMinor)),
    categoryId,
    subcategoryId: normalizeSubcategoryId(categoryId, line.subcategoryId, categories),
    note: line.note,
  };
}

function minorToInput(amountMinor: number): string {
  const whole = Math.floor(amountMinor / 100);
  const cents = String(amountMinor % 100).padStart(2, '0');
  return `${whole}.${cents}`;
}
