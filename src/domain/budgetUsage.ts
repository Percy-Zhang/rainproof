import { defaultCategories, getCategory, getSubcategory } from './categories';
import {
  doesBudgetScopeItemMatchRow,
  getBudgetScopeDetail,
  getBudgetScopeItems,
  getBudgetScopeLabel,
  getPrimaryBudgetScopeItem,
} from './budgetScopes';
import { getBudgetPeriodRange } from './budgetPeriods';
import { normalizeCurrencyCode } from './money';
import { getStatsReport, type StatsReport, type StatsReportLineRow } from './statsReports';
import type {
  Account,
  Budget,
  BudgetUsage,
  CategoryDefinition,
  Transaction,
  TransactionLine,
  TransactionLink,
} from './types';

export type BudgetUsageStatus = BudgetUsage['status'];

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

export function getBudgetUsageFromStatsReport({
  budgets,
  report,
}: {
  budgets: Budget[];
  report: StatsReport;
}): BudgetUsage[] {
  return budgets
    .filter((budget) => budget.isActive)
    .filter((budget) => normalizeCurrencyCode(budget.currencyCode) === normalizeCurrencyCode(report.currencyCode))
    .map((budget) => getBudgetUsageForRows(budget, report.rows));
}

export function getBudgetUsagesForPeriods({
  accounts,
  anchorDate = new Date(),
  budgets,
  categories,
  periodOffset = 0,
  transactionLines,
  transactionLinks,
  transactions,
}: {
  accounts: Account[];
  anchorDate?: Date;
  budgets: Budget[];
  categories: CategoryDefinition[];
  periodOffset?: number;
  transactionLines: TransactionLine[];
  transactionLinks: TransactionLink[];
  transactions: Transaction[];
}): BudgetUsage[] {
  const reportByPeriodAndCurrency = new Map<string, StatsReport>();

  return budgets
    .filter((budget) => budget.isActive)
    .map((budget) => {
      const currencyCode = normalizeCurrencyCode(budget.currencyCode);
      const reportKey = `${budget.period}:${currencyCode}`;
      let report = reportByPeriodAndCurrency.get(reportKey);

      if (!report) {
        report = getStatsReport({
          reportKind: 'expense',
          transactions,
          transactionLines,
          transactionLinks,
          accounts,
          categories,
          range: getBudgetPeriodRange(budget.period, anchorDate, periodOffset),
          currencyCode,
        });
        reportByPeriodAndCurrency.set(reportKey, report);
      }

      return getBudgetUsageForRows(budget, report.rows);
    });
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

export function getBudgetUsageDisplayRows(
  usages: BudgetUsage[],
  categories: CategoryDefinition[] = defaultCategories,
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
