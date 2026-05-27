import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRainproofDataContext } from '../application/RainproofDataProvider';
import { ComposerScreenScaffold } from '../components/ScreenScaffold';
import { FormError } from '../components/ui';
import { AccountFormScreen } from '../features/accounts/AccountFormScreen';
import { BudgetFormScreen } from '../features/budgets/BudgetFormScreen';
import {
  createCategorySelectionRequestId,
  useCategorySelectionRequests,
} from '../features/categorySelection/CategorySelectionContext';
import { CategorySelectScreen } from '../features/categorySelection/CategorySelectScreen';
import type {
  CategorySelectLaunchParams,
  CategorySelectionResult,
} from '../features/categorySelection/categorySelectionModel';
import { RainyDayFundScreen } from '../features/rainyDay/RainyDayFundScreen';
import { RecurringItemFormScreen } from '../features/recurring/RecurringItemFormScreen';
import { RecurringTransactionReviewScreen } from '../features/recurring/RecurringTransactionReviewScreen';
import { DashboardCardsScreen } from '../features/settings/DashboardCardsScreen';
import { StatsDrilldownScreen } from '../features/stats/StatsDrilldownScreen';
import { AddTransactionScreen } from '../features/transactions/AddTransactionScreen';
import { EditTransactionScreen } from '../features/transactions/EditTransactionScreen';
import { LinkTransactionScreen } from '../features/transactions/LinkTransactionScreen';
import { colors, spacing, typography } from '../theme/tokens';
import type { RootStackParamList } from './routes';

type RootStackNavigation = NativeStackNavigationProp<RootStackParamList>;
type OpenCategorySelect = (
  params: CategorySelectLaunchParams,
  onSelect: (selection: CategorySelectionResult) => void,
) => void;

function useOpenCategorySelect(navigation: RootStackNavigation): OpenCategorySelect {
  const { registerCategorySelectionRequest } = useCategorySelectionRequests();

  return useCallback((params, onSelect) => {
    const requestId = createCategorySelectionRequestId();
    registerCategorySelectionRequest(requestId, onSelect);
    navigation.navigate('CategorySelect', { ...params, requestId });
  }, [navigation, registerCategorySelectionRequest]);
}

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
  const openCategorySelect = useOpenCategorySelect(navigation);

  if (!snapshot) {
    return <MissingDataShell message="Preparing Rainproof" />;
  }

  return (
    <DetailSafeArea>
      <ComposerScreenScaffold screenKey="addTransaction">
        <AddTransactionScreen
          snapshot={snapshot}
          onAddTransaction={actions.addTransaction}
          onOpenCategorySelect={openCategorySelect}
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
  const openCategorySelect = useOpenCategorySelect(navigation);

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
          onOpenCategorySelect={openCategorySelect}
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
    <DetailSafeArea>
      <ComposerScreenScaffold screenKey="linkTransaction">
        <LinkTransactionScreen
          snapshot={snapshot}
          transactionId={route.params.transactionId}
          onAddTransactionLink={actions.addTransactionLink}
          onUpdateTransactionLink={actions.updateTransactionLink}
          onDeleteTransactionLink={actions.deleteTransactionLink}
          onBack={() => navigation.goBack()}
        />
      </ComposerScreenScaffold>
    </DetailSafeArea>
  );
}

export function StatsDrilldownRouteScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'StatsDrilldown'>>();
  const { snapshot } = useRainproofDataContext();

  if (!snapshot) {
    return <MissingDataShell message="Preparing Rainproof" />;
  }

  return (
    <DetailSafeArea testID="screen-statsDrilldown">
      <StatsDrilldownScreen
        snapshot={snapshot}
        params={route.params}
        onOpenTransaction={(transactionId) => navigation.navigate('EditTransaction', { transactionId })}
        onBack={() => navigation.goBack()}
      />
    </DetailSafeArea>
  );
}

