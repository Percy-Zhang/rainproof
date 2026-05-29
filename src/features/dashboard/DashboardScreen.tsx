import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { ActionButton, Card, ProgressBar } from '../../components/ui';
import { getAccountDisplayName, getTransparentColor } from '../../domain/accountThemes';
import {
  getBudgetMonthlyRange,
  getBudgetUsageDisplayRows,
  getBudgetUsageFromStatsReport,
  getDashboardBudgetSummaryData,
  type BudgetUsageDisplayRow,
} from '../../domain/budgets';
import { defaultCategories } from '../../domain/categories';
import {
  getDashboardCardDefinition,
  getRenderableDashboardCardIds,
  type DashboardCardAvailability,
} from '../../domain/dashboardCards';
import {
  getDashboardBalanceTotals,
  getDashboardCashFlowByCurrency,
  getDashboardTopSpendingByCurrency,
  type DashboardTopSpendingCurrencyGroup,
} from '../../domain/dashboardFinancial';
import { getDashboardRecurringSummary } from '../../domain/dashboardRecurring';
import {
  getDashboardAccountPreview,
  getDashboardInitialSelectedAccountIds,
  getDashboardRecentTransactions,
  getDashboardSelectedAccountIds,
  toggleDashboardAccountSelection,
} from '../../domain/dashboard';
import {
  formatCreditCardBalanceLabel,
  formatCreditCardUtilization,
  getCreditCardBalanceSummary,
  getCreditCardPortfolioSummary,
  type CreditCardBalanceSummary,
  type CreditCardCurrencySummary,
} from '../../domain/creditCards';
import { formatLongDateLabel, getDateRangeForPreset } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import { getStatsReport } from '../../domain/statsReports';
import type {
  Account,
  AccountBalance,
  AppSnapshot,
  CashFlowSummary,
  CategoryDefinition,
  CurrencyTotal,
  DashboardCardId,
  RainyDayProgress,
  UpcomingRecurringItem,
} from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { CompactTransactionListItem } from '../transactions/TransactionListItems';

type DashboardScreenProps = {
  snapshot: AppSnapshot;
  accountBalances: AccountBalance[];
  rainyDayProgress: RainyDayProgress;
  onAddAccount: () => void;
  onAddTransaction: (params?: { dashboardAccountIds?: string[] }) => void;
  onOpenRainyDayFund: () => void;
  onOpenTransactions: () => void;
  onOpenTransaction: (transactionId: string) => void;
  onOpenAccount: () => void;
  onOpenBudgets: () => void;
  onOpenDashboardEdit: () => void;
  onOpenRecurring: () => void;
  onOpenTemplates: () => void;
  onUpdateSelectedAccountIds: (accountIds: string[]) => Promise<void>;
};

