import { getAccountDisplayName } from './accountThemes';
import { getCategory, getSubcategory, getSubcategoryColor, getSubcategoryIcon } from './categories';
import { isWithinDateRange } from './dates';
import { getLinkedStatsAdjustments } from './linkedStats';
import { normalizeCurrencyCode } from './money';
import { isSplitTransaction } from './splitTransactions';
import type {
  Account,
  CategoryDefinition,
  CurrencyCode,
  DateRange,
  Transaction,
  TransactionLine,
  TransactionLink,
} from './types';

export type StatsReportKind = 'income' | 'expense';
export type StatsReportRollupKind = 'category' | 'subcategory';

export type StatsReportSort =
  | 'date_newest'
  | 'date_oldest'
  | 'net_amount_highest'
  | 'net_amount_lowest'
  | 'gross_amount_highest'
  | 'gross_amount_lowest'
  | 'item_az'
  | 'item_za'
  | 'category_subcategory'
  | 'account';

export type StatsReportLineRow = {
  reportKind: StatsReportKind;
  transactionId: string;
  transactionDatetime: string;
  transactionTitle: string;
  accountId: string;
  accountName: string;
  lineId: string;
  lineAmountMinor: number;
  grossAmountMinor: number;
  netAmountMinor: number;
  currencyCode: CurrencyCode;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  subcategoryId: string;
  subcategoryName: string;
  subcategoryIcon: string;
  subcategoryColor: string;
  lineNote: string;
  lineItemName: string;
  isSplitTransaction: boolean;
  lineSortOrder: number;
};

export type StatsReportRollup = {
  id: string;
  reportKind: StatsReportKind;
  kind: StatsReportRollupKind;
  categoryId: string;
  subcategoryId?: string;
  label: string;
  icon: string;
  color: string;
  grossAmountMinor: number;
  netAmountMinor: number;
  lineCount: number;
  percentage: number;
  lineIds: string[];
};

export type StatsReport = {
  reportKind: StatsReportKind;
  currencyCode: CurrencyCode;
  rows: StatsReportLineRow[];
  categoryRollups: StatsReportRollup[];
  subcategoryRollups: StatsReportRollup[];
  totalGrossAmountMinor: number;
  totalNetAmountMinor: number;
};

export type StatsReportRecentRowsInput = {
  report: StatsReport;
  rollupKind: StatsReportRollupKind;
  rollupId?: string;
  sort?: StatsReportSort;
  limit?: number;
};

export type StatsReportInput = {
  reportKind: StatsReportKind;
  transactions: Transaction[];
  transactionLines: TransactionLine[];
  transactionLinks?: TransactionLink[];
  accounts: Account[];
  categories?: CategoryDefinition[];
  range: DateRange;
  currencyCode: CurrencyCode;
  accountIds?: string[];
};

export type StatsReportDrilldownSelection =
  | {
      kind: 'category';
      categoryId: string;
    }
  | {
      kind: 'subcategory';
      categoryId: string;
      subcategoryId: string;
    };

export function getStatsReport(input: StatsReportInput): StatsReport {
  const rows = getStatsReportLineRows(input);
  const categoryRollups = buildRollups(rows, 'category');
  const subcategoryRollups = buildRollups(rows, 'subcategory');

  return {
    reportKind: input.reportKind,
    currencyCode: normalizeCurrencyCode(input.currencyCode),
    rows,
    categoryRollups,
    subcategoryRollups,
    totalGrossAmountMinor: rows.reduce((sum, row) => sum + row.grossAmountMinor, 0),
    totalNetAmountMinor: rows.reduce((sum, row) => sum + row.netAmountMinor, 0),
  };
}

