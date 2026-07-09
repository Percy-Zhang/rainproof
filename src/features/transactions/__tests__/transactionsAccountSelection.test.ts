import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { CompactAccountSelector } from '../../../components/CompactAccountSelector';
import { getTransactionsInitialSelectedAccountIds } from '../useTransactionsViewModel';
import { shouldKeepTransactionsSearchVisible } from '../transactionsSearchFocus';
import type { Account } from '../../../domain/types';

jest.mock('@expo/vector-icons', () => {
  return { Ionicons: 'Ionicons' };
});

function account(id: string, overrides: Partial<Account> = {}): Account {
  return {
    id,
    name: `Account ${id}`,
    nickname: '',
    type: 'checking',
    currencyCode: 'AUD',
    openingBalanceMinor: 0,
    notes: '',
    institutionName: '',
    includeInRainyDay: true,
    themeColor: '#1876A8',
    iconName: 'business-outline',
    showOnDashboard: true,
    sortOrder: 0,
    isArchived: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('transactions account selection helpers', () => {
  it('keeps the previous all-account default when no dashboard default is provided', () => {
    expect(getTransactionsInitialSelectedAccountIds([account('a1'), account('a2')])).toEqual(['a1', 'a2']);
  });

  it('initializes from dashboard defaults when provided', () => {
    expect(getTransactionsInitialSelectedAccountIds(
      [account('a1'), account('a2'), account('a3')],
      ['a2', 'a3'],
    )).toEqual(['a2', 'a3']);
  });

  it('filters dashboard defaults to accounts that still exist in Transactions', () => {
    expect(getTransactionsInitialSelectedAccountIds(
      [account('a1'), account('a2')],
      ['a2', 'missing'],
    )).toEqual(['a2']);
  });

  it('preserves an explicitly empty dashboard default', () => {
    expect(getTransactionsInitialSelectedAccountIds([account('a1')], [])).toEqual([]);
  });

  it('does not select archived accounts by default', () => {
    expect(getTransactionsInitialSelectedAccountIds([
      account('active'),
      account('closed', { isArchived: true }),
    ])).toEqual(['active']);
  });

  it('keeps the search visible while search is focused, keyboard is visible, or text is active', () => {
    expect(shouldKeepTransactionsSearchVisible({
      keyboardVisible: true,
      searchFocused: true,
      searchQuery: '',
    })).toBe(true);
    expect(shouldKeepTransactionsSearchVisible({
      keyboardVisible: false,
      searchFocused: true,
      searchQuery: '',
    })).toBe(true);
    expect(shouldKeepTransactionsSearchVisible({
      keyboardVisible: true,
      searchFocused: false,
      searchQuery: '',
    })).toBe(true);
    expect(shouldKeepTransactionsSearchVisible({
      keyboardVisible: false,
      searchFocused: false,
      searchQuery: 'coffee',
    })).toBe(true);
    expect(shouldKeepTransactionsSearchVisible({
      keyboardVisible: false,
      searchFocused: false,
      searchQuery: '   ',
    })).toBe(false);
  });
});

describe('CompactAccountSelector immediate selection', () => {
  it('commits account filter changes immediately on valid taps', () => {
    const onSelectedAccountIdsChange = jest.fn();
    const screen = renderAccountSelector({
      selectedAccountIds: [],
      onSelectedAccountIdsChange,
    });

    fireEvent.press(screen.getByTestId('account-selector-a1'));

    expect(onSelectedAccountIdsChange).toHaveBeenCalledWith(['a1']);
  });

  it('calculates rapid taps from the latest intended selection', () => {
    const onSelectedAccountIdsChange = jest.fn();
    const screen = renderAccountSelector({
      selectedAccountIds: [],
      onSelectedAccountIdsChange,
    });

    fireEvent.press(screen.getByTestId('account-selector-a1'));
    fireEvent.press(screen.getByTestId('account-selector-a2'));

    expect(onSelectedAccountIdsChange).toHaveBeenNthCalledWith(1, ['a1']);
    expect(onSelectedAccountIdsChange).toHaveBeenNthCalledWith(2, ['a1', 'a2']);
  });

  it('does not let stale committed props overwrite a newer local intent', () => {
    const onSelectedAccountIdsChange = jest.fn();
    const initialProps = {
      selectedAccountIds: [] as string[],
      onSelectedAccountIdsChange,
    };
    const screen = renderAccountSelector(initialProps);

    fireEvent.press(screen.getByTestId('account-selector-a1'));
    screen.rerender(getAccountSelectorElement(initialProps));

    expect(screen.getByLabelText('Account a1, AUD, selected')).toBeTruthy();

    screen.rerender(getAccountSelectorElement({
      selectedAccountIds: ['a1'],
      onSelectedAccountIdsChange,
    }));

    expect(screen.getByLabelText('Account a1, AUD, selected')).toBeTruthy();
  });

  it('reconciles external selected account changes when no local intent is pending', () => {
    const onSelectedAccountIdsChange = jest.fn();
    const screen = renderAccountSelector({
      selectedAccountIds: [],
      onSelectedAccountIdsChange,
    });

    screen.rerender(getAccountSelectorElement({
      selectedAccountIds: ['a2'],
      onSelectedAccountIdsChange,
    }));

    expect(screen.getByLabelText('Account a2, AUD, selected')).toBeTruthy();
    expect(screen.getByLabelText('Account a1, AUD, not selected')).toBeTruthy();
  });

  it('cancels a press-in preview when movement becomes a scroll gesture', () => {
    const onSelectedAccountIdsChange = jest.fn();
    const screen = renderAccountSelector({
      selectedAccountIds: [],
      onSelectedAccountIdsChange,
    });
    const tile = screen.getByTestId('account-selector-a1');

    fireEvent(tile, 'pressIn', { nativeEvent: { pageX: 0, pageY: 0 } });
    fireEvent(tile, 'touchMove', { nativeEvent: { pageX: 24, pageY: 0 } });
    fireEvent.press(tile);

    expect(onSelectedAccountIdsChange).not.toHaveBeenCalled();
  });
});

function renderAccountSelector({
  selectedAccountIds,
  onSelectedAccountIdsChange,
}: {
  selectedAccountIds: string[];
  onSelectedAccountIdsChange: (accountIds: string[]) => void;
}) {
  return render(getAccountSelectorElement({ selectedAccountIds, onSelectedAccountIdsChange }));
}

function getAccountSelectorElement({
  selectedAccountIds,
  onSelectedAccountIdsChange,
}: {
  selectedAccountIds: string[];
  onSelectedAccountIdsChange: (accountIds: string[]) => void;
}) {
  return React.createElement(CompactAccountSelector, {
    accounts: [account('a1'), account('a2')],
    immediateSelectionFeedback: true,
    mode: 'peek',
    onClearSelection: () => onSelectedAccountIdsChange([]),
    onSelectAll: () => onSelectedAccountIdsChange(['a1', 'a2']),
    onSelectedAccountIdsChange,
    onToggleAccount: (accountId: string) => {
      const nextIds = selectedAccountIds.includes(accountId)
        ? selectedAccountIds.filter((id) => id !== accountId)
        : [...selectedAccountIds, accountId];
      onSelectedAccountIdsChange(nextIds);
    },
    selectedAccountIds,
    testID: 'test-account-selector',
    title: 'Accounts',
  });
}
