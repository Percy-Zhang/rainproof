import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { MetadataGrid } from '../../components/MetadataGrid';
import { ActionButton, Card, FormError, SurfaceCard } from '../../components/ui';
import { defaultCategories, getCategory, getSubcategoryColor, getSubcategoryIcon, getSubcategoryName } from '../../domain/categories';
import { formatLongDateLabel } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import {
  classifyRecurringItemsByDueDate,
  getLatestRecurringTransactionHistoryByItem,
} from '../../domain/recurringItems';
import type {
  Account,
  AppSnapshot,
  CategoryDefinition,
  RecurringFrequency,
  RecurringTransactionHistory,
  UpcomingRecurringItem,
} from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';

type RecurringItemsScreenProps = {
  snapshot: AppSnapshot;
  onAddRecurringItem: () => void;
  onEditRecurringItem: (recurringItemId: string) => void;
  onCreateTransaction: (recurringItemId: string) => void;
  onUndoRecurringTransaction: (recurringItemId: string) => Promise<void>;
};

type Section = {
  title: string;
  detail: string;
  rows: UpcomingRecurringItem[];
};

export function RecurringItemsScreen({
  snapshot,
  onAddRecurringItem,
  onCreateTransaction,
  onEditRecurringItem,
  onUndoRecurringTransaction,
}: RecurringItemsScreenProps) {
  const [undoingRecurringItemId, setUndoingRecurringItemId] = useState('');
  const [undoError, setUndoError] = useState('');
  const categories = snapshot.categories ?? defaultCategories;
  const accountById = useMemo(
    () => new Map(snapshot.accounts.map((account) => [account.id, account])),
    [snapshot.accounts],
  );
  const groups = useMemo(
    () => classifyRecurringItemsByDueDate(snapshot.recurringItems),
    [snapshot.recurringItems],
  );
  const latestHistoryByItem = useMemo(
    () => getLatestRecurringTransactionHistoryByItem(snapshot.recurringTransactionHistory ?? []),
    [snapshot.recurringTransactionHistory],
  );
  const historyCountByItem = useMemo(() => {
    const counts = new Map<string, number>();

    for (const entry of snapshot.recurringTransactionHistory ?? []) {
      counts.set(entry.recurringItemId, (counts.get(entry.recurringItemId) ?? 0) + 1);
    }

    return counts;
  }, [snapshot.recurringTransactionHistory]);
  const sections: Section[] = [
    {
      title: 'Overdue',
      detail: 'Past due planned payments and income.',
      rows: groups.overdue,
    },
    {
      title: 'Due soon',
      detail: 'Due in the next 7 days.',
      rows: groups.dueSoon,
    },
    {
      title: 'Upcoming',
      detail: 'Scheduled after the next week.',
      rows: groups.upcoming,
    },
  ];
  const activeCount = sections.reduce((sum, section) => sum + section.rows.length, 0);

  async function undoLatestTransaction(recurringItemId: string) {
    if (undoingRecurringItemId) {
      return;
    }

    try {
      setUndoingRecurringItemId(recurringItemId);
      await onUndoRecurringTransaction(recurringItemId);
      setUndoError('');
    } catch (caught) {
      setUndoError(caught instanceof Error ? caught.message : 'Could not undo the recurring transaction.');
    } finally {
      setUndoingRecurringItemId('');
    }
  }

  return (
    <View style={styles.shell}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryRow}>
          <View style={styles.summaryText}>
            <Text style={styles.heading}>Recurring</Text>
            <Text style={styles.subtle}>Planned income and expenses. These do not affect balances until you create a transaction.</Text>
          </View>
          <ActionButton onPress={onAddRecurringItem} testID="add-recurring-item">
            Add
          </ActionButton>
        </View>

        <FormError message={undoError} />

        {activeCount ? (
          <View style={styles.sectionList}>
            {sections.map((section) => (
              section.rows.length ? (
                <View key={section.title} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <Text style={styles.sectionDetail}>{section.detail}</Text>
                  </View>
                  <View style={styles.list}>
                    {section.rows.map((item) => (
                      <RecurringItemCard
                        key={item.id}
                        account={accountById.get(item.accountId)}
                        categories={categories}
                        latestHistory={latestHistoryByItem.get(item.id)}
                        undoHistoryCount={historyCountByItem.get(item.id) ?? 0}
                        item={item}
                        showCurrencyCodes={snapshot.settings.multiCurrencyEnabled}
                        onCreateTransaction={() => onCreateTransaction(item.id)}
                        onPress={() => onEditRecurringItem(item.id)}
                        onUndoTransaction={() => undoLatestTransaction(item.id)}
                        undoing={undoingRecurringItemId === item.id}
                      />
                    ))}
                  </View>
                </View>
              ) : null
            ))}
          </View>
        ) : (
          <Card testID="recurring-empty-state">
            <View style={styles.emptyIcon}>
              <Ionicons name="repeat-outline" size={24} color={colors.primaryDark} />
            </View>
            <Text style={styles.emptyTitle}>No active recurring items</Text>
            <Text style={styles.emptyText}>
              Add rent, subscriptions, salary, or other repeating items as templates. They will stay planned until you create real transactions.
            </Text>
            <ActionButton variant="secondary" onPress={onAddRecurringItem}>
              Add first recurring item
            </ActionButton>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function RecurringItemCard({
  account,
  categories,
  item,
  latestHistory,
  onCreateTransaction,
  onPress,
  onUndoTransaction,
  showCurrencyCodes,
  undoHistoryCount,
  undoing,
}: {
  account?: Account;
  categories: CategoryDefinition[];
  item: UpcomingRecurringItem;
  latestHistory?: RecurringTransactionHistory;
  onCreateTransaction: () => void;
  onPress: () => void;
  onUndoTransaction: () => void;
  showCurrencyCodes: boolean;
  undoHistoryCount: number;
  undoing: boolean;
}) {
  const icon = getSubcategoryIcon(item.categoryId, item.subcategoryId ?? '', categories);
  const color = getSubcategoryColor(item.categoryId, item.subcategoryId ?? '', categories);
  const categoryLabel = getRecurringCategoryLabel(item, categories);
  const status = getStatusCopy(item);
  const amountTone = item.kind === 'income' ? colors.success : colors.danger;
  const actionLabel = item.kind === 'income' ? 'Mark received' : 'Mark paid';

  return (
    <SurfaceCard>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.cardPressable, pressed && styles.pressed]}
        testID={`recurring-row-${item.id}`}
      >
        <View style={styles.cardHeader}>
          <CategoryIconBadge color={color} icon={icon} size="md" />
          <View style={styles.cardTitleWrap}>
            <Text numberOfLines={1} style={styles.cardTitle}>{item.name}</Text>
            <Text numberOfLines={1} style={styles.cardSubtitle}>
              {capitalize(item.kind)} / {categoryLabel}
            </Text>
          </View>
          <View style={styles.trailing}>
            <Text style={[styles.amount, { color: amountTone }]}>
              {formatMoney(item.amountMinor, item.currencyCode, { showCurrencyCode: showCurrencyCodes })}
            </Text>
            <Text style={[styles.status, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        <MetadataGrid
          items={[
            { label: 'Account', value: account?.name ?? 'Account needs attention' },
            { label: 'Frequency', value: getFrequencyLabel(item.frequency) },
            { label: 'Next due', value: formatLongDateLabel(item.nextDueDate) },
          ]}
        />

        {item.note ? <Text numberOfLines={2} style={styles.note}>{item.note}</Text> : null}
      </Pressable>

      <View style={styles.cardActions}>
        <ActionButton variant="secondary" onPress={onCreateTransaction} testID={`create-recurring-transaction-${item.id}`}>
          {actionLabel}
        </ActionButton>
      </View>

      {latestHistory ? (
        <Pressable
          accessibilityLabel={`Undo last ${item.kind === 'income' ? 'received' : 'paid'} transaction`}
          accessibilityRole="button"
          disabled={undoing}
          onPress={onUndoTransaction}
          style={({ pressed }) => [
            styles.undoAction,
            undoing && styles.undoActionDisabled,
            pressed && !undoing && styles.pressed,
          ]}
          testID={`undo-recurring-transaction-${item.id}`}
        >
          <Ionicons name="arrow-undo-outline" size={20} color={colors.primaryDark} />
          <View style={styles.undoActionText}>
            <Text style={styles.undoActionTitle}>
              {undoing ? 'Undoing...' : `Undo last ${item.kind === 'income' ? 'received' : 'paid'}`}
            </Text>
            <Text style={styles.undoActionDetail}>
              {undoHistoryCount > 1
                ? `${undoHistoryCount} generated transactions can be undone, newest first.`
                : 'Removes the generated transaction and restores the previous due date.'}
            </Text>
          </View>
        </Pressable>
      ) : null}
    </SurfaceCard>
  );
}

function getRecurringCategoryLabel(item: UpcomingRecurringItem, categories: CategoryDefinition[]): string {
  if (item.subcategoryId) {
    return getSubcategoryName(item.categoryId, item.subcategoryId, categories);
  }

  return getCategory(item.categoryId, categories).name;
}

function getStatusCopy(item: UpcomingRecurringItem): { label: string; color: string } {
  switch (item.dueStatus) {
    case 'overdue':
      return { label: 'Overdue', color: colors.danger };
    case 'due_soon':
      return { label: 'Due soon', color: '#9B6B12' };
    case 'upcoming':
      return { label: 'Upcoming', color: colors.primaryDark };
  }
}

function getFrequencyLabel(frequency: RecurringFrequency): string {
  switch (frequency) {
    case 'weekly':
      return 'Weekly';
    case 'fortnightly':
      return 'Fortnightly';
    case 'monthly':
      return 'Monthly';
    case 'yearly':
      return 'Yearly';
  }
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  summaryText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  heading: {
    color: colors.ink,
    fontSize: typography.h2,
    fontWeight: '900',
  },
  subtle: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
  },
  sectionList: {
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    gap: spacing.xs,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '900',
  },
  sectionDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
  },
  list: {
    gap: spacing.md,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cardPressable: {
    gap: spacing.md,
  },
  cardTitleWrap: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  cardSubtitle: {
    color: colors.muted,
    fontSize: typography.small,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  amount: {
    fontSize: typography.body,
    fontWeight: '900',
  },
  status: {
    fontSize: typography.small,
    fontWeight: '900',
  },
  note: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
  },
  cardActions: {
    alignItems: 'flex-start',
  },
  undoAction: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  undoActionDisabled: {
    opacity: 0.5,
  },
  undoActionText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  undoActionTitle: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
  },
  undoActionDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 21,
  },
  pressed: {
    opacity: 0.78,
  },
});
