import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'CategoryEdit'>>();
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
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'SubcategoryEdit'>>();
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
      style={({ pressed }) => [styles.saveButton, !dirty && styles.saveButtonDisabled, pressed && styles.pressed]}
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
    <SafeAreaView style={styles.routeShell}>
      <CategoryTopBar dirty={dirty} title={title} onBack={onBack} onSave={onSave} />
      <ScrollView
        contentContainerStyle={styles.routeContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function CategoryRouteMessage({ message, onBack, title }: { message: string; onBack: () => void; title: string }) {
  return (
    <SafeAreaView style={styles.messageShell}>
      <CategoryTopBar dirty={false} title={title} onBack={onBack} onSave={() => undefined} />
      <View style={styles.messageBody}>
        <FormError message={message} />
      </View>
    </SafeAreaView>
  );
}

function CategoryTopBar({
  dirty,
  title,
  onBack,
  onSave,
}: {
  dirty: boolean;
  title: string;
  onBack: () => void;
  onSave: () => void;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable
        accessibilityRole="button"
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>
      <Text numberOfLines={1} style={styles.routeTitle}>{title}</Text>
      <View style={styles.saveSlot}>
        <CategoryHeaderSaveButton dirty={dirty} onSave={onSave} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  messageShell: {
    backgroundColor: colors.background,
    flex: 1,
  },
  messageBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  pressed: {
    opacity: 0.78,
  },
  routeContent: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  routeShell: {
    backgroundColor: colors.background,
    flex: 1,
  },
  routeTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.h3,
    fontWeight: '900',
    textAlign: 'center',
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
  saveSlot: {
    alignItems: 'flex-end',
    width: 88,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
});
