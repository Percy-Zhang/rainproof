import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { ActionButton, Chip, FormError, TextField } from '../../components/ui';
import { formatOptionalMoneyInput } from '../../domain/accountForm';
import {
  defaultCategories,
  getCategory,
  getDefaultCategoryForKind,
  getDefaultSubcategoryId,
  getSubcategory,
  getSubcategoryIcon,
  getSubcategoryName,
} from '../../domain/categories';
import { parseMoneyInput } from '../../domain/money';
import {
  getTemplateCurrencyCodeForAccount,
  validateTransactionTemplateInput,
} from '../../domain/transactionTemplates';
import type {
  AppSnapshot,
  CategoryDefinition,
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
import { colors, spacing, typography } from '../../theme/tokens';

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
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const currencyCode = getTemplateCurrencyCodeForAccount(accounts, accountId);

  function changeKind(nextKind: TransactionTemplateKind) {
    setKind(nextKind);
    setCategoryId(null);
    setSubcategoryId(null);
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
      title,
      accountId,
      amountMinor: parseOptionalTemplateAmount(amount),
      currencyCode,
      categoryId,
      subcategoryId,
      notes,
      isActive: true,
    };
  }

  function selectAccount(nextAccountId: string) {
    setAccountId(nextAccountId);
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
        <Text style={styles.title}>{mode === 'add' ? 'Add template' : 'Edit template'}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={submit}
          style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}
          testID={mode === 'add' ? 'save-new-transaction-template' : 'save-transaction-template'}
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
                testID={`template-kind-${option.value}`}
              >
                {option.label}
              </Chip>
            ))}
          </View>
        </View>

        <TextField
          label="Template name"
          value={name}
          onChangeText={setName}
          placeholder={kind === 'income' ? 'Paycheck' : 'Coffee, groceries, lunch'}
        />
        <TextField
          label="Transaction item"
          value={title}
          onChangeText={setTitle}
          placeholder={kind === 'income' ? 'Salary' : 'Groceries'}
        />
        <TextField
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          placeholder="Optional"
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
              <Text style={styles.hint}>Add an account before creating templates.</Text>
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
            value={getCategorySelectionLabel(categoryId, subcategoryId, categories)}
            onPress={openCategorySelect}
            color={getCategorySelectionColor(categoryId, subcategoryId, categories, kind)}
            icon={getCategorySelectionIcon(categoryId, subcategoryId, categories, kind)}
            iconColor={getCategorySelectionColor(categoryId, subcategoryId, categories, kind)}
            empty={!categoryId}
          />
          {categoryId ? (
            <Pressable
              accessibilityRole="button"
              onPress={clearCategory}
              style={({ pressed }) => [styles.clearCategoryButton, pressed && styles.pressed]}
            >
              <Text style={styles.clearCategoryText}>Clear category</Text>
            </Pressable>
          ) : null}
        </View>

        <TextField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
          multiline
        />

        <TemplatePreview
          amount={amount}
          categoryId={categoryId}
          categories={categories}
          currencyCode={currencyCode}
          kind={kind}
          name={name}
          subcategoryId={subcategoryId}
          title={title}
        />

        <FormError message={error} />

        {mode === 'edit' ? (
          <View style={styles.dangerZone}>
            <Text style={styles.label}>Template status</Text>
            <ActionButton variant="secondary" onPress={archiveTemplate} testID="archive-transaction-template">
              {confirmArchive ? 'Confirm archive' : 'Archive template'}
            </ActionButton>
            <ActionButton variant="danger" onPress={deleteTemplate} testID="delete-transaction-template">
              {confirmDelete ? 'Confirm delete' : 'Delete template'}
            </ActionButton>
            {confirmArchive || confirmDelete ? (
              <Text style={styles.warningText}>
                Archived templates are hidden from the template list. Deleted templates cannot be restored.
              </Text>
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

function TemplatePreview({
  amount,
  categories,
  categoryId,
  currencyCode,
  kind,
  name,
  subcategoryId,
  title,
}: {
  amount: string;
  categories: CategoryDefinition[];
  categoryId: string | null;
  currencyCode: string;
  kind: TransactionTemplateKind;
  name: string;
  subcategoryId: string | null;
  title: string;
}) {
  const color = getCategorySelectionColor(categoryId, subcategoryId, categories, kind);
  const icon = getCategorySelectionIcon(categoryId, subcategoryId, categories, kind);
  const label = title.trim() || name.trim() || 'New transaction';
  const amountLabel = amount.trim() ? `${currencyCode} ${amount.trim()}` : 'Amount set when adding';

  return (
    <View style={styles.preview}>
      <CategoryIconBadge color={color} icon={icon} size="md" />
      <View style={styles.previewText}>
        <Text style={styles.previewTitle}>{label}</Text>
        <Text style={styles.hint}>{capitalize(kind)} / {amountLabel}</Text>
      </View>
    </View>
  );
}

function parseOptionalTemplateAmount(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  return parseMoneyInput(value);
}

function getCategorySelectionLabel(
  categoryId: string | null,
  subcategoryId: string | null,
  categories: CategoryDefinition[],
): string {
  if (!categoryId) {
    return 'Optional';
  }

  const category = getCategory(categoryId, categories);
  return subcategoryId ? `${category.name} / ${getSubcategoryName(category.id, subcategoryId, categories)}` : category.name;
}

function getCategorySelectionColor(
  categoryId: string | null,
  subcategoryId: string | null,
  categories: CategoryDefinition[],
  kind: TransactionTemplateKind,
): string {
  if (!categoryId) {
    return kind === 'income' ? colors.success : colors.danger;
  }

  return getSubcategory(categoryId, subcategoryId ?? '', categories)?.color ?? getCategory(categoryId, categories).color;
}

function getCategorySelectionIcon(
  categoryId: string | null,
  subcategoryId: string | null,
  categories: CategoryDefinition[],
  kind: TransactionTemplateKind,
): string {
  if (!categoryId) {
    return kind === 'income' ? 'trending-up-outline' : 'cart-outline';
  }

  return getSubcategoryIcon(categoryId, subcategoryId ?? '', categories);
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
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
  clearCategoryButton: {
    alignSelf: 'flex-start',
    minHeight: 34,
    justifyContent: 'center',
  },
  clearCategoryText: {
    color: colors.primaryDark,
    fontSize: typography.small,
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
