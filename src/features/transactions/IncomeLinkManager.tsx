import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  getExpenseLinkTargetCandidates,
  getExpenseLinkTargetMoney,
  getIncomeLinkTreatment,
  getTransactionLinkSourceAmount,
  type ExpenseLinkTargetCandidate,
  type IncomeLinkTreatment,
} from '../../domain/transactionLinking';
import type {
  AppSnapshot,
  NewTransactionLinkInput,
  Transaction,
  TransactionLink,
  TransactionLinkType,
  UpdateTransactionLinkInput,
} from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { InlineField } from './TransactionFormComponents';
import { ExpenseTargetRow } from './TransactionLinkCandidateRows';
import { transactionLinkTypeOptions } from './TransactionLinkLabels';

type IncomeLinkManagerProps = {
  snapshot: AppSnapshot;
  transaction: Transaction;
  onAddTransactionLink: (input: NewTransactionLinkInput) => Promise<void>;
  onUpdateTransactionLink: (input: UpdateTransactionLinkInput) => Promise<void>;
  onDeleteTransactionLink: (linkId: string) => Promise<void>;
  onError: (message: string) => void;
};

export function IncomeLinkManager({
  snapshot,
  transaction,
  onAddTransactionLink,
  onUpdateTransactionLink,
  onDeleteTransactionLink,
  onError,
}: IncomeLinkManagerProps) {
  const sourceLink = snapshot.transactionLinks.find((link) => link.sourceTransactionId === transaction.id);
  const [treatment, setTreatment] = useState<IncomeLinkTreatment>(
    getIncomeLinkTreatment(transaction.id, snapshot.transactionLinks),
  );
  const [query, setQuery] = useState('');
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const sourceAmount = getTransactionLinkSourceAmount(transaction.id, snapshot.transactionLines);
  const selectedTarget = sourceLink
    ? snapshot.transactions.find((item) => item.id === sourceLink.targetTransactionId)
    : undefined;
  const selectedTargetMoney = sourceLink
    ? getExpenseLinkTargetMoney(sourceLink.targetTransactionId, snapshot.transactionLines, sourceLink.currencyCode)
    : null;
  const selectedTargetLinkedTotal =
    (sourceAmount?.amountMinor ?? sourceLink?.amountMinor ?? 0) +
    (sourceLink
      ? snapshot.transactionLinks
          .filter((link) => link.targetTransactionId === sourceLink.targetTransactionId && link.id !== sourceLink.id)
          .reduce((sum, link) => sum + link.amountMinor, 0)
      : 0);
  const selectedTargetOverpaid =
    !!selectedTargetMoney && selectedTargetLinkedTotal > selectedTargetMoney.amountMinor;
  const candidates = useMemo(
    () =>
      getExpenseLinkTargetCandidates({
        sourceTransactionId: transaction.id,
        sourceCurrencyCode: sourceAmount?.currencyCode ?? null,
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
        query,
      }).slice(0, 12),
    [query, snapshot.transactionLines, snapshot.transactions, sourceAmount?.currencyCode, transaction.id],
  );

  useEffect(() => {
    setTreatment(getIncomeLinkTreatment(transaction.id, snapshot.transactionLinks));
    setConfirmUnlink(false);
  }, [snapshot.transactionLinks, transaction.id]);

  async function selectTreatment(nextTreatment: TransactionLinkType) {
    setConfirmUnlink(false);
    setTreatment(nextTreatment);

    if (sourceLink) {
      await saveLink(sourceLink.targetTransactionId, nextTreatment, sourceLink.id);
    }
  }

  async function saveLink(targetTransactionId: string, linkType: TransactionLinkType, linkId = sourceLink?.id) {
    if (!sourceAmount) {
      onError('This income transaction needs a positive amount before linking.');
      return;
    }

    try {
      const input = {
        sourceTransactionId: transaction.id,
        targetTransactionId,
        linkType,
        amountMinor: sourceAmount.amountMinor,
        currencyCode: sourceAmount.currencyCode,
      };
      if (linkId) {
        await onUpdateTransactionLink({ id: linkId, ...input });
      } else {
        await onAddTransactionLink(input);
      }
      onError('');
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Could not update transaction link.');
    }
  }

  async function unlink() {
    if (!sourceLink) {
      setConfirmUnlink(false);
      setTreatment('normal');
      return;
    }

    try {
      await onDeleteTransactionLink(sourceLink.id);
      setConfirmUnlink(false);
      setTreatment('normal');
      onError('');
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Could not unlink transaction.');
    }
  }

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What is this money for?</Text>
        <View style={styles.optionList}>
          {transactionLinkTypeOptions.map((option) => (
            <Pressable
              accessibilityRole="button"
              key={option.value}
              onPress={() => selectTreatment(option.value)}
              style={({ pressed }) => [
                styles.treatmentOption,
                treatment === option.value && styles.treatmentOptionSelected,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.radio, treatment === option.value && styles.radioSelected]} />
              <Text style={[styles.optionText, treatment === option.value && styles.optionTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {sourceLink ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setConfirmUnlink(true)}
            style={({ pressed }) => [styles.unlinkButton, pressed && styles.pressed]}
          >
            <Text style={styles.unlinkButtonText}>Unlink transaction</Text>
          </Pressable>
        ) : null}
      </View>

      {confirmUnlink ? <ConfirmUnlinkPanel onCancel={() => setConfirmUnlink(false)} onUnlink={unlink} /> : null}

      {treatment !== 'normal' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose the original expense</Text>
          {selectedTarget && sourceLink ? (
            <View style={styles.selectedTarget}>
              <Text style={styles.selectedLabel}>Linked expense</Text>
              <ExpenseTargetRow
                candidate={buildExpenseCandidateFromLink(selectedTarget, sourceLink, snapshot)}
                snapshot={snapshot}
                selected
                onPress={() => undefined}
              />
              {selectedTargetOverpaid ? (
                <Text style={styles.warningText}>
                  Linked money is more than this expense. Stats will clamp spending at $0.
                </Text>
              ) : null}
            </View>
          ) : null}

          <InlineField
            label={sourceLink ? 'Change linked expense' : 'Find expense'}
            value={query}
            onChange={setQuery}
            placeholder="Search by item, category, currency"
          />
          <View style={styles.searchResults}>
            {candidates.map((candidate) => (
              <ExpenseTargetRow
                key={candidate.transaction.id}
                candidate={candidate}
                snapshot={snapshot}
                selected={sourceLink?.targetTransactionId === candidate.transaction.id}
                onPress={() => {
                  if (candidate.eligible) {
                    saveLink(candidate.transaction.id, treatment);
                  }
                }}
              />
            ))}
            {!candidates.length ? <Text style={styles.emptyText}>No matching expenses.</Text> : null}
          </View>
        </View>
      ) : null}
    </>
  );
}

function ConfirmUnlinkPanel({ onCancel, onUnlink }: { onCancel: () => void; onUnlink: () => void }) {
  return (
    <View style={styles.warningPanel}>
      <Text style={styles.warningText}>Unlink this transaction? Both transactions will stay in your ledger.</Text>
      <View style={styles.confirmActions}>
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onUnlink}
          style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}
        >
          <Text style={styles.dangerButtonText}>Unlink</Text>
        </Pressable>
      </View>
    </View>
  );
}

