import type { CategoryDefinition, TransactionKind } from '../../domain/types';

export type CategorySelectionKind = Extract<TransactionKind, 'income' | 'expense'>;

export type CategorySelectionMode = 'category' | 'subcategory';

export type CategorySelectionResult = {
  categoryId: string;
  subcategoryId: string | null;
};

export type CategorySelectRouteParams = {
  requestId: string;
  kind: CategorySelectionKind;
  selectedCategoryId?: string;
  selectedSubcategoryId?: string | null;
  selectionMode: CategorySelectionMode;
  title?: string;
  showSuggestions?: boolean;
};

export type CategorySelectLaunchParams = Omit<CategorySelectRouteParams, 'requestId'>;

export function getCategorySelectionCategories(
  categories: CategoryDefinition[],
  kind: CategorySelectionKind,
): CategoryDefinition[] {
  return categories.filter((category) => category.type === kind);
}

export function createCategoryOnlySelection(categoryId: string): CategorySelectionResult {
  return {
    categoryId,
    subcategoryId: null,
  };
}

export function createSubcategorySelection(categoryId: string, subcategoryId: string): CategorySelectionResult {
  return {
    categoryId,
    subcategoryId,
  };
}

export function getInitialExpandedCategoryId({
  categories,
  kind,
  selectedCategoryId,
}: {
  categories: CategoryDefinition[];
  kind: CategorySelectionKind;
  selectedCategoryId?: string;
}): string {
  const options = getCategorySelectionCategories(categories, kind);
  return options.find((category) => category.id === selectedCategoryId)?.id ?? options[0]?.id ?? '';
}
