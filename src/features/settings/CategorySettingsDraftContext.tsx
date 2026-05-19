import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { defaultCategories, sanitizeCategoryCatalog } from '../../domain/categories';
import type { CategoryDefinition, SubcategoryDefinition } from '../../domain/types';
import { useRainproofDataContext } from '../../application/RainproofDataProvider';

type CategoryPatch = Partial<Pick<CategoryDefinition, 'name' | 'color' | 'icon'>>;
type SubcategoryPatch = Partial<Pick<SubcategoryDefinition, 'name' | 'color' | 'icon'>>;

type CategorySettingsDraftContextValue = {
  categories: CategoryDefinition[];
  dirty: boolean;
  error: string;
  getCategory(categoryId: string): CategoryDefinition | undefined;
  getSubcategory(categoryId: string, subcategoryId: string): SubcategoryDefinition | undefined;
  saveCategories(): Promise<void>;
  updateCategory(categoryId: string, patch: CategoryPatch): void;
  updateSubcategory(categoryId: string, subcategoryId: string, patch: SubcategoryPatch): void;
};

const CategorySettingsDraftContext = createContext<CategorySettingsDraftContextValue | null>(null);

export function CategorySettingsDraftProvider({ children }: PropsWithChildren) {
  const { snapshot, actions } = useRainproofDataContext();
  const [draftCategories, setDraftCategories] = useState(() =>
    sanitizeCategoryCatalog(snapshot?.categories ?? defaultCategories),
  );
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!dirty) {
      setDraftCategories(sanitizeCategoryCatalog(snapshot?.categories ?? defaultCategories));
    }
  }, [dirty, snapshot?.categories]);

  const value = useMemo<CategorySettingsDraftContextValue>(
    () => ({
      categories: draftCategories,
      dirty,
      error,
      getCategory: (categoryId) => draftCategories.find((category) => category.id === categoryId),
      getSubcategory: (categoryId, subcategoryId) =>
        draftCategories
          .find((category) => category.id === categoryId)
          ?.subcategories.find((subcategory) => subcategory.id === subcategoryId),
      saveCategories: async () => {
        try {
          await actions.updateCategoryCatalog({ categories: sanitizeCategoryCatalog(draftCategories) });
          setDirty(false);
          setError('');
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Could not save categories.');
        }
      },
      updateCategory: (categoryId, patch) => {
        setDirty(true);
        setDraftCategories((currentCategories) =>
          currentCategories.map((category) =>
            category.id === categoryId ? { ...category, ...patch } : category,
          ),
        );
      },
      updateSubcategory: (categoryId, subcategoryId, patch) => {
        setDirty(true);
        setDraftCategories((currentCategories) =>
          currentCategories.map((category) =>
            category.id === categoryId
              ? {
                  ...category,
                  subcategories: category.subcategories.map((subcategory) =>
                    subcategory.id === subcategoryId ? { ...subcategory, ...patch } : subcategory,
                  ),
                }
              : category,
          ),
        );
      },
    }),
    [actions, dirty, draftCategories, error],
  );

  return (
    <CategorySettingsDraftContext.Provider value={value}>
      {children}
    </CategorySettingsDraftContext.Provider>
  );
}

export function useCategorySettingsDraft(): CategorySettingsDraftContextValue {
  const context = useContext(CategorySettingsDraftContext);

  if (!context) {
    throw new Error('useCategorySettingsDraft must be used inside CategorySettingsDraftProvider.');
  }

  return context;
}
