import type { Dispatch, SetStateAction } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { RainproofDataState } from '../application/useRainproofData';
import type { AccountBalance, AppSnapshot, RainyDayProgress } from '../domain/types';
import { AccountsScreen } from '../features/accounts/AccountsScreen';
import { BudgetsScreen } from '../features/budgets/BudgetsScreen';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { RecurringItemsScreen } from '../features/recurring/RecurringItemsScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { StatsScreen } from '../features/stats/StatsScreen';
import { TransactionTemplatesScreen } from '../features/templates/TransactionTemplatesScreen';
import { TransactionsScreen, type TransactionPeriodState } from '../features/transactions/TransactionsScreen';
import { spacing } from '../theme/tokens';
import type { MainDrawerNavigation, RootStackNavigation } from './routeHooks';

export type DrawerRootScreenKey =
  | 'dashboard'
  | 'accounts'
  | 'transactions'
  | 'stats'
  | 'budgets'
  | 'recurring'
  | 'templates'
  | 'settings';

type DrawerRouteAdapterProps = {
  accountBalances: AccountBalance[];
  actions: RainproofDataState['actions'];
  defaultSelectedAccountIds: string[];
  drawerNavigation: MainDrawerNavigation;
  onPeriodStateChange: Dispatch<SetStateAction<TransactionPeriodState>>;
  rainyDayProgress: RainyDayProgress;
  rootNavigation: RootStackNavigation | undefined;
  rootScreen: DrawerRootScreenKey;
  snapshot: AppSnapshot;
  transactionPeriodState: TransactionPeriodState;
};

export function DrawerRouteAdapter(props: DrawerRouteAdapterProps) {
  switch (props.rootScreen) {
    case 'accounts':
      return <AccountsDrawerRoute {...props} />;
    case 'dashboard':
      return <DashboardDrawerRoute {...props} />;
    case 'stats':
      return <StatsDrawerRoute {...props} />;
    case 'transactions':
      return <TransactionsDrawerRoute {...props} />;
    case 'budgets':
      return <BudgetsDrawerRoute {...props} />;
    case 'recurring':
      return <RecurringDrawerRoute {...props} />;
    case 'templates':
      return <TemplatesDrawerRoute {...props} />;
    case 'settings':
      return <SettingsDrawerRoute {...props} />;
  }
}

function AccountsDrawerRoute({
  accountBalances,
  actions,
  rootNavigation,
  snapshot,
}: DrawerRouteAdapterProps) {
  return (
    <View style={styles.paddedContent}>
      <AccountsScreen
        snapshot={snapshot}
        accountBalances={accountBalances}
        showHeader={false}
        onAddAccount={() => rootNavigation?.navigate('AddAccount')}
        onEditAccount={(accountId) => rootNavigation?.navigate('EditAccount', { accountId })}
        onUpdateAccountDashboardVisibility={actions.updateAccountDashboardVisibility}
        onUpdateAccountOrder={actions.updateAccountOrder}
      />
    </View>
  );
}

function DashboardDrawerRoute({
  accountBalances,
  actions,
  drawerNavigation,
  rainyDayProgress,
  rootNavigation,
  snapshot,
}: DrawerRouteAdapterProps) {
  return (
    <DashboardScreen
      snapshot={snapshot}
      accountBalances={accountBalances}
      rainyDayProgress={rainyDayProgress}
      onAddAccount={() => rootNavigation?.navigate('AddAccount')}
      onAddTransaction={(params) => rootNavigation?.navigate('AddTransaction', params)}
      onOpenRainyDayFund={() => rootNavigation?.navigate('RainyDayFund')}
      onOpenTransactions={() => drawerNavigation.navigate('Transactions')}
      onOpenTransaction={(transactionId) => rootNavigation?.navigate('EditTransaction', { transactionId })}
      onOpenAccount={() => drawerNavigation.navigate('Accounts')}
      onOpenBudgets={() => drawerNavigation.navigate('Budgets')}
      onOpenDashboardEdit={() => rootNavigation?.navigate('DashboardEdit')}
      onOpenRecurring={() => drawerNavigation.navigate('Recurring')}
      onOpenTemplates={() => drawerNavigation.navigate('Templates')}
      onUpdateSelectedAccountIds={actions.updateDashboardSelectedAccountIds}
    />
  );
}

function StatsDrawerRoute({
  accountBalances,
  defaultSelectedAccountIds,
  rootNavigation,
  snapshot,
}: DrawerRouteAdapterProps) {
  return (
    <StatsScreen
      accountBalances={accountBalances}
      snapshot={snapshot}
      defaultSelectedAccountIds={defaultSelectedAccountIds}
      onOpenTransaction={(transactionId) => rootNavigation?.navigate('EditTransaction', { transactionId })}
      onOpenStatsDrilldown={(params) => rootNavigation?.navigate('StatsDrilldown', params)}
      showHeader={false}
    />
  );
}

function TransactionsDrawerRoute({
  accountBalances,
  defaultSelectedAccountIds,
  onPeriodStateChange,
  rootNavigation,
  snapshot,
  transactionPeriodState,
}: DrawerRouteAdapterProps) {
  return (
    <TransactionsScreen
      accountBalances={accountBalances}
      snapshot={snapshot}
      defaultSelectedAccountIds={defaultSelectedAccountIds}
      periodState={transactionPeriodState}
      onPeriodStateChange={onPeriodStateChange}
      onOpenTransaction={(transactionId) => rootNavigation?.navigate('EditTransaction', { transactionId })}
      showHeader={false}
    />
  );
}

function BudgetsDrawerRoute({ actions, rootNavigation, snapshot }: DrawerRouteAdapterProps) {
  return (
    <BudgetsScreen
      snapshot={snapshot}
      onAddBudget={() => rootNavigation?.navigate('AddBudget')}
      onEditBudget={(budgetId) => rootNavigation?.navigate('EditBudget', { budgetId })}
      onUpdateBudgetOrder={actions.updateBudgetOrder}
    />
  );
}

function RecurringDrawerRoute({ actions, rootNavigation, snapshot }: DrawerRouteAdapterProps) {
  return (
    <RecurringItemsScreen
      snapshot={snapshot}
      onAddRecurringItem={() => rootNavigation?.navigate('AddRecurringItem')}
      onCreateTransaction={(recurringItemId) =>
        rootNavigation?.navigate('CreateRecurringTransaction', { recurringItemId })}
      onEditRecurringItem={(recurringItemId) => rootNavigation?.navigate('EditRecurringItem', { recurringItemId })}
      onUndoRecurringTransaction={actions.undoLatestRecurringTransaction}
    />
  );
}

function TemplatesDrawerRoute({ rootNavigation, snapshot }: DrawerRouteAdapterProps) {
  return (
    <TransactionTemplatesScreen
      snapshot={snapshot}
      onAddTemplate={() => rootNavigation?.navigate('AddTransactionTemplate')}
      onEditTemplate={(templateId) => rootNavigation?.navigate('EditTransactionTemplate', { templateId })}
      onUseTemplate={(templateId) => rootNavigation?.navigate('AddTransaction', { templateId })}
    />
  );
}

function SettingsDrawerRoute({ actions, rootNavigation, snapshot }: DrawerRouteAdapterProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.paddedScrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <SettingsScreen
        snapshot={snapshot}
        onOpenCategoryManagement={() => rootNavigation?.navigate('CategoryManagement')}
        onRestoreBackup={actions.restoreBackup}
        onUpdateSettings={actions.updateSettings}
        showHeader={false}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  paddedContent: {
    flex: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  paddedScrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
