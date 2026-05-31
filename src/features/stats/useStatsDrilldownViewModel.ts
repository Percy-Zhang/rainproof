import { useMemo, useState } from 'react';

import { getCategory, getSubcategoryName } from '../../domain/categories';
import {
  getStatsDrilldownData,
  type StatsDrilldownDisplayMode,
} from '../../domain/statsDrilldown';
import { getStatsReport, type StatsReportSort } from '../../domain/statsReports';
import type { AppSnapshot } from '../../domain/types';
import type { RootStackParamList } from '../../navigation/routes';

type StatsDrilldownParams = RootStackParamList['StatsDrilldown'];

export function useStatsDrilldownViewModel({
  params,
  snapshot,
}: {
  params: StatsDrilldownParams;
  snapshot: AppSnapshot;
}) {
  const [displayMode, setDisplayMode] = useState<StatsDrilldownDisplayMode>('parent');
  const [sort, setSort] = useState<StatsReportSort>(params.initialSort ?? 'date_newest');
  const report = useMemo(() => getStatsReport({
    reportKind: params.reportKind,
    transactions: snapshot.transactions,
    transactionLines: snapshot.transactionLines,
    transactionLinks: snapshot.transactionLinks,
    accounts: snapshot.accounts,
    categories: snapshot.categories,
    range: {
      startIso: params.startIso,
      endIso: params.endIso,
    },
    currencyCode: params.currencyCode,
    accountIds: params.accountIds,
  }), [
    params.accountIds,
    params.currencyCode,
    params.endIso,
    params.reportKind,
    params.startIso,
    snapshot.accounts,
    snapshot.categories,
    snapshot.transactionLines,
    snapshot.transactionLinks,
    snapshot.transactions,
  ]);
  const drilldown = useMemo(() => getStatsDrilldownData({
    report,
    categoryId: params.categoryId,
    subcategoryId: params.subcategoryId,
    sort,
  }), [params.categoryId, params.subcategoryId, report, sort]);
  const category = getCategory(params.categoryId, snapshot.categories);
  const title = params.subcategoryId
    ? getSubcategoryName(params.categoryId, params.subcategoryId, snapshot.categories)
    : category.name;
  const rowsShown = displayMode === 'parent' ? drilldown.parentRows.length : drilldown.lineRows.length;
  const totalNetMinor = drilldown.lineRows.reduce((sum, row) => sum + row.netAmountMinor, 0);

  return {
    displayMode,
    drilldown,
    rowsShown,
    setDisplayMode,
    setSort,
    sort,
    title,
    totalNetMinor,
  };
}