export function RainyDayFundRouteScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const { snapshot, derived, actions } = useRainproofDataContext();

  if (!snapshot || !derived.rainyDayProgress) {
    return <MissingDataShell message="Preparing Rainproof" />;
  }

  return (
    <DetailSafeArea testID="screen-rainyDayFund">
      <View style={styles.detailTopBar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.detailTitle}>Rainy day fund</Text>
        <View style={styles.headerSpacer} />
      </View>
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
    </DetailSafeArea>
  );
}

export function AddBudgetRouteScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const { snapshot, actions } = useRainproofDataContext();
  const openCategorySelect = useOpenCategorySelect(navigation);

  if (!snapshot) {
    return <MissingDataShell message="Preparing Rainproof" />;
  }

  return (
    <DetailSafeArea>
      <ComposerScreenScaffold screenKey="addBudget">
        <BudgetFormScreen
          mode="add"
          snapshot={snapshot}
          onAddBudget={actions.addBudget}
          onOpenCategorySelect={openCategorySelect}
          onCancel={() => navigation.goBack()}
          onDone={() => navigation.goBack()}
        />
      </ComposerScreenScaffold>
    </DetailSafeArea>
  );
}

export function EditBudgetRouteScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'EditBudget'>>();
  const { snapshot, actions } = useRainproofDataContext();
  const budget = snapshot?.budgets.find((item) => item.id === route.params.budgetId);
  const openCategorySelect = useOpenCategorySelect(navigation);

  if (!snapshot) {
    return <MissingDataShell message="Preparing Rainproof" />;
  }

  if (!budget) {
    return <MissingDataShell message="Budget not found." />;
  }

  return (
    <DetailSafeArea>
      <ComposerScreenScaffold screenKey="editBudget">
        <BudgetFormScreen
          mode="edit"
          snapshot={snapshot}
          budget={budget}
          onUpdateBudget={actions.updateBudget}
          onArchiveBudget={actions.archiveBudget}
          onOpenCategorySelect={openCategorySelect}
          onCancel={() => navigation.goBack()}
          onDone={() => navigation.goBack()}
        />
      </ComposerScreenScaffold>
    </DetailSafeArea>
  );
}

export function AddRecurringItemRouteScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const { snapshot, actions } = useRainproofDataContext();
  const openCategorySelect = useOpenCategorySelect(navigation);

  if (!snapshot) {
    return <MissingDataShell message="Preparing Rainproof" />;
  }

  return (
    <DetailSafeArea>
      <ComposerScreenScaffold screenKey="addRecurringItem">
        <RecurringItemFormScreen
          mode="add"
          snapshot={snapshot}
          onAddRecurringItem={actions.addRecurringItem}
          onOpenCategorySelect={openCategorySelect}
          onCancel={() => navigation.goBack()}
          onDone={() => navigation.goBack()}
        />
      </ComposerScreenScaffold>
    </DetailSafeArea>
  );
}

export function EditRecurringItemRouteScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'EditRecurringItem'>>();
  const { snapshot, actions } = useRainproofDataContext();
  const recurringItem = snapshot?.recurringItems.find((item) => item.id === route.params.recurringItemId);
  const openCategorySelect = useOpenCategorySelect(navigation);

  if (!snapshot) {
    return <MissingDataShell message="Preparing Rainproof" />;
  }

  if (!recurringItem) {
    return <MissingDataShell message="Recurring item not found." />;
  }

  return (
    <DetailSafeArea>
      <ComposerScreenScaffold screenKey="editRecurringItem">
        <RecurringItemFormScreen
          mode="edit"
          snapshot={snapshot}
          recurringItem={recurringItem}
          onUpdateRecurringItem={actions.updateRecurringItem}
          onArchiveRecurringItem={actions.archiveRecurringItem}
          onOpenCategorySelect={openCategorySelect}
          onCancel={() => navigation.goBack()}
          onDone={() => navigation.goBack()}
        />
      </ComposerScreenScaffold>
    </DetailSafeArea>
  );
}

export function CreateRecurringTransactionRouteScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'CreateRecurringTransaction'>>();
  const { snapshot, actions } = useRainproofDataContext();
  const recurringItem = snapshot?.recurringItems.find((item) => item.id === route.params.recurringItemId);
  const openCategorySelect = useOpenCategorySelect(navigation);

  if (!snapshot) {
    return <MissingDataShell message="Preparing Rainproof" />;
  }

  if (!recurringItem) {
    return <MissingDataShell message="Recurring item not found." />;
  }

  if (!recurringItem.isActive) {
    return <MissingDataShell message="Recurring item is archived." />;
  }

  return (
    <DetailSafeArea>
      <ComposerScreenScaffold screenKey="createRecurringTransaction">
        <RecurringTransactionReviewScreen
          snapshot={snapshot}
          recurringItem={recurringItem}
          onAddTransaction={actions.addTransaction}
          onUpdateRecurringItem={actions.updateRecurringItem}
          onOpenCategorySelect={openCategorySelect}
          onCancel={() => navigation.goBack()}
          onDone={() => navigation.goBack()}
        />
      </ComposerScreenScaffold>
    </DetailSafeArea>
  );
}

export function CategorySelectRouteScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'CategorySelect'>>();
  const { snapshot } = useRainproofDataContext();
  const {
    hasCategorySelectionRequest,
    resolveCategorySelectionRequest,
    unregisterCategorySelectionRequest,
  } = useCategorySelectionRequests();
  const requestId = route.params.requestId;
  const requestExists = hasCategorySelectionRequest(requestId);

  useEffect(() => {
    if (!requestExists) {
      navigation.goBack();
    }

    return () => unregisterCategorySelectionRequest(requestId);
  }, [navigation, requestExists, requestId, unregisterCategorySelectionRequest]);

  if (!snapshot) {
    return <MissingDataShell message="Preparing Rainproof" />;
  }

  if (!requestExists) {
    return <MissingDataShell message="Category selection expired." />;
  }

  return (
    <DetailSafeArea>
      <ComposerScreenScaffold screenKey="categorySelect">
        <CategorySelectScreen
          categories={snapshot.categories}
          kind={route.params.kind}
          selectedCategoryId={route.params.selectedCategoryId}
          selectedSubcategoryId={route.params.selectedSubcategoryId}
          selectionMode={route.params.selectionMode}
          showSuggestions={route.params.showSuggestions}
          title={route.params.title}
          transactions={snapshot.transactions}
          transactionLines={snapshot.transactionLines}
          onBack={() => navigation.goBack()}
          onCancel={() => navigation.goBack()}
          onSelect={(selection) => {
            if (resolveCategorySelectionRequest(requestId, selection)) {
              navigation.goBack();
            }
          }}
        />
      </ComposerScreenScaffold>
    </DetailSafeArea>
  );
}

export function DashboardCardsRouteScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const { snapshot, actions } = useRainproofDataContext();

  if (!snapshot) {
    return <MissingDataShell message="Preparing Rainproof" />;
  }

  return (
    <DetailSafeArea testID="screen-dashboardCards">
      <View style={styles.detailTopBar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.detailTitle}>Dashboard cards</Text>
        <View style={styles.headerSpacer} />
      </View>
      <DashboardCardsScreen
        settings={snapshot.settings.dashboardCardSettings}
        onUpdateSettings={(dashboardCardSettings) =>
          actions.updateDashboardCardSettings({ dashboardCardSettings })}
      />
    </DetailSafeArea>
  );
}

function DetailSafeArea({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <SafeAreaView style={{ backgroundColor: colors.background, flex: 1 }} testID={testID}>
      {children}
    </SafeAreaView>
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
  backButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 40,
    paddingRight: spacing.sm,
    width: 88,
  },
  backButtonText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '800',
  },
  detailTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.h3,
    fontWeight: '900',
    textAlign: 'center',
  },
  detailTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerSpacer: {
    width: 88,
  },
  pressed: {
    opacity: 0.78,
  },
  rainyDayContent: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
