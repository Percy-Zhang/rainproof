import { getActiveAccountCurrencyOptions, type CurrencyOption } from './currencyCatalog';
import { normalizeCurrencyCode } from './money';
import { defaultCategories, getCategory, getSubcategory } from './categories';
import type {
  Account,
  Budget,
  BudgetPeriod,
  BudgetScopeItem,
  BudgetScopeType,
  CategoryDefinition,
  BudgetUsage,
  CurrencyCode,
  DateRange,
  NewBudgetInput,
  UpdateBudgetInput,
} from './types';
import type { StatsReport, StatsReportLineRow } from './statsReports';

export type BudgetUsageStatus = BudgetUsage['status'];

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

export type DashboardBudgetSummaryData = {
  activeBudgetCount: number;
  overBudgetCount: number;
  nearLimitCount: number;
  highestRiskUsages: BudgetUsage[];
};

export type BudgetUsageDisplayRow = {
  id: string;
  budget: Budget;
  scopeLabel: string;
  scopeDetail: string;
  icon: string;
  color: string;
  spentMinor: number;
  remainingMinor: number;
  percentageUsed: number;
  status: BudgetUsageStatus;
};

export type BudgetCurrencyOptionsInput = {
  accounts: Account[];
  currentBudgetCurrencyCode?: CurrencyCode | null;
};

type BudgetScopeInput = Pick<Budget, 'currencyCode' | 'period' | 'scopeType' | 'categoryId' | 'subcategoryId'> &
  Partial<Pick<Budget, 'scopeItems'>>;