export function DashboardScreen({
  snapshot,
  accountBalances,
  rainyDayProgress,
  onAddAccount,
  onAddTransaction,
  onOpenRainyDayFund,
  onOpenTransactions,
  onOpenTransaction,
  onOpenAccount,
  onOpenBudgets,
  onOpenDashboardEdit,
  onOpenRecurring,
  onOpenTemplates,
  onUpdateSelectedAccountIds,
}: DashboardScreenProps) {
  const hasAnyAccounts = snapshot.accounts.length > 0;
  const showCurrencyCodes = snapshot.settings.multiCurrencyEnabled;
  const categories = snapshot.categories ?? defaultCategories;
  const [selectedAccountIds, setSelectedAccountIds] = useState(() =>
    getDashboardSelectedAccountIds(accountBalances, snapshot.settings.dashboardSelectedAccountIds),
  );
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const accountById = useMemo(
    () => new Map(snapshot.accounts.map((account) => [account.id, account])),
    [snapshot.accounts],
  );
  const accountPreview = useMemo(() => getDashboardAccountPreview(accountBalances), [accountBalances]);
  const previewAccountIds = useMemo(
    () => accountPreview.map(({ account }) => account.id),
    [accountPreview],
  );
  const dashboardMonthRange = useMemo(() => getDateRangeForPreset('last_month'), []);
  const dashboardBalanceTotals = useMemo(
    () => getDashboardBalanceTotals({ accountBalances, selectedAccountIds }),
    [accountBalances, selectedAccountIds],
  );
  const dashboardCashFlow = useMemo(
    () => getDashboardCashFlowByCurrency({
      accountIds: selectedAccountIds,
      lines: snapshot.transactionLines,
      range: dashboardMonthRange,
      transactionLinks: snapshot.transactionLinks,
      transactions: snapshot.transactions,
    }),
    [dashboardMonthRange, selectedAccountIds, snapshot.transactionLines, snapshot.transactionLinks, snapshot.transactions],
  );
  const dashboardTopSpending = useMemo(
    () => getDashboardTopSpendingByCurrency({
      accountIds: selectedAccountIds,
      lines: snapshot.transactionLines,
      range: dashboardMonthRange,
      transactionLinks: snapshot.transactionLinks,
      transactions: snapshot.transactions,
    }),
    [dashboardMonthRange, selectedAccountIds, snapshot.transactionLines, snapshot.transactionLinks, snapshot.transactions],
  );
  const recentTransactions = useMemo(
    () =>
      getDashboardRecentTransactions({
        previewAccountIds,
        snapshot,
        selectedAccountIds,
      }),
    [previewAccountIds, selectedAccountIds, snapshot],
  );
  const creditCardSummaries = useMemo(
    () => getCreditCardPortfolioSummary(accountBalances),
    [accountBalances],
  );
  const budgetProgress = useMemo(
    () => getDashboardBudgetProgressData(snapshot, categories),
    [categories, snapshot],
  );
  const recurringSummary = useMemo(
    () => getDashboardRecurringSummary(snapshot.recurringItems, { limit: 4 }),
    [snapshot.recurringItems],
  );
  const cardAvailability = useMemo<DashboardCardAvailability>(() => ({
    budgetProgress: budgetProgress.activeBudgetCount > 0,
    creditCards: creditCardSummaries.length > 0,
    upcomingPayments: recurringSummary.activeCount > 0,
  }), [budgetProgress.activeBudgetCount, creditCardSummaries.length, recurringSummary.activeCount]);
  const dashboardCardIds = useMemo(
    () =>
      getRenderableDashboardCardIds(snapshot.settings.dashboardCardSettings, cardAvailability),
    [cardAvailability, snapshot.settings.dashboardCardSettings],
  );

  useEffect(() => {
    setSelectedAccountIds((currentIds) => {
      const nextIds =
        snapshot.settings.dashboardSelectedAccountIds === null
          ? getDashboardInitialSelectedAccountIds(accountBalances)
          : getDashboardSelectedAccountIds(accountBalances, snapshot.settings.dashboardSelectedAccountIds);
      return areSameIds(currentIds, nextIds) ? currentIds : nextIds;
    });
  }, [accountBalances, snapshot.settings.dashboardSelectedAccountIds]);

  useEffect(() => {
    if (!quickActionsOpen) {
      return undefined;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setQuickActionsOpen(false);
      return true;
    });

    return () => subscription.remove();
  }, [quickActionsOpen]);

  function toggleAccount(accountId: string) {
    setSelectedAccountIds((currentIds) => {
      const nextIds = toggleDashboardAccountSelection(currentIds, accountId);
      void onUpdateSelectedAccountIds(nextIds);
      return nextIds;
    });
  }

  function renderDashboardCard(cardId: DashboardCardId) {
    switch (cardId) {
      case 'balanceSummary':
        return (
          <BalanceSummaryCard
            key={cardId}
            showCurrencyCodes={showCurrencyCodes}
            totalsByCurrency={dashboardBalanceTotals}
          />
        );
      case 'cashFlow':
        return (
          <CashFlowCard
            key={cardId}
            cashFlow={dashboardCashFlow}
            showCurrencyCodes={showCurrencyCodes}
          />
        );
      case 'rainyDay':
        return (
          <RainyDayDashboardCard
            key={cardId}
            rainyDayProgress={rainyDayProgress}
            showCurrencyCodes={showCurrencyCodes}
            onOpenRainyDayFund={onOpenRainyDayFund}
          />
        );
      case 'accounts':
        return (
          <AccountsDashboardCard
            key={cardId}
            accountPreview={accountPreview}
            hasAnyAccounts={hasAnyAccounts}
            selectedAccountIds={selectedAccountIds}
            showCurrencyCodes={showCurrencyCodes}
            onAddAccount={onAddAccount}
            onOpenAccount={onOpenAccount}
            onToggleAccount={toggleAccount}
          />
        );
      case 'creditCards':
        return (
          <CreditCardsDashboardCard
            key={cardId}
            creditCardSummaries={creditCardSummaries}
            showCurrencyCodes={showCurrencyCodes}
          />
        );
      case 'budgetProgress':
        return (
          <BudgetProgressDashboardCard
            key={cardId}
            activeBudgetCount={budgetProgress.activeBudgetCount}
            rows={budgetProgress.rows}
            showCurrencyCodes={showCurrencyCodes}
            onOpenBudgets={onOpenBudgets}
          />
        );
      case 'upcomingPayments':
        return (
          <UpcomingPaymentsDashboardCard
            key={cardId}
            accountById={accountById}
            rows={recurringSummary.rows}
            showCurrencyCodes={showCurrencyCodes}
            onOpenRecurring={onOpenRecurring}
          />
        );
      case 'topSpending':
        return (
          <TopSpendingCard
            key={cardId}
            categories={categories}
            topSpendingByCurrency={dashboardTopSpending}
            showCurrencyCodes={showCurrencyCodes}
          />
        );
      case 'recentTransactions':
        return (
          <RecentTransactionsCard
            key={cardId}
            categories={categories}
            recentTransactions={recentTransactions}
            selectedAccountIds={selectedAccountIds}
            showCurrencyCodes={showCurrencyCodes}
            snapshot={snapshot}
            onOpenTransaction={onOpenTransaction}
            onOpenTransactions={onOpenTransactions}
          />
        );
      default:
        return null;
    }
  }

  const renderedCards = dashboardCardIds.map(renderDashboardCard).filter(Boolean);

  function openAddTransaction() {
    setQuickActionsOpen(false);
    onAddTransaction({ dashboardAccountIds: selectedAccountIds });
  }

  function openTemplates() {
    setQuickActionsOpen(false);
    onOpenTemplates();
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        testID="screen-dashboard"
      >
        <View style={styles.dashboardHeader}>
          <View style={styles.headerText}>
            <Text style={styles.dashboardTitle}>Dashboard</Text>
            <Text style={styles.smallMuted}>Your selected cards and account view.</Text>
          </View>
          <HeaderAction label="Edit Dashboard" onPress={onOpenDashboardEdit} testID="dashboard-edit-start" />
        </View>
        {renderedCards.length ? renderedCards : (
          <Card testID="dashboard-empty-cards-card" style={styles.compactCard}>
            <Text style={styles.cardTitle}>Dashboard</Text>
            <Text style={styles.emptyText}>No dashboard cards are available. Edit Dashboard to add or show cards.</Text>
            <ActionButton variant="secondary" onPress={onOpenDashboardEdit}>
              Edit Dashboard
            </ActionButton>
          </Card>
        )}
      </ScrollView>
      {quickActionsOpen ? (
        <Pressable
          accessibilityLabel="Close dashboard quick actions"
          accessibilityRole="button"
          onPress={() => setQuickActionsOpen(false)}
          style={styles.quickActionBackdrop}
          testID="dashboard-quick-action-backdrop"
        />
      ) : null}
      {quickActionsOpen ? (
        <View pointerEvents="box-none" style={styles.quickActionMenu} testID="dashboard-quick-action-menu">
          <DashboardQuickAction
            accessibilityLabel="Use Template"
            icon="flash-outline"
            label="Use Template"
            onPress={openTemplates}
            testID="dashboard-quick-action-use-template"
          />
          <DashboardQuickAction
            accessibilityLabel="Add Transaction"
            icon="receipt-outline"
            label="Add Transaction"
            onPress={openAddTransaction}
            testID="dashboard-quick-action-add-transaction"
          />
        </View>
      ) : null}
      <Pressable
        accessibilityLabel={quickActionsOpen ? 'Close dashboard quick actions' : 'Open dashboard quick actions'}
        accessibilityHint="Shows actions for adding a transaction or using a template."
        accessibilityRole="button"
        onPress={() => setQuickActionsOpen((current) => !current)}
        style={({ pressed }) => [styles.floatingAddButton, pressed && styles.pressedRow]}
        testID="dashboard-add-transaction"
      >
        <Ionicons name={quickActionsOpen ? 'close' : 'add'} size={30} color={colors.surface} />
      </Pressable>
    </View>
  );
}

