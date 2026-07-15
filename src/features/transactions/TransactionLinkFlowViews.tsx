import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { getAccountDisplayName } from '../../domain/accountThemes';
import { getSubcategoryColor, getSubcategoryIcon } from '../../domain/categories';
import { formatMoney, normalizeCurrencyCode } from '../../domain/money';
import type { ScopedTransactionLinkAllocationStatus } from '../../domain/transactionLinkAllocationStatus';
import { getTransactionAmountTone } from '../../domain/transactionDisplay';
import {
  getTransactionLinkEndpointDisplay,
  getTransactionLinkEndpointSignedAmountMinor,
} from '../../domain/transactionLinking';
import type {
  AppSnapshot,
  CurrencyCode,
  TransactionLine,
  TransactionLinkBatchInput,
} from '../../domain/types';
import { sharedStyles } from '../../theme/sharedStyles';
import { colors, spacing, typography } from '../../theme/tokens';
import { LinkedTransactionIndicator } from './LinkedTransactionIndicator';

const OVERVIEW_REVEAL_DURATION_MS = 170;
const overviewLayoutTransition = LinearTransition
  .duration(OVERVIEW_REVEAL_DURATION_MS)
  .easing(Easing.out(Easing.cubic))
  .reduceMotion(ReduceMotion.System);
const overviewEntering = FadeInDown
  .duration(OVERVIEW_REVEAL_DURATION_MS)
  .easing(Easing.out(Easing.cubic))
  .reduceMotion(ReduceMotion.System);
const overviewExiting = FadeOutUp
  .duration(130)
  .easing(Easing.in(Easing.cubic))
  .reduceMotion(ReduceMotion.System);

export type TransactionLinkManagerHandle = {
  getDraftChanges: () => TransactionLinkBatchInput;
  handleBack: () => boolean;
};

export function LinkFlowContext({ subtitle, amountMinor, currencyCode }: {
  subtitle?: string;
  amountMinor?: number;
  currencyCode?: CurrencyCode;
}) {
  const amountTone = amountMinor === undefined ? 'neutral' : getTransactionAmountTone(amountMinor);
  return (
    <View style={styles.flowContext}>
      {subtitle ? <Text numberOfLines={2} style={styles.flowSubtitle}>{subtitle}</Text> : null}
      {amountMinor !== undefined && currencyCode ? (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[
            styles.flowAmount,
            amountTone === 'positive' ? styles.incomeAmount : amountTone === 'negative' ? styles.expenseAmount : styles.neutralAmount,
          ]}
          testID="link-flow-scope-amount"
        >
          {formatSignedMoney(amountMinor, currencyCode)}
        </Text>
      ) : null}
    </View>
  );
}

export function LinkScopeParentSummary({
  dateLabel,
  snapshot,
  status,
  title,
  transactionId,
}: {
  dateLabel: string;
  snapshot: AppSnapshot;
  status: ScopedTransactionLinkAllocationStatus;
  title: string;
  transactionId: string;
}) {
  const amountMinor = status.side === 'source' ? status.originalMinor : -status.originalMinor;
  const amountTone = getTransactionAmountTone(amountMinor);
  return (
    <View accessibilityRole="summary" style={styles.parentSummary} testID="link-parent-summary">
      <LinkEndpointIcon
        currencyCode={status.currencyCode}
        lineId={null}
        snapshot={snapshot}
        transactionId={transactionId}
      />
      <View style={styles.parentSummaryText}>
        <Text numberOfLines={2} style={styles.parentSummaryTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.parentSummaryDate} testID="links-overview-date">{dateLabel}</Text>
      </View>
      <Text
        numberOfLines={1}
        style={[
          styles.parentSummaryAmount,
          amountTone === 'positive' ? styles.incomeAmount : amountTone === 'negative' ? styles.expenseAmount : styles.neutralAmount,
        ]}
      >
        {formatSignedMoney(amountMinor, status.currencyCode)}
      </Text>
    </View>
  );
}

