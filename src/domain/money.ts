import type { CurrencyCode } from './types';

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;
const CURRENCY_SYMBOLS: Record<string, string> = {
  AUD: '$',
  CAD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  NZD: '$',
  USD: '$',
};

export function normalizeCurrencyCode(value: string | null | undefined, fallback = 'USD'): CurrencyCode {
  const normalized = value?.trim().toUpperCase();
  return normalized && CURRENCY_CODE_PATTERN.test(normalized) ? normalized : fallback;
}

export function isCurrencyCode(value: string): boolean {
  return CURRENCY_CODE_PATTERN.test(value.trim().toUpperCase());
}

export function parseMoneyInput(input: string): number {
  const normalized = input.trim().replace(/,/g, '');
  const match = normalized.match(/^(-?)(?:(\d+)(?:\.(\d{0,2}))?|\.(\d{1,2}))$/);

  if (!match) {
    throw new Error('Enter an amount with up to 2 decimal places.');
  }

  const [, sign, whole = '0', centsFromWhole, centsOnly] = match;
  const cents = (centsFromWhole ?? centsOnly ?? '').padEnd(2, '0');
  const amountMinor = Number(whole) * 100 + Number(cents);

  if (!Number.isSafeInteger(amountMinor)) {
    throw new Error('Amount is too large.');
  }

  return sign === '-' ? -amountMinor : amountMinor;
}

export function getCurrencySymbol(currencyCode: CurrencyCode): string {
  return CURRENCY_SYMBOLS[normalizeCurrencyCode(currencyCode)] ?? '$';
}

export function formatMoney(
  amountMinor: number,
  currencyCode: CurrencyCode,
  options: { showCurrencyCode?: boolean } = {},
): string {
  const sign = amountMinor < 0 ? '-' : '';
  const absolute = Math.abs(amountMinor);
  const whole = Math.floor(absolute / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cents = String(absolute % 100).padStart(2, '0');
  const amount = `${sign}${getCurrencySymbol(currencyCode)}${whole}.${cents}`;

  return options.showCurrencyCode ? `${normalizeCurrencyCode(currencyCode)} ${amount}` : amount;
}

export function formatMoneyAccounting(
  amountMinor: number,
  currencyCode: CurrencyCode,
  options: { showCurrencyCode?: boolean } = {},
): string {
  const formatted = formatMoney(Math.abs(amountMinor), currencyCode, options);
  return amountMinor < 0 ? `(${formatted})` : formatted;
}

export function formatMoneyCompact(amountMinor: number, currencyCode: CurrencyCode): string {
  const formatted = formatMoney(amountMinor, currencyCode, { showCurrencyCode: true });
  return formatted.replace(`${currencyCode} `, '');
}
