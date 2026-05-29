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
  creditLimitMinor?: number | null;
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

export type BudgetPeriod = 'monthly';

export type BudgetScopeType = 'overall' | 'category' | 'subcategory';

export type Budget = {
  id: string;
  name: string;
  amountMinor: number;
  currencyCode: CurrencyCode;
  period: BudgetPeriod;
  scopeType: BudgetScopeType;
  categoryId: string | null;
  subcategoryId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecurringItemKind = Extract<TransactionKind, 'expense' | 'income'>;

export type RecurringFrequency = 'weekly' | 'fortnightly' | 'monthly' | 'yearly';

export type RecurringItem = {
  id: string;
  name: string;
  kind: RecurringItemKind;
  amountMinor: number;
  currencyCode: CurrencyCode;
  accountId: string;
  categoryId: string;
  subcategoryId: string | null;
  note: string;
  frequency: RecurringFrequency;
  nextDueDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecurringBill = RecurringItem;

export type TransactionTemplateKind = Extract<TransactionKind, 'expense' | 'income'>;

export type TransactionTemplate = {
  id: string;
  name: string;
  kind: TransactionTemplateKind;
  title: string;
  accountId: string;
  amountMinor: number | null;
  currencyCode: CurrencyCode;
  categoryId: string | null;
  subcategoryId: string | null;
  notes: string;
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
  status: 'under_budget' | 'near_limit' | 'over_budget';
  matchingLineIds: string[];
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

export type DashboardCardId =
  | 'balanceSummary'
  | 'cashFlow'
  | 'rainyDay'
  | 'accounts'
  | 'creditCards'
  | 'budgetProgress'
  | 'upcomingPayments'
  | 'topSpending'
  | 'recentTransactions';

export type DashboardCardSetting = {
  id: DashboardCardId;
  visible: boolean;
};

export type AddTransactionCategoryDefault = {
  categoryId: string;
  subcategoryId: string | null;
};

export type AddTransactionDefaults = {
  lastManualAccountId?: string | null;
  lastCategoryByKind?: Partial<Record<Extract<TransactionKind, 'expense' | 'income'>, AddTransactionCategoryDefault>>;
};

export type UpcomingRecurringItem = RecurringItem & {
  dueStatus: 'overdue' | 'due_soon' | 'upcoming';
};

export type UpcomingBill = UpcomingRecurringItem;

export type AppSettings = {
  defaultCurrencyCode: CurrencyCode;
  defaultCurrencyMode: DefaultCurrencyMode;
  multiCurrencyEnabled: boolean;
  enabledCurrencyCodes: CurrencyCode[];
  dashboardSelectedAccountIds: string[] | null;
  dashboardCardSettings?: DashboardCardSetting[];
  addTransactionDefaults?: AddTransactionDefaults;
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
  recurringItems: RecurringItem[];
  recurringBills: RecurringBill[];
  transactionTemplates: TransactionTemplate[];
  rainyDayFund: RainyDayFund;
};

export type NewAccountInput = {
  name: string;
  nickname?: string;
  type: AccountType;
  currencyCode: CurrencyCode;
  openingBalanceMinor: number;
  creditLimitMinor?: number | null;
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
  creditLimitMinor?: number | null;
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
  name?: string;
  amountMinor: number;
  currencyCode: CurrencyCode;
  period?: BudgetPeriod;
  scopeType: BudgetScopeType;
  categoryId?: string | null;
  subcategoryId?: string | null;
  isActive?: boolean;
};

export type UpdateBudgetInput = NewBudgetInput & {
  id: string;
};

export type NewRecurringItemInput = {
  name: string;
  kind: RecurringItemKind;
  amountMinor: number;
  currencyCode: CurrencyCode;
  accountId: string;
  categoryId: string;
  subcategoryId?: string | null;
  note?: string;
  frequency: RecurringFrequency;
  nextDueDate: string;
  isActive?: boolean;
};

export type UpdateRecurringItemInput = NewRecurringItemInput & {
  id: string;
};

export type NewRecurringBillInput = NewRecurringItemInput;

export type NewTransactionTemplateInput = {
  name: string;
  kind: TransactionTemplateKind;
  title: string;
  accountId: string;
  amountMinor?: number | null;
  currencyCode: CurrencyCode;
  categoryId?: string | null;
  subcategoryId?: string | null;
  notes?: string;
  isActive?: boolean;
};

export type UpdateTransactionTemplateInput = NewTransactionTemplateInput & {
  id: string;
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

export type UpdateDashboardCardSettingsInput = {
  dashboardCardSettings: DashboardCardSetting[];
};

export type UpdateAddTransactionDefaultsInput = {
  addTransactionDefaults: AddTransactionDefaults;
};

export type UpdateCategoryCatalogInput = {
  categories: CategoryDefinition[];
};
