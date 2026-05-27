import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { CurrencyDropdown } from '../../components/CurrencyDropdown';
import { ActionButton, Chip, FormError, TextField } from '../../components/ui';
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
import { getCurrencyOptions } from '../../domain/currencyCatalog';
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
import { colors, spacing, typography } from '../../theme/tokens';

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

const currencyOptions = getCurrencyOptions();
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
  const [name, setName] = useState(editingBudget?.name ?? '');
  const [amount, setAmount] = useState(formatOptionalMoneyInput(editingBudget?.amountMinor));
  const [currencyCode, setCurrencyCode] = useState(editingBudget?.currencyCode ?? snapshot.defaultCurrencyCode);
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
    <View style={styles.shell}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primaryDark} />
        </Pressable>
        <Text style={styles.title}>{mode === 'add' ? 'Add budget' : 'Edit budget'}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={submit}
          style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}
          testID={mode === 'add' ? 'save-new-budget' : 'save-budget'}
        >
          <Text style={styles.confirmText}>Save</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Scope</Text>
          <View style={styles.wrap}>
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
          </View>
          <Text style={styles.hint}>Budgets are monthly calendar limits in v1.</Text>
        </View>

        {scopeType !== 'overall' ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Category</Text>
            <CategorySelectionField
              label={scopeType === 'subcategory' ? 'Subcategory' : 'Category'}
              value={getBudgetCategorySelectionLabel(scopeType, selectedCategory, subcategoryId, categories)}
              onPress={openCategorySelect}
              color={getSubcategoryColor(selectedCategory.id, subcategoryId, categories)}
              icon={getSubcategoryIcon(selectedCategory.id, subcategoryId, categories)}
              iconColor={getSubcategoryColor(selectedCategory.id, subcategoryId, categories)}
            />
          </View>
        ) : (
          <View style={styles.overallPreview}>
            <CategoryIconBadge color={colors.primary} icon="wallet-outline" size="md" />
            <View style={styles.previewText}>
              <Text style={styles.previewTitle}>Overall monthly spending</Text>
              <Text style={styles.hint}>Counts all expense categories in {currencyCode}.</Text>
            </View>
          </View>
        )}

        <FormError message={error} />

        {mode === 'edit' ? (
          <View style={styles.dangerZone}>
            <Text style={styles.label}>Budget status</Text>
            <ActionButton variant="danger" onPress={archiveBudget} testID="archive-budget">
              {confirmArchive ? 'Confirm archive' : 'Archive budget'}
            </ActionButton>
            {confirmArchive ? (
              <Text style={styles.warningText}>Archived budgets disappear from the active budget list.</Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
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
  label: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  hint: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
  },
  categoryList: {
    gap: spacing.sm,
  },
  overallPreview: {
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
