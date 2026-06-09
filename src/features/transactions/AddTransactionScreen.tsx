import { Ionicons } from '@expo/vector-icons';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FormError } from '../../components/ui';
import { formatLongDateLabel } from '../../domain/dates';
import type { AddTransactionTemplatePrefill } from '../../domain/transactionTemplates';
import type {
  AppSnapshot,
  AddTransactionDefaults,
  NewTransactionInput,
} from '../../domain/types';
import type {
  CategorySelectLaunchParams,
  CategorySelectionResult,
} from '../categorySelection/categorySelectionModel';
import { colors, spacing, typography } from '../../theme/tokens';
import {
  TransactionPickerScreen,
  TransactionTypeTabs,
} from './TransactionFormComponents';
import { TransactionAmountCard } from './TransactionAmountCard';
import { TransactionCalculator } from './TransactionCalculator';
import { TransactionAccountCategorySelectors } from './TransactionAccountCategorySelectors';
import { TransactionDetailsSection } from './TransactionDetailsSection';
import { SplitTransactionEditor, SplitTransactionEditorScrollContainer } from './SplitTransactionEditor';
import { useAddTransactionController } from './useAddTransactionController';

type AddTransactionScreenProps = {
  snapshot: AppSnapshot;
  initialTemplate?: AddTransactionTemplatePrefill;
  dashboardAccountIds?: string[];
  onAddTransaction: (input: NewTransactionInput) => Promise<void>;
  onUpdateAddTransactionDefaults?: (defaults: AddTransactionDefaults) => Promise<void>;
  onOpenCategorySelect: (
    params: CategorySelectLaunchParams,
    onSelect: (selection: CategorySelectionResult) => void,
  ) => void;
  onDone: () => void;
};

