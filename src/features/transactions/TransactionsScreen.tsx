import { useEffect, useState } from 'react';
import { Keyboard, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CompactAccountSelector } from '../../components/CompactAccountSelector';
import { Card, SectionHeader } from '../../components/ui';
import type { AccountBalance, AppSnapshot } from '../../domain/types';
import { TransactionsBottomControls } from './TransactionsBottomControls';
import { TransactionsListCard } from './TransactionsListCard';
import { shouldCollapseTransactionsAccountSelector } from './transactionsSearchFocus';
import {
  transactionSearchPlaceholderColor,
  transactionsScreenStyles as styles,
} from './TransactionsScreenStyles';
import {
  createDefaultTransactionPeriodState,
  useTransactionsViewModel,
  type TransactionPeriodState,
} from './useTransactionsViewModel';

type TransactionsScreenProps = {
  accountBalances: AccountBalance[];
  snapshot: AppSnapshot;
  defaultSelectedAccountIds?: string[];
  periodState: TransactionPeriodState;
  onPeriodStateChange: (periodState: TransactionPeriodState) => void;
  onOpenTransaction: (transactionId: string) => void;
  showHeader?: boolean;
};

export { createDefaultTransactionPeriodState };
export type { TransactionPeriodState };

export function TransactionsScreen({
  accountBalances,
  snapshot,
  defaultSelectedAccountIds,
  periodState,
  onPeriodStateChange,
  onOpenTransaction,
  showHeader = true,
}: TransactionsScreenProps) {
  const insets = useSafeAreaInsets();
  const [searchFocused, setSearchFocused] = useState(false);
  const keyboardVisible = useKeyboardVisible();
  const viewModel = useTransactionsViewModel({
    bottomInset: insets.bottom,
    defaultSelectedAccountIds,
    onPeriodStateChange,
    periodState,
    snapshot,
  });
  const contextAccountId = viewModel.selectedAccountIds.length === 1 ? viewModel.selectedAccountIds[0] : undefined;
  const collapseAccountSelector = shouldCollapseTransactionsAccountSelector({
    keyboardVisible,
    searchFocused,
  });

  return (
    <View style={styles.screen}>
      <View style={styles.fixedFilter}>
        {showHeader ? (
          <SectionHeader title="Transactions" detail="Review transactions by period and account." />
        ) : null}

        {!collapseAccountSelector ? (
          <CompactAccountSelector
            accounts={viewModel.selectableAccounts}
            accountBalances={accountBalances}
            selectedAccountIds={viewModel.selectedAccountIds}
            title="Accounts"
            onClearSelection={viewModel.clearSelectedAccounts}
            onSelectAll={viewModel.selectAllAccounts}
            onToggleAccount={viewModel.toggleAccount}
            testID="transactions-account-selector"
          />
        ) : null}

        <TransactionSearchCard
          onBlur={() => setSearchFocused(false)}
          onFocus={() => setSearchFocused(true)}
          onSearchQueryChange={viewModel.setSearchQuery}
          searchQuery={viewModel.searchQuery}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: viewModel.bottomPadding }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TransactionsListCard
          accounts={snapshot.accounts}
          balanceAfterByEntryId={viewModel.balanceAfterByEntryId}
          categories={viewModel.categories}
          contextAccountId={contextAccountId}
          emptyMessage={viewModel.emptyMessage}
          groups={viewModel.groups}
          onOpenTransaction={onOpenTransaction}
          showCurrencyCodes={viewModel.showCurrencyCodes}
        />
      </ScrollView>

      <TransactionsBottomControls
        datePickerTarget={viewModel.datePickerTarget}
        onCloseDatePicker={() => viewModel.setDatePickerTarget(null)}
        onDatePickerChange={viewModel.handleDatePickerChange}
        onOpenDatePicker={viewModel.setDatePickerTarget}
        onSelectPeriodOption={viewModel.selectPeriodOption}
        periodState={periodState}
        selectedPeriodOption={viewModel.selectedPeriodOption}
      />
    </View>
  );
}

function useKeyboardVisible(): boolean {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return keyboardVisible;
}

function TransactionSearchCard({
  onBlur,
  onFocus,
  onSearchQueryChange,
  searchQuery,
}: {
  onBlur: () => void;
  onFocus: () => void;
  onSearchQueryChange: (query: string) => void;
  searchQuery: string;
}) {
  return (
    <Card style={styles.searchCard}>
      <TextInput
        accessibilityLabel="Search transactions"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        onBlur={onBlur}
        onChangeText={onSearchQueryChange}
        onFocus={onFocus}
        placeholder="Search item, split line, category, account"
        placeholderTextColor={transactionSearchPlaceholderColor}
        returnKeyType="search"
        style={styles.searchInput}
        value={searchQuery}
      />
    </Card>
  );
}
