import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { BackHandler } from 'react-native';

import { ActionButton, Chip, FormError, TextField } from '../../components/ui';
import {
  FormChipRow,
  FormDangerZone,
  FormHelperText,
  FormInlineAction,
  FormScreenShell,
  FormSection,
  KeyboardAwareFormScroll,
} from '../../components/FormLayout';
import { formatOptionalMoneyInput } from '../../domain/accountForm';
import { getAccountBalances } from '../../domain/aggregates';
import {
  defaultCategories,
  getCategory,
  getDefaultCategoryForKind,
  getDefaultSubcategoryId,
} from '../../domain/categories';
import { parseMoneyInput } from '../../domain/money';
import {
  createSplitTransactionFormLine,
  formatMinorInput,
  getMixedSplitTransactionFormSummary,
  getSplitLineCategoryKind,
  getSplitTransactionFormSummary,
  type SplitTransactionFormLine,
} from '../../domain/splitTransactionForm';
import type {
  SplitTransactionLineKind,
  SplitTransactionMode,
} from '../../domain/splitTransactions';
import {
  getTemplateCurrencyCodeForAccount,
  getTransactionTemplateSplitMode,
  validateTransactionTemplateInput,
} from '../../domain/transactionTemplates';
import { getTransactionItemNameSuggestionValues } from '../../domain/transactionItemSuggestions';
import type {
  AppSnapshot,
  NewTransactionTemplateInput,
  TransactionTemplate,
  TransactionTemplateKind,
  UpdateTransactionTemplateInput,
} from '../../domain/types';
import type {
  CategorySelectLaunchParams,
  CategorySelectionResult,
} from '../categorySelection/categorySelectionModel';
import { CategorySelectionField } from '../categorySelection/CategorySelectionField';
import { AutocompleteField, useAutocompleteOptions } from '../transactions/TransactionFormComponents';
import { SplitTransactionEditor, SplitTransactionEditorScrollContainer } from '../transactions/SplitTransactionEditor';
import { TransactionPickerScreen } from '../transactions/TransactionPickerScreen';
import {
  getTemplateCategorySelectionColor,
  getTemplateCategorySelectionIcon,
  getTemplateCategorySelectionLabel,
  SplitTemplateSummaryRow,
  TemplateAccountRow,
  TemplatePreview,
} from './TransactionTemplateFormSections';

type TransactionTemplateFormScreenProps =
  | {
      mode: 'add';
      snapshot: AppSnapshot;
      onAddTemplate: (input: NewTransactionTemplateInput) => Promise<void>;
      onOpenCategorySelect: (
        params: CategorySelectLaunchParams,
        onSelect: (selection: CategorySelectionResult) => void,
      ) => void;
      onCancel: () => void;
      onDone: () => void;
    }
  | {
      mode: 'edit';
      snapshot: AppSnapshot;
      template: TransactionTemplate;
      onUpdateTemplate: (input: UpdateTransactionTemplateInput) => Promise<void>;
      onArchiveTemplate: (templateId: string) => Promise<void>;
      onDeleteTemplate: (templateId: string) => Promise<void>;
      onOpenCategorySelect: (
        params: CategorySelectLaunchParams,
        onSelect: (selection: CategorySelectionResult) => void,
      ) => void;
      onCancel: () => void;
      onDone: () => void;
    };

const kindOptions: { value: TransactionTemplateKind; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
];

type TemplateFormPage = 'form' | 'account' | 'split';

let templateSplitLineCounter = 0;

function createTemplateSplitLineId(): string {
  templateSplitLineCounter += 1;
  return `template-split-line-${templateSplitLineCounter}`;
}