export function LinkOverviewGroup({
  children,
  currencyCode,
  expanded,
  lineId,
  linked,
  onLink,
  onToggle,
  relationshipCount,
  signedAmountMinor,
  snapshot,
  statusText,
  testID,
  title,
  transactionId,
}: {
  children: ReactNode;
  currencyCode: CurrencyCode;
  expanded: boolean;
  lineId: string | null;
  linked: boolean;
  onLink?: () => void;
  onToggle: () => void;
  relationshipCount: number;
  signedAmountMinor: number;
  snapshot: AppSnapshot;
  statusText: string;
  testID?: string;
  title: string;
  transactionId: string;
}) {
  const amountTone = getTransactionAmountTone(signedAmountMinor);
  const chevronProgress = useSharedValue(expanded ? 1 : 0);
  const visualExpandedRef = useRef(expanded);
  const animateExpansion = useCallback((nextExpanded: boolean) => {
    visualExpandedRef.current = nextExpanded;
    cancelAnimation(chevronProgress);
    chevronProgress.value = withTiming(nextExpanded ? 1 : 0, {
      duration: OVERVIEW_REVEAL_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [chevronProgress]);

  useEffect(() => {
    if (visualExpandedRef.current !== expanded) {
      animateExpansion(expanded);
    }
  }, [animateExpansion, expanded]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronProgress.value * 90}deg` }],
  }));

  function handleToggle() {
    if (!relationshipCount) return;
    animateExpansion(!visualExpandedRef.current);
    onToggle();
  }

  return (
    <Animated.View layout={overviewLayoutTransition} style={styles.scopeGroup} testID={testID}>
      <View style={styles.scopeHeader}>
        {relationshipCount ? (
          <Pressable
            accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} links for ${title}`}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            onPress={handleToggle}
            style={({ pressed }) => [styles.scopeToggleTarget, pressed && sharedStyles.pressed]}
            testID={`${testID ?? transactionId}-toggle`}
          />
        ) : null}
        <View pointerEvents="none">
          <LinkEndpointIcon
            currencyCode={currencyCode}
            lineId={lineId}
            snapshot={snapshot}
            transactionId={transactionId}
          />
        </View>
        <View pointerEvents="none" style={styles.scopeMain}>
          <Text numberOfLines={2} style={styles.scopeTitle}>{title}</Text>
          <View style={styles.scopeStatusRow} testID={`${testID ?? transactionId}-status`}>
            {linked ? <LinkedTransactionIndicator compact /> : null}
            <Text numberOfLines={1} style={styles.scopeStatus}>{statusText}</Text>
          </View>
        </View>
        <View pointerEvents="box-none" style={styles.scopeEnd}>
          <Text
            numberOfLines={1}
            pointerEvents="none"
            style={[
              styles.scopeAmount,
              amountTone === 'positive' ? styles.incomeAmount : amountTone === 'negative' ? styles.expenseAmount : styles.neutralAmount,
            ]}
          >
            {formatSignedMoney(signedAmountMinor, currencyCode)}
          </Text>
          {onLink ? <LinkActionButton label="Link" onPress={onLink} /> : null}
          {relationshipCount ? (
            <View pointerEvents="none" style={styles.scopeCountRow}>
              <Animated.View style={chevronStyle}>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </Animated.View>
              <Text style={styles.scopeCount}>
                {relationshipCount} {relationshipCount === 1 ? 'link' : 'links'}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      {expanded ? (
        <Animated.View
          entering={overviewEntering}
          exiting={overviewExiting}
          style={styles.scopeChildren}
          testID={`${testID ?? transactionId}-relationships`}
        >
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

export function LinkOverviewAllocationRow({
  currencyCode,
  dateLabel,
  directionLabel,
  iconLineId,
  iconTransactionId,
  amountMinor,
  onPress,
  onUnlink,
  signedAmountMinor,
  snapshot,
  testID,
  title,
}: {
  amountMinor: number;
  currencyCode: CurrencyCode;
  dateLabel: string;
  directionLabel: string;
  iconLineId: string | null;
  iconTransactionId: string;
  onPress: () => void;
  onUnlink: () => void;
  signedAmountMinor: number;
  snapshot: AppSnapshot;
  testID?: string;
  title: string;
}) {
  const amountTone = getTransactionAmountTone(signedAmountMinor);
  return (
    <View style={styles.relationshipRow} testID={testID}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.relationshipMain, pressed && sharedStyles.pressed]}
      >
        <View testID={`${testID ?? iconTransactionId}-category-icon`}>
          <LinkEndpointIcon
            currencyCode={currencyCode}
            lineId={iconLineId}
            snapshot={snapshot}
            transactionId={iconTransactionId}
          />
        </View>
        <View style={styles.relationshipText}>
          <View style={styles.relationshipTitleRow}>
            <LinkedTransactionIndicator compact />
            <Text numberOfLines={2} style={styles.relationshipTitle}>{title}</Text>
          </View>
          <Text numberOfLines={1} style={styles.relationshipMeta}>
            {formatMoney(amountMinor, currencyCode)} linked{dateLabel ? ` · ${dateLabel}` : ''}
          </Text>
          <Text numberOfLines={2} style={styles.relationshipDirection}>{directionLabel}</Text>
        </View>
        <View style={styles.relationshipEnd}>
          <Text
            numberOfLines={1}
            style={[
              styles.relationshipAmount,
              amountTone === 'positive' ? styles.incomeAmount : amountTone === 'negative' ? styles.expenseAmount : styles.neutralAmount,
            ]}
            testID={`${testID ?? iconTransactionId}-signed-amount`}
          >
            {formatSignedMoney(signedAmountMinor, currencyCode)}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </View>
      </Pressable>
      <LinkActionButton destructive label="Unlink" onPress={onUnlink} />
    </View>
  );
}

export function LinkRelationshipDetail({
  amountMinor,
  currencyCode,
  existing,
  onAction,
  snapshot,
  sourceLineId,
  sourceTransactionId,
  targetLineId,
  targetTransactionId,
}: {
  amountMinor: number;
  currencyCode: CurrencyCode;
  existing: boolean;
  onAction: () => void;
  snapshot: AppSnapshot;
  sourceLineId: string | null;
  sourceTransactionId: string;
  targetLineId: string | null;
  targetTransactionId: string;
}) {
  return (
    <View style={styles.relationshipDetail} testID={existing ? 'existing-link-detail' : 'new-link-detail'}>
      <LinkEndpointSummaryCard
        currencyCode={currencyCode}
        lineId={sourceLineId}
        snapshot={snapshot}
        transactionId={sourceTransactionId}
        testID="link-source-endpoint"
      />
      <View style={styles.relationshipConnector}>
        <Ionicons name="swap-vertical-outline" size={18} color={colors.primaryDark} />
        <Text style={styles.relationshipConnectorText}>{existing ? 'Linked' : 'Link'}</Text>
      </View>
      <LinkEndpointSummaryCard
        currencyCode={currencyCode}
        lineId={targetLineId}
        snapshot={snapshot}
        transactionId={targetTransactionId}
        testID="link-target-endpoint"
      />
      <View style={styles.linkedAmountBlock}>
        <Text style={styles.linkedAmountLabel}>{existing ? 'Linked amount' : 'Amount to link'}</Text>
        <Text style={styles.linkedAmountValue} testID="link-detail-amount">
          {formatMoney(amountMinor, currencyCode)}
        </Text>
      </View>
      <LinkPrimaryButton destructive={existing} label={existing ? 'Unlink' : 'Link'} onPress={onAction} />
    </View>
  );
}

export function LinkEndpointSummaryCard({
  currencyCode,
  lineId,
  snapshot,
  testID,
  transactionId,
}: {
  currencyCode: CurrencyCode;
  lineId: string | null;
  snapshot: AppSnapshot;
  testID?: string;
  transactionId: string;
}) {
  const transaction = snapshot.transactions.find((item) => item.id === transactionId);
  const line = getEndpointIdentityLine(transactionId, lineId, currencyCode, snapshot.transactionLines);
  const account = snapshot.accounts.find((item) => item.id === line?.accountId);
  const display = getTransactionLinkEndpointDisplay({
    transactionId,
    lineId,
    transactions: snapshot.transactions,
    lines: snapshot.transactionLines,
    categories: snapshot.categories,
  });
  const signedAmountMinor = getTransactionLinkEndpointSignedAmountMinor({
    transactionId,
    lineId,
    currencyCode,
    lines: snapshot.transactionLines,
  });
  const amountTone = getTransactionAmountTone(signedAmountMinor);
  const contextLabel = getEndpointContextLabel(transactionId, lineId, currencyCode, snapshot);

  return (
    <View accessibilityRole="summary" style={styles.endpointCard} testID={testID}>
      <View testID={`${testID ?? transactionId}-category-icon`}>
        <LinkEndpointIcon
          currencyCode={currencyCode}
          lineId={lineId}
          snapshot={snapshot}
          transactionId={transactionId}
        />
      </View>
      <View style={styles.endpointText}>
        <Text numberOfLines={2} style={styles.endpointTitle}>{display.title || transaction?.title || 'Transaction'}</Text>
        <Text numberOfLines={1} style={styles.endpointMeta}>{display.dateLabel}</Text>
        {account || line?.externalParty ? (
          <Text numberOfLines={1} style={styles.endpointMeta}>
            {account ? getAccountDisplayName(account) : line?.externalParty}
          </Text>
        ) : null}
        <Text numberOfLines={1} style={styles.endpointContext}>{contextLabel}</Text>
      </View>
      <Text
        adjustsFontSizeToFit
        numberOfLines={1}
        style={[
          styles.endpointAmount,
          amountTone === 'positive' ? styles.incomeAmount : amountTone === 'negative' ? styles.expenseAmount : styles.neutralAmount,
        ]}
        testID={`${testID ?? transactionId}-amount`}
      >
        {formatSignedMoney(signedAmountMinor, currencyCode)}
      </Text>
    </View>
  );
}

export function LinkEndpointIcon({
  currencyCode,
  lineId,
  snapshot,
  transactionId,
}: {
  currencyCode: CurrencyCode;
  lineId: string | null;
  snapshot: AppSnapshot;
  transactionId: string;
}) {
  const line = getOverviewIconLine(transactionId, lineId, currencyCode, snapshot.transactionLines);
  const color = line
    ? getSubcategoryColor(line.categoryId, line.subcategoryId, snapshot.categories)
    : colors.primaryDark;
  const icon = line
    ? getSubcategoryIcon(line.categoryId, line.subcategoryId, snapshot.categories)
    : 'git-branch-outline';

  return <CategoryIconBadge color={color} icon={icon} size="sm" />;
}

function LinkActionButton({ destructive = false, label, onPress }: {
  destructive?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.linkAction, destructive && styles.unlinkAction, pressed && sharedStyles.pressed]}
    >
      <Text style={[styles.linkActionText, destructive && styles.unlinkActionText]}>{label}</Text>
    </Pressable>
  );
}

function getEndpointIdentityLine(
  transactionId: string,
  lineId: string | null,
  currencyCode: CurrencyCode,
  lines: TransactionLine[],
): TransactionLine | undefined {
  if (lineId) {
    return lines.find((line) => line.id === lineId && line.transactionId === transactionId);
  }
  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode);
  return lines.find((line) =>
    line.transactionId === transactionId &&
    line.amountMinor !== 0 &&
    normalizeCurrencyCode(line.currencyCode) === normalizedCurrencyCode);
}

