import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
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
import { getAddTransactionBackAction } from '../../domain/addTransactionFlow';
import { evaluateMoneyExpression } from '../../domain/calculator';
import {
  defaultCategories,
  getCategory,
  getDefaultCategoryForKind,
  getDefaultSubcategoryId,
  getSubcategoryColor,
  getSubcategoryIcon,
  getSubcategoryName,
} from '../../domain/categories';
import { formatLongDateLabel, parseDateTimeInput, toDateInputValue, toTimeInputValue } from '../../domain/dates';
import { applyLabelSuggestion, getLabelAutocompleteOptions, parseLabelsInput } from '../../domain/labels';
import { parseMoneyInput } from '../../domain/money';
import {
  buildSplitLinesFromForm,
  createSplitTransactionFormLine,
  formatMinorInput,
  getSplitTransactionFormSummary,
  type SplitTransactionFormLine,
} from '../../domain/splitTransactionForm';
import {
  buildTransferTransactionLines,
  getTransferAmountCurrencyCode,
  isOutsideAccountId,
  OUTSIDE_ACCOUNT_ID,
  OUTSIDE_MY_ACCOUNTS_LABEL,
} from '../../domain/transactionEdit';
import type {
  AppSnapshot,
  NewTransactionInput,
  TransactionKind,
} from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import {
  accountLabel,
  AutocompleteField,
  DateTimePickerFields,
  getNativePickerDisplay,
  getNativePickerValue,
  SelectorRow,
  TransactionPickerScreen,
  TransactionTypeTabs,
  useAutocompleteOptions,
  type NativePickerMode,
  type TransactionPickerMode,
} from './TransactionFormComponents';
import { TransactionAmountCard } from './TransactionAmountCard';
import { TransactionCalculator, type CalculatorKey } from './TransactionCalculator';
import { SplitTransactionEditor, SplitTransactionEditorScrollContainer } from './SplitTransactionEditor';

type AddTransactionScreenProps = {
  snapshot: AppSnapshot;
  onAddTransaction: (input: NewTransactionInput) => Promise<void>;
  onDone: () => void;
};

type Page = 'amount' | 'details' | 'split';

let splitLineCounter = 0;

function createSplitLineId(): string {
  splitLineCounter += 1;
  return `split-line-${splitLineCounter}`;
}

