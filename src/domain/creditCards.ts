import { formatMoney } from './money';
import type { Account, AccountBalance, CurrencyCode } from './types';

export type CreditCardBalanceState = 'owed' | 'credit' | 'none';

export type CreditCardBalanceSummary = {
  account: Account;
  balanceMinor: number;
  state: CreditCardBalanceState;
  owedMinor: number;
  creditMinor: number;
  creditLimitMinor: number | null;
  availableCreditMinor: number | null;
  overLimitMinor: number;
  utilization: number | null;
};

export type CreditCardCurrencySummary = {
  currencyCode: CurrencyCode;
  totalOwedMinor: number;
  totalCreditMinor: number;
  totalCreditLimitMinor: number;
  totalAvailableCreditMinor: number | null;
  totalOverLimitMinor: number;
  utilization: number | null;
  cards: CreditCardBalanceSummary[];
};

export function getCreditCardBalanceSummary({
  account,
  balanceMinor,
}: AccountBalance): CreditCardBalanceSummary | null {
  if (account.type !== 'credit_card') {
    return null;
  }

  const owedMinor = Math.max(0, -balanceMinor);
  const creditMinor = Math.max(0, balanceMinor);
  const creditLimitMinor = getPositiveCreditLimit(account);
  const availableCreditMinor = creditLimitMinor === null ? null : creditLimitMinor - owedMinor;
  const overLimitMinor = availableCreditMinor !== null && availableCreditMinor < 0 ? Math.abs(availableCreditMinor) : 0;

  return {
    account,
    balanceMinor,
    state: owedMinor > 0 ? 'owed' : creditMinor > 0 ? 'credit' : 'none',
    owedMinor,
    creditMinor,
    creditLimitMinor,
    availableCreditMinor,
    overLimitMinor,
    utilization: getCreditCardUtilization({ account, balanceMinor }),
  };
}

export function getCreditCardAvailableCredit({
  account,
  balanceMinor,
}: AccountBalance): number | null {
  if (account.type !== 'credit_card') {
    return null;
  }

  const creditLimitMinor = getPositiveCreditLimit(account);
  if (creditLimitMinor === null) {
    return null;
  }

  return creditLimitMinor - Math.max(0, -balanceMinor);
}

export function getCreditCardUtilization({
  account,
  balanceMinor,
}: AccountBalance): number | null {
  if (account.type !== 'credit_card') {
    return null;
  }

  const creditLimitMinor = getPositiveCreditLimit(account);
  if (creditLimitMinor === null) {
    return null;
  }

  return Math.max(0, -balanceMinor) / creditLimitMinor;
}

export function getCreditCardPortfolioSummary(
  accountBalances: AccountBalance[],
): CreditCardCurrencySummary[] {
  const summariesByCurrency = new Map<CurrencyCode, CreditCardCurrencySummary>();

  for (const accountBalance of accountBalances) {
    const cardSummary = getCreditCardBalanceSummary(accountBalance);
    if (!cardSummary || accountBalance.account.isArchived) {
      continue;
    }

    const currencyCode = cardSummary.account.currencyCode;
    const current = summariesByCurrency.get(currencyCode) ?? {
      currencyCode,
      totalOwedMinor: 0,
      totalCreditMinor: 0,
      totalCreditLimitMinor: 0,
      totalAvailableCreditMinor: null,
      totalOverLimitMinor: 0,
      utilization: null,
      cards: [],
    };

    current.totalOwedMinor += cardSummary.owedMinor;
    current.totalCreditMinor += cardSummary.creditMinor;
    current.totalCreditLimitMinor += cardSummary.creditLimitMinor ?? 0;
    current.totalOverLimitMinor += cardSummary.overLimitMinor;
    current.cards.push(cardSummary);
    summariesByCurrency.set(currencyCode, current);
  }

  return Array.from(summariesByCurrency.values())
    .map((summary) => {
      const limitedCards = summary.cards.filter((card) => card.creditLimitMinor !== null);
      const limitedOwedMinor = limitedCards.reduce((total, card) => total + card.owedMinor, 0);

      return {
        ...summary,
        totalAvailableCreditMinor:
          summary.totalCreditLimitMinor > 0 ? summary.totalCreditLimitMinor - limitedOwedMinor : null,
        utilization:
          summary.totalCreditLimitMinor > 0 ? limitedOwedMinor / summary.totalCreditLimitMinor : null,
        cards: summary.cards.sort((left, right) =>
          right.owedMinor - left.owedMinor || left.account.name.localeCompare(right.account.name),
        ),
      };
    })
    .sort((left, right) => left.currencyCode.localeCompare(right.currencyCode));
}

export function formatCreditCardBalanceLabel({
  account,
  balanceMinor,
}: AccountBalance, options: { showCurrencyCode?: boolean } = {}): string {
  if (account.type !== 'credit_card') {
    return formatMoney(balanceMinor, account.currencyCode, options);
  }

  if (balanceMinor < 0) {
    return `Owed: ${formatMoney(Math.abs(balanceMinor), account.currencyCode, options)}`;
  }

  if (balanceMinor > 0) {
    return `Credit: ${formatMoney(balanceMinor, account.currencyCode, options)}`;
  }

  return 'No balance';
}

export function formatCreditCardUtilization(utilization: number | null): string | null {
  return utilization === null ? null : `${Math.round(utilization * 100)}%`;
}

function getPositiveCreditLimit(account: Account): number | null {
  const limit = account.creditLimitMinor;
  return limit && limit > 0 ? limit : null;
}
