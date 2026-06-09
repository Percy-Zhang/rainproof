import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { ActionButton, Card } from '../../components/ui';
import {
  defaultCategories,
  getCategory,
  getSubcategoryColor,
  getSubcategoryIcon,
  getSubcategoryName,
} from '../../domain/categories';
import { formatMoney } from '../../domain/money';
import {
  getActiveTransactionTemplates,
  getTransactionTemplateSplitMode,
} from '../../domain/transactionTemplates';
import type { Account, AppSnapshot, CategoryDefinition, TransactionTemplate } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';

type TransactionTemplatesScreenProps = {
  snapshot: AppSnapshot;
  onAddTemplate: () => void;
  onEditTemplate: (templateId: string) => void;
  onUseTemplate: (templateId: string) => void;
};

export function TransactionTemplatesScreen({
  snapshot,
  onAddTemplate,
  onEditTemplate,
  onUseTemplate,
}: TransactionTemplatesScreenProps) {
  const templates = useMemo(
    () => getActiveTransactionTemplates(snapshot.transactionTemplates),
    [snapshot.transactionTemplates],
  );
  const categories = snapshot.categories ?? defaultCategories;
  const accountById = useMemo(
    () => new Map(snapshot.accounts.map((account) => [account.id, account])),
    [snapshot.accounts],
  );

  return (
    <View style={styles.shell}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryRow}>
          <View style={styles.summaryText}>
            <Text style={styles.heading}>Templates</Text>
            <Text style={styles.subtle}>
              Shortcuts for repeated manual transactions. Templates do not affect balances until you save a transaction.
            </Text>
          </View>
          <ActionButton onPress={onAddTemplate} testID="add-transaction-template">
            Add
          </ActionButton>
        </View>

        {templates.length ? (
          <View style={styles.list}>
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                account={accountById.get(template.accountId)}
                categories={categories}
                showCurrencyCodes={snapshot.settings.multiCurrencyEnabled}
                template={template}
                onEdit={() => onEditTemplate(template.id)}
                onUse={() => onUseTemplate(template.id)}
              />
            ))}
          </View>
        ) : (
          <Card testID="transaction-templates-empty-state">
            <View style={styles.emptyIcon}>
              <Ionicons name="flash-outline" size={24} color={colors.primaryDark} />
            </View>
            <Text style={styles.emptyTitle}>No transaction templates</Text>
            <Text style={styles.emptyText}>
              Add a template for frequent manual transactions, then use it to open Add Transaction with the fields prefilled.
            </Text>
            <ActionButton variant="secondary" onPress={onAddTemplate}>
              Add first template
            </ActionButton>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function TemplateCard({
  account,
  categories,
  onEdit,
  onUse,
  showCurrencyCodes,
  template,
}: {
  account?: Account;
  categories: CategoryDefinition[];
  onEdit: () => void;
  onUse: () => void;
  showCurrencyCodes: boolean;
  template: TransactionTemplate;
}) {
  const icon = template.categoryId
    ? getSubcategoryIcon(template.categoryId, template.subcategoryId ?? '', categories)
    : template.kind === 'income'
      ? 'trending-up-outline'
      : 'cart-outline';
  const color = template.categoryId
    ? getSubcategoryColor(template.categoryId, template.subcategoryId ?? '', categories)
    : template.kind === 'income'
      ? colors.success
      : colors.danger;
  const amountLabel = template.amountMinor
    ? formatMoney(template.amountMinor, template.currencyCode, { showCurrencyCode: showCurrencyCodes })
    : 'Amount set when adding';
  const amountTone = template.kind === 'income' ? colors.success : colors.danger;

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        onPress={onEdit}
        style={({ pressed }) => [styles.cardPressable, pressed && styles.pressed]}
        testID={`transaction-template-row-${template.id}`}
      >
        <View style={styles.cardHeader}>
          <CategoryIconBadge color={color} icon={icon} size="md" />
          <View style={styles.cardTitleWrap}>
            <Text numberOfLines={1} style={styles.cardTitle}>{template.name}</Text>
            <Text numberOfLines={1} style={styles.cardSubtitle}>
              {template.title || template.name} / {getTemplateKindLabel(template)}
            </Text>
          </View>
          <Text style={[styles.amount, { color: template.amountMinor ? amountTone : colors.muted }]}>
            {amountLabel}
          </Text>
        </View>
        <View style={styles.metaGrid}>
          <Meta label="Account" value={account?.name ?? 'Account needs attention'} />
          <Meta label="Category" value={getTemplateCategoryLabel(template, categories)} />
        </View>
        {template.splitLines.length ? (
          <Text numberOfLines={1} style={styles.note}>{template.splitLines.length} split lines</Text>
        ) : null}
        {template.notes ? <Text numberOfLines={2} style={styles.note}>{template.notes}</Text> : null}
      </Pressable>

      <View style={styles.cardActions}>
        <ActionButton variant="secondary" onPress={onUse} testID={`use-transaction-template-${template.id}`}>
          Use template
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

function getTemplateCategoryLabel(template: TransactionTemplate, categories: CategoryDefinition[]): string {
  if (!template.categoryId) {
    return 'Optional';
  }

  if (template.subcategoryId) {
    return getSubcategoryName(template.categoryId, template.subcategoryId, categories);
  }

  return getCategory(template.categoryId, categories).name;
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function getTemplateKindLabel(template: TransactionTemplate): string {
  const kindLabel = capitalize(template.kind);
  if (!template.splitLines.length) {
    return kindLabel;
  }

  return getTransactionTemplateSplitMode(template) === 'mixed'
    ? 'Mixed split'
    : `Split ${kindLabel}`;
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
  amount: {
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
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
