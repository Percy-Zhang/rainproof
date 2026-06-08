import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccountIconBadge } from '../../components/AccountDisplay';
import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { getAccountDisplayName } from '../../domain/accountThemes';
import {
  getCategory,
  getSubcategoryColor,
  getSubcategoryIcon,
  getSubcategoryName,
} from '../../domain/categories';
import { formatMoney } from '../../domain/money';
import { formatTransactionShortDate } from '../../domain/transactionDisplay';
import { getLinkedCounterpartDisplayLabelForEndpoint } from '../../domain/transactionLinking';
import type {
  ExpenseLinkTargetCandidate,
  IncomeLinkSourceCandidate,
} from '../../domain/transactionLinking';
import type { AppSnapshot } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { LinkedTransactionIndicator } from './LinkedTransactionIndicator';

type ExpenseTargetRowProps = {
  candidate: ExpenseLinkTargetCandidate;
  snapshot: AppSnapshot;
  selected?: boolean;
  onPress: () => void;
};

export function ExpenseTargetRow({
  candidate,
  snapshot,
  selected = false,
  onPress,
}: ExpenseTargetRowProps) {
  const account = snapshot.accounts.find((item) => item.id === candidate.accountId);
  const categories = snapshot.categories;
  const category = getCategory(candidate.categoryId, categories);
  const color = getSubcategoryColor(candidate.categoryId, candidate.subcategoryId, categories);
  const icon = getSubcategoryIcon(candidate.categoryId, candidate.subcategoryId, categories);
  const subcategoryName = getSubcategoryName(candidate.categoryId, candidate.subcategoryId, categories);
  const linkedDetail = candidate.isLinked
    ? getLinkedCounterpartDisplayLabelForEndpoint({
        endpoint: 'target',
        transactionId: candidate.transaction.id,
        lineId: null,
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
        transactionLinks: snapshot.transactionLinks,
        categories,
      })
    : '';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!candidate.eligible}
      onPress={onPress}
      style={({ pressed }) => [
        styles.targetRow,
        selected && styles.targetRowSelected,
        candidate.isLinked && styles.targetRowLinked,
        !candidate.eligible && styles.targetRowDisabled,
        pressed && candidate.eligible && styles.pressed,
      ]}
    >
      <CategoryIconBadge color={color} icon={icon} size="md" />
      <View style={styles.targetText}>
        <View style={styles.targetTitleRow}>
          <Text numberOfLines={1} style={styles.targetTitle}>
            {candidate.transaction.title || subcategoryName}
          </Text>
          {candidate.isLinked ? (
            <LinkedTransactionIndicator
              label
              labelText="Already linked"
              testID={`linked-expense-target-${candidate.transaction.id}`}
            />
          ) : null}
          <Text style={styles.targetAmount}>
            {formatMoney(candidate.amountMinor, candidate.currencyCode)}
          </Text>
        </View>
        <Text numberOfLines={1} style={styles.targetMeta}>
          {formatTransactionShortDate(candidate.transaction.datetime)} / {subcategoryName || category.name}
        </Text>
        {linkedDetail ? (
          <Text numberOfLines={1} style={styles.targetLinkedMeta}>Linked to {linkedDetail}</Text>
        ) : null}
        <View style={styles.accountMetaRow}>
          {account ? <AccountIconBadge account={account} size="sm" /> : null}
          <Text numberOfLines={1} style={styles.targetMeta}>
            {account ? getAccountDisplayName(account) : 'Account'}
            {candidate.eligible ? '' : ` / ${candidate.disabledReason}`}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

type IncomeSourceRowProps = {
  candidate: IncomeLinkSourceCandidate;
  snapshot: AppSnapshot;
  onPress: () => void;
};

export function IncomeSourceRow({ candidate, snapshot, onPress }: IncomeSourceRowProps) {
  const account = snapshot.accounts.find((item) => item.id === candidate.accountId);
  const linkedDetail = candidate.isLinked
    ? getLinkedCounterpartDisplayLabelForEndpoint({
        endpoint: 'source',
        transactionId: candidate.transaction.id,
        lineId: null,
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
        transactionLinks: snapshot.transactionLinks,
        categories: snapshot.categories,
      })
    : '';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!candidate.eligible}
      onPress={onPress}
      style={({ pressed }) => [
        styles.targetRow,
        candidate.isLinked && styles.targetRowLinked,
        !candidate.eligible && styles.targetRowDisabled,
        pressed && candidate.eligible && styles.pressed,
      ]}
    >
      <AccountIconBadge account={account} size="md" />
      <View style={styles.targetText}>
        <View style={styles.targetTitleRow}>
          <Text numberOfLines={1} style={styles.targetTitle}>
            {candidate.transaction.title || 'Income'}
          </Text>
          {candidate.isLinked ? (
            <LinkedTransactionIndicator
              label
              labelText="Already linked"
              testID={`linked-income-source-${candidate.transaction.id}`}
            />
          ) : null}
          <Text style={[styles.targetAmount, styles.incomeAmount]}>
            {formatMoney(candidate.amountMinor, candidate.currencyCode)}
          </Text>
        </View>
        <Text numberOfLines={1} style={styles.targetMeta}>
          {formatTransactionShortDate(candidate.transaction.datetime)}
        </Text>
        {linkedDetail ? (
          <Text numberOfLines={1} style={styles.targetLinkedMeta}>Linked to {linkedDetail}</Text>
        ) : null}
        <Text numberOfLines={1} style={styles.targetMeta}>
          {account ? getAccountDisplayName(account) : 'Account'}
          {candidate.eligible ? '' : ` / ${candidate.disabledReason}`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  targetRow: {
    alignItems: 'flex-start',
    backgroundColor: colors.background,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  targetRowSelected: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.primary,
  },
  targetRowLinked: {
    borderColor: colors.primary,
  },
  targetRowDisabled: {
    opacity: 0.55,
  },
  targetText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  targetTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  targetTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '900',
    minWidth: 0,
  },
  targetAmount: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: '900',
  },
  incomeAmount: {
    color: colors.success,
  },
  targetMeta: {
    color: colors.muted,
    flex: 1,
    fontSize: typography.small,
    fontWeight: '700',
    minWidth: 0,
  },
  targetLinkedMeta: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '800',
  },
  accountMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.78,
  },
});