function getEndpointContextLabel(
  transactionId: string,
  lineId: string | null,
  currencyCode: CurrencyCode,
  snapshot: AppSnapshot,
): string {
  const transaction = snapshot.transactions.find((item) => item.id === transactionId);
  if (lineId) {
    return `Split line - ${transaction?.title || 'Transaction'}`;
  }

  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode);
  const lines = snapshot.transactionLines.filter((line) =>
    line.transactionId === transactionId &&
    line.amountMinor !== 0 &&
    normalizeCurrencyCode(line.currencyCode) === normalizedCurrencyCode);
  if (lines.length <= 1) return 'Parent transaction';
  const hasIncome = lines.some((line) => line.amountMinor > 0);
  const hasExpense = lines.some((line) => line.amountMinor < 0);
  return hasIncome && hasExpense ? 'Mixed split parent' : 'Split parent';
}

function getOverviewIconLine(
  transactionId: string,
  lineId: string | null,
  currencyCode: CurrencyCode,
  lines: TransactionLine[],
): TransactionLine | undefined {
  if (lineId) {
    return lines.find((line) => line.id === lineId && line.transactionId === transactionId);
  }

  const endpointLines = lines.filter(
    (line) => line.transactionId === transactionId && line.currencyCode === currencyCode && line.amountMinor !== 0,
  );
  const firstLine = endpointLines[0];
  return firstLine && endpointLines.every(
    (line) => line.categoryId === firstLine.categoryId && line.subcategoryId === firstLine.subcategoryId,
  ) ? firstLine : undefined;
}

