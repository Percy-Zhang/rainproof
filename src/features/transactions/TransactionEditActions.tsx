import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '../../domain/money';
import { getTransactionLinkEditSummary } from '../../domain/transactionLinking';
import type { AppSnapshot } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { LinkedTransactionIndicator } from './LinkedTransactionIndicator';

export function TransactionLinkEntryRow({
  snapshot,
  transactionId,
  onPress,
}: {
  snapshot: AppSnapshot;
  transactionId: string;
  onPress: () => void;
}) {
  const summary = getTransactionLinkEditSummary({
    transactionId,
    transactions: snapshot.transactions,
    lines: snapshot.transactionLines,
    transactionLinks: snapshot.transactionLinks,
    formatAmount: formatMoney,
    categories: snapshot.categories,
  });
  const hasLinks = summary.linked;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.linkEntryRow, pressed && styles.pressed]}
      testID="open-transaction-link"
    >
      <View style={styles.linkEntryIcon}>
        <Ionicons name={hasLinks ? 'link-outline' : 'add-outline'} size={18} color={colors.primaryDark} />
      </View>
      <View style={styles.linkEntryText}>
        <View style={styles.linkEntryTitleRow}>
          <Text numberOfLines={1} style={styles.linkEntryTitle}>{summary.title}</Text>
          {hasLinks ? (
            <LinkedTransactionIndicator label testID="transaction-link-entry-linked" />
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.linkEntryDetail}>{summary.detail}</Text>
        {summary.secondaryDetail ? (
          <Text numberOfLines={1} style={styles.linkEntryDetail}>{summary.secondaryDetail}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export function DeleteTransactionPanel({
  confirmDelete,
  onCancel,
  onDelete,
}: {
  confirmDelete: boolean;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.dangerZone}>
      <View style={styles.dangerHeader}>
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
        <Text style={styles.dangerTitle}>Delete transaction</Text>
      </View>
      <Text style={styles.warningText}>
        {confirmDelete
          ? 'Delete this transaction? This will remove the transaction from your records. This cannot be undone.'
          : 'Remove this transaction and its transaction lines from your records.'}
      </Text>
      <View style={styles.deleteActions}>
        {confirmDelete ? (
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            style={({ pressed }) => [styles.cancelDeleteButton, pressed && styles.pressed]}
          >
            <Text style={styles.cancelDeleteText}>Cancel</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={onDelete}
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
          testID={confirmDelete ? 'confirm-delete-transaction' : 'delete-transaction'}
        >
          <Text style={styles.deleteButtonText}>{confirmDelete ? 'Confirm delete' : 'Delete transaction'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  linkEntryRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  linkEntryIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  linkEntryText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  linkEntryTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  linkEntryTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '900',
    minWidth: 0,
  },
  linkEntryDetail: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  dangerZone: {
    borderColor: '#E4C3C3',
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  dangerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dangerTitle: {
    color: colors.danger,
    fontSize: typography.body,
    fontWeight: '900',
  },
  warningText: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
  },
  deleteActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  cancelDeleteButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  cancelDeleteText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '800',
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: 8,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  deleteButtonText: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
  },
});
