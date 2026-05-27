import {
  getDefaultDashboardCardSettings,
  getDashboardCardDefinition,
  getRenderableDashboardCardIds,
  normalizeDashboardCardSettings,
  toggleDashboardCardSetting,
} from '../dashboardCards';

describe('dashboard card helpers', () => {
  it('returns default card settings in registry order', () => {
    expect(getDefaultDashboardCardSettings()).toEqual([
      { id: 'rainyDay', visible: true },
      { id: 'accounts', visible: true },
      { id: 'recentTransactions', visible: true },
      { id: 'cashFlow', visible: true },
      { id: 'budgetProgress', visible: true },
      { id: 'topSpending', visible: true },
      { id: 'creditCards', visible: true },
      { id: 'balanceSummary', visible: false },
    ]);
  });

  it('keeps balance summary available but hidden by default', () => {
    expect(getDashboardCardDefinition('balanceSummary')).toEqual(expect.objectContaining({
      id: 'balanceSummary',
      title: 'Balance summary',
    }));
    expect(getDefaultDashboardCardSettings().find((setting) => setting.id === 'balanceSummary')?.visible).toBe(false);
  });

  it('normalizes the old untouched default layout to the new default', () => {
    expect(normalizeDashboardCardSettings([
      { id: 'balanceSummary', visible: true },
      { id: 'cashFlow', visible: true },
      'rainyDay',
      'accounts',
      'creditCards',
      'topSpending',
      'recentTransactions',
    ].map((item) => (typeof item === 'string' ? { id: item, visible: true } : item)))).toEqual(
      getDefaultDashboardCardSettings(),
    );

    expect(normalizeDashboardCardSettings([
      { id: 'rainyDay', visible: true },
      { id: 'accounts', visible: true },
      { id: 'recentTransactions', visible: true },
      { id: 'cashFlow', visible: true },
      { id: 'topSpending', visible: true },
      { id: 'creditCards', visible: true },
      { id: 'balanceSummary', visible: false },
    ])).toEqual(getDefaultDashboardCardSettings());
  });

  it('falls back to defaults for missing or corrupt settings', () => {
    expect(normalizeDashboardCardSettings(undefined)).toEqual(getDefaultDashboardCardSettings());
    expect(normalizeDashboardCardSettings({ bad: true })).toEqual(getDefaultDashboardCardSettings());
    expect(normalizeDashboardCardSettings([{ id: 'unknown', visible: false }])).toEqual(
      getDefaultDashboardCardSettings(),
    );
  });

  it('normalizes stored settings while appending new default cards', () => {
    const normalized = normalizeDashboardCardSettings([
      { id: 'recentTransactions', visible: true },
      { id: 'accounts', visible: false },
      { id: 'accounts', visible: true },
    ]);

    expect(normalized.slice(0, 2)).toEqual([
      { id: 'recentTransactions', visible: true },
      { id: 'accounts', visible: false },
    ]);
    expect(normalized.map((setting) => setting.id)).toEqual(
      expect.arrayContaining(['balanceSummary', 'cashFlow', 'rainyDay', 'creditCards', 'budgetProgress', 'topSpending']),
    );
  });

  it('toggles visibility without hiding the final visible card', () => {
    const hiddenRecent = toggleDashboardCardSetting(getDefaultDashboardCardSettings(), 'recentTransactions');

    expect(hiddenRecent.find((setting) => setting.id === 'recentTransactions')?.visible).toBe(false);

    const oneVisible = getDefaultDashboardCardSettings().map((setting) => ({
      ...setting,
      visible: setting.id === 'accounts',
    }));
    expect(toggleDashboardCardSetting(oneVisible, 'accounts')).toEqual(oneVisible);
  });

  it('preserves custom user order and visibility', () => {
    expect(normalizeDashboardCardSettings([
      { id: 'topSpending', visible: true },
      { id: 'accounts', visible: false },
      { id: 'recentTransactions', visible: true },
    ]).slice(0, 3)).toEqual([
      { id: 'topSpending', visible: true },
      { id: 'accounts', visible: false },
      { id: 'recentTransactions', visible: true },
    ]);
  });

  it('returns renderable visible cards and suppresses unavailable cards', () => {
    const settings = toggleDashboardCardSetting(getDefaultDashboardCardSettings(), 'topSpending');

    expect(getRenderableDashboardCardIds(settings, { creditCards: false, budgetProgress: false })).toEqual([
      'rainyDay',
      'accounts',
      'recentTransactions',
      'cashFlow',
    ]);
    expect(getRenderableDashboardCardIds(getDefaultDashboardCardSettings(), { creditCards: true, budgetProgress: true })).toEqual([
      'rainyDay',
      'accounts',
      'recentTransactions',
      'cashFlow',
      'budgetProgress',
      'topSpending',
      'creditCards',
    ]);
    expect(getDashboardCardDefinition('budgetProgress')).toEqual(expect.objectContaining({
      hidesWhenUnavailable: true,
      title: 'Budget progress',
    }));
  });
});
