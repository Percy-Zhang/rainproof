import { Text, TextInput, View } from 'react-native';

import { Card } from '../../components/ui';
import {
  formatTransactionCurrencyTotals,
  getTransactionGroupCurrencyTotals,
  type TransactionDisplayGroup,
} from '../../domain/transactionList';
import type { Account, CategoryDefinition } from '../../domain/types';
import {
  transactionSearchPlaceholderColor,
  transactionsScreenStyles as styles,
} from './TransactionsScreenStyles';
import { TransactionListItem } from './TransactionListItems';

export function TransactionsListCard({
  accounts,
  balanceAfterByEntryId,
  categories,
  contextAccountId,
  emptyMessage,
  groups,
  onOpenTransaction,
  onSearchQueryChange,
  searchQuery,
  showCurrencyCodes,
}: {
  accounts: Account[];
  balanceAfterByEntryId: Record<string, number>;
  categories: CategoryDefinition[];
  contextAccountId?: string;
  emptyMessage: string;
  groups: TransactionDisplayGroup[];
  onOpenTransaction: (transactionId: string) => void;
  onSearchQueryChange: (query: string) => void;
  searchQuery: string;
  showCurrencyCodes: boolean;
}) {
  return (
    <Card testID="transaction-list-card">
      <Text style={styles.cardTitle}>Transactions</Text>
      <TextInput
        accessibilityLabel="Search transactions"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        onChangeText={onSearchQueryChange}
        placeholder="Search item, split line, category, account"
        placeholderTextColor={transactionSearchPlaceholderColor}
        returnKeyType="search"
        style={styles.searchInput}
        value={searchQuery}
      />

      {groups.length ? (
        <View style={styles.groups}>
          {groups.map((group) => (
            <TransactionGroupSection
              key={group.key}
              accounts={accounts}
              balanceAfterByEntryId={balanceAfterByEntryId}
              categories={categories}
              contextAccountId={contextAccountId}
              group={group}
              onOpenTransaction={onOpenTransaction}
              showCurrencyCodes={showCurrencyCodes}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      )}
    </Card>
  );
}

function TransactionGroupSection({
  accounts,
  balanceAfterByEntryId,
  categories,
  contextAccountId,
  group,
  onOpenTransaction,
  showCurrencyCodes,
}: {
  accounts: Account[];
  balanceAfterByEntryId: Record<string, number>;
  categories: CategoryDefinition[];
  contextAccountId?: string;
  group: TransactionDisplayGroup;
  onOpenTransaction: (transactionId: string) => void;
  showCurrencyCodes: boolean;
}) {
  return (
    <View style={styles.group}>
      <GroupBreak
        group={group}
        showCurrencyCodes={showCurrencyCodes}
      />
      <View style={styles.transactionRows}>
        {group.entries.map((entry, index) => (
          <TransactionListItem
            key={entry.id}
            entry={entry}
            accounts={accounts}
            categories={categories}
            balanceAfterMinor={balanceAfterByEntryId[entry.id] ?? 0}
            contextAccountId={contextAccountId}
            firstInGroup={index === 0}
            showCurrencyCodes={showCurrencyCodes}
            onPress={() => onOpenTransaction(entry.transaction.id)}
          />
        ))}
      </View>
    </View>
  );
}

function GroupBreak({
  group,
  showCurrencyCodes,
}: {
  group: TransactionDisplayGroup;
  showCurrencyCodes: boolean;
}) {
  const netTotals = getTransactionGroupCurrencyTotals(group.entries);

  return (
    <View style={styles.groupBreak}>
      <Text style={styles.groupTitle}>{group.label}</Text>
      <Text style={styles.groupTotal}>Total: {formatTransactionCurrencyTotals(netTotals, showCurrencyCodes)}</Text>
    </View>
  );
}
