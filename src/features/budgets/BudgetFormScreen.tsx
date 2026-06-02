import { useMemo, useState } from 'react';

import { CurrencyDropdown } from '../../components/CurrencyDropdown';
import { ActionButton, Chip, FormError, TextField } from '../../components/ui';
import {
  FormChipRow,
  FormDangerZone,
  FormHelperText,
  FormPreviewRow,
  FormScreenShell,
  FormSection,
  KeyboardAwareFormScroll,
} from '../../components/FormLayout';
import { formatOptionalMoneyInput } from '../../domain/accountForm';
import {
  defaultCategories,
  getCategory,
  getDefaultSubcategoryId,
  getSubcategory,
  getSubcategoryColor,
  getSubcategoryIcon,
  getSubcategoryName,
} from '../../domain/categories';
import { getBudgetCurrencyOptions } from '../../domain/budgets';
import { parseMoneyInput } from '../../domain/money';
import type {
  AppSnapshot,
  Budget,
  BudgetScopeType,
  NewBudgetInput,
  UpdateBudgetInput,
} from '../../domain/types';
import type {
  CategorySelectLaunchParams,
  CategorySelectionResult,
} from '../categorySelection/categorySelectionModel';
import { CategorySelectionField } from '../categorySelection/CategorySelectionField';
import { colors } from '../../theme/tokens';

type BudgetFormScreenProps =
  | {
      mode: 'add';
      snapshot: AppSnapshot;
      onAddBudget: (input: NewBudgetInput) => Promise<void>;
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
      budget: Budget;
      onUpdateBudget: (input: UpdateBudgetInput) => Promise<void>;
      onArchiveBudget: (budgetId: string) => Promise<void>;
      onOpenCategorySelect: (
        params: CategorySelectLaunchParams,
        onSelect: (selection: CategorySelectionResult) => void,
      ) => void;
      onCancel: () => void;
      onDone: () => void;
    };

const scopeOptions: { value: BudgetScopeType; label: string }[] = [
  { value: 'overall', label: 'Overall' },
  { value: 'category', label: 'Category' },
  { value: 'subcategory', label: 'Subcategory' },
];

