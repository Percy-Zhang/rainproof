import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLayoutEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FormError } from '../components/ui';
import {
  CategoryEditPage,
  CategoryManagementPage,
  SubcategoryEditPage,
} from '../features/settings/CategorySettingsPages';
import { useCategorySettingsDraft } from '../features/settings/CategorySettingsDraftContext';
import { colors, spacing, typography } from '../theme/tokens';
import type { RootStackParamList } from './routes';

type RootStackNavigation = NativeStackNavigationProp<RootStackParamList>;

export function CategoryManagementRouteScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const { categories, dirty, error, saveCategories } = useCategorySettingsDraft();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <CategoryHeaderSaveButton dirty={dirty} onSave={saveCategories} />,
      title: 'Edit categories',
    });
  }, [dirty, navigation, saveCategories]);

  return (
    <CategoryRouteShell>
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
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'CategoryEdit'>>();
  const { dirty, error, getCategory, saveCategories, updateCategory } = useCategorySettingsDraft();
  const category = getCategory(route.params.categoryId);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: category
        ? () => <CategoryHeaderSaveButton dirty={dirty} onSave={saveCategories} />
        : undefined,
      title: category?.name ?? 'Edit category',
    });
  }, [category, dirty, navigation, saveCategories]);

  if (!category) {
    return <CategoryRouteMessage message="Category not found." />;
  }

  return (
    <CategoryRouteShell>
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
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'SubcategoryEdit'>>();
  const { dirty, error, getCategory, getSubcategory, saveCategories, updateSubcategory } =
    useCategorySettingsDraft();
  const category = getCategory(route.params.categoryId);
  const subcategory = getSubcategory(route.params.categoryId, route.params.subcategoryId);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: category && subcategory
        ? () => <CategoryHeaderSaveButton dirty={dirty} onSave={saveCategories} />
        : undefined,
      title: subcategory?.name ?? 'Edit subcategory',
    });
  }, [category, dirty, navigation, saveCategories, subcategory]);

  if (!category || !subcategory) {
    return <CategoryRouteMessage message="Subcategory not found." />;
  }

  return (
    <CategoryRouteShell>
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
      style={({ pressed }) => [styles.saveButton, !dirty && styles.saveButtonDisabled, pressed && styles.pressed]}
    >
      <Text style={[styles.saveButtonText, !dirty && styles.saveButtonTextDisabled]}>Save</Text>
    </Pressable>
  );
}

function CategoryRouteShell({ children }: { children: ReactNode }) {
  return (
    <View style={styles.routeShell}>
      <ScrollView
        contentContainerStyle={styles.routeContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

function CategoryRouteMessage({ message }: { message: string }) {
  return (
    <View style={styles.messageShell}>
      <FormError message={message} />
    </View>
  );
}

const styles = StyleSheet.create({
  messageShell: {
    backgroundColor: colors.background,
    flex: 1,
    padding: spacing.lg,
  },
  pressed: {
    opacity: 0.78,
  },
  routeContent: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  routeShell: {
    backgroundColor: colors.background,
    flex: 1,
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
