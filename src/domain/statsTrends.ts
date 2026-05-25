import type { DateRange } from './types';
import {
  getStatsReportRollupById,
  type StatsReport,
  type StatsReportRollup,
  type StatsReportRollupKind,
} from './statsReports';

const DAY_MS = 24 * 60 * 60 * 1000;

export type StatsMonthlyTrendBucket = {
  monthKey: string;
  monthLabel: string;
  incomeGrossMinor: number;
  incomeNetMinor: number;
  spendingGrossMinor: number;
  spendingNetMinor: number;
  linkedSpendingAdjustmentMinor: number;
  netCashFlowMinor: number;
};

export type StatsMonthlyAverages = {
  monthCount: number;
  averageIncomeMinor: number;
  averageSpendingMinor: number;
  averageNetCashFlowMinor: number;
  basisLabel: string;
  note: string;
};

export type StatsGrossNetSpendingSummary = {
  grossSpendingMinor: number;
  linkedAdjustmentMinor: number;
  netSpendingMinor: number;
};

export type StatsMonthlyTrendSummary = {
  buckets: StatsMonthlyTrendBucket[];
  averages: StatsMonthlyAverages;
  grossNetSpending: StatsGrossNetSpendingSummary;
};

export type StatsRollupTrendBucket = {
  monthKey: string;
  monthLabel: string;
  grossAmountMinor: number;
  netAmountMinor: number;
  lineCount: number;
};

export type StatsRollupMonthlyTrend = {
  rollup?: StatsReportRollup;
  buckets: StatsRollupTrendBucket[];
  totalGrossAmountMinor: number;
  totalNetAmountMinor: number;
  averageNetAmountMinor: number;
};

export function getStatsMonthlyTrendSummary({
  incomeReport,
  expenseReport,
  range,
}: {
  incomeReport: StatsReport;
  expenseReport: StatsReport;
  range: DateRange;
}): StatsMonthlyTrendSummary {
  const bucketMap = createMonthlyBucketMap(range);

  for (const row of incomeReport.rows) {
    const bucket = ensureMonthlyBucket(bucketMap, getMonthKey(row.transactionDatetime));
    bucket.incomeGrossMinor += row.grossAmountMinor;
    bucket.incomeNetMinor += row.netAmountMinor;
  }

  for (const row of expenseReport.rows) {
    const bucket = ensureMonthlyBucket(bucketMap, getMonthKey(row.transactionDatetime));
    bucket.spendingGrossMinor += row.grossAmountMinor;
    bucket.spendingNetMinor += row.netAmountMinor;
  }

  const buckets = Array.from(bucketMap.values())
    .map((bucket) => ({
      ...bucket,
      linkedSpendingAdjustmentMinor: Math.max(0, bucket.spendingGrossMinor - bucket.spendingNetMinor),
      netCashFlowMinor: bucket.incomeNetMinor - bucket.spendingNetMinor,
    }))
    .sort((left, right) => left.monthKey.localeCompare(right.monthKey));
  const monthCount = buckets.length;
  const totalIncomeNetMinor = buckets.reduce((sum, bucket) => sum + bucket.incomeNetMinor, 0);
  const totalSpendingGrossMinor = buckets.reduce((sum, bucket) => sum + bucket.spendingGrossMinor, 0);
  const totalSpendingNetMinor = buckets.reduce((sum, bucket) => sum + bucket.spendingNetMinor, 0);
  const totalNetCashFlowMinor = buckets.reduce((sum, bucket) => sum + bucket.netCashFlowMinor, 0);

  return {
    buckets,
    averages: {
      monthCount,
      averageIncomeMinor: averageMinor(totalIncomeNetMinor, monthCount),
      averageSpendingMinor: averageMinor(totalSpendingNetMinor, monthCount),
      averageNetCashFlowMinor: averageMinor(totalNetCashFlowMinor, monthCount),
      basisLabel: monthCount === 1 ? 'Selected month' : `${monthCount} selected months`,
      note: getAverageNote(range),
    },
    grossNetSpending: {
      grossSpendingMinor: totalSpendingGrossMinor,
      linkedAdjustmentMinor: Math.max(0, totalSpendingGrossMinor - totalSpendingNetMinor),
      netSpendingMinor: totalSpendingNetMinor,
    },
  };
}

