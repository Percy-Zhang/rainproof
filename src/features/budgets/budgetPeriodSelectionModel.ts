import type { BudgetPeriod } from '../../domain/types';

export type BudgetPeriodSelectRouteParams = {
  requestId: string;
  selectedPeriod: BudgetPeriod;
};

export type BudgetPeriodSelectLaunchParams = Omit<BudgetPeriodSelectRouteParams, 'requestId'>;
