import {
  getNextStatsDonutSelectionId,
  getStatsMatchRowDetailText,
  getStatsDonutViewModel,
  getSubcategoryRollupsForCategory,
} from '../statsChart';
import type { StatsReport, StatsReportLineRow, StatsReportRollup } from '../statsReports';

function row(overrides: Partial<StatsReportLineRow>): StatsReportLineRow {
  return {
    reportKind: 'expense',
    transactionId: 'tx',
    transactionDatetime: '2026-05-20T10:00:00.000Z',
    transactionTitle: 'Woolworths',
    accountId: 'acct',
    accountName: 'Everyday',
    lineId: 'line',
    lineAmountMinor: -1000,
    grossAmountMinor: 1000,
    netAmountMinor: 1000,
    currencyCode: 'AUD',
    categoryId: 'food',
    categoryName: 'Food & Dining',
    categoryIcon: 'restaurant-outline',
    categoryColor: '#C45A16',
    subcategoryId: 'groceries',
    subcategoryName: 'Groceries',
    subcategoryIcon: 'basket-outline',
    subcategoryColor: '#C45A16',
    lineNote: '',
    lineItemName: 'Woolworths',
    isSplitTransaction: false,
    lineSortOrder: 0,
    ...overrides,
  };
}

function rollup(overrides: Partial<StatsReportRollup> = {}): StatsReportRollup {
  return {
    id: 'category:food',
    reportKind: 'expense',
    kind: 'category',
    categoryId: 'food',
    label: 'Food & Dining',
    icon: 'restaurant-outline',
    color: '#C45A16',
    grossAmountMinor: 7000,
    netAmountMinor: 7000,
    lineCount: 2,
    percentage: 70,
    lineIds: ['groceries-line', 'restaurants-line'],
    ...overrides,
  };
}

function report(): StatsReport {
  return {
    reportKind: 'expense',
    currencyCode: 'AUD',
    rows: [
      row({
        lineId: 'groceries-line',
        transactionId: 'newer-food',
        transactionDatetime: '2026-05-20T10:00:00.000Z',
        subcategoryId: 'groceries',
        subcategoryName: 'Groceries',
        netAmountMinor: 5000,
        grossAmountMinor: 5000,
      }),
      row({
        lineId: 'restaurants-line',
        transactionId: 'older-food',
        transactionDatetime: '2026-05-18T10:00:00.000Z',
        subcategoryId: 'restaurants',
        subcategoryName: 'Restaurants',
        netAmountMinor: 2000,
        grossAmountMinor: 2000,
      }),
      row({
        lineId: 'rent-line',
        transactionId: 'rent',
        transactionDatetime: '2026-05-19T10:00:00.000Z',
        categoryId: 'housing',
        categoryName: 'Housing',
        subcategoryId: 'rent',
        subcategoryName: 'Rent',
        netAmountMinor: 3000,
        grossAmountMinor: 3000,
      }),
    ],
    categoryRollups: [
      rollup(),
      rollup({
        id: 'category:housing',
        categoryId: 'housing',
        label: 'Housing',
        netAmountMinor: 3000,
        grossAmountMinor: 3000,
        percentage: 30,
        lineIds: ['rent-line'],
      }),
    ],
    subcategoryRollups: [
      rollup({
        id: 'subcategory:food:groceries',
        kind: 'subcategory',
        subcategoryId: 'groceries',
        label: 'Groceries',
        netAmountMinor: 5000,
        grossAmountMinor: 5000,
        percentage: 50,
        lineIds: ['groceries-line'],
      }),
      rollup({
        id: 'subcategory:food:restaurants',
        kind: 'subcategory',
        subcategoryId: 'restaurants',
        label: 'Restaurants',
        netAmountMinor: 2000,
        grossAmountMinor: 2000,
        percentage: 20,
        lineIds: ['restaurants-line'],
      }),
      rollup({
        id: 'subcategory:housing:rent',
        kind: 'subcategory',
        categoryId: 'housing',
        subcategoryId: 'rent',
        label: 'Rent',
        netAmountMinor: 3000,
        grossAmountMinor: 3000,
        percentage: 30,
        lineIds: ['rent-line'],
      }),
    ],
    totalGrossAmountMinor: 10000,
    totalNetAmountMinor: 10000,
  };
}

