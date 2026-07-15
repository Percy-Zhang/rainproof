import { useMemo } from 'react';
import {
  SectionList,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { Card } from '../../components/ui';
import {
  formatTransactionCurrencyTotals,
  getTransactionGroupCurrencyTotals,
  type TransactionDisplayGroup,
} from '../../domain/transactionList';
import type { TransactionDisplayEntry } from '../../domain/aggregates';
import type { Account, CategoryDefinition } from '../../domain/types';
import { transactionsScreenStyles as styles } from './TransactionsScreenStyles';
import { TransactionListItem } from './TransactionListItems';

type TransactionDisplaySection = TransactionDisplayGroup & {
  data: TransactionDisplayEntry[];
};

export function TransactionsListCard({
  accounts,
  balanceAfterByEntryId,
  bottomPadding,
  categories,
  contextAccountId,
  emptyMessage,
  groups,
  isLoading,
  suppressRowAnimations = false,
  onMomentumScrollBegin,
  onMomentumScrollEnd,
  onOpenTransaction,
  onScrollBeginDrag,
  onScrollEndDrag,
  onScrollOffsetChange,
  showCurrencyCodes,
}: {
  accounts: Account[];
  balanceAfterByEntryId: Record<string, number>;
  bottomPadding: number;
  categories: CategoryDefinition[];
  contextAccountId?: string;
  emptyMessage: string;
  groups: TransactionDisplayGroup[];
  isLoading?: boolean;
  suppressRowAnimations?: boolean;
  onMomentumScrollBegin?: (offsetY: number) => void;
  onMomentumScrollEnd?: (offsetY: number) => void;
  onOpenTransaction: (transactionId: string) => void;
  onScrollBeginDrag?: (offsetY: number) => void;
  onScrollEndDrag?: (offsetY: number) => void;
  onScrollOffsetChange?: (offsetY: number) => void;
  showCurrencyCodes: boolean;
}) {
  const sections = useMemo<TransactionDisplaySection[]>(
    () => groups.map((group) => ({ ...group, data: group.entries })),
    [groups],
  );
  const lastSectionKey = sections.length ? sections[sections.length - 1].key : undefined;

  return (
    <Card testID="transaction-list-card" style={styles.transactionListCard}>
      <SectionList<TransactionDisplayEntry, TransactionDisplaySection>
        testID="transactions-section-list"
        sections={sections}
        extraData={suppressRowAnimations}
        keyExtractor={(entry) => entry.id}
        style={styles.transactionSectionList}
        keyboardShouldPersistTaps="handled"
        onMomentumScrollBegin={(event: NativeSyntheticEvent<NativeScrollEvent>) =>
          onMomentumScrollBegin?.(event.nativeEvent.contentOffset.y)}
        onMomentumScrollEnd={(event: NativeSyntheticEvent<NativeScrollEvent>) =>
          onMomentumScrollEnd?.(event.nativeEvent.contentOffset.y)}
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) =>
          onScrollOffsetChange?.(event.nativeEvent.contentOffset.y)}
        onScrollBeginDrag={(event: NativeSyntheticEvent<NativeScrollEvent>) =>
          onScrollBeginDrag?.(event.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(event: NativeSyntheticEvent<NativeScrollEvent>) =>
          onScrollEndDrag?.(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        contentContainerStyle={[styles.transactionSectionListContent, { paddingBottom: bottomPadding }]}
        ListHeaderComponent={<Text style={styles.transactionSectionListTitle}>Transactions</Text>}
        ListEmptyComponent={
          isLoading ? (
            <TransactionsListSkeleton />
          ) : (
            <Text style={[styles.transactionContentInset, styles.emptyText]}>{emptyMessage}</Text>
          )
        }
        renderSectionHeader={({ section }) => (
          <GroupBreak
            group={section}
            showCurrencyCodes={showCurrencyCodes}
          />
        )}
        renderSectionFooter={({ section }) => (
          section.key === lastSectionKey ? null : <View style={styles.transactionGroupSpacer} />
        )}
        renderItem={({ item, index }) => (
          <View style={styles.transactionRowInset}>
            <TransactionListItem
              entry={item}
              accounts={accounts}
              categories={categories}
              balanceAfterMinor={balanceAfterByEntryId[item.id] ?? 0}
              contextAccountId={contextAccountId}
              firstInGroup={index === 0}
              showCurrencyCodes={showCurrencyCodes}
              onPress={() => onOpenTransaction(item.transaction.id)}
            />
          </View>
        )}
      />
    </Card>
  );
}

function TransactionsListSkeleton() {
  return (
    <View
      accessible
      accessibilityLabel="Loading transactions"
      style={[styles.transactionContentInset, styles.transactionSkeleton]}
      testID="transactions-list-skeleton"
    >
      {[0, 1, 2].map((rowIndex) => (
        <View key={rowIndex} style={styles.transactionSkeletonRow}>
          <View style={styles.transactionSkeletonIcon} />
          <View style={styles.transactionSkeletonBody}>
            <View style={styles.transactionSkeletonLineWide} />
            <View style={styles.transactionSkeletonLine} />
          </View>
          <View style={styles.transactionSkeletonAmount} />
        </View>
      ))}
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
      <Text numberOfLines={1} style={styles.groupTitle}>
        {group.label}
      </Text>
      <Text numberOfLines={1} style={styles.groupTotal}>
        Total: {formatTransactionCurrencyTotals(netTotals, showCurrencyCodes)}
      </Text>
    </View>
  );
}
