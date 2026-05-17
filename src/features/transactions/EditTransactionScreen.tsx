import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
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
  defaultCategories,
  getCategory,
  getDefaultCategoryForKind,
  getDefaultSubcategoryId,
  getSubcategoryColor,
  getSubcategoryIcon,
  getSubcategoryName,
} from '../../domain/categories';
import { toDateInputValue, toTimeInputValue } from '../../domain/dates';
import { applyLabelSuggestion, getLabelAutocompleteOptions } from '../../domain/labels';
import {
  buildTransactionUpdateInput,
  createTransactionEditDraft,
  formatEditDateLabel,
  getTransferAmountCurrencyCode,
  isOutsideAccountId,
  OUTSIDE_MY_ACCOUNTS_LABEL,
  type TransactionEditDraft,
} from '../../domain/transactionEdit';
import type {
  AppSnapshot,
  TransactionKind,
  UpdateTransactionInput,
  UpdateTransactionLinkInput,
} from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import {
  accountLabel,
  AutocompleteField,
  DateTimePickerFields,
  getNativePickerDisplay,
  getNativePickerValue,
  InlineField,
  SelectorRow,
  TransactionPickerScreen,
  TransactionTypeTabs,
  useAutocompleteOptions,
  type NativePickerMode,
  type TransactionPickerMode,
} from './TransactionFormComponents';
import { DeleteTransactionPanel, TransactionLinkEntryRow } from './TransactionEditActions';

