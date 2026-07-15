import { memo } from 'react';

import { TransactionQuickActions } from '../../components/TransactionQuickActions';
import { spacing } from '../../theme/tokens';

type DashboardQuickActionsProps = {
  onAddTransaction: (params?: { dashboardAccountIds?: string[] }) => void;
  onOpenTemplates: () => void;
  selectedAccountIds: string[];
};

export const DashboardQuickActions = memo(function DashboardQuickActions({
  onAddTransaction,
  onOpenTemplates,
  selectedAccountIds,
}: DashboardQuickActionsProps) {
  return (
    <TransactionQuickActions
      bottom={spacing.xl}
      context="dashboard"
      onAddTransaction={onAddTransaction}
      onOpenTemplates={onOpenTemplates}
      selectedAccountIds={selectedAccountIds}
    />
  );
});