function DashboardQuickAction({
  accessibilityLabel,
  icon,
  label,
  onPress,
  testID,
}: {
  accessibilityLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quickActionRow, pressed && styles.pressedRow]}
      testID={testID}
    >
      <View style={styles.quickActionLabelPill}>
        <Text style={styles.quickActionLabel}>{label}</Text>
      </View>
      <View style={styles.quickActionIconButton}>
        <Ionicons name={icon} size={20} color={colors.surface} />
      </View>
    </Pressable>
  );
}

function RainyDayDashboardCard({
  rainyDayProgress,
  showCurrencyCodes,
  onOpenRainyDayFund,
}: {
  rainyDayProgress: RainyDayProgress;
  showCurrencyCodes: boolean;
  onOpenRainyDayFund: () => void;
}) {
  return (
    <Card testID="rainy-day-card" style={styles.compactCard}>
      <View style={styles.rowBetween}>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>Rainy day fund</Text>
          <Text style={styles.cardTitle}>{rainyDayProgress.percentage}% saved</Text>
        </View>
        <View style={styles.rainyHeaderAction}>
          <Text style={styles.progressAmount}>
            {formatMoney(rainyDayProgress.currentMinor, rainyDayProgress.fund.currencyCode, {
              showCurrencyCode: showCurrencyCodes,
            })}
          </Text>
          <HeaderIconAction
            accessibilityLabel="Edit rainy day fund"
            icon="create-outline"
            onPress={onOpenRainyDayFund}
            testID="dashboard-edit-rainy-day"
          />
        </View>
      </View>
      <ProgressBar percentage={rainyDayProgress.percentage} />
      <Text style={styles.smallMuted}>
        Goal {formatMoney(rainyDayProgress.fund.goalMinor, rainyDayProgress.fund.currencyCode, {
          showCurrencyCode: showCurrencyCodes,
        })}
      </Text>
    </Card>
  );
}

