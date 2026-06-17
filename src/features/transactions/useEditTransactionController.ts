import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Platform } from 'react-native';

import {
  defaultCategories,
  getCategory,
  getDefaultCategoryForKind,
  getDefaultSubcategoryId,
} from '../../domain/categories';
import {
  formatCrossCurrencyTransferRateLabel,
  isCrossCurrencyTransferAccountPair,
} from '../../domain/crossCurrencyTransfers';
import { toDateInputValue, toTimeInputValue } from '../../domain/dates';
import { applyLabelSuggestion, getLabelAutocompleteOptions } from '../../domain/labels';
import { parseMoneyInput } from '../../domain/money';
import {
  createSplitTransactionFormLine,
  formatMinorInput,
  getMixedSplitTransactionFormSummary,
  getSplitLineCategoryKind,
  getSplitTransactionFormSummary,
} from '../../domain/splitTransactionForm';
import type {
  SplitTransactionLineKind,
  SplitTransactionMode,
} from '../../domain/splitTransactions';
import {
  buildTransactionUpdateInput,
  canBuildTransactionUpdateInput,
  createTransactionEditDraft,
  getEditableTransactionEditSplitLines,
  getTransactionEditDraftTotalMinor,
  getTransactionEditLinkSavePlan,
  getTransferAmountCurrencyCode,
  isOutsideAccountId,
  type TransactionEditDraft,
  type TransactionEditSplitLineDraft,
} from '../../domain/transactionEdit';
import { getTransactionItemNameSuggestionValues } from '../../domain/transactionItemSuggestions';
import type {
  AppSnapshot,
  TransactionKind,
  UpdateTransactionInput,
  UpdateTransactionLinkInput,
} from '../../domain/types';
import type {
  CategorySelectLaunchParams,
  CategorySelectionResult,
} from '../categorySelection/categorySelectionModel';
import {
  useAutocompleteOptions,
  type NativePickerMode,
  type TransactionPickerMode,
} from './TransactionFormComponents';

export type EditTransactionPage = 'form' | 'split';

type UseEditTransactionControllerOptions = {
  snapshot: AppSnapshot;
  transactionId: string;
  onUpdateTransaction: (input: UpdateTransactionInput) => Promise<void>;
  onDeleteTransaction: (transactionId: string) => Promise<void>;
  onUpdateTransactionLink: (input: UpdateTransactionLinkInput) => Promise<void>;
  onDeleteTransactionLink: (linkId: string) => Promise<void>;
  onOpenCategorySelect: (
    params: CategorySelectLaunchParams,
    onSelect: (selection: CategorySelectionResult) => void,
  ) => void;
  onCancel: () => void;
  onDone: () => void;
};

