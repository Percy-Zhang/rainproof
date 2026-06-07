import {
  advanceRecurringDueDate,
  buildTransactionInputFromRecurringItem,
  getRecurringCurrencyCodeForAccount,
} from './recurringItems';
import type {
  Account,
  CategoryDefinition,
  CreateRecurringTransactionInput,
  NewTransactionInput,
  RecurringItem,
  UpdateRecurringItemInput,
} from './types';

export type RecurringTransactionReviewDraft = {
  title: string;
  amountMinor: number;
  transactionDate: string;
  accountId: string;
  categoryId: string;
  subcategoryId: string | null;
  note: string;
};

type RecurringTransactionInputParams = {
  accounts: Account[];
  categories?: CategoryDefinition[];
  draft: RecurringTransactionReviewDraft;
  recurringItem: RecurringItem;
};

type SaveRecurringTransactionParams = RecurringTransactionInputParams & {
  createRecurringTransaction: (input: CreateRecurringTransactionInput) => Promise<void>;
};

export function buildRecurringTransactionInputFromDraft({
  accounts,
  categories,
  draft,
  recurringItem,
}: RecurringTransactionInputParams): NewTransactionInput {
  const currencyCode = getRecurringCurrencyCodeForAccount(accounts, draft.accountId);
  const draftRecurringItem: RecurringItem = {
    ...recurringItem,
    name: draft.title.trim(),
    amountMinor: draft.amountMinor,
    currencyCode,
    accountId: draft.accountId,
    categoryId: draft.categoryId,
    subcategoryId: draft.subcategoryId,
    note: draft.note.trim(),
    nextDueDate: draft.transactionDate,
  };

  return buildTransactionInputFromRecurringItem({
    accounts,
    categories,
    item: draftRecurringItem,
    transactionDate: draft.transactionDate,
  });
}

export function buildRecurringItemAdvanceInput(
  recurringItem: RecurringItem,
  accounts: Account[] = [],
): UpdateRecurringItemInput {
  const accountCurrencyCode = getRecurringCurrencyCodeForAccount(accounts, recurringItem.accountId);

  return {
    id: recurringItem.id,
    name: recurringItem.name,
    kind: recurringItem.kind,
    amountMinor: recurringItem.amountMinor,
    currencyCode: accountCurrencyCode || recurringItem.currencyCode,
    accountId: recurringItem.accountId,
    categoryId: recurringItem.categoryId,
    subcategoryId: recurringItem.subcategoryId,
    note: recurringItem.note,
    frequency: recurringItem.frequency,
    nextDueDate: advanceRecurringDueDate(recurringItem),
    isActive: recurringItem.isActive,
  };
}

export async function saveRecurringTransactionFromDraft({
  accounts,
  categories,
  createRecurringTransaction,
  draft,
  recurringItem,
}: SaveRecurringTransactionParams): Promise<{
  transactionInput: NewTransactionInput;
  recurringItemInput: UpdateRecurringItemInput;
}> {
  const transactionInput = buildRecurringTransactionInputFromDraft({
    accounts,
    categories,
    draft,
    recurringItem,
  });
  const recurringItemInput = buildRecurringItemAdvanceInput(recurringItem, accounts);

  await createRecurringTransaction({
    recurringItemId: recurringItem.id,
    previousNextDueDate: recurringItem.nextDueDate,
    transactionInput,
    recurringItemInput,
  });

  return {
    transactionInput,
    recurringItemInput,
  };
}
