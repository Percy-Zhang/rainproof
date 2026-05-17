import { Text, type StyleProp, type TextStyle } from 'react-native';

import { getTransactionRelationParts } from '../domain/transactionDisplay';
import type { TransactionDisplayEntry } from '../domain/aggregates';
import type { Account } from '../domain/types';

export function TransactionRelationText({
  entry,
  accounts,
  contextAccountId,
  numberOfLines = 1,
  style,
  boldStyle,
}: {
  entry: TransactionDisplayEntry;
  accounts: Account[];
  contextAccountId?: string;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  boldStyle?: StyleProp<TextStyle>;
}) {
  const relation = getTransactionRelationParts(entry, accounts, contextAccountId);

  if (!relation.isTransfer || !relation.sourceLabel || !relation.targetLabel) {
    return (
      <Text numberOfLines={numberOfLines} style={style}>
        {relation.label}
      </Text>
    );
  }

  return (
    <Text numberOfLines={numberOfLines} style={style}>
      <Text style={relation.highlightSide === 'source' ? boldStyle : undefined}>{relation.sourceLabel}</Text>
      {' \u2192 '}
      <Text style={relation.highlightSide === 'target' ? boldStyle : undefined}>{relation.targetLabel}</Text>
    </Text>
  );
}
