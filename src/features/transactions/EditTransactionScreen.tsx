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
import {
  formatEditDateLabel,
} from '../../domain/transactionEdit';
import type {
  AppSnapshot,
  UpdateTransactionInput,
  UpdateTransactionLinkInput,
} from '../../domain/types';
import type {
  CategorySelectLaunchParams,
  CategorySelectionResult,
} from '../categorySelection/categorySelectionModel';
import { colors, spacing, typography } from '../../theme/tokens';
import {
  AutocompleteField,
  getNativePickerValue,
  InlineField,
  TransactionPickerScreen,
  TransactionTypeTabs,
} from './TransactionFormComponents';
import { DeleteTransactionPanel, TransactionLinkEntryRow } from './TransactionEditActions';
import { TransactionAccountCategorySelectors } from './TransactionAccountCategorySelectors';
import { TransactionMetadataFields } from './TransactionDetailsSection';
import { SplitTransactionEditor, SplitTransactionEditorScrollContainer } from './SplitTransactionEditor';
import { useEditTransactionController } from './useEditTransactionController';

type EditTransactionScreenProps = {
  snapshot: AppSnapshot;
  transactionId: string;
  onUpdateTransaction: (input: UpdateTransactionInput) => Promise<void>;
  onDeleteTransaction: (transactionId: string) => Promise<void>;
  onUpdateTransactionLink: (input: UpdateTransactionLinkInput) => Promise<void>;
  onDeleteTransactionLink: (linkId: string) => Promise<void>;
  onOpenTransactionLink: () => void;
  onOpenCategorySelect: (
    params: CategorySelectLaunchParams,
    onSelect: (selection: CategorySelectionResult) => void,
  ) => void;
  onCancel: () => void;
  onDone: () => void;
};