function AccountsDashboardCard({
  accountPreview,
  hasAnyAccounts,
  selectedAccountIds,
  showCurrencyCodes,
  onAddAccount,
  onOpenAccount,
  onToggleAccount,
}: {
  accountPreview: AccountBalance[];
  hasAnyAccounts: boolean;
  selectedAccountIds: string[];
  showCurrencyCodes: boolean;
  onAddAccount: () => void;
  onOpenAccount: () => void;
  onToggleAccount: (accountId: string) => void;
}) {
  return (
    <Card testID="dashboard-accounts-card" style={styles.compactCard}>
        <View style={styles.sectionCardHeader}>
          <Text style={styles.cardTitle}>Accounts</Text>
          <HeaderIconAction
            accessibilityLabel="Manage accounts"
            icon="settings-outline"
            onPress={onOpenAccount}
            testID="dashboard-manage-accounts"
          />
        </View>

        {accountPreview.length ? (
          <View style={styles.accountGrid}>
            {accountPreview.map(({ account, balanceMinor }) => (
              <AccountTile
                key={account.id}
                account={account}
                balanceMinor={balanceMinor}
                selected={selectedAccountIds.includes(account.id)}
                showCurrencyCodes={showCurrencyCodes}
                onPress={() => onToggleAccount(account.id)}
              />
            ))}
          </View>
        ) : (
          <DashboardAccountsEmptyState
            hasAnyAccounts={hasAnyAccounts}
            onAddAccount={onAddAccount}
            onOpenAccount={onOpenAccount}
          />
        )}
      </Card>
  );
}

function CreditCardsDashboardCard({
  creditCardSummaries,
  showCurrencyCodes,
}: {
  creditCardSummaries: CreditCardCurrencySummary[];
  showCurrencyCodes: boolean;
}) {
  if (!creditCardSummaries.length) {
    return null;
  }

  return (
    <Card testID="dashboard-credit-cards-card" style={styles.compactCard}>
          <View style={styles.sectionCardHeader}>
            <Text style={styles.cardTitle}>Credit cards</Text>
          </View>
          <View style={styles.creditSummaryStack}>
            {creditCardSummaries.map((summary) => (
              <CreditCardSummaryBlock
                key={summary.currencyCode}
                showCurrencyCodes={showCurrencyCodes}
                summary={summary}
              />
            ))}
          </View>
        </Card>
  );
}

function BudgetProgressDashboardCard({
  activeBudgetCount,
  rows,
  showCurrencyCodes,
  onOpenBudgets,
}: {
  activeBudgetCount: number;
  rows: BudgetUsageDisplayRow[];
  showCurrencyCodes: boolean;
  onOpenBudgets: () => void;
}) {
  if (!activeBudgetCount) {
    return null;
  }

  return (
    <Card testID="dashboard-budget-progress-card" style={styles.compactCard}>
      <Pressable
        accessibilityRole="button"
        onPress={onOpenBudgets}
        style={({ pressed }) => [styles.budgetProgressContent, pressed && styles.pressedRow]}
      >
        <View style={styles.sectionCardHeader}>
          <View style={styles.headerText}>
            <Text style={styles.cardTitle}>{getDashboardCardDefinition('budgetProgress').title}</Text>
            <Text style={styles.smallMuted}>
              {activeBudgetCount === 1 ? '1 active monthly budget' : `${activeBudgetCount} active monthly budgets`}
            </Text>
          </View>
          <Text style={styles.headerActionText}>View</Text>
        </View>

        <View style={styles.budgetProgressRows}>
          {rows.map((row) => (
            <BudgetProgressRow key={row.id} row={row} showCurrencyCodes={showCurrencyCodes} />
          ))}
        </View>
      </Pressable>
    </Card>
  );
}

function BudgetProgressRow({
  row,
  showCurrencyCodes,
}: {
  row: BudgetUsageDisplayRow;
  showCurrencyCodes: boolean;
}) {
  const progressColor = getBudgetStatusColor(row.status);
  const statusLabel = getBudgetStatusLabel(row);

  return (
    <View style={styles.budgetProgressRow}>
      <View style={styles.budgetProgressRowHeader}>
        <CategoryIconBadge color={row.color} icon={row.icon} size="sm" />
        <View style={styles.budgetProgressText}>
          <Text numberOfLines={1} style={styles.budgetProgressName}>{row.budget.name}</Text>
          <Text numberOfLines={1} style={styles.budgetProgressScope}>{row.scopeLabel}</Text>
        </View>
        <View style={styles.budgetProgressStatus}>
          <Text style={[styles.budgetProgressStatusText, { color: progressColor }]}>{statusLabel}</Text>
          <Text style={styles.budgetProgressPercent}>{Math.min(row.percentageUsed, 999)}%</Text>
        </View>
      </View>
      <ProgressBar percentage={row.percentageUsed} color={progressColor} />
      <View style={styles.budgetProgressAmounts}>
        <Text style={styles.smallMuted}>
          Used {formatMoney(row.spentMinor, row.budget.currencyCode, { showCurrencyCode: showCurrencyCodes })}
        </Text>
        <Text style={styles.smallMuted}>
          {row.remainingMinor < 0 ? 'Over ' : 'Left '}
          {formatMoney(Math.abs(row.remainingMinor), row.budget.currencyCode, { showCurrencyCode: showCurrencyCodes })}
        </Text>
      </View>
    </View>
  );
}

