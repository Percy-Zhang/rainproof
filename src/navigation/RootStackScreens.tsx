import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRainproofDataContext } from '../application/RainproofDataProvider';
import { ComposerScreenScaffold } from '../components/ScreenScaffold';
import { FormError } from '../components/ui';
import { AccountFormScreen } from '../features/accounts/AccountFormScreen';
import { RainyDayFundScreen } from '../features/rainyDay/RainyDayFundScreen';
import { AddTransactionScreen } from '../features/transactions/AddTransactionScreen';
import { EditTransactionScreen } from '../features/transactions/EditTransactionScreen';
import { LinkTransactionScreen } from '../features/transactions/LinkTransactionScreen';
import { colors, spacing } from '../theme/tokens';
import type { RootStackParamList } from './routes';

type RootStackNavigation = NativeStackNavigationProp<RootStackParamList>;

export function AddAccountRouteScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const { snapshot, actions } = useRainproofDataContext();

  if (!snapshot) {
    return <MissingDataShell message="Preparing Rainproof" />;
  }

  return (
    <DetailSafeArea>
      <ComposerScreenScaffold screenKey="addAccount">
        <AccountFormScreen
          mode="add"
          snapshot={snapshot}
          onAddAccount={actions.addAccount}
          onCancel={() => navigation.goBack()}
          onDone={() => navigation.goBack()}
        />
      </ComposerScreenScaffold>
    </DetailSafeArea>
  );
}

export function EditAccountRouteScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'EditAccount'>>();
  const { snapshot, actions } = useRainproofDataContext();
  const account = snapshot?.accounts.find((item) => item.id === route.params.accountId);

  if (!snapshot) {
    return <MissingDataShell message="Preparing Rainproof" />;
  }

  if (!account) {
    return <MissingDataShell message="Account not found." />;
  }

  return (
    <DetailSafeArea>
      <ComposerScreenScaffold screenKey="editAccount">
        <AccountFormScreen
          mode="edit"
          snapshot={snapshot}
          account={account}
          onUpdateAccount={actions.updateAccount}
          onCloseAccount={actions.closeAccount}
          onReopenAccount={actions.reopenAccount}
          onDeleteAccount={actions.deleteAccount}
          onCancel={() => navigation.goBack()}
          onDone={() => navigation.goBack()}
        />
      </ComposerScreenScaffold>
    </DetailSafeArea>
  );
}

export function AddTransactionRouteScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const { snapshot, actions } = useRainproofDataContext();

  if (!snapshot) {
    return <MissingDataShell message="Preparing Rainproof" />;
  }

  return (
    <DetailSafeArea>
      <ComposerScreenScaffold screenKey="addTransaction">
        <AddTransactionScreen
          snapshot={snapshot}
          onAddTransaction={actions.addTransaction}
          onDone={() => navigation.goBack()}
        />
      </ComposerScreenScaffold>
    </DetailSafeArea>
  );
}

export function EditTransactionRouteScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'EditTransaction'>>();
  const { snapshot, actions } = useRainproofDataContext();
  const { transactionId } = route.params;

  if (!snapshot) {
    return <MissingDataShell message="Preparing Rainproof" />;
  }

  return (
    <DetailSafeArea>
      <ComposerScreenScaffold screenKey="editTransaction">
        <EditTransactionScreen
          snapshot={snapshot}
          transactionId={transactionId}
          onUpdateTransaction={actions.updateTransaction}
          onDeleteTransaction={actions.deleteTransaction}
          onUpdateTransactionLink={actions.updateTransactionLink}
          onDeleteTransactionLink={actions.deleteTransactionLink}
          onOpenTransactionLink={() => navigation.navigate('LinkTransaction', { transactionId })}
          onCancel={() => navigation.goBack()}
          onDone={() => navigation.goBack()}
        />
      </ComposerScreenScaffold>
    </DetailSafeArea>
  );
}

export function LinkTransactionRouteScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'LinkTransaction'>>();
  const { snapshot, actions } = useRainproofDataContext();

  if (!snapshot) {
    return <MissingDataShell message="Preparing Rainproof" />;
  }

  return (
    <NativeHeaderContent>
      <ComposerScreenScaffold screenKey="linkTransaction">
        <LinkTransactionScreen
          snapshot={snapshot}
          transactionId={route.params.transactionId}
          onAddTransactionLink={actions.addTransactionLink}
          onUpdateTransactionLink={actions.updateTransactionLink}
          onDeleteTransactionLink={actions.deleteTransactionLink}
          onBack={() => navigation.goBack()}
          showHeader={false}
        />
      </ComposerScreenScaffold>
    </NativeHeaderContent>
  );
}

export function RainyDayFundRouteScreen() {
  const { snapshot, derived, actions } = useRainproofDataContext();

  if (!snapshot || !derived.rainyDayProgress) {
    return <MissingDataShell message="Preparing Rainproof" />;
  }

  return (
    <NativeHeaderContent testID="screen-rainyDayFund">
      <ScrollView
        contentContainerStyle={styles.rainyDayContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <RainyDayFundScreen
          snapshot={snapshot}
          accountBalances={derived.accountBalances}
          rainyDayProgress={derived.rainyDayProgress}
          onUpdateRainyDayFund={actions.updateRainyDayFund}
          showHeader={false}
        />
      </ScrollView>
    </NativeHeaderContent>
  );
}

function DetailSafeArea({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={{ backgroundColor: colors.background, flex: 1 }}>
      {children}
    </SafeAreaView>
  );
}

function NativeHeaderContent({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View style={styles.nativeHeaderContent} testID={testID}>
      {children}
    </View>
  );
}

function MissingDataShell({ message }: { message: string }) {
  return (
    <SafeAreaView style={{ backgroundColor: colors.background, flex: 1 }}>
      <FormError message={message} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  nativeHeaderContent: {
    backgroundColor: colors.background,
    flex: 1,
  },
  rainyDayContent: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