export function AddTransactionScreen({
  initialTemplate,
  dashboardAccountIds,
  snapshot,
  onAddTransaction,
  onUpdateAddTransactionDefaults,
  onOpenCategorySelect,
  onDone,
}: AddTransactionScreenProps) {
  const controller = useAddTransactionController({
    dashboardAccountIds,
    initialTemplate,
    snapshot,
    onAddTransaction,
    onDone,
    onOpenCategorySelect,
    onUpdateAddTransactionDefaults,
  });
  const {
    addSplitLine,
    amountCurrencyCode,
    amountExpression,
    applyLabelAutocompleteSuggestion,
    canSave,
    categories,
    categoryId,
    changeKind,
    changeSplitLineKind,
    changeSplitMode,
    closePicker,
    date,
    error,
    fromAccount,
    fromAccountId,
    groupId,
    groupSuggestions,
    handleNativePickerChange,
    item,
    itemHistory,
    itemSuggestions,
    kind,
    labelSuggestions,
    labels,
    nativePickerMode,
    nativePickerValue,
    notes,
    openMainCategorySelect,
    openSplitEditor,
    openSplitLineCategorySelect,
    page,
    pickerMode,
    pressCalculatorKey,
    previewAmountMinor,
    removeSplitLine,
    replaceAmountOnNextKey,
    selectedCategory,
    selectPickerAccount,
    setGroupId,
    setItem,
    setLabels,
    setNativePickerMode,
    setNotes,
    setPage,
    setPickerMode,
    setReplaceAmountOnNextKey,
    showCurrencyCodes,
    splitLines,
    splitMode,
    splitSummary,
    splitTotalMinor,
    subcategoryId,
    submit,
    time,
    toAccount,
    toAccountId,
    updateSplitLine,
  } = controller;

  if (pickerMode) {
    return (
      <TransactionPickerScreen
        mode={pickerMode}
        accounts={snapshot.accounts}
        selectedAccountId={pickerMode === 'targetAccount' ? toAccountId : fromAccountId}
        selectedCategoryId={categoryId}
        selectedSubcategoryId={subcategoryId}
        kind={kind}
        categories={categories}
        transactions={snapshot.transactions}
        transactionLines={snapshot.transactionLines}
        showCurrencyCodes={showCurrencyCodes}
        sourceAccountId={fromAccountId}
        onClose={closePicker}
        onSelectAccount={selectPickerAccount}
        onSelectCategory={() => undefined}
        onExit={onDone}
        cancelTestID="cancel-add-transaction-picker"
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.headerSide}>
          <Pressable
            accessibilityRole="button"
            onPress={page === 'amount' ? onDone : () => setPage('amount')}
            style={styles.backIconButton}
            testID="cancel-add-transaction"
          >
            <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
            <Text style={styles.backButtonText}>{page === 'amount' ? 'Back' : 'Amount'}</Text>
          </Pressable>
        </View>
        <View style={styles.headerCenter} />
        <View style={styles.headerSide}>
          <Pressable
            accessibilityLabel="Save transaction"
            accessibilityRole="button"
            disabled={!canSave}
            onPress={submit}
            style={({ pressed }) => [styles.headerSaveButton, !canSave && styles.headerSaveDisabled, pressed && styles.pressed]}
            testID={page === 'amount' ? 'save-transaction' : page === 'split' ? 'save-transaction-split' : 'save-transaction-details'}
          >
            <Text style={[styles.headerSaveText, !canSave && styles.headerSaveTextDisabled]}>Save</Text>
          </Pressable>
        </View>
      </View>

      {page === 'amount' ? (
        <View style={styles.contentPane} testID="add-transaction-amount-page">
          <TransactionTypeTabs kind={kind} onChange={changeKind} />

          <TransactionAmountCard
            amountCurrencyCode={amountCurrencyCode}
            amountExpression={amountExpression}
            kind={kind}
            previewAmountMinor={previewAmountMinor}
            replaceAmountOnNextKey={replaceAmountOnNextKey}
            showCurrencyCodes={showCurrencyCodes}
            onPress={() => setReplaceAmountOnNextKey(true)}
          />

          <TransactionAccountCategorySelectors
            categories={categories}
            emptySourceAccountLabel="No account"
            fromAccount={fromAccount}
            kind={kind}
            selectedCategory={selectedCategory}
            showCurrencyCodes={showCurrencyCodes}
            subcategoryId={subcategoryId}
            toAccount={toAccount}
            onPressCategory={openMainCategorySelect}
              onPressSourceAccount={() => setPickerMode('sourceAccount')}
              onPressTargetAccount={() => setPickerMode('targetAccount')}
          />

          {kind !== 'transfer' ? (
            <Pressable
              accessibilityRole="button"
              onPress={openSplitEditor}
              style={({ pressed }) => [styles.optionsButton, pressed && styles.pressed]}
              testID="transaction-split-options"
            >
              <Ionicons name="git-branch-outline" size={18} color={colors.primaryDark} />
              <Text style={styles.optionsButtonText}>
                {splitLines.length >= 2
                  ? `${splitMode === 'mixed' ? 'Mixed split' : 'Split'} · ${splitLines.length} lines · ${splitSummary.isBalanced ? 'Ready' : 'Needs total'}`
                  : `Split ${kind}`}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => setPage('details')}
            style={({ pressed }) => [styles.optionsButton, pressed && styles.pressed]}
            testID="transaction-more-options"
          >
            <Ionicons name="options-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.optionsButtonText}>More options</Text>
          </Pressable>

          <TransactionCalculator onPressKey={pressCalculatorKey} />
        </View>
      ) : page === 'split' ? (
        <SplitTransactionEditorScrollContainer testID="add-transaction-split-page">
          <Text style={styles.detailsTitle}>{splitMode === 'mixed' ? 'Mixed split' : `Split ${kind}`}</Text>
          <SplitTransactionEditor
            categories={categories}
            currencyCode={fromAccount?.currencyCode ?? amountCurrencyCode}
            lines={splitLines}
            itemNameSuggestions={itemHistory}
            parentKind={kind === 'transfer' ? undefined : kind}
            showCurrencyCodes={showCurrencyCodes}
            splitMode={splitMode}
            totalMinor={splitTotalMinor}
            onAddLine={addSplitLine}
            onChangeLineKind={changeSplitLineKind}
            onChangeSplitMode={changeSplitMode}
            onPickCategory={(lineId) => {
              openSplitLineCategorySelect(lineId);
            }}
            onRemoveLine={removeSplitLine}
            onUpdateLine={updateSplitLine}
          />
        </SplitTransactionEditorScrollContainer>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={spacing.xl}
          style={styles.keyboardPane}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            testID="add-transaction-details-page"
          >
            <Text style={styles.detailsTitle}>More options</Text>

            <TransactionDetailsSection
              dateLabel={formatLongDateLabel(date)}
              group={groupId}
              groupSuggestions={groupSuggestions}
              item={item}
              itemSuggestions={itemSuggestions}
              labels={labels}
              labelSuggestions={labelSuggestions}
              nativePickerMode={nativePickerMode}
              nativePickerValue={nativePickerValue}
              notes={notes}
              time={time}
              onChangeGroup={setGroupId}
              onChangeItem={setItem}
              onChangeLabels={setLabels}
              onChangeNotes={setNotes}
              onCloseNativePicker={() => setNativePickerMode(null)}
              onNativePickerChange={handleNativePickerChange}
              onPressDate={() => setNativePickerMode('date')}
              onPressTime={() => setNativePickerMode('time')}
              onSelectLabelSuggestion={applyLabelAutocompleteSuggestion}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <View style={styles.footer}>
        <FormError message={error} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: spacing.sm,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 44,
  },
  headerSide: {
    width: 92,
  },
  headerCenter: {
    flex: 1,
  },
  backIconButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 40,
    paddingRight: spacing.sm,
  },
  headerSaveButton: {
    alignItems: 'flex-end',
    minHeight: 40,
    justifyContent: 'center',
  },
  headerSaveDisabled: {
    opacity: 0.45,
  },
  headerSaveText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
  },
  headerSaveTextDisabled: {
    color: colors.muted,
  },
  optionsButton: {
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
  optionsButtonText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '800',
  },
  contentPane: {
    flex: 1,
    gap: spacing.sm,
  },
  keyboardPane: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    gap: spacing.sm,
    paddingBottom: 180,
  },
  detailsTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '900',
  },
  backButtonText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '800',
  },
  footer: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.78,
  },
});