export function getStatsReportLineRows({
  reportKind,
  transactions,
  transactionLines,
  transactionLinks = [],
  accounts,
  categories,
  range,
  currencyCode,
  accountIds,
}: StatsReportInput): StatsReportLineRow[] {
  if (accountIds && !accountIds.length) {
    return [];
  }

  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode);
  const accountFilter = accountIds?.length ? new Set(accountIds) : null;
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const linesByTransactionId = groupLinesByTransaction(transactionLines);
  const lineSortOrderById = new Map(transactionLines.map((line, index) => [line.id, index]));
  const linkedStatsAdjustments = getLinkedStatsAdjustments({
    transactions,
    lines: transactionLines,
    transactionLinks,
  });
  const rows: StatsReportLineRow[] = [];

  for (const line of transactionLines) {
    const transaction = transactionById.get(line.transactionId);
    if (
      !transaction ||
      transaction.kind !== reportKind ||
      !isWithinDateRange(transaction.datetime, range) ||
      normalizeCurrencyCode(line.currencyCode) !== normalizedCurrencyCode ||
      (accountFilter && !accountFilter.has(line.accountId)) ||
      !hasReportLineSign(reportKind, line.amountMinor)
    ) {
      continue;
    }

    const grossAmountMinor = Math.abs(line.amountMinor);
    const adjustmentMinor =
      reportKind === 'expense'
        ? linkedStatsAdjustments.expenseLineReductionMinorByLineId.get(line.id) ?? 0
        : linkedStatsAdjustments.incomeLineExclusionMinorByLineId.get(line.id) ?? 0;
    const netAmountMinor = Math.max(0, grossAmountMinor - adjustmentMinor);
    const category = getCategory(line.categoryId, categories);
    const subcategory = getSubcategory(line.categoryId, line.subcategoryId, categories);
    const account = accountById.get(line.accountId);
    const transactionTitle = transaction.title.trim();
    const lineNote = line.note.trim();

    rows.push({
      reportKind,
      transactionId: transaction.id,
      transactionDatetime: transaction.datetime,
      transactionTitle,
      accountId: line.accountId,
      accountName: account ? getAccountDisplayName(account) : 'Account',
      lineId: line.id,
      lineAmountMinor: line.amountMinor,
      grossAmountMinor,
      netAmountMinor,
      currencyCode: normalizedCurrencyCode,
      categoryId: category.id,
      categoryName: category.name,
      categoryIcon: category.icon,
      categoryColor: category.color,
      subcategoryId: subcategory?.id ?? line.subcategoryId,
      subcategoryName: subcategory?.name ?? category.name,
      subcategoryIcon: getSubcategoryIcon(line.categoryId, line.subcategoryId, categories),
      subcategoryColor: getSubcategoryColor(line.categoryId, line.subcategoryId, categories),
      lineNote,
      lineItemName: lineNote || transactionTitle || subcategory?.name || category.name,
      isSplitTransaction: isSplitTransaction(transaction, linesByTransactionId.get(transaction.id) ?? []),
      lineSortOrder: lineSortOrderById.get(line.id) ?? 0,
    });
  }

  return rows.sort((left, right) => compareStatsReportRows(left, right, 'date_newest'));
}

export function getStatsReportDrilldownRows({
  report,
  selection,
  sort = 'date_newest',
}: {
  report: StatsReport;
  selection: StatsReportDrilldownSelection;
  sort?: StatsReportSort;
}): StatsReportLineRow[] {
  const matchingRows = report.rows.filter((row) => {
    if (selection.kind === 'category') {
      return row.categoryId === selection.categoryId;
    }

    return row.categoryId === selection.categoryId && row.subcategoryId === selection.subcategoryId;
  });

  return sortStatsReportRows(matchingRows, sort);
}

export function getStatsReportRollups(
  report: StatsReport,
  rollupKind: StatsReportRollupKind,
): StatsReportRollup[] {
  return rollupKind === 'category' ? report.categoryRollups : report.subcategoryRollups;
}

export function getDefaultStatsReportRollup(
  report: StatsReport,
  rollupKind: StatsReportRollupKind,
): StatsReportRollup | undefined {
  return getStatsReportRollups(report, rollupKind)[0];
}

export function getStatsReportRollupById(
  report: StatsReport,
  rollupKind: StatsReportRollupKind,
  rollupId?: string,
): StatsReportRollup | undefined {
  const rollups = getStatsReportRollups(report, rollupKind);
  return rollups.find((rollup) => rollup.id === rollupId) ?? rollups[0];
}

export function getStatsReportRollupRows({
  report,
  rollupKind,
  rollupId,
  sort = 'date_newest',
}: Omit<StatsReportRecentRowsInput, 'limit'>): StatsReportLineRow[] {
  const rollup = getStatsReportRollupById(report, rollupKind, rollupId);
  if (!rollup) {
    return [];
  }

  const lineIds = new Set(rollup.lineIds);
  return sortStatsReportRows(
    report.rows.filter((row) => lineIds.has(row.lineId)),
    sort,
  );
}

export function getRecentStatsReportRollupRows({
  report,
  rollupKind,
  rollupId,
  sort = 'date_newest',
  limit = 5,
}: StatsReportRecentRowsInput): StatsReportLineRow[] {
  return getStatsReportRollupRows({ report, rollupKind, rollupId, sort }).slice(0, limit);
}

export function sortStatsReportRows(
  rows: StatsReportLineRow[],
  sort: StatsReportSort = 'date_newest',
): StatsReportLineRow[] {
  return [...rows].sort((left, right) => compareStatsReportRows(left, right, sort));
}

