import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { BackHandler, Keyboard, Platform, Pressable, Text, View } from 'react-native';

import { ActionButton, Chip, FormError, TextField } from '../../components/ui';
import {
  FormChipRow,
  FormDangerZone,
  FormPreviewRow,
  FormScreenShell,
  FormSection,
  KeyboardAwareFormScroll,
  formLayoutStyles,
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
  getNativePickerDisplay,
  NativePickerRow,
  SelectorRow,
  TransactionPickerScreen,
  useAutocompleteOptions,
} from '../transactions/TransactionFormComponents';

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
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

type RecurringFormPage = 'form' | 'account';

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

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (page === 'account') {
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
        throw new Error(accountId ? 'Recurring item account needs attention.' : 'Recurring item account is required.');
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
      setError(caught instanceof Error ? caught.message : 'Could not save recurring item.');
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
      setError(caught instanceof Error ? caught.message : 'Could not archive recurring item.');
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
      isActive: true,
    };
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
        title: 'Recurring category',
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

  return (
    <FormScreenShell
      title={mode === 'add' ? 'Add recurring' : 'Edit recurring'}
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
          placeholder="0.00"
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
          {datePickerOpen ? (
            Platform.OS === 'android' ? (
              <DateTimePicker
                value={datePickerValue}
                mode="date"
                display={getNativePickerDisplay('date')}
                onChange={handleDatePickerChange}
              />
            ) : (
              <View style={formLayoutStyles.nativePickerPanel}>
                <DateTimePicker
                  value={datePickerValue}
                  mode="date"
                  display={getNativePickerDisplay('date')}
                  onChange={handleDatePickerChange}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setDatePickerOpen(false)}
                  style={({ pressed }) => [
                    formLayoutStyles.nativePickerDone,
                    pressed && formLayoutStyles.pressed,
                  ]}
                >
                  <Text style={formLayoutStyles.nativePickerDoneText}>Done</Text>
                </Pressable>
              </View>
            )
          ) : null}
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
          subcategoryId={subcategoryId}
        />

        <FormError message={error} />

        {mode === 'edit' ? (
          <FormDangerZone
            label="Recurring item status"
            warning={confirmArchive ? 'Archived recurring items are hidden from the default recurring list.' : undefined}
          >
            <ActionButton variant="danger" onPress={archiveRecurringItem} testID="archive-recurring-item">
              {confirmArchive ? 'Confirm archive' : 'Archive recurring item'}
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

function RecurringPreview({
  amount,
  categories,
  categoryId,
  currencyCode,
  kind,
  nextDueDate,
  subcategoryId,
}: {
  amount: string;
  categories: CategoryDefinition[];
  categoryId: string;
  currencyCode: string;
  kind: RecurringItemKind;
  nextDueDate: string;
  subcategoryId: string | null;
}) {
  const subcategory = getSubcategory(categoryId, subcategoryId ?? '', categories);
  const category = getCategory(categoryId, categories);
  const label = subcategory?.name ?? category.name;
  const amountLabel = amount.trim() ? `${currencyCode} ${amount.trim()}` : `${currencyCode} 0.00`;

  return (
    <FormPreviewRow
      color={subcategory?.color ?? category.color}
      icon={subcategory?.icon ?? category.icon}
      title={label}
      detail={`${kind === 'income' ? 'Income' : 'Expense'} / ${amountLabel} / Due ${nextDueDate || 'YYYY-MM-DD'}`}
    />
  );
}
