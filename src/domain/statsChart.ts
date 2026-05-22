import {
  getRecentStatsReportRollupRows,
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
  selectedCategoryRollupId?: string;
  selectedSubcategoryRollupId?: string;
  recentLimit?: number;
}): StatsDonutViewModel {
  const selectedCategoryRollup = getSelectedCategoryRollup(report, selectedCategoryRollupId);

  if (mode === 'subcategory') {
    const subcategoryRollups = selectedCategoryRollup
      ? getSubcategoryRollupsForCategory(report, selectedCategoryRollup)
      : [];
    const selectedRollup =
      subcategoryRollups.find((rollup) => rollup.id === selectedSubcategoryRollupId) ?? subcategoryRollups[0];

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
        : [],
      canShowDetailedView: false,
      emptyLabel: selectedCategoryRollup
        ? `No subcategory spending for ${selectedCategoryRollup.label}.`
        : 'No spending in this period.',
    };
  }

  return {
    mode,
    rollups: report.categoryRollups,
    selectedCategoryRollup,
    selectedRollup: selectedCategoryRollup,
    recentRows: selectedCategoryRollup
      ? getRecentStatsReportRollupRows({
          report,
          rollupKind: 'category',
          rollupId: selectedCategoryRollup.id,
          limit: recentLimit,
        })
      : [],
    canShowDetailedView: selectedCategoryRollup
      ? getSubcategoryRollupsForCategory(report, selectedCategoryRollup).length > 0
      : false,
    emptyLabel: 'No spending in this period.',
  };
}

export function getSubcategoryRollupsForCategory(
  report: StatsReport,
  categoryRollup: StatsReportRollup,
): StatsReportRollup[] {
  return report.subcategoryRollups
    .filter((rollup) => rollup.categoryId === categoryRollup.categoryId)
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
  report: StatsReport,
  selectedCategoryRollupId?: string,
): StatsReportRollup | undefined {
  return report.categoryRollups.find((rollup) => rollup.id === selectedCategoryRollupId) ?? report.categoryRollups[0];
}

function compareRollups(left: StatsReportRollup, right: StatsReportRollup): number {
  return (
    right.netAmountMinor - left.netAmountMinor ||
    right.grossAmountMinor - left.grossAmountMinor ||
    left.label.localeCompare(right.label) ||
    left.id.localeCompare(right.id)
  );
}
