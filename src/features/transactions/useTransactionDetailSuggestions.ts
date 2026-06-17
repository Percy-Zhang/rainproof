import { useMemo } from 'react';

import { getLabelAutocompleteOptions } from '../../domain/labels';
import { getTransactionItemNameSuggestionValues } from '../../domain/transactionItemSuggestions';
import type {
  RecurringItem,
  Transaction,
  TransactionLine,
  TransactionTemplate,
} from '../../domain/types';
import { useAutocompleteOptions } from './TransactionFormComponents';

type UseTransactionDetailSuggestionsOptions = {
  excludeRecurringItemId?: string;
  excludeTemplateId?: string;
  excludeTransactionId?: string;
  groupQuery: string;
  itemQuery: string;
  labelsInput: string;
  recurringItems: RecurringItem[];
  transactionLines: TransactionLine[];
  transactionTemplates: TransactionTemplate[];
  transactions: Transaction[];
};

export function useTransactionDetailSuggestions({
  excludeRecurringItemId,
  excludeTemplateId,
  excludeTransactionId,
  groupQuery,
  itemQuery,
  labelsInput,
  recurringItems,
  transactionLines,
  transactionTemplates,
  transactions,
}: UseTransactionDetailSuggestionsOptions) {
  const itemHistory = useMemo(
    () => getTransactionItemNameSuggestionValues({
      excludeRecurringItemId,
      excludeTemplateId,
      excludeTransactionId,
      recurringItems,
      transactionLines,
      transactionTemplates,
      transactions,
    }),
    [
      excludeRecurringItemId,
      excludeTemplateId,
      excludeTransactionId,
      recurringItems,
      transactionLines,
      transactionTemplates,
      transactions,
    ],
  );
  const groupHistory = useMemo(
    () => transactions.map((transaction) => transaction.groupId).filter(Boolean),
    [transactions],
  );
  const labelHistory = useMemo(
    () => transactions
      .filter((transaction) => transaction.id !== excludeTransactionId)
      .flatMap((transaction) => transaction.labels),
    [excludeTransactionId, transactions],
  );
  const groupSuggestions = useAutocompleteOptions(groupHistory, groupQuery);
  const itemSuggestions = useAutocompleteOptions(itemHistory, itemQuery);
  const labelSuggestions = useMemo(
    () => getLabelAutocompleteOptions(labelHistory, labelsInput),
    [labelHistory, labelsInput],
  );

  return {
    groupSuggestions,
    itemHistory,
    itemSuggestions,
    labelSuggestions,
  };
}
