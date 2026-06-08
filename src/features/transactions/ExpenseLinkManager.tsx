import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '../../domain/money';
import {
  getExpenseLinkTargetMoney,
  getIncomeLinkSourceCandidates,
  getTransactionLinkEndpointDisplay,
  type IncomeLinkSourceCandidate,
} from '../../domain/transactionLinking';
import type {
  AppSnapshot,
  NewTransactionLinkInput,
  Transaction,
  TransactionLinkType,
  UpdateTransactionLinkInput,
} from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { InlineField } from './TransactionFormComponents';
import { IncomeSourceRow } from './TransactionLinkCandidateRows';
import { LinkedTransactionIndicator } from './LinkedTransactionIndicator';
import {
  getTransactionLinkTypeShortLabel,
  transactionLinkTypeOptions,
} from './TransactionLinkLabels';

type ExpenseLinkManagerProps = {
  snapshot: AppSnapshot;
  transaction: Transaction;
  onAddTransactionLink: (input: NewTransactionLinkInput) => Promise<void>;
  onUpdateTransactionLink: (input: UpdateTransactionLinkInput) => Promise<void>;
  onDeleteTransactionLink: (linkId: string) => Promise<void>;
  onError: (message: string) => void;
};

export function ExpenseLinkManager({
  snapshot,
  transaction,
  onAddTransactionLink,
  onUpdateTransactionLink,
  onDeleteTransactionLink,
  onError,
}: ExpenseLinkManagerProps) {
  const targetLinks = snapshot.transactionLinks.filter((link) => link.targetTransactionId === transaction.id);
  const [linkType, setLinkType] = useState<TransactionLinkType>('refund');
  const [query, setQuery] = useState('');
  const targetMoney = getExpenseLinkTargetMoney(transaction.id, snapshot.transactionLines);
  const candidates = useMemo(
    () =>
      getIncomeLinkSourceCandidates({
        targetTransactionId: transaction.id,
        targetCurrencyCode: targetMoney?.currencyCode ?? null,
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
        transactionLinks: snapshot.transactionLinks,
        query,
      }).slice(0, 12),
    [
      query,
      snapshot.transactionLines,
      snapshot.transactionLinks,
      snapshot.transactions,
      targetMoney?.currencyCode,
      transaction.id,
    ],
  );

  async function linkIncome(candidate: IncomeLinkSourceCandidate) {
    if (!candidate.eligible) {
      return;
    }

    try {
      const existingLink = snapshot.transactionLinks.find(
        (link) =>
          link.sourceTransactionId === candidate.transaction.id &&
          link.targetTransactionId === transaction.id &&
          !link.sourceLineId &&
          !link.targetLineId,
      );
      const input = {
        sourceTransactionId: candidate.transaction.id,
        targetTransactionId: transaction.id,
        linkType,
        amountMinor: candidate.amountMinor,
        currencyCode: candidate.currencyCode,
      };
      if (existingLink) {
        await onUpdateTransactionLink({ id: existingLink.id, ...input });
      } else {
        await onAddTransactionLink(input);
      }
      onError('');
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Could not link income transaction.');
    }
  }

  async function unlink(linkId: string) {
    try {
      await onDeleteTransactionLink(linkId);
      onError('');
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Could not unlink transaction.');
    }
  }

  return (
    <>
      {targetLinks.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Linked money received</Text>
          <View style={styles.linkSummaryList}>
            {targetLinks.map((link) => {
              const sourceDisplay = getTransactionLinkEndpointDisplay({
                transactionId: link.sourceTransactionId,
                lineId: link.sourceLineId,
                transactions: snapshot.transactions,
                lines: snapshot.transactionLines,
                categories: snapshot.categories,
              });
              const targetDisplay = getTransactionLinkEndpointDisplay({
                transactionId: link.targetTransactionId,
                lineId: link.targetLineId,
                transactions: snapshot.transactions,
                lines: snapshot.transactionLines,
                categories: snapshot.categories,
              });
              const primaryDisplay = targetDisplay.kind === 'split-line' ? targetDisplay : sourceDisplay;
              const title = primaryDisplay.kind === 'missing' ? 'Linked item unavailable' : primaryDisplay.title || 'Income';
              const primaryContext = primaryDisplay.kind === 'missing' ? '' : primaryDisplay.context;
              const secondaryTitle = targetDisplay.kind === 'split-line' && sourceDisplay.kind !== 'missing'
                ? sourceDisplay.title
                : '';
              return (
                <View key={link.id} style={styles.linkSummaryRow}>
                  <View style={styles.linkSummaryText}>
                    <View style={styles.linkSummaryTitleRow}>
                      <LinkedTransactionIndicator compact />
                      <Text numberOfLines={1} style={styles.linkSummaryTitle}>{title}</Text>
                    </View>
                    <Text numberOfLines={1} style={styles.linkSummaryMeta}>
                      {[
                        primaryContext,
                        getTransactionLinkTypeShortLabel(link.linkType),
                        formatMoney(link.amountMinor, link.currencyCode),
                      ].filter(Boolean).join(' / ')}
                    </Text>
                    {secondaryTitle ? (
                      <Text numberOfLines={1} style={styles.linkSummaryMeta}>{secondaryTitle}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => unlink(link.id)}
                    style={({ pressed }) => [styles.smallDangerButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.smallDangerText}>Unlink</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Link incoming money</Text>
        <View style={styles.optionList}>
          {transactionLinkTypeOptions.map((option) => (
            <Pressable
              accessibilityRole="button"
              key={option.value}
              onPress={() => setLinkType(option.value)}
              style={({ pressed }) => [
                styles.treatmentOption,
                linkType === option.value && styles.treatmentOptionSelected,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.radio, linkType === option.value && styles.radioSelected]} />
              <Text style={[styles.optionText, linkType === option.value && styles.optionTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <InlineField label="Find income" value={query} onChange={setQuery} placeholder="Search by item or currency" />
        <View style={styles.searchResults}>
          {candidates.map((candidate) => (
            <IncomeSourceRow
              key={candidate.transaction.id}
              candidate={candidate}
              snapshot={snapshot}
              onPress={() => linkIncome(candidate)}
            />
          ))}
          {!candidates.length ? <Text style={styles.emptyText}>No matching income transactions.</Text> : null}
        </View>
      </View>
    </>
  );
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
  searchResults: {
    gap: spacing.xs,
  },
  linkSummaryList: {
    gap: spacing.xs,
  },
  linkSummaryRow: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  linkSummaryText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  linkSummaryTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '900',
    minWidth: 0,
  },
  linkSummaryTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minWidth: 0,
  },
  linkSummaryMeta: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  smallDangerButton: {
    alignItems: 'center',
    borderColor: '#E4C3C3',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: spacing.sm,
  },
  smallDangerText: {
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
