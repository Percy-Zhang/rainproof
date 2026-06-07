import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { defaultCategories } from '../../../domain/categories';
import { BudgetScopeSelectScreen } from '../BudgetScopeSelectScreen';

jest.mock('@expo/vector-icons', () => {
  return { Ionicons: 'Ionicons' };
});

const categories = defaultCategories.filter((category) => category.id === 'food');

describe('BudgetScopeSelectScreen', () => {
  it('opens with existing selections and applies only the confirmed draft', () => {
    const onConfirm = jest.fn();
    const screen = render(React.createElement(BudgetScopeSelectScreen, {
      categories,
      mode: 'include',
      selectedItems: [{ categoryId: 'food', subcategoryId: 'groceries' }],
      onBack: jest.fn(),
      onConfirm,
    }));

    expect(
      screen.getByTestId('budget-scope-category-food').props.accessibilityState.checked,
    ).toBe('mixed');
    expect(
      screen.getByTestId('budget-scope-subcategory-food-groceries').props.accessibilityState.checked,
    ).toBe(true);

    fireEvent.press(screen.getByTestId('budget-scope-subcategory-food-restaurants'));

    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('confirm-budget-scope-select'));

    expect(onConfirm).toHaveBeenCalledWith([
      { categoryId: 'food', subcategoryId: 'groceries' },
      { categoryId: 'food', subcategoryId: 'restaurants' },
    ]);
  });

  it('backs out without confirming draft changes', () => {
    const onBack = jest.fn();
    const onConfirm = jest.fn();
    const screen = render(React.createElement(BudgetScopeSelectScreen, {
      categories,
      mode: 'exclude',
      selectedItems: [{ categoryId: 'food', subcategoryId: null }],
      onBack,
      onConfirm,
    }));

    fireEvent.press(screen.getByTestId('budget-scope-category-food'));
    fireEvent.press(screen.getByTestId('cancel-budget-scope-select'));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
