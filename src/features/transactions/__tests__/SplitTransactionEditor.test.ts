import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { defaultCategories } from '../../../domain/categories';
import type { SplitTransactionFormLine } from '../../../domain/splitTransactionForm';
import type { ScopedTransactionLinkAllocationStatus } from '../../../domain/transactionLinkAllocationStatus';
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

  it('exposes mixed split mode and line-kind controls when enabled', () => {
    const onChangeSplitMode = jest.fn();
    const onChangeLineKind = jest.fn();
    const screen = renderEditor({
      parentKind: 'income',
      splitMode: 'mixed',
      lines: [
        line({ id: 'line-1', kind: 'income', amount: '23.00', categoryId: 'income', subcategoryId: 'salary' }),
        line({ id: 'line-2', kind: 'expense', amount: '6.00' }),
      ],
      totalMinor: 1700,
      onChangeSplitMode,
      onChangeLineKind,
    });

    fireEvent.press(screen.getByTestId('split-mode-standard'));
    fireEvent.press(screen.getByTestId('split-line-1-kind-expense'));

    expect(onChangeSplitMode).toHaveBeenCalledWith('standard');
    expect(onChangeLineKind).toHaveBeenCalledWith('line-1', 'expense');
    expect(screen.getByText('Parent net')).toBeTruthy();
    expect(screen.getByText('Difference')).toBeTruthy();
  });

  it('shows whole-scope allocation separately from direct split-line allocation', () => {
    const lineStatus = allocationStatus({
      scope: 'line',
      lineId: 'line-1',
      originalMinor: 1500,
      allocatedMinor: 500,
      directAllocatedMinor: 500,
      remainingMinor: 1000,
      wholeScopeAllocatedMinor: 700,
    });
    const screen = renderEditor({
      allocationStatusByLineId: new Map([['line-1', lineStatus]]),
      wholeAllocationStatus: allocationStatus({
        wholeScopeAllocatedMinor: 700,
        allocatedMinor: 1200,
        parentAllocatedMinor: 1200,
        parentRemainingMinor: 1800,
        remainingMinor: 1800,
      }),
    });

    expect(screen.getByText('Whole transaction')).toBeTruthy();
    expect(screen.getByText('Linked $5.00 · $10.00 left')).toBeTruthy();
    expect(screen.queryByText('Linked $12.00')).toBeNull();
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

function allocationStatus(
  overrides: Partial<ScopedTransactionLinkAllocationStatus> = {},
): ScopedTransactionLinkAllocationStatus {
  return {
    scope: 'transaction',
    side: 'target',
    transactionId: 'transaction',
    lineId: null,
    currencyCode: 'AUD',
    originalMinor: 3000,
    allocatedMinor: 0,
    remainingMinor: 3000,
    directAllocatedMinor: 0,
    directRemainingMinor: 3000,
    wholeScopeAllocatedMinor: 0,
    otherLineAllocatedMinor: 0,
    parentAllocatedMinor: 0,
    parentRemainingMinor: 3000,
    linkCount: 0,
    wholeScopeLinkCount: 0,
    parentLinkCount: 0,
    overAllocatedMinor: 0,
    parentOverAllocatedMinor: 0,
    invalidLinkCount: 0,
    invalidDraftChangeCount: 0,
    scopeExists: true,
    status: 'unlinked',
    ...overrides,
  };
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
