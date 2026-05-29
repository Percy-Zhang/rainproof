import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { defaultCategories } from '../../../domain/categories';
import type { SplitTransactionFormLine } from '../../../domain/splitTransactionForm';
import { SplitTransactionEditor } from '../SplitTransactionEditor';

jest.mock('@expo/vector-icons', () => {
  return { Ionicons: 'Ionicons' };
});

describe('SplitTransactionEditor', () => {
  it('selects item-name suggestions for only the focused split line', () => {
    const onUpdateLine = jest.fn();
    const screen = renderEditor({
      lines: [
        line({ id: 'line-1', note: 'fu' }),
        line({ id: 'line-2', note: 'co' }),
      ],
      onUpdateLine,
    });

    fireEvent.press(screen.getByText('Coffee'));

    expect(onUpdateLine).toHaveBeenCalledWith('line-2', { note: 'Coffee' });
    expect(onUpdateLine).not.toHaveBeenCalledWith('line-1', { note: 'Coffee' });
  });

  it('keeps add and remove split-line actions wired after layout changes', () => {
    const onAddLine = jest.fn();
    const onRemoveLine = jest.fn();
    const screen = renderEditor({ onAddLine, onRemoveLine });

    fireEvent.press(screen.getByTestId('add-split-line'));
    fireEvent.press(screen.getByLabelText('Remove split line 1'));

    expect(onAddLine).toHaveBeenCalledTimes(1);
    expect(onRemoveLine).toHaveBeenCalledWith('line-1');
  });
});

function renderEditor(overrides: Partial<React.ComponentProps<typeof SplitTransactionEditor>> = {}) {
  const props: React.ComponentProps<typeof SplitTransactionEditor> = {
    categories: defaultCategories,
    currencyCode: 'AUD',
    itemNameSuggestions: ['Coffee', 'Fuel', 'Groceries'],
    lines: [line({ id: 'line-1' }), line({ id: 'line-2' })],
    showCurrencyCodes: false,
    totalMinor: 3000,
    onAddLine: jest.fn(),
    onPickCategory: jest.fn(),
    onRemoveLine: jest.fn(),
    onUpdateLine: jest.fn(),
    ...overrides,
  };

  return render(React.createElement(SplitTransactionEditor, props));
}

function line(overrides: Partial<SplitTransactionFormLine>): SplitTransactionFormLine {
  return {
    id: 'line-1',
    amount: '15.00',
    categoryId: 'food',
    subcategoryId: 'groceries',
    note: '',
    ...overrides,
  };
}
