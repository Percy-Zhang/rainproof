import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { BackHandler, Keyboard, Platform } from 'react-native';

import { FloatingDateTimePicker } from '../../components/FloatingDateTimePicker';
import { ActionButton, Chip, FormError, TextField } from '../../components/ui';
import {
  FormChipRow,
  FormDangerZone,
  FormInlineAction,
  FormPreviewRow,
  FormScreenShell,
  FormSection,
  KeyboardAwareFormScroll,
} from '../../components/FormLayout';
import { formatOptionalMoneyInput } from '../../domain/accountForm';
import { getAccountBalances } from '../../domain/aggregates';
import { getAccountDisplayName } from '../../domain/accountThemes';
import {
  defaultCategories,
  getCategory,
  getDefaultCategoryForKind,
  getDefaultSubcategoryId,
  getSubcategory,
  getSubcategoryColor,
  getSubcategoryIcon,
  getSubcategoryName,
} from '../../domain/categories';
import { formatLongDateLabel } from '../../domain/dates';
import { formatMoney, parseMoneyInput } from '../../domain/money';
import {
  createSplitTransactionFormLine,
  formatMinorInput,
  getSplitLineCategoryKind,
  getSplitTransactionFormSummary,
  type SplitTransactionFormLine,
} from '../../domain/splitTransactionForm';
import type { SplitTransactionLineKind } from '../../domain/splitTransactions';
import {
  dateOnlyToLocalDate,
  getRecurringCurrencyCodeForAccount,
  isValidDateOnly,
  toLocalDateOnly,
  validateRecurringItemInput,
} from '../../domain/recurringItems';
import { getTransactionItemNameSuggestionValues } from '../../domain/transactionItemSuggestions';
import type {
  AppSnapshot,
  CategoryDefinition,
  NewRecurringItemInput,
  RecurringFrequency,
  RecurringItem,
  RecurringItemKind,
  UpdateRecurringItemInput,
} from '../../domain/types';
import { colors } from '../../theme/tokens';
import type {
  CategorySelectLaunchParams,
  CategorySelectionResult,
} from '../categorySelection/categorySelectionModel';
import { CategorySelectionField } from '../categorySelection/CategorySelectionField';
import {
  AutocompleteField,
  NativePickerRow,
  SelectorRow,
  TransactionPickerScreen,
  useAutocompleteOptions,
} from '../transactions/TransactionFormComponents';
import { SplitPlanSummaryRow } from '../transactions/SplitPlanSummaryRow';
import { SplitTransactionEditor, SplitTransactionEditorScrollContainer } from '../transactions/SplitTransactionEditor';

type RecurringItemFormScreenProps =
  | {
      mode: 'add';
      snapshot: AppSnapshot;
      onAddRecurringItem: (input: NewRecurringItemInput) => Promise<void>;
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
      recurringItem: RecurringItem;
      onUpdateRecurringItem: (input: UpdateRecurringItemInput) => Promise<void>;
      onArchiveRecurringItem: (recurringItemId: string) => Promise<void>;
      onOpenCategorySelect: (
        params: CategorySelectLaunchParams,
        onSelect: (selection: CategorySelectionResult) => void,
      ) => void;
      onCancel: () => void;
      onDone: () => void;
    };