export function BudgetFormScreen(props: BudgetFormScreenProps) {
  const { mode, snapshot, onCancel, onDone } = props;
  const categories = useMemo(
    () => (snapshot.categories ?? defaultCategories).filter((category) => category.type === 'expense'),
    [snapshot.categories],
  );
  const firstCategory = categories[0];
  const editingBudget = mode === 'edit' ? props.budget : null;
  const initialCategoryId = editingBudget?.categoryId ?? firstCategory?.id ?? 'food';
  const initialCategory = getCategory(initialCategoryId, categories);
  const initialSubcategoryId = editingBudget?.subcategoryId ?? getDefaultSubcategoryId(initialCategory);
  const currencyOptions = useMemo(
    () => getBudgetCurrencyOptions({
      accounts: snapshot.accounts,
      currentBudgetCurrencyCode: editingBudget?.currencyCode,
    }),
    [editingBudget?.currencyCode, snapshot.accounts],
  );
  const [name, setName] = useState(editingBudget?.name ?? '');
  const [amount, setAmount] = useState(formatOptionalMoneyInput(editingBudget?.amountMinor));
  const [currencyCode, setCurrencyCode] = useState(editingBudget?.currencyCode ?? currencyOptions[0]?.code ?? '');
  const [scopeType, setScopeType] = useState<BudgetScopeType>(editingBudget?.scopeType ?? 'overall');
  const [categoryId, setCategoryId] = useState(initialCategory.id);
  const [subcategoryId, setSubcategoryId] = useState(initialSubcategoryId);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [error, setError] = useState('');
  const selectedCategory = getCategory(categoryId, categories);

  function setSelectedScope(nextScopeType: BudgetScopeType) {
    setScopeType(nextScopeType);
    setConfirmArchive(false);
  }

  function openCategorySelect() {
    if (scopeType === 'overall') {
      return;
    }

    props.onOpenCategorySelect(
      {
        kind: 'expense',
        selectedCategoryId: categoryId,
        selectedSubcategoryId: scopeType === 'subcategory' ? subcategoryId : null,
        selectionMode: scopeType === 'category' ? 'category' : 'subcategory',
        showSuggestions: false,
        title: scopeType === 'category' ? 'Budget category' : 'Budget subcategory',
      },
      ({ categoryId: nextCategoryId, subcategoryId: nextSubcategoryId }) => {
        const nextCategory = getCategory(nextCategoryId, categories);
        setCategoryId(nextCategory.id);
        setSubcategoryId(nextSubcategoryId ?? getDefaultSubcategoryId(nextCategory));
      },
    );
  }

  async function submit() {
    try {
      const amountMinor = parseMoneyInput(amount);
      if (amountMinor <= 0) {
        throw new Error('Budget amount must be greater than zero.');
      }

      const input = buildBudgetInput(amountMinor);
      if (mode === 'add') {
        await props.onAddBudget(input);
      } else {
        await props.onUpdateBudget({ id: props.budget.id, ...input });
      }

      setError('');
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save budget.');
    }
  }

  async function archiveBudget() {
    if (mode !== 'edit') {
      return;
    }

    if (!confirmArchive) {
      setConfirmArchive(true);
      return;
    }

    try {
      await props.onArchiveBudget(props.budget.id);
      setError('');
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not archive budget.');
    }
  }

  function buildBudgetInput(amountMinor: number): NewBudgetInput {
    const categoryForInput = scopeType === 'overall' ? null : categoryId;
    const subcategoryForInput = scopeType === 'subcategory' ? subcategoryId : null;

    return {
      name: name.trim() || getFallbackBudgetName(scopeType, selectedCategory, subcategoryForInput, categories),
      amountMinor,
      currencyCode,
      period: 'monthly',
      scopeType,
      categoryId: categoryForInput,
      subcategoryId: subcategoryForInput,
      isActive: true,
    };
  }

  return (
    <FormScreenShell
      title={mode === 'add' ? 'Add budget' : 'Edit budget'}
      onBack={onCancel}
      onSave={submit}
      saveTestID={mode === 'add' ? 'save-new-budget' : 'save-budget'}
    >
      <KeyboardAwareFormScroll>
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder={getFallbackBudgetName(scopeType, selectedCategory, subcategoryId, categories)}
        />
        <TextField
          label="Monthly limit"
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
        <CurrencyDropdown
          label="Currency"
          value={currencyCode}
          options={currencyOptions}
          onChange={setCurrencyCode}
          testID="budget-currency-dropdown"
        />

        <FormSection label="Scope">
          <FormChipRow>
            {scopeOptions.map((option) => (
              <Chip
                key={option.value}
                selected={scopeType === option.value}
                onPress={() => setSelectedScope(option.value)}
                testID={`budget-scope-${option.value}`}
              >
                {option.label}
              </Chip>
            ))}
          </FormChipRow>
          <FormHelperText>Budgets are monthly calendar limits in v1.</FormHelperText>
        </FormSection>

        {scopeType !== 'overall' ? (
          <FormSection label="Category">
            <CategorySelectionField
              label={scopeType === 'subcategory' ? 'Subcategory' : 'Category'}
              value={getBudgetCategorySelectionLabel(scopeType, selectedCategory, subcategoryId, categories)}
              onPress={openCategorySelect}
              color={getSubcategoryColor(selectedCategory.id, subcategoryId, categories)}
              icon={getSubcategoryIcon(selectedCategory.id, subcategoryId, categories)}
              iconColor={getSubcategoryColor(selectedCategory.id, subcategoryId, categories)}
            />
          </FormSection>
        ) : (
          <FormPreviewRow
            color={colors.primary}
            icon="wallet-outline"
            title="Overall monthly spending"
            detail={`Counts all expense categories in ${currencyCode || 'selected currency'}.`}
          />
        )}

        <FormError message={error} />

        {mode === 'edit' ? (
          <FormDangerZone
            label="Budget status"
            warning={confirmArchive ? 'Archived budgets disappear from the active budget list.' : undefined}
          >
            <ActionButton variant="danger" onPress={archiveBudget} testID="archive-budget">
              {confirmArchive ? 'Confirm archive' : 'Archive budget'}
            </ActionButton>
          </FormDangerZone>
        ) : null}
      </KeyboardAwareFormScroll>
    </FormScreenShell>
  );
}

function getBudgetCategorySelectionLabel(
  scopeType: BudgetScopeType,
  category: ReturnType<typeof getCategory>,
  subcategoryId: string | null,
  categories = defaultCategories,
): string {
  if (scopeType === 'subcategory') {
    return `${category.name} / ${getSubcategoryName(category.id, subcategoryId ?? '', categories)}`;
  }

  return category.name;
}

function getFallbackBudgetName(
  scopeType: BudgetScopeType,
  category: ReturnType<typeof getCategory>,
  subcategoryId: string | null,
  categories = defaultCategories,
): string {
  if (scopeType === 'overall') {
    return 'Overall spending';
  }

  if (scopeType === 'subcategory') {
    const subcategory = getSubcategory(category.id, subcategoryId ?? '', categories);
    return `${subcategory?.name ?? 'Subcategory'} budget`;
  }

  return `${category.name} budget`;
}
