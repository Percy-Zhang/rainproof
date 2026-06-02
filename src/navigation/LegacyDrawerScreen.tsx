import { StatusBar } from 'expo-status-bar';
import { useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRainproofDataContext } from '../application/RainproofDataProvider';
import { FormError } from '../components/ui';
import { getDashboardDefaultSelectedAccountIds } from '../domain/dashboard';
import {
  createDefaultTransactionPeriodState,
  type TransactionPeriodState,
} from '../features/transactions/TransactionsScreen';
import { colors, spacing, typography } from '../theme/tokens';
import { DrawerRouteAdapter, type DrawerRootScreenKey } from './DrawerRouteAdapters';
import { type RootStackNavigation, useMainDrawerNavigation } from './routeHooks';

type LegacyDrawerScreenProps = {
  rootScreen: DrawerRootScreenKey;
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
  const navigation = useMainDrawerNavigation();
  const rootNavigation = navigation.getParent<RootStackNavigation>();
  const [transactionPeriodState, setTransactionPeriodState] = useState<TransactionPeriodState>(
    createDefaultTransactionPeriodState,
  );
  const { snapshot, derived, actions, loading, error } = useRainproofDataContext();
  const defaultDashboardSelectedAccountIds = useMemo(
    () =>
      snapshot
        ? getDashboardDefaultSelectedAccountIds({
            accountBalances: derived.accountBalances,
            fallbackAccounts: snapshot.accounts,
            storedSelectedAccountIds: snapshot.settings.dashboardSelectedAccountIds,
          })
        : [],
    [derived.accountBalances, snapshot],
  );
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
      <DrawerRouteAdapter
        accountBalances={derived.accountBalances}
        actions={actions}
        defaultSelectedAccountIds={defaultDashboardSelectedAccountIds}
        drawerNavigation={navigation}
        rainyDayProgress={derived.rainyDayProgress}
        rootNavigation={rootNavigation}
        rootScreen={rootScreen}
        snapshot={snapshot}
        transactionPeriodState={transactionPeriodState}
        onPeriodStateChange={setTransactionPeriodState}
      />
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
});