function buildExpenseCandidateFromLink(
  transaction: Transaction,
  link: TransactionLink,
  snapshot: AppSnapshot,
): ExpenseLinkTargetCandidate {
  const lines = snapshot.transactionLines.filter(
    (line) =>
      line.transactionId === transaction.id &&
      line.amountMinor < 0 &&
      line.currencyCode === link.currencyCode,
  );
  const firstLine = lines[0];
  const amountMinor = lines.reduce((sum, line) => sum + Math.abs(line.amountMinor), 0);

  return {
    transaction,
    amountMinor,
    currencyCode: link.currencyCode,
    accountId: firstLine?.accountId ?? '',
    categoryId: firstLine?.categoryId ?? '',
    subcategoryId: firstLine?.subcategoryId ?? '',
    eligible: true,
    disabledReason: '',
  };
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  optionList: {
    gap: spacing.xs,
  },
  treatmentOption: {
    alignItems: 'center',
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 42,
    paddingHorizontal: spacing.sm,
  },
  treatmentOptionSelected: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.primary,
  },
  radio: {
    borderColor: colors.faint,
    borderRadius: 999,
    borderWidth: 2,
    height: 16,
    width: 16,
  },
  radioSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionText: {
    color: colors.muted,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '800',
  },
  optionTextSelected: {
    color: colors.primaryDark,
  },
  selectedTarget: {
    gap: spacing.xs,
  },
  selectedLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  searchResults: {
    gap: spacing.xs,
  },
  warningPanel: {
    backgroundColor: '#FFF7E8',
    borderColor: '#E5C27D',
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  warningText: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
    lineHeight: 17,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '900',
  },
  dangerButton: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  dangerButtonText: {
    color: colors.surface,
    fontSize: typography.small,
    fontWeight: '900',
  },
  unlinkButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  unlinkButtonText: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
  },
});
