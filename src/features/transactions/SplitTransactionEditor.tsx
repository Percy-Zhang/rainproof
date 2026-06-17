import { StyleSheet, View } from 'react-native';

import {
  getMixedSplitTransactionFormSummary,
  getMixedSplitTransactionValidationMessage,
  getSplitTransactionFormSummary,
  getSplitTransactionValidationMessage,
  type SplitTransactionFormLine,
} from '../../domain/splitTransactionForm';
import type {
  SplitTransactionLineKind,
  SplitTransactionMode,
} from '../../domain/splitTransactions';
import type { CategoryDefinition, CurrencyCode } from '../../domain/types';
import { spacing } from '../../theme/tokens';
import {
  AddSplitLineButton,
  SplitLineRow,
  SplitModeToggle,
  SplitSummaryHeader,
  SplitValidationError,
} from './SplitTransactionEditorParts';

export { SplitTransactionEditorScrollContainer } from './SplitTransactionEditorScrollContainer';

type SplitTransactionEditorProps = {
  categories: CategoryDefinition[];
  currencyCode: CurrencyCode;
  itemNameSuggestions?: string[];
  lines: SplitTransactionFormLine[];
  parentKind?: SplitTransactionLineKind;
  showCurrencyCodes: boolean;
  splitMode?: SplitTransactionMode;
  totalMinor: number;
  onAddLine: () => void;
  onChangeLineKind?: (lineId: string, kind: SplitTransactionLineKind) => void;
  onChangeSplitMode?: (mode: SplitTransactionMode) => void;
  onPickCategory: (lineId: string) => void;
  onRemoveLine: (lineId: string) => void;
  onUpdateLine: (lineId: string, patch: Partial<SplitTransactionFormLine>) => void;
};

export function SplitTransactionEditor({
  categories,
  currencyCode,
  itemNameSuggestions = [],
  lines,
  parentKind,
  showCurrencyCodes,
  splitMode = 'standard',
  totalMinor,
  onAddLine,
  onChangeLineKind,
  onChangeSplitMode,
  onPickCategory,
  onRemoveLine,
  onUpdateLine,
}: SplitTransactionEditorProps) {
  const supportsMixedSplit = !!parentKind && !!onChangeSplitMode && !!onChangeLineKind;
  const mixedSummary =
    splitMode === 'mixed' && parentKind
      ? getMixedSplitTransactionFormSummary({ kind: parentKind, totalMinor, lines })
      : null;
  const standardSummary = mixedSummary ? null : getSplitTransactionFormSummary(totalMinor, lines);
  const validationMessage =
    mixedSummary && parentKind
      ? getMixedSplitTransactionValidationMessage({ kind: parentKind, totalMinor, lines })
      : getSplitTransactionValidationMessage(totalMinor, lines);

  return (
    <View style={styles.stack}>
      {supportsMixedSplit && onChangeSplitMode ? (
        <SplitModeToggle splitMode={splitMode} onChangeSplitMode={onChangeSplitMode} />
      ) : null}

      <SplitSummaryHeader
        currencyCode={currencyCode}
        mixedSummary={mixedSummary}
        showCurrencyCodes={showCurrencyCodes}
        standardSummary={standardSummary}
        totalMinor={totalMinor}
      />

      <SplitValidationError lineCount={lines.length} validationMessage={validationMessage} />

      {lines.map((line, index) => (
        <SplitLineRow
          key={line.id}
          categories={categories}
          currencyCode={currencyCode}
          index={index}
          itemNameSuggestions={itemNameSuggestions}
          line={line}
          parentKind={parentKind}
          showCurrencyCodes={showCurrencyCodes}
          splitMode={splitMode}
          onChangeLineKind={onChangeLineKind}
          onPickCategory={onPickCategory}
          onRemoveLine={onRemoveLine}
          onUpdateLine={onUpdateLine}
        />
      ))}

      <AddSplitLineButton onAddLine={onAddLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.sm,
  },
});
