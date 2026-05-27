import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryIconBadge, CategoryRow, SubcategoryRow } from '../../components/CategoryDisplay';
import { FormError } from '../../components/ui';
import { getCategorySuggestions, type CategorySuggestionMode } from '../../domain/categorySuggestions';
import {
  defaultCategories,
  getCategory,
  getSubcategory,
  getSubcategoryColor,
  getSubcategoryIcon,
  getSubcategoryName,
} from '../../domain/categories';
import type { CategoryDefinition, Transaction, TransactionLine } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import {
  createCategoryOnlySelection,
  createSubcategorySelection,
  getCategorySelectionCategories,
  getInitialExpandedCategoryId,
  type CategorySelectionKind,
  type CategorySelectionMode,
  type CategorySelectionResult,
} from './categorySelectionModel';

type CategorySelectScreenProps = {
  categories?: CategoryDefinition[];
  kind: CategorySelectionKind;
  selectedCategoryId?: string;
  selectedSubcategoryId?: string | null;
  selectionMode: CategorySelectionMode;
  showSuggestions?: boolean;
  title?: string;
  transactions?: Transaction[];
  transactionLines?: TransactionLine[];
  warning?: string;
  onBack: () => void;
  onCancel?: () => void;
  onSelect: (selection: CategorySelectionResult) => void;
};

type CategorySelectContentProps = Omit<CategorySelectScreenProps, 'onBack' | 'onCancel' | 'title' | 'warning'>;

export function CategorySelectScreen({
  categories = defaultCategories,
  kind,
  onBack,
  onCancel,
  selectedCategoryId,
  selectedSubcategoryId,
  selectionMode,
  showSuggestions = false,
  title = 'Category',
  transactionLines = [],
  transactions = [],
  warning = '',
  onSelect,
}: CategorySelectScreenProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        {onCancel ? (
          <Pressable accessibilityRole="button" onPress={onCancel} style={styles.iconButton} testID="cancel-category-select">
            <Ionicons name="close" size={24} color={colors.primaryDark} />
          </Pressable>
        ) : (
          <View style={styles.iconButtonSpacer} />
        )}
      </View>

      <FormError message={warning} />

      <CategorySelectContent
        categories={categories}
        kind={kind}
        selectedCategoryId={selectedCategoryId}
        selectedSubcategoryId={selectedSubcategoryId}
        selectionMode={selectionMode}
        showSuggestions={showSuggestions}
        transactionLines={transactionLines}
        transactions={transactions}
        onSelect={onSelect}
      />
    </View>
  );
}

