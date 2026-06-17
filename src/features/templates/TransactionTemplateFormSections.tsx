import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccountIconBadge } from '../../components/AccountDisplay';
import { FormPreviewRow } from '../../components/FormLayout';
import { getAccountDisplayName } from '../../domain/accountThemes';
import {
  getCategory,
  getSubcategory,
  getSubcategoryIcon,
  getSubcategoryName,
} from '../../domain/categories';
import { formatMoney } from '../../domain/money';
import type {
  AppSnapshot,
  CategoryDefinition,
  TransactionTemplateKind,
} from '../../domain/types';
import type { SplitTransactionMode } from '../../domain/splitTransactions';
import { sharedStyles } from '../../theme/sharedStyles';
import { colors, spacing } from '../../theme/tokens';

export function TemplatePreview({
  amount,
  categories,
  categoryId,
  currencyCode,
  kind,
  name,
  splitLineCount,
  splitMode,
  subcategoryId,
  title,
}: {
  amount: string;
  categories: CategoryDefinition[];
  categoryId: string | null;
  currencyCode: string;
  kind: TransactionTemplateKind;
  name: string;
  splitLineCount: number;
  splitMode: SplitTransactionMode;
  subcategoryId: string | null;
  title: string;
}) {
  const color = getTemplateCategorySelectionColor(categoryId, subcategoryId, categories, kind);
  const icon = getTemplateCategorySelectionIcon(categoryId, subcategoryId, categories, kind);
  const label = title.trim() || name.trim() || 'New transaction';
  const amountLabel = amount.trim() ? `${currencyCode} ${amount.trim()}` : 'Amount set when adding';
  const kindLabel =
    splitLineCount >= 2
      ? splitMode === 'mixed'
        ? 'Mixed split'
        : `Split ${capitalize(kind)}`
      : capitalize(kind);

  return (
    <FormPreviewRow
      color={color}
      icon={icon}
      title={label}
      detail={`${kindLabel} / ${amountLabel}`}
    />
  );
}

export function TemplateAccountRow({
  account,
  balanceMinor,
  onPress,
  showCurrencyCodes,
}: {
  account?: AppSnapshot['accounts'][number];
  balanceMinor?: number;
  onPress: () => void;
  showCurrencyCodes: boolean;
}) {
  const detail = account
    ? [
        account.type.replace('_', ' '),
        account.currencyCode,
        balanceMinor !== undefined
          ? formatMoney(balanceMinor, account.currencyCode, { showCurrencyCode: showCurrencyCodes })
          : null,
      ].filter(Boolean).join(' / ')
    : 'Add an account before creating templates.';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [sharedStyles.rowSurface, styles.selectorRow, pressed && sharedStyles.pressed]}
      testID="transaction-template-account-row"
    >
      {account ? (
        <AccountIconBadge account={account} size="md" />
      ) : (
        <View style={styles.emptyIcon}>
          <Ionicons name="wallet-outline" size={18} color={colors.primaryDark} />
        </View>
      )}
      <View style={styles.selectorText}>
        <Text numberOfLines={1} style={sharedStyles.strongBodyText}>
          {account ? getAccountDisplayName(account) : 'No account selected'}
        </Text>
        <Text numberOfLines={1} style={sharedStyles.mutedSmallText}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export function SplitTemplateSummaryRow({
  currencyCode,
  kind,
  isBalanced,
  lineCount,
  onPress,
  showCurrencyCodes,
  splitMode,
  totalMinor,
}: {
  currencyCode: string;
  kind: TransactionTemplateKind;
  isBalanced: boolean;
  lineCount: number;
  onPress: () => void;
  showCurrencyCodes: boolean;
  splitMode: SplitTransactionMode;
  totalMinor: number;
}) {
  const hasSplitLines = lineCount >= 2;
  const detail = hasSplitLines
    ? `${lineCount} lines / ${isBalanced ? 'Ready' : 'Needs total'} / ${formatMoney(totalMinor, currencyCode, { showCurrencyCode: showCurrencyCodes })}`
    : `Create a split ${kind} template`;
  const title = hasSplitLines
    ? splitMode === 'mixed'
      ? 'Mixed split template'
      : `Split ${kind} template`
    : 'Normal template';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [sharedStyles.rowSurface, styles.selectorRow, pressed && sharedStyles.pressed]}
      testID="transaction-template-split-row"
    >
      <View style={styles.emptyIcon}>
        <Ionicons name="git-branch-outline" size={18} color={colors.primaryDark} />
      </View>
      <View style={styles.selectorText}>
        <Text numberOfLines={1} style={sharedStyles.strongBodyText}>{title}</Text>
        <Text numberOfLines={1} style={sharedStyles.mutedSmallText}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export function getTemplateCategorySelectionLabel(
  categoryId: string | null,
  subcategoryId: string | null,
  categories: CategoryDefinition[],
): string {
  if (!categoryId) {
    return 'Optional';
  }

  const category = getCategory(categoryId, categories);
  return subcategoryId ? `${category.name} / ${getSubcategoryName(category.id, subcategoryId, categories)}` : category.name;
}

export function getTemplateCategorySelectionColor(
  categoryId: string | null,
  subcategoryId: string | null,
  categories: CategoryDefinition[],
  kind: TransactionTemplateKind,
): string {
  if (!categoryId) {
    return kind === 'income' ? colors.success : colors.danger;
  }

  return getSubcategory(categoryId, subcategoryId ?? '', categories)?.color ?? getCategory(categoryId, categories).color;
}

export function getTemplateCategorySelectionIcon(
  categoryId: string | null,
  subcategoryId: string | null,
  categories: CategoryDefinition[],
  kind: TransactionTemplateKind,
): string {
  if (!categoryId) {
    return kind === 'income' ? 'trending-up-outline' : 'cart-outline';
  }

  return getSubcategoryIcon(categoryId, subcategoryId ?? '', categories);
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

const styles = StyleSheet.create({
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  selectorRow: {
    gap: spacing.sm,
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectorText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
});
