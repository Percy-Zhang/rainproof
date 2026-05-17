import {
  getDateRangeForPreset,
  getInclusiveDateRange,
  isWithinDateRange,
  parseDateInput,
  parseDateTimeInput,
  toDateInputValue,
  toTimeInputValue,
} from '../dates';

describe('date ranges', () => {
  it('builds last-week ranges ending tomorrow at local midnight', () => {
    const range = getDateRangeForPreset('last_week', new Date(2026, 4, 15, 10));

    expect(new Date(range.startIso).getFullYear()).toBe(2026);
    expect(new Date(range.startIso).getMonth()).toBe(4);
    expect(new Date(range.startIso).getDate()).toBe(9);
    expect(new Date(range.endIso).getDate()).toBe(16);
  });

  it('checks inclusive start and exclusive end', () => {
    const range = {
      startIso: new Date(2026, 0, 1).toISOString(),
      endIso: new Date(2026, 0, 2).toISOString(),
    };

    expect(isWithinDateRange(new Date(2026, 0, 1, 12).toISOString(), range)).toBe(true);
    expect(isWithinDateRange(new Date(2026, 0, 2).toISOString(), range)).toBe(false);
  });

  it('builds custom ranges inclusively even when dates are reversed', () => {
    const range = getInclusiveDateRange('2026-05-20', '2026-05-18');

    expect(isWithinDateRange(new Date(2026, 4, 18, 12).toISOString(), range)).toBe(true);
    expect(isWithinDateRange(new Date(2026, 4, 20, 23, 59).toISOString(), range)).toBe(true);
    expect(isWithinDateRange(new Date(2026, 4, 21).toISOString(), range)).toBe(false);
  });

  it('parses date input without requiring floats or locale parsing', () => {
    expect(new Date(parseDateInput('2026-05-15')).getFullYear()).toBe(2026);
  });

  it('formats and parses minute-precise date times', () => {
    const date = new Date(2026, 4, 15, 9, 7);

    expect(toDateInputValue(date)).toBe('2026-05-15');
    expect(toTimeInputValue(date)).toBe('09:07');
    expect(parseDateTimeInput('2026-05-15', '09:07')).toBe(date.toISOString());
    expect(() => parseDateTimeInput('2026-05-15', '25:00')).toThrow('valid date and time');
  });
});
