import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AccountIconBadge } from '../../components/AccountDisplay';
import { getAccountDisplayName, getTransparentColor } from '../../domain/accountThemes';
import { defaultCategories } from '../../domain/categories';
import { isOutsideAccountId, OUTSIDE_ACCOUNT_ID } from '../../domain/transactionEdit';
import type { Account, CategoryDefinition, Transaction, TransactionKind, TransactionLine } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { CategorySelectContent } from '../categorySelection/CategorySelectScreen';

export type TransactionPickerMode = 'sourceAccount' | 'targetAccount' | 'category';

export function TransactionPickerScreen({
  mode,
  accounts,
  selectedAccountId,
  selectedCategoryId,
  selectedSubcategoryId,
  kind,
  categories: categoryCatalog = defaultCategories,
  transactions = [],
  transactionLines = [],
  showCurrencyCodes,
  sourceAccountId,
  onClose,
  onExit,
  onSelectAccount,
  onSelectCategory,
  cancelTestID = 'cancel-transaction-picker',
}: {
  mode: TransactionPickerMode;
  accounts: Account[];
  selectedAccountId: string;
  selectedCategoryId: string;
  selectedSubcategoryId: string;
  kind: TransactionKind;
  categories?: CategoryDefinition[];
  transactions?: Transaction[];
  transactionLines?: TransactionLine[];
  showCurrencyCodes: boolean;
  sourceAccountId: string;
  onClose: () => void;
  onExit: () => void;
  onSelectAccount: (accountId: string) => void;
  onSelectCategory: (categoryId: string, subcategoryId: string) => void;
  cancelTestID?: string;
}) {
  const categoryKind = kind === 'income' ? 'income' : 'expense';
  const title =
    mode === 'sourceAccount'
      ? kind === 'transfer' ? 'Transfer from' : 'Account'
      : mode === 'targetAccount'
        ? 'Transfer to'
        : 'Category';
  const outsideLabel = mode === 'sourceAccount' ? 'From outside my accounts' : 'To outside my accounts';

  return (
    <View style={styles.screen}>
      <View style={styles.pickerTopBar}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.backIconButton}>
          <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.pickerTitle}>{title}</Text>
        <Pressable accessibilityRole="button" onPress={onExit} style={styles.iconButton} testID={cancelTestID}>
          <Ionicons name="close" size={24} color={colors.primaryDark} />
        </Pressable>
      </View>

      {mode === 'category' ? (
        <CategorySelectContent
          categories={categoryCatalog}
          kind={categoryKind}
          selectedCategoryId={selectedCategoryId}
          selectedSubcategoryId={selectedSubcategoryId}
          selectionMode="subcategory"
          showSuggestions
          transactionLines={transactionLines}
          transactions={transactions}
          onSelect={(selection) => onSelectCategory(selection.categoryId, selection.subcategoryId ?? '')}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.pickerList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {kind === 'transfer' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => onSelectAccount(OUTSIDE_ACCOUNT_ID)}
              style={({ pressed }) => [
                styles.pickerRow,
                styles.outsidePickerRow,
                isOutsideAccountId(selectedAccountId) && styles.pickerRowSelected,
                pressed && styles.pressed,
              ]}
            >
              <AccountIconBadge color={colors.primary} iconName="globe-outline" size="md" />
              <View style={styles.pickerRowText}>
                <Text numberOfLines={1} style={styles.pickerRowTitle}>{outsideLabel}</Text>
                <Text numberOfLines={2} style={styles.pickerRowMeta}>Not tracked in Rainproof</Text>
              </View>
            </Pressable>
          ) : null}
          {accounts
            .filter((account) => mode !== 'targetAccount' || account.id !== sourceAccountId)
            .map((account) => (
              <Pressable
                key={account.id}
                accessibilityRole="button"
                onPress={() => onSelectAccount(account.id)}
                style={({ pressed }) => [
                  styles.pickerRow,
                  {
                    backgroundColor: getTint(account.themeColor),
                    borderColor: selectedAccountId === account.id ? account.themeColor : getFaintBorder(account.themeColor),
                  },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.accountRail, { backgroundColor: account.themeColor }]} />
                <AccountIconBadge account={account} size="md" />
                <View style={styles.pickerRowText}>
                  <Text style={styles.pickerRowTitle}>{getAccountDisplayName(account)}</Text>
                  <Text style={styles.pickerRowMeta}>
                    {showCurrencyCodes ? `${account.type.replace('_', ' ')} / ${account.currencyCode}` : account.type.replace('_', ' ')}
                  </Text>
                </View>
              </Pressable>
            ))}
        </ScrollView>
      )}
    </View>
  );
}

function getTint(color: string): string {
  return getTransparentColor(color, '22');
}

function getFaintBorder(color: string): string {
  return getTransparentColor(color, '66');
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: spacing.sm,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  backIconButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 40,
    paddingRight: spacing.sm,
  },
  backButtonText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '800',
  },
  pickerTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 44,
  },
  pickerTitle: {
    color: colors.ink,
    fontSize: typography.h2,
    flex: 1,
    fontWeight: '900',
    textAlign: 'center',
  },
  pickerList: {
    flexGrow: 1,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  suggestionPanel: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.xs,
  },
  suggestionTabs: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  suggestionTab: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  suggestionTabSelected: {
    backgroundColor: colors.surface,
  },
  suggestionTabText: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '900',
  },
  suggestionTabTextSelected: {
    color: colors.primaryDark,
  },
  categorySuggestionList: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingRight: spacing.xs,
  },
  categorySuggestionRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    maxWidth: 148,
    minHeight: 38,
    minWidth: 104,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  categorySuggestionRowSelected: {
    backgroundColor: '#F4FAFF',
  },
  categorySuggestionText: {
    flexShrink: 1,
    minWidth: 0,
  },
  categorySuggestionTitle: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
  },
  emptySuggestionText: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
    paddingHorizontal: spacing.xs,
  },
  pickerRow: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pickerRowSelected: {
    backgroundColor: '#F4FAFF',
    borderColor: colors.primary,
  },
  outsidePickerRow: {
    backgroundColor: colors.surfaceMuted,
  },
  accountRail: {
    alignSelf: 'stretch',
    borderRadius: 999,
    width: 5,
  },
  pickerRowText: {
    flex: 1,
    minWidth: 0,
  },
  pickerRowTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  pickerRowMeta: {
    color: colors.muted,
    flexShrink: 1,
    fontSize: typography.small,
    lineHeight: 17,
  },
  categoryGroup: {
    gap: spacing.xs,
  },
  subcategoryList: {
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.78,
  },
});
