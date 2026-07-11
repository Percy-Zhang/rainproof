import type { BalanceHistoryPoint } from '../../domain/balanceHistory';
import type { ForecastBalancePoint, ForecastDayEvent } from '../../domain/forecastBalance';
import type { DateRange } from '../../domain/types';
import {
  getHorizontalPlotGeometry,
  getHorizontalPlotX,
  getNearestHorizontalPlotPointIndex,
} from '../chartPlotGeometry';

export type StatsBalanceHistoryMode = 'history' | 'combined' | 'forecast';

export type StatsBalanceHistoryPointKind = 'history' | 'today' | 'forecast';

export type StatsBalanceHistoryDisplayPoint = BalanceHistoryPoint & {
  event?: ForecastDayEvent;
  id: string;
  kind: StatsBalanceHistoryPointKind;
};

export type StatsBalanceHistoryChartPoint = BalanceHistoryPoint & {
  event?: ForecastDayEvent;
  id?: string;
  kind?: StatsBalanceHistoryPointKind;
  x: number;
  y: number;
};

export type StatsBalanceHistoryEventMarker = {
  event: ForecastDayEvent;
  point: StatsBalanceHistoryChartPoint;
};

export type StatsBalanceHistoryChartModel = {
  areaPath: string;
  chartPoints: StatsBalanceHistoryChartPoint[];
  domainMax: number;
  domainMin: number;
  eventMarkers: StatsBalanceHistoryEventMarker[];
  forecastLinePoints: string;
  historyLinePoints: string;
  linePoints: string;
  selectedChartPoint?: StatsBalanceHistoryChartPoint;
  todayDividerX?: number;
  zeroY?: number;
};

export const STATS_BALANCE_HISTORY_CHART_WIDTH = 320;
export const STATS_BALANCE_HISTORY_CHART_HEIGHT = 136;

const chartPaddingTop = 8;
const chartPaddingBottom = 12;

export function getStatsBalanceHistoryForecastRange({
  now = new Date(),
  range,
}: {
  now?: Date;
  range: DateRange;
}): DateRange {
  const rangeStart = startOfLocalDay(new Date(range.startIso));
  const rangeEnd = startOfLocalDay(new Date(range.endIso));
  const durationDays = Math.max(1, countLocalDays(rangeStart, rangeEnd));
  const forecastStart = startOfLocalDay(now);
  const forecastEnd = addLocalDays(forecastStart, durationDays);

  return {
    startIso: forecastStart.toISOString(),
    endIso: forecastEnd.toISOString(),
  };
}

export function getStatsBalanceHistoryDisplayPoints({
  currentBalanceMinor,
  forecastEvents,
  forecastPoints,
  historyPoints,
  mode,
  now = new Date(),
}: {
  currentBalanceMinor: number;
  forecastEvents: ForecastDayEvent[];
  forecastPoints: ForecastBalancePoint[];
  historyPoints: BalanceHistoryPoint[];
  mode: StatsBalanceHistoryMode;
  now?: Date;
}): {
  defaultSelectedPointId: string;
  points: StatsBalanceHistoryDisplayPoint[];
  todayDate: string;
} {
  const todayDate = formatDateOnly(startOfLocalDay(now));
  const forecastEventByDate = new Map(forecastEvents.map((event) => [event.date, event]));

  if (mode === 'forecast') {
    const points = forecastPoints.map((point) => ({
      ...point,
      event: forecastEventByDate.get(point.date),
      id: `forecast:${point.date}`,
      kind: 'forecast' as const,
    }));

    return {
      defaultSelectedPointId: points[0]?.id ?? '',
      points,
      todayDate,
    };
  }

  if (mode === 'history') {
    const points = historyPoints.map((point) => ({
      ...point,
      id: `history:${point.date}`,
      kind: 'history' as const,
    }));

    return {
      defaultSelectedPointId: points.at(-1)?.id ?? '',
      points,
      todayDate,
    };
  }

  const historyPointsBeforeToday = historyPoints
    .filter((point) => point.date < todayDate)
    .map((point) => ({
      ...point,
      id: `history:${point.date}`,
      kind: 'history' as const,
    }));
  const transitionPoint: StatsBalanceHistoryDisplayPoint = {
    balanceMinor: currentBalanceMinor,
    date: todayDate,
    id: `today:${todayDate}`,
    kind: 'today',
  };
  const futurePoints = forecastPoints
    .filter((point) => point.date > todayDate)
    .map((point) => ({
      ...point,
      event: forecastEventByDate.get(point.date),
      id: `forecast:${point.date}`,
      kind: 'forecast' as const,
    }));
  const points = [
    ...historyPointsBeforeToday,
    transitionPoint,
    ...futurePoints,
  ];

  return {
    defaultSelectedPointId: transitionPoint.id,
    points,
    todayDate,
  };
}

