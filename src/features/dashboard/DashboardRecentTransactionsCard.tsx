import { Text, View } from 'react-native';

import { Card } from '../../components/ui';
import type { AppSnapshot, CategoryDefinition } from '../../domain/types';
import { CompactTransactionListItem } from '../transactions/TransactionListItems';
import {
  DashboardHeaderAction,
  dashboardCardStyles,
} from './DashboardCardPrimitives';
import type { DashboardViewModel } from './useDashboardViewModel';

export function RecentTransactionsCard({
  categories,
  recentTransactions,
  selectedAccountIds,
  showCurrencyCodes,
  snapshot,
  onOpenTransaction,
  onOpenTransactions,
}: {
  categories: CategoryDefinition[];
  recentTransactions: DashboardViewModel['recentTransactions'];
  selectedAccountIds: string[];
  showCurrencyCodes: boolean;
  snapshot: AppSnapshot;
  onOpenTransaction: (transactionId: string) => void;
  onOpenTransactions: () => void;
}) {
  return (
    <Card testID="recent-transactions-card" style={dashboardCardStyles.compactCard}>
      <View style={dashboardCardStyles.sectionCardHeader}>
        <Text style={dashboardCardStyles.cardTitle}>Recent transactions</Text>
        <DashboardHeaderAction label="More" onPress={onOpenTransactions} testID="dashboard-more-transactions" />
      </View>
      {recentTransactions.length ? (
        <View>
          {recentTransactions.map((entry, index) => (
            <CompactTransactionListItem
              key={entry.id}
              entry={entry}
              accounts={snapshot.accounts}
              categories={categories}
              first={index === 0}
              contextAccountId={selectedAccountIds.length === 1 ? selectedAccountIds[0] : undefined}
              showCurrencyCodes={showCurrencyCodes}
              onPress={() => onOpenTransaction(entry.transaction.id)}
            />
          ))}
        </View>
      ) : (
        <Text style={dashboardCardStyles.emptyText}>
          {selectedAccountIds.length ? 'No recent transactions for selected accounts.' : 'No accounts selected.'}
        </Text>
      )}
    </Card>
  );
}
