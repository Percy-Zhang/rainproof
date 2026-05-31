import { useMemo, useState } from 'react';

import { ActionButton, Chip, FormError, TextField } from '../../components/ui';
import {
  AccountOptionList,
  FormChipRow,
  FormDangerZone,
  FormInlineAction,
  FormPreviewRow,
  FormScreenShell,
  FormSection,
  KeyboardAwareFormScroll,
  ReadonlyField,
} from '../../components/FormLayout';
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
import { getTransactionItemNameSuggestionValues } from '../../domain/transactionItemSuggestions';
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
import { AutocompleteField, useAutocompleteOptions } from '../transactions/TransactionFormComponents';
import { colors } from '../../theme/tokens';

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
          placeholder="Optional"
          keyboardType="decimal-pad"
        />

        <FormSection label="Account">
          <AccountOptionList
            accounts={accounts}
            emptyMessage="Add an account before creating templates."
            selectedAccountId={accountId}
            onSelectAccount={selectAccount}
          />
        </FormSection>

        <ReadonlyField
          label="Currency"
          value={selectedAccount ? currencyCode : 'Select an account'}
          detail={selectedAccount ? 'From selected account' : 'Choose an account before saving.'}
        />

        <FormSection label="Category">
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
            <FormInlineAction label="Clear category" onPress={clearCategory} />
          ) : null}
        </FormSection>

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
    <FormPreviewRow
      color={color}
      icon={icon}
      title={label}
      detail={`${capitalize(kind)} / ${amountLabel}`}
    />
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
