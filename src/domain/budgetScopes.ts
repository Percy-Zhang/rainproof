import { defaultCategories, getCategory, getSubcategory } from './categories';
import { getActiveAccountCurrencyOptions, type CurrencyOption } from './currencyCatalog';
import {
  budgetPeriodOptions,
  getBudgetPeriodUnitLabel,
  getRollingBudgetDays,
  isRollingBudgetPeriod,
} from './budgetPeriods';
import { normalizeCurrencyCode } from './money';
import type {
  Account,
  Budget,
  BudgetPeriod,
  BudgetScopeItem,
  BudgetScopeType,
  CategoryDefinition,
  CurrencyCode,
  NewBudgetInput,
  UpdateBudgetInput,
} from './types';

export type ValidatedBudgetInput = {
  name: string;
  amountMinor: number;
  currencyCode: CurrencyCode;
  period: BudgetPeriod;
  scopeType: BudgetScopeType;
  categoryId: string | null;
  subcategoryId: string | null;
  scopeItems: BudgetScopeItem[];
  isActive: boolean;
};

export type BudgetCurrencyOptionsInput = {
  accounts: Account[];
  currentBudgetCurrencyCode?: CurrencyCode | null;
};

type BudgetScopeInput = Pick<Budget, 'currencyCode' | 'period' | 'scopeType' | 'categoryId' | 'subcategoryId'> &
  Partial<Pick<Budget, 'scopeItems'>>;

export function getBudgetScopeKey(input: BudgetScopeInput): string {
  const scopeType = getBudgetScopeStorageType(input.scopeType);
  const scopeItems = scopeType === 'overall' ? [] : getBudgetScopeItems(input);

  return [
    input.period,
    normalizeCurrencyCode(input.currencyCode, ''),
    scopeType,
    serializeBudgetScopeItems(scopeItems),
  ].join(':');
}

export function validateBudgetInput(input: NewBudgetInput | UpdateBudgetInput): ValidatedBudgetInput {
  const period = input.period ?? 'monthly';
  const scopeType = input.scopeType;
  const categoryId = normalizeNullableId(input.categoryId);
  const subcategoryId = normalizeNullableId(input.subcategoryId);
  const currencyCode = normalizeCurrencyCode(input.currencyCode, '');
  const scopeItems = normalizeBudgetScopeItems(
    input.scopeItems ?? getLegacyBudgetScopeItems(scopeType, categoryId, subcategoryId),
  );

  if (!budgetPeriodOptions.some((option) => option.value === period)) {
    throw new Error('Choose a valid budget period.');
  }

  if (!['overall', 'category', 'subcategory', 'include', 'exclude'].includes(scopeType)) {
    throw new Error('Choose a valid budget scope.');
  }

  if (!currencyCode) {
    throw new Error('Choose a budget currency.');
  }

  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error('Budget amount must be greater than zero.');
  }

  if (scopeType === 'overall' && (categoryId || subcategoryId)) {
    throw new Error('Overall budgets cannot use a category.');
  }

  if (scopeType === 'category' && (!categoryId || subcategoryId)) {
    throw new Error('Category budgets need one category and no subcategory.');
  }

  if (scopeType === 'subcategory' && (!categoryId || !subcategoryId)) {
    throw new Error('Subcategory budgets need a category and subcategory.');
  }

  if ((scopeType === 'include' || scopeType === 'exclude') && !scopeItems.length) {
    throw new Error('Choose at least one budget category.');
  }

  const storedScopeType = getBudgetScopeStorageType(scopeType);
  const primaryScopeItem = getPrimaryBudgetScopeItem({ scopeType, categoryId, subcategoryId, scopeItems });
  const validatedCategoryId = storedScopeType === 'overall' ? null : primaryScopeItem?.categoryId ?? categoryId;
  const validatedSubcategoryId = storedScopeType === 'overall' ? null : primaryScopeItem?.subcategoryId ?? null;

  return {
    name: input.name?.trim() || getDefaultBudgetName({ scopeType, categoryId, subcategoryId }),
    amountMinor: input.amountMinor,
    currencyCode,
    period,
    scopeType: storedScopeType,
    categoryId: validatedCategoryId,
    subcategoryId: validatedSubcategoryId,
    scopeItems: storedScopeType === 'overall' ? [] : getBudgetScopeItems({ scopeType, categoryId, subcategoryId, scopeItems }),
    isActive: input.isActive !== false,
  };
}

