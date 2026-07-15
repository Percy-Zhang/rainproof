import { Ionicons } from '@expo/vector-icons';
import { useCallback, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatMoney } from '../../domain/money';
import type {
  ScopedTransactionLinkAllocationStatus,
  TransactionLinkAllocationState,
} from '../../domain/transactionLinkAllocationStatus';
import type { TransactionLinkCandidateFilter } from '../../domain/transactionLinkCandidateModel';
import { sharedStyles } from '../../theme/sharedStyles';
import { colors, spacing, typography } from '../../theme/tokens';

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
    <View>
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
    </View>
  );
}

export function TransactionLinkSearchField({ value, onChange }: {
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<TextInput>(null);
  const handleClear = useCallback(() => {
    onChange('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [onChange]);

  return (
    <View style={styles.searchBlock}>
      <Text style={styles.searchLabel}>Search</Text>
      <View style={styles.searchInputContainer}>
        <TextInput
          ref={inputRef}
          accessibilityLabel="Search transactions"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={onChange}
          placeholder="Search transactions"
          placeholderTextColor={`${colors.muted}99`}
          returnKeyType="search"
          style={styles.searchInput}
          value={value}
        />
        {value.length ? (
          <Pressable
            accessibilityLabel="Clear transaction search"
            accessibilityRole="button"
            hitSlop={4}
            onPress={handleClear}
            style={({ pressed }) => [styles.searchClearButton, pressed && sharedStyles.pressed]}
          >
            <Ionicons name="close" size={20} color={colors.muted} />
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
  contextText: { color: colors.muted, fontSize: typography.small, fontWeight: '700' },
  filterSelected: { backgroundColor: colors.primaryDark },
  invalidText: { color: colors.danger },
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
  searchBlock: { gap: spacing.xs },
  searchClearButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 4,
    top: 4,
    width: 36,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typography.body,
    height: 44,
    includeFontPadding: false,
    paddingLeft: spacing.md,
    paddingRight: 48,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  searchInputContainer: { position: 'relative' },
  searchLabel: { color: colors.muted, fontSize: typography.small, fontWeight: '800', textTransform: 'uppercase' },
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
