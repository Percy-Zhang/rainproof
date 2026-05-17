import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { useRainproofData } from './src/application/useRainproofData';
import { AppDrawer, type DrawerNavigationItem } from './src/components/AppDrawer';
import {
  BackScreenScaffold,
  ComposerScreenScaffold,
  DashboardScrollScaffold,
  EdgeScreenScaffold,
} from './src/components/ScreenScaffold';
import { FormError } from './src/components/ui';
import { AccountFormScreen } from './src/features/accounts/AccountFormScreen';
import { AccountsScreen } from './src/features/accounts/AccountsScreen';
import { DashboardScreen } from './src/features/dashboard/DashboardScreen';
import { RainyDayFundScreen } from './src/features/rainyDay/RainyDayFundScreen';
import { SettingsScreen } from './src/features/settings/SettingsScreen';
import { StatsScreen } from './src/features/stats/StatsScreen';
import { AddTransactionScreen } from './src/features/transactions/AddTransactionScreen';
import { EditTransactionScreen } from './src/features/transactions/EditTransactionScreen';
import { LinkTransactionScreen } from './src/features/transactions/LinkTransactionScreen';
import {
  createDefaultTransactionPeriodState,
  TransactionsScreen,
  type TransactionPeriodState,
} from './src/features/transactions/TransactionsScreen';
import { colors, spacing, typography } from './src/theme/tokens';

type ScreenKey =
  | 'dashboard'
  | 'accounts'
  | 'addAccount'
  | 'editAccount'
  | 'transactions'
  | 'addTransaction'
  | 'editTransaction'
  | 'linkTransaction'
  | 'stats'
  | 'rainyDayFund'
  | 'settings';

const drawerItems: DrawerNavigationItem<ScreenKey>[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid-outline' },
  { key: 'accounts', label: 'Accounts', icon: 'wallet-outline' },
  { key: 'transactions', label: 'Transactions', icon: 'receipt-outline' },
  { key: 'stats', label: 'Stats', icon: 'bar-chart-outline' },
];

const drawerSettingsItem: DrawerNavigationItem<ScreenKey> = {
  key: 'settings',
  label: 'Settings',
  icon: 'settings-outline',
};

