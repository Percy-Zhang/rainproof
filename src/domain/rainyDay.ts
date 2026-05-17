import { parseMoneyInput } from './money';

export function formatMinorForInput(amountMinor: number): string {
  const sign = amountMinor < 0 ? '-' : '';
  const absolute = Math.abs(amountMinor);
  const whole = Math.floor(absolute / 100).toString();
  const cents = String(absolute % 100).padStart(2, '0');
  return `${sign}${whole}.${cents}`;
}

export function parseRainyDayGoalForPreview(goalText: string): number | null {
  try {
    return goalText.trim() ? Math.max(0, parseMoneyInput(goalText)) : 0;
  } catch {
    return null;
  }
}
