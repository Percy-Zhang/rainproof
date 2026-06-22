import { memo } from 'react';

import type {
  AppSnapshot,
  RainyDayProgress,
} from '../../domain/types';
import { AccountsDashboardCard } from './DashboardAccountsCard';
import { BudgetProgressDashboardCard } from './DashboardBudgetProgressCard';
import { CreditCardsDashboardCard } from './DashboardCreditCardsCard';
import {
  BalanceSummaryCard,
  CashFlowCard,
  TopSpendingCard,
} from './DashboardFinancialCards';
import { RainyDayDashboardCard } from './DashboardRainyDayCard';
import { RecentTransactionsCard } from './DashboardRecentTransactionsCard';
import { UpcomingPaymentsDashboardCard } from './DashboardUpcomingPaymentsCard';
import type { DashboardViewModel } from './useDashboardViewModel';

export { DashboardHeaderAction } from './DashboardCardPrimitives';

type DashboardCardSlotProps =
  | {
    cardId: 'balanceSummary';
    showCurrencyCodes: boolean;
    totalsByCurrency: DashboardViewModel['dashboardBalanceTotals'];
  }
  | {
    cardId: 'cashFlow';
    cashFlow: DashboardViewModel['dashboardCashFlow'];
    showCurrencyCodes: boolean;
  }
  | {
    cardId: 'rainyDay';
    onOpenRainyDayFund: () => void;
    rainyDayProgress: RainyDayProgress;
    showCurrencyCodes: boolean;
  }
  | {
    accountPreview: DashboardViewModel['accountPreview'];
    cardId: 'accounts';
    hasAnyAccounts: boolean;
    onAddAccount: () => void;
    onClearSelection: () => void;
    onOpenAccount: () => void;
    onSelectAll: () => void;
    onToggleAccount: (accountId: string) => void;
    selectedAccountIds: string[];
    showCurrencyCodes: boolean;
  }
  | {
    cardId: 'creditCards';
    creditCardSummaries: DashboardViewModel['creditCardSummaries'];
    showCurrencyCodes: boolean;
  }
  | {
    budgetProgress: DashboardViewModel['budgetProgress'];
    cardId: 'budgetProgress';
    onOpenBudgets: () => void;
    showCurrencyCodes: boolean;
  }
  | {
    accountById: DashboardViewModel['accountById'];
    cardId: 'upcomingPayments';
    onOpenRecurring: () => void;
    rows: DashboardViewModel['recurringSummary']['rows'];
    showCurrencyCodes: boolean;
  }
  | {
    cardId: 'topSpending';
    categories: DashboardViewModel['categories'];
    showCurrencyCodes: boolean;
    topSpendingByCurrency: DashboardViewModel['dashboardTopSpending'];
  }
  | {
    appliedSelectedAccountIds: string[];
    cardId: 'recentTransactions';
    categories: DashboardViewModel['categories'];
    onOpenTransaction: (transactionId: string) => void;
    onOpenTransactions: () => void;
    recentTransactions: DashboardViewModel['recentTransactions'];
    showCurrencyCodes: boolean;
    snapshot: AppSnapshot;
  };

export const DashboardCardSlot = memo(function DashboardCardSlot(props: DashboardCardSlotProps) {
  switch (props.cardId) {
    case 'balanceSummary':
      return (
        <BalanceSummaryCard
          showCurrencyCodes={props.showCurrencyCodes}
          totalsByCurrency={props.totalsByCurrency}
        />
      );
    case 'cashFlow':
      return (
        <CashFlowCard
          cashFlow={props.cashFlow}
          showCurrencyCodes={props.showCurrencyCodes}
        />
      );
    case 'rainyDay':
      return (
        <RainyDayDashboardCard
          rainyDayProgress={props.rainyDayProgress}
          showCurrencyCodes={props.showCurrencyCodes}
          onOpenRainyDayFund={props.onOpenRainyDayFund}
        />
      );
    case 'accounts':
      return (
        <AccountsDashboardCard
          accountPreview={props.accountPreview}
          hasAnyAccounts={props.hasAnyAccounts}
          selectedAccountIds={props.selectedAccountIds}
          showCurrencyCodes={props.showCurrencyCodes}
          onAddAccount={props.onAddAccount}
          onClearSelection={props.onClearSelection}
          onOpenAccount={props.onOpenAccount}
          onSelectAll={props.onSelectAll}
          onToggleAccount={props.onToggleAccount}
        />
      );
    case 'creditCards':
      return (
        <CreditCardsDashboardCard
          creditCardSummaries={props.creditCardSummaries}
          showCurrencyCodes={props.showCurrencyCodes}
        />
      );
    case 'budgetProgress':
      return (
        <BudgetProgressDashboardCard
          budgetProgress={props.budgetProgress}
          showCurrencyCodes={props.showCurrencyCodes}
          onOpenBudgets={props.onOpenBudgets}
        />
      );
    case 'upcomingPayments':
      return (
        <UpcomingPaymentsDashboardCard
          accountById={props.accountById}
          rows={props.rows}
          showCurrencyCodes={props.showCurrencyCodes}
          onOpenRecurring={props.onOpenRecurring}
        />
      );
    case 'topSpending':
      return (
        <TopSpendingCard
          categories={props.categories}
          topSpendingByCurrency={props.topSpendingByCurrency}
          showCurrencyCodes={props.showCurrencyCodes}
        />
      );
    case 'recentTransactions':
      return (
        <RecentTransactionsCard
          categories={props.categories}
          recentTransactions={props.recentTransactions}
          selectedAccountIds={props.appliedSelectedAccountIds}
          showCurrencyCodes={props.showCurrencyCodes}
          snapshot={props.snapshot}
          onOpenTransaction={props.onOpenTransaction}
          onOpenTransactions={props.onOpenTransactions}
        />
      );
    default:
      return null;
  }
});
