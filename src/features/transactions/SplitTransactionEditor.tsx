import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, FormError } from '../../components/ui';
import {
  getCategory,
  getSubcategoryColor,
  getSubcategoryIcon,
  getSubcategoryName,
} from '../../domain/categories';
import {
  formatMinorInput,
  getSplitTransactionFormSummary,
  getSplitTransactionValidationMessage,
  type SplitTransactionFormLine,
} from '../../domain/splitTransactionForm';
import { getFilteredTransactionItemNameSuggestions } from '../../domain/transactionItemSuggestions';
import { formatMoney } from '../../domain/money';
import type { CategoryDefinition, CurrencyCode } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { AutocompleteField, InlineField, SelectorRow } from './TransactionFormComponents';

type SplitTransactionEditorProps = {
  categories: CategoryDefinition[];
  currencyCode: CurrencyCode;
  itemNameSuggestions?: string[];
  lines: SplitTransactionFormLine[];
  showCurrencyCodes: boolean;
  totalMinor: number;
  onAddLine: () => void;
  onPickCategory: (lineId: string) => void;
  onRemoveLine: (lineId: string) => void;
  onUpdateLine: (lineId: string, patch: Partial<SplitTransactionFormLine>) => void;
};

type SplitTransactionEditorScrollContainerProps = {
  children: ReactNode;
  testID?: string;
};

export function SplitTransactionEditorScrollContainer({
  children,
  testID,
}: SplitTransactionEditorScrollContainerProps) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const keyboardBottomPadding = Math.max(0, keyboardHeight - insets.bottom);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={spacing.xl}
      style={styles.keyboardPane}
    >
      <ScrollView
        contentContainerStyle={[
          styles.keyboardScrollContent,
          { paddingBottom: insets.bottom + keyboardBottomPadding + spacing.xxl },
        ]}
        keyboardDismissMode="none"
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        style={styles.keyboardScroll}
        testID={testID}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function useKeyboardHeight(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return keyboardHeight;
}

export function SplitTransactionEditor({
  categories,
  currencyCode,
  itemNameSuggestions = [],
  lines,
  showCurrencyCodes,
  totalMinor,
  onAddLine,
  onPickCategory,
  onRemoveLine,
  onUpdateLine,
}: SplitTransactionEditorProps) {
  const summary = getSplitTransactionFormSummary(totalMinor, lines);
  const validationMessage = getSplitTransactionValidationMessage(totalMinor, lines);

  return (
    <View style={styles.stack}>
      <View style={styles.summaryGrid}>
        <SummaryCell label="Total" value={formatMoney(totalMinor, currencyCode, { showCurrencyCode: showCurrencyCodes })} />
        <SummaryCell
          label="Allocated"
          value={formatMoney(summary.allocatedMinor, currencyCode, { showCurrencyCode: showCurrencyCodes })}
        />
        <SummaryCell
          label={summary.remainingMinor === 0 ? 'Remaining' : summary.remainingMinor > 0 ? 'Left' : 'Over'}
          value={formatMoney(Math.abs(summary.remainingMinor), currencyCode, { showCurrencyCode: showCurrencyCodes })}
          tone={summary.remainingMinor === 0 ? 'balanced' : 'warning'}
        />
      </View>

      <FormError message={validationMessage && lines.length >= 2 ? validationMessage : ''} />

      {lines.map((line, index) => {
        const category = getCategory(line.categoryId, categories);

        return (
          <Card key={line.id} style={styles.lineCard} testID={`split-line-${index + 1}`}>
            <View style={styles.lineHeader}>
              <Text style={styles.lineTitle}>Split line {index + 1}</Text>
              <Pressable
                accessibilityLabel={`Remove split line ${index + 1}`}
                accessibilityRole="button"
                onPress={() => onRemoveLine(line.id)}
                style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
            <InlineField
              label="Amount"
              value={line.amount}
              onChange={(amount) => onUpdateLine(line.id, { amount })}
              placeholder={formatMinorInput(0)}
              keyboardType="decimal-pad"
              rightLabel={showCurrencyCodes ? currencyCode : undefined}
              selectAllOnFocus
            />
            <SelectorRow
              label="Category"
              value={`${category.name} / ${getSubcategoryName(category.id, line.subcategoryId, categories)}`}
              onPress={() => onPickCategory(line.id)}
              color={getSubcategoryColor(category.id, line.subcategoryId, categories)}
              icon={getSubcategoryIcon(category.id, line.subcategoryId, categories)}
              iconColor={getSubcategoryColor(category.id, line.subcategoryId, categories)}
              empty={!line.subcategoryId}
            />
            <AutocompleteField
              label="Line item"
              value={line.note}
              onChange={(note) => onUpdateLine(line.id, { note })}
              placeholder="Optional"
              suggestions={getFilteredTransactionItemNameSuggestions(itemNameSuggestions, line.note)}
            />
          </Card>
        );
      })}

      <Pressable
        accessibilityRole="button"
        onPress={onAddLine}
        style={({ pressed }) => [styles.addLineButton, pressed && styles.pressed]}
        testID="add-split-line"
      >
        <Ionicons name="add" size={18} color={colors.primaryDark} />
        <Text style={styles.addLineText}>Add split line</Text>
      </Pressable>
    </View>
  );
}

function SummaryCell({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'balanced' | 'warning';
}) {
  return (
    <View style={[styles.summaryCell, tone === 'balanced' && styles.summaryBalanced, tone === 'warning' && styles.summaryWarning]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  keyboardPane: {
    flex: 1,
  },
  keyboardScroll: {
    flex: 1,
  },
  keyboardScrollContent: {
    flexGrow: 1,
    gap: spacing.sm,
  },
  stack: {
    gap: spacing.sm,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryCell: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minWidth: 96,
    padding: spacing.sm,
  },
  summaryBalanced: {
    backgroundColor: '#E4F3EF',
    borderColor: colors.success,
  },
  summaryWarning: {
    backgroundColor: '#F8E8E8',
    borderColor: colors.danger,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  lineCard: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  lineHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lineTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  removeButton: {
    alignItems: 'center',
    borderColor: '#E4C3C3',
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  addLineButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  addLineText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
  },
});
