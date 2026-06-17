import { useCallback, useState } from 'react';

import type { TransactionPickerMode } from './TransactionFormComponents';

export type TransactionAccountPickerMode = Extract<
  TransactionPickerMode,
  'sourceAccount' | 'targetAccount'
>;

type UseTransactionAccountPickerRoutingOptions = {
  onSelectSourceAccount: (accountId: string) => void;
  onSelectTargetAccount: (accountId: string) => void;
};

export function useTransactionAccountPickerRouting({
  onSelectSourceAccount,
  onSelectTargetAccount,
}: UseTransactionAccountPickerRoutingOptions) {
  const [pickerMode, setPickerMode] = useState<TransactionAccountPickerMode | null>(null);

  const closePicker = useCallback(() => {
    setPickerMode(null);
  }, []);

  const openSourceAccountPicker = useCallback(() => {
    setPickerMode('sourceAccount');
  }, []);

  const openTargetAccountPicker = useCallback(() => {
    setPickerMode('targetAccount');
  }, []);

  const selectPickerAccount = useCallback((accountId: string) => {
    if (pickerMode === 'targetAccount') {
      onSelectTargetAccount(accountId);
    } else {
      onSelectSourceAccount(accountId);
    }
    setPickerMode(null);
  }, [onSelectSourceAccount, onSelectTargetAccount, pickerMode]);

  return {
    closePicker,
    openSourceAccountPicker,
    openTargetAccountPicker,
    pickerMode,
    selectPickerAccount,
  };
}
