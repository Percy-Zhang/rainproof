import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  CategoryIconBadge,
  CategoryRow,
  ColorPresetPicker,
  IconPresetPicker,
  SubcategoryRow,
} from '../../components/CategoryDisplay';
import { Card, FormError } from '../../components/ui';
import {
  categoryPresetColors,
  categoryPresetIcons,
} from '../../domain/categories';
import type { CategoryDefinition, SubcategoryDefinition } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';

type CategoryPatch = Partial<Pick<CategoryDefinition, 'name' | 'color' | 'icon'>>;
type SubcategoryPatch = Partial<Pick<SubcategoryDefinition, 'name' | 'color' | 'icon'>>;

type CategoryPageHeaderProps = {
  title: string;
  dirty: boolean;
  onBack: () => void;
  onSave: () => void;
};

export function CategoryPageHeader({ title, dirty, onBack, onSave }: CategoryPageHeaderProps) {
  return (
    <View style={styles.pageHeader}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>
      <Text numberOfLines={1} style={styles.pageTitle}>
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled={!dirty}
        onPress={onSave}
        style={({ pressed }) => [styles.saveButton, !dirty && styles.saveButtonDisabled, pressed && styles.pressed]}
      >
        <Text style={[styles.saveButtonText, !dirty && styles.saveButtonTextDisabled]}>Save</Text>
      </Pressable>
    </View>
  );
}

export function CategoryManagementPage({
  categories,
  dirty,
  error,
  onBack,
  onSave,
  onOpenCategory,
}: {
  categories: CategoryDefinition[];
  dirty: boolean;
  error: string;
  onBack: () => void;
  onSave: () => void;
  onOpenCategory: (category: CategoryDefinition) => void;
}) {
  return (
    <View style={styles.stack}>
      <CategoryPageHeader title="Edit categories" dirty={dirty} onBack={onBack} onSave={onSave} />
      <FormError message={error} />
      <Card testID="category-management-card">
        <View style={styles.categoryList}>
          {categories.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              onPress={() => onOpenCategory(category)}
              trailingIcon="chevron-forward"
            />
          ))}
        </View>
      </Card>
    </View>
  );
}

export function CategoryEditPage({
  category,
  dirty,
  error,
  onBack,
  onSave,
  onUpdateCategory,
  onOpenSubcategory,
}: {
  category: CategoryDefinition;
  dirty: boolean;
  error: string;
  onBack: () => void;
  onSave: () => void;
  onUpdateCategory: (patch: CategoryPatch) => void;
  onOpenSubcategory: (subcategory: SubcategoryDefinition) => void;
}) {
  return (
    <View style={styles.stack}>
      <CategoryPageHeader title={category.name} dirty={dirty} onBack={onBack} onSave={onSave} />
      <FormError message={error} />
      <Card testID="category-edit-card">
        <EditorHeader title="Category" color={category.color} icon={category.icon} />
        <LabeledInput label="Name" value={category.name} onChangeText={(name) => onUpdateCategory({ name })} />
        <Text style={styles.label}>Color</Text>
        <ColorPresetPicker
          colors={categoryPresetColors}
          selectedColor={category.color}
          onSelectColor={(color) => onUpdateCategory({ color })}
        />
        <Text style={styles.label}>Icon</Text>
        <IconPresetPicker
          icons={categoryPresetIcons}
          selectedColor={category.color}
          selectedIcon={category.icon}
          onSelectIcon={(icon) => onUpdateCategory({ icon })}
        />
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Subcategories</Text>
        <View style={styles.subcategoryList}>
          {category.subcategories.map((subcategory) => (
            <SubcategoryRow
              key={subcategory.id}
              color={subcategory.color}
              icon={subcategory.icon}
              name={subcategory.name}
              onPress={() => onOpenSubcategory(subcategory)}
            />
          ))}
        </View>
      </Card>
    </View>
  );
}

export function SubcategoryEditPage({
  category,
  dirty,
  error,
  subcategory,
  onBack,
  onSave,
  onUpdateSubcategory,
}: {
  category: CategoryDefinition;
  dirty: boolean;
  error: string;
  subcategory: SubcategoryDefinition;
  onBack: () => void;
  onSave: () => void;
  onUpdateSubcategory: (patch: SubcategoryPatch) => void;
}) {
  return (
    <View style={styles.stack}>
      <CategoryPageHeader title={subcategory.name} dirty={dirty} onBack={onBack} onSave={onSave} />
      <FormError message={error} />
      <Card testID="subcategory-edit-card">
        <EditorHeader title={category.name} color={category.color} icon={category.icon} />
        <EditorHeader title="Subcategory" color={subcategory.color} icon={subcategory.icon} />
        <LabeledInput
          label="Name"
          value={subcategory.name}
          onChangeText={(name) => onUpdateSubcategory({ name })}
        />
        <Text style={styles.label}>Color</Text>
        <ColorPresetPicker
          colors={categoryPresetColors}
          selectedColor={subcategory.color}
          onSelectColor={(color) => onUpdateSubcategory({ color })}
        />
        <Text style={styles.label}>Icon</Text>
        <IconPresetPicker
          icons={categoryPresetIcons}
          selectedColor={subcategory.color}
          selectedIcon={subcategory.icon}
          onSelectIcon={(icon) => onUpdateSubcategory({ icon })}
        />
      </Card>
    </View>
  );
}

function EditorHeader({ title, color, icon }: { title: string; color: string; icon: string }) {
  return (
    <View style={styles.editorHeader}>
      <CategoryIconBadge color={color} icon={icon} size="md" />
      <Text style={styles.settingTitle}>{title}</Text>
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={`${colors.muted}99`}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  pageHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 44,
  },
  backButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 40,
    width: 76,
  },
  backButtonText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '800',
  },
  pageTitle: {
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
    width: 76,
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
  cardTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '800',
  },
  categoryList: {
    gap: spacing.xs,
  },
  editorHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  settingTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '800',
  },
  fieldBlock: {
    gap: spacing.xs,
  },
  label: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typography.body,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  subcategoryList: {
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.78,
  },
});
