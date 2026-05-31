import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card } from '../../components/ui';
import type { AccountBalance, AppSnapshot, RainyDayProgress } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { DashboardCardSlot, DashboardHeaderAction } from './DashboardCards';
import { DashboardQuickActions } from './DashboardQuickActions';
import { useDashboardViewModel } from './useDashboardViewModel';

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
  const renderedCards = viewModel.dashboardCardIds
    .map((cardId) => (
      <DashboardCardSlot
        key={cardId}
        cardId={cardId}
        rainyDayProgress={rainyDayProgress}
        snapshot={snapshot}
        viewModel={viewModel}
        onAddAccount={onAddAccount}
        onOpenAccount={onOpenAccount}
        onOpenBudgets={onOpenBudgets}
        onOpenRainyDayFund={onOpenRainyDayFund}
        onOpenRecurring={onOpenRecurring}
        onOpenTransaction={onOpenTransaction}
        onOpenTransactions={onOpenTransactions}
      />
    ))
    .filter(Boolean);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        testID="screen-dashboard"
      >
        <View style={styles.dashboardHeader}>
          <View style={styles.headerText}>
            <Text style={styles.dashboardTitle}>Dashboard</Text>
            <Text style={styles.smallMuted}>Your selected cards and account view.</Text>
          </View>
          <DashboardHeaderAction label="Edit Dashboard" onPress={onOpenDashboardEdit} testID="dashboard-edit-start" />
        </View>
        {renderedCards.length ? renderedCards : (
          <Card testID="dashboard-empty-cards-card" style={styles.compactCard}>
            <Text style={styles.cardTitle}>Dashboard</Text>
            <Text style={styles.emptyText}>No dashboard cards are available. Edit Dashboard to add or show cards.</Text>
            <ActionButton variant="secondary" onPress={onOpenDashboardEdit}>
              Edit Dashboard
            </ActionButton>
          </Card>
        )}
      </ScrollView>
      <DashboardQuickActions
        selectedAccountIds={viewModel.selectedAccountIds}
        onAddTransaction={onAddTransaction}
        onOpenTemplates={onOpenTemplates}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '800',
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
  scrollContent: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: 96,
  },
  smallMuted: {
    color: colors.muted,
    fontSize: typography.small,
  },
});
