import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { KeyboardAwareFormScroll } from '../components/FormLayout';
import { FormError } from '../components/ui';
import {
  CategoryEditPage,
  CategoryManagementPage,
  SubcategoryEditPage,
} from '../features/settings/CategorySettingsPages';
import { useCategorySettingsDraft } from '../features/settings/CategorySettingsDraftContext';
import { colors, spacing, typography } from '../theme/tokens';
import { RouteSafeArea, RouteTopBar, routeScaffoldStyles } from './RouteScaffold';
import { useRootStackNavigation, useRootStackRoute } from './routeHooks';

export function CategoryManagementRouteScreen() {
  const navigation = useRootStackNavigation();
  const { categories, dirty, error, saveCategories } = useCategorySettingsDraft();

  return (
    <CategoryRouteShell
      dirty={dirty}
      title="Edit categories"
      onBack={() => navigation.goBack()}
      onSave={saveCategories}
    >
      <CategoryManagementPage
        categories={categories}
        dirty={dirty}
        error={error}
        onBack={() => navigation.goBack()}
        onOpenCategory={(category) => navigation.navigate('CategoryEdit', { categoryId: category.id })}
        onSave={saveCategories}
        showHeader={false}
      />
    </CategoryRouteShell>
  );
}

export function CategoryEditRouteScreen() {
  const navigation = useRootStackNavigation();
  const route = useRootStackRoute<'CategoryEdit'>();
  const { dirty, error, getCategory, saveCategories, updateCategory } = useCategorySettingsDraft();
  const category = getCategory(route.params.categoryId);

  if (!category) {
    return <CategoryRouteMessage message="Category not found." onBack={() => navigation.goBack()} title="Edit category" />;
  }

  return (
    <CategoryRouteShell
      dirty={dirty}
      title={category.name}
      onBack={() => navigation.goBack()}
      onSave={saveCategories}
    >
      <CategoryEditPage
        category={category}
        dirty={dirty}
        error={error}
        onBack={() => navigation.goBack()}
        onOpenSubcategory={(subcategory) =>
          navigation.navigate('SubcategoryEdit', {
            categoryId: category.id,
            subcategoryId: subcategory.id,
          })
        }
        onSave={saveCategories}
        onUpdateCategory={(patch) => updateCategory(category.id, patch)}
        showHeader={false}
      />
    </CategoryRouteShell>
  );
}

export function SubcategoryEditRouteScreen() {
  const navigation = useRootStackNavigation();
  const route = useRootStackRoute<'SubcategoryEdit'>();
  const { dirty, error, getCategory, getSubcategory, saveCategories, updateSubcategory } =
    useCategorySettingsDraft();
  const category = getCategory(route.params.categoryId);
  const subcategory = getSubcategory(route.params.categoryId, route.params.subcategoryId);

  if (!category || !subcategory) {
    return <CategoryRouteMessage message="Subcategory not found." onBack={() => navigation.goBack()} title="Edit subcategory" />;
  }

  return (
    <CategoryRouteShell
      dirty={dirty}
      title={subcategory.name}
      onBack={() => navigation.goBack()}
      onSave={saveCategories}
    >
      <SubcategoryEditPage
        category={category}
        dirty={dirty}
        error={error}
        subcategory={subcategory}
        onBack={() => navigation.goBack()}
        onSave={saveCategories}
        onUpdateSubcategory={(patch) => updateSubcategory(category.id, subcategory.id, patch)}
        showHeader={false}
      />
    </CategoryRouteShell>
  );
}

function CategoryHeaderSaveButton({ dirty, onSave }: { dirty: boolean; onSave: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!dirty}
      onPress={onSave}
      style={({ pressed }) => [
        styles.saveButton,
        !dirty && styles.saveButtonDisabled,
        pressed && routeScaffoldStyles.pressed,
      ]}
    >
      <Text style={[styles.saveButtonText, !dirty && styles.saveButtonTextDisabled]}>Save</Text>
    </Pressable>
  );
}

function CategoryRouteShell({
  children,
  dirty,
  title,
  onBack,
  onSave,
}: {
  children: ReactNode;
  dirty: boolean;
  title: string;
  onBack: () => void;
  onSave: () => void;
}) {
  return (
    <RouteSafeArea>
      <RouteTopBar
        title={title}
        onBack={onBack}
        right={<CategoryHeaderSaveButton dirty={dirty} onSave={onSave} />}
      />
      <KeyboardAwareFormScroll contentContainerStyle={styles.routeContent}>
        {children}
      </KeyboardAwareFormScroll>
    </RouteSafeArea>
  );
}

function CategoryRouteMessage({ message, onBack, title }: { message: string; onBack: () => void; title: string }) {
  return (
    <RouteSafeArea>
      <RouteTopBar
        title={title}
        onBack={onBack}
        right={<CategoryHeaderSaveButton dirty={false} onSave={() => undefined} />}
      />
      <View style={styles.messageBody}>
        <FormError message={message} />
      </View>
    </RouteSafeArea>
  );
}

const styles = StyleSheet.create({
  messageBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  routeContent: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  saveButton: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 64,
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
  },
  saveButtonTextDisabled: {
    color: colors.muted,
  },
});
