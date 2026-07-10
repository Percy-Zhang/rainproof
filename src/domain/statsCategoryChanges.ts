import type { StatsReport, StatsReportRollup } from './statsReports';

export type StatsCategoryChangeDirection = 'increase' | 'decrease' | 'unchanged';

export type StatsCategoryChangeRow = {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  currentMinor: number;
  previousMinor: number;
  changeMinor: number;
  percentageChange: number | null;
  direction: StatsCategoryChangeDirection;
};

export function getStatsCategoryChanges({
  currentReport,
  previousReport,
}: {
  currentReport: StatsReport;
  previousReport: StatsReport;
}): StatsCategoryChangeRow[] {
  const currentByCategoryId = getRollupsByCategoryId(currentReport.categoryRollups);
  const previousByCategoryId = getRollupsByCategoryId(previousReport.categoryRollups);
  const categoryIds = new Set([...currentByCategoryId.keys(), ...previousByCategoryId.keys()]);
  const rows: StatsCategoryChangeRow[] = [];

  for (const categoryId of categoryIds) {
    const current = currentByCategoryId.get(categoryId);
    const previous = previousByCategoryId.get(categoryId);
    const currentMinor = current?.netAmountMinor ?? 0;
    const previousMinor = previous?.netAmountMinor ?? 0;

    if (currentMinor === 0 && previousMinor === 0) {
      continue;
    }

    const changeMinor = currentMinor - previousMinor;
    const rollup = current ?? previous;
    if (!rollup) {
      continue;
    }

    rows.push({
      categoryId,
      categoryName: rollup.label,
      categoryColor: rollup.color,
      categoryIcon: rollup.icon,
      currentMinor,
      previousMinor,
      changeMinor,
      percentageChange: previousMinor === 0 ? null : (changeMinor / previousMinor) * 100,
      direction: changeMinor > 0 ? 'increase' : changeMinor < 0 ? 'decrease' : 'unchanged',
    });
  }

  return rows.sort(compareCategoryChangeRows);
}

function getRollupsByCategoryId(rollups: StatsReportRollup[]): Map<string, StatsReportRollup> {
  return new Map(rollups.map((rollup) => [rollup.categoryId, rollup]));
}

function compareCategoryChangeRows(left: StatsCategoryChangeRow, right: StatsCategoryChangeRow): number {
  return (
    Math.abs(right.changeMinor) - Math.abs(left.changeMinor) ||
    left.categoryName.localeCompare(right.categoryName, undefined, { sensitivity: 'base' }) ||
    left.categoryId.localeCompare(right.categoryId)
  );
}