function UpcomingPaymentsDashboardCard({
  accountById,
  rows,
  showCurrencyCodes,
  onOpenRecurring,
}: {
  accountById: Map<string, Account>;
  rows: UpcomingRecurringItem[];
  showCurrencyCodes: boolean;
  onOpenRecurring: () => void;
}) {
  if (!rows.length) {
    return null;
  }

  return (
    <Card testID="dashboard-upcoming-payments-card" style={styles.compactCard}>
      <Pressable
        accessibilityRole="button"
        onPress={onOpenRecurring}
        style={({ pressed }) => [styles.upcomingPaymentsContent, pressed && styles.pressedRow]}
      >
        <View style={styles.sectionCardHeader}>
          <View style={styles.headerText}>
            <Text style={styles.cardTitle}>{getDashboardCardDefinition('upcomingPayments').title}</Text>
            <Text style={styles.smallMuted}>Recurring items that need attention next.</Text>
          </View>
          <Text style={styles.headerActionText}>View</Text>
        </View>

        <View style={styles.upcomingPaymentRows}>
          {rows.map((item) => (
            <UpcomingPaymentRow
              key={item.id}
              account={accountById.get(item.accountId)}
              item={item}
              showCurrencyCodes={showCurrencyCodes}
            />
          ))}
        </View>
      </Pressable>
    </Card>
  );
}

function UpcomingPaymentRow({
  account,
  item,
  showCurrencyCodes,
}: {
  account?: Account;
  item: UpcomingRecurringItem;
  showCurrencyCodes: boolean;
}) {
  const status = getRecurringDashboardStatus(item);
  const amountTone = item.kind === 'income' ? colors.success : colors.danger;
  const kindLabel = item.kind === 'income' ? 'Receive' : 'Pay';

  return (
    <View style={styles.upcomingPaymentRow}>
      <View style={styles.upcomingPaymentText}>
        <Text numberOfLines={1} style={styles.upcomingPaymentName}>{item.name}</Text>
        <Text numberOfLines={1} style={styles.upcomingPaymentDetail}>
          {kindLabel} {formatLongDateLabel(item.nextDueDate)}
          {account ? ` / ${account.name}` : ''}
        </Text>
      </View>
      <View style={styles.upcomingPaymentTrailing}>
        <Text style={[styles.upcomingPaymentAmount, { color: amountTone }]}>
          {formatMoney(item.amountMinor, item.currencyCode, { showCurrencyCode: showCurrencyCodes })}
        </Text>
        <Text style={[styles.upcomingPaymentStatus, { color: status.color }]}>{status.label}</Text>
      </View>
    </View>
  );
}