export function normalizeBudgetScopeItems(items: BudgetScopeItem[]): BudgetScopeItem[] {
  const normalizedItems = items
    .map((item) => ({
      categoryId: normalizeNullableId(item.categoryId) ?? '',
      subcategoryId: normalizeNullableId(item.subcategoryId),
    }))
    .filter((item) => item.categoryId);
  const parentCategoryIds = new Set(
    normalizedItems.filter((item) => !item.subcategoryId).map((item) => item.categoryId),
  );
  const deduped = new Map<string, BudgetScopeItem>();

  for (const item of normalizedItems) {
    if (item.subcategoryId && parentCategoryIds.has(item.categoryId)) {
      continue;
    }

    deduped.set(getBudgetScopeItemKey(item), item);
  }

  return Array.from(deduped.values()).sort(compareBudgetScopeItems);
}

export function getBudgetScopeItems(
  budget: Pick<Budget, 'scopeType' | 'categoryId' | 'subcategoryId'> & Partial<Pick<Budget, 'scopeItems'>>,
): BudgetScopeItem[] {
  if (budget.scopeType === 'overall') {
    return [];
  }

  if (budget.scopeType === 'category' || budget.scopeType === 'subcategory') {
    return normalizeBudgetScopeItems(getLegacyBudgetScopeItems(budget.scopeType, budget.categoryId, budget.subcategoryId));
  }

  return normalizeBudgetScopeItems(
    budget.scopeItems ??
      getLegacyBudgetScopeItems(budget.subcategoryId ? 'subcategory' : 'category', budget.categoryId, budget.subcategoryId),
  );
}

export function getBudgetCurrencyOptions({
  accounts,
  currentBudgetCurrencyCode,
}: BudgetCurrencyOptionsInput): CurrencyOption[] {
  return getActiveAccountCurrencyOptions(accounts, currentBudgetCurrencyCode);
}

export function getBudgetScopeLabel(
  budget: Pick<Budget, 'scopeType' | 'categoryId' | 'subcategoryId'> &
    Partial<Pick<Budget, 'scopeItems' | 'period'>>,
  categories?: CategoryDefinition[],
): string {
  if (budget.scopeType === 'overall') {
    return getOverallBudgetScopeLabel(budget.period ?? 'monthly');
  }

  const scopeItems = getBudgetScopeItems(budget);

  if (budget.scopeType === 'exclude') {
    return scopeItems.length
      ? `Excludes ${formatBudgetScopeItemsSummary(scopeItems, categories)}`
      : 'No exclusions selected';
  }

  return formatBudgetScopeItemsSummary(scopeItems, categories);
}

export function getBudgetScopeDetail(
  budget: Pick<Budget, 'scopeType' | 'categoryId' | 'subcategoryId'> & Partial<Pick<Budget, 'scopeItems'>>,
  categories?: CategoryDefinition[],
): string {
  if (budget.scopeType === 'overall') {
    return 'All expense categories';
  }

  const scopeItems = getBudgetScopeItems(budget);
  const primaryScopeItem = scopeItems[0];

  if (!primaryScopeItem) {
    return budget.scopeType === 'exclude' ? 'Choose categories to exclude' : 'Choose categories to include';
  }

  if (budget.scopeType === 'exclude') {
    return 'All spending except selected';
  }

  if (scopeItems.length > 1) {
    return `${scopeItems.length} selected categories`;
  }

  const category = getCategory(primaryScopeItem.categoryId, categories);

  if (primaryScopeItem.subcategoryId) {
    return category.name;
  }

  return 'Category budget';
}