export function useEditTransactionController({
  onCancel,
  onDeleteTransaction,
  onDeleteTransactionLink,
  onDone,
  onOpenCategorySelect,
  onUpdateTransaction,
  onUpdateTransactionLink,
  snapshot,
  transactionId,
}: UseEditTransactionControllerOptions) {
  const [draft, setDraft] = useState<TransactionEditDraft | null>(null);
  const [page, setPage] = useState<EditTransactionPage>('form');
  const [error, setError] = useState('');
  const [pickerMode, setPickerMode] = useState<TransactionPickerMode | null>(null);
  const [nativePickerMode, setNativePickerMode] = useState<NativePickerMode | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const showCurrencyCodes = snapshot.settings.multiCurrencyEnabled;
  const categories = snapshot.categories ?? defaultCategories;
  const transactionExists = snapshot.transactions.some((transaction) => transaction.id === transactionId);
  const itemHistory = useMemo(
    () => getTransactionItemNameSuggestionValues({
      transactions: snapshot.transactions,
      transactionLines: snapshot.transactionLines,
      transactionTemplates: snapshot.transactionTemplates,
      recurringItems: snapshot.recurringItems,
      excludeTransactionId: transactionId,
    }),
    [
      snapshot.recurringItems,
      snapshot.transactionLines,
      snapshot.transactionTemplates,
      snapshot.transactions,
      transactionId,
    ],
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
  const isCrossCurrencyTransfer = draft
    ? draft.kind === 'transfer' && isCrossCurrencyTransferAccountPair({
        accounts: snapshot.accounts,
        sourceAccountId: draft.accountId,
        targetAccountId: draft.targetAccountId,
      })
    : false;
  const targetAmountCurrencyCode = isCrossCurrencyTransfer ? toAccount?.currencyCode ?? '' : '';
  const crossCurrencyTransferRateLabel = isCrossCurrencyTransfer
    ? getSafeCrossCurrencyTransferRateLabel({
        sourceAmount: draft?.amount ?? '',
        sourceCurrencyCode: amountCurrencyCode,
        targetAmount: draft?.targetAmount ?? '',
        targetCurrencyCode: targetAmountCurrencyCode,
      })
    : '';
  const selectedCategory = draft?.categoryId ? getCategory(draft.categoryId, categories) : getDefaultCategoryForKind(draft?.kind ?? 'expense', categories);
  const canSave = draft ? canBuildTransactionUpdateInput(draft, snapshot.accounts) : false;

  useEffect(() => {
    setConfirmDelete(false);
    setPage('form');
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

      if (page === 'split') {
        setPage('form');
        return true;
      }

      onCancel();
      return true;
    });

    return () => subscription.remove();
  }, [nativePickerMode, onCancel, page, pickerMode]);

  function updateDraft(patch: Partial<TransactionEditDraft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function openSplitEditor() {
    if (!draft || draft.kind === 'transfer') {
      return;
    }

    setDraft((current) =>
      current
        ? {
            ...current,
            splitLines: getEditableTransactionEditSplitLines(current),
          }
        : current,
    );
    setError('');
    setPage('split');
  }

  function addSplitLine() {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const splitLines = getEditableTransactionEditSplitLines(current);
      const totalMinor = getTransactionEditDraftTotalMinor(current);
      if (current.splitMode === 'mixed' && current.kind !== 'transfer') {
        const summary = getMixedSplitTransactionFormSummary({
          kind: current.kind,
          totalMinor,
          lines: splitLines,
        });
        const lineKind: SplitTransactionLineKind =
          summary.differenceMinor > 0
            ? 'income'
            : summary.differenceMinor < 0
              ? 'expense'
              : current.kind;
        const defaultCategory = getDefaultCategoryForKind(lineKind, categories);

        return {
          ...current,
          splitLines: [
            ...splitLines,
            createSplitTransactionFormLine({
              id: `${current.id}-split-${splitLines.length + 1}-${Date.now()}`,
              kind: lineKind,
              amount: summary.differenceMinor !== 0 ? formatMinorInput(Math.abs(summary.differenceMinor)) : '',
              categoryId: defaultCategory.id,
              subcategoryId: getDefaultSubcategoryId(defaultCategory),
            }),
          ],
        };
      }

      const remainingMinor = getSplitTransactionFormSummary(totalMinor, splitLines).remainingMinor;

      return {
        ...current,
        splitLines: [
          ...splitLines,
          createSplitTransactionFormLine({
            id: `${current.id}-split-${splitLines.length + 1}-${Date.now()}`,
            amount: remainingMinor > 0 ? formatMinorInput(remainingMinor) : '',
            categoryId: current.categoryId,
            subcategoryId: current.subcategoryId,
          }),
        ],
      };
    });
  }

  function updateSplitLine(lineId: string, patch: Partial<TransactionEditSplitLineDraft>) {
    setDraft((current) =>
      current
        ? {
            ...current,
            splitLines: getEditableTransactionEditSplitLines(current).map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
          }
        : current,
    );
  }

  function changeSplitMode(splitMode: SplitTransactionMode) {
    setDraft((current) => {
      if (!current || current.kind === 'transfer') {
        return current;
      }

      const parentKind = current.kind;
      return {
        ...current,
        splitMode,
        splitLines:
          splitMode === 'mixed'
            ? getEditableTransactionEditSplitLines(current).map((line) => ({
                ...line,
                kind: line.kind ?? parentKind,
              }))
            : getEditableTransactionEditSplitLines(current),
      };
    });
    setError('');
  }

  function changeSplitLineKind(lineId: string, lineKind: SplitTransactionLineKind) {
    const defaultCategory = getDefaultCategoryForKind(lineKind, categories);
    updateSplitLine(lineId, {
      kind: lineKind,
      categoryId: defaultCategory.id,
      subcategoryId: getDefaultSubcategoryId(defaultCategory),
    });
  }

  function removeSplitLine(lineId: string) {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      let splitLines = getEditableTransactionEditSplitLines(current).filter((line) => line.id !== lineId);
      let remainingLine = splitLines.length === 1 ? splitLines[0] : undefined;
      if (
        remainingLine &&
        current.kind !== 'transfer' &&
        current.splitMode === 'mixed' &&
        remainingLine.kind &&
        remainingLine.kind !== current.kind
      ) {
        const defaultCategory = getDefaultCategoryForKind(current.kind, categories);
        remainingLine = {
          ...remainingLine,
          kind: current.kind,
          categoryId: defaultCategory.id,
          subcategoryId: getDefaultSubcategoryId(defaultCategory),
        };
        splitLines = [remainingLine];
      }

      return {
        ...current,
        categoryId: remainingLine?.categoryId ?? current.categoryId,
        subcategoryId: remainingLine?.subcategoryId ?? current.subcategoryId,
        splitLines: splitLines.length ? splitLines : undefined,
        splitMode: splitLines.length >= 2 ? current.splitMode : 'standard',
      };
    });
  }

  function changeKind(kind: TransactionKind) {
    const defaultCategory = getDefaultCategoryForKind(kind, categories);
    if (kind === 'transfer' || kind !== draft?.kind) {
      setPage('form');
    }
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
            splitLines: kind !== 'transfer' && kind === current.kind ? current.splitLines : undefined,
            splitMode: kind !== 'transfer' && kind === current.kind ? current.splitMode : 'standard',
            targetAmount: kind === 'transfer' ? current.targetAmount : '',
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

    if (!canBuildTransactionUpdateInput(draft, snapshot.accounts)) {
      setError('Complete the transaction before saving.');
      return;
    }

    try {
      const input = buildTransactionUpdateInput(draft, snapshot.accounts);
      const linkSavePlan = getTransactionEditLinkSavePlan({
        input,
        transactionId,
        transactionLinks: snapshot.transactionLinks,
      });

      await onUpdateTransaction(input);

      if (linkSavePlan.sourceLinkUpdate) {
        await onUpdateTransactionLink(linkSavePlan.sourceLinkUpdate);
      } else if (linkSavePlan.sourceLinkDeleteId) {
        await onDeleteTransactionLink(linkSavePlan.sourceLinkDeleteId);
      }

      for (const targetLinkId of linkSavePlan.targetLinkDeleteIds) {
        await onDeleteTransactionLink(targetLinkId);
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

  function openMainCategorySelect() {
    if (!draft || draft.kind === 'transfer') {
      return;
    }

    onOpenCategorySelect(
      {
        kind: draft.kind,
        selectedCategoryId: draft.categoryId,
        selectedSubcategoryId: draft.subcategoryId,
        selectionMode: 'subcategory',
        showSuggestions: true,
        title: 'Category',
      },
      ({ categoryId, subcategoryId }) => {
        updateDraft({ categoryId, subcategoryId: subcategoryId ?? '' });
      },
    );
  }

  function openSplitLineCategorySelect(lineId: string) {
    if (!draft || draft.kind === 'transfer') {
      return;
    }

    const line = getEditableTransactionEditSplitLines(draft).find((candidate) => candidate.id === lineId);
    const categoryKind = getSplitLineCategoryKind({
      line,
      parentKind: draft.kind,
      splitMode: draft.splitMode ?? 'standard',
    });
    onOpenCategorySelect(
      {
        kind: categoryKind,
        selectedCategoryId: line?.categoryId ?? draft.categoryId,
        selectedSubcategoryId: line?.subcategoryId ?? draft.subcategoryId,
        selectionMode: 'subcategory',
        showSuggestions: true,
        title: 'Split line category',
      },
      ({ categoryId, subcategoryId }) => {
        updateSplitLine(lineId, { categoryId, subcategoryId: subcategoryId ?? '' });
      },
    );
  }

  function closePicker() {
    setPickerMode(null);
  }

  function selectPickerAccount(accountId: string) {
    updateDraft(pickerMode === 'targetAccount' ? { targetAccountId: accountId } : { accountId });
    setPickerMode(null);
  }

  function applyLabelAutocompleteSuggestion(suggestion: string) {
    updateDraft({ labels: applyLabelSuggestion(draft?.labels ?? '', suggestion) });
  }

  return {
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
    getEditableSplitLines: getEditableTransactionEditSplitLines,
    getSplitTotalMinor: getTransactionEditDraftTotalMinor,
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
    crossCurrencyTransferRateLabel,
    toAccount,
    transactionExists,
    updateDraft,
    updateSplitLine,
  };
}

function getSafeCrossCurrencyTransferRateLabel({
  sourceAmount,
  sourceCurrencyCode,
  targetAmount,
  targetCurrencyCode,
}: {
  sourceAmount: string;
  sourceCurrencyCode: string;
  targetAmount: string;
  targetCurrencyCode: string;
}): string {
  try {
    const sourceAmountMinor = Math.abs(parseMoneyInput(sourceAmount));
    const targetAmountMinor = Math.abs(parseMoneyInput(targetAmount));
    if (sourceAmountMinor <= 0 || targetAmountMinor <= 0 || !sourceCurrencyCode || !targetCurrencyCode) {
      return '';
    }

    return formatCrossCurrencyTransferRateLabel({
      sourceAmountMinor,
      sourceCurrencyCode,
      targetAmountMinor,
      targetCurrencyCode,
    });
  } catch {
    return '';
  }
}
