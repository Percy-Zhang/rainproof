import { defaultCategories } from '../../../domain/categories';
import {
  createCategoryOnlySelection,
  createSubcategorySelection,
  getCategorySelectionCategories,
  getInitialExpandedCategoryId,
} from '../categorySelectionModel';

describe('categorySelectionModel', () => {
  it('filters categories by income and expense kind', () => {
    expect(getCategorySelectionCategories(defaultCategories, 'income').every((category) => category.type === 'income')).toBe(true);
    expect(getCategorySelectionCategories(defaultCategories, 'expense').every((category) => category.type === 'expense')).toBe(true);
  });

  it('creates category-only and subcategory selections', () => {
    expect(createCategoryOnlySelection('food')).toEqual({ categoryId: 'food', subcategoryId: null });
    expect(createSubcategorySelection('food', 'groceries')).toEqual({ categoryId: 'food', subcategoryId: 'groceries' });
  });

  it('uses selected category as initial expanded category when available', () => {
    expect(getInitialExpandedCategoryId({
      categories: defaultCategories,
      kind: 'expense',
      selectedCategoryId: 'transport',
    })).toBe('transport');
  });

  it('falls back to the first matching category when selected category is missing', () => {
    expect(getInitialExpandedCategoryId({
      categories: defaultCategories,
      kind: 'income',
      selectedCategoryId: 'missing',
    })).toBe('income');
  });
});
