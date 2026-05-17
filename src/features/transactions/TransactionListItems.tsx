import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TransactionRelationText } from '../../components/TransactionRelationText';
import type { TransactionDisplayEntry } from '../../domain/aggregates';
import { formatMoney, formatMoneyAccounting } from '../../domain/money';
import {
  formatTransactionShortDate,
  getTransactionAmountTone,
  getTransactionCategoryColor,
  getTransactionCategoryIcon,
  getTransactionItemTitle,
  getTransactionSubcategoryLabel,
  type TransactionAmountTone,
} from '../../domain/transactionDisplay';
import type { Account, CategoryDefinition, CurrencyCode } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';

type CompactTransactionListItemProps = {
  entry: TransactionDisplayEntry;
  accounts: Account[];
  categories: CategoryDefinition[];
  contextAccountId?: string;
  first: boolean;
  showCurrencyCodes: boolean;
  onPress: () => void;
};

export function CompactTransactionListItem({
  entry,
  accounts,
  categories,
  contextAccountId,
  first,
  showCurrencyCodes,
  onPress,
}: CompactTransactionListItemProps) {
  const categoryColor = getTransactionCategoryColor(entry, categories);
  const categoryIcon = getTransactionCategoryIcon(entry, categories);
  const subcategory = getTransactionSubcategoryLabel(entry, categories);
  const title = getTransactionItemTitle(entry, categories);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.compactRow,
        first && styles.compactRowFirst,
        pressed && styles.pressed,
      ]}
      testID={`dashboard-transaction-${entry.transaction.id}`}
    >
      <TransactionIconDisplay color={categoryColor} icon={categoryIcon} size="compact" />
      <View style={styles.compactBody}>
        <View style={styles.transactionLine}>
          <Text numberOfLines={1} style={styles.compactSubcategory}>
            {subcategory}
          </Text>
          <TransactionAmountText
            amountMinor={entry.amountMinor}
            currencyCode={entry.currencyCode}
            showCurrencyCodes={showCurrencyCodes}
            style={styles.compactAmount}
          />
        </View>
        <View style={styles.transactionLine}>
          <Text numberOfLines={1} style={styles.compactTitle}>
            {title}
          </Text>
          <Text style={styles.compactDate}>{formatTransactionShortDate(entry.transaction.datetime)}</Text>
        </View>
        <TransactionRelationText
          accounts={accounts}
          boldStyle={styles.compactRelationBold}
          contextAccountId={contextAccountId}
          entry={entry}
          style={styles.compactMeta}
        />
      </View>
    </Pressable>
  );
}

type TransactionListItemProps = {
  entry: TransactionDisplayEntry;
  accounts: Account[];
  categories: CategoryDefinition[];
  balanceAfterMinor: number;
  contextAccountId?: string;
  firstInGroup: boolean;
  showCurrencyCodes: boolean;
  onPress: () => void;
};

export function TransactionListItem({
  entry,
  accounts,
  categories,
  balanceAfterMinor,
  contextAccountId,
  firstInGroup,
  showCurrencyCodes,
  onPress,
}: TransactionListItemProps) {
  const account = accounts.find((item) => item.id === entry.accountId);
  const subcategory = getTransactionSubcategoryLabel(entry, categories);
  const title = getTransactionItemTitle(entry, categories);
  const categoryColor = getTransactionCategoryColor(entry, categories);
  const categoryIcon = getTransactionCategoryIcon(entry, categories);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.fullRow,
        firstInGroup && styles.fullRowFirst,
        pressed && styles.pressed,
      ]}
      testID={`transaction-row-${entry.transaction.id}`}
    >
      <View style={styles.fullRowContent}>
        <TransactionIconDisplay color={categoryColor} icon={categoryIcon} size="full" />
        <View style={styles.fullBody}>
          <View style={styles.transactionLine}>
            <Text numberOfLines={1} style={styles.fullTitle}>
              {subcategory}
            </Text>
            <TransactionAmountText
              amountMinor={entry.amountMinor}
              currencyCode={entry.currencyCode}
              showCurrencyCodes={showCurrencyCodes}
              style={styles.fullAmount}
            />
          </View>
          <View style={styles.transactionLine}>
            <Text numberOfLines={1} style={styles.fullNote}>
              {title}
            </Text>
            <Text style={styles.balanceAfterText}>
              {account
                ? formatMoney(balanceAfterMinor, account.currencyCode, { showCurrencyCode: showCurrencyCodes })
                : ''}
            </Text>
          </View>
          <View style={styles.transactionLine}>
            <TransactionRelationText
              accounts={accounts}
              boldStyle={styles.fullMetaBold}
              contextAccountId={contextAccountId}
              entry={entry}
              style={styles.fullMeta}
            />
            <Text style={styles.fullDate}>{formatTransactionShortDate(entry.transaction.datetime)}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