export function getStatsBalanceHistoryChartModel({
  points,
  selectedPointId,
  width = STATS_BALANCE_HISTORY_CHART_WIDTH,
  height = STATS_BALANCE_HISTORY_CHART_HEIGHT,
}: {
  points: StatsBalanceHistoryDisplayPoint[];
  selectedPointId?: string;
  width?: number;
  height?: number;
}): StatsBalanceHistoryChartModel | null {
  if (!points.length) {
    return null;
  }

  const balances = points.map((point) => point.balanceMinor);
  const rawMin = Math.min(...balances);
  const rawMax = Math.max(...balances);
  const rawSpan = rawMax - rawMin;
  const padding = rawSpan > 0 ? Math.max(1, Math.round(rawSpan * 0.08)) : Math.max(1, Math.round(Math.abs(rawMax) * 0.05));
  const domainMin = rawSpan === 0 ? rawMin - padding : rawMin - padding;
  const domainMax = rawSpan === 0 ? rawMax + padding : rawMax + padding;
  const domainSpan = Math.max(1, domainMax - domainMin);
  const usableHeight = Math.max(1, height - chartPaddingTop - chartPaddingBottom);
  const plotGeometry = getHorizontalPlotGeometry(width);
  const chartPoints = points.map((point, index) => {
    const x = getHorizontalPlotX(index, points.length, plotGeometry);
    const y = chartPaddingTop + ((domainMax - point.balanceMinor) / domainSpan) * usableHeight;

    return { ...point, x, y };
  });
  const linePoints = chartPoints.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
  const selectedChartPoint =
    chartPoints.find((point) => point.id === selectedPointId) ?? chartPoints.at(-1);
  const historyChartPoints = chartPoints.filter((point) => point.kind !== 'forecast');
  const forecastChartPoints = chartPoints.filter((point) => point.kind !== 'history');
  const eventMarkers = chartPoints
    .filter((point) => point.kind === 'forecast' && point.event)
    .map((point) => ({
      event: point.event as ForecastDayEvent,
      point,
    }));
  const areaPath = getAreaPath(historyChartPoints, height);
  const historyLinePoints = getPolylinePoints(historyChartPoints);
  const forecastLinePoints = getPolylinePoints(forecastChartPoints);
  const todayDividerX = chartPoints.find((point) => point.kind === 'today')?.x;
  const zeroY = domainMin < 0 && domainMax > 0
    ? chartPaddingTop + ((domainMax - 0) / domainSpan) * usableHeight
    : undefined;

  return {
    areaPath,
    chartPoints,
    domainMax,
    domainMin,
    eventMarkers,
    forecastLinePoints,
    historyLinePoints,
    linePoints,
    selectedChartPoint,
    todayDividerX,
    zeroY,
  };
}

export function getStatsBalanceHistoryEventMarkerAtPosition({
  chartHeight = STATS_BALANCE_HISTORY_CHART_HEIGHT,
  chartWidth,
  hitRadius = 18,
  markers,
  x,
  y,
}: {
  chartHeight?: number;
  chartWidth: number;
  hitRadius?: number;
  markers: StatsBalanceHistoryEventMarker[];
  x: number;
  y: number;
}): StatsBalanceHistoryEventMarker | undefined {
  if (!markers.length) {
    return undefined;
  }

  const plotGeometry = getHorizontalPlotGeometry(chartWidth);
  const safeChartHeight = Math.max(1, chartHeight);
  const viewBoxX = Math.max(plotGeometry.left, Math.min(plotGeometry.right, x));
  const viewBoxY = (Math.max(0, Math.min(safeChartHeight, y)) / safeChartHeight) *
    STATS_BALANCE_HISTORY_CHART_HEIGHT;
  const hitRadiusSquared = hitRadius * hitRadius;
  let nearestMarker: StatsBalanceHistoryEventMarker | undefined;
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const marker of markers) {
    const deltaX = marker.point.x - viewBoxX;
    const deltaY = marker.point.y - viewBoxY;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;

    if (distanceSquared <= hitRadiusSquared && distanceSquared < nearestDistanceSquared) {
      nearestMarker = marker;
      nearestDistanceSquared = distanceSquared;
    }
  }

  return nearestMarker;
}

export function getStatsBalanceHistoryAxisLabels(points: StatsBalanceHistoryDisplayPoint[]): {
  align: 'left' | 'center' | 'right';
  date: string;
  label: string;
}[] {
  if (!points.length) {
    return [];
  }

  const lastIndex = points.length - 1;
  const indexes = Array.from(new Set([0, Math.floor(lastIndex / 2), lastIndex]));

  return indexes.map((index) => ({
    align: index === 0 ? 'left' : index === lastIndex ? 'right' : 'center',
    date: points[index].date,
    label: formatShortAxisDate(points[index].date),
  }));
}

export function getStatsBalanceHistoryPointIndexAtX({
  pointCount,
  width,
  x,
}: {
  pointCount: number;
  width: number;
  x: number;
}): number {
  if (pointCount <= 1) {
    return 0;
  }

  return getNearestHorizontalPlotPointIndex({
    geometry: getHorizontalPlotGeometry(width),
    pointCount,
    x,
  });
}

function formatShortAxisDate(dateValue: string): string {
  const [year, month, day] = dateValue.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(year, month - 1, day, 12));
}

function getPolylinePoints(points: StatsBalanceHistoryChartPoint[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

function getAreaPath(points: StatsBalanceHistoryChartPoint[], height: number): string {
  if (!points.length) {
    return '';
  }

  return [
    `M ${points[0].x.toFixed(2)} ${height}`,
    ...points.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`),
    `L ${points[points.length - 1].x.toFixed(2)} ${height}`,
    'Z',
  ].join(' ');
}

function countLocalDays(start: Date, endExclusive: Date): number {
  if (Number.isNaN(start.getTime()) || Number.isNaN(endExclusive.getTime()) || endExclusive <= start) {
    return 0;
  }

  let count = 0;
  for (let day = start; day < endExclusive && count < 3660; day = addLocalDays(day, 1)) {
    count += 1;
  }

  return count;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateOnly(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
