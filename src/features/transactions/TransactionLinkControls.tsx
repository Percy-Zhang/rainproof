import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '../../domain/money';
import type {
  ScopedTransactionLinkAllocationStatus,
  TransactionLinkAllocationState,
} from '../../domain/transactionLinkAllocationStatus';
import type { TransactionLinkCandidateFilter } from '../../domain/transactionLinkCandidateModel';
import { sharedStyles } from '../../theme/sharedStyles';
import { colors, spacing, typography } from '../../theme/tokens';
import { InlineField } from './TransactionFormComponents';

export function LinkAllocationSummary({ status }: { status: ScopedTransactionLinkAllocationStatus }) {
  const source = status.side === 'source';
  const invalid = status.invalidLinkCount > 0 || status.invalidDraftChangeCount > 0 || status.parentOverAllocatedMinor > 0;
  const countLabel = source
    ? status.linkCount === 1 ? 'use' : 'uses'
    : status.linkCount === 1 ? 'payment' : 'payments';
  return (
    <View style={styles.summaryBlock}>
      <View style={styles.summaryRow}>
        <SummaryCell label={source ? 'Received' : 'Original'} value={formatMoney(status.originalMinor, status.currencyCode)} />
        <SummaryCell label="Allocated" value={formatMoney(status.allocatedMinor, status.currencyCode)} />
        <SummaryCell label={source ? 'Available' : 'Remaining'} value={formatMoney(status.remainingMinor, status.currencyCode)} />
      </View>
      <Text style={[styles.statusText, invalid && styles.invalidText]}>
        {invalid ? 'Allocation needs attention' : formatAllocationStatus(status.status)}
        {status.linkCount > 0 ? ' · ' + status.linkCount + ' ' + countLabel : ''}
      </Text>
      {status.scope === 'line' && status.wholeScopeAllocatedMinor > 0 ? (
        <Text style={styles.contextText}>
          {'Whole transaction allocated ' + formatMoney(status.wholeScopeAllocatedMinor, status.currencyCode) + ' separately'}
        </Text>
      ) : null}
    </View>
  );
}

export function TransactionLinkCandidateFilterControl({ value, onChange }: {
  value: TransactionLinkCandidateFilter;
  onChange: (value: TransactionLinkCandidateFilter) => void;
}) {
  const filters: { label: string; value: TransactionLinkCandidateFilter }[] = [
    { label: 'Open', value: 'open' },
    { label: 'Partial', value: 'partial' },
    { label: 'Settled', value: 'settled' },
    { label: 'All', value: 'all' },
  ];
  return (
    <View style={styles.segmentedRow}>
      {filters.map((filter) => {
        const selected = filter.value === value;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={filter.value}
            onPress={() => onChange(filter.value)}
            style={({ pressed }) => [styles.segment, selected && styles.filterSelected, pressed && sharedStyles.pressed]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{filter.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function LinkAllocationAmountEditor({
  amount,
  currencyCode,
  quickActionLabel,
  onChangeAmount,
  onRemove,
  onUseMaximum,
}: {
  amount: string;
  currencyCode: string;
  quickActionLabel: string;
  onChangeAmount: (amount: string) => void;
  onRemove?: () => void;
  onUseMaximum: () => void;
}) {
  return (
    <View style={styles.amountEditor}>
      <InlineField
        label="Allocate"
        value={amount}
        onChange={onChangeAmount}
        placeholder="0.00"
        keyboardType="decimal-pad"
        rightLabel={currencyCode}
        selectAllOnFocus
      />
      <View style={styles.editorDivider} />
      <View style={styles.editorActions} testID="link-allocation-actions">
        <Pressable
          accessibilityRole="button"
          onPress={onUseMaximum}
          style={({ pressed }) => [styles.quickAction, pressed && sharedStyles.pressed]}
        >
          <Text style={styles.quickActionText}>{quickActionLabel}</Text>
        </Pressable>
        {onRemove ? (
          <Pressable
            accessibilityRole="button"
            onPress={onRemove}
            style={({ pressed }) => [styles.removeAction, pressed && sharedStyles.pressed]}
          >
            <Text style={styles.removeActionText}>Remove</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryCell}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function formatAllocationStatus(status: TransactionLinkAllocationState): string {
  if (status === 'partial') return 'Partial';
  if (status === 'settled') return 'Settled';
  return 'Open';
}

const styles = StyleSheet.create({
  amountEditor: { gap: spacing.sm },
  contextText: { color: colors.muted, fontSize: typography.small, fontWeight: '700' },
  filterSelected: { backgroundColor: colors.primaryDark },
  invalidText: { color: colors.danger },
  quickAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: spacing.sm,
  },
  quickActionText: { color: colors.primaryDark, fontSize: typography.small, fontWeight: '900' },
  editorActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  editorDivider: { backgroundColor: colors.faint, height: StyleSheet.hairlineWidth },
  removeAction: {
    alignItems: 'center',
    borderColor: colors.danger,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 88,
    paddingHorizontal: spacing.sm,
  },
  removeActionText: { color: colors.danger, fontSize: typography.small, fontWeight: '900' },
  segment: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 0,
    paddingHorizontal: spacing.xs,
  },
  segmentedRow: {
    backgroundColor: colors.background,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 3,
  },
  segmentText: { color: colors.muted, fontSize: typography.small, fontWeight: '800' },
  segmentTextSelected: { color: colors.surface },
  statusText: { color: colors.primaryDark, fontSize: typography.small, fontWeight: '900' },
  summaryBlock: { gap: spacing.xs },
  summaryCell: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    flex: 1,
    gap: 2,
    minWidth: 0,
    padding: spacing.sm,
  },
  summaryLabel: { color: colors.muted, fontSize: typography.small, fontWeight: '800', textTransform: 'uppercase' },
  summaryRow: { flexDirection: 'row', gap: spacing.xs },
  summaryValue: { color: colors.ink, fontSize: typography.body, fontWeight: '900' },
});
