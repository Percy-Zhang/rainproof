import type { DashboardCardId, DashboardCardSetting } from './types';

export type DashboardCardDefinition = {
  id: DashboardCardId;
  title: string;
  defaultVisible: boolean;
  defaultOrder: number;
  hidesWhenUnavailable?: boolean;
};

export const dashboardCardRegistry: DashboardCardDefinition[] = [
  {
    id: 'balanceSummary',
    title: 'Balance summary',
    defaultVisible: false,
    defaultOrder: 7,
  },
  {
    id: 'cashFlow',
    title: 'This month',
    defaultVisible: true,
    defaultOrder: 3,
  },
  {
    id: 'rainyDay',
    title: 'Rainy day fund',
    defaultVisible: true,
    defaultOrder: 0,
  },
  {
    id: 'accounts',
    title: 'Accounts',
    defaultVisible: true,
    defaultOrder: 1,
  },
  {
    id: 'creditCards',
    title: 'Credit cards',
    defaultVisible: true,
    defaultOrder: 6,
    hidesWhenUnavailable: true,
  },
  {
    id: 'budgetProgress',
    title: 'Budget progress',
    defaultVisible: true,
    defaultOrder: 4,
    hidesWhenUnavailable: true,
  },
  {
    id: 'topSpending',
    title: 'Top spending',
    defaultVisible: true,
    defaultOrder: 5,
  },
  {
    id: 'recentTransactions',
    title: 'Recent transactions',
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
  availability: Partial<Record<DashboardCardId, boolean>> = {},
): DashboardCardId[] {
  return normalizeDashboardCardSettings(settings)
    .filter((setting) => setting.visible)
    .filter((setting) => availability[setting.id] !== false)
    .map((setting) => setting.id);
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