export function EditTransactionScreen({
  snapshot,
  transactionId,
  onUpdateTransaction,
  onDeleteTransaction,
  onUpdateTransactionLink,
  onDeleteTransactionLink,
  onOpenTransactionLink,
  onOpenCategorySelect,
  onCancel,
  onDone,
}: EditTransactionScreenProps) {
  const controller = useEditTransactionController({
    snapshot,
    transactionId,
    onUpdateTransaction,
    onDeleteTransaction,
    onUpdateTransactionLink,
    onDeleteTransactionLink,
    onOpenCategorySelect,
    onCancel,
    onDone,
  });
  const {
    addSplitLine,
    amountCurrencyCode,
    applyLabelAutocompleteSuggestion,
    canSave,
    categories,
    changeKind,
    changeSplitLineKind,
    changeSplitMode,
    closePicker,
    confirmDelete,
    deleteCurrentTransaction,
    draft,
    error,
    fromAccount,
    getEditableSplitLines,
    getSplitTotalMinor,
    groupSuggestions,
    handleNativePickerChange,
    isCrossCurrencyTransfer,
    itemHistory,
    itemSuggestions,
    labelSuggestions,
    nativePickerMode,
    openMainCategorySelect,
    openSplitEditor,
    openSplitLineCategorySelect,
    page,
    pickerMode,
    removeSplitLine,
    save,
    selectedCategory,
    selectPickerAccount,
    setConfirmDelete,
    setNativePickerMode,
    setPage,
    setPickerMode,
    showCurrencyCodes,
    targetAmountCurrencyCode,
    toAccount,
    transactionExists,
    crossCurrencyTransferRateLabel,
    updateDraft,
    updateSplitLine,
  } = controller;

  if (draft && pickerMode) {
    return (
      <TransactionPickerScreen
        mode={pickerMode}
        accounts={snapshot.accounts}
        selectedAccountId={pickerMode === 'targetAccount' ? draft.targetAccountId : draft.accountId}
        selectedCategoryId={draft.categoryId}
        selectedSubcategoryId={draft.subcategoryId}
        kind={draft.kind}
        categories={categories}
        transactions={snapshot.transactions}
        transactionLines={snapshot.transactionLines}
        showCurrencyCodes={showCurrencyCodes}
        sourceAccountId={draft.accountId}
        onClose={closePicker}
        onSelectAccount={selectPickerAccount}
        onSelectCategory={() => undefined}
        onExit={onCancel}
        cancelTestID="cancel-edit-transaction-picker"
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.headerSide}>
          <Pressable
            accessibilityRole="button"
            onPress={page === 'split' ? () => setPage('form') : onCancel}
            style={styles.backIconButton}
          >
            <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
            <Text style={styles.backButtonText}>{page === 'split' ? 'Edit' : 'Back'}</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>
          {page === 'split'
            ? draft?.splitMode === 'mixed'
              ? 'Mixed split'
              : `Split ${draft?.kind ?? 'transaction'}`
            : 'Edit transaction'}
        </Text>
        <View style={styles.headerActions}>
          {draft && draft.kind !== 'transfer' ? (
            <Pressable
              accessibilityLabel="Split transaction"
              accessibilityRole="button"
              onPress={openSplitEditor}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              testID="split-edit-transaction"
            >
              <Ionicons name="git-branch-outline" size={20} color={colors.primaryDark} />
            </Pressable>
          ) : null}
          {draft ? (
            <Pressable
              accessibilityLabel="Save changes"
              accessibilityRole="button"
              disabled={!canSave}
              onPress={save}
              style={({ pressed }) => [styles.iconButton, !canSave && styles.iconButtonDisabled, pressed && canSave && styles.pressed]}
              testID="save-edit-transaction"
            >
              <Ionicons name="checkmark-outline" size={21} color={canSave ? colors.primaryDark : colors.muted} />
            </Pressable>
          ) : (
            <View style={styles.iconButtonPlaceholder} />
          )}
        </View>
      </View>

      {draft && page === 'split' ? (
        <SplitTransactionEditorScrollContainer>
          <SplitTransactionEditor
            categories={categories}
            currencyCode={amountCurrencyCode}
            lines={getEditableSplitLines(draft)}
            itemNameSuggestions={itemHistory}
            parentKind={draft.kind === 'transfer' ? undefined : draft.kind}
            showCurrencyCodes={showCurrencyCodes}
            splitMode={draft.splitMode ?? 'standard'}
            totalMinor={getSplitTotalMinor(draft)}
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
      ) : draft ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={spacing.xl}
          style={styles.keyboardPane}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <>
              <TransactionTypeTabs kind={draft.kind} onChange={changeKind} />

              <AutocompleteField
                label="Item"
                value={draft.title}
                onChange={(title) => updateDraft({ title })}
                placeholder="Groceries, Salary, Transfer"
                suggestions={itemSuggestions}
              />

              <InlineField
                label={isCrossCurrencyTransfer ? 'Sent amount' : 'Amount'}
                value={draft.amount}
                onChange={(amount) => updateDraft({ amount })}
                placeholder="0.00"
                keyboardType="decimal-pad"
                rightLabel={showCurrencyCodes ? amountCurrencyCode : undefined}
                selectAllOnFocus
              />

              {isCrossCurrencyTransfer ? (
                <View style={styles.crossCurrencyBlock}>
                  <InlineField
                    label="Received amount"
                    value={draft.targetAmount ?? ''}
                    onChange={(targetAmount) => updateDraft({ targetAmount })}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    rightLabel={showCurrencyCodes ? targetAmountCurrencyCode : undefined}
                    selectAllOnFocus
                  />
                  <Text style={styles.rateLabel}>
                    {crossCurrencyTransferRateLabel || 'Enter the received amount to show the rate.'}
                  </Text>
                </View>
              ) : null}

              <TransactionAccountCategorySelectors
                categories={categories}
                emptySourceAccountLabel="Choose account"
                fromAccount={fromAccount}
                kind={draft.kind}
                selectedCategory={selectedCategory}
                showCurrencyCodes={showCurrencyCodes}
                subcategoryId={draft.subcategoryId}
                toAccount={toAccount}
                onPressCategory={openMainCategorySelect}
                onPressSourceAccount={() => setPickerMode('sourceAccount')}
                onPressTargetAccount={() => setPickerMode('targetAccount')}
              />

              <TransactionMetadataFields
                dateLabel={formatEditDateLabel(draft.date)}
                group={draft.groupId}
                groupSuggestions={groupSuggestions}
                labels={draft.labels}
                labelSuggestions={labelSuggestions}
                nativePickerMode={nativePickerMode}
                nativePickerValue={getNativePickerValue(draft.date, draft.time)}
                notes={draft.notes}
                time={draft.time}
                onChangeGroup={(groupId) => updateDraft({ groupId })}
                onChangeLabels={(labels) => updateDraft({ labels })}
                onChangeNotes={(notes) => updateDraft({ notes })}
                onCloseNativePicker={() => setNativePickerMode(null)}
                onNativePickerChange={handleNativePickerChange}
                onPressDate={() => setNativePickerMode('date')}
                onPressTime={() => setNativePickerMode('time')}
                onSelectLabelSuggestion={applyLabelAutocompleteSuggestion}
              />

              {draft.kind !== 'transfer' ? (
                <TransactionLinkEntryRow
                  snapshot={snapshot}
                  transactionId={transactionId}
                  onPress={onOpenTransactionLink}
                />
              ) : null}
              <DeleteTransactionPanel
                confirmDelete={confirmDelete}
                onCancel={() => setConfirmDelete(false)}
                onDelete={deleteCurrentTransaction}
              />
            </>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : transactionExists ? (
        <View style={styles.deleteOnlyPane}>
          <DeleteTransactionPanel
            confirmDelete={confirmDelete}
            onCancel={() => setConfirmDelete(false)}
            onDelete={deleteCurrentTransaction}
          />
        </View>
      ) : null}

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
    width: 96,
  },
  title: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.h3,
    fontWeight: '900',
    textAlign: 'center',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  iconButtonDisabled: {
    opacity: 0.45,
  },
  iconButtonPlaceholder: {
    height: 40,
    width: 40,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'flex-end',
    width: 96,
  },
  backIconButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 40,
    paddingRight: spacing.sm,
  },
  backButtonText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '800',
  },
  keyboardPane: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    gap: spacing.sm,
    paddingBottom: 180,
  },
  deleteOnlyPane: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  crossCurrencyBlock: {
    gap: spacing.xs,
  },
  rateLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  footer: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.78,
  },
});
