import { Pressable, StyleSheet, Text } from 'react-native';

import { formatMoneyAccounting } from '../../domain/money';
import type { TransactionKind } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { getTransactionKindColor, getTransactionKindTint } from './TransactionKindTabs';

export function TransactionAmountCard({
  amountCurrencyCode,
  amountExpression,
  kind,
  previewAmountMinor,
  replaceAmountOnNextKey,
  showCurrencyCodes,
  onPress,
}: {
  amountCurrencyCode: string;
  amountExpression: string;
  kind: TransactionKind;
  previewAmountMinor: number;
  replaceAmountOnNextKey: boolean;
  showCurrencyCodes: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.amountBlock,
        {
          backgroundColor: getTransactionKindTint(kind),
          borderColor: getTransactionKindColor(kind),
        },
        replaceAmountOnNextKey && styles.amountBlockSelected,
      ]}
    >
      {showCurrencyCodes && amountCurrencyCode ? (
        <Text style={[styles.amountCurrency, { color: getTransactionKindColor(kind) }]}>{amountCurrencyCode}</Text>
      ) : null}
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.expressionText}>
        {amountExpression || '0.00'}
      </Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.amountText, getAmountStyle(previewAmountMinor)]}>
        {amountCurrencyCode ? formatMoneyAccounting(previewAmountMinor, amountCurrencyCode) : ''}
      </Text>
    </Pressable>
  );
}

function getAmountStyle(amountMinor: number) {
  if (amountMinor > 0) {
    return styles.amountPositive;
  }

  if (amountMinor < 0) {
    return styles.amountNegative;
  }

  return styles.amountNeutral;
}

const styles = StyleSheet.create({
  amountBlock: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  amountBlockSelected: {
    borderWidth: 2,
  },
  amountCurrency: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '900',
    textAlign: 'right',
  },
  expressionText: {
    color: colors.muted,
    fontSize: typography.body,
    fontWeight: '800',
    minHeight: 20,
    textAlign: 'right',
  },
  amountText: {
    color: colors.ink,
    fontSize: 40,
    fontWeight: '900',
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
});