type TransactionAmountTextProps = {
  amountMinor: number;
  currencyCode: CurrencyCode;
  showCurrencyCodes: boolean;
  style: object;
};

function TransactionAmountText({
  amountMinor,
  currencyCode,
  showCurrencyCodes,
  style,
}: TransactionAmountTextProps) {
  return (
    <Text style={[style, getAmountStyle(getTransactionAmountTone(amountMinor))]}>
      {formatMoneyAccounting(amountMinor, currencyCode, { showCurrencyCode: showCurrencyCodes })}
    </Text>
  );
}

function TransactionIconDisplay({
  color,
  icon,
  size,
}: {
  color: string;
  icon: string;
  size: 'compact' | 'full';
}) {
  const isCompact = size === 'compact';

  return (
    <View
      style={[
        isCompact ? styles.compactIconSlot : styles.fullIconSlot,
        { backgroundColor: color },
      ]}
    >
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={isCompact ? 18 : 19}
        color={colors.surface}
      />
    </View>
  );
}

function getAmountStyle(tone: TransactionAmountTone) {
  if (tone === 'positive') {
    return styles.amountPositive;
  }

  if (tone === 'negative') {
    return styles.amountNegative;
  }

  return styles.amountNeutral;
}

const styles = StyleSheet.create({
  compactRow: {
    alignItems: 'flex-start',
    borderTopColor: colors.faint,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  compactRowFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  compactIconSlot: {
    alignItems: 'center',
    borderRadius: 8,
    height: 34,
    justifyContent: 'center',
    marginTop: 1,
    width: 34,
  },
  compactBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  compactSubcategory: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '900',
    minWidth: 0,
  },
  compactTitle: {
    color: colors.muted,
    flex: 1,
    fontSize: typography.small,
    fontWeight: '700',
    minWidth: 0,
  },
  compactDate: {
    color: colors.muted,
    flexShrink: 0,
    fontSize: typography.small,
  },
  compactMeta: {
    color: colors.muted,
    fontSize: typography.small,
  },
  compactRelationBold: {
    color: colors.ink,
    fontWeight: '900',
  },
  compactAmount: {
    flexShrink: 0,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
  },
  fullRow: {
    borderTopColor: colors.faint,
    borderTopWidth: 1,
    paddingVertical: spacing.md,
  },
  fullRowFirst: {
    borderTopWidth: 0,
  },
  fullRowContent: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fullIconSlot: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    marginTop: 1,
    opacity: 0.82,
    width: 36,
  },
  fullBody: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  transactionLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  fullTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '900',
    minWidth: 0,
  },
  fullNote: {
    color: colors.muted,
    flex: 1,
    fontSize: typography.small,
    fontWeight: '700',
    minWidth: 0,
  },
  fullMeta: {
    color: colors.muted,
    flex: 1,
    fontSize: typography.small,
    minWidth: 0,
  },
  fullMetaBold: {
    color: colors.ink,
    fontWeight: '900',
  },
  fullDate: {
    color: colors.muted,
    fontSize: typography.small,
    textAlign: 'right',
  },
  fullAmount: {
    color: colors.ink,
    flexShrink: 0,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
  },
  balanceAfterText: {
    color: colors.muted,
    flexShrink: 0,
    fontSize: typography.small,
    fontWeight: '800',
    textAlign: 'right',
  },
  amountPositive: {
    color: colors.success,
  },
  amountNegative: {
    color: colors.danger,
  },
  amountNeutral: {
    color: colors.ink,
  },
  pressed: {
    opacity: 0.78,
  },
});
