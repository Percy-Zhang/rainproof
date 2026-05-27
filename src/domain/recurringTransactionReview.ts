import {
  advanceRecurringDueDate,
  buildTransactionInputFromRecurringItem,
  getRecurringCurrencyCodeForAccount,
} from './recurringItems';
import type {
  Account,
  CategoryDefinition,
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
  addTransaction: (input: NewTransactionInput) => Promise<void>;
  updateRecurringItem: (input: UpdateRecurringItemInput) => Promise<void>;
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
  addTransaction,
  categories,
  draft,
  recurringItem,
  updateRecurringItem,
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

  await addTransaction(transactionInput);

  try {
    await updateRecurringItem(recurringItemInput);
  } catch (caught) {
    const detail = caught instanceof Error ? caught.message : 'Could not advance the recurring item.';
    throw new Error(`Transaction was created, but the recurring item was not advanced. ${detail}`);
  }

  return {
    transactionInput,
    recurringItemInput,
  };
}
