import { formatOptionalMoneyInput } from './accountForm';
import { normalizeCurrencyCode } from './money';
import { toDateInputValue, toTimeInputValue } from './dates';
import type {
  Account,
  NewTransactionTemplateInput,
  TransactionTemplate,
  UpdateTransactionTemplateInput,
} from './types';

export type TransactionTemplateInput = NewTransactionTemplateInput | UpdateTransactionTemplateInput;

export type ValidTransactionTemplateInput = {
  name: string;
  kind: 'expense' | 'income';
  title: string;
  accountId: string;
  amountMinor: number | null;
  currencyCode: string;
  categoryId: string | null;
  subcategoryId: string | null;
  notes: string;
  isActive: boolean;
};

export type AddTransactionTemplatePrefill = {
  kind: 'expense' | 'income';
  title: string;
  amountExpression: string;
  date: string;
  time: string;
  accountId: string;
  categoryId: string | null;
  subcategoryId: string | null;
  notes: string;
};

export function validateTransactionTemplateInput(
  input: TransactionTemplateInput,
  accounts: Account[] = [],
): ValidTransactionTemplateInput {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Template name is required.');
  }

  if (input.kind !== 'expense' && input.kind !== 'income') {
    throw new Error('Templates support income and expense transactions.');
  }

  const accountId = input.accountId.trim();
  if (!accountId) {
    throw new Error('Template account is required.');
  }

  const selectedAccount = accounts.find((account) => account.id === accountId);
  if (accounts.length && !selectedAccount) {
    throw new Error('Template account needs attention.');
  }

  const amountMinor = input.amountMinor ?? null;
  if (amountMinor !== null && (!Number.isInteger(amountMinor) || amountMinor <= 0)) {
    throw new Error('Template amount must be greater than zero when set.');
  }

  return {
    name,
    kind: input.kind,
    title: input.title.trim(),
    accountId,
    amountMinor,
    currencyCode: normalizeCurrencyCode(selectedAccount?.currencyCode ?? input.currencyCode),
    categoryId: normalizeOptionalId(input.categoryId),
    subcategoryId: normalizeOptionalId(input.subcategoryId),
    notes: input.notes?.trim() ?? '',
    isActive: input.isActive ?? true,
  };
}

export function getTemplateCurrencyCodeForAccount(accounts: Account[], accountId: string): string {
  return accounts.find((account) => account.id === accountId)?.currencyCode ?? '';
}

export function buildAddTransactionPrefillFromTemplate({
  accounts,
  now = new Date(),
  template,
}: {
  accounts: Account[];
  now?: Date;
  template: TransactionTemplate;
}): AddTransactionTemplatePrefill {
  const account = accounts.find((candidate) => candidate.id === template.accountId);
  if (!account) {
    throw new Error('Template account needs attention.');
  }

  return {
    kind: template.kind,
    title: template.title || template.name,
    amountExpression: formatOptionalMoneyInput(template.amountMinor),
    date: toDateInputValue(now),
    time: toTimeInputValue(now),
    accountId: account.id,
    categoryId: template.categoryId,
    subcategoryId: template.subcategoryId,
    notes: template.notes,
  };
}

export function getActiveTransactionTemplates(templates: TransactionTemplate[]): TransactionTemplate[] {
  return templates
    .filter((template) => template.isActive)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
