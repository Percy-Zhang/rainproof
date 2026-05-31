import { StyleSheet, View } from 'react-native';

import {
  getSubcategoryColor,
  getSubcategoryIcon,
  getSubcategoryName,
} from '../../domain/categories';
import {
  OUTSIDE_MY_ACCOUNTS_LABEL,
} from '../../domain/transactionEdit';
import type { Account, CategoryDefinition, TransactionKind } from '../../domain/types';
import { colors, spacing } from '../../theme/tokens';
import {
  accountLabel,
  SelectorRow,
} from './TransactionFormComponents';

type TransactionAccountCategorySelectorsProps = {
  categories: CategoryDefinition[];
  emptySourceAccountLabel: string;
  fromAccount?: Account;
  kind: TransactionKind;
  onPressCategory: () => void;
  onPressSourceAccount: () => void;
  onPressTargetAccount: () => void;
  selectedCategory: CategoryDefinition;
  showCurrencyCodes: boolean;
  subcategoryId: string;
  toAccount?: Account;
};

export function TransactionAccountCategorySelectors({
  categories,
  emptySourceAccountLabel,
  fromAccount,
  kind,
  onPressCategory,
  onPressSourceAccount,
  onPressTargetAccount,
  selectedCategory,
  showCurrencyCodes,
  subcategoryId,
  toAccount,
}: TransactionAccountCategorySelectorsProps) {
  return (
    <View style={styles.quickRows}>
      <SelectorRow
        label={kind === 'transfer' ? 'From' : 'Account'}
        value={
          fromAccount
            ? accountLabel(fromAccount, showCurrencyCodes)
            : kind === 'transfer'
              ? OUTSIDE_MY_ACCOUNTS_LABEL
              : emptySourceAccountLabel
        }
        onPress={onPressSourceAccount}
        color={fromAccount?.themeColor ?? colors.primary}
        icon={fromAccount?.iconName ?? (kind === 'transfer' ? 'globe-outline' : undefined)}
        iconColor={fromAccount?.themeColor ?? colors.primary}
        iconKind="account"
        empty={!fromAccount && kind !== 'transfer'}
      />
      {kind === 'transfer' ? (
        <SelectorRow
          label="To"
          value={toAccount ? accountLabel(toAccount, showCurrencyCodes) : OUTSIDE_MY_ACCOUNTS_LABEL}
          onPress={onPressTargetAccount}
          color={toAccount?.themeColor ?? colors.primary}
          icon={toAccount?.iconName ?? 'globe-outline'}
          iconColor={toAccount?.themeColor ?? colors.primary}
          iconKind="account"
        />
      ) : (
        <SelectorRow
          label="Category"
          value={`${selectedCategory.name} / ${getSubcategoryName(selectedCategory.id, subcategoryId, categories)}`}
          onPress={onPressCategory}
          color={getSubcategoryColor(selectedCategory.id, subcategoryId, categories)}
          icon={getSubcategoryIcon(selectedCategory.id, subcategoryId, categories)}
          iconColor={getSubcategoryColor(selectedCategory.id, subcategoryId, categories)}
          empty={!subcategoryId}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  quickRows: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