export function getPrimaryBudgetScopeItem(
  budget: Pick<Budget, 'scopeType' | 'categoryId' | 'subcategoryId'> & Partial<Pick<Budget, 'scopeItems'>>,
): BudgetScopeItem | null {
  return getBudgetScopeItems(budget)[0] ?? null;
}

export function doesBudgetScopeItemMatchRow(
  item: BudgetScopeItem,
  row: Pick<BudgetScopeItem, 'categoryId' | 'subcategoryId'>,
): boolean {
  if (row.categoryId !== item.categoryId) {
    return false;
  }

  return item.subcategoryId ? row.subcategoryId === item.subcategoryId : true;
}

function getOverallBudgetScopeLabel(period: BudgetPeriod): string {
  if (isRollingBudgetPeriod(period)) {
    return `Overall rolling ${getRollingBudgetDays(period)}-day spending`;
  }
  return `Overall ${getBudgetPeriodUnitLabel(period)}ly spending`;
}

function getDefaultBudgetName({
  scopeType,
  categoryId,
  subcategoryId,
}: {
  scopeType: BudgetScopeType;
  categoryId: string | null;
  subcategoryId: string | null;
}): string {
  if (scopeType === 'overall') {
    return 'Overall spending';
  }

  if (scopeType === 'include') {
    return 'Selected categories budget';
  }

  if (scopeType === 'exclude') {
    return 'Filtered spending budget';
  }

  if (scopeType === 'subcategory') {
    return `${formatBudgetIdLabel(subcategoryId)} budget`;
  }

  return `${formatBudgetIdLabel(categoryId)} budget`;
}

function formatBudgetIdLabel(value: string | null): string {
  const words = (value || 'Category')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words.length
    ? words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' ')
    : 'Category';
}

function normalizeNullableId(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed || null;
}

function getBudgetScopeStorageType(scopeType: BudgetScopeType): BudgetScopeType {
  if (scopeType === 'category' || scopeType === 'subcategory') {
    return 'include';
  }

  return scopeType;
}

function getLegacyBudgetScopeItems(
  scopeType: BudgetScopeType,
  categoryId: string | null | undefined,
  subcategoryId: string | null | undefined,
): BudgetScopeItem[] {
  const normalizedCategoryId = normalizeNullableId(categoryId);
  const normalizedSubcategoryId = normalizeNullableId(subcategoryId);

  if (!normalizedCategoryId || scopeType === 'overall') {
    return [];
  }

  return [{
    categoryId: normalizedCategoryId,
    subcategoryId: scopeType === 'subcategory' ? normalizedSubcategoryId : null,
  }];
}

function formatBudgetScopeItemsSummary(
  scopeItems: BudgetScopeItem[],
  categories: CategoryDefinition[] = defaultCategories,
): string {
  if (!scopeItems.length) {
    return 'Selected categories';
  }

  const [firstItem, ...restItems] = scopeItems;
  const firstLabel = getBudgetScopeItemLabel(firstItem, categories);
  return restItems.length ? `${firstLabel} + ${restItems.length} more` : firstLabel;
}

function getBudgetScopeItemLabel(item: BudgetScopeItem, categories: CategoryDefinition[]): string {
  const category = getCategory(item.categoryId, categories);
  if (!item.subcategoryId) {
    return category.name;
  }

  return getSubcategory(category.id, item.subcategoryId, categories)?.name ?? item.subcategoryId;
}

function serializeBudgetScopeItems(items: BudgetScopeItem[]): string {
  return JSON.stringify(normalizeBudgetScopeItems(items));
}

function getBudgetScopeItemKey(item: BudgetScopeItem): string {
  return `${item.categoryId}:${item.subcategoryId ?? ''}`;
}

function compareBudgetScopeItems(left: BudgetScopeItem, right: BudgetScopeItem): number {
  return (
    left.categoryId.localeCompare(right.categoryId) ||
    (left.subcategoryId ?? '').localeCompare(right.subcategoryId ?? '')
  );
}
