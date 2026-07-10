import {
  getStatsBalanceHistoryAxisLabels,
  getStatsBalanceHistoryChartModel,
  getStatsBalanceHistoryDisplayPoints,
  getStatsBalanceHistoryEventMarkerAtPosition,
  getStatsBalanceHistoryForecastRange,
  getStatsBalanceHistoryPointIndexAtX,
  type StatsBalanceHistoryDisplayPoint,
} from '../statsBalanceHistory';

describe('stats balance history helpers', () => {
  it('does not clamp negative-only chart domains to zero', () => {
    const model = getStatsBalanceHistoryChartModel({
      points: [
        point('2026-05-01', -500),
        point('2026-05-02', -250),
      ],
      selectedPointId: 'history:2026-05-02',
    });

    expect(model?.domainMax).toBeLessThan(0);
    expect(model?.domainMin).toBeLessThan(-500);
    expect(model?.zeroY).toBeUndefined();
    expect(model?.selectedChartPoint?.date).toBe('2026-05-02');
  });

  it('renders flat history with a usable chart model', () => {
    const model = getStatsBalanceHistoryChartModel({
      points: [
        point('2026-05-01', 1000),
        point('2026-05-02', 1000),
      ],
    });

    expect(model?.domainMin).toBeLessThan(1000);
    expect(model?.domainMax).toBeGreaterThan(1000);
    expect(model?.chartPoints).toHaveLength(2);
  });

  it('maps tap positions to the nearest point index', () => {
    expect(getStatsBalanceHistoryPointIndexAtX({ pointCount: 5, width: 320, x: 0 })).toBe(0);
    expect(getStatsBalanceHistoryPointIndexAtX({ pointCount: 5, width: 320, x: 160 })).toBe(2);
    expect(getStatsBalanceHistoryPointIndexAtX({ pointCount: 5, width: 320, x: 999 })).toBe(4);
    expect(getStatsBalanceHistoryPointIndexAtX({ pointCount: 1, width: 320, x: 200 })).toBe(0);
  });

  it('creates sparse axis labels from available points', () => {
    expect(getStatsBalanceHistoryAxisLabels([
      point('2026-05-01', 100),
      point('2026-05-10', 200),
      point('2026-05-18', 300),
    ])).toEqual([
      { align: 'left', date: '2026-05-01', label: 'May 1' },
      { align: 'center', date: '2026-05-10', label: 'May 10' },
      { align: 'right', date: '2026-05-18', label: 'May 18' },
    ]);
  });

  it('derives forecast ranges with the same duration as the active stats range', () => {
    expect(getStatsBalanceHistoryForecastRange({
      now: new Date(2026, 6, 10, 9),
      range: {
        startIso: new Date(2026, 4, 1).toISOString(),
        endIso: new Date(2026, 4, 8).toISOString(),
      },
    })).toEqual({
      startIso: new Date(2026, 6, 10).toISOString(),
      endIso: new Date(2026, 6, 17).toISOString(),
    });
  });

  it('keeps custom forecast range durations without timezone drift', () => {
    expect(getStatsBalanceHistoryForecastRange({
      now: new Date(2026, 6, 10, 23),
      range: {
        startIso: new Date(2026, 5, 2).toISOString(),
        endIso: new Date(2026, 5, 6).toISOString(),
      },
    })).toEqual({
      startIso: new Date(2026, 6, 10).toISOString(),
      endIso: new Date(2026, 6, 14).toISOString(),
    });
  });

  it('defaults history mode to the newest historical point', () => {
    const display = getStatsBalanceHistoryDisplayPoints({
      currentBalanceMinor: 4000,
      forecastEvents: [],
      forecastPoints: [],
      historyPoints: [
        { date: '2026-07-01', balanceMinor: 1000 },
        { date: '2026-07-02', balanceMinor: 2000 },
      ],
      mode: 'history',
      now: new Date(2026, 6, 10),
    });

    expect(display.points.map((item) => item.id)).toEqual([
      'history:2026-07-01',
      'history:2026-07-02',
    ]);
    expect(display.defaultSelectedPointId).toBe('history:2026-07-02');
  });

  it('defaults forecast mode to the first projected point and attaches event metadata', () => {
    const display = getStatsBalanceHistoryDisplayPoints({
      currentBalanceMinor: 4000,
      forecastEvents: [
        {
          date: '2026-07-10',
          netChangeMinor: -500,
          occurrences: [],
          projectedBalanceMinor: 3500,
        },
      ],
      forecastPoints: [
        { date: '2026-07-10', balanceMinor: 3500 },
        { date: '2026-07-11', balanceMinor: 3500 },
      ],
      historyPoints: [],
      mode: 'forecast',
      now: new Date(2026, 6, 10),
    });

    expect(display.points.map((item) => [item.id, item.kind, item.event?.netChangeMinor])).toEqual([
      ['forecast:2026-07-10', 'forecast', -500],
      ['forecast:2026-07-11', 'forecast', undefined],
    ]);
    expect(display.defaultSelectedPointId).toBe('forecast:2026-07-10');
  });

  it('joins combined mode at one current-balance today transition without duplicating today', () => {
    const display = getStatsBalanceHistoryDisplayPoints({
      currentBalanceMinor: 4100,
      forecastEvents: [
        {
          date: '2026-07-10',
          netChangeMinor: -500,
          occurrences: [],
          projectedBalanceMinor: 3600,
        },
      ],
      forecastPoints: [
        { date: '2026-07-10', balanceMinor: 3600 },
        { date: '2026-07-11', balanceMinor: 3600 },
      ],
      historyPoints: [
        { date: '2026-07-09', balanceMinor: 3800 },
        { date: '2026-07-10', balanceMinor: 3900 },
      ],
      mode: 'combined',
      now: new Date(2026, 6, 10),
    });

    expect(display.points.map((item) => [item.id, item.kind, item.date, item.balanceMinor])).toEqual([
      ['history:2026-07-09', 'history', '2026-07-09', 3800],
      ['today:2026-07-10', 'today', '2026-07-10', 4100],
      ['forecast:2026-07-11', 'forecast', '2026-07-11', 3600],
    ]);
    expect(display.defaultSelectedPointId).toBe('today:2026-07-10');
  });

  it('scales combined charts across actual and projected values with a today divider', () => {
    const model = getStatsBalanceHistoryChartModel({
      points: [
        point('2026-07-09', 3000),
        point('2026-07-10', 4000, { id: 'today:2026-07-10', kind: 'today' }),
        point('2026-07-11', -1500, { id: 'forecast:2026-07-11', kind: 'forecast' }),
      ],
      selectedPointId: 'forecast:2026-07-11',
    });

    expect(model?.domainMin).toBeLessThan(-1500);
    expect(model?.domainMax).toBeGreaterThan(4000);
    expect(model?.todayDividerX).toBeDefined();
    expect(model?.historyLinePoints).toContain('160.00');
    expect(model?.forecastLinePoints).toContain('160.00');
    expect(model?.selectedChartPoint?.id).toBe('forecast:2026-07-11');
  });

  it('does not create forecast event markers for pure History points', () => {
    const model = getStatsBalanceHistoryChartModel({
      points: [
        point('2026-07-09', 3000),
        point('2026-07-10', 4000),
      ],
    });

    expect(model?.eventMarkers).toEqual([]);
  });

  it('creates one marker per forecast event day', () => {
    const model = getStatsBalanceHistoryChartModel({
      points: [
        point('2026-07-10', 4000, {
          event: forecastEvent({
            date: '2026-07-10',
            netChangeMinor: -500,
            projectedBalanceMinor: 3500,
          }),
          id: 'forecast:2026-07-10',
          kind: 'forecast',
        }),
        point('2026-07-11', 3500, {
          event: forecastEvent({
            date: '2026-07-11',
            netChangeMinor: 1000,
            projectedBalanceMinor: 4500,
          }),
          id: 'forecast:2026-07-11',
          kind: 'forecast',
        }),
      ],
    });

    expect(model?.eventMarkers.map((marker) => marker.event.date)).toEqual([
      '2026-07-10',
      '2026-07-11',
    ]);
  });

  it('hit-tests forecast event markers with a larger interaction target', () => {
    const model = getStatsBalanceHistoryChartModel({
      points: [
        point('2026-07-10', 4000),
        point('2026-07-11', 3500, {
          event: forecastEvent({
            date: '2026-07-11',
            netChangeMinor: -500,
            projectedBalanceMinor: 3500,
          }),
          id: 'forecast:2026-07-11',
          kind: 'forecast',
        }),
      ],
    });
    const marker = model?.eventMarkers[0];

    expect(marker).toBeDefined();
    expect(getStatsBalanceHistoryEventMarkerAtPosition({
      chartWidth: 320,
      markers: model?.eventMarkers ?? [],
      x: marker?.point.x ?? 0,
      y: marker?.point.y ?? 0,
    })?.point.id).toBe('forecast:2026-07-11');
    expect(getStatsBalanceHistoryEventMarkerAtPosition({
      chartWidth: 320,
      markers: model?.eventMarkers ?? [],
      x: 0,
      y: 0,
    })).toBeUndefined();
  });

  it('renders negative projected forecast event markers without clamping', () => {
    const model = getStatsBalanceHistoryChartModel({
      points: [
        point('2026-07-10', 500, {
          id: 'forecast:2026-07-10',
          kind: 'forecast',
        }),
        point('2026-07-11', -1500, {
          event: forecastEvent({
            date: '2026-07-11',
            netChangeMinor: -2000,
            projectedBalanceMinor: -1500,
          }),
          id: 'forecast:2026-07-11',
          kind: 'forecast',
        }),
      ],
    });

    expect(model?.domainMin).toBeLessThan(-1500);
    expect(model?.zeroY).toBeDefined();
    expect(model?.eventMarkers[0].point.y).toBeGreaterThan(0);
  });
});

function point(
  date: string,
  balanceMinor: number,
  overrides: Partial<StatsBalanceHistoryDisplayPoint> = {},
): StatsBalanceHistoryDisplayPoint {
  return {
    date,
    balanceMinor,
    id: `history:${date}`,
    kind: 'history',
    ...overrides,
  };
}

function forecastEvent(
  overrides: Partial<NonNullable<StatsBalanceHistoryDisplayPoint['event']>> = {},
): NonNullable<StatsBalanceHistoryDisplayPoint['event']> {
  return {
    date: '2026-07-10',
    netChangeMinor: -1000,
    occurrences: [],
    projectedBalanceMinor: 1000,
    ...overrides,
  };
}