export function CategorySelectContent({
  categories: categoryCatalog = defaultCategories,
  kind,
  selectedCategoryId,
  selectedSubcategoryId,
  selectionMode,
  showSuggestions = false,
  transactionLines = [],
  transactions = [],
  onSelect,
}: CategorySelectContentProps) {
  const [expandedCategoryId, setExpandedCategoryId] = useState(
    getInitialExpandedCategoryId({ categories: categoryCatalog, kind, selectedCategoryId }),
  );
  const [suggestionMode, setSuggestionMode] = useState<CategorySuggestionMode>('frequent');
  const categories = getCategorySelectionCategories(categoryCatalog, kind);
  const frequentSuggestions = useMemo(
    () => getCategorySuggestions({ transactions, lines: transactionLines, kind, mode: 'frequent' }),
    [kind, transactionLines, transactions],
  );
  const recentSuggestions = useMemo(
    () => getCategorySuggestions({ transactions, lines: transactionLines, kind, mode: 'recent' }),
    [kind, transactionLines, transactions],
  );
  const hasSuggestions = showSuggestions && (frequentSuggestions.length > 0 || recentSuggestions.length > 0);
  const visibleSuggestions = suggestionMode === 'frequent' ? frequentSuggestions : recentSuggestions;

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {hasSuggestions ? (
        <View style={styles.suggestionPanel}>
          <View style={styles.suggestionTabs}>
            {(['frequent', 'recent'] as CategorySuggestionMode[]).map((option) => (
              <Pressable
                accessibilityRole="button"
                key={option}
                onPress={() => setSuggestionMode(option)}
                style={({ pressed }) => [
                  styles.suggestionTab,
                  suggestionMode === option && styles.suggestionTabSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.suggestionTabText, suggestionMode === option && styles.suggestionTabTextSelected]}>
                  {capitalize(option)}
                </Text>
              </Pressable>
            ))}
          </View>
          {visibleSuggestions.length ? (
            <ScrollView
              horizontal
              contentContainerStyle={styles.categorySuggestionList}
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}
            >
              {visibleSuggestions.map((suggestion) => (
                <CategorySuggestionRow
                  key={`${suggestion.categoryId}:${suggestion.subcategoryId}`}
                  categoryId={suggestion.categoryId}
                  subcategoryId={suggestion.subcategoryId}
                  categories={categoryCatalog}
                  selected={selectedCategoryId === suggestion.categoryId && selectedSubcategoryId === suggestion.subcategoryId}
                  onPress={() => onSelect(createSubcategorySelection(suggestion.categoryId, suggestion.subcategoryId))}
                />
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.emptySuggestionText}>No {suggestionMode} categories yet.</Text>
          )}
        </View>
      ) : null}

      {categories.map((category) => {
        const categorySelected = selectedCategoryId === category.id;
        const expanded = expandedCategoryId === category.id;

        return (
          <View key={category.id} style={styles.categoryGroup}>
            <CategoryRow
              category={category}
              expanded={selectionMode === 'subcategory' ? expanded : categorySelected}
              onPress={() => {
                if (selectionMode === 'category') {
                  onSelect(createCategoryOnlySelection(category.id));
                  return;
                }

                setExpandedCategoryId((currentId) => (currentId === category.id ? '' : category.id));
              }}
              trailingIcon={selectionMode === 'category' && categorySelected ? 'checkmark' : undefined}
            />
            {selectionMode === 'subcategory' && expanded ? (
              <View style={styles.subcategoryList}>
                {category.subcategories.map((subcategory) => (
                  <SubcategoryRow
                    key={subcategory.id}
                    onPress={() => onSelect(createSubcategorySelection(category.id, subcategory.id))}
                    selected={categorySelected && selectedSubcategoryId === subcategory.id}
                    color={subcategory.color}
                    icon={subcategory.icon}
                    name={subcategory.name}
                  />
                ))}
              </View>
            ) : null}
          </View>
        );
      })}

      {!categories.length ? <Text style={styles.emptyText}>No categories available.</Text> : null}
    </ScrollView>
  );
}

function CategorySuggestionRow({
  categoryId,
  subcategoryId,
  categories,
  selected,
  onPress,
}: {
  categoryId: string;
  subcategoryId: string;
  categories: CategoryDefinition[];
  selected: boolean;
  onPress: () => void;
}) {
  const category = getCategory(categoryId, categories);
  const subcategory = getSubcategory(categoryId, subcategoryId, categories);
  const color = getSubcategoryColor(categoryId, subcategoryId, categories);
  const icon = getSubcategoryIcon(categoryId, subcategoryId, categories);
  const label = subcategoryId ? getSubcategoryName(categoryId, subcategoryId, categories) : category.name;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.categorySuggestionRow,
        { borderColor: selected ? color : colors.faint },
        selected && styles.categorySuggestionRowSelected,
        pressed && styles.pressed,
      ]}
    >
      <CategoryIconBadge color={color} icon={icon} size="sm" />
      <View style={styles.categorySuggestionText}>
        <Text numberOfLines={1} style={styles.categorySuggestionTitle}>
          {subcategory?.name ?? label}
        </Text>
      </View>
    </Pressable>
  );
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: spacing.sm,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 44,
  },
  backButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 40,
    paddingRight: spacing.sm,
    width: 88,
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
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  iconButtonSpacer: {
    width: 88,
  },
  list: {
    flexGrow: 1,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  suggestionPanel: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.xs,
  },
  suggestionTabs: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  suggestionTab: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  suggestionTabSelected: {
    backgroundColor: colors.surface,
  },
  suggestionTabText: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '900',
  },
  suggestionTabTextSelected: {
    color: colors.primaryDark,
  },
  categorySuggestionList: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingRight: spacing.xs,
  },
  categorySuggestionRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    maxWidth: 148,
    minHeight: 38,
    minWidth: 104,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  categorySuggestionRowSelected: {
    backgroundColor: '#F4FAFF',
  },
  categorySuggestionText: {
    flexShrink: 1,
    minWidth: 0,
  },
  categorySuggestionTitle: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
  },
  emptySuggestionText: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
    paddingHorizontal: spacing.xs,
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
