import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, BackHandler } from 'react-native';

import { defaultCategories } from '../../../domain/categories';
import type { Account, AppSnapshot, Transaction, TransactionLine } from '../../../domain/types';
import { confirmDiscardUnsavedTransactionChanges } from '../../../navigation/TransactionRouteScreens';
import { EditTransactionScreen } from '../EditTransactionScreen';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

let animationFrames: FrameRequestCallback[];

describe('Edit Transaction local link flow', () => {
  beforeEach(() => {
    animationFrames = [];
    jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('persists an accepted link only with the final transaction edit save', async () => {
    const onUpdateTransaction = jest.fn().mockResolvedValue(undefined);
    const screen = renderEditScreen(onUpdateTransaction);

    await openAndAcceptLink(screen);
    expect(onUpdateTransaction).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('save-edit-transaction'));

    await waitFor(() => expect(onUpdateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'income' }),
      expect.objectContaining({
        optimistic: true,
        transactionLinkBatch: {
          deleteIds: [],
          toUpdate: [],
          toAdd: [expect.objectContaining({
            sourceTransactionId: 'income',
            targetTransactionId: 'expense',
            amountMinor: 5500,
          })],
        },
      }),
    ));
  });

  it('accepts only one Save activation while the first update is pending', async () => {
    let resolveUpdate: (() => void) | undefined;
    const onUpdateTransaction = jest.fn(() => new Promise<void>((resolve) => {
      resolveUpdate = resolve;
    }));
    const onDone = jest.fn();
    const screen = renderEditScreen(onUpdateTransaction, jest.fn(), jest.fn(), onDone);

    await waitFor(() => expect(screen.getByTestId('save-edit-transaction')).toBeTruthy());
    fireEvent.press(screen.getByTestId('save-edit-transaction'));
    fireEvent.press(screen.getByTestId('save-edit-transaction'));

    expect(onUpdateTransaction).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();

    await act(async () => resolveUpdate?.());
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  it('drops accepted editor-local links when the overall edit is cancelled', async () => {
    const onUpdateTransaction = jest.fn().mockResolvedValue(undefined);
    const onCancel = jest.fn();
    const screen = renderEditScreen(onUpdateTransaction, onCancel);

    await openAndAcceptLink(screen);
    fireEvent.press(screen.getByText('Back'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onUpdateTransaction).not.toHaveBeenCalled();
  });

  it('reports meaningful dirty state and clears it when a field is restored', async () => {
    const onDirtyChange = jest.fn();
    const screen = renderEditScreen(jest.fn().mockResolvedValue(undefined), jest.fn(), onDirtyChange);

    await waitFor(() => expect(screen.getByDisplayValue('55.00')).toBeTruthy());
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    fireEvent.changeText(screen.getByDisplayValue('55.00'), '60.00');
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));

    fireEvent.changeText(screen.getByDisplayValue('60.00'), '55');
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });

  it('clears dirty state when an accepted draft link is unlinked before save', async () => {
    const onDirtyChange = jest.fn();
    const screen = renderEditScreen(jest.fn().mockResolvedValue(undefined), jest.fn(), onDirtyChange);
    const alertSpy = jest.spyOn(Alert, 'alert');

    await openAndAcceptLink(screen);
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));

    fireEvent.press(screen.getByTestId('open-transaction-link'));
    fireEvent.press(screen.getByText('Unlink'));
    const confirm = alertSpy.mock.calls[0][2]?.find((button) => button.text === 'Unlink');
    act(() => confirm?.onPress?.());
    fireEvent.press(screen.getByText('Back'));

    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });

  it('keeps editing on cancel and discards only after confirmation', () => {
    const onDiscard = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert');

    confirmDiscardUnsavedTransactionChanges(onDiscard);
    const buttons = alertSpy.mock.calls[0][2] ?? [];
    act(() => buttons.find((button) => button.text === 'Keep editing')?.onPress?.());
    expect(onDiscard).not.toHaveBeenCalled();

    act(() => buttons.find((button) => button.text === 'Discard')?.onPress?.());
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('routes visible and Android hardware Back through the guarded exit callback', async () => {
    const onCancel = jest.fn();
    let hardwareBack: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_eventName, handler) => {
      hardwareBack = handler;
      return { remove: jest.fn() };
    });
    const screen = renderEditScreen(jest.fn().mockResolvedValue(undefined), onCancel);

    await waitFor(() => expect(screen.getByDisplayValue('55.00')).toBeTruthy());
    fireEvent.press(screen.getByText('Back'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    act(() => expect(hardwareBack?.({} as never)).toBe(true));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});

async function openAndAcceptLink(screen: ReturnType<typeof render>) {
  await waitFor(() => expect(screen.getByTestId('open-transaction-link')).toBeTruthy());
  fireEvent.press(screen.getByTestId('open-transaction-link'));
  fireEvent.press(screen.getByText('Link'));
  flushAnimationFrames();
  fireEvent.press(screen.getByText('Dinner with friends'));
  fireEvent.press(screen.getByRole('button', { name: 'Link' }));
  fireEvent.press(screen.getByText('Back'));
  await waitFor(() => expect(screen.getByTestId('save-edit-transaction')).toBeTruthy());
}

function flushAnimationFrames() {
  act(() => {
    while (animationFrames.length) {
      const current = animationFrames.splice(0);
      current.forEach((callback) => callback(0));
    }
  });
}

function renderEditScreen(
  onUpdateTransaction: jest.Mock,
  onCancel: jest.Mock = jest.fn(),
  onDirtyChange: jest.Mock = jest.fn(),
  onDone: jest.Mock = jest.fn(),
) {
  return render(React.createElement(EditTransactionScreen, {
    snapshot: makeSnapshot(),
    transactionId: 'income',
    onUpdateTransaction,
    onDeleteTransaction: jest.fn().mockResolvedValue(undefined),
    onOpenCategorySelect: jest.fn(),
    onCancel,
    onDirtyChange,
    onDone,
  }));
}

function makeSnapshot(): AppSnapshot {
  const now = '2026-07-12T10:00:00.000Z';
  return {
    defaultCurrencyCode: 'AUD',
    settings: {
      defaultCurrencyCode: 'AUD',
      defaultCurrencyMode: 'manual',
      multiCurrencyEnabled: false,
      enabledCurrencyCodes: ['AUD'],
      dashboardSelectedAccountIds: null,
    },
    categories: defaultCategories,
    accounts: [account()],
    transactions: [
      transaction('income', 'income', 'Alice payment', now),
      transaction('expense', 'expense', 'Dinner with friends', now),
    ],
    transactionLines: [
      line('income-line', 'income', 5500),
      line('expense-line', 'expense', -5500),
    ],
    transactionLinks: [],
    budgets: [],
    recurringItems: [],
    recurringBills: [],
    transactionTemplates: [],
    rainyDayFund: {
      id: 'fund',
      name: 'Rainy Day Fund',
      currencyCode: 'AUD',
      goalMinor: 0,
      linkedAccountIds: [],
      createdAt: now,
      updatedAt: now,
    },
  };
}

function account(): Account {
  return {
    id: 'everyday',
    name: 'Everyday',
    nickname: '',
    type: 'checking',
    currencyCode: 'AUD',
    openingBalanceMinor: 0,
    notes: '',
    institutionName: '',
    includeInRainyDay: true,
    themeColor: '',
    iconName: '',
    showOnDashboard: true,
    sortOrder: 0,
    isArchived: false,
    createdAt: '',
    updatedAt: '',
  };
}

function transaction(id: string, kind: Transaction['kind'], title: string, datetime: string): Transaction {
  return { id, kind, title, datetime, notes: '', labels: [], groupId: '', createdAt: datetime, updatedAt: datetime };
}

function line(id: string, transactionId: string, amountMinor: number): TransactionLine {
  return {
    id,
    transactionId,
    accountId: 'everyday',
    amountMinor,
    currencyCode: 'AUD',
    categoryId: amountMinor > 0 ? 'income' : 'food-dining',
    subcategoryId: amountMinor > 0 ? 'reimbursement' : 'restaurants',
    externalParty: '',
    transferPeerAccountId: '',
    note: '',
    createdAt: '',
  };
}
