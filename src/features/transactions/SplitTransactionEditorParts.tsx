import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, FormError } from '../../components/ui';
import {
  getCategory,
  getSubcategoryColor,
  getSubcategoryIcon,
  getSubcategoryName,
} from '../../domain/categories';
import {
  formatMinorInput,
  getMixedSplitTransactionFormSummary,
  getSplitTransactionFormSummary,
  type SplitTransactionFormLine,
} from '../../domain/splitTransactionForm';
import type {
  SplitTransactionLineKind,
  SplitTransactionMode,
} from '../../domain/splitTransactions';
import { getFilteredTransactionItemNameSuggestions } from '../../domain/transactionItemSuggestions';
import { formatMoney } from '../../domain/money';
import type { CategoryDefinition, CurrencyCode } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { AutocompleteField, InlineField, SelectorRow } from './TransactionFormComponents';
import { RevealableSplitField } from './SplitTransactionEditorScrollContainer';

type MixedSummary = ReturnType<typeof getMixedSplitTransactionFormSummary>;
type StandardSummary = ReturnType<typeof getSplitTransactionFormSummary>;

export function SplitModeToggle({
  onChangeSplitMode,
  splitMode,
}: {
  onChangeSplitMode: (mode: SplitTransactionMode) => void;
  splitMode: SplitTransactionMode;
}) {
  return (
    <View style={styles.modeToggle} testID="split-mode-toggle">
      {(['standard', 'mixed'] as const).map((mode) => {
        const selected = splitMode === mode;
        return (
          <Pressable
            key={mode}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChangeSplitMode(mode)}
            style={({ pressed }) => [
              styles.modeOption,
              selected && styles.modeOptionSelected,
              pressed && styles.pressed,
            ]}
            testID={`split-mode-${mode}`}
          >
            <Text style={[styles.modeOptionText, selected && styles.modeOptionTextSelected]}>
              {mode === 'standard' ? 'Standard split' : 'Mixed split'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SplitSummaryHeader({
  currencyCode,
  mixedSummary,
  showCurrencyCodes,
  standardSummary,
  totalMinor,
}: {
  currencyCode: CurrencyCode;
  mixedSummary: MixedSummary | null;
  showCurrencyCodes: boolean;
  standardSummary: StandardSummary | null;
  totalMinor: number;
}) {
  if (mixedSummary) {
    return (
      <View style={styles.summaryGrid}>
        <SummaryCell
          label="Parent net"
          value={formatSignedAmount(mixedSummary.parentSignedMinor, currencyCode, showCurrencyCodes)}
        />
        <SummaryCell
          label="Income"
          value={formatSignedAmount(mixedSummary.incomeMinor, currencyCode, showCurrencyCodes)}
        />
        <SummaryCell
          label="Expense"
          value={formatSignedAmount(-mixedSummary.expenseMinor, currencyCode, showCurrencyCodes)}
        />
        <SummaryCell
          label="Difference"
          value={formatSignedAmount(mixedSummary.differenceMinor, currencyCode, showCurrencyCodes)}
          tone={mixedSummary.differenceMinor === 0 && mixedSummary.isBalanced ? 'balanced' : 'warning'}
        />
      </View>
    );
  }

  if (!standardSummary) {
    return null;
  }

  return (
    <View style={styles.summaryGrid}>
      <SummaryCell label="Total" value={formatMoney(totalMinor, currencyCode, { showCurrencyCode: showCurrencyCodes })} />
      <SummaryCell
        label="Allocated"
        value={formatMoney(standardSummary.allocatedMinor, currencyCode, { showCurrencyCode: showCurrencyCodes })}
      />
      <SummaryCell
        label={standardSummary.remainingMinor === 0 ? 'Remaining' : standardSummary.remainingMinor > 0 ? 'Left' : 'Over'}
        value={formatMoney(Math.abs(standardSummary.remainingMinor), currencyCode, { showCurrencyCode: showCurrencyCodes })}
        tone={standardSummary.remainingMinor === 0 ? 'balanced' : 'warning'}
      />
    </View>
  );
}

export function SplitValidationError({
  lineCount,
  validationMessage,
}: {
  lineCount: number;
  validationMessage: string;
}) {
  return <FormError message={validationMessage && lineCount >= 2 ? validationMessage : ''} />;
}

export function SplitLineRow({
  categories,
  currencyCode,
  index,
  itemNameSuggestions,
  line,
  onChangeLineKind,
  onPickCategory,
  onRemoveLine,
  onUpdateLine,
  parentKind,
  showCurrencyCodes,
  splitMode,
}: {
  categories: CategoryDefinition[];
  currencyCode: CurrencyCode;
  index: number;
  itemNameSuggestions: string[];
  line: SplitTransactionFormLine;
  onChangeLineKind?: (lineId: string, kind: SplitTransactionLineKind) => void;
  onPickCategory: (lineId: string) => void;
  onRemoveLine: (lineId: string) => void;
  onUpdateLine: (lineId: string, patch: Partial<SplitTransactionFormLine>) => void;
  parentKind?: SplitTransactionLineKind;
  showCurrencyCodes: boolean;
  splitMode: SplitTransactionMode;
}) {
  const category = getCategory(line.categoryId, categories);

  return (
    <Card style={styles.lineCard} testID={`split-line-${index + 1}`}>
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
      {splitMode === 'mixed' && parentKind && onChangeLineKind ? (
        <SplitLineKindToggle
          line={line}
          index={index}
          parentKind={parentKind}
          onChangeLineKind={onChangeLineKind}
        />
      ) : null}
      <RevealableSplitField>
        {({ onBlur, onFocus }) => (
          <InlineField
            label="Amount"
            value={line.amount}
            onChange={(amount) => onUpdateLine(line.id, { amount })}
            onBlur={onBlur}
            onFocus={onFocus}
            placeholder={formatMinorInput(0)}
            keyboardType="decimal-pad"
            rightLabel={showCurrencyCodes ? currencyCode : undefined}
            selectAllOnFocus
          />
        )}
      </RevealableSplitField>
      <SelectorRow
        label="Category"
        value={`${category.name} / ${getSubcategoryName(category.id, line.subcategoryId, categories)}`}
        onPress={() => onPickCategory(line.id)}
        color={getSubcategoryColor(category.id, line.subcategoryId, categories)}
        icon={getSubcategoryIcon(category.id, line.subcategoryId, categories)}
        iconColor={getSubcategoryColor(category.id, line.subcategoryId, categories)}
        empty={!line.subcategoryId}
      />
      <RevealableSplitField>
        {({ onBlur, onFocus }) => (
          <AutocompleteField
            label="Line item"
            value={line.note}
            onChange={(note) => onUpdateLine(line.id, { note })}
            onBlur={onBlur}
            onFocus={onFocus}
            placeholder="Optional"
            suggestions={getFilteredTransactionItemNameSuggestions(itemNameSuggestions, line.note)}
          />
        )}
      </RevealableSplitField>
    </Card>
  );
}

export function AddSplitLineButton({ onAddLine }: { onAddLine: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onAddLine}
      style={({ pressed }) => [styles.addLineButton, pressed && styles.pressed]}
      testID="add-split-line"
    >
      <Ionicons name="add" size={18} color={colors.primaryDark} />
      <Text style={styles.addLineText}>Add split line</Text>
    </Pressable>
  );
}

function SplitLineKindToggle({
  index,
  line,
  onChangeLineKind,
  parentKind,
}: {
  index: number;
  line: SplitTransactionFormLine;
  onChangeLineKind: (lineId: string, kind: SplitTransactionLineKind) => void;
  parentKind: SplitTransactionLineKind;
}) {
  return (
    <View style={styles.lineKindToggle}>
      {(['income', 'expense'] as const).map((lineKind) => {
        const selected = (line.kind ?? parentKind) === lineKind;
        return (
          <Pressable
            key={lineKind}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChangeLineKind(line.id, lineKind)}
            style={({ pressed }) => [
              styles.lineKindOption,
              selected && styles.lineKindOptionSelected,
              pressed && styles.pressed,
            ]}
            testID={`split-line-${index + 1}-kind-${lineKind}`}
          >
            <Text style={[styles.lineKindText, selected && styles.lineKindTextSelected]}>
              {lineKind === 'income' ? 'Income' : 'Expense'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function formatSignedAmount(
  amountMinor: number,
  currencyCode: CurrencyCode,
  showCurrencyCode: boolean,
): string {
  const prefix = amountMinor > 0 ? '+' : amountMinor < 0 ? '-' : '';
  return `${prefix}${formatMoney(Math.abs(amountMinor), currencyCode, { showCurrencyCode })}`;
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
  lineCard: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  lineHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lineKindOption: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: spacing.sm,
  },
  lineKindOptionSelected: {
    backgroundColor: colors.surface,
  },
  lineKindText: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
  },
  lineKindTextSelected: {
    color: colors.primaryDark,
  },
  lineKindToggle: {
    backgroundColor: colors.background,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 3,
  },
  lineTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  modeOption: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: spacing.sm,
  },
  modeOptionSelected: {
    backgroundColor: colors.primaryDark,
  },
  modeOptionText: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
  },
  modeOptionTextSelected: {
    color: colors.surface,
  },
  modeToggle: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 3,
  },
  pressed: {
    opacity: 0.78,
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
  summaryBalanced: {
    backgroundColor: '#E4F3EF',
    borderColor: colors.success,
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
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
  summaryWarning: {
    backgroundColor: '#F8E8E8',
    borderColor: colors.danger,
  },
});
