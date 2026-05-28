import {
  addDashboardCardSetting,
  getDefaultDashboardCardSettings,
  getDashboardCardAddOptions,
  getDashboardCardDefinition,
  getRenderableDashboardCardIds,
  getVisibleDashboardCardSettings,
  hideDashboardCardSetting,
  normalizeDashboardCardSettings,
  reorderVisibleDashboardCardSettings,
  toggleDashboardCardSetting,
} from '../dashboardCards';

describe('dashboard card helpers', () => {
  it('returns default card settings in registry order', () => {
    expect(getDefaultDashboardCardSettings()).toEqual([
      { id: 'rainyDay', visible: true },
      { id: 'accounts', visible: true },
      { id: 'recentTransactions', visible: true },
      { id: 'upcomingPayments', visible: true },
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
      description: 'Totals grouped by currency.',
      previewText: 'AUD total, USD total, and other account currencies.',
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
      { id: 'budgetProgress', visible: true },
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
      expect.arrayContaining([
        'balanceSummary',
        'cashFlow',
        'rainyDay',
        'creditCards',
        'budgetProgress',
        'upcomingPayments',
        'topSpending',
      ]),
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

    expect(getRenderableDashboardCardIds(settings, {
      budgetProgress: false,
      creditCards: false,
      upcomingPayments: false,
    })).toEqual([
      'rainyDay',
      'accounts',
      'recentTransactions',
      'cashFlow',
    ]);
    expect(getRenderableDashboardCardIds(getDefaultDashboardCardSettings(), {
      budgetProgress: true,
      creditCards: true,
      upcomingPayments: true,
    })).toEqual([
      'rainyDay',
      'accounts',
      'recentTransactions',
      'upcomingPayments',
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

  it('returns visible settings in saved order', () => {
    expect(getVisibleDashboardCardSettings(getDefaultDashboardCardSettings()).map((setting) => setting.id)).toEqual([
      'rainyDay',
      'accounts',
      'recentTransactions',
      'upcomingPayments',
      'cashFlow',
      'budgetProgress',
      'topSpending',
      'creditCards',
    ]);
  });

  it('lists hidden and unavailable cards for add-card UI', () => {
    const settings = getDefaultDashboardCardSettings().map((setting) => (
      setting.id === 'creditCards' || setting.id === 'upcomingPayments' ? { ...setting, visible: false } : setting
    ));
    const options = getDashboardCardAddOptions(settings, {
      budgetProgress: false,
      creditCards: false,
      upcomingPayments: false,
    });

    expect(options.map((option) => option.id)).toEqual(['upcomingPayments', 'creditCards', 'balanceSummary']);
    expect(options.find((option) => option.id === 'upcomingPayments')).toEqual(expect.objectContaining({
      available: false,
      title: 'Upcoming Payments',
      unavailableReason: 'Add an active recurring item to use this card.',
    }));
    expect(options.find((option) => option.id === 'creditCards')).toEqual(expect.objectContaining({
      available: false,
      unavailableReason: 'Add a credit card account to use this card.',
    }));
    expect(options.find((option) => option.id === 'balanceSummary')).toEqual(expect.objectContaining({
      available: true,
      description: 'Totals grouped by currency.',
      previewText: 'AUD total, USD total, and other account currencies.',
    }));
  });

  it('adds a hidden card without changing the saved order', () => {
    const settings = addDashboardCardSetting(getDefaultDashboardCardSettings(), 'balanceSummary');

    expect(settings[settings.length - 1]).toEqual({ id: 'balanceSummary', visible: true });
  });

  it('hides a card without hiding the final visible card', () => {
    const settings = hideDashboardCardSetting(getDefaultDashboardCardSettings(), 'topSpending');

    expect(settings.find((setting) => setting.id === 'topSpending')?.visible).toBe(false);

    const oneVisible = getDefaultDashboardCardSettings().map((setting) => ({
      ...setting,
      visible: setting.id === 'accounts',
    }));
    expect(hideDashboardCardSetting(oneVisible, 'accounts')).toEqual(oneVisible);
  });

  it('reorders visible cards while keeping hidden cards available', () => {
    const settings = hideDashboardCardSetting(getDefaultDashboardCardSettings(), 'topSpending');
    const reordered = reorderVisibleDashboardCardSettings(settings, ['cashFlow', 'accounts', 'rainyDay']);

    expect(reordered.slice(0, 3)).toEqual([
      { id: 'cashFlow', visible: true },
      { id: 'accounts', visible: true },
      { id: 'rainyDay', visible: true },
    ]);
    expect(reordered.slice(-2)).toEqual([
      { id: 'topSpending', visible: false },
      { id: 'balanceSummary', visible: false },
    ]);
  });
});