export function TransactionTemplateFormScreen(props: TransactionTemplateFormScreenProps) {
  const { mode, snapshot, onCancel, onDone } = props;
  const editingTemplate = mode === 'edit' ? props.template : null;
  const accounts = snapshot.accounts.filter((account) => !account.isArchived);
  const firstAccount = accounts[0];
  const categories = useMemo(() => snapshot.categories ?? defaultCategories, [snapshot.categories]);
  const [kind, setKind] = useState<TransactionTemplateKind>(editingTemplate?.kind ?? 'expense');
  const [name, setName] = useState(editingTemplate?.name ?? '');
  const [title, setTitle] = useState(editingTemplate?.title ?? '');
  const [amount, setAmount] = useState(formatOptionalMoneyInput(editingTemplate?.amountMinor));
  const [accountId, setAccountId] = useState(editingTemplate?.accountId ?? firstAccount?.id ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(editingTemplate?.categoryId ?? null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(editingTemplate?.subcategoryId ?? null);
  const [notes, setNotes] = useState(editingTemplate?.notes ?? '');
  const [splitLines, setSplitLines] = useState<SplitTransactionFormLine[]>(() =>
    (editingTemplate?.splitLines ?? []).map((line) =>
      createSplitTransactionFormLine({
        id: line.id,
        kind: line.kind,
        amount: formatMinorInput(line.amountMinor),
        categoryId: line.categoryId,
        subcategoryId: line.subcategoryId,
        note: line.note,
      })),
  );
  const [splitMode, setSplitMode] = useState<SplitTransactionMode>(
    editingTemplate ? getTransactionTemplateSplitMode(editingTemplate) : 'standard',
  );
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState<TemplateFormPage>('form');
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const currencyCode = getTemplateCurrencyCodeForAccount(accounts, accountId);
  const selectedAccountBalance = useMemo(
    () => getAccountBalances(snapshot.accounts, snapshot.transactionLines).find(({ account }) => account.id === accountId),
    [accountId, snapshot.accounts, snapshot.transactionLines],
  );
  const itemNameSuggestionValues = useMemo(
    () => getTransactionItemNameSuggestionValues({
      transactions: snapshot.transactions,
      transactionLines: snapshot.transactionLines,
      transactionTemplates: snapshot.transactionTemplates,
      recurringItems: snapshot.recurringItems,
      excludeTemplateId: editingTemplate?.id,
    }),
    [
      editingTemplate?.id,
      snapshot.recurringItems,
      snapshot.transactionLines,
      snapshot.transactionTemplates,
      snapshot.transactions,
    ],
  );
  const nameSuggestions = useAutocompleteOptions(itemNameSuggestionValues, name);
  const titleSuggestions = useAutocompleteOptions(itemNameSuggestionValues, title);
  const splitTotalMinor = getTemplateAmountMinor(amount);
  const splitSummary =
    splitMode === 'mixed'
      ? getMixedSplitTransactionFormSummary({ kind, totalMinor: splitTotalMinor, lines: splitLines })
      : getSplitTransactionFormSummary(splitTotalMinor, splitLines);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (page === 'account' || page === 'split') {
          setPage('form');
          return true;
        }

        return false;
      });

      return () => subscription.remove();
    }, [page]),
  );

  function changeKind(nextKind: TransactionTemplateKind) {
    setKind(nextKind);
    setCategoryId(null);
    setSubcategoryId(null);
    setSplitLines([]);
    setSplitMode('standard');
    setConfirmArchive(false);
    setConfirmDelete(false);
    setError('');
  }

  async function submit() {
    try {
      if (!selectedAccount) {
        throw new Error(accountId ? 'Template account needs attention.' : 'Template account is required.');
      }

      const input = buildTemplateInput();
      validateTransactionTemplateInput(input, accounts);

      if (mode === 'add') {
        await props.onAddTemplate(input);
      } else {
        await props.onUpdateTemplate({ id: props.template.id, ...input });
      }

      setError('');
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save transaction template.');
    }
  }

  async function archiveTemplate() {
    if (mode !== 'edit') {
      return;
    }

    if (!confirmArchive) {
      setConfirmArchive(true);
      setConfirmDelete(false);
      return;
    }

    try {
      await props.onArchiveTemplate(props.template.id);
      setError('');
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not archive transaction template.');
    }
  }

  async function deleteTemplate() {
    if (mode !== 'edit') {
      return;
    }

    if (!confirmDelete) {
      setConfirmDelete(true);
      setConfirmArchive(false);
      return;
    }

    try {
      await props.onDeleteTemplate(props.template.id);
      setError('');
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete transaction template.');
    }
  }

  function buildTemplateInput(): NewTransactionTemplateInput {
    return {
      name,
      kind,
      splitMode,
      title,
      accountId,
      amountMinor: parseOptionalTemplateAmount(amount),
      currencyCode,
      categoryId,
      subcategoryId,
      notes,
      splitLines: splitLines.map((line) => ({
        ...(splitMode === 'mixed' ? { kind: line.kind ?? kind } : {}),
        amountMinor: Math.abs(parseMoneyInput(line.amount)),
        categoryId: line.categoryId,
        subcategoryId: line.subcategoryId,
        note: line.note,
      })),
      isActive: true,
    };
  }

  function selectAccount(nextAccountId: string) {
    setAccountId(nextAccountId);
    setPage('form');
    setConfirmArchive(false);
    setConfirmDelete(false);
    setError('');
  }

  function openCategorySelect() {
    const defaultCategory = getDefaultCategoryForKind(kind, categories);
    const selectedCategory = categoryId ? getCategory(categoryId, categories) : defaultCategory;

    props.onOpenCategorySelect(
      {
        kind,
        selectedCategoryId: selectedCategory.id,
        selectedSubcategoryId: subcategoryId ?? getDefaultSubcategoryId(selectedCategory),
        selectionMode: 'subcategory',
        showSuggestions: false,
        title: 'Template category',
      },
      ({ categoryId: nextCategoryId, subcategoryId: nextSubcategoryId }) => {
        const nextCategory = getCategory(nextCategoryId, categories);
        setCategoryId(nextCategory.id);
        setSubcategoryId(nextSubcategoryId ?? getDefaultSubcategoryId(nextCategory));
      },
    );
  }

  function clearCategory() {
    setCategoryId(null);
    setSubcategoryId(null);
  }

  function getSplitBaseCategorySelection(lineKind: SplitTransactionLineKind = kind) {
    const selectedCategory = categoryId ? getCategory(categoryId, categories) : undefined;
    const category =
      selectedCategory?.type === lineKind
        ? selectedCategory
        : getDefaultCategoryForKind(lineKind, categories);
    return {
      categoryId: category.id,
      subcategoryId:
        category.id === selectedCategory?.id
          ? subcategoryId ?? getDefaultSubcategoryId(category)
          : getDefaultSubcategoryId(category),
    };
  }

  function startSplitTemplate() {
    const selection = getSplitBaseCategorySelection();
    const totalMinor = getTemplateAmountMinor(amount);
    setCategoryId(selection.categoryId);
    setSubcategoryId(selection.subcategoryId);
    setSplitLines([
      createSplitTransactionFormLine({
        id: createTemplateSplitLineId(),
        amount: totalMinor > 0 ? formatMinorInput(totalMinor) : '',
        categoryId: selection.categoryId,
        subcategoryId: selection.subcategoryId,
      }),
      createSplitTransactionFormLine({
        id: createTemplateSplitLineId(),
        categoryId: selection.categoryId,
        subcategoryId: selection.subcategoryId,
      }),
    ]);
    setSplitMode('standard');
    setError('');
  }

  function openSplitTemplateEditor() {
    if (splitLines.length < 2) {
      startSplitTemplate();
    }

    setPage('split');
  }

  function stopSplitTemplate() {
    if (splitLines.length === 1) {
      setCategoryId(splitLines[0].categoryId);
      setSubcategoryId(splitLines[0].subcategoryId);
    }
    setSplitLines([]);
    setSplitMode('standard');
    setError('');
  }

  function addSplitLine() {
    let lineKind: SplitTransactionLineKind = kind;
    let remainingMinor: number;
    if (splitMode === 'mixed') {
      const summary = getMixedSplitTransactionFormSummary({
        kind,
        totalMinor: getTemplateAmountMinor(amount),
        lines: splitLines,
      });
      lineKind =
        summary.differenceMinor > 0
          ? 'income'
          : summary.differenceMinor < 0
            ? 'expense'
            : kind;
      remainingMinor = Math.abs(summary.differenceMinor);
    } else {
      remainingMinor = getSplitTransactionFormSummary(
        getTemplateAmountMinor(amount),
        splitLines,
      ).remainingMinor;
    }
    const selection = getSplitBaseCategorySelection(lineKind);
    setSplitLines((current) => [
      ...current,
      createSplitTransactionFormLine({
        id: createTemplateSplitLineId(),
        kind: splitMode === 'mixed' ? lineKind : undefined,
        amount: remainingMinor > 0 ? formatMinorInput(remainingMinor) : '',
        categoryId: selection.categoryId,
        subcategoryId: selection.subcategoryId,
      }),
    ]);
  }

  function changeSplitMode(nextMode: SplitTransactionMode) {
    setSplitMode(nextMode);
    if (nextMode === 'mixed') {
      setSplitLines((current) =>
        current.map((line) => ({
          ...line,
          kind: line.kind ?? kind,
        })),
      );
    }
    setError('');
  }

  function changeSplitLineKind(lineId: string, lineKind: SplitTransactionLineKind) {
    const selection = getSplitBaseCategorySelection(lineKind);
    updateSplitLine(lineId, {
      kind: lineKind,
      categoryId: selection.categoryId,
      subcategoryId: selection.subcategoryId,
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
      setSplitLines([]);
      setSplitMode('standard');
      setPage('form');
      return;
    }

    setSplitLines(nextLines);
  }

  function openSplitLineCategorySelect(lineId: string) {
    const line = splitLines.find((candidate) => candidate.id === lineId);
    const lineKind = getSplitLineCategoryKind({
      line,
      parentKind: kind,
      splitMode,
    });
    const selection = getSplitBaseCategorySelection(lineKind);
    props.onOpenCategorySelect(
      {
        kind: lineKind,
        selectedCategoryId: line?.categoryId ?? selection.categoryId,
        selectedSubcategoryId: line?.subcategoryId ?? selection.subcategoryId,
        selectionMode: 'subcategory',
        showSuggestions: false,
        title: 'Split line category',
      },
      ({ categoryId: nextCategoryId, subcategoryId: nextSubcategoryId }) => {
        const nextCategory = getCategory(nextCategoryId, categories);
        updateSplitLine(lineId, {
          categoryId: nextCategory.id,
          subcategoryId: nextSubcategoryId ?? getDefaultSubcategoryId(nextCategory),
        });
      },
    );
  }

  if (page === 'account') {
    return (
      <TransactionPickerScreen
        mode="sourceAccount"
        accounts={accounts}
        selectedAccountId={accountId}
        selectedCategoryId={categoryId ?? ''}
        selectedSubcategoryId={subcategoryId ?? ''}
        kind={kind}
        categories={categories}
        transactions={snapshot.transactions}
        transactionLines={snapshot.transactionLines}
        showCurrencyCodes
        sourceAccountId={accountId}
        onClose={() => setPage('form')}
        onExit={onCancel}
        onSelectAccount={selectAccount}
        onSelectCategory={() => undefined}
        cancelTestID="cancel-transaction-template-account-picker"
      />
    );
  }

  if (page === 'split') {
    return (
      <FormScreenShell
        title={splitMode === 'mixed' ? 'Mixed split template' : `Split ${kind} template`}
        onBack={() => setPage('form')}
        onSave={() => setPage('form')}
        saveLabel="Done"
        saveTestID="done-transaction-template-split"
      >
        <SplitTransactionEditorScrollContainer testID="transaction-template-split-page">
          <SplitTransactionEditor
            categories={categories}
            currencyCode={currencyCode}
            itemNameSuggestions={itemNameSuggestionValues}
            lines={splitLines}
            parentKind={kind}
            showCurrencyCodes={snapshot.settings.multiCurrencyEnabled}
            splitMode={splitMode}
            totalMinor={splitTotalMinor}
            onAddLine={addSplitLine}
            onChangeLineKind={changeSplitLineKind}
            onChangeSplitMode={changeSplitMode}
            onPickCategory={openSplitLineCategorySelect}
            onRemoveLine={removeSplitLine}
            onUpdateLine={updateSplitLine}
          />
          <FormInlineAction label="Use as normal template" onPress={stopSplitTemplate} />
        </SplitTransactionEditorScrollContainer>
      </FormScreenShell>
    );
  }

  return (
    <FormScreenShell
      title={mode === 'add' ? 'Add template' : 'Edit template'}
      onBack={onCancel}
      onSave={submit}
      saveTestID={mode === 'add' ? 'save-new-transaction-template' : 'save-transaction-template'}
    >
      <KeyboardAwareFormScroll>
        <FormSection label="Type">
          <FormChipRow>
            {kindOptions.map((option) => (
              <Chip
                key={option.value}
                selected={kind === option.value}
                onPress={() => changeKind(option.value)}
                testID={`template-kind-${option.value}`}
              >
                {option.label}
              </Chip>
            ))}
          </FormChipRow>
        </FormSection>

        <AutocompleteField
          label="Template name"
          value={name}
          onChange={setName}
          placeholder={kind === 'income' ? 'Paycheck' : 'Coffee, groceries, lunch'}
          suggestions={nameSuggestions}
        />
        <AutocompleteField
          label="Transaction item"
          value={title}
          onChange={setTitle}
          placeholder={kind === 'income' ? 'Salary' : 'Groceries'}
          suggestions={titleSuggestions}
        />
        <TextField
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          placeholder={splitLines.length >= 2 ? 'Required for split templates' : 'Optional'}
          keyboardType="decimal-pad"
        />

        <FormSection label="Account">
          <TemplateAccountRow
            account={selectedAccount}
            balanceMinor={selectedAccountBalance?.balanceMinor}
            showCurrencyCodes={snapshot.settings.multiCurrencyEnabled}
            onPress={() => setPage('account')}
          />
        </FormSection>

        <FormSection label="Category">
          <CategorySelectionField
            label="Category"
            value={getTemplateCategorySelectionLabel(categoryId, subcategoryId, categories)}
            onPress={openCategorySelect}
            color={getTemplateCategorySelectionColor(categoryId, subcategoryId, categories, kind)}
            icon={getTemplateCategorySelectionIcon(categoryId, subcategoryId, categories, kind)}
            iconColor={getTemplateCategorySelectionColor(categoryId, subcategoryId, categories, kind)}
            empty={!categoryId}
          />
          {categoryId ? (
            <FormInlineAction label="Clear category" onPress={clearCategory} />
          ) : null}
        </FormSection>

        <FormSection label="Split lines">
          <SplitTemplateSummaryRow
            kind={kind}
            lineCount={splitLines.length}
            isBalanced={splitSummary.isBalanced}
            splitMode={splitMode}
            totalMinor={splitTotalMinor}
            currencyCode={currencyCode}
            showCurrencyCodes={snapshot.settings.multiCurrencyEnabled}
            onPress={openSplitTemplateEditor}
          />
          {splitLines.length >= 2 ? (
            <FormInlineAction label="Use as normal template" onPress={stopSplitTemplate} />
          ) : null}
        </FormSection>

        <TextField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
          multiline
        />

        <FormSection label="Template preview">
          <TemplatePreview
            amount={amount}
            categoryId={categoryId}
            categories={categories}
            currencyCode={currencyCode}
            kind={kind}
            name={name}
            splitLineCount={splitLines.length}
            splitMode={splitMode}
            subcategoryId={subcategoryId}
            title={title}
          />
          <FormHelperText>Preview only. This is what will be prefilled.</FormHelperText>
        </FormSection>

        <FormError message={error} />

        {mode === 'edit' ? (
          <FormDangerZone
            label="Template status"
            warning={
              confirmArchive || confirmDelete
                ? 'Archived templates are hidden from the template list. Deleted templates cannot be restored.'
                : undefined
            }
          >
            <ActionButton variant="secondary" onPress={archiveTemplate} testID="archive-transaction-template">
              {confirmArchive ? 'Confirm archive' : 'Archive template'}
            </ActionButton>
            <ActionButton variant="danger" onPress={deleteTemplate} testID="delete-transaction-template">
              {confirmDelete ? 'Confirm delete' : 'Delete template'}
            </ActionButton>
          </FormDangerZone>
        ) : null}
      </KeyboardAwareFormScroll>
    </FormScreenShell>
  );
}

function parseOptionalTemplateAmount(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  return parseMoneyInput(value);
}

function getTemplateAmountMinor(value: string): number {
  try {
    return Math.abs(parseMoneyInput(value));
  } catch {
    return 0;
  }
}
