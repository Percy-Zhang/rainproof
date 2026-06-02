import { formatOptionalMoneyInput } from './accountForm';
import { normalizeCurrencyCode } from './money';
import { formatMinorInput } from './splitTransactionForm';
import { toDateInputValue, toTimeInputValue } from './dates';
import type {
  Account,
  NewTransactionTemplateInput,
  NewTransactionTemplateLineInput,
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
  splitLines: NewTransactionTemplateLineInput[];
  isActive: boolean;
};

export type AddTransactionTemplatePrefillSplitLine = {
  id: string;
  amount: string;
  categoryId: string;
  subcategoryId: string;
  note: string;
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
  splitLines: AddTransactionTemplatePrefillSplitLine[];
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

  const splitLines = normalizeTemplateSplitLines(input.splitLines);
  const amountMinor = input.amountMinor ?? null;
  if (amountMinor !== null && (!Number.isInteger(amountMinor) || amountMinor <= 0)) {
    throw new Error('Template amount must be greater than zero when set.');
  }

  if (splitLines.length > 0) {
    validateTemplateSplitLines(splitLines, amountMinor);
  }

  const categoryId = normalizeOptionalId(input.categoryId) ?? splitLines[0]?.categoryId ?? null;
  const subcategoryId = normalizeOptionalId(input.subcategoryId) ?? splitLines[0]?.subcategoryId ?? null;

  return {
    name,
    kind: input.kind,
    title: input.title.trim(),
    accountId,
    amountMinor,
    currencyCode: normalizeCurrencyCode(selectedAccount?.currencyCode ?? input.currencyCode),
    categoryId,
    subcategoryId,
    notes: input.notes?.trim() ?? '',
    splitLines,
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
    amountExpression: formatOptionalMoneyInput(template.amountMinor ?? getTemplateSplitTotalMinor(template)),
    date: toDateInputValue(now),
    time: toTimeInputValue(now),
    accountId: account.id,
    categoryId: template.categoryId ?? template.splitLines[0]?.categoryId ?? null,
    subcategoryId: template.subcategoryId ?? template.splitLines[0]?.subcategoryId ?? null,
    notes: template.notes,
    splitLines: template.splitLines.map((line) => ({
      id: line.id,
      amount: formatMinorInput(line.amountMinor),
      categoryId: line.categoryId,
      subcategoryId: line.subcategoryId,
      note: line.note,
    })),
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

function normalizeTemplateSplitLines(
  lines: NewTransactionTemplateLineInput[] | undefined,
): NewTransactionTemplateLineInput[] {
  return (lines ?? []).map((line) => ({
    amountMinor: line.amountMinor,
    categoryId: line.categoryId.trim(),
    subcategoryId: line.subcategoryId.trim(),
    note: line.note?.trim() ?? '',
  }));
}

function validateTemplateSplitLines(lines: NewTransactionTemplateLineInput[], amountMinor: number | null): void {
  if (lines.length < 2) {
    throw new Error('Split templates need at least two lines.');
  }

  if (amountMinor === null) {
    throw new Error('Split templates need an amount.');
  }

  let splitTotalMinor = 0;
  for (const line of lines) {
    if (!Number.isInteger(line.amountMinor) || line.amountMinor <= 0) {
      throw new Error('Split line amounts must be greater than zero.');
    }

    if (!line.categoryId || !line.subcategoryId) {
      throw new Error('Choose a category and subcategory for every split line.');
    }

    splitTotalMinor += line.amountMinor;
  }

  if (splitTotalMinor !== amountMinor) {
    throw new Error('Split line amounts must equal the template amount.');
  }
}

function getTemplateSplitTotalMinor(template: TransactionTemplate): number | null {
  if (!template.splitLines.length) {
    return null;
  }

  return template.splitLines.reduce((sum, line) => sum + line.amountMinor, 0);
}
