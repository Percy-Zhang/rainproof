import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  CategoryIconBadge,
} from '../../components/CategoryDisplay';
import { Card, SectionHeader } from '../../components/ui';
import {
  defaultCategories,
  sanitizeCategoryCatalog,
} from '../../domain/categories';
import {
  getCurrencyName,
  uniqueCurrencyCodes,
} from '../../domain/currencyCatalog';
import { getCurrencySymbol } from '../../domain/money';
import type {
  AppSnapshot,
  CategoryDefinition,
  SubcategoryDefinition,
  UpdateAppSettingsInput,
  UpdateCategoryCatalogInput,
} from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import {
  CategoryEditPage,
  CategoryManagementPage,
  SubcategoryEditPage,
} from './CategorySettingsPages';

type SettingsScreenProps = {
  snapshot: AppSnapshot;
  onUpdateCategoryCatalog: (input: UpdateCategoryCatalogInput) => Promise<void>;
  onUpdateSettings: (input: UpdateAppSettingsInput) => Promise<void>;
};

type SettingsPage = 'settings' | 'categories' | 'category' | 'subcategory';

export function SettingsScreen({ snapshot, onUpdateCategoryCatalog }: SettingsScreenProps) {
  const accountCurrencyCodes = uniqueCurrencyCodes(snapshot.accounts.map((account) => account.currencyCode));
  const displayCurrencyCodes = accountCurrencyCodes.length ? accountCurrencyCodes : [snapshot.settings.defaultCurrencyCode];
  const [page, setPage] = useState<SettingsPage>('settings');
  const [draftCategories, setDraftCategories] = useState(() => sanitizeCategoryCatalog(snapshot.categories ?? defaultCategories));
  const [selectedCategoryId, setSelectedCategoryId] = useState(draftCategories[0]?.id ?? '');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(draftCategories[0]?.subcategories[0]?.id ?? '');
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!dirty) {
      const nextCategories = sanitizeCategoryCatalog(snapshot.categories ?? defaultCategories);
      setDraftCategories(nextCategories);
      setSelectedCategoryId((currentId) =>
        nextCategories.some((category) => category.id === currentId) ? currentId : nextCategories[0]?.id ?? '',
      );
      setSelectedSubcategoryId((currentId) =>
        nextCategories.some((category) => category.subcategories.some((subcategory) => subcategory.id === currentId))
          ? currentId
          : nextCategories[0]?.subcategories[0]?.id ?? '',
      );
    }
  }, [dirty, snapshot.categories]);

  const selectedCategory = useMemo(
    () => draftCategories.find((category) => category.id === selectedCategoryId) ?? draftCategories[0],
    [draftCategories, selectedCategoryId],
  );
  const selectedSubcategory = useMemo(
    () => selectedCategory?.subcategories.find((subcategory) => subcategory.id === selectedSubcategoryId) ?? selectedCategory?.subcategories[0],
    [selectedCategory, selectedSubcategoryId],
  );

  function openCategory(category: CategoryDefinition) {
    setSelectedCategoryId(category.id);
    setSelectedSubcategoryId(category.subcategories[0]?.id ?? '');
    setPage('category');
  }

  function openSubcategory(subcategory: SubcategoryDefinition) {
    setSelectedSubcategoryId(subcategory.id);
    setPage('subcategory');
  }

  function updateCategory(patch: Partial<Pick<CategoryDefinition, 'name' | 'color' | 'icon'>>) {
    if (!selectedCategory) {
      return;
    }

    setDirty(true);
    setDraftCategories((currentCategories) =>
      currentCategories.map((category) =>
        category.id === selectedCategory.id ? { ...category, ...patch } : category,
      ),
    );
  }

  function updateSubcategory(patch: Partial<Pick<SubcategoryDefinition, 'name' | 'color' | 'icon'>>) {
    if (!selectedCategory || !selectedSubcategory) {
      return;
    }

    setDirty(true);
    setDraftCategories((currentCategories) =>
      currentCategories.map((category) =>
        category.id === selectedCategory.id
          ? {
              ...category,
              subcategories: category.subcategories.map((subcategory) =>
                subcategory.id === selectedSubcategory.id ? { ...subcategory, ...patch } : subcategory,
              ),
            }
          : category,
      ),
    );
  }

  async function saveCategories() {
    try {
      await onUpdateCategoryCatalog({ categories: sanitizeCategoryCatalog(draftCategories) });
      setDirty(false);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save categories.');
    }
  }

  if (page === 'categories') {
    return (
      <CategoryManagementPage
        categories={draftCategories}
        dirty={dirty}
        error={error}
        onBack={() => setPage('settings')}
        onOpenCategory={openCategory}
        onSave={saveCategories}
      />
    );
  }

  if (page === 'category' && selectedCategory) {
    return (
      <CategoryEditPage
        category={selectedCategory}
        dirty={dirty}
        error={error}
        onBack={() => setPage('categories')}
        onOpenSubcategory={openSubcategory}
        onSave={saveCategories}
        onUpdateCategory={updateCategory}
      />
    );
  }

  if (page === 'subcategory' && selectedCategory && selectedSubcategory) {
    return (
      <SubcategoryEditPage
        category={selectedCategory}
        dirty={dirty}
        error={error}
        subcategory={selectedSubcategory}
        onBack={() => setPage('category')}
        onSave={saveCategories}
        onUpdateSubcategory={updateSubcategory}
      />
    );
  }

  return (
    <View style={styles.stack}>
      <SectionHeader title="Settings" detail="App defaults, currency behavior, and categories." />

      <Card testID="currency-settings-card">
        <Text style={styles.cardTitle}>Currency</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Default currency</Text>
            <Text style={styles.smallMuted}>
              New accounts default to this currency, detected from your device when Rainproof is first set up.
            </Text>
          </View>
          <Text style={styles.currencyBadge}>
            {snapshot.settings.defaultCurrencyCode} {getCurrencySymbol(snapshot.settings.defaultCurrencyCode)}
          </Text>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Currency display</Text>
            <Text style={styles.smallMuted}>
              Rainproof automatically shows currency codes when accounts use more than one currency.
            </Text>
          </View>
          <Text style={styles.currencyBadge}>
            {snapshot.settings.multiCurrencyEnabled ? 'Multiple' : 'Single'}
          </Text>
        </View>

        <View style={styles.currencyList}>
          {displayCurrencyCodes.map((currencyCode) => (
            <View key={currencyCode} style={styles.currencyRow}>
              <Text style={styles.currencyPillText}>
                {currencyCode} {getCurrencySymbol(currencyCode)}
              </Text>
              <Text style={styles.smallMuted}>{getCurrencyName(currencyCode)}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card testID="category-settings-card">
        <Text style={styles.cardTitle}>Categories</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setPage('categories')}
          style={({ pressed }) => [styles.settingsNavRow, pressed && styles.pressed]}
        >
          <CategoryIconBadge color={colors.primary} icon="pricetags-outline" size="md" />
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Edit categories</Text>
            <Text style={styles.smallMuted}>Names, colors, icons, and subcategories.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      </Card>

      <Text style={styles.note}>
        Currency conversion and exchange rates are not active yet. Until then, balances remain separated internally by
        currency.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '800',
  },
  settingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  settingsNavRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  settingText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  settingTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '800',
  },
  smallMuted: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
  },
  currencyBadge: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
  },
  currencyList: {
    gap: spacing.sm,
  },
  currencyRow: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  currencyPillText: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '800',
  },
  note: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    paddingBottom: spacing.xl,
  },
  pressed: {
    opacity: 0.78,
  },
});