function RecentTransactionsCard({
  categories,
  recentTransactions,
  selectedAccountIds,
  showCurrencyCodes,
  snapshot,
  onOpenTransaction,
  onOpenTransactions,
}: {
  categories: CategoryDefinition[];
  recentTransactions: ReturnType<typeof getDashboardRecentTransactions>;
  selectedAccountIds: string[];
  showCurrencyCodes: boolean;
  snapshot: AppSnapshot;
  onOpenTransaction: (transactionId: string) => void;
  onOpenTransactions: () => void;
}) {
  return (
    <Card testID="recent-transactions-card" style={styles.compactCard}>
        <View style={styles.sectionCardHeader}>
          <Text style={styles.cardTitle}>Recent transactions</Text>
          <HeaderAction label="More" onPress={onOpenTransactions} testID="dashboard-more-transactions" />
        </View>
        {recentTransactions.length ? (
          <View style={styles.compactRows}>
            {recentTransactions.map((entry, index) => (
              <CompactTransactionListItem
                key={entry.id}
                entry={entry}
                accounts={snapshot.accounts}
                categories={categories}
                first={index === 0}
                contextAccountId={selectedAccountIds.length === 1 ? selectedAccountIds[0] : undefined}
                showCurrencyCodes={showCurrencyCodes}
                onPress={() => onOpenTransaction(entry.transaction.id)}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>
            {selectedAccountIds.length ? 'No recent transactions for selected accounts.' : 'No accounts selected.'}
          </Text>
        )}
      </Card>
  );
}

function getDashboardBudgetProgressData(
  snapshot: AppSnapshot,
  categories: CategoryDefinition[],
): {
  activeBudgetCount: number;
  rows: BudgetUsageDisplayRow[];
} {
  const activeBudgets = snapshot.budgets.filter((budget) => budget.isActive);
  if (!activeBudgets.length) {
    return { activeBudgetCount: 0, rows: [] };
  }

  const range = getBudgetMonthlyRange();
  const currencies = Array.from(new Set(activeBudgets.map((budget) => budget.currencyCode)));
  const usages = currencies.flatMap((currencyCode) => {
    const report = getStatsReport({
      reportKind: 'expense',
      transactions: snapshot.transactions,
      transactionLines: snapshot.transactionLines,
      transactionLinks: snapshot.transactionLinks,
      accounts: snapshot.accounts,
      categories,
      range,
      currencyCode,
    });

    return getBudgetUsageFromStatsReport({ budgets: activeBudgets, report });
  });
  const summary = getDashboardBudgetSummaryData(usages, 3);

  return {
    activeBudgetCount: summary.activeBudgetCount,
    rows: getBudgetUsageDisplayRows(summary.highestRiskUsages, categories),
  };
}

function BalanceSummaryCard({
  showCurrencyCodes,
  totalsByCurrency,
}: {
  showCurrencyCodes: boolean;
  totalsByCurrency: CurrencyTotal[];
}) {
  return (
    <Card testID="dashboard-balance-summary-card" style={styles.compactCard}>
      <Text style={styles.cardTitle}>{getDashboardCardDefinition('balanceSummary').title}</Text>
      {totalsByCurrency.length ? (
        <View style={styles.metricRows}>
          {totalsByCurrency.map((total) => (
            <View key={total.currencyCode} style={styles.metricRow}>
              <Text style={styles.metricLabel}>{total.currencyCode}</Text>
              <Text style={styles.metricValue}>
                {formatMoney(total.amountMinor, total.currencyCode, { showCurrencyCode: showCurrencyCodes })}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>Add accounts to see your balances.</Text>
      )}
    </Card>
  );
}

function CashFlowCard({
  cashFlow,
  showCurrencyCodes,
}: {
  cashFlow: CashFlowSummary[];
  showCurrencyCodes: boolean;
}) {
  return (
    <Card testID="dashboard-cash-flow-card" style={styles.compactCard}>
      <Text style={styles.cardTitle}>{getDashboardCardDefinition('cashFlow').title}</Text>
      {cashFlow.length ? (
        <View style={styles.cashFlowGroups}>
          {cashFlow.map((summary) => (
            <View key={summary.currencyCode} style={styles.cashFlowGroup}>
              <Text style={styles.currencySectionLabel}>{summary.currencyCode}</Text>
              <View style={styles.creditSummaryMetrics}>
                <CreditMetric
                  label="Income"
                  value={formatMoney(summary.incomeMinor, summary.currencyCode, { showCurrencyCode: showCurrencyCodes })}
                  tone="income"
                />
                <CreditMetric
                  label="Spending"
                  value={formatMoney(summary.expenseMinor, summary.currencyCode, { showCurrencyCode: showCurrencyCodes })}
                  tone="expense"
                />
                <CreditMetric
                  label="Net"
                  value={formatMoney(summary.netMinor, summary.currencyCode, { showCurrencyCode: showCurrencyCodes })}
                  tone={getNetMetricTone(summary.netMinor)}
                />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>No income or spending in the current month.</Text>
      )}
    </Card>
  );
}

function TopSpendingCard({
  categories,
  topSpendingByCurrency,
  showCurrencyCodes,
}: {
  categories: CategoryDefinition[];
  topSpendingByCurrency: DashboardTopSpendingCurrencyGroup[];
  showCurrencyCodes: boolean;
}) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return (
    <Card testID="dashboard-top-spending-card" style={styles.compactCard}>
      <Text style={styles.cardTitle}>{getDashboardCardDefinition('topSpending').title}</Text>
      {topSpendingByCurrency.length ? (
        <View style={styles.topSpendingCurrencyGroups}>
          {topSpendingByCurrency.map((group) => (
            <View key={group.currencyCode} style={styles.topSpendingCurrencyGroup}>
              <Text style={styles.currencySectionLabel}>{group.currencyCode}</Text>
              <View style={styles.topSpendingRows}>
                {group.rows.map((item) => (
                  <View key={`${item.currencyCode}-${item.categoryId}`} style={styles.topSpendingRow}>
                    <CategoryIconBadge
                      color={categoryById.get(item.categoryId)?.color ?? colors.muted}
                      icon={categoryById.get(item.categoryId)?.icon ?? 'pricetag-outline'}
                      size="sm"
                    />
                    <Text numberOfLines={1} style={styles.topSpendingLabel}>
                      {categoryById.get(item.categoryId)?.name ?? 'Uncategorized'}
                    </Text>
                    <Text style={styles.topSpendingAmount}>
                      {formatMoney(item.amountMinor, item.currencyCode, { showCurrencyCode: showCurrencyCodes })}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>No spending in the current month.</Text>
      )}
    </Card>
  );
}

function DashboardAccountsEmptyState({
  hasAnyAccounts,
  onAddAccount,
  onOpenAccount,
}: {
  hasAnyAccounts: boolean;
  onAddAccount: () => void;
  onOpenAccount: () => void;
}) {
  if (hasAnyAccounts) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onOpenAccount}
        style={({ pressed }) => [styles.emptyAccountCard, pressed && styles.pressedRow]}
        testID="dashboard-hidden-accounts"
      >
        <Ionicons name="eye-off-outline" size={26} color={colors.primaryDark} />
        <Text style={styles.emptyAccountTitle}>All accounts are hidden</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onAddAccount}
      style={({ pressed }) => [styles.emptyAccountCard, pressed && styles.pressedRow]}
      testID="dashboard-add-first-account"
    >
      <Ionicons name="add" size={26} color={colors.primaryDark} />
      <Text style={styles.emptyAccountTitle}>Add your first account</Text>
    </Pressable>
  );
}

function areSameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function HeaderAction({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.headerAction, pressed && styles.pressedRow]}
    >
      <Text style={styles.headerActionText}>{label}</Text>
    </Pressable>
  );
}

function HeaderIconAction({
  accessibilityLabel,
  icon,
  onPress,
  testID,
}: {
  accessibilityLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.headerIconAction, pressed && styles.pressedRow]}
    >
      <Ionicons name={icon} size={19} color={colors.primaryDark} />
    </Pressable>
  );
}

function AccountTile({
  account,
  balanceMinor,
  selected,
  showCurrencyCodes,
  onPress,
}: {
  account: Account;
  balanceMinor: number;
  selected: boolean;
  showCurrencyCodes: boolean;
  onPress: () => void;
}) {
  const creditCardSummary = getCreditCardBalanceSummary({ account, balanceMinor });
  const balanceLabel = creditCardSummary
    ? formatCreditCardBalanceLabel({ account, balanceMinor }, { showCurrencyCode: showCurrencyCodes })
    : formatMoney(balanceMinor, account.currencyCode, { showCurrencyCode: showCurrencyCodes });

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={`dashboard-account-${account.id}`}
      style={({ pressed }) => [
        styles.accountTile,
        {
          backgroundColor: selected ? getTransparentColor(account.themeColor, '38') : colors.surface,
          borderColor: selected ? account.themeColor : getTransparentColor(account.themeColor, '99'),
          borderLeftColor: account.themeColor,
        },
        pressed && styles.pressedRow,
      ]}
    >
      <Text numberOfLines={1} style={styles.accountName}>{getAccountDisplayName(account)}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.accountBalance}>
        {balanceLabel}
      </Text>
    </Pressable>
  );
}

function CreditCardSummaryBlock({
  showCurrencyCodes,
  summary,
}: {
  showCurrencyCodes: boolean;
  summary: CreditCardCurrencySummary;
}) {
  return (
    <View style={styles.creditSummaryBlock}>
      <View style={styles.creditSummaryMetrics}>
        <CreditMetric
          label="Total owed"
          value={formatMoney(summary.totalOwedMinor, summary.currencyCode, { showCurrencyCode: showCurrencyCodes })}
        />
        {summary.totalAvailableCreditMinor !== null ? (
          <CreditMetric
            label={summary.totalAvailableCreditMinor < 0 ? 'Over limit' : 'Available'}
            value={formatMoney(Math.abs(summary.totalAvailableCreditMinor), summary.currencyCode, {
              showCurrencyCode: showCurrencyCodes,
            })}
          />
        ) : null}
        {summary.utilization !== null ? (
          <CreditMetric label="Utilization" value={formatCreditCardUtilization(summary.utilization) ?? ''} />
        ) : null}
      </View>
      <View style={styles.creditCardRows}>
        {summary.cards.map((card) => (
          <CreditCardSummaryRow key={card.account.id} card={card} showCurrencyCodes={showCurrencyCodes} />
        ))}
      </View>
    </View>
  );
}

function CreditCardSummaryRow({
  card,
  showCurrencyCodes,
}: {
  card: CreditCardBalanceSummary;
  showCurrencyCodes: boolean;
}) {
  const available = card.availableCreditMinor;
  const utilization = formatCreditCardUtilization(card.utilization);

  return (
    <View style={styles.creditCardRow}>
      <Text numberOfLines={1} style={styles.creditCardName}>{getAccountDisplayName(card.account)}</Text>
      <View style={styles.creditCardValues}>
        <Text numberOfLines={1} style={styles.creditCardBalance}>
          {formatCreditCardBalanceLabel(card, { showCurrencyCode: showCurrencyCodes })}
        </Text>
        {available !== null ? (
          <Text numberOfLines={1} style={styles.creditCardDetail}>
            {available < 0 ? 'Over' : 'Available'} {formatMoney(Math.abs(available), card.account.currencyCode, {
              showCurrencyCode: showCurrencyCodes,
            })}
            {utilization ? ` - ${utilization}` : ''}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

type CreditMetricTone = 'income' | 'expense' | 'neutral';

function CreditMetric({
  label,
  tone = 'neutral',
  value,
}: {
  label: string;
  tone?: CreditMetricTone;
  value: string;
}) {
  return (
    <View style={styles.creditMetric}>
      <Text style={styles.creditMetricLabel}>{label}</Text>
      <Text style={[styles.creditMetricValue, getCreditMetricToneStyle(tone)]}>{value}</Text>
    </View>
  );
}

function getNetMetricTone(amountMinor: number): CreditMetricTone {
  if (amountMinor > 0) {
    return 'income';
  }
  if (amountMinor < 0) {
    return 'expense';
  }
  return 'neutral';
}

function getCreditMetricToneStyle(tone: CreditMetricTone) {
  switch (tone) {
    case 'income':
      return styles.creditMetricValueIncome;
    case 'expense':
      return styles.creditMetricValueExpense;
    case 'neutral':
      return null;
  }
}

function getBudgetStatusLabel(row: BudgetUsageDisplayRow): string {
  if (row.remainingMinor < 0) {
    return 'Over';
  }

  if (row.status === 'near_limit') {
    return 'Near';
  }

  return 'Under';
}

function getBudgetStatusColor(status: BudgetUsageDisplayRow['status']): string {
  switch (status) {
    case 'over_budget':
      return colors.danger;
    case 'near_limit':
      return '#9B6B12';
    case 'under_budget':
      return colors.success;
  }
}

function getRecurringDashboardStatus(item: UpcomingRecurringItem): { label: string; color: string } {
  switch (item.dueStatus) {
    case 'overdue':
      return { label: 'Overdue', color: colors.danger };
    case 'due_soon':
      return { label: 'Due soon', color: '#9B6B12' };
    case 'upcoming':
      return { label: 'Upcoming', color: colors.primaryDark };
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: 96,
  },
  dashboardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  dashboardTitle: {
    color: colors.ink,
    fontSize: typography.h2,
    fontWeight: '900',
  },
  compactCard: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  kicker: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  sectionCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 30,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  headerAction: {
    alignItems: 'center',
    borderRadius: 8,
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  headerActionText: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '900',
  },
  headerIconAction: {
    alignItems: 'center',
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '800',
  },
  progressAmount: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
  },
  rainyHeaderAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  smallMuted: {
    color: colors.muted,
    fontSize: typography.small,
  },
  accountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  accountTile: {
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 5,
    gap: spacing.xs,
    minHeight: 62,
    padding: spacing.sm,
    width: '48%',
  },
  accountName: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '800',
    textAlign: 'right',
    width: '100%',
  },
  accountBalance: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
    width: '100%',
  },
  compactRows: {
    gap: 0,
  },
  metricLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: typography.small,
    fontWeight: '800',
  },
  metricRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  metricRows: {
    gap: spacing.sm,
  },
  metricValue: {
    color: colors.ink,
    flexShrink: 0,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
  },
  creditCardBalance: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
    textAlign: 'right',
  },
  creditCardDetail: {
    color: colors.muted,
    fontSize: typography.small,
    textAlign: 'right',
  },
  creditCardName: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.small,
    fontWeight: '800',
  },
  creditCardRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  creditCardRows: {
    gap: spacing.xs,
  },
  creditCardValues: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  creditMetric: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minWidth: 96,
    padding: spacing.sm,
  },
  creditMetricLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
  },
  creditMetricValue: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
  },
  creditMetricValueExpense: {
    color: colors.danger,
  },
  creditMetricValueIncome: {
    color: colors.success,
  },
  cashFlowGroup: {
    gap: spacing.sm,
  },
  cashFlowGroups: {
    gap: spacing.md,
  },
  creditSummaryBlock: {
    gap: spacing.sm,
  },
  creditSummaryMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  creditSummaryStack: {
    gap: spacing.md,
  },
  currencySectionLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  budgetProgressAmounts: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  budgetProgressContent: {
    borderRadius: 8,
    gap: spacing.sm,
  },
  budgetProgressName: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
  },
  budgetProgressPercent: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
    textAlign: 'right',
  },
  budgetProgressRow: {
    gap: spacing.xs,
  },
  budgetProgressRowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  budgetProgressRows: {
    gap: spacing.sm,
  },
  budgetProgressScope: {
    color: colors.muted,
    fontSize: typography.small,
  },
  budgetProgressStatus: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  budgetProgressStatusText: {
    fontSize: typography.small,
    fontWeight: '900',
    textAlign: 'right',
  },
  budgetProgressText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  upcomingPaymentsContent: {
    gap: spacing.sm,
  },
  upcomingPaymentAmount: {
    fontSize: typography.small,
    fontWeight: '900',
    textAlign: 'right',
  },
  upcomingPaymentDetail: {
    color: colors.muted,
    fontSize: typography.small,
  },
  upcomingPaymentName: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
  },
  upcomingPaymentRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  upcomingPaymentRows: {
    gap: spacing.sm,
  },
  upcomingPaymentStatus: {
    fontSize: typography.small,
    fontWeight: '900',
    textAlign: 'right',
  },
  upcomingPaymentText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  upcomingPaymentTrailing: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 2,
  },
  topSpendingAmount: {
    color: colors.ink,
    flexShrink: 0,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
  },
  topSpendingLabel: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '800',
  },
  topSpendingRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  topSpendingRows: {
    gap: spacing.sm,
  },
  topSpendingCurrencyGroup: {
    gap: spacing.sm,
  },
  topSpendingCurrencyGroups: {
    gap: spacing.md,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
  },
  emptyAccountCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 92,
    padding: spacing.md,
  },
  emptyAccountTitle: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
  },
  quickActionBackdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 18,
  },
  quickActionIconButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    elevation: 5,
    height: 44,
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    width: 44,
  },
  quickActionLabel: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
  },
  quickActionLabelPill: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  quickActionMenu: {
    alignItems: 'flex-end',
    bottom: spacing.xl + 68,
    gap: spacing.sm,
    position: 'absolute',
    right: spacing.lg + 7,
    zIndex: 22,
  },
  quickActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    minHeight: 48,
  },
  floatingAddButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    bottom: spacing.xl,
    elevation: 7,
    height: 58,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    width: 58,
    zIndex: 20,
  },
  pressedRow: {
    opacity: 0.78,
  },
});
