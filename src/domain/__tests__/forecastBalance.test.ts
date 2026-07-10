import { getInclusiveDateRange } from '../dates';
import { getForecastBalanceProjection } from '../forecastBalance';
import type { UpcomingPaymentForecastOccurrence } from '../upcomingPaymentForecast';

describe('forecast balance projection', () => {
  it('carries the starting balance forward when there are no occurrences', () => {
    expect(project({ occurrences: [], startingBalanceMinor: 10000 }).points).toEqual([
      point('2026-07-01', 10000),
      point('2026-07-02', 10000),
      point('2026-07-03', 10000),
    ]);
  });

  it('applies one future expense as a negative balance delta', () => {
    expect(project({
      occurrences: [occurrence({ amountMinor: -2500, occurrenceDate: '2026-07-02' })],
      startingBalanceMinor: 10000,
    }).points).toEqual([
      point('2026-07-01', 10000),
      point('2026-07-02', 7500),
      point('2026-07-03', 7500),
    ]);
  });

  it('applies one future income as a positive balance delta', () => {
    expect(project({
      occurrences: [occurrence({ amountMinor: 4500, kind: 'income', occurrenceDate: '2026-07-02' })],
      startingBalanceMinor: 10000,
    }).points).toEqual([
      point('2026-07-01', 10000),
      point('2026-07-02', 14500),
      point('2026-07-03', 14500),
    ]);
  });

  it('applies mixed income and expense occurrences chronologically', () => {
    expect(project({
      occurrences: [
        occurrence({ amountMinor: -3000, occurrenceDate: '2026-07-03', planId: 'expense' }),
        occurrence({ amountMinor: 7000, kind: 'income', occurrenceDate: '2026-07-02', planId: 'income' }),
      ],
      startingBalanceMinor: 10000,
    }).points).toEqual([
      point('2026-07-01', 10000),
      point('2026-07-02', 17000),
      point('2026-07-03', 14000),
    ]);
  });

  it('applies multiple same-day occurrences to one final daily point', () => {
    const result = project({
      occurrences: [
        occurrence({ amountMinor: -2000, occurrenceDate: '2026-07-02', planId: 'rent' }),
        occurrence({ amountMinor: 5000, kind: 'income', occurrenceDate: '2026-07-02', planId: 'pay' }),
        occurrence({ amountMinor: -750, occurrenceDate: '2026-07-02', planId: 'subscription' }),
      ],
      startingBalanceMinor: 10000,
    });

    expect(result.points).toEqual([
      point('2026-07-01', 10000),
      point('2026-07-02', 12250),
      point('2026-07-03', 12250),
    ]);
    expect(result.events).toEqual([
      expect.objectContaining({
        date: '2026-07-02',
        netChangeMinor: 2250,
        projectedBalanceMinor: 12250,
      }),
    ]);
  });

  it('preserves stable same-day occurrence ordering in event metadata', () => {
    const first = occurrence({ amountMinor: -100, occurrenceDate: '2026-07-02', planId: 'first' });
    const second = occurrence({ amountMinor: -200, occurrenceDate: '2026-07-02', planId: 'second' });
    const third = occurrence({ amountMinor: -300, occurrenceDate: '2026-07-02', planId: 'third' });

    expect(project({ occurrences: [first, second, third] }).events[0].occurrences).toEqual([
      first,
      second,
      third,
    ]);
  });

  it('carries projected balance across quiet days', () => {
    expect(project({
      endDate: '2026-07-06',
      occurrences: [occurrence({ amountMinor: -1000, occurrenceDate: '2026-07-02' })],
      startingBalanceMinor: 5000,
    }).points).toEqual([
      point('2026-07-01', 5000),
      point('2026-07-02', 4000),
      point('2026-07-03', 4000),
      point('2026-07-04', 4000),
      point('2026-07-05', 4000),
      point('2026-07-06', 4000),
    ]);
  });

  it('preserves negative projected balances without clamping', () => {
    expect(project({
      occurrences: [occurrence({ amountMinor: -15000, occurrenceDate: '2026-07-01' })],
      startingBalanceMinor: 5000,
    }).points[0]).toEqual(point('2026-07-01', -10000));
  });

  it('uses start-inclusive boundaries', () => {
    expect(project({
      occurrences: [occurrence({ amountMinor: -1000, occurrenceDate: '2026-07-01' })],
      startingBalanceMinor: 5000,
    }).points[0]).toEqual(point('2026-07-01', 4000));
  });

  it('uses end-exclusive boundaries', () => {
    expect(project({
      endDate: '2026-07-01',
      occurrences: [
        occurrence({ amountMinor: -1000, occurrenceDate: '2026-07-01', planId: 'included' }),
        occurrence({ amountMinor: -2000, occurrenceDate: '2026-07-02', planId: 'excluded' }),
      ],
      startDate: '2026-07-01',
      startingBalanceMinor: 5000,
    })).toEqual({
      events: [
        expect.objectContaining({
          date: '2026-07-01',
          netChangeMinor: -1000,
          projectedBalanceMinor: 4000,
        }),
      ],
      points: [point('2026-07-01', 4000)],
    });
  });

  it('applies due-today occurrences when today starts the requested range', () => {
    expect(project({
      occurrences: [occurrence({ amountMinor: -1000, occurrenceDate: '2026-07-10' })],
      startDate: '2026-07-10',
      endDate: '2026-07-10',
      startingBalanceMinor: 5000,
    }).points).toEqual([
      point('2026-07-10', 4000),
    ]);
  });

  it('handles one-day ranges', () => {
    expect(project({
      endDate: '2026-07-02',
      occurrences: [occurrence({ amountMinor: 2500, kind: 'income', occurrenceDate: '2026-07-02' })],
      startDate: '2026-07-02',
      startingBalanceMinor: 1000,
    }).points).toEqual([
      point('2026-07-02', 3500),
    ]);
  });

  it('handles sparse long ranges', () => {
    const result = project({
      endDate: '2026-07-10',
      occurrences: [occurrence({ amountMinor: -500, occurrenceDate: '2026-07-09' })],
      startingBalanceMinor: 2000,
    });

    expect(result.points).toHaveLength(10);
    expect(result.points[0]).toEqual(point('2026-07-01', 2000));
    expect(result.points[7]).toEqual(point('2026-07-08', 2000));
    expect(result.points[8]).toEqual(point('2026-07-09', 1500));
    expect(result.points[9]).toEqual(point('2026-07-10', 1500));
  });

  it('preserves large positive and negative minor-unit values', () => {
    expect(project({
      occurrences: [
        occurrence({ amountMinor: 8_000_000_000_000, kind: 'income', occurrenceDate: '2026-07-01' }),
        occurrence({ amountMinor: -9_000_000_000_000, occurrenceDate: '2026-07-02' }),
      ],
      startingBalanceMinor: 1_000_000_000_000,
    }).points).toEqual([
      point('2026-07-01', 9_000_000_000_000),
      point('2026-07-02', 0),
      point('2026-07-03', 0),
    ]);
  });

  it('ignores occurrences outside the requested range and malformed occurrence dates', () => {
    expect(project({
      occurrences: [
        occurrence({ amountMinor: -1000, occurrenceDate: '2026-06-30', planId: 'before' }),
        occurrence({ amountMinor: -2000, occurrenceDate: '2026-07-04', planId: 'after' }),
        occurrence({ amountMinor: -3000, occurrenceDate: 'not-a-date', planId: 'bad' }),
      ],
      startingBalanceMinor: 5000,
    })).toEqual({
      events: [],
      points: [
        point('2026-07-01', 5000),
        point('2026-07-02', 5000),
        point('2026-07-03', 5000),
      ],
    });
  });

  it('does not mutate the input occurrence array or occurrence objects', () => {
    const occurrences = [
      occurrence({ amountMinor: -1000, occurrenceDate: '2026-07-03', planId: 'third' }),
      occurrence({ amountMinor: -2000, occurrenceDate: '2026-07-01', planId: 'first' }),
    ];
    const before = JSON.parse(JSON.stringify(occurrences));

    project({ occurrences });

    expect(occurrences).toEqual(before);
  });

  it('returns deterministic results for repeated calls', () => {
    const input = {
      occurrences: [
        occurrence({ amountMinor: -1000, occurrenceDate: '2026-07-03', planId: 'expense' }),
        occurrence({ amountMinor: 2500, kind: 'income', occurrenceDate: '2026-07-02', planId: 'income' }),
      ],
      startingBalanceMinor: 5000,
    };

    expect(project(input)).toEqual(project(input));
  });

  it('returns an empty result for invalid or empty ranges', () => {
    expect(getForecastBalanceProjection({
      occurrences: [occurrence()],
      range: { startIso: 'bad', endIso: '2026-07-02T00:00:00.000Z' },
      startingBalanceMinor: 1000,
    })).toEqual({ events: [], points: [] });

    expect(getForecastBalanceProjection({
      occurrences: [occurrence()],
      range: {
        startIso: new Date(2026, 6, 2).toISOString(),
        endIso: new Date(2026, 6, 2).toISOString(),
      },
      startingBalanceMinor: 1000,
    })).toEqual({ events: [], points: [] });
  });
});

function project({
  endDate = '2026-07-03',
  occurrences,
  startDate = '2026-07-01',
  startingBalanceMinor = 0,
}: {
  endDate?: string;
  occurrences: UpcomingPaymentForecastOccurrence[];
  startDate?: string;
  startingBalanceMinor?: number;
}) {
  return getForecastBalanceProjection({
    occurrences,
    range: getInclusiveDateRange(startDate, endDate),
    startingBalanceMinor,
  });
}

function point(date: string, balanceMinor: number) {
  return { date, balanceMinor };
}

function occurrence(
  overrides: Partial<UpcomingPaymentForecastOccurrence> = {},
): UpcomingPaymentForecastOccurrence {
  return {
    accountId: 'everyday',
    amountMinor: -1000,
    currencyCode: 'AUD',
    frequency: 'one_time',
    kind: 'expense',
    occurrenceDate: '2026-07-01',
    occurrenceIndex: 0,
    originalDueDate: '2026-07-01',
    planId: 'plan',
    sourceType: 'upcoming_payment',
    title: 'Plan',
    ...overrides,
  };
}