type EditTransactionScreenProps = {
  snapshot: AppSnapshot;
  transactionId: string;
  onUpdateTransaction: (input: UpdateTransactionInput) => Promise<void>;
  onDeleteTransaction: (transactionId: string) => Promise<void>;
  onUpdateTransactionLink: (input: UpdateTransactionLinkInput) => Promise<void>;
  onDeleteTransactionLink: (linkId: string) => Promise<void>;
  onOpenTransactionLink: () => void;
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
  onCancel,
  onDone,
}: EditTransactionScreenProps) {
  const [draft, setDraft] = useState<TransactionEditDraft | null>(null);
  const [error, setError] = useState('');
  const [pickerMode, setPickerMode] = useState<TransactionPickerMode | null>(null);
  const [nativePickerMode, setNativePickerMode] = useState<NativePickerMode | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const showCurrencyCodes = snapshot.settings.multiCurrencyEnabled;
  const categories = snapshot.categories ?? defaultCategories;
  const transactionExists = snapshot.transactions.some((transaction) => transaction.id === transactionId);
  const itemHistory = useMemo(
    () => snapshot.transactions.filter((transaction) => transaction.id !== transactionId).map((transaction) => transaction.title),
    [snapshot.transactions, transactionId],
  );
  const groupHistory = useMemo(
    () => snapshot.transactions.map((transaction) => transaction.groupId).filter(Boolean),
    [snapshot.transactions],
  );
  const labelHistory = useMemo(
    () => snapshot.transactions
      .filter((transaction) => transaction.id !== transactionId)
      .flatMap((transaction) => transaction.labels),
    [snapshot.transactions, transactionId],
  );
  const itemSuggestions = useAutocompleteOptions(itemHistory, draft?.title ?? '');
  const groupSuggestions = useAutocompleteOptions(groupHistory, draft?.groupId ?? '');
  const labelSuggestions = useMemo(
    () => getLabelAutocompleteOptions(labelHistory, draft?.labels ?? ''),
    [draft?.labels, labelHistory],
  );
  const fromAccount = draft && !isOutsideAccountId(draft.accountId)
    ? snapshot.accounts.find((account) => account.id === draft.accountId)
    : undefined;
  const toAccount = draft && !isOutsideAccountId(draft.targetAccountId)
    ? snapshot.accounts.find((account) => account.id === draft.targetAccountId)
    : undefined;
  const amountCurrencyCode = draft
    ? draft.kind === 'transfer'
      ? getTransferAmountCurrencyCode({
          accounts: snapshot.accounts,
          sourceAccountId: draft.accountId,
          targetAccountId: draft.targetAccountId,
        })
      : fromAccount?.currencyCode ?? ''
    : '';
  const selectedCategory = draft?.categoryId ? getCategory(draft.categoryId, categories) : getDefaultCategoryForKind(draft?.kind ?? 'expense', categories);
  const canSave = draft ? canSaveDraft(draft) : false;

  useEffect(() => {
    setConfirmDelete(false);
    try {
      setDraft(createTransactionEditDraft(snapshot, transactionId));
      setError('');
    } catch (caught) {
      setDraft(null);
      setError(caught instanceof Error ? caught.message : 'Could not load transaction.');
    }
  }, [snapshot, transactionId]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (nativePickerMode) {
        setNativePickerMode(null);
        return true;
      }

      if (pickerMode) {
        setPickerMode(null);
        return true;
      }

      onCancel();
      return true;
    });

    return () => subscription.remove();
  }, [nativePickerMode, onCancel, pickerMode]);

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
        onClose={() => setPickerMode(null)}
        onSelectAccount={(accountId) => {
          updateDraft(pickerMode === 'targetAccount' ? { targetAccountId: accountId } : { accountId });
          setPickerMode(null);
        }}
        onSelectCategory={(categoryId, subcategoryId) => {
          updateDraft({ categoryId, subcategoryId });
          setPickerMode(null);
        }}
        onExit={onCancel}
        cancelTestID="cancel-edit-transaction-picker"
      />
    );
  }

  function updateDraft(patch: Partial<TransactionEditDraft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function changeKind(kind: TransactionKind) {
    const defaultCategory = getDefaultCategoryForKind(kind, categories);
    setDraft((current) =>
      current
        ? {
            ...current,
            kind,
            accountId:
              kind !== 'transfer' && isOutsideAccountId(current.accountId)
                ? snapshot.accounts[0]?.id ?? ''
                : current.accountId,
            categoryId: kind === 'transfer' ? '' : defaultCategory.id,
            subcategoryId: kind === 'transfer' ? '' : getDefaultSubcategoryId(defaultCategory),
          }
        : current,
    );
  }

  function handleNativePickerChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (event.type === 'dismissed') {
      setNativePickerMode(null);
      return;
    }

    if (!draft || !selectedDate || !nativePickerMode) {
      return;
    }

    if (nativePickerMode === 'date') {
      updateDraft({ date: toDateInputValue(selectedDate) });
    } else {
      updateDraft({ time: toTimeInputValue(selectedDate) });
    }

    if (Platform.OS === 'android') {
      setNativePickerMode(null);
    }
  }

  async function save() {
    if (!draft) {
      return;
    }

    if (!canSaveDraft(draft)) {
      setError('Complete the transaction before saving.');
      return;
    }

    try {
      const existingSourceLink = snapshot.transactionLinks.find((link) => link.sourceTransactionId === transactionId);
      const existingTargetLinks = snapshot.transactionLinks.filter((link) => link.targetTransactionId === transactionId);
      const input = buildTransactionUpdateInput(draft, snapshot.accounts);

      await onUpdateTransaction(input);

      if (existingSourceLink && input.kind === 'income') {
        const positiveLine = input.lines.find((line) => line.amountMinor > 0);
        if (positiveLine) {
          await onUpdateTransactionLink({
            id: existingSourceLink.id,
            sourceTransactionId: existingSourceLink.sourceTransactionId,
            targetTransactionId: existingSourceLink.targetTransactionId,
            linkType: existingSourceLink.linkType,
            amountMinor: positiveLine.amountMinor,
            currencyCode: positiveLine.currencyCode,
          });
        }
      } else if (existingSourceLink) {
        await onDeleteTransactionLink(existingSourceLink.id);
      }

      if (input.kind !== 'expense') {
        for (const targetLink of existingTargetLinks) {
          await onDeleteTransactionLink(targetLink.id);
        }
      }

      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save transaction.');
    }
  }

  async function deleteCurrentTransaction() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setError('');
      return;
    }

    try {
      await onDeleteTransaction(transactionId);
      setError('');
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete transaction.');
    }
  }

  function canSaveDraft(nextDraft: TransactionEditDraft): boolean {
    try {
      buildTransactionUpdateInput(nextDraft, snapshot.accounts);
      return true;
    } catch {
      return false;
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.headerSide}>
          <Pressable accessibilityRole="button" onPress={onCancel} style={styles.backIconButton}>
            <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>Edit transaction</Text>
        <View style={styles.headerActions}>
          {draft && draft.kind !== 'transfer' ? (
            <Pressable
              accessibilityLabel="Split transaction"
              accessibilityRole="button"
              onPress={() => setError('Split editing will be added later.')}
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

      {draft ? (
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
            <TransactionTypeTabs kind={draft.kind} onChange={changeKind} />

            <AutocompleteField
              label="Item"
              value={draft.title}
              onChange={(title) => updateDraft({ title })}
              placeholder="Groceries, Salary, Transfer"
              suggestions={itemSuggestions}
            />

            <InlineField
              label="Amount"
              value={draft.amount}
              onChange={(amount) => updateDraft({ amount })}
              placeholder="0.00"
              keyboardType="decimal-pad"
              rightLabel={showCurrencyCodes ? amountCurrencyCode : undefined}
              selectAllOnFocus
            />

            <View style={styles.quickRows}>
              <SelectorRow
                label={draft.kind === 'transfer' ? 'From' : 'Account'}
                value={
                  fromAccount
                    ? accountLabel(fromAccount, showCurrencyCodes)
                    : draft.kind === 'transfer'
                      ? OUTSIDE_MY_ACCOUNTS_LABEL
                      : 'Choose account'
                }
                onPress={() => setPickerMode('sourceAccount')}
                color={fromAccount?.themeColor ?? colors.primary}
                icon={fromAccount?.iconName ?? (draft.kind === 'transfer' ? 'globe-outline' : undefined)}
                iconColor={fromAccount?.themeColor ?? colors.primary}
                iconKind="account"
                empty={!fromAccount && draft.kind !== 'transfer'}
              />
              {draft.kind === 'transfer' ? (
                <SelectorRow
                  label="To"
                  value={toAccount ? accountLabel(toAccount, showCurrencyCodes) : OUTSIDE_MY_ACCOUNTS_LABEL}
                  onPress={() => setPickerMode('targetAccount')}
                  color={toAccount?.themeColor ?? colors.primary}
                  icon={toAccount?.iconName ?? 'globe-outline'}
                  iconColor={toAccount?.themeColor ?? colors.primary}
                  iconKind="account"
                />
              ) : (
                <SelectorRow
                  label="Category"
                  value={`${selectedCategory.name} / ${getSubcategoryName(selectedCategory.id, draft.subcategoryId, categories)}`}
                  onPress={() => setPickerMode('category')}
                  color={getSubcategoryColor(selectedCategory.id, draft.subcategoryId, categories)}
                  icon={getSubcategoryIcon(selectedCategory.id, draft.subcategoryId, categories)}
                  iconColor={getSubcategoryColor(selectedCategory.id, draft.subcategoryId, categories)}
                  empty={!draft.subcategoryId}
                />
              )}
            </View>

            <DateTimePickerFields
              dateValue={formatEditDateLabel(draft.date)}
              timeValue={draft.time}
              onPressDate={() => setNativePickerMode('date')}
              onPressTime={() => setNativePickerMode('time')}
            />
            {nativePickerMode ? (
              Platform.OS === 'android' ? (
                <DateTimePicker
                  value={getNativePickerValue(draft.date, draft.time)}
                  mode={nativePickerMode}
                  display={getNativePickerDisplay(nativePickerMode)}
                  is24Hour
                  onChange={handleNativePickerChange}
                />
              ) : (
                <View style={styles.nativePickerPanel}>
                  <DateTimePicker
                    value={getNativePickerValue(draft.date, draft.time)}
                    mode={nativePickerMode}
                    display={getNativePickerDisplay(nativePickerMode)}
                    is24Hour
                    onChange={handleNativePickerChange}
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setNativePickerMode(null)}
                    style={({ pressed }) => [styles.nativePickerDone, pressed && styles.pressed]}
                  >
                    <Text style={styles.nativePickerDoneText}>Done</Text>
                  </Pressable>
                </View>
              )
            ) : null}

            <InlineField
              label="Notes"
              value={draft.notes}
              onChange={(notes) => updateDraft({ notes })}
              placeholder="Optional"
            />
            <AutocompleteField
              label="Group"
              value={draft.groupId}
              onChange={(groupId) => updateDraft({ groupId })}
              placeholder="Trip, project, shared"
              suggestions={groupSuggestions}
            />
            <AutocompleteField
              label="Labels"
              value={draft.labels}
              onChange={(labels) => updateDraft({ labels })}
              onSelectSuggestion={(suggestion) => updateDraft({ labels: applyLabelSuggestion(draft.labels, suggestion) })}
              placeholder="holiday, shared, tax"
              suggestions={labelSuggestions}
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
  quickRows: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  nativePickerPanel: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: spacing.xs,
  },
  nativePickerDone: {
    alignItems: 'center',
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  nativePickerDoneText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
  },
  footer: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.78,
  },
});
