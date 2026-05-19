import type { NavigatorScreenParams } from '@react-navigation/native';

export type HomeStackParamList = {
  Dashboard: undefined;
};

export type AccountsStackParamList = {
  Accounts: undefined;
};

export type TransactionsStackParamList = {
  Transactions: undefined;
};

export type StatisticsStackParamList = {
  Statistics: undefined;
};

export type SettingsStackParamList = {
  Settings: undefined;
};

export type PlanningStackParamList = {
  Planning: undefined;
  SplitPayments: undefined;
  SplitTransaction: { transactionId: string };
  OutstandingReimbursements: undefined;
  Budgets: undefined;
  AddBudget: undefined;
  EditBudget: { budgetId: string };
  BudgetDetails: { budgetId: string };
  RecurringPayments: undefined;
  AddRecurringPayment: undefined;
  EditRecurringPayment: { recurringBillId: string };
};

export type MainDrawerParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Accounts: NavigatorScreenParams<AccountsStackParamList> | undefined;
  Transactions: NavigatorScreenParams<TransactionsStackParamList> | undefined;
  Statistics: NavigatorScreenParams<StatisticsStackParamList> | undefined;
  Planning: NavigatorScreenParams<PlanningStackParamList> | undefined;
  Settings: NavigatorScreenParams<SettingsStackParamList> | undefined;
};

export type RootStackParamList = {
  MainDrawer: NavigatorScreenParams<MainDrawerParamList> | undefined;
  AddAccount: undefined;
  EditAccount: { accountId: string };
  AddTransaction: undefined;
  EditTransaction: { transactionId: string };
  LinkTransaction: { transactionId: string };
  RainyDayFund: undefined;
  CategoryManagement: undefined;
  CategoryEdit: { categoryId: string };
  SubcategoryEdit: { categoryId: string; subcategoryId: string };
};
