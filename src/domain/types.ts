export type CurrencyCode = string;
export type DefaultCurrencyMode = 'auto' | 'manual';

export type AccountType =
  | 'checking'
  | 'savings'
  | 'cash'
  | 'brokerage'
  | 'credit_card';

export type TransactionKind = 'income' | 'expense' | 'transfer';

export type TransactionLinkType = 'refund' | 'reimbursement' | 'shared_expense_contribution';

export type DatePreset =
  | 'last_week'
  | 'last_month'
  | 'last_quarter'
  | 'last_6_months'
  | 'last_year'
  | 'custom';

export type MoneyAmount = {
  amountMinor: number;
  currencyCode: CurrencyCode;
};

export type Account = {
  id: string;
  name: string;
  nickname: string;
  type: AccountType;
  currencyCode: CurrencyCode;
  openingBalanceMinor: number;
  notes: string;
  institutionName: string;
  includeInRainyDay: boolean;
  themeColor: string;
  iconName: string;
  showOnDashboard: boolean;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Transaction = {
  id: string;
  kind: TransactionKind;
  title: string;
  datetime: string;
  notes: string;
  labels: string[];
  groupId: string;
  createdAt: string;
  updatedAt: string;
};

export type TransactionLine = {
  id: string;
  transactionId: string;
  accountId: string;
  amountMinor: number;
  currencyCode: CurrencyCode;
  categoryId: string;
  subcategoryId: string;
  externalParty: string;
  transferPeerAccountId: string;
  note: string;
  createdAt: string;
};

export type TransactionLink = {
  id: string;
  sourceTransactionId: string;
  targetTransactionId: string;
  sourceLineId?: string | null;
  targetLineId?: string | null;
  linkType: TransactionLinkType;
  amountMinor: number;
  currencyCode: CurrencyCode;
  createdAt: string;
  updatedAt: string;
};

export type CategoryDefinition = {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: 'income' | 'expense';
  subcategories: SubcategoryDefinition[];
};

export type SubcategoryDefinition = {
  id: string;
  name: string;
  color: string;
  icon: string;
};

export type Budget = {
  id: string;
  categoryId: string;
  currencyCode: CurrencyCode;
  monthlyLimitMinor: number;
  createdAt: string;
  updatedAt: string;
};

export type RecurringBill = {
  id: string;
  name: string;
  amountMinor: number;
  currencyCode: CurrencyCode;
  accountId: string;
  categoryId: string;
  dueDay: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RainyDayFund = {
  id: string;
  name: string;
  currencyCode: CurrencyCode;
  goalMinor: number;
  linkedAccountIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type AccountBalance = {
  account: Account;
  balanceMinor: number;
};

export type CurrencyTotal = {
  currencyCode: CurrencyCode;
  amountMinor: number;
};

export type DateRange = {
  startIso: string;
  endIso: string;
};

export type SpendingByCategory = {
  categoryId: string;
  currencyCode: CurrencyCode;
  amountMinor: number;
};

export type BudgetUsage = {
  budget: Budget;
  spentMinor: number;
  remainingMinor: number;
  percentageUsed: number;
};

export type RainyDayProgress = {
  fund: RainyDayFund;
  currentMinor: number;
  remainingMinor: number;
  percentage: number;
};

export type CashFlowSummary = {
  currencyCode: CurrencyCode;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
};

export type UpcomingBill = RecurringBill & {
  nextDueDate: string;
};

export type AppSettings = {
  defaultCurrencyCode: CurrencyCode;
  defaultCurrencyMode: DefaultCurrencyMode;
  multiCurrencyEnabled: boolean;
  enabledCurrencyCodes: CurrencyCode[];
  dashboardSelectedAccountIds: string[] | null;
};

export type AppSnapshot = {
  defaultCurrencyCode: CurrencyCode;
  settings: AppSettings;
  categories?: CategoryDefinition[];
  accounts: Account[];
  transactions: Transaction[];
  transactionLines: TransactionLine[];
  transactionLinks: TransactionLink[];
  budgets: Budget[];
  recurringBills: RecurringBill[];
  rainyDayFund: RainyDayFund;
};

export type NewAccountInput = {
  name: string;
  nickname?: string;
  type: AccountType;
  currencyCode: CurrencyCode;
  openingBalanceMinor: number;
  notes?: string;
  institutionName?: string;
  includeInRainyDay?: boolean;
  themeColor?: string;
  iconName?: string;
  showOnDashboard?: boolean;
};

export type UpdateAccountInput = {
  id: string;
  name: string;
  nickname: string;
  notes: string;
  institutionName: string;
  includeInRainyDay: boolean;
  themeColor: string;
  iconName: string;
};

export type NewTransactionInput = {
  kind: TransactionKind;
  title: string;
  datetime: string;
  notes?: string;
  labels?: string[];
  groupId?: string;
  lines: {
    id?: string;
    accountId: string;
    amountMinor: number;
    currencyCode: CurrencyCode;
    categoryId?: string;
    subcategoryId?: string;
    externalParty?: string;
    transferPeerAccountId?: string;
    note?: string;
  }[];
};

export type UpdateTransactionInput = NewTransactionInput & {
  id: string;
};

export type NewTransactionLinkInput = {
  sourceTransactionId: string;
  targetTransactionId: string;
  sourceLineId?: string | null;
  targetLineId?: string | null;
  linkType: TransactionLinkType;
  amountMinor: number;
  currencyCode: CurrencyCode;
};

export type UpdateTransactionLinkInput = NewTransactionLinkInput & {
  id: string;
};

export type NewBudgetInput = {
  categoryId: string;
  currencyCode: CurrencyCode;
  monthlyLimitMinor: number;
};

export type NewRecurringBillInput = {
  name: string;
  amountMinor: number;
  currencyCode: CurrencyCode;
  accountId: string;
  categoryId: string;
  dueDay: number;
};

export type UpdateRainyDayFundInput = {
  currencyCode: CurrencyCode;
  goalMinor: number;
  linkedAccountIds: string[];
};

export type UpdateAppSettingsInput = {
  defaultCurrencyCode: CurrencyCode;
  multiCurrencyEnabled: boolean;
  enabledCurrencyCodes: CurrencyCode[];
};

export type UpdateCategoryCatalogInput = {
  categories: CategoryDefinition[];
};
