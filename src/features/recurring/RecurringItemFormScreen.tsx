import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { ActionButton, Chip, FormError, TextField } from '../../components/ui';
import { formatOptionalMoneyInput } from '../../domain/accountForm';
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
import { parseMoneyInput } from '../../domain/money';
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
import type {
  CategorySelectLaunchParams,
  CategorySelectionResult,
} from '../categorySelection/categorySelectionModel';
import { CategorySelectionField } from '../categorySelection/CategorySelectionField';
import { AutocompleteField, getNativePickerDisplay, NativePickerRow, useAutocompleteOptions } from '../transactions/TransactionFormComponents';
import { colors, spacing, typography } from '../../theme/tokens';

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
  const selectedCategory = getCategory(categoryId, categoryOptions);
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const currencyCode = getRecurringCurrencyCodeForAccount(accounts, accountId);
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

  return (
    <View style={styles.shell}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primaryDark} />
        </Pressable>
        <Text style={styles.title}>{mode === 'add' ? 'Add recurring' : 'Edit recurring'}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={submit}
          style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}
          testID={mode === 'add' ? 'save-new-recurring-item' : 'save-recurring-item'}
        >
          <Text style={styles.confirmText}>Save</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Type</Text>
          <View style={styles.wrap}>
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
          </View>
        </View>

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

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Account</Text>
          <View style={styles.optionList}>
            {accounts.length ? (
              accounts.map((account) => (
                <Pressable
                  accessibilityRole="button"
                  key={account.id}
                  onPress={() => selectAccount(account.id)}
                  style={({ pressed }) => [
                    styles.optionRow,
                    accountId === account.id && styles.optionRowSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <CategoryIconBadge color={account.themeColor} icon={account.iconName} size="sm" />
                  <View style={styles.optionText}>
                    <Text numberOfLines={1} style={styles.optionTitle}>{account.name}</Text>
                    <Text style={styles.optionDetail}>{account.currencyCode}</Text>
                  </View>
                  {accountId === account.id ? (
                    <Ionicons name="checkmark" size={18} color={colors.primaryDark} />
                  ) : null}
                </Pressable>
              ))
            ) : (
              <Text style={styles.hint}>Add an account before creating recurring items.</Text>
            )}
          </View>
        </View>

        <ReadOnlyField
          label="Currency"
          value={selectedAccount ? currencyCode : 'Select an account'}
          detail={selectedAccount ? 'From selected account' : 'Choose an account before saving.'}
        />

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Frequency</Text>
          <View style={styles.wrap}>
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
          </View>
        </View>

        <View style={styles.fieldGroup}>
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
              <View style={styles.nativePickerPanel}>
                <DateTimePicker
                  value={datePickerValue}
                  mode="date"
                  display={getNativePickerDisplay('date')}
                  onChange={handleDatePickerChange}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setDatePickerOpen(false)}
                  style={({ pressed }) => [styles.nativePickerDone, pressed && styles.pressed]}
                >
                  <Text style={styles.nativePickerDoneText}>Done</Text>
                </Pressable>
              </View>
            )
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Category</Text>
          <CategorySelectionField
            label="Category"
            value={`${selectedCategory.name} / ${getSubcategoryName(selectedCategory.id, subcategoryId, categories)}`}
            onPress={openCategorySelect}
            color={getSubcategoryColor(selectedCategory.id, subcategoryId, categories)}
            icon={getSubcategoryIcon(selectedCategory.id, subcategoryId, categories)}
            iconColor={getSubcategoryColor(selectedCategory.id, subcategoryId, categories)}
          />
        </View>

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
          <View style={styles.dangerZone}>
            <Text style={styles.label}>Recurring item status</Text>
            <ActionButton variant="danger" onPress={archiveRecurringItem} testID="archive-recurring-item">
              {confirmArchive ? 'Confirm archive' : 'Archive recurring item'}
            </ActionButton>
            {confirmArchive ? (
              <Text style={styles.warningText}>Archived recurring items are hidden from the default recurring list.</Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ReadOnlyField({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.readOnlyField}>
        <Text style={styles.readOnlyValue}>{value}</Text>
        <Text style={styles.hint}>{detail}</Text>
      </View>
    </View>
  );
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
    <View style={styles.preview}>
      <CategoryIconBadge
        color={subcategory?.color ?? category.color}
        icon={subcategory?.icon ?? category.icon}
        size="md"
      />
      <View style={styles.previewText}>
        <Text style={styles.previewTitle}>{label}</Text>
        <Text style={styles.hint}>
          {kind === 'income' ? 'Income' : 'Expense'} / {amountLabel} / Due {nextDueDate || 'YYYY-MM-DD'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 46,
  },
  iconButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  confirmButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: spacing.sm,
  },
  confirmText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
  },
  title: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '900',
  },
  content: {
    flexGrow: 1,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  label: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionList: {
    gap: spacing.sm,
  },
  optionRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionRowSelected: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.primary,
  },
  optionText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  optionTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  optionDetail: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  categoryList: {
    gap: spacing.sm,
  },
  readOnlyField: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  readOnlyValue: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  hint: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
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
  preview: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  previewText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  previewTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  dangerZone: {
    borderTopColor: colors.faint,
    borderTopWidth: 1,
    gap: spacing.sm,
    marginTop: 'auto',
    paddingTop: spacing.md,
  },
  warningText: {
    color: colors.danger,
    fontSize: typography.small,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.78,
  },
});