describe('stats chart helpers', () => {
  it('selects the largest category by default and returns matching recent rows', () => {
    const view = getStatsDonutViewModel({ report: report(), mode: 'category' });

    expect(view.rollups.map((item) => item.id)).toEqual(['category:food', 'category:housing']);
    expect(view.selectedRollup?.id).toBe('category:food');
    expect(view.recentRows.map((item) => item.lineId)).toEqual(['groceries-line', 'restaurants-line']);
  });

  it('selects a tapped category rollup', () => {
    const view = getStatsDonutViewModel({
      report: report(),
      mode: 'category',
      selectedCategoryRollupId: 'category:housing',
    });

    expect(view.selectedRollup?.id).toBe('category:housing');
    expect(view.recentRows.map((item) => item.lineId)).toEqual(['rent-line']);
  });

  it('supports an explicit no-selection state with total recent spending rows', () => {
    const view = getStatsDonutViewModel({
      report: report(),
      mode: 'category',
      selectedCategoryRollupId: null,
    });

    expect(view.selectedRollup).toBeUndefined();
    expect(view.canShowDetailedView).toBe(false);
    expect(view.totalNetAmountMinor).toBe(10000);
    expect(view.recentRows.map((item) => item.lineId)).toEqual([
      'groceries-line',
      'rent-line',
      'restaurants-line',
    ]);
  });

  it('omits zero-effective spending rollups and recent rows', () => {
    const sourceReport = report();
    sourceReport.rows.push(
      row({
        lineId: 'offset-line',
        transactionId: 'offset-expense',
        transactionDatetime: '2026-05-21T10:00:00.000Z',
        categoryId: 'other',
        categoryName: 'Other',
        grossAmountMinor: 1500,
        netAmountMinor: 0,
      }),
    );
    sourceReport.categoryRollups.push(
      rollup({
        id: 'category:other',
        categoryId: 'other',
        label: 'Other',
        grossAmountMinor: 1500,
        netAmountMinor: 0,
        percentage: 0,
        lineCount: 1,
        lineIds: ['offset-line'],
      }),
    );

    const view = getStatsDonutViewModel({
      report: sourceReport,
      mode: 'category',
      selectedCategoryRollupId: null,
    });

    expect(view.rollups.map((item) => item.id)).toEqual(['category:food', 'category:housing']);
    expect(view.recentRows.map((item) => item.lineId)).not.toContain('offset-line');
    expect(view.totalNetAmountMinor).toBe(10000);
  });

  it('converts a selected category to subcategory slices with relative percentages', () => {
    const sourceReport = report();
    const categoryRollup = sourceReport.categoryRollups[0];
    const subcategoryRollups = getSubcategoryRollupsForCategory(sourceReport, categoryRollup);

    expect(subcategoryRollups.map((item) => [item.id, item.netAmountMinor])).toEqual([
      ['subcategory:food:groceries', 5000],
      ['subcategory:food:restaurants', 2000],
    ]);
    expect(subcategoryRollups[0].percentage).toBeCloseTo(71.428, 2);
    expect(subcategoryRollups[1].percentage).toBeCloseTo(28.571, 2);
  });

  it('uses selected subcategory rows in detailed view', () => {
    const view = getStatsDonutViewModel({
      report: report(),
      mode: 'subcategory',
      selectedCategoryRollupId: 'category:food',
      selectedSubcategoryRollupId: 'subcategory:food:restaurants',
    });

    expect(view.rollups.map((item) => item.id)).toEqual(['subcategory:food:groceries', 'subcategory:food:restaurants']);
    expect(view.selectedCategoryRollup?.id).toBe('category:food');
    expect(view.selectedRollup?.id).toBe('subcategory:food:restaurants');
    expect(view.recentRows.map((item) => item.lineId)).toEqual(['restaurants-line']);
  });

  it('uses selected category rows when subcategory detail has no selected slice', () => {
    const view = getStatsDonutViewModel({
      report: report(),
      mode: 'subcategory',
      selectedCategoryRollupId: 'category:food',
      selectedSubcategoryRollupId: null,
    });

    expect(view.selectedRollup).toBeUndefined();
    expect(view.totalNetAmountMinor).toBe(7000);
    expect(view.recentRows.map((item) => item.lineId)).toEqual(['groceries-line', 'restaurants-line']);
  });

  it('returns category slices again when mode returns to category', () => {
    const view = getStatsDonutViewModel({
      report: report(),
      mode: 'category',
      selectedCategoryRollupId: 'category:food',
      selectedSubcategoryRollupId: 'subcategory:food:restaurants',
    });

    expect(view.rollups.map((item) => item.id)).toEqual(['category:food', 'category:housing']);
    expect(view.selectedRollup?.id).toBe('category:food');
  });

  it('handles detailed view safely when a category has no subcategory rollups', () => {
    const flatReport = {
      ...report(),
      subcategoryRollups: [],
    };
    const view = getStatsDonutViewModel({
      report: flatReport,
      mode: 'subcategory',
      selectedCategoryRollupId: 'category:food',
    });

    expect(view.rollups).toEqual([]);
    expect(view.selectedRollup).toBeUndefined();
    expect(view.recentRows).toEqual([]);
    expect(view.emptyLabel).toBe('No subcategory spending for Food & Dining.');
  });

  it('omits redundant expense labeling from spending match row details', () => {
    expect(
      getStatsMatchRowDetailText(
        row({
          reportKind: 'expense',
          subcategoryName: 'Groceries',
          lineNote: 'Weekly food shop',
          isSplitTransaction: true,
        }),
      ),
    ).toBe('Split line - Groceries - Weekly food shop');
    expect(
      getStatsMatchRowDetailText(
        row({
          reportKind: 'expense',
          subcategoryName: 'Restaurants',
          lineNote: '',
          isSplitTransaction: false,
        }),
      ),
    ).toBe('Restaurants');
  });

  it('toggles the current donut selection off when the selected slice is pressed again', () => {
    expect(getNextStatsDonutSelectionId('category:food', 'category:food')).toBeNull();
    expect(getNextStatsDonutSelectionId('category:food', 'category:housing')).toBe('category:housing');
    expect(getNextStatsDonutSelectionId(undefined, 'category:food')).toBe('category:food');
  });
});
