import type { DashboardCardId, DashboardCardSetting } from './types';

export type DashboardCardDefinition = {
  id: DashboardCardId;
  title: string;
  description: string;
  previewText: string;
  defaultVisible: boolean;
  defaultOrder: number;
  hidesWhenUnavailable?: boolean;
  unavailableReason?: string;
};

export type DashboardCardAddOption = DashboardCardDefinition & {
  available: boolean;
  unavailableReason: string;
};

export type DashboardCardAvailability = Partial<Record<DashboardCardId, boolean>>;

export const dashboardCardRegistry: DashboardCardDefinition[] = [
  {
    id: 'balanceSummary',
    title: 'Balance summary',
    description: 'Totals grouped by currency.',
    previewText: 'AUD total, USD total, and other account currencies.',
    defaultVisible: false,
    defaultOrder: 7,
  },
  {
    id: 'cashFlow',
    title: 'This month',
    description: 'Income, spending, and net cash flow for this month.',
    previewText: 'Income, spending, and net amount at a glance.',
    defaultVisible: true,
    defaultOrder: 3,
  },
  {
    id: 'rainyDay',
    title: 'Rainy day fund',
    description: 'Rainy day fund progress and goal.',
    previewText: 'Progress bar, saved amount, and goal.',
    defaultVisible: true,
    defaultOrder: 0,
  },
  {
    id: 'accounts',
    title: 'Accounts',
    description: 'Dashboard account balances and account filter chips.',
    previewText: 'Selected account tiles with current balances.',
    defaultVisible: true,
    defaultOrder: 1,
  },
  {
    id: 'creditCards',
    title: 'Credit cards',
    description: 'Owed, available credit, and utilization when credit cards exist.',
    previewText: 'Total owed, available credit, utilization, and per-card summary.',
    defaultVisible: true,
    defaultOrder: 6,
    hidesWhenUnavailable: true,
    unavailableReason: 'Add a credit card account to use this card.',
  },
  {
    id: 'budgetProgress',
    title: 'Budget progress',
    description: 'Monthly budget progress when active budgets exist.',
    previewText: 'Highest-risk budgets with used, limit, remaining, and progress.',
    defaultVisible: true,
    defaultOrder: 4,
    hidesWhenUnavailable: true,
    unavailableReason: 'Create an active budget to use this card.',
  },
  {
    id: 'topSpending',
    title: 'Top spending',
    description: 'Largest spending categories for this month.',
    previewText: 'Top categories with icons and amounts.',
    defaultVisible: true,
    defaultOrder: 5,
  },
  {
    id: 'recentTransactions',
    title: 'Recent transactions',
    description: 'Latest transactions from selected dashboard accounts.',
    previewText: 'Recent parent transactions with split child rows when needed.',
    defaultVisible: true,
    defaultOrder: 2,
  },
];

const registryIds = new Set<DashboardCardId>(dashboardCardRegistry.map((card) => card.id));
const oldUntouchedDefaultSettings: DashboardCardSetting[] = [
  { id: 'balanceSummary', visible: true },
  { id: 'cashFlow', visible: true },
  { id: 'rainyDay', visible: true },
  { id: 'accounts', visible: true },
  { id: 'creditCards', visible: true },
  { id: 'topSpending', visible: true },
  { id: 'recentTransactions', visible: true },
];

const previousUntouchedDefaultSettings: DashboardCardSetting[] = [
  { id: 'rainyDay', visible: true },
  { id: 'accounts', visible: true },
  { id: 'recentTransactions', visible: true },
  { id: 'cashFlow', visible: true },
  { id: 'topSpending', visible: true },
  { id: 'creditCards', visible: true },
  { id: 'balanceSummary', visible: false },
];

export function getDefaultDashboardCardSettings(): DashboardCardSetting[] {
  return dashboardCardRegistry
    .slice()
    .sort((left, right) => left.defaultOrder - right.defaultOrder)
    .map((card) => ({
      id: card.id,
      visible: card.defaultVisible,
    }));
}

export function normalizeDashboardCardSettings(value: unknown): DashboardCardSetting[] {
  const defaults = getDefaultDashboardCardSettings();
  if (!Array.isArray(value)) {
    return defaults;
  }

  if (
    isSameDashboardCardSettings(value, oldUntouchedDefaultSettings) ||
    isSameDashboardCardSettings(value, previousUntouchedDefaultSettings)
  ) {
    return defaults;
  }

  const normalized: DashboardCardSetting[] = [];
  for (const item of value) {
    if (!isDashboardCardSettingLike(item) || !registryIds.has(item.id)) {
      continue;
    }

    if (normalized.some((setting) => setting.id === item.id)) {
      continue;
    }

    normalized.push({
      id: item.id,
      visible: item.visible,
    });
  }

  for (const defaultSetting of defaults) {
    if (!normalized.some((setting) => setting.id === defaultSetting.id)) {
      normalized.push(defaultSetting);
    }
  }

  return normalized;
}

