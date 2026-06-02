import {
  resolveAddTransactionDefaultAccountId,
  resolveAddTransactionDefaultCategory,
} from './addTransactionDefaults';
import { evaluateMoneyExpression } from './calculator';
import { defaultCategories } from './categories';
import { parseDateTimeInput, toDateInputValue, toTimeInputValue } from './dates';
import { parseLabelsInput } from './labels';
import { parseMoneyInput } from './money';
import { buildSplitLinesFromForm, type SplitTransactionFormLine } from './splitTransactionForm';
import {
  buildTransferTransactionLines,
  isOutsideAccountId,
  OUTSIDE_ACCOUNT_ID,
  OUTSIDE_MY_ACCOUNTS_LABEL,
} from './transactionEdit';
import type { AddTransactionTemplatePrefill } from './transactionTemplates';
import type { Account, AppSnapshot, NewTransactionInput, TransactionKind } from './types';

export type AddTransactionInitialDraft = {
  amountExpression: string;
  categoryId: string;
  date: string;
  fromAccountId: string;
  groupId: string;
  item: string;
  kind: TransactionKind;
  labels: string;
  notes: string;
  subcategoryId: string;
  time: string;
  toAccountId: string;
};

export type AddTransactionDraft = AddTransactionInitialDraft & {
  splitLines: SplitTransactionFormLine[];
};

export function createAddTransactionInitialDraft({
  dashboardAccountIds,
  initialTemplate,
  now = new Date(),
  snapshot,
}: {
  dashboardAccountIds?: string[];
  initialTemplate?: AddTransactionTemplatePrefill;
  now?: Date;
  snapshot: AppSnapshot;
}): AddTransactionInitialDraft {
  const categories = snapshot.categories ?? defaultCategories;
  const kind = initialTemplate?.kind ?? 'expense';
  const addTransactionDefaults = snapshot.settings.addTransactionDefaults;
  const categorySelection = resolveAddTransactionDefaultCategory({
    categories,
    defaults: addTransactionDefaults,
    explicitCategoryId: initialTemplate?.categoryId,
    explicitSubcategoryId: initialTemplate?.subcategoryId,
    kind,
  });
  const fromAccountId = resolveAddTransactionDefaultAccountId({
    accounts: snapshot.accounts,
    dashboardAccountIds,
    explicitAccountId: initialTemplate?.accountId,
    rememberedAccountId: addTransactionDefaults?.lastManualAccountId,
  });

  return {
    amountExpression: initialTemplate?.amountExpression ?? '',
    categoryId: categorySelection.categoryId,
    date: initialTemplate?.date ?? toDateInputValue(now),
    fromAccountId,
    groupId: '',
    item: initialTemplate?.title ?? '',
    kind,
    labels: '',
    notes: initialTemplate?.notes ?? '',
    subcategoryId: categorySelection.subcategoryId ?? '',
    time: initialTemplate?.time ?? toTimeInputValue(now),
    toAccountId: snapshot.accounts[1]?.id ?? OUTSIDE_ACCOUNT_ID,
  };
}

export function buildAddTransactionInput({
  accounts,
  draft,
}: {
  accounts: Account[];
  draft: AddTransactionDraft;
}): NewTransactionInput {
  return {
    kind: draft.kind,
    title: draft.item,
    datetime: parseDateTimeInput(draft.date, draft.time),
    notes: draft.notes,
    labels: parseLabelsInput(draft.labels),
    groupId: draft.groupId,
    lines: buildAddTransactionLines({ accounts, draft }),
  };
}

export function canBuildAddTransactionInput({
  accounts,
  draft,
}: {
  accounts: Account[];
  draft: AddTransactionDraft;
}): boolean {
  try {
    buildAddTransactionInput({ accounts, draft });
    return true;
  } catch {
    return false;
  }
}

export function buildAddTransactionLines({
  accounts,
  draft,
}: {
  accounts: Account[];
  draft: AddTransactionDraft;
}): NewTransactionInput['lines'] {
  if (draft.kind === 'transfer') {
    const sourceAmount = Math.abs(parseMoneyInput(resolveAddTransactionAmountExpression(draft.amountExpression)));
    if (sourceAmount <= 0) {
      throw new Error('Transfer amount must be greater than zero.');
    }

    return buildTransferTransactionLines({
      amountMinor: sourceAmount,
      accounts,
      externalParty: OUTSIDE_MY_ACCOUNTS_LABEL,
      sourceAccountId: draft.fromAccountId,
      targetAccountId: draft.toAccountId,
    });
  }

  const account = isOutsideAccountId(draft.fromAccountId)
    ? undefined
    : accounts.find((item) => item.id === draft.fromAccountId) ?? accounts[0];
  if (!account) {
    throw new Error('Choose an account.');
  }

  const minor = Math.abs(parseMoneyInput(resolveAddTransactionAmountExpression(draft.amountExpression)));
  if (minor <= 0) {
    throw new Error('Amount must be greater than zero.');
  }

  const normalLine = draft.splitLines.length === 1 ? draft.splitLines[0] : undefined;
  const effectiveCategoryId = normalLine?.categoryId ?? draft.categoryId;
  const effectiveSubcategoryId = normalLine?.subcategoryId ?? draft.subcategoryId;

  if (!effectiveCategoryId || !effectiveSubcategoryId) {
    throw new Error('Choose a category and subcategory.');
  }

  if (draft.splitLines.length >= 2) {
    return buildSplitLinesFromForm({
      kind: draft.kind,
      accountId: account.id,
      currencyCode: account.currencyCode,
      parentTitle: draft.item,
      totalMinor: minor,
      lines: draft.splitLines,
    });
  }

  return [
    {
      accountId: account.id,
      amountMinor: minor * (draft.kind === 'expense' ? -1 : 1),
      currencyCode: account.currencyCode,
      categoryId: effectiveCategoryId,
      subcategoryId: effectiveSubcategoryId,
      note: normalLine?.note,
    },
  ];
}

export function resolveAddTransactionAmountExpression(value: string): string {
  return /[+\-*/]/.test(value) ? evaluateMoneyExpression(value) : value;
}

export function getAddTransactionDisplayAmount(value: string): string {
  try {
    return value ? resolveAddTransactionAmountExpression(value) : '0.00';
  } catch {
    return '0.00';
  }
}

export function getAddTransactionPreviewAmountMinor({
  amountExpression,
  kind,
  sourceAccountId,
}: {
  amountExpression: string;
  kind: TransactionKind;
  sourceAccountId: string;
}): number {
  try {
    const minor = Math.abs(parseMoneyInput(getAddTransactionDisplayAmount(amountExpression)));
    if (kind === 'transfer') {
      return isOutsideAccountId(sourceAccountId) ? minor : -minor;
    }

    return kind === 'expense' ? -minor : minor;
  } catch {
    return 0;
  }
}
