import { defaultCategories } from '../../../domain/categories';
import type { BudgetScopeItem } from '../../../domain/types';
import {
  getBudgetScopeFormSummary,
  getBudgetScopeParentSelectionState,
  isBudgetScopeSubcategorySelected,
  normalizeBudgetScopePickerItems,
  toggleBudgetScopeParentSelection,
  toggleBudgetScopeSubcategorySelection,
} from '../budgetScopeSelectionModel';

const expenseCategories = defaultCategories.filter((category) => category.type === 'expense');
const food = expenseCategories.find((category) => category.id === 'food')!;

describe('budgetScopeSelectionModel', () => {
  it('reports unchecked, partial, and checked parent states', () => {
    expect(getBudgetScopeParentSelectionState([], food)).toBe('unchecked');
    expect(getBudgetScopeParentSelectionState([
      scopeItem('food', 'groceries'),
    ], food)).toBe('partial');
    expect(getBudgetScopeParentSelectionState([
      scopeItem('food'),
    ], food)).toBe('checked');
  });

  it('toggles a parent as one whole-category selection', () => {
    const selected = toggleBudgetScopeParentSelection([], food, expenseCategories);

    expect(selected).toEqual([scopeItem('food')]);
    expect(food.subcategories.every((subcategory) =>
      isBudgetScopeSubcategorySelected(selected, food.id, subcategory.id))).toBe(true);
    expect(toggleBudgetScopeParentSelection(selected, food, expenseCategories)).toEqual([]);
  });

  it('turns a selected parent into a partial child selection when one child is cleared', () => {
    const selected = toggleBudgetScopeSubcategorySelection(
      [scopeItem('food')],
      food,
      'groceries',
      expenseCategories,
    );

    expect(getBudgetScopeParentSelectionState(selected, food)).toBe('partial');
    expect(isBudgetScopeSubcategorySelected(selected, 'food', 'groceries')).toBe(false);
    expect(isBudgetScopeSubcategorySelected(selected, 'food', 'restaurants')).toBe(true);
  });

  it('collapses all explicitly selected children to their parent selection', () => {
    const allChildren = food.subcategories.map((subcategory) =>
      scopeItem(food.id, subcategory.id));

    expect(normalizeBudgetScopePickerItems(allChildren, expenseCategories)).toEqual([
      scopeItem('food'),
    ]);
  });

  it('builds compact overall, include, and exclude form summaries', () => {
    expect(getBudgetScopeFormSummary({
      categories: expenseCategories,
      currencyCode: 'AUD',
      mode: 'overall',
      scopeItems: [],
    })).toEqual({
      detail: 'Counts all expense categories in AUD.',
      fieldLabel: 'Category scope',
      title: 'Overall monthly spending',
    });

    expect(getBudgetScopeFormSummary({
      categories: expenseCategories,
      currencyCode: 'AUD',
      mode: 'include',
      scopeItems: [scopeItem('food', 'groceries')],
    })).toMatchObject({
      fieldLabel: 'Included categories',
      title: 'Groceries',
    });

    expect(getBudgetScopeFormSummary({
      categories: expenseCategories,
      currencyCode: 'AUD',
      mode: 'exclude',
      scopeItems: [scopeItem('food')],
    })).toMatchObject({
      detail: 'All spending except selected',
      fieldLabel: 'Excluded categories',
      title: 'Excludes Food & Dining',
    });
  });
});

function scopeItem(categoryId: string, subcategoryId: string | null = null): BudgetScopeItem {
  return { categoryId, subcategoryId };
}
