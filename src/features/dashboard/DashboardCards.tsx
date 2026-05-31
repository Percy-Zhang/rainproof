import type {
  AppSnapshot,
  DashboardCardId,
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

type DashboardCardSlotProps = {
  cardId: DashboardCardId;
  onAddAccount: () => void;
  onOpenAccount: () => void;
  onOpenBudgets: () => void;
  onOpenRainyDayFund: () => void;
  onOpenRecurring: () => void;
  onOpenTransaction: (transactionId: string) => void;
  onOpenTransactions: () => void;
  rainyDayProgress: RainyDayProgress;
  snapshot: AppSnapshot;
  viewModel: DashboardViewModel;
};

export function DashboardCardSlot({
  cardId,
  onAddAccount,
  onOpenAccount,
  onOpenBudgets,
  onOpenRainyDayFund,
  onOpenRecurring,
  onOpenTransaction,
  onOpenTransactions,
  rainyDayProgress,
  snapshot,
  viewModel,
}: DashboardCardSlotProps) {
  switch (cardId) {
    case 'balanceSummary':
      return (
        <BalanceSummaryCard
          showCurrencyCodes={viewModel.showCurrencyCodes}
          totalsByCurrency={viewModel.dashboardBalanceTotals}
        />
      );
    case 'cashFlow':
      return (
        <CashFlowCard
          cashFlow={viewModel.dashboardCashFlow}
          showCurrencyCodes={viewModel.showCurrencyCodes}
        />
      );
    case 'rainyDay':
      return (
        <RainyDayDashboardCard
          rainyDayProgress={rainyDayProgress}
          showCurrencyCodes={viewModel.showCurrencyCodes}
          onOpenRainyDayFund={onOpenRainyDayFund}
        />
      );
    case 'accounts':
      return (
        <AccountsDashboardCard
          accountPreview={viewModel.accountPreview}
          hasAnyAccounts={viewModel.hasAnyAccounts}
          selectedAccountIds={viewModel.selectedAccountIds}
          showCurrencyCodes={viewModel.showCurrencyCodes}
          onAddAccount={onAddAccount}
          onOpenAccount={onOpenAccount}
          onToggleAccount={viewModel.toggleAccount}
        />
      );
    case 'creditCards':
      return (
        <CreditCardsDashboardCard
          creditCardSummaries={viewModel.creditCardSummaries}
          showCurrencyCodes={viewModel.showCurrencyCodes}
        />
      );
    case 'budgetProgress':
      return (
        <BudgetProgressDashboardCard
          budgetProgress={viewModel.budgetProgress}
          showCurrencyCodes={viewModel.showCurrencyCodes}
          onOpenBudgets={onOpenBudgets}
        />
      );
    case 'upcomingPayments':
      return (
        <UpcomingPaymentsDashboardCard
          accountById={viewModel.accountById}
          rows={viewModel.recurringSummary.rows}
          showCurrencyCodes={viewModel.showCurrencyCodes}
          onOpenRecurring={onOpenRecurring}
        />
      );
    case 'topSpending':
      return (
        <TopSpendingCard
          categories={viewModel.categories}
          topSpendingByCurrency={viewModel.dashboardTopSpending}
          showCurrencyCodes={viewModel.showCurrencyCodes}
        />
      );
    case 'recentTransactions':
      return (
        <RecentTransactionsCard
          categories={viewModel.categories}
          recentTransactions={viewModel.recentTransactions}
          selectedAccountIds={viewModel.selectedAccountIds}
          showCurrencyCodes={viewModel.showCurrencyCodes}
          snapshot={snapshot}
          onOpenTransaction={onOpenTransaction}
          onOpenTransactions={onOpenTransactions}
        />
      );
    default:
      return null;
  }
}