export function getBudgetMonthlyRange(date = new Date()): DateRange {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export function getBudgetScopeKey(input: BudgetScopeInput): string {
  const scopeType = getBudgetScopeKeyType(input.scopeType);
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

  if (period !== 'monthly') {
    throw new Error('Budgets must use a monthly period.');
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

export function getBudgetUsageFromStatsReport({
  budgets,
  report,
}: {
  budgets: Budget[];
  report: StatsReport;
}): BudgetUsage[] {
  return budgets
    .filter((budget) => budget.isActive && budget.period === 'monthly')
    .filter((budget) => normalizeCurrencyCode(budget.currencyCode) === normalizeCurrencyCode(report.currencyCode))
    .map((budget) => getBudgetUsageForRows(budget, report.rows));
}

export function getBudgetUsageForRows(budget: Budget, rows: StatsReportLineRow[]): BudgetUsage {
  const matchingRows = rows.filter((row) => doesBudgetMatchRow(budget, row));
  const spentMinor = matchingRows.reduce((sum, row) => sum + row.netAmountMinor, 0);
  const remainingMinor = calculateBudgetRemaining(budget.amountMinor, spentMinor);
  const percentageUsed = calculateBudgetPercentUsed(budget.amountMinor, spentMinor);

  return {
    budget,
    spentMinor,
    remainingMinor,
    percentageUsed,
    status: getBudgetStatus(percentageUsed),
    matchingLineIds: matchingRows.map((row) => row.lineId),
  };
}

export function calculateBudgetRemaining(amountMinor: number, spentMinor: number): number {
  return amountMinor - spentMinor;
}

export function calculateBudgetPercentUsed(amountMinor: number, spentMinor: number): number {
  if (amountMinor <= 0) {
    return 0;
  }

  return Math.round((Math.max(0, spentMinor) / amountMinor) * 100);
}

export function getBudgetStatus(percentageUsed: number): BudgetUsageStatus {
  if (percentageUsed >= 100) {
    return 'over_budget';
  }

  if (percentageUsed >= 80) {
    return 'near_limit';
  }

  return 'under_budget';
}

export function getDashboardBudgetSummaryData(
  usages: BudgetUsage[],
  limit = 3,
): DashboardBudgetSummaryData {
  const activeUsages = usages.filter((usage) => usage.budget.isActive);

  return {
    activeBudgetCount: activeUsages.length,
    overBudgetCount: activeUsages.filter((usage) => usage.status === 'over_budget').length,
    nearLimitCount: activeUsages.filter((usage) => usage.status === 'near_limit').length,
    highestRiskUsages: sortBudgetUsagesByRisk(activeUsages).slice(0, limit),
  };
}

export function sortBudgetsByDisplayOrder<T extends Pick<Budget, 'sortOrder' | 'createdAt' | 'id'>>(
  budgets: T[],
): T[] {
  return [...budgets].sort(compareBudgetDisplayOrder);
}

export function sortBudgetUsagesByDisplayOrder(usages: BudgetUsage[]): BudgetUsage[] {
  return [...usages].sort((left, right) => compareBudgetDisplayOrder(left.budget, right.budget));
}

export function sortBudgetUsageDisplayRowsByDisplayOrder(
  rows: BudgetUsageDisplayRow[],
): BudgetUsageDisplayRow[] {
  return [...rows].sort((left, right) => compareBudgetDisplayOrder(left.budget, right.budget));
}

export function getBudgetScopeLabel(
  budget: Pick<Budget, 'scopeType' | 'categoryId' | 'subcategoryId'> & Partial<Pick<Budget, 'scopeItems'>>,
  categories?: CategoryDefinition[],
): string {
  if (budget.scopeType === 'overall') {
    return 'Overall monthly spending';
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

export function getBudgetUsageDisplayRows(
  usages: BudgetUsage[],
  categories?: CategoryDefinition[],
): BudgetUsageDisplayRow[] {
  return usages.map((usage) => {
    const primaryScopeItem = getPrimaryBudgetScopeItem(usage.budget);
    const category = primaryScopeItem ? getCategory(primaryScopeItem.categoryId, categories) : null;
    const subcategory = primaryScopeItem?.subcategoryId && category
      ? getSubcategory(category.id, primaryScopeItem.subcategoryId, categories)
      : null;

    return {
      id: usage.budget.id,
      budget: usage.budget,
      scopeLabel: getBudgetScopeLabel(usage.budget, categories),
      scopeDetail: getBudgetScopeDetail(usage.budget, categories),
      icon: subcategory?.icon ?? category?.icon ?? 'wallet-outline',
      color: subcategory?.color ?? category?.color ?? '#1876A8',
      spentMinor: usage.spentMinor,
      remainingMinor: usage.remainingMinor,
      percentageUsed: usage.percentageUsed,
      status: usage.status,
    };
  });
}

function doesBudgetMatchRow(budget: Budget, row: StatsReportLineRow): boolean {
  if (row.reportKind !== 'expense' || normalizeCurrencyCode(row.currencyCode) !== normalizeCurrencyCode(budget.currencyCode)) {
    return false;
  }

  if (budget.scopeType === 'overall') {
    return true;
  }

  const scopeItems = getBudgetScopeItems(budget);
  const matchesSelectedScope = scopeItems.some((item) => doesBudgetScopeItemMatchRow(item, row));

  if (budget.scopeType === 'exclude') {
    return !matchesSelectedScope;
  }

  return matchesSelectedScope;
}

function sortBudgetUsagesByRisk(usages: BudgetUsage[]): BudgetUsage[] {
  return [...usages].sort((left, right) => (
    getBudgetStatusRank(right.status) - getBudgetStatusRank(left.status) ||
    right.percentageUsed - left.percentageUsed ||
    left.remainingMinor - right.remainingMinor ||
    left.budget.name.localeCompare(right.budget.name) ||
    left.budget.id.localeCompare(right.budget.id)
  ));
}

function compareBudgetDisplayOrder<T extends Pick<Budget, 'sortOrder' | 'createdAt' | 'id'>>(
  left: T,
  right: T,
): number {
  return (
    left.sortOrder - right.sortOrder ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
}

function getBudgetStatusRank(status: BudgetUsageStatus): number {
  switch (status) {
    case 'over_budget':
      return 3;
    case 'near_limit':
      return 2;
    case 'under_budget':
      return 1;
  }
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

function getBudgetScopeKeyType(scopeType: BudgetScopeType): BudgetScopeType {
  return getBudgetScopeStorageType(scopeType);
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

function getPrimaryBudgetScopeItem(
  budget: Pick<Budget, 'scopeType' | 'categoryId' | 'subcategoryId'> & Partial<Pick<Budget, 'scopeItems'>>,
): BudgetScopeItem | null {
  return getBudgetScopeItems(budget)[0] ?? null;
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

function doesBudgetScopeItemMatchRow(item: BudgetScopeItem, row: StatsReportLineRow): boolean {
  if (row.categoryId !== item.categoryId) {
    return false;
  }

  return item.subcategoryId ? row.subcategoryId === item.subcategoryId : true;
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
