import {
  defaultCategories,
  getDefaultCategoryForKind,
  getDefaultSubcategoryId,
} from './categories';
import type {
  Account,
  AddTransactionCategoryDefault,
  AddTransactionDefaults,
  CategoryDefinition,
  NewTransactionInput,
  TransactionKind,
} from './types';

type IncomeExpenseKind = Extract<TransactionKind, 'income' | 'expense'>;

export type AddTransactionAccountDefaultInput = {
  accounts: Account[];
  explicitAccountId?: string | null;
  dashboardAccountIds?: string[] | null;
  rememberedAccountId?: string | null;
};

export type AddTransactionCategoryDefaultInput = {
  categories?: CategoryDefinition[];
  kind: TransactionKind;
  explicitCategoryId?: string | null;
  explicitSubcategoryId?: string | null;
  defaults?: AddTransactionDefaults | null;
};

export function normalizeAddTransactionDefaults(input: unknown): AddTransactionDefaults {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const record = input as Record<string, unknown>;
  const lastManualAccountId = typeof record.lastManualAccountId === 'string' && record.lastManualAccountId
    ? record.lastManualAccountId
    : null;
  const lastCategoryByKind = normalizeCategoryDefaults(record.lastCategoryByKind);

  return {
    ...(lastManualAccountId ? { lastManualAccountId } : {}),
    ...(Object.keys(lastCategoryByKind).length ? { lastCategoryByKind } : {}),
  };
}

export function resolveAddTransactionDefaultAccountId({
  accounts,
  explicitAccountId,
  dashboardAccountIds,
  rememberedAccountId,
}: AddTransactionAccountDefaultInput): string {
  const explicitAccount = findExistingAccount(accounts, explicitAccountId);
  if (explicitAccount) {
    return explicitAccount.id;
  }

  const dashboardAccount = (dashboardAccountIds ?? [])
    .map((accountId) => findActiveAccount(accounts, accountId))
    .find(Boolean);
  if (dashboardAccount) {
    return dashboardAccount.id;
  }

  const rememberedAccount = findActiveAccount(accounts, rememberedAccountId);
  if (rememberedAccount) {
    return rememberedAccount.id;
  }

  return accounts.find((account) => !account.isArchived)?.id ?? accounts[0]?.id ?? '';
}

export function resolveAddTransactionDefaultCategory({
  categories = defaultCategories,
  kind,
  explicitCategoryId,
  explicitSubcategoryId,
  defaults,
}: AddTransactionCategoryDefaultInput): AddTransactionCategoryDefault {
  if (kind === 'transfer') {
    return { categoryId: '', subcategoryId: null };
  }

  const explicit = resolveValidCategorySelection({
    categories,
    categoryId: explicitCategoryId,
    kind,
    subcategoryId: explicitSubcategoryId,
  });
  if (explicit) {
    return explicit;
  }

  const remembered = defaults?.lastCategoryByKind?.[kind];
  const rememberedSelection = resolveValidCategorySelection({
    categories,
    categoryId: remembered?.categoryId,
    kind,
    subcategoryId: remembered?.subcategoryId,
  });
  if (rememberedSelection) {
    return rememberedSelection;
  }

  const fallbackCategory = getDefaultCategoryForKind(kind, categories);
  return {
    categoryId: fallbackCategory.id,
    subcategoryId: getDefaultSubcategoryId(fallbackCategory) || null,
  };
}

export function getAddTransactionDefaultsAfterSave({
  accounts,
  categories = defaultCategories,
  currentDefaults,
  input,
}: {
  accounts: Account[];
  categories?: CategoryDefinition[];
  currentDefaults?: AddTransactionDefaults | null;
  input: NewTransactionInput;
}): AddTransactionDefaults {
  const normalizedCurrent = normalizeAddTransactionDefaults(currentDefaults);
  const firstLine = input.lines[0];
  const account = firstLine ? findActiveAccount(accounts, firstLine.accountId) : undefined;
  const nextDefaults: AddTransactionDefaults = {
    ...normalizedCurrent,
    lastCategoryByKind: { ...normalizedCurrent.lastCategoryByKind },
  };

  if (account) {
    nextDefaults.lastManualAccountId = account.id;
  }

  if (input.kind === 'income' || input.kind === 'expense') {
    const categorySelection = resolveValidCategorySelection({
      categories,
      categoryId: firstLine?.categoryId,
      kind: input.kind,
      subcategoryId: firstLine?.subcategoryId,
    });

    if (categorySelection) {
      nextDefaults.lastCategoryByKind = {
        ...nextDefaults.lastCategoryByKind,
        [input.kind]: categorySelection,
      };
    }
  }

  return normalizeAddTransactionDefaults(nextDefaults);
}

function normalizeCategoryDefaults(input: unknown): NonNullable<AddTransactionDefaults['lastCategoryByKind']> {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const record = input as Record<string, unknown>;
  return (['expense', 'income'] as const).reduce<NonNullable<AddTransactionDefaults['lastCategoryByKind']>>(
    (result, kind) => {
      const value = record[kind];
      if (!value || typeof value !== 'object') {
        return result;
      }

      const categoryDefault = value as Record<string, unknown>;
      if (typeof categoryDefault.categoryId !== 'string' || !categoryDefault.categoryId) {
        return result;
      }

      result[kind] = {
        categoryId: categoryDefault.categoryId,
        subcategoryId: typeof categoryDefault.subcategoryId === 'string' && categoryDefault.subcategoryId
          ? categoryDefault.subcategoryId
          : null,
      };
      return result;
    },
    {},
  );
}

function findActiveAccount(accounts: Account[], accountId: string | null | undefined): Account | undefined {
  if (!accountId) {
    return undefined;
  }

  return accounts.find((account) => account.id === accountId && !account.isArchived);
}

function findExistingAccount(accounts: Account[], accountId: string | null | undefined): Account | undefined {
  if (!accountId) {
    return undefined;
  }

  return accounts.find((account) => account.id === accountId);
}

function resolveValidCategorySelection({
  categories,
  categoryId,
  kind,
  subcategoryId,
}: {
  categories: CategoryDefinition[];
  categoryId?: string | null;
  kind: IncomeExpenseKind;
  subcategoryId?: string | null;
}): AddTransactionCategoryDefault | null {
  if (!categoryId) {
    return null;
  }

  const category = categories.find((candidate) => candidate.id === categoryId && candidate.type === kind);
  if (!category) {
    return null;
  }

  const subcategory = subcategoryId
    ? category.subcategories.find((candidate) => candidate.id === subcategoryId)
    : undefined;

  return {
    categoryId: category.id,
    subcategoryId: (subcategory?.id ?? getDefaultSubcategoryId(category)) || null,
  };
}
