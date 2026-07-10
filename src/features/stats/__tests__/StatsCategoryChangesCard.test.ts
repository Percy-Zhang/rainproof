import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';

import type { StatsCategoryChangeRow } from '../../../domain/statsCategoryChanges';
import { StatsCategoryChangesCard } from '../StatsCategoryChangesCard';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('StatsCategoryChangesCard', () => {
  it('renders compact comparison rows inside one shared card', () => {
    const screen = renderCategoryChangesCard();
    const cards = screen.getAllByTestId('stats-category-changes-card');
    const card = within(cards[0]);

    expect(cards).toHaveLength(1);
    expect(card.getByTestId('stats-category-change-food')).toBeTruthy();
    expect(card.getByTestId('stats-category-change-shopping')).toBeTruthy();
    expect(card.getByTestId('stats-category-change-income')).toBeTruthy();
    expect(card.queryByText('Change')).toBeNull();
    expect(card.queryByTestId('stats-category-change-current-food')).toBeNull();
    expect(card.queryByText('$50.00')).toBeNull();
    expect(card.getByTestId('stats-category-change-amount-food').props.children).toBe('+$20.00');
    expect(card.getByTestId('stats-category-change-percent-food').props.children).toBe('+66.7%');
    expect(card.getByTestId('stats-category-change-amount-shopping').props.children).toBe('-$40.00');
    expect(card.getByTestId('stats-category-change-percent-shopping').props.children).toBe('-100%');
    expect(card.queryByTestId('stats-category-change-percent-income')).toBeNull();
  });

  it('keeps category rows tappable through the existing callback', () => {
    const onOpenCategory = jest.fn();
    const screen = renderCategoryChangesCard(onOpenCategory);

    fireEvent.press(screen.getByTestId('stats-category-change-shopping'));

    expect(onOpenCategory).toHaveBeenCalledWith('shopping');
  });
});

function renderCategoryChangesCard(onOpenCategory = jest.fn()) {
  return render(React.createElement(StatsCategoryChangesCard, {
    currencyCode: 'AUD',
    onOpenCategory,
    reportKind: 'expense',
    rows,
  }));
}

const rows: StatsCategoryChangeRow[] = [
  categoryChange({
    categoryId: 'shopping',
    categoryName: 'Shopping',
    currentMinor: 0,
    previousMinor: 4000,
    changeMinor: -4000,
    percentageChange: -100,
    direction: 'decrease',
  }),
  categoryChange({
    categoryId: 'food',
    categoryName: 'Food & Dining',
    currentMinor: 5000,
    previousMinor: 3000,
    changeMinor: 2000,
    percentageChange: 66.6667,
    direction: 'increase',
  }),
  categoryChange({
    categoryId: 'income',
    categoryName: 'Income',
    currentMinor: 1000,
    previousMinor: 0,
    changeMinor: 1000,
    percentageChange: null,
    direction: 'increase',
  }),
];

function categoryChange(
  overrides: Partial<StatsCategoryChangeRow> & Pick<StatsCategoryChangeRow, 'categoryId' | 'categoryName'>,
): StatsCategoryChangeRow {
  return {
    categoryColor: '#1876A8',
    categoryIcon: 'pricetag-outline',
    currentMinor: 0,
    previousMinor: 0,
    changeMinor: 0,
    percentageChange: 0,
    direction: 'unchanged',
    ...overrides,
  };
}
