import { getBudgetScopeDetail, getBudgetScopeLabel, normalizeBudgetScopeItems } from '../../domain/budgets';
import type {
  Budget,
  BudgetScopeItem,
  CategoryDefinition,
} from '../../domain/types';

export type BudgetScopeSelectionMode = Extract<Budget['scopeType'], 'include' | 'exclude'>;

export type BudgetScopeParentSelectionState = 'unchecked' | 'partial' | 'checked';

export type BudgetScopeSelectRouteParams = {
  requestId: string;
  mode: BudgetScopeSelectionMode;
  selectedItems: BudgetScopeItem[];
};

export type BudgetScopeSelectLaunchParams = Omit<BudgetScopeSelectRouteParams, 'requestId'>;

export type BudgetScopeFormSummary = {
  detail: string;
  fieldLabel: string;
  title: string;
};

export function getBudgetScopeParentSelectionState(
  scopeItems: BudgetScopeItem[],
  category: CategoryDefinition,
): BudgetScopeParentSelectionState {
  if (hasBudgetScopeParentSelection(scopeItems, category.id)) {
    return 'checked';
  }

  const selectedSubcategoryIds = getSelectedBudgetScopeSubcategoryIds(scopeItems, category.id);
  if (!selectedSubcategoryIds.size) {
    return 'unchecked';
  }

  if (
    category.subcategories.length > 0 &&
    category.subcategories.every((subcategory) => selectedSubcategoryIds.has(subcategory.id))
  ) {
    return 'checked';
  }

  return 'partial';
}

export function isBudgetScopeSubcategorySelected(
  scopeItems: BudgetScopeItem[],
  categoryId: string,
  subcategoryId: string,
): boolean {
  return (
    hasBudgetScopeParentSelection(scopeItems, categoryId) ||
    scopeItems.some((item) => item.categoryId === categoryId && item.subcategoryId === subcategoryId)
  );
}

export function toggleBudgetScopeParentSelection(
  scopeItems: BudgetScopeItem[],
  category: CategoryDefinition,
  categories: CategoryDefinition[],
): BudgetScopeItem[] {
  const categoryState = getBudgetScopeParentSelectionState(scopeItems, category);
  const withoutCategory = scopeItems.filter((item) => item.categoryId !== category.id);

  if (categoryState === 'checked') {
    return normalizeBudgetScopePickerItems(withoutCategory, categories);
  }

  return normalizeBudgetScopePickerItems([
    ...withoutCategory,
    { categoryId: category.id, subcategoryId: null },
  ], categories);
}

export function toggleBudgetScopeSubcategorySelection(
  scopeItems: BudgetScopeItem[],
  category: CategoryDefinition,
  subcategoryId: string,
  categories: CategoryDefinition[],
): BudgetScopeItem[] {
  const selected = isBudgetScopeSubcategorySelected(scopeItems, category.id, subcategoryId);
  const parentSelected = hasBudgetScopeParentSelection(scopeItems, category.id);
  const knownSubcategoryIds = new Set(category.subcategories.map((subcategory) => subcategory.id));
  const otherItems = scopeItems.filter((item) => item.categoryId !== category.id);
  const unknownCategoryItems = scopeItems.filter(
    (item) =>
      item.categoryId === category.id &&
      !!item.subcategoryId &&
      !knownSubcategoryIds.has(item.subcategoryId),
  );

  if (parentSelected) {
    return normalizeBudgetScopePickerItems([
      ...otherItems,
      ...unknownCategoryItems,
      ...category.subcategories
        .filter((subcategory) => subcategory.id !== subcategoryId)
        .map((subcategory) => ({
          categoryId: category.id,
          subcategoryId: subcategory.id,
        })),
    ], categories);
  }

  const retainedCategoryItems = scopeItems.filter(
    (item) =>
      item.categoryId === category.id &&
      item.subcategoryId !== subcategoryId &&
      item.subcategoryId !== null,
  );

  return normalizeBudgetScopePickerItems([
    ...otherItems,
    ...retainedCategoryItems,
    ...(selected ? [] : [{ categoryId: category.id, subcategoryId }]),
  ], categories);
}

export function normalizeBudgetScopePickerItems(
  scopeItems: BudgetScopeItem[],
  categories: CategoryDefinition[],
): BudgetScopeItem[] {
  const normalizedItems = normalizeBudgetScopeItems(scopeItems);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const knownItems: BudgetScopeItem[] = [];
  const unknownItems: BudgetScopeItem[] = [];

  for (const item of normalizedItems) {
    const category = categoryById.get(item.categoryId);
    if (
      !category ||
      (item.subcategoryId && !category.subcategories.some((subcategory) => subcategory.id === item.subcategoryId))
    ) {
      unknownItems.push(item);
      continue;
    }

    knownItems.push(item);
  }

  const collapsedKnownItems = categories.flatMap((category) => {
    const categoryItems = knownItems.filter((item) => item.categoryId === category.id);
    if (categoryItems.some((item) => !item.subcategoryId)) {
      return [{ categoryId: category.id, subcategoryId: null }];
    }

    const selectedSubcategoryIds = new Set(
      categoryItems
        .map((item) => item.subcategoryId)
        .filter((subcategoryId): subcategoryId is string => !!subcategoryId),
    );

    if (
      category.subcategories.length > 0 &&
      category.subcategories.every((subcategory) => selectedSubcategoryIds.has(subcategory.id))
    ) {
      return [{ categoryId: category.id, subcategoryId: null }];
    }

    return categoryItems;
  });

  return normalizeBudgetScopeItems([...collapsedKnownItems, ...unknownItems]);
}

export function getBudgetScopeFormSummary({
  categories,
  currencyCode,
  mode,
  scopeItems,
}: {
  categories: CategoryDefinition[];
  currencyCode: string;
  mode: 'overall' | BudgetScopeSelectionMode;
  scopeItems: BudgetScopeItem[];
}): BudgetScopeFormSummary {
  if (mode === 'overall') {
    return {
      fieldLabel: 'Category scope',
      title: 'Overall monthly spending',
      detail: `Counts all expense categories in ${currencyCode || 'selected currency'}.`,
    };
  }

  const normalizedScopeItems = normalizeBudgetScopePickerItems(scopeItems, categories);
  const primaryScopeItem = normalizedScopeItems[0] ?? null;
  const scopeDraft = {
    scopeType: mode,
    categoryId: primaryScopeItem?.categoryId ?? null,
    subcategoryId: primaryScopeItem?.subcategoryId ?? null,
    scopeItems: normalizedScopeItems,
  };

  return {
    fieldLabel: mode === 'include' ? 'Included categories' : 'Excluded categories',
    title: getBudgetScopeLabel(scopeDraft, categories),
    detail: getBudgetScopeDetail(scopeDraft, categories),
  };
}

function hasBudgetScopeParentSelection(scopeItems: BudgetScopeItem[], categoryId: string): boolean {
  return scopeItems.some((item) => item.categoryId === categoryId && !item.subcategoryId);
}

function getSelectedBudgetScopeSubcategoryIds(
  scopeItems: BudgetScopeItem[],
  categoryId: string,
): Set<string> {
  return new Set(
    scopeItems
      .filter((item) => item.categoryId === categoryId && !!item.subcategoryId)
      .map((item) => item.subcategoryId as string),
  );
}