export function getDashboardCardDefinition(id: DashboardCardId): DashboardCardDefinition {
  const definition = dashboardCardRegistry.find((card) => card.id === id);
  if (!definition) {
    throw new Error(`Unknown dashboard card ${id}`);
  }

  return definition;
}

export function getRenderableDashboardCardIds(
  settings: DashboardCardSetting[] | null | undefined,
  availability: DashboardCardAvailability = {},
): DashboardCardId[] {
  return normalizeDashboardCardSettings(settings)
    .filter((setting) => setting.visible)
    .filter((setting) => availability[setting.id] !== false)
    .map((setting) => setting.id);
}

export function getVisibleDashboardCardSettings(
  settings: DashboardCardSetting[] | null | undefined,
): DashboardCardSetting[] {
  return normalizeDashboardCardSettings(settings).filter((setting) => setting.visible);
}

export function getDashboardCardAddOptions(
  settings: DashboardCardSetting[] | null | undefined,
  availability: DashboardCardAvailability = {},
): DashboardCardAddOption[] {
  return normalizeDashboardCardSettings(settings)
    .filter((setting) => !setting.visible)
    .map((setting) => {
      const definition = getDashboardCardDefinition(setting.id);
      const available = availability[setting.id] !== false;
      return {
        ...definition,
        available,
        unavailableReason: available ? '' : definition.unavailableReason ?? 'This card is not available yet.',
      };
    });
}

export function addDashboardCardSetting(
  settings: DashboardCardSetting[] | null | undefined,
  id: DashboardCardId,
): DashboardCardSetting[] {
  return normalizeDashboardCardSettings(settings).map((setting) => (
    setting.id === id ? { ...setting, visible: true } : setting
  ));
}

export function hideDashboardCardSetting(
  settings: DashboardCardSetting[] | null | undefined,
  id: DashboardCardId,
): DashboardCardSetting[] {
  const normalized = normalizeDashboardCardSettings(settings);
  const visibleCount = normalized.filter((setting) => setting.visible).length;

  return normalized.map((setting) => {
    if (setting.id !== id || (setting.visible && visibleCount <= 1)) {
      return setting;
    }

    return {
      ...setting,
      visible: false,
    };
  });
}

export function reorderVisibleDashboardCardSettings(
  settings: DashboardCardSetting[] | null | undefined,
  orderedVisibleIds: DashboardCardId[],
): DashboardCardSetting[] {
  const normalized = normalizeDashboardCardSettings(settings);
  const normalizedById = new Map(normalized.map((setting) => [setting.id, setting]));
  const seen = new Set<DashboardCardId>();
  const orderedVisibleSettings: DashboardCardSetting[] = [];

  for (const id of orderedVisibleIds) {
    const setting = normalizedById.get(id);
    if (!setting || seen.has(id)) {
      continue;
    }

    seen.add(id);
    orderedVisibleSettings.push({ ...setting, visible: true });
  }

  const remainingVisibleSettings = normalized.filter((setting) => setting.visible && !seen.has(setting.id));
  const hiddenSettings = normalized.filter((setting) => !setting.visible);

  return [
    ...orderedVisibleSettings,
    ...remainingVisibleSettings,
    ...hiddenSettings,
  ];
}

export function toggleDashboardCardSetting(
  settings: DashboardCardSetting[] | null | undefined,
  id: DashboardCardId,
): DashboardCardSetting[] {
  const normalized = normalizeDashboardCardSettings(settings);
  const visibleCount = normalized.filter((setting) => setting.visible).length;

  return normalized.map((setting) => {
    if (setting.id !== id) {
      return setting;
    }

    if (setting.visible && visibleCount <= 1) {
      return setting;
    }

    return {
      ...setting,
      visible: !setting.visible,
    };
  });
}

function isDashboardCardSettingLike(value: unknown): value is DashboardCardSetting {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as DashboardCardSetting).id === 'string' &&
    typeof (value as DashboardCardSetting).visible === 'boolean'
  );
}

function isSameDashboardCardSettings(left: unknown[], right: DashboardCardSetting[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => (
    isDashboardCardSettingLike(item) &&
    item.id === right[index].id &&
    item.visible === right[index].visible
  ));
}
