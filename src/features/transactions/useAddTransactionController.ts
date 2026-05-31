import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Platform } from 'react-native';

import {
  buildAddTransactionInput,
  canBuildAddTransactionInput,
  createAddTransactionInitialDraft,
  getAddTransactionPreviewAmountMinor,
  type AddTransactionDraft,
} from '../../domain/addTransactionDraft';
import {
  getAddTransactionDefaultsAfterSave,
  resolveAddTransactionDefaultAccountId,
  resolveAddTransactionDefaultCategory,
} from '../../domain/addTransactionDefaults';
import { getAddTransactionBackAction } from '../../domain/addTransactionFlow';
import { evaluateMoneyExpression } from '../../domain/calculator';
import { defaultCategories, getCategory } from '../../domain/categories';
import { toDateInputValue, toTimeInputValue } from '../../domain/dates';
import { applyLabelSuggestion, getLabelAutocompleteOptions } from '../../domain/labels';
import {
  createSplitTransactionFormLine,
  formatMinorInput,
  getSplitTransactionFormSummary,
  type SplitTransactionFormLine,
} from '../../domain/splitTransactionForm';
import {
  getTransferAmountCurrencyCode,
  isOutsideAccountId,
} from '../../domain/transactionEdit';
import { getTransactionItemNameSuggestionValues } from '../../domain/transactionItemSuggestions';
import type { AddTransactionTemplatePrefill } from '../../domain/transactionTemplates';
import type {
  AddTransactionDefaults,
  AppSnapshot,
  NewTransactionInput,
  TransactionKind,
} from '../../domain/types';
import type {
  CategorySelectLaunchParams,
  CategorySelectionResult,
} from '../categorySelection/categorySelectionModel';
import {
  getNativePickerValue,
  useAutocompleteOptions,
  type NativePickerMode,
  type TransactionPickerMode,
} from './TransactionFormComponents';
import type { CalculatorKey } from './TransactionCalculator';

export type AddTransactionPage = 'amount' | 'details' | 'split';

