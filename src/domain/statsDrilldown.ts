import {
  getStatsReportDrilldownRows,
  type StatsReport,
  type StatsReportDrilldownSelection,
  type StatsReportLineRow,
  type StatsReportSort,
} from './statsReports';

export type StatsDrilldownDisplayMode = 'parent' | 'line';

export type StatsDrilldownParentRow = {
  transactionId: string;
  transactionDatetime: string;
  transactionTitle: string;
  accountName: string;
  currencyCode: string;
  grossAmountMinor: number;
  netAmountMinor: number;
  lineCount: number;
  isSplitTransaction: boolean;
  primaryRow: StatsReportLineRow;
  rows: StatsReportLineRow[];
};

export type StatsDrilldownData = {
  lineRows: StatsReportLineRow[];
  parentRows: StatsDrilldownParentRow[];
};

export function getStatsDrilldownSelection({
  categoryId,
  subcategoryId,
}: {
  categoryId: string;
  subcategoryId?: string;
}): StatsReportDrilldownSelection {
  return subcategoryId
    ? { kind: 'subcategory', categoryId, subcategoryId }
    : { kind: 'category', categoryId };
}

export function getStatsDrilldownData({
  report,
  categoryId,
  subcategoryId,
  sort = 'date_newest',
}: {
  report: StatsReport;
  categoryId: string;
  subcategoryId?: string;
  sort?: StatsReportSort;
}): StatsDrilldownData {
  const lineRows = getStatsReportDrilldownRows({
    report,
    selection: getStatsDrilldownSelection({ categoryId, subcategoryId }),
    sort,
  });

  return {
    lineRows,
    parentRows: sortStatsDrilldownParentRows(groupStatsDrilldownParentRows(lineRows), sort),
  };
}

export function groupStatsDrilldownParentRows(rows: StatsReportLineRow[]): StatsDrilldownParentRow[] {
  const parentRowsById = new Map<string, StatsDrilldownParentRow>();

  for (const row of rows) {
    const existing = parentRowsById.get(row.transactionId);
    if (existing) {
      existing.grossAmountMinor += row.grossAmountMinor;
      existing.netAmountMinor += row.netAmountMinor;
      existing.lineCount += 1;
      existing.rows.push(row);
      if (row.netAmountMinor > existing.primaryRow.netAmountMinor) {
        existing.primaryRow = row;
      }
      continue;
    }

    parentRowsById.set(row.transactionId, {
      transactionId: row.transactionId,
      transactionDatetime: row.transactionDatetime,
      transactionTitle: row.transactionTitle,
      accountName: row.accountName,
      currencyCode: row.currencyCode,
      grossAmountMinor: row.grossAmountMinor,
      netAmountMinor: row.netAmountMinor,
      lineCount: 1,
      isSplitTransaction: row.isSplitTransaction,
      primaryRow: row,
      rows: [row],
    });
  }

  return Array.from(parentRowsById.values()).map((parentRow) => ({
    ...parentRow,
    accountName: formatUniqueValues(parentRow.rows.map((row) => row.accountName)),
  }));
}

export function sortStatsDrilldownParentRows(
  rows: StatsDrilldownParentRow[],
  sort: StatsReportSort = 'date_newest',
): StatsDrilldownParentRow[] {
  return [...rows].sort((left, right) => compareParentRows(left, right, sort));
}

export function getStatsDrilldownOpenTransactionId(row: StatsReportLineRow | StatsDrilldownParentRow): string {
  return row.transactionId;
}

function compareParentRows(
  left: StatsDrilldownParentRow,
  right: StatsDrilldownParentRow,
  sort: StatsReportSort,
): number {
  switch (sort) {
    case 'date_oldest':
      return compareDateOldest(left, right) || compareParentFallback(left, right);
    case 'net_amount_highest':
      return right.netAmountMinor - left.netAmountMinor || compareDateNewest(left, right) || compareParentFallback(left, right);
    case 'net_amount_lowest':
      return left.netAmountMinor - right.netAmountMinor || compareDateNewest(left, right) || compareParentFallback(left, right);
    case 'gross_amount_highest':
      return right.grossAmountMinor - left.grossAmountMinor || compareDateNewest(left, right) || compareParentFallback(left, right);
    case 'gross_amount_lowest':
      return left.grossAmountMinor - right.grossAmountMinor || compareDateNewest(left, right) || compareParentFallback(left, right);
    case 'item_az':
      return compareText(getParentItemSortText(left), getParentItemSortText(right)) || compareDateNewest(left, right) || compareParentFallback(left, right);
    case 'item_za':
      return compareText(getParentItemSortText(right), getParentItemSortText(left)) || compareDateNewest(left, right) || compareParentFallback(left, right);
    case 'category_subcategory':
      return (
        compareText(left.primaryRow.categoryName, right.primaryRow.categoryName) ||
        compareText(left.primaryRow.subcategoryName, right.primaryRow.subcategoryName) ||
        compareText(getParentItemSortText(left), getParentItemSortText(right)) ||
        compareDateNewest(left, right) ||
        compareParentFallback(left, right)
      );
    case 'account':
      return compareText(left.accountName, right.accountName) || compareDateNewest(left, right) || compareParentFallback(left, right);
    case 'date_newest':
      return compareDateNewest(left, right) || compareParentFallback(left, right);
  }
}

function formatUniqueValues(values: string[]): string {
  return Array.from(new Set(values.filter(Boolean))).join(' / ') || 'Account';
}

function getParentItemSortText(row: StatsDrilldownParentRow): string {
  return row.transactionTitle || row.primaryRow.lineItemName || row.primaryRow.subcategoryName || row.primaryRow.categoryName;
}

function compareDateNewest(left: StatsDrilldownParentRow, right: StatsDrilldownParentRow): number {
  return new Date(right.transactionDatetime).getTime() - new Date(left.transactionDatetime).getTime();
}

function compareDateOldest(left: StatsDrilldownParentRow, right: StatsDrilldownParentRow): number {
  return new Date(left.transactionDatetime).getTime() - new Date(right.transactionDatetime).getTime();
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function compareParentFallback(left: StatsDrilldownParentRow, right: StatsDrilldownParentRow): number {
  return (
    compareText(left.transactionTitle, right.transactionTitle) ||
    left.transactionId.localeCompare(right.transactionId)
  );
}
