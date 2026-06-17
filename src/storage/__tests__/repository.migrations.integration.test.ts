import { getNextMonthlyDueDateForDay } from '../../domain/recurringItems';
import { SCHEMA_VERSION } from '../schema';
import {
  createFixture,
  expectCompatibleCurrentSchema,
  getAccountByName,
  getColumnNames,
  getUserVersion,
} from './repositoryTestUtils';
describe('SQLite finance repository migrations', () => {
  it('upgrades an older database shape without losing existing account data', async () => {
    const fixture = createFixture();
    try {
      await fixture.db.execAsync(`
        CREATE TABLE settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );

        CREATE TABLE accounts (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          currency_code TEXT NOT NULL,
          opening_balance_minor INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        INSERT INTO accounts (
          id, name, type, currency_code, opening_balance_minor, created_at, updated_at
        ) VALUES (
          'legacy_acct', 'Legacy account', 'checking', 'AUD', 12300,
          '2026-05-01T00:00:00.000Z', '2026-05-01T00:00:00.000Z'
        );

        PRAGMA user_version = 1;
      `);

      await fixture.repository.initialize('AUD');

      const snapshot = await fixture.repository.getSnapshot();
      expect(await getUserVersion(fixture.db)).toBe(SCHEMA_VERSION);
      await expectCompatibleCurrentSchema(fixture.db);
      expect(getAccountByName(snapshot, 'Legacy account')).toEqual(
        expect.objectContaining({
          id: 'legacy_acct',
          creditLimitMinor: null,
          iconName: 'business-outline',
          openingBalanceMinor: 12300,
          showOnDashboard: true,
        }),
      );
      expect(await getColumnNames(fixture.db, 'accounts')).toEqual(
        expect.arrayContaining(['credit_limit_minor', 'icon_name', 'theme_color', 'show_on_dashboard', 'sort_order']),
      );
      expect(await getColumnNames(fixture.db, 'transaction_links')).toEqual(
        expect.arrayContaining(['source_transaction_id', 'target_transaction_id', 'source_line_id', 'target_line_id', 'link_type']),
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('upgrades recent feature storage without losing settings or recurring items', async () => {
    const fixture = createFixture();
    try {
      await fixture.db.execAsync(`
        CREATE TABLE settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );

        INSERT INTO settings (key, value) VALUES
          ('dashboard_selected_account_ids', '["acct_hidden"]'),
          ('dashboard_card_settings', '[{"id":"accounts","visible":true},{"id":"recentTransactions","visible":false}]'),
          ('add_transaction_defaults_json', '{"lastManualAccountId":"acct_hidden","lastCategoryByKind":{"expense":{"categoryId":"food-dining","subcategoryId":"groceries"}}}');

        CREATE TABLE accounts (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          nickname TEXT NOT NULL DEFAULT '',
          type TEXT NOT NULL,
          currency_code TEXT NOT NULL,
          opening_balance_minor INTEGER NOT NULL,
          credit_limit_minor INTEGER,
          notes TEXT NOT NULL DEFAULT '',
          institution_name TEXT NOT NULL DEFAULT '',
          include_in_rainy_day INTEGER NOT NULL DEFAULT 0,
          theme_color TEXT NOT NULL DEFAULT '#1876A8',
          icon_name TEXT NOT NULL DEFAULT '',
          show_on_dashboard INTEGER NOT NULL DEFAULT 1,
          sort_order INTEGER NOT NULL DEFAULT 0,
          is_archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        INSERT INTO accounts (
          id, name, nickname, type, currency_code, opening_balance_minor, credit_limit_minor, notes,
          institution_name, include_in_rainy_day, theme_color, icon_name, show_on_dashboard,
          sort_order, is_archived, created_at, updated_at
        ) VALUES
          ('acct_visible', 'Visible', '', 'checking', 'AUD', 1000, NULL, '', '', 0, '#1876A8', '', 1, 0, 0, '2026-05-01T00:00:00.000Z', '2026-05-01T00:00:00.000Z'),
          ('acct_hidden', 'Hidden', '', 'checking', 'AUD', 2000, NULL, '', '', 0, '#1876A8', '', 0, 1, 0, '2026-05-02T00:00:00.000Z', '2026-05-02T00:00:00.000Z');

        CREATE TABLE recurring_items (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          kind TEXT NOT NULL,
          amount_minor INTEGER NOT NULL,
          currency_code TEXT NOT NULL,
          account_id TEXT NOT NULL DEFAULT '',
          category_id TEXT NOT NULL DEFAULT '',
          subcategory_id TEXT,
          note TEXT NOT NULL DEFAULT '',
          frequency TEXT NOT NULL DEFAULT 'monthly',
          next_due_date TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        INSERT INTO recurring_items (
          id, name, kind, amount_minor, currency_code, account_id, category_id,
          subcategory_id, note, frequency, next_due_date, is_active, created_at, updated_at
        ) VALUES (
          'recurring_salary', 'Salary', 'income', 320000, 'AUD', 'acct_hidden', 'income',
          'salary', 'Base pay', 'fortnightly', '2026-06-05', 1,
          '2026-05-01T00:00:00.000Z', '2026-05-02T00:00:00.000Z'
        );

        PRAGMA user_version = 8;
      `);

      await fixture.repository.initialize('AUD');

      const snapshot = await fixture.repository.getSnapshot();
      expect(await getUserVersion(fixture.db)).toBe(SCHEMA_VERSION);
      await expectCompatibleCurrentSchema(fixture.db);
      expect(snapshot.settings.dashboardSelectedAccountIds).toEqual(['acct_hidden']);
      expect(snapshot.settings.dashboardCardSettings?.slice(0, 2)).toEqual([
        { id: 'accounts', visible: true },
        { id: 'recentTransactions', visible: false },
      ]);
      expect(snapshot.settings.addTransactionDefaults).toEqual({
        lastManualAccountId: 'acct_hidden',
        lastCategoryByKind: {
          expense: { categoryId: 'food-dining', subcategoryId: 'groceries' },
        },
      });
      expect(getAccountByName(snapshot, 'Hidden').showOnDashboard).toBe(false);
      expect(snapshot.recurringItems).toEqual([
        expect.objectContaining({
          id: 'recurring_salary',
          name: 'Salary',
          kind: 'income',
          amountMinor: 320000,
          accountId: 'acct_hidden',
          categoryId: 'income',
          subcategoryId: 'salary',
          frequency: 'fortnightly',
          nextDueDate: '2026-06-05',
          isActive: true,
        }),
      ]);
      expect(snapshot.transactionTemplates).toEqual([]);
    } finally {
      fixture.cleanup();
    }
  });

  it('migrates legacy category budgets into active monthly category budgets', async () => {
    const fixture = createFixture();
    try {
      await fixture.db.execAsync(`
        CREATE TABLE settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );

        INSERT INTO settings (key, value) VALUES (
          'category_catalog_json',
          '[{"id":"food","name":"Food & Dining"}]'
        );

        CREATE TABLE budgets (
          id TEXT PRIMARY KEY NOT NULL,
          category_id TEXT NOT NULL,
          currency_code TEXT NOT NULL,
          monthly_limit_minor INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(category_id, currency_code)
        );

        INSERT INTO budgets (
          id, category_id, currency_code, monthly_limit_minor, created_at, updated_at
        ) VALUES (
          'legacy_food_budget', 'food', 'AUD', 90000,
          '2026-05-01T00:00:00.000Z', '2026-05-02T00:00:00.000Z'
        );

        PRAGMA user_version = 6;
      `);

      await fixture.repository.initialize('AUD');

      const snapshot = await fixture.repository.getSnapshot();
      expect(await getUserVersion(fixture.db)).toBe(SCHEMA_VERSION);
      expect(await getColumnNames(fixture.db, 'budgets')).toEqual(
        expect.arrayContaining(['name', 'amount_minor', 'period', 'scope_type', 'scope_items_json', 'sort_order', 'is_active']),
      );
      expect(snapshot.budgets).toEqual([
        expect.objectContaining({
          id: 'legacy_food_budget',
          name: 'Food & Dining budget',
          amountMinor: 90000,
          sortOrder: 0,
          currencyCode: 'AUD',
          period: 'monthly',
          scopeType: 'include',
          categoryId: 'food',
          subcategoryId: null,
          scopeItems: [{ categoryId: 'food', subcategoryId: null }],
          isActive: true,
        }),
      ]);
    } finally {
      fixture.cleanup();
    }
  });

  it('normalizes removed budget periods to monthly and accepts rolling 365', async () => {
    const fixture = createFixture();
    try {
      await fixture.db.execAsync(`
        CREATE TABLE budgets (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          amount_minor INTEGER NOT NULL,
          currency_code TEXT NOT NULL,
          period TEXT NOT NULL,
          scope_type TEXT NOT NULL,
          category_id TEXT,
          subcategory_id TEXT,
          scope_items_json TEXT NOT NULL DEFAULT '[]',
          sort_order INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          CHECK (period IN ('weekly', 'monthly', 'quarterly', 'yearly', 'rolling_7', 'rolling_30', 'rolling_90'))
        );

        INSERT INTO budgets (
          id, name, amount_minor, currency_code, period, scope_type, category_id,
          subcategory_id, scope_items_json, sort_order, is_active, created_at, updated_at
        ) VALUES (
          'monthly_budget', 'Monthly spending', 100000, 'AUD', 'monthly', 'overall',
          NULL, NULL, '[]', 2, 1,
          '2026-05-01T00:00:00.000Z', '2026-05-02T00:00:00.000Z'
        ), (
          'calendar_budget', 'Quarterly food', 300000, 'AUD', 'quarterly', 'include',
          'food', NULL, '[{"categoryId":"food","subcategoryId":null}]', 3, 1,
          '2026-05-01T00:00:00.000Z', '2026-05-02T00:00:00.000Z'
        ), (
          'rolling_budget', 'Rolling 90 spending', 90000, 'AUD', 'rolling_90', 'overall',
          NULL, NULL, '[]', 4, 1,
          '2026-05-01T00:00:00.000Z', '2026-05-02T00:00:00.000Z'
        );

        PRAGMA user_version = 16;
      `);

      await fixture.repository.initialize('AUD');

      const snapshot = await fixture.repository.getSnapshot();
      expect(await getUserVersion(fixture.db)).toBe(SCHEMA_VERSION);
      expect(snapshot.budgets).toEqual([
        expect.objectContaining({
          id: 'monthly_budget',
          period: 'monthly',
          scopeType: 'overall',
          sortOrder: 0,
        }),
        expect.objectContaining({
          id: 'calendar_budget',
          name: 'Quarterly food',
          amountMinor: 300000,
          currencyCode: 'AUD',
          period: 'monthly',
          scopeType: 'include',
          scopeItems: [{ categoryId: 'food', subcategoryId: null }],
          sortOrder: 1,
          isActive: true,
        }),
        expect.objectContaining({
          id: 'rolling_budget',
          name: 'Rolling 90 spending',
          period: 'weekly',
          scopeType: 'overall',
          sortOrder: 2,
        }),
      ]);

      await fixture.repository.addBudget({
        name: 'Rolling year',
        amountMinor: 1200000,
        currencyCode: 'AUD',
        period: 'rolling_365',
        scopeType: 'overall',
      });
      expect((await fixture.repository.getSnapshot()).budgets.map((budget) => budget.period)).toEqual([
        'monthly',
        'monthly',
        'weekly',
        'rolling_365',
      ]);
    } finally {
      fixture.cleanup();
    }
  });

  it('migrates legacy recurring bills into recurring items', async () => {
    const fixture = createFixture();
    try {
      await fixture.db.execAsync(`
        CREATE TABLE settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );

        CREATE TABLE recurring_bills (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          amount_minor INTEGER NOT NULL,
          currency_code TEXT NOT NULL,
          account_id TEXT NOT NULL DEFAULT '',
          category_id TEXT NOT NULL,
          due_day INTEGER NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        INSERT INTO recurring_bills (
          id, name, amount_minor, currency_code, account_id, category_id, due_day,
          is_active, created_at, updated_at
        ) VALUES (
          'legacy_bill', 'Internet', 8900, 'AUD', 'acct_everyday', 'bills', 12,
          1, '2026-05-01T00:00:00.000Z', '2026-05-02T00:00:00.000Z'
        );

        PRAGMA user_version = 7;
      `);

      await fixture.repository.initialize('AUD');

      const snapshot = await fixture.repository.getSnapshot();
      expect(await getUserVersion(fixture.db)).toBe(SCHEMA_VERSION);
      expect(await getColumnNames(fixture.db, 'recurring_items')).toEqual(
        expect.arrayContaining(['kind', 'subcategory_id', 'note', 'frequency', 'next_due_date']),
      );
      expect(snapshot.recurringItems).toEqual([
        expect.objectContaining({
          id: 'legacy_bill',
          name: 'Internet',
          kind: 'expense',
          amountMinor: 8900,
          currencyCode: 'AUD',
          accountId: 'acct_everyday',
          categoryId: 'bills',
          subcategoryId: null,
          note: '',
          frequency: 'monthly',
          nextDueDate: getNextMonthlyDueDateForDay(12),
          isActive: true,
        }),
      ]);
    } finally {
      fixture.cleanup();
    }
  });

  it('migrates legacy transaction links to nullable line references without the one-source unique constraint', async () => {
    const fixture = createFixture();
    try {
      await fixture.db.execAsync(`
        CREATE TABLE accounts (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          nickname TEXT NOT NULL DEFAULT '',
          type TEXT NOT NULL,
          currency_code TEXT NOT NULL,
          opening_balance_minor INTEGER NOT NULL,
          notes TEXT NOT NULL DEFAULT '',
          institution_name TEXT NOT NULL DEFAULT '',
          include_in_rainy_day INTEGER NOT NULL DEFAULT 0,
          theme_color TEXT NOT NULL DEFAULT '#1876A8',
          icon_name TEXT NOT NULL DEFAULT '',
          show_on_dashboard INTEGER NOT NULL DEFAULT 1,
          sort_order INTEGER NOT NULL DEFAULT 0,
          is_archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE transactions (
          id TEXT PRIMARY KEY NOT NULL,
          kind TEXT NOT NULL,
          title TEXT NOT NULL,
          datetime TEXT NOT NULL,
          notes TEXT NOT NULL DEFAULT '',
          labels_json TEXT NOT NULL DEFAULT '[]',
          group_id TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE transaction_lines (
          id TEXT PRIMARY KEY NOT NULL,
          transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
          account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          amount_minor INTEGER NOT NULL,
          currency_code TEXT NOT NULL,
          category_id TEXT NOT NULL DEFAULT '',
          subcategory_id TEXT NOT NULL DEFAULT '',
          external_party TEXT NOT NULL DEFAULT '',
          transfer_peer_account_id TEXT NOT NULL DEFAULT '',
          note TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL
        );

        CREATE TABLE transaction_links (
          id TEXT PRIMARY KEY NOT NULL,
          source_transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
          target_transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
          link_type TEXT NOT NULL,
          amount_minor INTEGER NOT NULL,
          currency_code TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          CHECK (source_transaction_id <> target_transaction_id),
          CHECK (link_type IN ('refund', 'reimbursement', 'shared_expense_contribution')),
          CHECK (amount_minor > 0),
          UNIQUE(source_transaction_id),
          UNIQUE(source_transaction_id, target_transaction_id, link_type, amount_minor, currency_code)
        );

        INSERT INTO accounts (
          id, name, nickname, type, currency_code, opening_balance_minor, notes, institution_name,
          include_in_rainy_day, theme_color, icon_name, show_on_dashboard, sort_order, is_archived, created_at, updated_at
        ) VALUES (
          'acct_1', 'Everyday', '', 'checking', 'AUD', 0, '', '', 0, '#1876A8', '', 1, 0, 0,
          '2026-05-01T00:00:00.000Z', '2026-05-01T00:00:00.000Z'
        );

        INSERT INTO transactions (
          id, kind, title, datetime, notes, labels_json, group_id, created_at, updated_at
        ) VALUES
          ('income_1', 'income', 'Paid back', '2026-05-18T10:00:00.000Z', '', '[]', '', '2026-05-18T10:00:00.000Z', '2026-05-18T10:00:00.000Z'),
          ('expense_1', 'expense', 'Dinner', '2026-05-18T09:00:00.000Z', '', '[]', '', '2026-05-18T09:00:00.000Z', '2026-05-18T09:00:00.000Z'),
          ('expense_2', 'expense', 'Groceries', '2026-05-18T08:00:00.000Z', '', '[]', '', '2026-05-18T08:00:00.000Z', '2026-05-18T08:00:00.000Z');

        INSERT INTO transaction_lines (
          id, transaction_id, account_id, amount_minor, currency_code, category_id,
          subcategory_id, external_party, transfer_peer_account_id, note, created_at
        ) VALUES
          ('income_line_1', 'income_1', 'acct_1', 5000, 'AUD', 'income', 'reimbursement', '', '', '', '2026-05-18T10:00:00.000Z'),
          ('expense_line_1', 'expense_1', 'acct_1', -3000, 'AUD', 'food-dining', 'restaurants', '', '', '', '2026-05-18T09:00:00.000Z'),
          ('expense_line_2', 'expense_2', 'acct_1', -2000, 'AUD', 'food-dining', 'groceries', '', '', '', '2026-05-18T08:00:00.000Z');

        INSERT INTO transaction_links (
          id, source_transaction_id, target_transaction_id, link_type, amount_minor, currency_code, created_at, updated_at
        ) VALUES (
          'link_1', 'income_1', 'expense_1', 'reimbursement', 3000, 'AUD',
          '2026-05-18T11:00:00.000Z', '2026-05-18T11:00:00.000Z'
        );

        PRAGMA user_version = 4;
      `);

      await fixture.repository.initialize('AUD');

      let links = await fixture.repository.getTransactionLinks();
      expect(await getUserVersion(fixture.db)).toBe(SCHEMA_VERSION);
      expect(await getColumnNames(fixture.db, 'transaction_links')).toEqual(
        expect.arrayContaining(['source_line_id', 'target_line_id']),
      );
      expect(links).toEqual([
        expect.objectContaining({
          id: 'link_1',
          sourceTransactionId: 'income_1',
          targetTransactionId: 'expense_1',
          sourceLineId: null,
          targetLineId: null,
        }),
      ]);

      await fixture.repository.addTransactionLink({
        sourceTransactionId: 'income_1',
        targetTransactionId: 'expense_2',
        linkType: 'refund',
        amountMinor: 2000,
        currencyCode: 'AUD',
      });

      links = await fixture.repository.getTransactionLinksForSourceTransaction('income_1');
      expect(links).toHaveLength(2);
      expect(links.map((link) => link.targetTransactionId)).toEqual(expect.arrayContaining(['expense_1', 'expense_2']));
    } finally {
      fixture.cleanup();
    }
  });
});

