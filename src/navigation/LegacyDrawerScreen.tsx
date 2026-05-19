import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRainproofDataContext } from '../application/RainproofDataProvider';
import { DashboardScrollScaffold } from '../components/ScreenScaffold';
import { FormError } from '../components/ui';
import { AccountsScreen } from '../features/accounts/AccountsScreen';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { StatsScreen } from '../features/stats/StatsScreen';
import {
  createDefaultTransactionPeriodState,
  TransactionsScreen,
  type TransactionPeriodState,
} from '../features/transactions/TransactionsScreen';
import { colors, spacing, typography } from '../theme/tokens';
import type { MainDrawerParamList, RootStackParamList } from './routes';

type RootScreenKey = 'dashboard' | 'accounts' | 'transactions' | 'stats' | 'settings';

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
        <DashboardScrollScaffold screenKey="dashboard">
          <DashboardScreen
            snapshot={snapshot}
            accountBalances={derived.accountBalances}
            rainyDayProgress={derived.rainyDayProgress}
            onAddAccount={() => rootNavigation?.navigate('AddAccount')}
            onOpenRainyDayFund={() => rootNavigation?.navigate('RainyDayFund')}
            onOpenTransactions={() => navigation.navigate('Transactions')}
            onOpenTransaction={(transactionId) => rootNavigation?.navigate('EditTransaction', { transactionId })}
            onOpenAccount={() => navigation.navigate('Accounts')}
            onUpdateSelectedAccountIds={actions.updateDashboardSelectedAccountIds}
          />
        </DashboardScrollScaffold>
      ) : rootScreen === 'stats' ? (
        <StatsScreen snapshot={snapshot} showHeader={false} />
      ) : rootScreen === 'transactions' ? (
        <TransactionsScreen
          snapshot={snapshot}
          periodState={transactionPeriodState}
          onPeriodStateChange={setTransactionPeriodState}
          onOpenTransaction={(transactionId) => rootNavigation?.navigate('EditTransaction', { transactionId })}
          showHeader={false}
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

      {rootScreen === 'dashboard' ? (
        <Pressable
          accessibilityLabel="Add transaction"
          accessibilityRole="button"
          onPress={() => rootNavigation?.navigate('AddTransaction')}
          style={({ pressed }) => [styles.floatingAddButton, pressed && styles.pressed]}
          testID="dashboard-add-transaction"
        >
          <Ionicons name="add" size={30} color={colors.surface} />
        </Pressable>
      ) : null}
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
