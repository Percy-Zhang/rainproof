import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { ActionButton, Card } from '../../components/ui';
import { defaultCategories, getCategory, getSubcategoryColor, getSubcategoryIcon, getSubcategoryName } from '../../domain/categories';
import { formatLongDateLabel } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import { classifyRecurringItemsByDueDate } from '../../domain/recurringItems';
import type { Account, AppSnapshot, CategoryDefinition, RecurringFrequency, UpcomingRecurringItem } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';

type RecurringItemsScreenProps = {
  snapshot: AppSnapshot;
  onAddRecurringItem: () => void;
  onEditRecurringItem: (recurringItemId: string) => void;
  onCreateTransaction: (recurringItemId: string) => void;
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
}: RecurringItemsScreenProps) {
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
                        showCurrencyCodes={snapshot.settings.multiCurrencyEnabled}
                        onCreateTransaction={() => onCreateTransaction(item.id)}
                        onPress={() => onEditRecurringItem(item.id)}
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
  onCreateTransaction,
  onPress,
  showCurrencyCodes,
}: {
  account?: Account;
  categories: CategoryDefinition[];
  item: UpcomingRecurringItem;
  onCreateTransaction: () => void;
  onPress: () => void;
  showCurrencyCodes: boolean;
}) {
  const icon = getSubcategoryIcon(item.categoryId, item.subcategoryId ?? '', categories);
  const color = getSubcategoryColor(item.categoryId, item.subcategoryId ?? '', categories);
  const categoryLabel = getRecurringCategoryLabel(item, categories);
  const status = getStatusCopy(item);
  const amountTone = item.kind === 'income' ? colors.success : colors.danger;
  const actionLabel = item.kind === 'income' ? 'Mark received' : 'Mark paid';

  return (
    <View style={styles.card}>
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

        <View style={styles.metaGrid}>
          <Meta label="Account" value={account?.name ?? 'Account needs attention'} />
          <Meta label="Frequency" value={getFrequencyLabel(item.frequency)} />
          <Meta label="Next due" value={formatLongDateLabel(item.nextDueDate)} />
        </View>

        {item.note ? <Text numberOfLines={2} style={styles.note}>{item.note}</Text> : null}
      </Pressable>

      <View style={styles.cardActions}>
        <ActionButton variant="secondary" onPress={onCreateTransaction} testID={`create-recurring-transaction-${item.id}`}>
          {actionLabel}
        </ActionButton>
      </View>
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.metaValue}>{value}</Text>
    </View>
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
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
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
  metaGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  meta: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  metaLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metaValue: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '800',
  },
  note: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
  },
  cardActions: {
    alignItems: 'flex-start',
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
