import {
  getAccountBalances,
  getCashFlowSummary,
  getRainyDayProgress,
  getSpendingByCategory,
} from '../../domain/aggregates';
import { getDefaultDashboardCardSettings } from '../../domain/dashboardCards';
import { SCHEMA_VERSION } from '../schema';
import {
  addAccount,
  createFixture,
  expectFreshCurrentSchema,
  getAccountByName,
  getBalanceByAccountId,
  getSettingRows,
  getUserVersion,
  withInitializedRepository,
} from './repositoryTestUtils';
describe('SQLite finance repository settings and accounts', () => {
  it('initializes an empty database with required defaults and no demo ledger data', async () => {
    await withInitializedRepository(async ({ db, repository }) => {
      const snapshot = await repository.getSnapshot();
      const settings = await getSettingRows(db);

      expect(await getUserVersion(db)).toBe(SCHEMA_VERSION);
      await expectFreshCurrentSchema(db);
      expect(settings.map((setting) => setting.key)).toEqual(
        expect.arrayContaining([
          'category_catalog_json',
          'add_transaction_defaults_json',
          'dashboard_card_settings',
          'default_currency_code',
          'default_currency_mode',
          'enabled_currency_codes',
          'multi_currency_enabled',
        ]),
      );
      expect(snapshot.defaultCurrencyCode).toBe('AUD');
      expect(snapshot.settings.defaultCurrencyMode).toBe('auto');
      expect(snapshot.settings.enabledCurrencyCodes).toContain('AUD');
      expect(snapshot.settings.addTransactionDefaults).toEqual({});
      expect(snapshot.categories?.length).toBeGreaterThan(0);
      expect(snapshot.accounts).toEqual([]);
      expect(snapshot.transactions).toEqual([]);
      expect(snapshot.transactionLines).toEqual([]);
      expect(snapshot.transactionLinks).toEqual([]);
      expect(snapshot.budgets).toEqual([]);
      expect(snapshot.recurringItems).toEqual([]);
      expect(snapshot.recurringBills).toEqual([]);
      expect(snapshot.recurringTransactionHistory).toEqual([]);
      expect(snapshot.transactionTemplates).toEqual([]);
      expect(snapshot.rainyDayFund.goalMinor).toBe(0);
      expect(snapshot.rainyDayFund.linkedAccountIds).toEqual([]);
    });
  });

  it('persists dashboard card settings through the settings store', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const defaults = getDefaultDashboardCardSettings();
      let snapshot = await repository.getSnapshot();

      expect(snapshot.settings.dashboardCardSettings).toEqual(defaults);

      const customized = [
        { id: 'recentTransactions' as const, visible: true },
        { id: 'accounts' as const, visible: false },
        ...defaults.filter((setting) => !['recentTransactions', 'accounts'].includes(setting.id)),
      ];

      await repository.updateDashboardCardSettings({ dashboardCardSettings: customized });
      snapshot = await repository.getSnapshot();

      expect(snapshot.settings.dashboardCardSettings?.slice(0, 2)).toEqual([
        { id: 'recentTransactions', visible: true },
        { id: 'accounts', visible: false },
      ]);
    });
  });

  it('persists a manually selected default currency', async () => {
    await withInitializedRepository(async ({ repository }) => {
      await repository.updateSettings({
        defaultCurrencyCode: 'JPY',
        multiCurrencyEnabled: true,
        enabledCurrencyCodes: ['AUD', 'USD'],
      });

      const snapshot = await repository.getSnapshot();

      expect(snapshot.defaultCurrencyCode).toBe('JPY');
      expect(snapshot.settings.defaultCurrencyCode).toBe('JPY');
      expect(snapshot.settings.defaultCurrencyMode).toBe('manual');
      expect(snapshot.settings.enabledCurrencyCodes).toEqual(['AUD', 'JPY', 'USD']);
    });
  });

  it('persists dashboard selected account ids without changing account visibility', async () => {
    await withInitializedRepository(async ({ repository }) => {
      await addAccount(repository, { name: 'Everyday' });
      const savings = await addAccount(repository, { name: 'Savings' });

      await repository.updateDashboardSelectedAccountIds([savings.id]);
      let snapshot = await repository.getSnapshot();

      expect(snapshot.settings.dashboardSelectedAccountIds).toEqual([savings.id]);

      await repository.updateAccountDashboardVisibility(savings.id, false);
      snapshot = await repository.getSnapshot();

      expect(getAccountByName(snapshot, 'Savings').showOnDashboard).toBe(false);
      expect(snapshot.settings.dashboardSelectedAccountIds).toEqual([savings.id]);

      const wallet = await addAccount(repository, { name: 'Wallet' });
      snapshot = await repository.getSnapshot();

      expect(snapshot.settings.dashboardSelectedAccountIds).toEqual([savings.id, wallet.id]);
      expect(getAccountByName(snapshot, 'Everyday').showOnDashboard).toBe(true);
    });
  });

  it('persists Add Transaction defaults through the settings store', async () => {
    await withInitializedRepository(async ({ repository }) => {
      await repository.updateAddTransactionDefaults({
        addTransactionDefaults: {
          lastManualAccountId: 'checking',
          lastCategoryByKind: {
            expense: { categoryId: 'food', subcategoryId: 'groceries' },
            income: { categoryId: 'income', subcategoryId: 'salary' },
          },
        },
      });

      const snapshot = await repository.getSnapshot();

      expect(snapshot.settings.addTransactionDefaults).toEqual({
        lastManualAccountId: 'checking',
        lastCategoryByKind: {
          expense: { categoryId: 'food', subcategoryId: 'groceries' },
          income: { categoryId: 'income', subcategoryId: 'salary' },
        },
      });
    });
  });

  it('falls back to default dashboard cards when stored settings are corrupt', async () => {
    await withInitializedRepository(async ({ db, repository }) => {
      await db.runAsync(
        `INSERT INTO settings (key, value)
         VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        'dashboard_card_settings',
        'not-json',
      );

      const snapshot = await repository.getSnapshot();

      expect(snapshot.settings.dashboardCardSettings).toEqual(getDefaultDashboardCardSettings());
    });
  });


  it('promotes the automatic default currency to the first account currency', async () => {
    const fixture = createFixture();
    try {
      await fixture.repository.initialize('USD');

      await addAccount(fixture.repository, { name: 'Everyday', currencyCode: 'AUD', includeInRainyDay: true });
      const snapshot = await fixture.repository.getSnapshot();

      expect(snapshot.defaultCurrencyCode).toBe('AUD');
      expect(snapshot.settings.defaultCurrencyMode).toBe('auto');
      expect(snapshot.settings.enabledCurrencyCodes).toEqual(expect.arrayContaining(['AUD', 'USD']));
      expect(snapshot.rainyDayFund.currencyCode).toBe('AUD');
      expect(snapshot.rainyDayFund.linkedAccountIds).toHaveLength(1);
    } finally {
      fixture.cleanup();
    }
  });

  it.each(['EUR', 'GBP', 'JPY'])(
    'promotes the automatic default currency to a first %s account',
    async (currencyCode) => {
      const fixture = createFixture();
      try {
        await fixture.repository.initialize('USD');

        await addAccount(fixture.repository, { name: `${currencyCode} account`, currencyCode });
        const snapshot = await fixture.repository.getSnapshot();

        expect(snapshot.defaultCurrencyCode).toBe(currencyCode);
        expect(snapshot.settings.enabledCurrencyCodes).toContain(currencyCode);
      } finally {
        fixture.cleanup();
      }
    },
  );

  it('does not overwrite a manual default currency when adding the first account', async () => {
    const fixture = createFixture();
    try {
      await fixture.repository.initialize('USD');
      await fixture.repository.updateSettings({
        defaultCurrencyCode: 'USD',
        multiCurrencyEnabled: false,
        enabledCurrencyCodes: ['USD'],
      });

      await addAccount(fixture.repository, { name: 'Everyday', currencyCode: 'AUD' });
      const snapshot = await fixture.repository.getSnapshot();

      expect(snapshot.defaultCurrencyCode).toBe('USD');
      expect(snapshot.settings.defaultCurrencyMode).toBe('manual');
      expect(snapshot.settings.enabledCurrencyCodes).toContain('AUD');
    } finally {
      fixture.cleanup();
    }
  });

  it('uses a single existing account currency when older settings have no manual default flag', async () => {
    const fixture = createFixture();
    try {
      await fixture.repository.initialize('USD');
      await addAccount(fixture.repository, { name: 'Everyday', currencyCode: 'AUD' });
      await fixture.db.runAsync(
        `INSERT INTO settings (key, value)
         VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        'default_currency_code',
        'USD',
      );
      await fixture.db.runAsync('DELETE FROM settings WHERE key = ?', 'default_currency_mode');

      const snapshot = await fixture.repository.getSnapshot();

      expect(snapshot.defaultCurrencyCode).toBe('AUD');
      expect(snapshot.settings.defaultCurrencyMode).toBe('auto');
    } finally {
      fixture.cleanup();
    }
  });

  it.each(['AUD', 'EUR'])('uses the effective single %s currency for stats calculations', async (currencyCode) => {
    const fixture = createFixture();
    try {
      await fixture.repository.initialize('USD');
      const everyday = await addAccount(fixture.repository, { name: 'Everyday', currencyCode });
      await fixture.repository.addTransaction({
        kind: 'expense',
        title: 'Groceries',
        datetime: '2026-05-18T12:00:00.000Z',
        lines: [
          {
            accountId: everyday.id,
            amountMinor: -4200,
            currencyCode,
            categoryId: 'food-dining',
            subcategoryId: 'groceries',
          },
        ],
      });

      const snapshot = await fixture.repository.getSnapshot();
      const range = {
        startIso: '2026-05-01T00:00:00.000Z',
        endIso: '2026-06-01T00:00:00.000Z',
      };

      expect(snapshot.defaultCurrencyCode).toBe(currencyCode);
      expect(
        getSpendingByCategory({
          transactions: snapshot.transactions,
          lines: snapshot.transactionLines,
          transactionLinks: snapshot.transactionLinks,
          range,
          currencyCode: snapshot.defaultCurrencyCode,
        }),
      ).toEqual([{ categoryId: 'food-dining', currencyCode, amountMinor: 4200 }]);
      expect(
        getCashFlowSummary({
          transactions: snapshot.transactions,
          lines: snapshot.transactionLines,
          transactionLinks: snapshot.transactionLinks,
          range,
          currencyCode: snapshot.defaultCurrencyCode,
        }).expenseMinor,
      ).toBe(4200);
    } finally {
      fixture.cleanup();
    }
  });

  it('persists account create, edit, icon, visibility, closed state, and derived balance inputs', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const account = await addAccount(repository, {
        name: 'Everyday',
        openingBalanceMinor: 12500,
        iconName: 'cash-outline',
        includeInRainyDay: true,
      });

      let snapshot = await repository.getSnapshot();
      expect(getAccountByName(snapshot, 'Everyday')).toEqual(
        expect.objectContaining({
          currencyCode: 'AUD',
          creditLimitMinor: null,
          iconName: 'cash-outline',
          includeInRainyDay: true,
          openingBalanceMinor: 12500,
          showOnDashboard: true,
        }),
      );
      expect(getAccountBalances(snapshot.accounts, snapshot.transactionLines)[0]?.balanceMinor).toBe(12500);

      await repository.updateAccount({
        id: account.id,
        name: 'Daily',
        nickname: 'Main',
        notes: 'Updated notes',
        institutionName: 'Bank',
        includeInRainyDay: false,
        creditLimitMinor: null,
        themeColor: '#0F7B45',
        iconName: 'card-outline',
      });
      await repository.updateAccountDashboardVisibility(account.id, false);

      snapshot = await repository.getSnapshot();
      expect(getAccountByName(snapshot, 'Daily')).toEqual(
        expect.objectContaining({
          nickname: 'Main',
          notes: 'Updated notes',
          institutionName: 'Bank',
          includeInRainyDay: false,
          themeColor: '#0F7B45',
          iconName: 'card-outline',
          showOnDashboard: false,
        }),
      );

      await repository.closeAccount(account.id);
      snapshot = await repository.getSnapshot();
      expect(getAccountByName(snapshot, 'Daily')).toEqual(
        expect.objectContaining({
          isArchived: true,
          includeInRainyDay: false,
          showOnDashboard: false,
        }),
      );

      await repository.reopenAccount(account.id);
      snapshot = await repository.getSnapshot();
      expect(getAccountByName(snapshot, 'Daily').isArchived).toBe(false);
    });
  });

  it('persists nullable credit card limits without affecting ledger balances', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const card = await addAccount(repository, {
        name: 'Rewards card',
        type: 'credit_card',
        openingBalanceMinor: -42000,
        creditLimitMinor: 200000,
      });
      await addAccount(repository, {
        name: 'Everyday',
        type: 'checking',
        creditLimitMinor: 999999,
      });

      let snapshot = await repository.getSnapshot();
      expect(getAccountByName(snapshot, 'Rewards card')).toEqual(
        expect.objectContaining({
          creditLimitMinor: 200000,
          openingBalanceMinor: -42000,
          type: 'credit_card',
        }),
      );
      expect(getAccountByName(snapshot, 'Everyday').creditLimitMinor).toBeNull();
      expect(getAccountBalances(snapshot.accounts, snapshot.transactionLines)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            account: expect.objectContaining({ id: card.id }),
            balanceMinor: -42000,
          }),
        ]),
      );

      await repository.updateAccount({
        id: card.id,
        name: 'Rewards card',
        nickname: '',
        notes: '',
        institutionName: '',
        includeInRainyDay: false,
        creditLimitMinor: 250000,
        themeColor: '#1876A8',
        iconName: 'card-outline',
      });

      snapshot = await repository.getSnapshot();
      expect(getAccountByName(snapshot, 'Rewards card').creditLimitMinor).toBe(250000);
      expect(getAccountBalances(snapshot.accounts, snapshot.transactionLines)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            account: expect.objectContaining({ id: card.id }),
            balanceMinor: -42000,
          }),
        ]),
      );
    });
  });


  it('persists Rainy Day settings without creating transactions or changing balances', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday', openingBalanceMinor: 12000 });
      const savings = await addAccount(repository, { name: 'Savings', type: 'savings', openingBalanceMinor: 30000 });
      const beforeSnapshot = await repository.getSnapshot();
      const beforeBalancesByAccountId = getBalanceByAccountId(beforeSnapshot);

      await repository.updateRainyDayFund({
        currencyCode: 'AUD',
        goalMinor: 50000,
        linkedAccountIds: [everyday.id, savings.id],
      });

      let snapshot = await repository.getSnapshot();
      expect(snapshot.rainyDayFund).toEqual(
        expect.objectContaining({
          currencyCode: 'AUD',
          goalMinor: 50000,
          linkedAccountIds: [everyday.id, savings.id],
        }),
      );
      expect(getRainyDayProgress(snapshot.rainyDayFund, getAccountBalances(snapshot.accounts, snapshot.transactionLines))).toEqual(
        expect.objectContaining({
          currentMinor: 42000,
          remainingMinor: 8000,
          percentage: 84,
        }),
      );
      expect(snapshot.transactions).toEqual([]);
      expect(getBalanceByAccountId(snapshot)).toEqual(beforeBalancesByAccountId);

      await repository.deleteAccount(savings.id);
      snapshot = await repository.getSnapshot();
      expect(snapshot.rainyDayFund.linkedAccountIds).toEqual([everyday.id]);
      expect(snapshot.transactions).toEqual([]);
    });
  });

});