function formatSignedMoney(amountMinor: number, currencyCode: CurrencyCode): string {
  const amount = formatMoney(Math.abs(amountMinor), currencyCode);
  if (amountMinor < 0) return `-${amount}`;
  if (amountMinor > 0) return `+${amount}`;
  return amount;
}

export function LinkPrimaryButton({ label, destructive = false, disabled = false, onPress }: {
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.primaryButton, destructive && styles.destructivePrimaryButton, (pressed || disabled) && sharedStyles.pressed]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flowContext: { gap: spacing.xs },
  flowAmount: { alignSelf: 'flex-start', fontSize: typography.h3, fontWeight: '900', maxWidth: '100%' },
  flowSubtitle: { color: colors.muted, fontSize: typography.small, fontWeight: '700' },
  incomeAmount: { color: colors.success },
  expenseAmount: { color: colors.danger },
  neutralAmount: { color: colors.ink },
  parentSummary: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 8, flexDirection: 'row', gap: spacing.sm, minHeight: 58, padding: spacing.sm },
  parentSummaryText: { flex: 1, gap: 2, minWidth: 0 },
  parentSummaryTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '900' },
  parentSummaryDate: { color: colors.muted, fontSize: typography.small, fontWeight: '700' },
  parentSummaryAmount: { flexShrink: 0, fontSize: typography.small, fontWeight: '900' },
  scopeGroup: { backgroundColor: colors.surface, borderColor: colors.faint, borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  scopeHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 62, padding: spacing.sm, position: 'relative' },
  scopeToggleTarget: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, zIndex: 0 },
  scopeMain: { flex: 1, gap: 2, minWidth: 0 },
  scopeTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '900' },
  scopeStatus: { color: colors.primaryDark, flexShrink: 1, fontSize: typography.small, fontWeight: '800' },
  scopeStatusRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, minWidth: 0 },
  scopeEnd: { alignItems: 'flex-end', flexShrink: 0, gap: spacing.xs, zIndex: 1 },
  scopeAmount: { fontSize: typography.small, fontWeight: '900' },
  scopeCountRow: { alignItems: 'center', flexDirection: 'row', minHeight: 30 },
  scopeCount: { color: colors.muted, fontSize: typography.small, fontWeight: '700' },
  scopeChildren: { backgroundColor: colors.surface, borderTopColor: colors.faint, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.xs, padding: spacing.xs },
  relationshipRow: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 6, flexDirection: 'row', gap: spacing.xs, minHeight: 64, padding: spacing.xs },
  relationshipMain: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.sm, minWidth: 0, padding: spacing.xs },
  relationshipText: { flex: 1, gap: 2, minWidth: 0 },
  relationshipTitleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  relationshipTitle: { color: colors.ink, flex: 1, fontSize: typography.body, fontWeight: '900', minWidth: 0 },
  relationshipMeta: { color: colors.muted, fontSize: typography.small, fontWeight: '800' },
  relationshipDirection: { color: colors.primaryDark, fontSize: typography.small, fontWeight: '700' },
  relationshipEnd: { alignItems: 'flex-end', flexShrink: 0, gap: spacing.xs, maxWidth: '34%' },
  relationshipAmount: { fontSize: typography.small, fontWeight: '900' },
  relationshipDetail: { gap: spacing.sm },
  relationshipConnector: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' },
  relationshipConnectorText: { color: colors.primaryDark, fontSize: typography.small, fontWeight: '900', textTransform: 'uppercase' },
  endpointCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.faint, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 82, padding: spacing.sm },
  endpointText: { flex: 1, gap: 2, minWidth: 0 },
  endpointTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '900' },
  endpointMeta: { color: colors.muted, fontSize: typography.small, fontWeight: '700' },
  endpointContext: { color: colors.primaryDark, fontSize: typography.small, fontWeight: '800' },
  endpointAmount: { flexShrink: 0, fontSize: typography.body, fontWeight: '900', maxWidth: '35%' },
  linkedAmountBlock: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 8, gap: 2, padding: spacing.sm },
  linkedAmountLabel: { color: colors.muted, fontSize: typography.small, fontWeight: '800', textTransform: 'uppercase' },
  linkedAmountValue: { color: colors.ink, fontSize: typography.h3, fontWeight: '900' },
  linkAction: { alignItems: 'center', borderColor: colors.primary, borderRadius: 6, borderWidth: 1, justifyContent: 'center', minHeight: 34, paddingHorizontal: spacing.sm },
  linkActionText: { color: colors.primaryDark, fontSize: typography.small, fontWeight: '900' },
  unlinkAction: { borderColor: colors.danger },
  unlinkActionText: { color: colors.danger },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 8, justifyContent: 'center', minHeight: 42, paddingHorizontal: spacing.md },
  destructivePrimaryButton: { backgroundColor: colors.danger },
  primaryButtonText: { color: colors.surface, fontSize: typography.body, fontWeight: '900' },
});
