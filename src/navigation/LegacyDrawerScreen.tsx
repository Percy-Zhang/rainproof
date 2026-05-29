import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRainproofDataContext } from '../application/RainproofDataProvider';
import { FormError } from '../components/ui';
import { AccountsScreen } from '../features/accounts/AccountsScreen';
import { BudgetsScreen } from '../features/budgets/BudgetsScreen';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { RecurringItemsScreen } from '../features/recurring/RecurringItemsScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { StatsScreen } from '../features/stats/StatsScreen';
import { TransactionTemplatesScreen } from '../features/templates/TransactionTemplatesScreen';
import {
  createDefaultTransactionPeriodState,
  TransactionsScreen,
  type TransactionPeriodState,
} from '../features/transactions/TransactionsScreen';
import { colors, spacing, typography } from '../theme/tokens';
import type { MainDrawerParamList, RootStackParamList } from './routes';

type RootScreenKey =
  | 'dashboard'
  | 'accounts'
  | 'transactions'
  | 'stats'
  | 'budgets'
  | 'recurring'
  | 'templates'
  | 'settings';

type LegacyDrawerScreenProps = {
  rootScreen: RootScreenKey;
};

export function HomeDrawerScreen() {
  return <LegacyDrawerScreen rootScreen="dashboard" />;
}

export function AccountsDrawerScreen() {
  return <LegacyDrawerScreen rootScreen="accounts" />;
}

export function TransactionsDrawerScreen() {
  return <LegacyDrawerScreen rootScreen="transactions" />;
}

export function StatisticsDrawerScreen() {
  return <LegacyDrawerScreen rootScreen="stats" />;
}

export function BudgetsDrawerScreen() {
  return <LegacyDrawerScreen rootScreen="budgets" />;
}

export function RecurringDrawerScreen() {
  return <LegacyDrawerScreen rootScreen="recurring" />;
}

export function TemplatesDrawerScreen() {
  return <LegacyDrawerScreen rootScreen="templates" />;
}

export function SettingsDrawerScreen() {
  return <LegacyDrawerScreen rootScreen="settings" />;
}

function LegacyDrawerScreen({ rootScreen }: LegacyDrawerScreenProps) {
  const navigation = useNavigation<DrawerNavigationProp<MainDrawerParamList>>();
  const rootNavigation = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const [transactionPeriodState, setTransactionPeriodState] = useState<TransactionPeriodState>(
    createDefaultTransactionPeriodState,
  );
  const { snapshot, derived, actions, loading, error } = useRainproofDataContext();
  const shouldHideDrawerHeader = loading || !snapshot || !derived.rainyDayProgress;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: !shouldHideDrawerHeader,
    });
  }, [navigation, shouldHideDrawerHeader]);

  if (loading || !snapshot || !derived.rainyDayProgress) {
    return (
      <SafeAreaView style={styles.loadingShell}>
        <StatusBar style="dark" />
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Preparing Rainproof</Text>
        {error ? <FormError message={error} /> : null}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.shell}>
      <StatusBar style="dark" />
      {error ? <View style={styles.errorWrap}><FormError message={error} /></View> : null}

      {rootScreen === 'accounts' ? (
        <View style={styles.paddedContent}>
          <AccountsScreen
            snapshot={snapshot}
            accountBalances={derived.accountBalances}
            showHeader={false}
            onAddAccount={() => rootNavigation?.navigate('AddAccount')}
            onEditAccount={(accountId) => rootNavigation?.navigate('EditAccount', { accountId })}
            onUpdateAccountDashboardVisibility={actions.updateAccountDashboardVisibility}
            onUpdateAccountOrder={actions.updateAccountOrder}
          />
        </View>
      ) : rootScreen === 'dashboard' ? (
        <DashboardScreen
          snapshot={snapshot}
          accountBalances={derived.accountBalances}
          rainyDayProgress={derived.rainyDayProgress}
          onAddAccount={() => rootNavigation?.navigate('AddAccount')}
          onAddTransaction={(params) => rootNavigation?.navigate('AddTransaction', params)}
          onOpenRainyDayFund={() => rootNavigation?.navigate('RainyDayFund')}
          onOpenTransactions={() => navigation.navigate('Transactions')}
          onOpenTransaction={(transactionId) => rootNavigation?.navigate('EditTransaction', { transactionId })}
          onOpenAccount={() => navigation.navigate('Accounts')}
          onOpenBudgets={() => navigation.navigate('Budgets')}
          onOpenDashboardEdit={() => rootNavigation?.navigate('DashboardEdit')}
          onOpenRecurring={() => navigation.navigate('Recurring')}
          onOpenTemplates={() => navigation.navigate('Templates')}
          onUpdateSelectedAccountIds={actions.updateDashboardSelectedAccountIds}
        />
      ) : rootScreen === 'stats' ? (
        <StatsScreen
          snapshot={snapshot}
          onOpenTransaction={(transactionId) => rootNavigation?.navigate('EditTransaction', { transactionId })}
          onOpenStatsDrilldown={(params) => rootNavigation?.navigate('StatsDrilldown', params)}
          showHeader={false}
        />
      ) : rootScreen === 'transactions' ? (
        <TransactionsScreen
          snapshot={snapshot}
          periodState={transactionPeriodState}
          onPeriodStateChange={setTransactionPeriodState}
          onOpenTransaction={(transactionId) => rootNavigation?.navigate('EditTransaction', { transactionId })}
          showHeader={false}
        />
      ) : rootScreen === 'budgets' ? (
        <BudgetsScreen
          snapshot={snapshot}
          onAddBudget={() => rootNavigation?.navigate('AddBudget')}
          onEditBudget={(budgetId) => rootNavigation?.navigate('EditBudget', { budgetId })}
        />
      ) : rootScreen === 'recurring' ? (
        <RecurringItemsScreen
          snapshot={snapshot}
          onAddRecurringItem={() => rootNavigation?.navigate('AddRecurringItem')}
          onCreateTransaction={(recurringItemId) =>
            rootNavigation?.navigate('CreateRecurringTransaction', { recurringItemId })}
          onEditRecurringItem={(recurringItemId) => rootNavigation?.navigate('EditRecurringItem', { recurringItemId })}
        />
      ) : rootScreen === 'templates' ? (
        <TransactionTemplatesScreen
          snapshot={snapshot}
          onAddTemplate={() => rootNavigation?.navigate('AddTransactionTemplate')}
          onEditTemplate={(templateId) => rootNavigation?.navigate('EditTransactionTemplate', { templateId })}
          onUseTemplate={(templateId) => rootNavigation?.navigate('AddTransaction', { templateId })}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.paddedScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SettingsScreen
            snapshot={snapshot}
            onOpenCategoryManagement={() => rootNavigation?.navigate('CategoryManagement')}
            onUpdateSettings={actions.updateSettings}
            showHeader={false}
          />
        </ScrollView>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: colors.background,
    flex: 1,
  },
  loadingShell: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.muted,
    fontSize: typography.body,
    fontWeight: '700',
  },
  errorWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
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
