import { FlatList, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card } from '../../components/ui';
import type { AccountBalance, AppSnapshot, DashboardCardId, RainyDayProgress } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { DashboardCardSlot, DashboardHeaderAction } from './DashboardCards';
import { DashboardQuickActions } from './DashboardQuickActions';
import { useDashboardViewModel } from './useDashboardViewModel';

const DASHBOARD_INITIAL_CARDS_TO_RENDER = 4;
const DASHBOARD_MAX_CARDS_TO_RENDER_PER_BATCH = 4;
const DASHBOARD_CARD_WINDOW_SIZE = 5;

type DashboardScreenProps = {
  snapshot: AppSnapshot;
  accountBalances: AccountBalance[];
  rainyDayProgress: RainyDayProgress;
  onAddAccount: () => void;
  onAddTransaction: (params?: { dashboardAccountIds?: string[] }) => void;
  onOpenRainyDayFund: () => void;
  onOpenTransactions: () => void;
  onOpenTransaction: (transactionId: string) => void;
  onOpenAccount: () => void;
  onOpenBudgets: () => void;
  onOpenDashboardEdit: () => void;
  onOpenRecurring: () => void;
  onOpenTemplates: () => void;
  onUpdateSelectedAccountIds: (accountIds: string[]) => Promise<void>;
};

export function DashboardScreen({
  snapshot,
  accountBalances,
  rainyDayProgress,
  onAddAccount,
  onAddTransaction,
  onOpenRainyDayFund,
  onOpenTransactions,
  onOpenTransaction,
  onOpenAccount,
  onOpenBudgets,
  onOpenDashboardEdit,
  onOpenRecurring,
  onOpenTemplates,
  onUpdateSelectedAccountIds,
}: DashboardScreenProps) {
  const viewModel = useDashboardViewModel({
    accountBalances,
    onUpdateSelectedAccountIds,
    snapshot,
  });

  function renderDashboardCard(cardId: DashboardCardId) {
    switch (cardId) {
      case 'balanceSummary':
        return (
          <DashboardCardSlot
            cardId={cardId}
            showCurrencyCodes={viewModel.showCurrencyCodes}
            totalsByCurrency={viewModel.dashboardBalanceTotals}
          />
        );
      case 'cashFlow':
        return (
          <DashboardCardSlot
            cardId={cardId}
            cashFlow={viewModel.dashboardCashFlow}
            showCurrencyCodes={viewModel.showCurrencyCodes}
          />
        );
      case 'rainyDay':
        return (
          <DashboardCardSlot
            cardId={cardId}
            rainyDayProgress={rainyDayProgress}
            showCurrencyCodes={viewModel.showCurrencyCodes}
            onOpenRainyDayFund={onOpenRainyDayFund}
          />
        );
      case 'accounts':
        return (
          <DashboardCardSlot
            accountPreview={viewModel.accountPreview}
            cardId={cardId}
            hasAnyAccounts={viewModel.hasAnyAccounts}
            selectedAccountIds={viewModel.selectedAccountIds}
            showCurrencyCodes={viewModel.showCurrencyCodes}
            onAddAccount={onAddAccount}
            onOpenAccount={onOpenAccount}
            onSelectedAccountIdsChange={viewModel.setSelectedAccounts}
          />
        );
      case 'creditCards':
        return (
          <DashboardCardSlot
            cardId={cardId}
            creditCardSummaries={viewModel.creditCardSummaries}
            showCurrencyCodes={viewModel.showCurrencyCodes}
          />
        );
      case 'budgetProgress':
        return (
          <DashboardCardSlot
            budgetProgress={viewModel.budgetProgress}
            cardId={cardId}
            showCurrencyCodes={viewModel.showCurrencyCodes}
            onOpenBudgets={onOpenBudgets}
          />
        );
      case 'upcomingPayments':
        return (
          <DashboardCardSlot
            accountById={viewModel.accountById}
            cardId={cardId}
            rows={viewModel.recurringSummary.rows}
            showCurrencyCodes={viewModel.showCurrencyCodes}
            onOpenRecurring={onOpenRecurring}
          />
        );
      case 'topSpending':
        return (
          <DashboardCardSlot
            cardId={cardId}
            categories={viewModel.categories}
            showCurrencyCodes={viewModel.showCurrencyCodes}
            topSpendingByCurrency={viewModel.dashboardTopSpending}
          />
        );
      case 'recentTransactions':
        return (
          <DashboardCardSlot
            cardId={cardId}
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

  return (
    <View style={styles.screen}>
      <FlatList
        data={viewModel.dashboardCardIds}
        keyExtractor={(cardId) => cardId}
        renderItem={({ item }) => renderDashboardCard(item)}
        contentContainerStyle={styles.cardFeedContent}
        extraData={viewModel.suppressRecentTransactionAnimations}
        initialNumToRender={DASHBOARD_INITIAL_CARDS_TO_RENDER}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={(
          <DashboardEmptyState onOpenDashboardEdit={onOpenDashboardEdit} />
        )}
        ListHeaderComponent={(
          <DashboardHeader onOpenDashboardEdit={onOpenDashboardEdit} />
        )}
        maxToRenderPerBatch={DASHBOARD_MAX_CARDS_TO_RENDER_PER_BATCH}
        showsVerticalScrollIndicator={false}
        style={styles.cardFeed}
        testID="screen-dashboard"
        windowSize={DASHBOARD_CARD_WINDOW_SIZE}
      />
      <DashboardQuickActions
        selectedAccountIds={viewModel.selectedAccountIds}
        onAddTransaction={onAddTransaction}
        onOpenTemplates={onOpenTemplates}
      />
    </View>
  );
}

function DashboardHeader({
  onOpenDashboardEdit,
}: {
  onOpenDashboardEdit: () => void;
}) {
  return (
    <View style={styles.dashboardHeader}>
      <View style={styles.headerText}>
        <Text style={styles.dashboardTitle}>Dashboard</Text>
        <Text style={styles.smallMuted}>Your selected cards and account view.</Text>
      </View>
      <DashboardHeaderAction label="Edit Dashboard" onPress={onOpenDashboardEdit} testID="dashboard-edit-start" />
    </View>
  );
}

function DashboardEmptyState({
  onOpenDashboardEdit,
}: {
  onOpenDashboardEdit: () => void;
}) {
  return (
    <Card testID="dashboard-empty-cards-card" style={styles.compactCard}>
      <Text style={styles.cardTitle}>Dashboard</Text>
      <Text style={styles.emptyText}>No dashboard cards are available. Edit Dashboard to add or show cards.</Text>
      <ActionButton variant="secondary" onPress={onOpenDashboardEdit}>
        Edit Dashboard
      </ActionButton>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '800',
  },
  cardFeed: {
    flex: 1,
  },
  cardFeedContent: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: 96,
  },
  compactCard: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  dashboardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  dashboardTitle: {
    color: colors.ink,
    fontSize: typography.h2,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  screen: {
    flex: 1,
  },
  smallMuted: {
    color: colors.muted,
    fontSize: typography.small,
  },
});
