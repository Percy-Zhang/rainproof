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
import { getLinkedCounterpartDisplayForEndpoint } from '../../domain/transactionLinking';
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
  const dateLabel = formatTransactionShortDate(candidate.transaction.datetime);
  const linkedDisplay = candidate.isLinked
    ? getLinkedCounterpartDisplayForEndpoint({
        endpoint: 'target',
        transactionId: candidate.transaction.id,
        lineId: null,
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
        transactionLinks: snapshot.transactionLinks,
        categories,
      })
    : null;

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
        <Text numberOfLines={1} style={styles.targetTitle}>
          {candidate.transaction.title || subcategoryName}
        </Text>
        <Text numberOfLines={1} style={styles.targetMeta}>
          {subcategoryName || category.name}
        </Text>
        {linkedDisplay?.title ? (
          <LinkedItemMeta title={linkedDisplay.title} testID={`linked-expense-target-detail-${candidate.transaction.id}`} />
        ) : null}
        <View style={styles.accountMetaRow}>
          {account ? <AccountIconBadge account={account} size="sm" /> : null}
          <Text numberOfLines={1} style={styles.targetMeta}>
            {account ? getAccountDisplayName(account) : 'Account'}
            {candidate.eligible ? '' : ` / ${candidate.disabledReason}`}
          </Text>
        </View>
      </View>
      <View style={styles.targetEnd}>
        <Text style={styles.targetAmount}>
          {formatMoney(candidate.amountMinor, candidate.currencyCode)}
        </Text>
        <Text style={styles.targetDate}>{dateLabel}</Text>
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
  const dateLabel = formatTransactionShortDate(candidate.transaction.datetime);
  const linkedDisplay = candidate.isLinked
    ? getLinkedCounterpartDisplayForEndpoint({
        endpoint: 'source',
        transactionId: candidate.transaction.id,
        lineId: null,
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
        transactionLinks: snapshot.transactionLinks,
        categories: snapshot.categories,
      })
    : null;

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
        <Text numberOfLines={1} style={styles.targetTitle}>
          {candidate.transaction.title || 'Income'}
        </Text>
        {linkedDisplay?.title ? (
          <LinkedItemMeta title={linkedDisplay.title} testID={`linked-income-source-detail-${candidate.transaction.id}`} />
        ) : null}
        <Text numberOfLines={1} style={styles.targetMeta}>
          {account ? getAccountDisplayName(account) : 'Account'}
          {candidate.eligible ? '' : ` / ${candidate.disabledReason}`}
        </Text>
      </View>
      <View style={styles.targetEnd}>
        <Text style={[styles.targetAmount, styles.incomeAmount]}>
          {formatMoney(candidate.amountMinor, candidate.currencyCode)}
        </Text>
        <Text style={styles.targetDate}>{dateLabel}</Text>
      </View>
    </Pressable>
  );
}

function LinkedItemMeta({ title, testID }: { title: string; testID: string }) {
  return (
    <View style={styles.linkedMetaRow} testID={testID}>
      <LinkedTransactionIndicator compact />
      <Text numberOfLines={1} style={styles.targetLinkedMeta}>{title}</Text>
    </View>
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
  targetTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  targetAmount: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: '900',
  },
  targetEnd: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: spacing.xs,
  },
  targetDate: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
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
    flex: 1,
    fontSize: typography.small,
    fontWeight: '800',
    minWidth: 0,
  },
  linkedMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minWidth: 0,
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
