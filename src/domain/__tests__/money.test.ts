import { formatMoney, formatMoneyAccounting, parseMoneyInput } from '../money';

describe('money', () => {
  it('parses decimal strings into integer minor units', () => {
    expect(parseMoneyInput('123.45')).toBe(12345);
    expect(parseMoneyInput('1,234.50')).toBe(123450);
    expect(parseMoneyInput('.99')).toBe(99);
    expect(parseMoneyInput('-10.05')).toBe(-1005);
  });

  it('formats integer minor units with two decimal places', () => {
    expect(formatMoney(12345, 'AUD')).toBe('$123.45');
    expect(formatMoney(5, 'USD')).toBe('$0.05');
    expect(formatMoney(-123456, 'NZD')).toBe('-$1,234.56');
    expect(formatMoney(12345, 'AUD', { showCurrencyCode: true })).toBe('AUD $123.45');
  });

  it('formats transaction amounts in accounting style without a minus sign', () => {
    expect(formatMoneyAccounting(12345, 'AUD')).toBe('$123.45');
    expect(formatMoneyAccounting(-12345, 'AUD')).toBe('($123.45)');
    expect(formatMoneyAccounting(-12345, 'AUD', { showCurrencyCode: true })).toBe('(AUD $123.45)');
  });

  it('rejects more than two decimal places', () => {
    expect(() => parseMoneyInput('1.234')).toThrow('up to 2 decimal');
  });
});