export default function App() {
  const [screen, setScreen] = useState<ScreenKey>('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState('');
  const [accountReturnScreen, setAccountReturnScreen] = useState<ScreenKey>('accounts');
  const [editingTransactionId, setEditingTransactionId] = useState('');
  const [transactionReturnScreen, setTransactionReturnScreen] = useState<ScreenKey>('transactions');
  const [transactionPeriodState, setTransactionPeriodState] = useState<TransactionPeriodState>(
    createDefaultTransactionPeriodState,
  );
  const { snapshot, derived, actions, loading, saving, error } = useRainproofData();
  const isComposerScreen =
    screen === 'addTransaction' ||
    screen === 'editTransaction' ||
    screen === 'linkTransaction' ||
    screen === 'addAccount' ||
    screen === 'editAccount';
  const showDashboardChrome = !isComposerScreen && screen === 'dashboard';
  const editingAccount = snapshot?.accounts.find((account) => account.id === editingAccountId);

  function navigate(nextScreen: ScreenKey) {
    setScreen(nextScreen);
    setDrawerOpen(false);
  }

  function openEditTransaction(transactionId: string, returnScreen: ScreenKey) {
    setEditingTransactionId(transactionId);
    setTransactionReturnScreen(returnScreen);
    setScreen('editTransaction');
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (drawerOpen) {
        setDrawerOpen(false);
        return true;
      }

      if (screen === 'addAccount') {
        setScreen(accountReturnScreen);
        return true;
      }

      if (screen === 'editAccount') {
        setScreen('accounts');
        return true;
      }

      if (screen === 'linkTransaction') {
        setScreen('editTransaction');
        return true;
      }

      if (screen === 'addTransaction' || screen === 'editTransaction') {
        return false;
      }

      if (screen !== 'dashboard') {
        setScreen('dashboard');
        return true;
      }

      return false;
    });

    return () => subscription.remove();
  }, [accountReturnScreen, drawerOpen, screen]);

  if (loading || !snapshot || !derived.rainyDayProgress) {
    return (
      <GestureHandlerRootView style={styles.gestureRoot}>
        <SafeAreaProvider>
          <SafeAreaView style={styles.loadingShell}>
            <StatusBar style="dark" />
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Preparing Rainproof</Text>
            {error ? <FormError message={error} /> : null}
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.shell}>
        <StatusBar style="dark" />
        {showDashboardChrome ? (
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDrawerOpen(true)}
              style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
              testID="open-drawer"
            >
              <Ionicons name="menu-outline" size={28} color={colors.primaryDark} />
            </Pressable>
            <View style={styles.headerText}>
              <Text style={styles.appName}>Rainproof</Text>
              <Text style={styles.subtitle}>Protect yourself from rainy days</Text>
            </View>
            <View style={styles.savingSlot}>
              {saving ? <Text style={styles.saving}>Saving</Text> : null}
            </View>
          </View>
        ) : null}

        {error && !isComposerScreen ? <View style={styles.errorWrap}><FormError message={error} /></View> : null}

        {isComposerScreen ? (
          <ComposerScreenScaffold screenKey={screen}>
            {screen === 'addTransaction' ? (
              <AddTransactionScreen
                snapshot={snapshot}
                onAddTransaction={actions.addTransaction}
                onDone={() => setScreen('dashboard')}
              />
            ) : null}

            {screen === 'editTransaction' && editingTransactionId ? (
              <EditTransactionScreen
                snapshot={snapshot}
                transactionId={editingTransactionId}
                onUpdateTransaction={actions.updateTransaction}
                onDeleteTransaction={actions.deleteTransaction}
                onUpdateTransactionLink={actions.updateTransactionLink}
                onDeleteTransactionLink={actions.deleteTransactionLink}
                onOpenTransactionLink={() => setScreen('linkTransaction')}
                onCancel={() => setScreen(transactionReturnScreen)}
                onDone={() => setScreen(transactionReturnScreen)}
              />
            ) : null}

            {screen === 'linkTransaction' && editingTransactionId ? (
              <LinkTransactionScreen
                snapshot={snapshot}
                transactionId={editingTransactionId}
                onAddTransactionLink={actions.addTransactionLink}
                onUpdateTransactionLink={actions.updateTransactionLink}
                onDeleteTransactionLink={actions.deleteTransactionLink}
                onBack={() => setScreen('editTransaction')}
              />
            ) : null}

            {screen === 'addAccount' ? (
              <AccountFormScreen
                mode="add"
                snapshot={snapshot}
                onAddAccount={actions.addAccount}
                onCancel={() => setScreen(accountReturnScreen)}
                onDone={() => setScreen(accountReturnScreen)}
              />
            ) : null}

            {screen === 'editAccount' && editingAccount ? (
              <AccountFormScreen
                mode="edit"
                snapshot={snapshot}
                account={editingAccount}
                onUpdateAccount={actions.updateAccount}
                onCloseAccount={actions.closeAccount}
                onReopenAccount={actions.reopenAccount}
                onDeleteAccount={actions.deleteAccount}
                onCancel={() => setScreen('accounts')}
                onDone={() => setScreen('accounts')}
              />
            ) : null}
          </ComposerScreenScaffold>
        ) : screen === 'accounts' ? (
          <BackScreenScaffold screenKey={screen} onBack={() => setScreen('dashboard')}>
            <AccountsScreen
              snapshot={snapshot}
              accountBalances={derived.accountBalances}
              onAddAccount={() => {
                setAccountReturnScreen('accounts');
                setScreen('addAccount');
              }}
              onEditAccount={(accountId) => {
                setEditingAccountId(accountId);
                setScreen('editAccount');
              }}
              onUpdateAccountDashboardVisibility={actions.updateAccountDashboardVisibility}
              onUpdateAccountOrder={actions.updateAccountOrder}
            />
          </BackScreenScaffold>
        ) : screen === 'dashboard' ? (
          <DashboardScrollScaffold screenKey={screen}>
            <DashboardScreen
              snapshot={snapshot}
              accountBalances={derived.accountBalances}
              rainyDayProgress={derived.rainyDayProgress}
              onAddAccount={() => {
                setAccountReturnScreen('dashboard');
                setScreen('addAccount');
              }}
              onOpenRainyDayFund={() => setScreen('rainyDayFund')}
              onOpenTransactions={() => setScreen('transactions')}
              onOpenTransaction={(transactionId) => openEditTransaction(transactionId, 'dashboard')}
              onOpenAccount={() => setScreen('accounts')}
              onUpdateSelectedAccountIds={actions.updateDashboardSelectedAccountIds}
            />
          </DashboardScrollScaffold>
        ) : screen === 'stats' || screen === 'transactions' ? (
          <EdgeScreenScaffold screenKey={screen} onBack={() => setScreen('dashboard')}>
            {screen === 'stats' ? (
              <StatsScreen snapshot={snapshot} />
            ) : (
              <TransactionsScreen
                snapshot={snapshot}
                periodState={transactionPeriodState}
                onPeriodStateChange={setTransactionPeriodState}
                onOpenTransaction={(transactionId) => openEditTransaction(transactionId, 'transactions')}
              />
            )}
          </EdgeScreenScaffold>
        ) : (
          <BackScreenScaffold screenKey={screen} onBack={() => setScreen('dashboard')} scroll>
              {screen === 'rainyDayFund' ? (
                <RainyDayFundScreen
                  snapshot={snapshot}
                  accountBalances={derived.accountBalances}
                  rainyDayProgress={derived.rainyDayProgress}
                  onUpdateRainyDayFund={actions.updateRainyDayFund}
                />
              ) : null}

              {screen === 'settings' ? (
                <SettingsScreen
                  snapshot={snapshot}
                  onUpdateCategoryCatalog={actions.updateCategoryCatalog}
                  onUpdateSettings={actions.updateSettings}
                />
              ) : null}
          </BackScreenScaffold>
        )}

        {!isComposerScreen && screen === 'dashboard' ? (
          <Pressable
            accessibilityLabel="Add transaction"
            accessibilityRole="button"
            onPress={() => setScreen('addTransaction')}
            style={({ pressed }) => [styles.floatingAddButton, pressed && styles.pressed]}
            testID="dashboard-add-transaction"
          >
            <Ionicons name="add" size={30} color={colors.surface} />
          </Pressable>
        ) : null}

        <AppDrawer
          items={drawerItems}
          onClose={() => setDrawerOpen(false)}
          onNavigate={navigate}
          selectedKey={screen}
          settingsItem={drawerSettingsItem}
          visible={drawerOpen}
        />
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
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
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
  },
  menuButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerText: {
    flex: 1,
  },
  appName: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.body,
  },
  saving: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '800',
  },
  savingSlot: {
    alignItems: 'flex-end',
    minWidth: 48,
  },
  errorWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  floatingAddButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    bottom: spacing.xl,
    elevation: 7,
    height: 58,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    width: 58,
    zIndex: 20,
  },
  pressed: {
    opacity: 0.78,
  },
});
