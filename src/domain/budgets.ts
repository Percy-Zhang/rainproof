import { getCurrencyName, type CurrencyOption } from './currencyCatalog';
import { getCurrencySymbol, normalizeCurrencyCode } from './money';
import { getCategory, getSubcategory } from './categories';
import type {
  Account,
  Budget,
  BudgetPeriod,
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

type BudgetScopeInput = Pick<Budget, 'currencyCode' | 'period' | 'scopeType' | 'categoryId' | 'subcategoryId'>;

export function getBudgetMonthlyRange(date = new Date()): DateRange {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export function getBudgetScopeKey(input: BudgetScopeInput): string {
  return [
    input.period,
    normalizeCurrencyCode(input.currencyCode, ''),
    input.scopeType,
    normalizeNullableId(input.categoryId),
    normalizeNullableId(input.subcategoryId),
  ].join(':');
}

export function validateBudgetInput(input: NewBudgetInput | UpdateBudgetInput): ValidatedBudgetInput {
  const period = input.period ?? 'monthly';
  const scopeType = input.scopeType;
  const categoryId = normalizeNullableId(input.categoryId);
  const subcategoryId = normalizeNullableId(input.subcategoryId);
  const currencyCode = normalizeCurrencyCode(input.currencyCode, '');

  if (period !== 'monthly') {
    throw new Error('Budgets must use a monthly period.');
  }

  if (!['overall', 'category', 'subcategory'].includes(scopeType)) {
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

  return {
    name: input.name?.trim() || getDefaultBudgetName({ scopeType, categoryId, subcategoryId }),
    amountMinor: input.amountMinor,
    currencyCode,
    period,
    scopeType,
    categoryId: scopeType === 'overall' ? null : categoryId,
    subcategoryId: scopeType === 'subcategory' ? subcategoryId : null,
    isActive: input.isActive !== false,
  };
}

export function getBudgetCurrencyOptions({
  accounts,
  currentBudgetCurrencyCode,
}: BudgetCurrencyOptionsInput): CurrencyOption[] {
  const codes: CurrencyCode[] = [];

  for (const account of accounts) {
    const code = normalizeCurrencyCode(account.currencyCode, '');
    if (!account.isArchived && code && !codes.includes(code)) {
      codes.push(code);
    }
  }

  const currentCode = normalizeCurrencyCode(currentBudgetCurrencyCode, '');
  if (currentCode && !codes.includes(currentCode)) {
    codes.push(currentCode);
  }

  return codes.map((code) => ({
    code,
    label: getCurrencyName(code),
    symbol: getCurrencySymbol(code),
  }));
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
  budget: Pick<Budget, 'scopeType' | 'categoryId' | 'subcategoryId'>,
  categories?: CategoryDefinition[],
): string {
  if (budget.scopeType === 'overall') {
    return 'Overall monthly spending';
  }

  const category = getCategory(budget.categoryId ?? '', categories);

  if (budget.scopeType === 'subcategory') {
    const subcategory = getSubcategory(category.id, budget.subcategoryId ?? '', categories);
    return subcategory?.name ?? budget.subcategoryId ?? category.name;
  }

  return category.name;
}

export function getBudgetScopeDetail(
  budget: Pick<Budget, 'scopeType' | 'categoryId' | 'subcategoryId'>,
  categories?: CategoryDefinition[],
): string {
  if (budget.scopeType === 'overall') {
    return 'All expense categories';
  }

  const category = getCategory(budget.categoryId ?? '', categories);

  if (budget.scopeType === 'subcategory') {
    return category.name;
  }

  return 'Category budget';
}

export function getBudgetUsageDisplayRows(
  usages: BudgetUsage[],
  categories?: CategoryDefinition[],
): BudgetUsageDisplayRow[] {
  return usages.map((usage) => {
    const category = usage.budget.scopeType === 'overall'
      ? null
      : getCategory(usage.budget.categoryId ?? '', categories);
    const subcategory = usage.budget.scopeType === 'subcategory' && category
      ? getSubcategory(category.id, usage.budget.subcategoryId ?? '', categories)
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

  if (budget.scopeType === 'category') {
    return row.categoryId === budget.categoryId;
  }

  return row.categoryId === budget.categoryId && row.subcategoryId === budget.subcategoryId;
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