export function AddTransactionScreen({ snapshot, onAddTransaction, onDone }: AddTransactionScreenProps) {
  const now = new Date();
  const [page, setPage] = useState<Page>('amount');
  const [pickerMode, setPickerMode] = useState<TransactionPickerMode | null>(null);
  const [nativePickerMode, setNativePickerMode] = useState<NativePickerMode | null>(null);
  const [kind, setKind] = useState<TransactionKind>('expense');
  const [item, setItem] = useState('');
  const [amountExpression, setAmountExpression] = useState('');
  const [replaceAmountOnNextKey, setReplaceAmountOnNextKey] = useState(false);
  const [date, setDate] = useState(toDateInputValue(now));
  const [time, setTime] = useState(toTimeInputValue(now));
  const [fromAccountId, setFromAccountId] = useState(snapshot.accounts[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(snapshot.accounts[1]?.id ?? OUTSIDE_ACCOUNT_ID);
  const [categoryId, setCategoryId] = useState(getDefaultCategoryForKind('expense').id);
  const [subcategoryId, setSubcategoryId] = useState(getDefaultSubcategoryId(getDefaultCategoryForKind('expense')));
  const [labels, setLabels] = useState('');
  const [groupId, setGroupId] = useState('');
  const [splitLines, setSplitLines] = useState<SplitTransactionFormLine[]>([]);
  const [splitCategoryLineId, setSplitCategoryLineId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const showCurrencyCodes = snapshot.settings.multiCurrencyEnabled;
  const categories = snapshot.categories ?? defaultCategories;
  const fromAccount = isOutsideAccountId(fromAccountId)
    ? undefined
    : snapshot.accounts.find((account) => account.id === fromAccountId) ?? snapshot.accounts[0];
  const toAccount = isOutsideAccountId(toAccountId)
    ? undefined
    : snapshot.accounts.find((account) => account.id === toAccountId);
  const selectedCategory = categoryId ? getCategory(categoryId, categories) : categories[0];
  const selectedSplitLine = splitCategoryLineId
    ? splitLines.find((line) => line.id === splitCategoryLineId)
    : undefined;
  const pickerCategoryId = selectedSplitLine?.categoryId ?? categoryId;
  const pickerSubcategoryId = selectedSplitLine?.subcategoryId ?? subcategoryId;
  const displayAmount = getDisplayAmount(amountExpression);
  const previewAmountMinor = parsePreviewAmount(displayAmount, kind, fromAccountId);
  const splitTotalMinor = Math.abs(previewAmountMinor);
  const splitSummary = useMemo(
    () => getSplitTransactionFormSummary(splitTotalMinor, splitLines),
    [splitLines, splitTotalMinor],
  );
  const amountCurrencyCode =
    kind === 'transfer'
      ? getTransferAmountCurrencyCode({ accounts: snapshot.accounts, sourceAccountId: fromAccountId, targetAccountId: toAccountId })
      : fromAccount?.currencyCode ?? '';
  const nativePickerValue = getNativePickerValue(date, time);
  const itemHistory = useMemo(
    () => snapshot.transactions.map((transaction) => transaction.title),
    [snapshot.transactions],
  );
  const groupHistory = useMemo(
    () => snapshot.transactions.map((transaction) => transaction.groupId).filter(Boolean),
    [snapshot.transactions],
  );
  const labelHistory = useMemo(
    () => snapshot.transactions.flatMap((transaction) => transaction.labels),
    [snapshot.transactions],
  );
  const itemSuggestions = useAutocompleteOptions(itemHistory, item);
  const groupSuggestions = useAutocompleteOptions(groupHistory, groupId);
  const labelSuggestions = useMemo(
    () => getLabelAutocompleteOptions(labelHistory, labels),
    [labelHistory, labels],
  );
  const canSave = canSubmit();

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const action = getAddTransactionBackAction({
        nativePickerOpen: nativePickerMode !== null,
        page,
        pickerOpen: pickerMode !== null,
      });

      if (action === 'dismiss_native_picker') {
        setNativePickerMode(null);
        return true;
      }

      if (action === 'close_picker') {
        setPickerMode(null);
        setSplitCategoryLineId(null);
        return true;
      }

      if (action === 'show_amount') {
        setPage('amount');
        return true;
      }

      onDone();
      return true;
    });

    return () => subscription.remove();
  }, [nativePickerMode, onDone, page, pickerMode]);

  function changeKind(nextKind: TransactionKind) {
    const defaultCategory = getDefaultCategoryForKind(nextKind, categories);
    setKind(nextKind);
    if (nextKind === 'transfer' || nextKind !== kind) {
      setSplitLines([]);
      setSplitCategoryLineId(null);
      if (page === 'split') {
        setPage('amount');
      }
    }
    if (nextKind !== 'transfer' && isOutsideAccountId(fromAccountId)) {
      setFromAccountId(snapshot.accounts[0]?.id ?? '');
    }
    setCategoryId(nextKind === 'transfer' ? '' : defaultCategory.id);
    setSubcategoryId(nextKind === 'transfer' ? '' : getDefaultSubcategoryId(defaultCategory));
    setError('');
  }

  function pressCalculatorKey(key: CalculatorKey) {
    setError('');

    if (key === 'backspace') {
      setReplaceAmountOnNextKey(false);
      setAmountExpression((current) => current.slice(0, -1));
      return;
    }

    if (key === '=') {
      try {
        setAmountExpression(evaluateMoneyExpression(amountExpression));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not calculate amount.');
      }
      return;
    }

    if (replaceAmountOnNextKey) {
      setAmountExpression(key);
      setReplaceAmountOnNextKey(false);
      return;
    }

    setAmountExpression((current) => `${current}${key}`);
  }

  function handleNativePickerChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (event.type === 'dismissed') {
      setNativePickerMode(null);
      return;
    }

    if (!selectedDate || !nativePickerMode) {
      return;
    }

    if (nativePickerMode === 'date') {
      setDate(toDateInputValue(selectedDate));
    } else {
      setTime(toTimeInputValue(selectedDate));
    }

    if (Platform.OS === 'android') {
      setNativePickerMode(null);
    }
  }

  async function submit() {
    if (!canSubmit()) {
      setError('Complete the transaction before saving.');
      return;
    }

    if (kind !== 'transfer' && !fromAccount) {
      setError('Add an account before creating transactions.');
      return;
    }

    try {
      const datetime = parseDateTimeInput(date, time);
      const cleanLabels = parseLabelsInput(labels);

      await onAddTransaction({
        kind,
        title: item,
        datetime,
        notes: '',
        labels: cleanLabels,
        groupId,
        lines: buildLines(),
      });

      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add transaction.');
    }
  }

  function canSubmit(): boolean {
    try {
      parseDateTimeInput(date, time);
      return buildLines().length > 0;
    } catch {
      return false;
    }
  }

  function buildLines(): NewTransactionInput['lines'] {
    if (kind === 'transfer') {
      const sourceAmount = Math.abs(parseMoneyInput(resolveAmount(amountExpression)));
      if (sourceAmount <= 0) {
        throw new Error('Transfer amount must be greater than zero.');
      }

      return buildTransferTransactionLines({
        amountMinor: sourceAmount,
        accounts: snapshot.accounts,
        externalParty: OUTSIDE_MY_ACCOUNTS_LABEL,
        sourceAccountId: fromAccountId,
        targetAccountId: toAccountId,
      });
    }

    if (!fromAccount) {
      throw new Error('Choose an account.');
    }

    const minor = Math.abs(parseMoneyInput(resolveAmount(amountExpression)));
    if (minor <= 0) {
      throw new Error('Amount must be greater than zero.');
    }

    const normalLine = splitLines.length === 1 ? splitLines[0] : undefined;
    const effectiveCategoryId = normalLine?.categoryId ?? categoryId;
    const effectiveSubcategoryId = normalLine?.subcategoryId ?? subcategoryId;

    if (!effectiveCategoryId || !effectiveSubcategoryId) {
      throw new Error('Choose a category and subcategory.');
    }

    if (splitLines.length >= 2) {
      return buildSplitLinesFromForm({
        kind,
        accountId: fromAccount.id,
        currencyCode: fromAccount.currencyCode,
        totalMinor: minor,
        lines: splitLines,
      });
    }

    return [
      {
        accountId: fromAccount.id,
        amountMinor: minor * (kind === 'expense' ? -1 : 1),
        currencyCode: fromAccount.currencyCode,
        categoryId: effectiveCategoryId,
        subcategoryId: effectiveSubcategoryId,
        note: normalLine?.note,
      },
    ];
  }

  function openSplitEditor() {
    if (kind === 'transfer') {
      return;
    }

    setSplitLines((current) => {
      if (current.length > 0) {
        return current;
      }

      const totalMinor = Math.abs(parsePreviewAmount(displayAmount, kind, fromAccountId));
      return [
        createSplitTransactionFormLine({
          id: createSplitLineId(),
          amount: totalMinor > 0 ? formatMinorInput(totalMinor) : '',
          categoryId,
          subcategoryId,
        }),
        createSplitTransactionFormLine({
          id: createSplitLineId(),
          categoryId,
          subcategoryId,
        }),
      ];
    });
    setError('');
    setPage('split');
  }

  function addSplitLine() {
    setSplitLines((current) => {
      const remainingMinor = getSplitTransactionFormSummary(splitTotalMinor, current).remainingMinor;
      return [
        ...current,
        createSplitTransactionFormLine({
          id: createSplitLineId(),
          amount: remainingMinor > 0 ? formatMinorInput(remainingMinor) : '',
          categoryId,
          subcategoryId,
        }),
      ];
    });
  }

  function updateSplitLine(lineId: string, patch: Partial<SplitTransactionFormLine>) {
    setSplitLines((current) => current.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  }

  function removeSplitLine(lineId: string) {
    const nextLines = splitLines.filter((line) => line.id !== lineId);
    if (nextLines.length === 1) {
      setCategoryId(nextLines[0].categoryId);
      setSubcategoryId(nextLines[0].subcategoryId);
    }
    setSplitLines(nextLines);
  }

  if (pickerMode) {
    return (
      <TransactionPickerScreen
        mode={pickerMode}
        accounts={snapshot.accounts}
        selectedAccountId={pickerMode === 'targetAccount' ? toAccountId : fromAccountId}
        selectedCategoryId={pickerCategoryId}
        selectedSubcategoryId={pickerSubcategoryId}
        kind={kind}
        categories={categories}
        transactions={snapshot.transactions}
        transactionLines={snapshot.transactionLines}
        showCurrencyCodes={showCurrencyCodes}
        sourceAccountId={fromAccountId}
        onClose={() => {
          setPickerMode(null);
          setSplitCategoryLineId(null);
        }}
        onSelectAccount={(accountId) => {
          if (pickerMode === 'targetAccount') {
            setToAccountId(accountId);
          } else {
            setFromAccountId(accountId);
          }
          setPickerMode(null);
          setSplitCategoryLineId(null);
        }}
        onSelectCategory={(nextCategoryId, nextSubcategoryId) => {
          if (splitCategoryLineId) {
            updateSplitLine(splitCategoryLineId, {
              categoryId: nextCategoryId,
              subcategoryId: nextSubcategoryId,
            });
          } else {
            setCategoryId(nextCategoryId);
            setSubcategoryId(nextSubcategoryId);
          }
          setPickerMode(null);
          setSplitCategoryLineId(null);
        }}
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

          <View style={styles.quickRows}>
            <SelectorRow
              label={kind === 'transfer' ? 'From' : 'Account'}
              value={
                fromAccount
                  ? accountLabel(fromAccount, showCurrencyCodes)
                  : kind === 'transfer'
                    ? OUTSIDE_MY_ACCOUNTS_LABEL
                    : 'No account'
              }
              onPress={() => setPickerMode('sourceAccount')}
              color={fromAccount?.themeColor ?? colors.primary}
              icon={fromAccount?.iconName ?? (kind === 'transfer' ? 'globe-outline' : undefined)}
              iconColor={fromAccount?.themeColor ?? colors.primary}
              iconKind="account"
              empty={!fromAccount && kind !== 'transfer'}
            />
            {kind === 'transfer' ? (
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
                value={`${selectedCategory.name} / ${getSubcategoryName(selectedCategory.id, subcategoryId, categories)}`}
                onPress={() => setPickerMode('category')}
                color={getSubcategoryColor(selectedCategory.id, subcategoryId, categories)}
                icon={getSubcategoryIcon(selectedCategory.id, subcategoryId, categories)}
                iconColor={getSubcategoryColor(selectedCategory.id, subcategoryId, categories)}
                empty={!subcategoryId}
              />
            )}
          </View>

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
                  ? `Split · ${splitLines.length} lines · ${splitSummary.isBalanced ? 'Ready' : 'Needs total'}`
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
          <Text style={styles.detailsTitle}>Split {kind}</Text>
          <SplitTransactionEditor
            categories={categories}
            currencyCode={fromAccount?.currencyCode ?? amountCurrencyCode}
            lines={splitLines}
            showCurrencyCodes={showCurrencyCodes}
            totalMinor={splitTotalMinor}
            onAddLine={addSplitLine}
            onPickCategory={(lineId) => {
              setSplitCategoryLineId(lineId);
              setPickerMode('category');
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

            <AutocompleteField
              label="Item"
              value={item}
              onChange={setItem}
              placeholder="Groceries, Salary, Transfer"
              suggestions={itemSuggestions}
            />

            <DateTimePickerFields
              dateValue={formatLongDateLabel(date)}
              timeValue={time}
              onPressDate={() => setNativePickerMode('date')}
              onPressTime={() => setNativePickerMode('time')}
            />
            {nativePickerMode ? (
              Platform.OS === 'android' ? (
                <DateTimePicker
                  value={nativePickerValue}
                  mode={nativePickerMode}
                  display={getNativePickerDisplay(nativePickerMode)}
                  is24Hour
                  onChange={handleNativePickerChange}
                />
              ) : (
                <View style={styles.nativePickerPanel}>
                  <DateTimePicker
                    value={nativePickerValue}
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

            <AutocompleteField
              label="Group"
              value={groupId}
              onChange={setGroupId}
              placeholder="Trip, project, shared"
              suggestions={groupSuggestions}
            />
            <AutocompleteField
              label="Labels"
              value={labels}
              onChange={setLabels}
              onSelectSuggestion={(suggestion) => setLabels((current) => applyLabelSuggestion(current, suggestion))}
              placeholder="holiday, shared, tax"
              suggestions={labelSuggestions}
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

function resolveAmount(value: string): string {
  return /[+\-*/]/.test(value) ? evaluateMoneyExpression(value) : value;
}

function getDisplayAmount(value: string): string {
  try {
    return value ? resolveAmount(value) : '0.00';
  } catch {
    return '0.00';
  }
}

function parsePreviewAmount(value: string, kind: TransactionKind, sourceAccountId: string): number {
  try {
    const minor = Math.abs(parseMoneyInput(value || '0'));
    if (kind === 'transfer') {
      return isOutsideAccountId(sourceAccountId) ? minor : -minor;
    }

    return kind === 'expense' ? -minor : minor;
  } catch {
    return 0;
  }
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
  quickRows: {
    flexDirection: 'row',
    gap: spacing.sm,
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
  nativePickerPanel: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 0,
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