export function getStatsRollupMonthlyTrend({
  report,
  rollupKind,
  rollupId,
  range,
}: {
  report: StatsReport;
  rollupKind: StatsReportRollupKind;
  rollupId?: string;
  range: DateRange;
}): StatsRollupMonthlyTrend {
  const bucketMap = createRollupBucketMap(range);
  const rollup = getStatsReportRollupById(report, rollupKind, rollupId);

  if (!rollup) {
    return {
      buckets: Array.from(bucketMap.values()),
      totalGrossAmountMinor: 0,
      totalNetAmountMinor: 0,
      averageNetAmountMinor: 0,
    };
  }

  const lineIds = new Set(rollup.lineIds);

  for (const row of report.rows) {
    if (!lineIds.has(row.lineId)) {
      continue;
    }

    const bucket = ensureRollupBucket(bucketMap, getMonthKey(row.transactionDatetime));
    bucket.grossAmountMinor += row.grossAmountMinor;
    bucket.netAmountMinor += row.netAmountMinor;
    bucket.lineCount += 1;
  }

  const buckets = Array.from(bucketMap.values()).sort((left, right) => left.monthKey.localeCompare(right.monthKey));
  const totalGrossAmountMinor = buckets.reduce((sum, bucket) => sum + bucket.grossAmountMinor, 0);
  const totalNetAmountMinor = buckets.reduce((sum, bucket) => sum + bucket.netAmountMinor, 0);

  return {
    rollup,
    buckets,
    totalGrossAmountMinor,
    totalNetAmountMinor,
    averageNetAmountMinor: averageMinor(totalNetAmountMinor, buckets.length),
  };
}

function createMonthlyBucketMap(range: DateRange): Map<string, StatsMonthlyTrendBucket> {
  return new Map(
    getMonthKeysForRange(range).map((monthKey) => [
      monthKey,
      {
        monthKey,
        monthLabel: formatMonthLabel(monthKey),
        incomeGrossMinor: 0,
        incomeNetMinor: 0,
        spendingGrossMinor: 0,
        spendingNetMinor: 0,
        linkedSpendingAdjustmentMinor: 0,
        netCashFlowMinor: 0,
      },
    ]),
  );
}

function createRollupBucketMap(range: DateRange): Map<string, StatsRollupTrendBucket> {
  return new Map(
    getMonthKeysForRange(range).map((monthKey) => [
      monthKey,
      {
        monthKey,
        monthLabel: formatMonthLabel(monthKey),
        grossAmountMinor: 0,
        netAmountMinor: 0,
        lineCount: 0,
      },
    ]),
  );
}

function ensureMonthlyBucket(
  bucketMap: Map<string, StatsMonthlyTrendBucket>,
  monthKey: string,
): StatsMonthlyTrendBucket {
  const existing = bucketMap.get(monthKey);
  if (existing) {
    return existing;
  }

  const bucket: StatsMonthlyTrendBucket = {
    monthKey,
    monthLabel: formatMonthLabel(monthKey),
    incomeGrossMinor: 0,
    incomeNetMinor: 0,
    spendingGrossMinor: 0,
    spendingNetMinor: 0,
    linkedSpendingAdjustmentMinor: 0,
    netCashFlowMinor: 0,
  };
  bucketMap.set(monthKey, bucket);
  return bucket;
}

function ensureRollupBucket(bucketMap: Map<string, StatsRollupTrendBucket>, monthKey: string): StatsRollupTrendBucket {
  const existing = bucketMap.get(monthKey);
  if (existing) {
    return existing;
  }

  const bucket: StatsRollupTrendBucket = {
    monthKey,
    monthLabel: formatMonthLabel(monthKey),
    grossAmountMinor: 0,
    netAmountMinor: 0,
    lineCount: 0,
  };
  bucketMap.set(monthKey, bucket);
  return bucket;
}

function getMonthKeysForRange(range: DateRange): string[] {
  const start = new Date(range.startIso);
  const end = new Date(range.endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return [];
  }

  const keys: string[] = [];
  const cursor = getUtcMonthStart(start);
  const lastMonth = getUtcMonthStart(new Date(end.getTime() - 1));

  while (cursor <= lastMonth) {
    keys.push(formatMonthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return keys;
}

function getMonthKey(iso: string): string {
  return formatMonthKey(new Date(iso));
}

function getUtcMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function formatMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function averageMinor(totalMinor: number, count: number): number {
  return count > 0 ? Math.round(totalMinor / count) : 0;
}

function getAverageNote(range: DateRange): string {
  const start = new Date(range.startIso);
  const end = new Date(range.endIso);
  const durationDays = Math.max(0, (end.getTime() - start.getTime()) / DAY_MS);

  if (durationDays > 0 && durationDays < 28) {
    return 'Short selected period; averages may be noisy.';
  }

  return 'Average across selected calendar months; partial months are included.';
}