const kindOptions: { value: RecurringItemKind; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
];
const frequencyOptions: { value: RecurringFrequency; label: string }[] = [
  { value: 'one_time', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

type RecurringFormPage = 'form' | 'account' | 'split';

let recurringSplitLineCounter = 0;

function createRecurringSplitLineId(): string {
  recurringSplitLineCounter += 1;
  return `recurring-split-line-${recurringSplitLineCounter}`;
}

export function RecurringItemFormScreen(props: RecurringItemFormScreenProps) {
  const { mode, snapshot, onCancel, onDone } = props;
  const editingItem = mode === 'edit' ? props.recurringItem : null;
  const accounts = snapshot.accounts.filter((account) => !account.isArchived);
  const categories = useMemo(() => snapshot.categories ?? defaultCategories, [snapshot.categories]);
  const [kind, setKind] = useState<RecurringItemKind>(editingItem?.kind ?? 'expense');
  const categoryOptions = categories.filter((category) => category.type === kind);
  const defaultCategory = getDefaultCategoryForKind(kind, categories);
  const initialCategory = getCategory(editingItem?.categoryId ?? defaultCategory.id, categoryOptions);
  const firstAccount = accounts[0];
  const [name, setName] = useState(editingItem?.name ?? '');
  const [amount, setAmount] = useState(formatOptionalMoneyInput(editingItem?.amountMinor));
  const [accountId, setAccountId] = useState(editingItem?.accountId ?? firstAccount?.id ?? '');
  const [categoryId, setCategoryId] = useState(initialCategory.id);
  const [subcategoryId, setSubcategoryId] = useState(
    editingItem?.subcategoryId ?? getDefaultSubcategoryId(initialCategory),
  );
  const [splitLines, setSplitLines] = useState<SplitTransactionFormLine[]>(() =>
    (editingItem?.kind === 'expense' ? editingItem.splitLines : []).map((line) =>
      createSplitTransactionFormLine({
        id: line.id,
        amount: formatMinorInput(line.amountMinor),
        categoryId: line.categoryId,
        subcategoryId: line.subcategoryId,
        note: line.note,
      })),
  );
  const [note, setNote] = useState(editingItem?.note ?? '');
  const [frequency, setFrequency] = useState<RecurringFrequency>(editingItem?.frequency ?? 'monthly');
  const [nextDueDate, setNextDueDate] = useState(editingItem?.nextDueDate ?? toLocalDateOnly(new Date()));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState<RecurringFormPage>('form');
  const selectedCategory = getCategory(categoryId, categoryOptions);
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const currencyCode = getRecurringCurrencyCodeForAccount(accounts, accountId);
  const selectedAccountBalance = useMemo(
    () => getAccountBalances(snapshot.accounts, snapshot.transactionLines)
      .find(({ account }) => account.id === accountId),
    [accountId, snapshot.accounts, snapshot.transactionLines],
  );
  const datePickerValue = isValidDateOnly(nextDueDate) ? dateOnlyToLocalDate(nextDueDate) : new Date();
  const itemNameSuggestionValues = useMemo(
    () => getTransactionItemNameSuggestionValues({
      transactions: snapshot.transactions,
      transactionLines: snapshot.transactionLines,
      transactionTemplates: snapshot.transactionTemplates,
      recurringItems: snapshot.recurringItems,
      excludeRecurringItemId: editingItem?.id,
    }),
    [
      editingItem?.id,
      snapshot.recurringItems,
      snapshot.transactionLines,
      snapshot.transactionTemplates,
      snapshot.transactions,
    ],
  );
  const nameSuggestions = useAutocompleteOptions(itemNameSuggestionValues, name);
  const amountMinor = parseRecurringAmountInput(amount);
  const splitSummary = getSplitTransactionFormSummary(amountMinor, splitLines);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (page === 'account') {
          setPage('form');
          return true;
        }
        if (page === 'split') {
          setPage('form');
          return true;
        }

        return false;
      });

      return () => subscription.remove();
    }, [page]),
  );

  function changeKind(nextKind: RecurringItemKind) {
    const nextCategory = getDefaultCategoryForKind(nextKind, categories);
    setKind(nextKind);
    setCategoryId(nextCategory.id);
    setSubcategoryId(getDefaultSubcategoryId(nextCategory));
    setSplitLines([]);
    setConfirmArchive(false);
    setError('');
  }

  function selectAccount(nextAccountId: string) {
    setAccountId(nextAccountId);
    setPage('form');
    setConfirmArchive(false);
    setError('');
  }

  async function submit() {
    try {
      if (!selectedAccount) {
        throw new Error(accountId ? 'Upcoming payment account needs attention.' : 'Upcoming payment account is required.');
      }

      const amountMinor = parseMoneyInput(amount);
      const input = buildRecurringInput(amountMinor);
      validateRecurringItemInput(input);

      if (mode === 'add') {
        await props.onAddRecurringItem(input);
      } else {
        await props.onUpdateRecurringItem({ id: props.recurringItem.id, ...input });
      }

      setError('');
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save upcoming payment.');
    }
  }

  async function archiveRecurringItem() {
    if (mode !== 'edit') {
      return;
    }

    if (!confirmArchive) {
      setConfirmArchive(true);
      return;
    }

    try {
      await props.onArchiveRecurringItem(props.recurringItem.id);
      setError('');
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not archive upcoming payment.');
    }
  }

  function buildRecurringInput(amountMinor: number): NewRecurringItemInput {
    return {
      name: name.trim(),
      kind,
      amountMinor,
      currencyCode,
      accountId,
      categoryId,
      subcategoryId,
      note,
      frequency,
      nextDueDate: nextDueDate.trim(),
      completedAt: editingItem?.completedAt ?? null,
      splitLines: kind === 'expense'
        ? splitLines.map((line) => ({
          amountMinor: Math.abs(parseMoneyInput(line.amount)),
          categoryId: line.categoryId,
          subcategoryId: line.subcategoryId,
          note: line.note,
        }))
        : [],
      isActive: true,
    };
  }

  function getSplitBaseCategorySelection(lineKind: SplitTransactionLineKind = 'expense') {
    const selectedCategory = getCategory(categoryId, categories);
    const category =
      selectedCategory.type === lineKind
        ? selectedCategory
        : getDefaultCategoryForKind(lineKind, categories);
    return {
      categoryId: category.id,
      subcategoryId:
        category.id === selectedCategory.id
          ? subcategoryId ?? getDefaultSubcategoryId(category)
          : getDefaultSubcategoryId(category),
    };
  }

  function startSplitUpcomingPayment() {
    if (kind !== 'expense') {
      return;
    }

    const selection = getSplitBaseCategorySelection();
    const totalMinor = parseRecurringAmountInput(amount);
    setCategoryId(selection.categoryId);
    setSubcategoryId(selection.subcategoryId);
    setSplitLines([
      createSplitTransactionFormLine({
        id: createRecurringSplitLineId(),
        amount: totalMinor > 0 ? formatMinorInput(totalMinor) : '',
        categoryId: selection.categoryId,
        subcategoryId: selection.subcategoryId,
      }),
      createSplitTransactionFormLine({
        id: createRecurringSplitLineId(),
        categoryId: selection.categoryId,
        subcategoryId: selection.subcategoryId,
      }),
    ]);
    setError('');
  }

  function openSplitEditor() {
    if (kind !== 'expense') {
      return;
    }

    if (splitLines.length < 2) {
      startSplitUpcomingPayment();
    }

    setPage('split');
  }

  function stopSplitUpcomingPayment() {
    if (splitLines.length === 1) {
      setCategoryId(splitLines[0].categoryId);
      setSubcategoryId(splitLines[0].subcategoryId);
    }
    setSplitLines([]);
    setPage('form');
    setError('');
  }

  function addSplitLine() {
    const remainingMinor = getSplitTransactionFormSummary(parseRecurringAmountInput(amount), splitLines).remainingMinor;
    const selection = getSplitBaseCategorySelection();
    setSplitLines((current) => [
      ...current,
      createSplitTransactionFormLine({
        id: createRecurringSplitLineId(),
        amount: remainingMinor > 0 ? formatMinorInput(remainingMinor) : '',
        categoryId: selection.categoryId,
        subcategoryId: selection.subcategoryId,
      }),
    ]);
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
      setPage('form');
      return;
    }

    setSplitLines(nextLines);
  }

  function openSplitLineCategorySelect(lineId: string) {
    const line = splitLines.find((candidate) => candidate.id === lineId);
    const lineKind = getSplitLineCategoryKind({
      line,
      parentKind: 'expense',
      splitMode: 'standard',
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

  function openDatePicker() {
    Keyboard.dismiss();
    setDatePickerOpen(true);
  }

  function handleDatePickerChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (event.type === 'dismissed') {
      setDatePickerOpen(false);
      return;
    }

    if (!selectedDate) {
      return;
    }

    setNextDueDate(toLocalDateOnly(selectedDate));

    if (Platform.OS === 'android') {
      setDatePickerOpen(false);
    }
  }

  function openCategorySelect() {
    props.onOpenCategorySelect(
      {
        kind,
        selectedCategoryId: categoryId,
        selectedSubcategoryId: subcategoryId,
        selectionMode: 'subcategory',
        showSuggestions: false,
        title: 'Upcoming payment category',
      },
      ({ categoryId: nextCategoryId, subcategoryId: nextSubcategoryId }) => {
        const nextCategory = getCategory(nextCategoryId, categoryOptions);
        setCategoryId(nextCategory.id);
        setSubcategoryId(nextSubcategoryId ?? getDefaultSubcategoryId(nextCategory));
      },
    );
  }

  if (page === 'account') {
    return (
      <TransactionPickerScreen
        mode="sourceAccount"
        accounts={accounts}
        selectedAccountId={accountId}
        selectedCategoryId={categoryId}
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
        cancelTestID="cancel-recurring-account-picker"
      />
    );
  }

  if (page === 'split') {
    return (
      <FormScreenShell
        title="Split upcoming payment"
        onBack={() => setPage('form')}
        onSave={() => setPage('form')}
        saveLabel="Done"
        saveTestID="done-recurring-split"
      >
        <SplitTransactionEditorScrollContainer testID="recurring-split-page">
          <SplitTransactionEditor
            categories={categories}
            currencyCode={currencyCode}
            itemNameSuggestions={itemNameSuggestionValues}
            lines={splitLines}
            parentKind="expense"
            showCurrencyCodes={snapshot.settings.multiCurrencyEnabled}
            splitMode="standard"
            totalMinor={amountMinor}
            onAddLine={addSplitLine}
            onChangeLineKind={() => undefined}
            onChangeSplitMode={() => undefined}
            onPickCategory={openSplitLineCategorySelect}
            onRemoveLine={removeSplitLine}
            onUpdateLine={updateSplitLine}
          />
          <FormInlineAction label="Use as normal upcoming payment" onPress={stopSplitUpcomingPayment} />
        </SplitTransactionEditorScrollContainer>
      </FormScreenShell>
    );
  }

  return (
    <FormScreenShell
      title={mode === 'add' ? 'Add upcoming payment' : 'Edit upcoming payment'}
      onBack={onCancel}
      onSave={submit}
      saveTestID={mode === 'add' ? 'save-new-recurring-item' : 'save-recurring-item'}
    >
      <KeyboardAwareFormScroll>
        <FormSection label="Type">
          <FormChipRow>
            {kindOptions.map((option) => (
              <Chip
                key={option.value}
                selected={kind === option.value}
                onPress={() => changeKind(option.value)}
                testID={`recurring-kind-${option.value}`}
              >
                {option.label}
              </Chip>
            ))}
          </FormChipRow>
        </FormSection>

        <AutocompleteField
          label="Name"
          value={name}
          onChange={setName}
          placeholder={kind === 'income' ? 'Salary' : 'Rent, subscription, insurance'}
          suggestions={nameSuggestions}
        />
        <TextField
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          placeholder={splitLines.length >= 2 ? 'Required for split upcoming payments' : '0.00'}
          keyboardType="decimal-pad"
        />

        <FormSection label="Account">
          <SelectorRow
            label="Account"
            value={getRecurringAccountLabel(
              selectedAccount,
              selectedAccountBalance?.balanceMinor,
            )}
            onPress={() => setPage('account')}
            color={selectedAccount?.themeColor ?? colors.primary}
            icon={selectedAccount?.iconName ?? 'wallet-outline'}
            iconColor={selectedAccount?.themeColor}
            iconKind="account"
            empty={!selectedAccount}
            testID="recurring-account-row"
          />
        </FormSection>

        <FormSection label="Frequency">
          <FormChipRow>
            {frequencyOptions.map((option) => (
              <Chip
                key={option.value}
                selected={frequency === option.value}
                onPress={() => setFrequency(option.value)}
                testID={`recurring-frequency-${option.value}`}
              >
                {option.label}
              </Chip>
            ))}
          </FormChipRow>
        </FormSection>

        <FormSection>
          <NativePickerRow
            label="Next due date"
            value={isValidDateOnly(nextDueDate) ? formatLongDateLabel(nextDueDate) : 'Choose date'}
            onPress={openDatePicker}
          />
          <FloatingDateTimePicker
            mode={datePickerOpen ? 'date' : null}
            value={datePickerValue}
            onChange={handleDatePickerChange}
            onClose={() => setDatePickerOpen(false)}
          />
        </FormSection>

        <FormSection label="Category">
          <CategorySelectionField
            label="Category"
            value={`${selectedCategory.name} / ${getSubcategoryName(selectedCategory.id, subcategoryId, categories)}`}
            onPress={openCategorySelect}
            color={getSubcategoryColor(selectedCategory.id, subcategoryId, categories)}
            icon={getSubcategoryIcon(selectedCategory.id, subcategoryId, categories)}
            iconColor={getSubcategoryColor(selectedCategory.id, subcategoryId, categories)}
          />
        </FormSection>

        {kind === 'expense' ? (
          <FormSection label="Split lines">
            <SplitPlanSummaryRow
              title={splitLines.length >= 2 ? 'Split expense plan' : 'Normal expense plan'}
              detail={getRecurringSplitSummaryLabel({
                currencyCode,
                isBalanced: splitSummary.isBalanced,
                lineCount: splitLines.length,
                showCurrencyCodes: snapshot.settings.multiCurrencyEnabled,
                totalMinor: amountMinor,
              })}
              onPress={openSplitEditor}
              testID="recurring-split-row"
            />
            {splitLines.length >= 2 ? (
              <FormInlineAction label="Use as normal upcoming payment" onPress={stopSplitUpcomingPayment} />
            ) : null}
          </FormSection>
        ) : null}

        <TextField
          label="Note"
          value={note}
          onChangeText={setNote}
          placeholder="Optional details"
          multiline
        />

        <RecurringPreview
          amount={amount}
          categories={categories}
          categoryId={categoryId}
          currencyCode={currencyCode}
          kind={kind}
          nextDueDate={nextDueDate}
          splitLineCount={splitLines.length}
          subcategoryId={subcategoryId}
        />

        <FormError message={error} />

        {mode === 'edit' ? (
          <FormDangerZone
            label="Upcoming payment status"
            warning={confirmArchive ? 'Archived upcoming payments are hidden from the active upcoming payments list.' : undefined}
          >
            <ActionButton variant="danger" onPress={archiveRecurringItem} testID="archive-recurring-item">
              {confirmArchive ? 'Confirm archive' : 'Archive upcoming payment'}
            </ActionButton>
          </FormDangerZone>
        ) : null}
      </KeyboardAwareFormScroll>
    </FormScreenShell>
  );
}

function getRecurringAccountLabel(
  account: AppSnapshot['accounts'][number] | undefined,
  balanceMinor: number | undefined,
): string {
  if (!account) {
    return 'Add or select an account';
  }

  const balanceLabel = balanceMinor === undefined
    ? null
    : formatMoney(balanceMinor, account.currencyCode);

  return [
    getAccountDisplayName(account),
    account.currencyCode,
    balanceLabel,
  ].filter(Boolean).join(' / ');
}

function getRecurringSplitSummaryLabel({
  currencyCode,
  isBalanced,
  lineCount,
  showCurrencyCodes,
  totalMinor,
}: {
  currencyCode: string;
  isBalanced: boolean;
  lineCount: number;
  showCurrencyCodes: boolean;
  totalMinor: number;
}): string {
  if (lineCount < 2) {
    return 'Create a split expense plan';
  }

  return `${lineCount} lines / ${isBalanced ? 'Ready' : 'Needs total'} / ${formatMoney(totalMinor, currencyCode, {
    showCurrencyCode: showCurrencyCodes,
  })}`;
}

function RecurringPreview({
  amount,
  categories,
  categoryId,
  currencyCode,
  kind,
  nextDueDate,
  splitLineCount,
  subcategoryId,
}: {
  amount: string;
  categories: CategoryDefinition[];
  categoryId: string;
  currencyCode: string;
  kind: RecurringItemKind;
  nextDueDate: string;
  splitLineCount: number;
  subcategoryId: string | null;
}) {
  const subcategory = getSubcategory(categoryId, subcategoryId ?? '', categories);
  const category = getCategory(categoryId, categories);
  const label = subcategory?.name ?? category.name;
  const amountLabel = amount.trim() ? `${currencyCode} ${amount.trim()}` : `${currencyCode} 0.00`;
  const splitDetail = splitLineCount >= 2 ? ` / ${splitLineCount} split lines` : '';

  return (
    <FormPreviewRow
      color={subcategory?.color ?? category.color}
      icon={subcategory?.icon ?? category.icon}
      title={label}
      detail={`${kind === 'income' ? 'Income' : 'Expense'}${splitDetail} / ${amountLabel} / Due ${nextDueDate || 'YYYY-MM-DD'}`}
    />
  );
}

function parseRecurringAmountInput(value: string): number {
  try {
    return Math.abs(parseMoneyInput(value));
  } catch {
    return 0;
  }
}
