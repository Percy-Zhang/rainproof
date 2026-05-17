import type { AccountType } from './types';

export const DEFAULT_ACCOUNT_THEME_COLOR = '#1876A8';
export const DEFAULT_ACCOUNT_ICON = 'wallet-outline';

export const accountThemeColors = [
  '#111827',
  '#1876A8',
  '#005BBB',
  '#4F91B8',
  '#5E9C92',
  '#0F7B45',
  '#7488C0',
  '#5B4BDB',
  '#8E9FC5',
  '#C81E1E',
  '#C47E67',
  '#E85D04',
  '#B88A3D',
  '#6F8FA8',
] as const;

export const accountIconPresets = [
  'wallet-outline',
  'card-outline',
  'cash-outline',
  'business-outline',
  'umbrella-outline',
  'home-outline',
  'phone-portrait-outline',
  'globe-outline',
  'car-outline',
  'airplane-outline',
  'gift-outline',
  'trending-up-outline',
  'lock-closed-outline',
] as const;

export function normalizeAccountThemeColor(value: string | null | undefined): string {
  const normalized = value?.trim().toUpperCase();
  return normalized && /^#[0-9A-F]{6}$/.test(normalized) ? normalized : DEFAULT_ACCOUNT_THEME_COLOR;
}

export function getDefaultAccountIcon(type: AccountType = 'checking'): string {
  if (type === 'cash') {
    return 'cash-outline';
  }

  if (type === 'savings') {
    return 'umbrella-outline';
  }

  if (type === 'credit_card') {
    return 'card-outline';
  }

  if (type === 'brokerage') {
    return 'trending-up-outline';
  }

  return 'business-outline';
}

export function normalizeAccountIconName(value: string | null | undefined, type?: AccountType): string {
  const normalized = value?.trim();
  return normalized && accountIconPresets.includes(normalized as typeof accountIconPresets[number])
    ? normalized
    : getDefaultAccountIcon(type);
}

export function getAccountDisplayName(account: { name: string; nickname: string }): string {
  return account.nickname.trim() || account.name;
}

export function getTransparentColor(hexColor: string, alphaHex: string): string {
  return `${normalizeAccountThemeColor(hexColor)}${alphaHex}`;
}
