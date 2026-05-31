import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SectionHeader } from '../../components/ui';
import type { AppSnapshot } from '../../domain/types';
import { TransactionsBottomControls } from './TransactionsBottomControls';
import { TransactionsListCard } from './TransactionsListCard';
import { transactionsScreenStyles as styles } from './TransactionsScreenStyles';
import {
  createDefaultTransactionPeriodState,
  useTransactionsViewModel,
  type TransactionPeriodState,
} from './useTransactionsViewModel';

type TransactionsScreenProps = {
  snapshot: AppSnapshot;
  periodState: TransactionPeriodState;
  onPeriodStateChange: (periodState: TransactionPeriodState) => void;
  onOpenTransaction: (transactionId: string) => void;
  showHeader?: boolean;
};

export { createDefaultTransactionPeriodState };
export type { TransactionPeriodState };

export function TransactionsScreen({
  snapshot,
  periodState,
  onPeriodStateChange,
  onOpenTransaction,
  showHeader = true,
}: TransactionsScreenProps) {
  const insets = useSafeAreaInsets();
  const viewModel = useTransactionsViewModel({
    bottomInset: insets.bottom,
    onPeriodStateChange,
    periodState,
    snapshot,
  });
  const contextAccountId = viewModel.selectedAccountIds.length === 1 ? viewModel.selectedAccountIds[0] : undefined;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: viewModel.bottomPadding }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {showHeader ? (
          <SectionHeader title="Transactions" detail="Review transactions by period and account." />
        ) : null}

        <TransactionsListCard
          accounts={snapshot.accounts}
          balanceAfterByEntryId={viewModel.balanceAfterByEntryId}
          categories={viewModel.categories}
          contextAccountId={contextAccountId}
          emptyMessage={viewModel.emptyMessage}
          groups={viewModel.groups}
          onOpenTransaction={onOpenTransaction}
          onSearchQueryChange={viewModel.setSearchQuery}
          searchQuery={viewModel.searchQuery}
          showCurrencyCodes={viewModel.showCurrencyCodes}
        />
      </ScrollView>

      <TransactionsBottomControls
        accounts={snapshot.accounts}
        allAccountsSelected={viewModel.allAccountsSelected}
        datePickerTarget={viewModel.datePickerTarget}
        onCloseDatePicker={() => viewModel.setDatePickerTarget(null)}
        onDatePickerChange={viewModel.handleDatePickerChange}
        onOpenDatePicker={viewModel.setDatePickerTarget}
        onPressAccount={viewModel.toggleAccount}
        onPressAll={viewModel.toggleAllAccounts}
        onSelectPeriodOption={viewModel.selectPeriodOption}
        periodState={periodState}
        selectedAccountIds={viewModel.selectedAccountIds}
        selectedPeriodOption={viewModel.selectedPeriodOption}
        showCurrencyCodes={viewModel.showCurrencyCodes}
      />
    </View>
  );
}
