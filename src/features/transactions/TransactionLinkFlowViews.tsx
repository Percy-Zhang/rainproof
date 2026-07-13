import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '../../domain/money';
import type { CurrencyCode } from '../../domain/types';
import { sharedStyles } from '../../theme/sharedStyles';
import { colors, spacing, typography } from '../../theme/tokens';

export function LinkFlowHeader({ title, subtitle, onBack }: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.flowHeader}>
      <Pressable
        accessibilityLabel="Back to links overview"
        accessibilityRole="button"
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && sharedStyles.pressed]}
      >
        <Ionicons name="chevron-back" size={18} color={colors.primaryDark} />
        <Text style={styles.backText}>Links</Text>
      </Pressable>
      <Text style={styles.flowTitle}>{title}</Text>
      {subtitle ? <Text numberOfLines={2} style={styles.flowSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function LinkOverviewGroup({
  title,
  amountMinor,
  currencyCode,
  statusText,
  relationshipCount,
  expanded,
  onToggle,
  children,
  testID,
}: {
  title: string;
  amountMinor: number;
  currencyCode: CurrencyCode;
  statusText: string;
  relationshipCount: number;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View style={styles.scopeGroup} testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => [styles.scopeHeader, pressed && sharedStyles.pressed]}
      >
        <View style={styles.scopeText}>
          <Text numberOfLines={2} style={styles.scopeTitle}>{title}</Text>
          <Text numberOfLines={1} style={styles.scopeStatus}>{statusText}</Text>
        </View>
        <View style={styles.scopeEnd}>
          <Text style={styles.scopeAmount}>{formatMoney(amountMinor, currencyCode)}</Text>
          {relationshipCount ? (
            <View style={styles.scopeCountRow}>
              <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.muted} />
              <Text style={styles.scopeCount}>
                {relationshipCount} {relationshipCount === 1 ? 'link' : 'links'}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      {expanded ? <View style={styles.scopeChildren}>{children}</View> : null}
    </View>
  );
}

export function LinkOverviewAllocationRow({
  title,
  amountMinor,
  currencyCode,
  dateLabel,
  directionLabel,
  onPress,
  testID,
}: {
  title: string;
  amountMinor: number;
  currencyCode: CurrencyCode;
  dateLabel: string;
  directionLabel: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.relationshipRow, pressed && sharedStyles.pressed]}
      testID={testID}
    >
      <View style={styles.relationshipText}>
        <Text numberOfLines={2} style={styles.relationshipTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.relationshipMeta}>
          {formatMoney(amountMinor, currencyCode)} linked{dateLabel ? ` · ${dateLabel}` : ''}
        </Text>
        <Text numberOfLines={2} style={styles.relationshipDirection}>{directionLabel}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export function LinkCandidateRow({
  title,
  statusText,
  detail,
  amountMinor,
  currencyCode,
  dateLabel,
  bestMatch,
  disabled,
  onPress,
}: {
  title: string;
  statusText: string;
  detail: string;
  amountMinor: number;
  currencyCode: CurrencyCode;
  dateLabel: string;
  bestMatch: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.candidateBlock}>
      {bestMatch ? <Text style={styles.bestMatch}>Best match</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.candidateRow,
          disabled && styles.disabled,
          pressed && !disabled && sharedStyles.pressed,
        ]}
      >
        <View style={styles.candidateText}>
          <Text numberOfLines={2} style={styles.candidateTitle}>{title}</Text>
          <Text numberOfLines={2} style={styles.candidateStatus}>{statusText}</Text>
          <Text numberOfLines={1} style={styles.candidateDetail}>{detail}</Text>
        </View>
        <View style={styles.candidateEnd}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.candidateAmount}>
            {formatMoney(amountMinor, currencyCode)}
          </Text>
          <Text style={styles.candidateDate}>{dateLabel}</Text>
        </View>
      </Pressable>
    </View>
  );
}

export function LinkPrimaryButton({ label, disabled = false, onPress }: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.primaryButton, (pressed || disabled) && sharedStyles.pressed]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backButton: { alignItems: 'center', flexDirection: 'row', minHeight: 38, paddingRight: spacing.sm },
  backText: { color: colors.primaryDark, fontSize: typography.small, fontWeight: '900' },
  flowHeader: { gap: spacing.xs },
  flowTitle: { color: colors.ink, fontSize: typography.h3, fontWeight: '900' },
  flowSubtitle: { color: colors.muted, fontSize: typography.small, fontWeight: '700' },
  scopeGroup: { borderColor: colors.faint, borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  scopeHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 62, padding: spacing.sm },
  scopeText: { flex: 1, gap: 2, minWidth: 0 },
  scopeTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '900' },
  scopeStatus: { color: colors.primaryDark, fontSize: typography.small, fontWeight: '800' },
  scopeEnd: { alignItems: 'flex-end', flexShrink: 0, gap: 2 },
  scopeAmount: { color: colors.ink, fontSize: typography.small, fontWeight: '900' },
  scopeCountRow: { alignItems: 'center', flexDirection: 'row' },
  scopeCount: { color: colors.muted, fontSize: typography.small, fontWeight: '700' },
  scopeChildren: { borderTopColor: colors.faint, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.xs, padding: spacing.xs },
  relationshipRow: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 6, flexDirection: 'row', gap: spacing.sm, minHeight: 64, padding: spacing.sm },
  relationshipText: { flex: 1, gap: 2, minWidth: 0 },
  relationshipTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '900' },
  relationshipMeta: { color: colors.muted, fontSize: typography.small, fontWeight: '800' },
  relationshipDirection: { color: colors.primaryDark, fontSize: typography.small, fontWeight: '700' },
  candidateBlock: { gap: spacing.xs },
  bestMatch: { color: colors.success, fontSize: typography.small, fontWeight: '900', textTransform: 'uppercase' },
  candidateRow: { alignItems: 'center', borderColor: colors.faint, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 72, padding: spacing.sm },
  candidateText: { flex: 1, gap: 2, minWidth: 0 },
  candidateTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '900' },
  candidateStatus: { color: colors.primaryDark, fontSize: typography.small, fontWeight: '800' },
  candidateDetail: { color: colors.muted, fontSize: typography.small },
  candidateEnd: { alignItems: 'flex-end', flexShrink: 0, gap: 2, maxWidth: '38%' },
  candidateAmount: { color: colors.ink, fontSize: typography.body, fontWeight: '900' },
  candidateDate: { color: colors.muted, fontSize: typography.small, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 8, justifyContent: 'center', minHeight: 42, paddingHorizontal: spacing.md },
  primaryButtonText: { color: colors.surface, fontSize: typography.body, fontWeight: '900' },
});