type UseAddTransactionControllerOptions = {
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

let splitLineCounter = 0;

function createSplitLineId(): string {
  splitLineCounter += 1;
  return `split-line-${splitLineCounter}`;
}

export function useAddTransactionController({
  dashboardAccountIds,
  initialTemplate,
  onAddTransaction,
  onDone,
  onOpenCategorySelect,
  onUpdateAddTransactionDefaults,
  snapshot,
}: UseAddTransactionControllerOptions) {
  const categories = snapshot.categories ?? defaultCategories;
  const addTransactionDefaults = snapshot.settings.addTransactionDefaults;
  const [initialDraft] = useState(() =>
    createAddTransactionInitialDraft({
      dashboardAccountIds,
      initialTemplate,
      snapshot,
    }),
  );
  const [page, setPage] = useState<AddTransactionPage>('amount');
  const [pickerMode, setPickerMode] = useState<TransactionPickerMode | null>(null);
  const [nativePickerMode, setNativePickerMode] = useState<NativePickerMode | null>(null);
  const [kind, setKind] = useState<TransactionKind>(initialDraft.kind);
  const [item, setItem] = useState(initialDraft.item);
  const [amountExpression, setAmountExpression] = useState(initialDraft.amountExpression);
  const [replaceAmountOnNextKey, setReplaceAmountOnNextKey] = useState(false);
  const [date, setDate] = useState(initialDraft.date);
  const [time, setTime] = useState(initialDraft.time);
  const [fromAccountId, setFromAccountId] = useState(initialDraft.fromAccountId);
  const [toAccountId, setToAccountId] = useState(initialDraft.toAccountId);
  const [categoryId, setCategoryId] = useState(initialDraft.categoryId);
  const [subcategoryId, setSubcategoryId] = useState(initialDraft.subcategoryId);
  const [notes, setNotes] = useState(initialDraft.notes);
  const [labels, setLabels] = useState(initialDraft.labels);
  const [groupId, setGroupId] = useState(initialDraft.groupId);
  const [splitLines, setSplitLines] = useState<SplitTransactionFormLine[]>([]);
  const [error, setError] = useState('');
  const transactionDraft: AddTransactionDraft = {
    amountExpression,
    categoryId,
    date,
    fromAccountId,
    groupId,
    item,
    kind,
    labels,
    notes,
    splitLines,
    subcategoryId,
    time,
    toAccountId,
  };
  const showCurrencyCodes = snapshot.settings.multiCurrencyEnabled;
  const fromAccount = isOutsideAccountId(fromAccountId)
    ? undefined
    : snapshot.accounts.find((account) => account.id === fromAccountId) ?? snapshot.accounts[0];
  const toAccount = isOutsideAccountId(toAccountId)
    ? undefined
    : snapshot.accounts.find((account) => account.id === toAccountId);
  const selectedCategory = categoryId ? getCategory(categoryId, categories) : categories[0];
  const previewAmountMinor = getAddTransactionPreviewAmountMinor({
    amountExpression,
    kind,
    sourceAccountId: fromAccountId,
  });
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
    () => getTransactionItemNameSuggestionValues({
      transactions: snapshot.transactions,
      transactionLines: snapshot.transactionLines,
      transactionTemplates: snapshot.transactionTemplates,
      recurringItems: snapshot.recurringItems,
    }),
    [snapshot.recurringItems, snapshot.transactionLines, snapshot.transactionTemplates, snapshot.transactions],
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
  const canSave = canBuildAddTransactionInput({
    accounts: snapshot.accounts,
    draft: transactionDraft,
  });

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
    const defaultCategorySelection = resolveAddTransactionDefaultCategory({
      categories,
      defaults: addTransactionDefaults,
      kind: nextKind,
    });
    setKind(nextKind);
    if (nextKind === 'transfer' || nextKind !== kind) {
      setSplitLines([]);
      if (page === 'split') {
        setPage('amount');
      }
    }
    if (nextKind !== 'transfer' && isOutsideAccountId(fromAccountId)) {
      setFromAccountId(resolveAddTransactionDefaultAccountId({
        accounts: snapshot.accounts,
        dashboardAccountIds,
        rememberedAccountId: addTransactionDefaults?.lastManualAccountId,
      }));
    }
    setCategoryId(defaultCategorySelection.categoryId);
    setSubcategoryId(defaultCategorySelection.subcategoryId ?? '');
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
    if (!canBuildAddTransactionInput({ accounts: snapshot.accounts, draft: transactionDraft })) {
      setError('Complete the transaction before saving.');
      return;
    }

    if (kind !== 'transfer' && !fromAccount) {
      setError('Add an account before creating transactions.');
      return;
    }

    try {
      const input = buildAddTransactionInput({
        accounts: snapshot.accounts,
        draft: transactionDraft,
      });

      await onAddTransaction(input);

      if (onUpdateAddTransactionDefaults) {
        await onUpdateAddTransactionDefaults(
          getAddTransactionDefaultsAfterSave({
            accounts: snapshot.accounts,
            categories,
            currentDefaults: addTransactionDefaults,
            input,
          }),
        );
      }

      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add transaction.');
    }
  }

  function openSplitEditor() {
    if (kind === 'transfer') {
      return;
    }

    setSplitLines((current) => {
      if (current.length > 0) {
        return current;
      }

      const totalMinor = Math.abs(previewAmountMinor);
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

  function openMainCategorySelect() {
    if (kind === 'transfer') {
      return;
    }

    onOpenCategorySelect(
      {
        kind,
        selectedCategoryId: categoryId,
        selectedSubcategoryId: subcategoryId,
        selectionMode: 'subcategory',
        showSuggestions: true,
        title: 'Category',
      },
      ({ categoryId: nextCategoryId, subcategoryId: nextSubcategoryId }) => {
        setCategoryId(nextCategoryId);
        setSubcategoryId(nextSubcategoryId ?? '');
      },
    );
  }

  function openSplitLineCategorySelect(lineId: string) {
    if (kind === 'transfer') {
      return;
    }

    const line = splitLines.find((candidate) => candidate.id === lineId);
    onOpenCategorySelect(
      {
        kind,
        selectedCategoryId: line?.categoryId ?? categoryId,
        selectedSubcategoryId: line?.subcategoryId ?? subcategoryId,
        selectionMode: 'subcategory',
        showSuggestions: true,
        title: 'Split line category',
      },
      ({ categoryId: nextCategoryId, subcategoryId: nextSubcategoryId }) => {
        updateSplitLine(lineId, {
          categoryId: nextCategoryId,
          subcategoryId: nextSubcategoryId ?? '',
        });
      },
    );
  }

  function closePicker() {
    setPickerMode(null);
  }

  function selectPickerAccount(accountId: string) {
    if (pickerMode === 'targetAccount') {
      setToAccountId(accountId);
    } else {
      setFromAccountId(accountId);
    }
    setPickerMode(null);
  }

  function applyLabelAutocompleteSuggestion(suggestion: string) {
    setLabels((current) => applyLabelSuggestion(current, suggestion));
  }

  return {
    addSplitLine,
    amountCurrencyCode,
    amountExpression,
    applyLabelAutocompleteSuggestion,
    canSave,
    categories,
    categoryId,
    changeKind,
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
    setAmountExpression,
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
    splitSummary,
    splitTotalMinor,
    subcategoryId,
    submit,
    time,
    toAccount,
    toAccountId,
    updateSplitLine,
  };
}
