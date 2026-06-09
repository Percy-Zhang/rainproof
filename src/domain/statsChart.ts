import {
  getRecentStatsReportRollupRows,
  isStatsReportRowVisible,
  sortStatsReportRows,
  type StatsReport,
  type StatsReportLineRow,
  type StatsReportRollup,
} from './statsReports';

export type StatsDonutMode = 'category' | 'subcategory';

export type StatsDonutViewModel = {
  mode: StatsDonutMode;
  rollups: StatsReportRollup[];
  selectedCategoryRollup?: StatsReportRollup;
  selectedRollup?: StatsReportRollup;
  recentRows: StatsReportLineRow[];
  totalNetAmountMinor: number;
  canShowDetailedView: boolean;
  emptyLabel: string;
};

export function getStatsDonutViewModel({
  report,
  mode,
  selectedCategoryRollupId,
  selectedSubcategoryRollupId,
  recentLimit = 5,
}: {
  report: StatsReport;
  mode: StatsDonutMode;
  selectedCategoryRollupId?: string | null;
  selectedSubcategoryRollupId?: string | null;
  recentLimit?: number;
}): StatsDonutViewModel {
  const categoryRollups = report.categoryRollups.filter(isStatsReportRollupVisible);
  const selectedCategoryRollup = getSelectedCategoryRollup(categoryRollups, selectedCategoryRollupId);

  if (mode === 'subcategory') {
    const subcategoryRollups = selectedCategoryRollup
      ? getSubcategoryRollupsForCategory(report, selectedCategoryRollup)
      : [];
    const selectedRollup =
      selectedSubcategoryRollupId === null
        ? undefined
        : subcategoryRollups.find((rollup) => rollup.id === selectedSubcategoryRollupId) ?? subcategoryRollups[0];

    return {
      mode,
      rollups: subcategoryRollups,
      selectedCategoryRollup,
      selectedRollup,
      recentRows: selectedRollup
        ? getRecentStatsReportRollupRows({
            report,
            rollupKind: 'subcategory',
            rollupId: selectedRollup.id,
            limit: recentLimit,
          })
        : selectedCategoryRollup && subcategoryRollups.length
          ? getRecentStatsReportRows({
              report,
              categoryId: selectedCategoryRollup.categoryId,
              limit: recentLimit,
            })
          : [],
      totalNetAmountMinor: getRollupTotalNetAmountMinor(subcategoryRollups),
      canShowDetailedView: false,
      emptyLabel: selectedCategoryRollup
        ? `No subcategory spending for ${selectedCategoryRollup.label}.`
        : 'No spending in this period.',
    };
  }

  return {
    mode,
    rollups: categoryRollups,
    selectedCategoryRollup,
    selectedRollup: selectedCategoryRollup,
    recentRows: selectedCategoryRollup
      ? getRecentStatsReportRollupRows({
          report,
          rollupKind: 'category',
          rollupId: selectedCategoryRollup.id,
          limit: recentLimit,
        })
      : getRecentStatsReportRows({
          report,
          limit: recentLimit,
        }),
    totalNetAmountMinor: report.totalNetAmountMinor,
    canShowDetailedView: selectedCategoryRollup
      ? getSubcategoryRollupsForCategory(report, selectedCategoryRollup).length > 0
      : false,
    emptyLabel: 'No spending in this period.',
  };
}

export function getNextStatsDonutSelectionId(
  selectedRollupId: string | undefined,
  pressedRollupId: string,
): string | null {
  return selectedRollupId === pressedRollupId ? null : pressedRollupId;
}

export function getSubcategoryRollupsForCategory(
  report: StatsReport,
  categoryRollup: StatsReportRollup,
): StatsReportRollup[] {
  return report.subcategoryRollups
    .filter((rollup) => rollup.categoryId === categoryRollup.categoryId && isStatsReportRollupVisible(rollup))
    .map((rollup) => ({
      ...rollup,
      percentage: categoryRollup.netAmountMinor > 0
        ? (rollup.netAmountMinor / categoryRollup.netAmountMinor) * 100
        : 0,
    }))
    .sort(compareRollups);
}

export function getStatsMatchRowDetailText(row: StatsReportLineRow): string {
  const categoryDetail = row.isSplitTransaction ? `Split line - ${row.subcategoryName}` : row.subcategoryName;
  return row.lineNote ? `${categoryDetail} - ${row.lineNote}` : categoryDetail;
}

function getSelectedCategoryRollup(
  categoryRollups: StatsReportRollup[],
  selectedCategoryRollupId?: string | null,
): StatsReportRollup | undefined {
  if (selectedCategoryRollupId === null) {
    return undefined;
  }

  return categoryRollups.find((rollup) => rollup.id === selectedCategoryRollupId) ?? categoryRollups[0];
}

function getRecentStatsReportRows({
  report,
  categoryId,
  limit,
}: {
  report: StatsReport;
  categoryId?: string;
  limit: number;
}): StatsReportLineRow[] {
  const rows = categoryId
    ? report.rows.filter((row) => row.categoryId === categoryId)
    : report.rows;

  return sortStatsReportRows(rows.filter(isStatsReportRowVisible), 'date_newest').slice(0, limit);
}

function isStatsReportRollupVisible(rollup: StatsReportRollup): boolean {
  return rollup.reportKind !== 'expense' || rollup.netAmountMinor > 0;
}

function getRollupTotalNetAmountMinor(rollups: StatsReportRollup[]): number {
  return rollups.reduce((sum, rollup) => sum + rollup.netAmountMinor, 0);
}

function compareRollups(left: StatsReportRollup, right: StatsReportRollup): number {
  return (
    right.netAmountMinor - left.netAmountMinor ||
    right.grossAmountMinor - left.grossAmountMinor ||
    left.label.localeCompare(right.label) ||
    left.id.localeCompare(right.id)
  );
}
