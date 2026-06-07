import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryRow, SubcategoryRow } from '../../components/CategoryDisplay';
import { defaultCategories } from '../../domain/categories';
import type { BudgetScopeItem, CategoryDefinition } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import {
  getBudgetScopeParentSelectionState,
  isBudgetScopeSubcategorySelected,
  normalizeBudgetScopePickerItems,
  toggleBudgetScopeParentSelection,
  toggleBudgetScopeSubcategorySelection,
  type BudgetScopeSelectionMode,
} from './budgetScopeSelectionModel';

type BudgetScopeSelectScreenProps = {
  categories?: CategoryDefinition[];
  mode: BudgetScopeSelectionMode;
  selectedItems: BudgetScopeItem[];
  onBack: () => void;
  onConfirm: (scopeItems: BudgetScopeItem[]) => void;
};

export function BudgetScopeSelectScreen({
  categories: categoryCatalog = defaultCategories,
  mode,
  selectedItems,
  onBack,
  onConfirm,
}: BudgetScopeSelectScreenProps) {
  const categories = useMemo(
    () => categoryCatalog.filter((category) => category.type === 'expense'),
    [categoryCatalog],
  );
  const [draftItems, setDraftItems] = useState(() =>
    normalizeBudgetScopePickerItems(selectedItems, categories),
  );
  const title = mode === 'include' ? 'Include categories' : 'Exclude categories';

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={styles.backButton}
          testID="cancel-budget-scope-select"
        >
          <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => onConfirm(draftItems)}
          style={({ pressed }) => [
            styles.confirmButton,
            pressed && styles.pressed,
          ]}
          testID="confirm-budget-scope-select"
        >
          <Text style={styles.confirmButtonText}>Confirm</Text>
        </Pressable>
      </View>

      <View style={styles.intro}>
        <Text style={styles.introText}>
          Tap a category to select all of its subcategories, or choose individual subcategories.
        </Text>
        <Text style={styles.selectionCount}>
          {formatSelectionCount(draftItems.length)}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {categories.map((category) => {
          const parentState = getBudgetScopeParentSelectionState(draftItems, category);

          return (
            <View key={category.id} style={styles.categoryGroup}>
              <CategoryRow
                accessibilityLabel={`${category.name}, ${getParentAccessibilityLabel(parentState)}`}
                accessibilityState={{
                  checked: parentState === 'partial' ? 'mixed' : parentState === 'checked',
                }}
                category={category}
                expanded={parentState !== 'unchecked'}
                onPress={() => {
                  setDraftItems((currentItems) =>
                    toggleBudgetScopeParentSelection(currentItems, category, categories),
                  );
                }}
                testID={`budget-scope-category-${category.id}`}
                trailingIcon={getParentTrailingIcon(parentState)}
              />
              <View style={styles.subcategoryList}>
                {category.subcategories.map((subcategory) => {
                  const selected = isBudgetScopeSubcategorySelected(
                    draftItems,
                    category.id,
                    subcategory.id,
                  );

                  return (
                    <SubcategoryRow
                      accessibilityLabel={`${subcategory.name}, ${selected ? 'selected' : 'not selected'}`}
                      accessibilityState={{ checked: selected }}
                      color={subcategory.color}
                      icon={subcategory.icon}
                      key={subcategory.id}
                      name={subcategory.name}
                      onPress={() => {
                        setDraftItems((currentItems) =>
                          toggleBudgetScopeSubcategorySelection(
                            currentItems,
                            category,
                            subcategory.id,
                            categories,
                          ),
                        );
                      }}
                      selected={selected}
                      testID={`budget-scope-subcategory-${category.id}-${subcategory.id}`}
                      trailingIcon={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}

        {!categories.length ? (
          <Text style={styles.emptyText}>No expense categories available.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function getParentTrailingIcon(
  state: ReturnType<typeof getBudgetScopeParentSelectionState>,
): keyof typeof Ionicons.glyphMap {
  if (state === 'checked') {
    return 'checkmark-circle';
  }

  if (state === 'partial') {
    return 'remove-circle';
  }

  return 'ellipse-outline';
}

function getParentAccessibilityLabel(
  state: ReturnType<typeof getBudgetScopeParentSelectionState>,
): string {
  if (state === 'checked') {
    return 'selected';
  }

  if (state === 'partial') {
    return 'partially selected';
  }

  return 'not selected';
}

function formatSelectionCount(count: number): string {
  if (!count) {
    return 'No selections';
  }

  return `${count} ${count === 1 ? 'selection' : 'selections'}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: spacing.sm,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 44,
  },
  backButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 40,
    paddingRight: spacing.xs,
    width: 84,
  },
  backButtonText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '800',
  },
  title: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.h2,
    fontWeight: '900',
    textAlign: 'center',
  },
  confirmButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    width: 84,
  },
  confirmButtonText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
  },
  intro: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  introText: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '700',
    lineHeight: 18,
  },
  selectionCount: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
  },
  list: {
    flexGrow: 1,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  categoryGroup: {
    gap: spacing.xs,
  },
  subcategoryList: {
    gap: spacing.xs,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
    fontWeight: '700',
    padding: spacing.md,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.78,
  },
});
