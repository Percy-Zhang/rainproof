import type { NavigatorScreenParams } from '@react-navigation/native';
import type { StatsReportKind, StatsReportSort } from '../domain/statsReports';

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

export type BudgetsStackParamList = {
  Budgets: undefined;
};

export type SettingsStackParamList = {
  Settings: undefined;
};

export type MainDrawerParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Accounts: NavigatorScreenParams<AccountsStackParamList> | undefined;
  Transactions: NavigatorScreenParams<TransactionsStackParamList> | undefined;
  Statistics: NavigatorScreenParams<StatisticsStackParamList> | undefined;
  Budgets: NavigatorScreenParams<BudgetsStackParamList> | undefined;
  Settings: NavigatorScreenParams<SettingsStackParamList> | undefined;
};

export type RootStackParamList = {
  MainDrawer: NavigatorScreenParams<MainDrawerParamList> | undefined;
  AddAccount: undefined;
  EditAccount: { accountId: string };
  AddTransaction: undefined;
  EditTransaction: { transactionId: string };
  LinkTransaction: { transactionId: string };
  StatsDrilldown: {
    reportKind: StatsReportKind;
    categoryId: string;
    subcategoryId?: string;
    startIso: string;
    endIso: string;
    accountIds?: string[];
    currencyCode: string;
    initialSort?: StatsReportSort;
  };
  RainyDayFund: undefined;
  AddBudget: undefined;
  EditBudget: { budgetId: string };
  DashboardCards: undefined;
  CategoryManagement: undefined;
  CategoryEdit: { categoryId: string };
  SubcategoryEdit: { categoryId: string; subcategoryId: string };
};
