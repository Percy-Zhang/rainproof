import { formatMinorForInput, parseRainyDayGoalForPreview } from '../rainyDay';

describe('rainy day helpers', () => {
  it('formats minor units for the editable threshold input', () => {
    expect(formatMinorForInput(0)).toBe('0.00');
    expect(formatMinorForInput(12345)).toBe('123.45');
    expect(formatMinorForInput(-501)).toBe('-5.01');
  });

  it('parses preview thresholds without throwing while typing', () => {
    expect(parseRainyDayGoalForPreview('')).toBe(0);
    expect(parseRainyDayGoalForPreview('12.34')).toBe(1234);
    expect(parseRainyDayGoalForPreview('-12.34')).toBe(0);
    expect(parseRainyDayGoalForPreview('abc')).toBeNull();
  });
});
