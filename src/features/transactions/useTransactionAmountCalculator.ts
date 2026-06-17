import { useState } from 'react';

import {
  applyCalculatorAmountKey,
  getInitialCalculatorAmountInputState,
  type CalculatorKey,
} from '../../domain/calculator';

export type TransferAmountField = 'source' | 'target';

type UseTransactionAmountCalculatorOptions = {
  initialAmountExpression: string;
  initialTargetAmountExpression?: string;
  isCrossCurrencyTransfer: boolean;
  onError: (message: string) => void;
};

export function useTransactionAmountCalculator({
  initialAmountExpression,
  initialTargetAmountExpression = '',
  isCrossCurrencyTransfer,
  onError,
}: UseTransactionAmountCalculatorOptions) {
  const [initialAmountInputState] = useState(() =>
    getInitialCalculatorAmountInputState(initialAmountExpression),
  );
  const [amountInputState, setAmountInputState] = useState(initialAmountInputState);
  const [targetAmountInputState, setTargetAmountInputState] = useState(() =>
    getInitialCalculatorAmountInputState(initialTargetAmountExpression),
  );
  const [activeTransferAmountField, setActiveTransferAmountField] =
    useState<TransferAmountField>('source');

  function pressCalculatorKey(key: CalculatorKey) {
    onError('');
    const editsTargetAmount = isCrossCurrencyTransfer && activeTransferAmountField === 'target';

    if (editsTargetAmount) {
      if (key !== '=') {
        setTargetAmountInputState((current) => applyCalculatorAmountKey(current, key));
        return;
      }

      try {
        setTargetAmountInputState(applyCalculatorAmountKey(targetAmountInputState, key));
      } catch (caught) {
        onError(caught instanceof Error ? caught.message : 'Could not calculate amount.');
      }
      return;
    }

    if (key !== '=') {
      setAmountInputState((current) => applyCalculatorAmountKey(current, key));
      return;
    }

    try {
      setAmountInputState(applyCalculatorAmountKey(amountInputState, key));
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Could not calculate amount.');
    }
  }

  function setReplaceAmountOnNextKey(replaceOnNextEntry: boolean) {
    setAmountInputState((current) => ({
      ...current,
      replaceOnNextEntry,
    }));
  }

  function selectSourceAmountInput() {
    setActiveTransferAmountField('source');
    setReplaceAmountOnNextKey(true);
  }

  function selectTargetAmountInput() {
    setActiveTransferAmountField('target');
    setTargetAmountInputState((current) => ({
      ...current,
      replaceOnNextEntry: true,
    }));
  }

  return {
    activeTransferAmountField,
    amountExpression: amountInputState.expression,
    pressCalculatorKey,
    replaceAmountOnNextKey: amountInputState.replaceOnNextEntry,
    selectSourceAmountInput,
    selectTargetAmountInput,
    setReplaceAmountOnNextKey,
    targetAmountExpression: targetAmountInputState.expression,
    targetReplaceAmountOnNextKey: targetAmountInputState.replaceOnNextEntry,
  };
}
