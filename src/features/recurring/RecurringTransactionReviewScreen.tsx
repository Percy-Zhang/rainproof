import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AccountIconBadge } from '../../components/AccountDisplay';
import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { FormError, TextField } from '../../components/ui';
import { formatOptionalMoneyInput } from '../../domain/accountForm';
import {
  defaultCategories,
  getCategory,
  getDefaultCategoryForKind,
  getDefaultSubcategoryId,
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
} from '../../domain/recurringItems';
import { saveRecurringTransactionFromDraft } from '../../domain/recurringTransactionReview';
import type {
  AppSnapshot,
  CreateRecurringTransactionInput,
  RecurringItem,
} from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { CategorySelectionField } from '../categorySelection/CategorySelectionField';
import type {
  CategorySelectLaunchParams,
  CategorySelectionResult,
} from '../categorySelection/categorySelectionModel';
import { getNativePickerDisplay, NativePickerRow } from '../transactions/TransactionFormComponents';

type RecurringTransactionReviewScreenProps = {
  snapshot: AppSnapshot;
  recurringItem: RecurringItem;
  onCreateRecurringTransaction: (input: CreateRecurringTransactionInput) => Promise<void>;
  onOpenCategorySelect: (
    params: CategorySelectLaunchParams,
    onSelect: (selection: CategorySelectionResult) => void,
  ) => void;
  onCancel: () => void;
  onDone: () => void;
};

export function RecurringTransactionReviewScreen({
  snapshot,
  recurringItem,
  onCancel,
  onCreateRecurringTransaction,
  onDone,
  onOpenCategorySelect,
}: RecurringTransactionReviewScreenProps) {
  const accounts = snapshot.accounts.filter((account) => !account.isArchived);
  const categories = useMemo(() => snapshot.categories ?? defaultCategories, [snapshot.categories]);
  const categoryOptions = categories.filter((category) => category.type === recurringItem.kind);
  const defaultCategory = getDefaultCategoryForKind(recurringItem.kind, categories);
  const initialCategory = getCategory(recurringItem.categoryId || defaultCategory.id, categoryOptions);
  const [title, setTitle] = useState(recurringItem.name);
  const [amount, setAmount] = useState(formatOptionalMoneyInput(recurringItem.amountMinor));
  const [transactionDate, setTransactionDate] = useState(
    isValidDateOnly(recurringItem.nextDueDate) ? recurringItem.nextDueDate : toLocalDateOnly(new Date()),
  );
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [accountId, setAccountId] = useState(
    accounts.some((account) => account.id === recurringItem.accountId)
      ? recurringItem.accountId
      : accounts[0]?.id ?? '',
  );
  const [categoryId, setCategoryId] = useState(initialCategory.id);
  const [subcategoryId, setSubcategoryId] = useState(
    recurringItem.subcategoryId ?? getDefaultSubcategoryId(initialCategory),
  );
  const [note, setNote] = useState(recurringItem.note);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const currencyCode = getRecurringCurrencyCodeForAccount(accounts, accountId);
  const selectedCategory = getCategory(categoryId, categoryOptions);
  const datePickerValue = isValidDateOnly(transactionDate) ? dateOnlyToLocalDate(transactionDate) : new Date();
  const dueDateLabel = isValidDateOnly(recurringItem.nextDueDate)
    ? formatLongDateLabel(recurringItem.nextDueDate)
    : 'the current due date';
  const actionLabel = recurringItem.kind === 'income' ? 'Mark received' : 'Mark paid';
  const kindLabel = recurringItem.kind === 'income' ? 'income' : 'expense';

  async function submit() {
    if (saving) {
      return;
    }

    try {
      if (!recurringItem.isActive) {
        throw new Error('Recurring item is archived.');
      }

      if (!selectedAccount) {
        throw new Error(accountId ? 'Recurring item account needs attention.' : 'Choose an account.');
      }

      if (!title.trim()) {
        throw new Error('Transaction title is required.');
      }

      const amountMinor = parseMoneyInput(amount);
      if (amountMinor <= 0) {
        throw new Error('Amount must be greater than zero.');
      }

      if (!isValidDateOnly(transactionDate)) {
        throw new Error('Choose a valid transaction date.');
      }

      setSaving(true);
      await saveRecurringTransactionFromDraft({
        accounts,
        categories,
        recurringItem,
        draft: {
          title,
          amountMinor,
          transactionDate,
          accountId,
          categoryId,
          subcategoryId,
          note,
        },
        createRecurringTransaction: onCreateRecurringTransaction,
      });

      setError('');
      setSaving(false);
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create transaction.');
      setSaving(false);
    }
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

    setTransactionDate(toLocalDateOnly(selectedDate));

    if (Platform.OS === 'android') {
      setDatePickerOpen(false);
    }
  }

  function openCategorySelect() {
    onOpenCategorySelect(
      {
        kind: recurringItem.kind,
        selectedCategoryId: categoryId,
        selectedSubcategoryId: subcategoryId,
        selectionMode: 'subcategory',
        showSuggestions: true,
        title: 'Transaction category',
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
        <Text style={styles.title}>Create {kindLabel}</Text>
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={submit}
          style={({ pressed }) => [styles.confirmButton, saving && styles.disabled, pressed && !saving && styles.pressed]}
          testID="save-recurring-transaction"
        >
          <Text style={styles.confirmText}>{saving ? 'Saving...' : actionLabel}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.notice}>
          <CategoryIconBadge
            color={getSubcategoryColor(selectedCategory.id, subcategoryId, categories)}
            icon={getSubcategoryIcon(selectedCategory.id, subcategoryId, categories)}
            size="md"
          />
          <View style={styles.noticeText}>
            <Text style={styles.noticeTitle}>{recurringItem.name}</Text>
            <Text style={styles.hint}>
              Next due date advances from {dueDateLabel} after save.
            </Text>
          </View>
        </View>

        <TextField
          label="Item"
          value={title}
          onChangeText={setTitle}
          placeholder={recurringItem.kind === 'income' ? 'Salary' : 'Rent, subscription, insurance'}
        />
        <TextField
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />

        <View style={styles.fieldGroup}>
          <NativePickerRow
            label="Transaction date"
            value={isValidDateOnly(transactionDate) ? formatLongDateLabel(transactionDate) : 'Choose date'}
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
          <Text style={styles.label}>Account</Text>
          <View style={styles.optionList}>
            {accounts.length ? (
              accounts.map((account) => (
                <Pressable
                  accessibilityRole="button"
                  key={account.id}
                  onPress={() => setAccountId(account.id)}
                  style={({ pressed }) => [
                    styles.optionRow,
                    accountId === account.id && styles.optionRowSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <AccountIconBadge account={account} size="sm" />
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
              <Text style={styles.hint}>Add an account before creating transactions.</Text>
            )}
          </View>
        </View>

        <ReadOnlyField
          label="Currency"
          value={selectedAccount ? currencyCode : 'Select an account'}
          detail={selectedAccount ? 'From selected account' : 'Choose an account before saving.'}
        />

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

        <FormError message={error} />
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
  notice: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  noticeText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  noticeTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
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
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.78,
  },
});
