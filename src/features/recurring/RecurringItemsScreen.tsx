import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { MetadataGrid } from '../../components/MetadataGrid';
import { ActionButton, Card, FormError, SurfaceCard } from '../../components/ui';
import { defaultCategories, getCategory, getSubcategoryColor, getSubcategoryIcon, getSubcategoryName } from '../../domain/categories';
import { formatLongDateLabel } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import {
  buildRecurringDueDateShiftInput,
  calculateNextRecurringDueDate,
  calculatePreviousRecurringDueDate,
  classifyRecurringItemsByDueDate,
} from '../../domain/recurringItems';
import type {
  Account,
  AppSnapshot,
  CategoryDefinition,
  RecurringFrequency,
  UpdateRecurringItemInput,
  UpcomingRecurringItem,
} from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';

type RecurringItemsScreenProps = {
  snapshot: AppSnapshot;
  onAddRecurringItem: () => void;
  onEditRecurringItem: (recurringItemId: string) => void;
  onCreateTransaction: (recurringItemId: string) => void;
  onUpdateRecurringItem: (input: UpdateRecurringItemInput) => Promise<void>;
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
  onUpdateRecurringItem,
}: RecurringItemsScreenProps) {
  const [adjustingItemId, setAdjustingItemId] = useState('');
  const [draftDueDate, setDraftDueDate] = useState('');
  const [optimisticDueDates, setOptimisticDueDates] = useState<Record<string, string>>({});
  const [scheduleError, setScheduleError] = useState('');
  const categories = snapshot.categories ?? defaultCategories;
  const accountById = useMemo(
    () => new Map(snapshot.accounts.map((account) => [account.id, account])),
    [snapshot.accounts],
  );
  const groups = useMemo(
    () => classifyRecurringItemsByDueDate(snapshot.recurringItems),
    [snapshot.recurringItems],
  );
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

  useEffect(() => {
    setOptimisticDueDates((current) => {
      let changed = false;
      const next = { ...current };

      for (const [itemId, dueDate] of Object.entries(current)) {
        const item = snapshot.recurringItems.find((candidate) => candidate.id === itemId);
        if (!item || item.nextDueDate === dueDate) {
          delete next[itemId];
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [snapshot.recurringItems]);

  function startDueDateAdjustment(item: UpcomingRecurringItem) {
    if (item.frequency === 'one_time') {
      onEditRecurringItem(item.id);
      return;
    }

    setAdjustingItemId(item.id);
    setDraftDueDate(optimisticDueDates[item.id] ?? item.nextDueDate);
    setScheduleError('');
  }

  function moveDraftDueDate(item: UpcomingRecurringItem, direction: 'previous' | 'next') {
    if (item.frequency === 'one_time') {
      return;
    }

    setDraftDueDate((current) => {
      const baseDueDate = adjustingItemId === item.id && current
        ? current
        : optimisticDueDates[item.id] ?? item.nextDueDate;
      return direction === 'previous'
        ? calculatePreviousRecurringDueDate(baseDueDate, item.frequency)
        : calculateNextRecurringDueDate(baseDueDate, item.frequency);
    });
    setAdjustingItemId(item.id);
  }

  function confirmDueDateAdjustment(item: UpcomingRecurringItem) {
    const nextDueDate = adjustingItemId === item.id && draftDueDate ? draftDueDate : item.nextDueDate;
    const input = {
      ...buildRecurringDueDateShiftInput(item, 'next', snapshot.accounts),
      nextDueDate,
    };

    setScheduleError('');
    setOptimisticDueDates((current) => ({ ...current, [item.id]: nextDueDate }));
    setAdjustingItemId('');
    setDraftDueDate('');

    void onUpdateRecurringItem(input).catch((caught) => {
      setOptimisticDueDates((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      setScheduleError(caught instanceof Error ? caught.message : 'Could not move the upcoming payment due date.');
    });
  }

  function getDisplayDueDate(item: UpcomingRecurringItem): string {
    if (adjustingItemId === item.id && draftDueDate) {
      return draftDueDate;
    }

    return optimisticDueDates[item.id] ?? item.nextDueDate;
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
            <Text style={styles.heading}>Upcoming Payments</Text>
            <Text style={styles.subtle}>Planned income and expenses. These do not affect balances until you create a transaction.</Text>
          </View>
          <ActionButton onPress={onAddRecurringItem} testID="add-recurring-item">
            Add
          </ActionButton>
        </View>

        <FormError message={scheduleError} />

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
                        item={item}
                        isAdjustingDueDate={adjustingItemId === item.id}
                        draftDueDate={getDisplayDueDate(item)}
                        showCurrencyCodes={snapshot.settings.multiCurrencyEnabled}
                        onCreateTransaction={() => onCreateTransaction(item.id)}
                        onConfirmDueDate={() => confirmDueDateAdjustment(item)}
                        onMoveDraftDueDate={(direction) => moveDraftDueDate(item, direction)}
                        onPress={() => onEditRecurringItem(item.id)}
                        onStartDueDateAdjustment={() => startDueDateAdjustment(item)}
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
            <Text style={styles.emptyTitle}>No active upcoming payments</Text>
            <Text style={styles.emptyText}>
              Add rent, subscriptions, salary, or one-time planned items. They stay planned until you create real transactions.
            </Text>
            <ActionButton variant="secondary" onPress={onAddRecurringItem}>
              Add first upcoming payment
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
  isAdjustingDueDate,
  draftDueDate,
  onCreateTransaction,
  onConfirmDueDate,
  onMoveDraftDueDate,
  onPress,
  onStartDueDateAdjustment,
  showCurrencyCodes,
}: {
  account?: Account;
  categories: CategoryDefinition[];
  item: UpcomingRecurringItem;
  isAdjustingDueDate: boolean;
  draftDueDate: string;
  onCreateTransaction: () => void;
  onConfirmDueDate: () => void;
  onMoveDraftDueDate: (direction: 'previous' | 'next') => void;
  onPress: () => void;
  onStartDueDateAdjustment: () => void;
  showCurrencyCodes: boolean;
}) {
  const icon = getSubcategoryIcon(item.categoryId, item.subcategoryId ?? '', categories);
  const color = getSubcategoryColor(item.categoryId, item.subcategoryId ?? '', categories);
  const categoryLabel = getRecurringCategoryLabel(item, categories);
  const status = getStatusCopy(item);
  const amountTone = item.kind === 'income' ? colors.success : colors.danger;
  const isRecurring = item.frequency !== 'one_time';

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
            { label: 'Next due', value: formatLongDateLabel(draftDueDate) },
          ]}
        />

        {item.note ? <Text numberOfLines={2} style={styles.note}>{item.note}</Text> : null}
      </Pressable>

      <View style={styles.cardActions}>
        {isAdjustingDueDate && isRecurring ? (
          <>
            <View style={styles.dueDateAdjustmentActions}>
              <ActionButton
                variant="secondary"
                onPress={() => onMoveDraftDueDate('previous')}
                testID={`previous-recurring-due-date-${item.id}`}
              >
                Previous
              </ActionButton>
              <ActionButton
                variant="secondary"
                onPress={() => onMoveDraftDueDate('next')}
                testID={`next-recurring-due-date-${item.id}`}
              >
                Next
              </ActionButton>
            </View>
            <Pressable
              accessibilityLabel="Save due date"
              accessibilityRole="button"
              onPress={onConfirmDueDate}
              style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}
              testID={`confirm-recurring-due-date-${item.id}`}
            >
              <Ionicons name="checkmark" size={20} color={colors.primaryDark} />
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              accessibilityLabel={isRecurring ? 'Adjust due date' : 'Edit upcoming payment'}
              accessibilityRole="button"
              onPress={onStartDueDateAdjustment}
              style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}
              testID={`edit-recurring-item-${item.id}`}
            >
              <Ionicons name="calendar" size={20} color={colors.primaryDark} />
            </Pressable>
            <ActionButton
              variant="secondary"
              onPress={onCreateTransaction}
              testID={`create-recurring-transaction-${item.id}`}
            >
              Mark paid
            </ActionButton>
          </>
        )}
      </View>
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
    case 'one_time':
      return 'One-time';
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
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  dueDateAdjustmentActions: {
    flexDirection: 'row',
    flexShrink: 1,
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  iconAction: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    height: 40,
    justifyContent: 'center',
    width: 40,
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