function buildRollups(rows: StatsReportLineRow[], kind: StatsReportRollupKind): StatsReportRollup[] {
  const totalNetAmountMinor = rows.reduce((sum, row) => sum + row.netAmountMinor, 0);
  const rollupsById = new Map<string, StatsReportRollup>();

  for (const row of rows) {
    const id = kind === 'category' ? getCategoryRollupId(row.categoryId) : getSubcategoryRollupId(row.categoryId, row.subcategoryId);
    const existing = rollupsById.get(id);

    if (existing) {
      existing.grossAmountMinor += row.grossAmountMinor;
      existing.netAmountMinor += row.netAmountMinor;
      existing.lineCount += 1;
      existing.lineIds.push(row.lineId);
      continue;
    }

    rollupsById.set(id, {
      id,
      reportKind: row.reportKind,
      kind,
      categoryId: row.categoryId,
      subcategoryId: kind === 'subcategory' ? row.subcategoryId : undefined,
      label: kind === 'subcategory' ? row.subcategoryName : row.categoryName,
      icon: kind === 'subcategory' ? row.subcategoryIcon : row.categoryIcon,
      color: kind === 'subcategory' ? row.subcategoryColor : row.categoryColor,
      grossAmountMinor: row.grossAmountMinor,
      netAmountMinor: row.netAmountMinor,
      lineCount: 1,
      percentage: 0,
      lineIds: [row.lineId],
    });
  }

  return Array.from(rollupsById.values())
    .map((rollup) => ({
      ...rollup,
      percentage: totalNetAmountMinor > 0 ? (rollup.netAmountMinor / totalNetAmountMinor) * 100 : 0,
    }))
    .sort(compareRollups);
}

function compareRollups(left: StatsReportRollup, right: StatsReportRollup): number {
  return (
    right.netAmountMinor - left.netAmountMinor ||
    right.grossAmountMinor - left.grossAmountMinor ||
    left.label.localeCompare(right.label) ||
    left.id.localeCompare(right.id)
  );
}

function compareStatsReportRows(
  left: StatsReportLineRow,
  right: StatsReportLineRow,
  sort: StatsReportSort,
): number {
  switch (sort) {
    case 'date_oldest':
      return compareDateOldest(left, right) || compareFallback(left, right);
    case 'net_amount_highest':
      return right.netAmountMinor - left.netAmountMinor || compareDateNewest(left, right) || compareFallback(left, right);
    case 'net_amount_lowest':
      return left.netAmountMinor - right.netAmountMinor || compareDateNewest(left, right) || compareFallback(left, right);
    case 'gross_amount_highest':
      return right.grossAmountMinor - left.grossAmountMinor || compareDateNewest(left, right) || compareFallback(left, right);
    case 'gross_amount_lowest':
      return left.grossAmountMinor - right.grossAmountMinor || compareDateNewest(left, right) || compareFallback(left, right);
    case 'item_az':
      return compareText(getItemSortText(left), getItemSortText(right)) || compareDateNewest(left, right) || compareFallback(left, right);
    case 'item_za':
      return compareText(getItemSortText(right), getItemSortText(left)) || compareDateNewest(left, right) || compareFallback(left, right);
    case 'category_subcategory':
      return (
        compareText(left.categoryName, right.categoryName) ||
        compareText(left.subcategoryName, right.subcategoryName) ||
        compareText(getItemSortText(left), getItemSortText(right)) ||
        compareDateNewest(left, right) ||
        compareFallback(left, right)
      );
    case 'account':
      return compareText(left.accountName, right.accountName) || compareDateNewest(left, right) || compareFallback(left, right);
    case 'date_newest':
      return compareDateNewest(left, right) || compareFallback(left, right);
  }
}

function hasReportLineSign(reportKind: StatsReportKind, amountMinor: number): boolean {
  return reportKind === 'expense' ? amountMinor < 0 : amountMinor > 0;
}

function groupLinesByTransaction(lines: TransactionLine[]): Map<string, TransactionLine[]> {
  const groups = new Map<string, TransactionLine[]>();

  for (const line of lines) {
    groups.set(line.transactionId, [...(groups.get(line.transactionId) ?? []), line]);
  }

  return groups;
}

function getCategoryRollupId(categoryId: string): string {
  return `category:${categoryId}`;
}

function getSubcategoryRollupId(categoryId: string, subcategoryId: string): string {
  return `subcategory:${categoryId}:${subcategoryId}`;
}

function getItemSortText(row: StatsReportLineRow): string {
  return row.lineNote || row.transactionTitle || row.subcategoryName || row.categoryName;
}

function compareDateNewest(left: StatsReportLineRow, right: StatsReportLineRow): number {
  return new Date(right.transactionDatetime).getTime() - new Date(left.transactionDatetime).getTime();
}

function compareDateOldest(left: StatsReportLineRow, right: StatsReportLineRow): number {
  return new Date(left.transactionDatetime).getTime() - new Date(right.transactionDatetime).getTime();
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function compareFallback(left: StatsReportLineRow, right: StatsReportLineRow): number {
  return (
    compareText(left.transactionTitle, right.transactionTitle) ||
    left.transactionId.localeCompare(right.transactionId) ||
    left.lineSortOrder - right.lineSortOrder ||
    left.lineId.localeCompare(right.lineId)
  );
}
