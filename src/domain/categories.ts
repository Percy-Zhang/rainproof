import type { CategoryDefinition, SubcategoryDefinition, TransactionKind } from './types';

export const categoryPresetColors = [
  '#C45A16',
  '#7A4BA3',
  '#2E7D59',
  '#256F9C',
  '#2B5EAA',
  '#21878C',
  '#9B6B12',
  '#4F6EDB',
  '#B44444',
  '#A04783',
  '#6B5B95',
  '#667085',
  '#8A5A2B',
  '#2F8F64',
];

export const categoryPresetIcons = [
  'restaurant-outline',
  'cart-outline',
  'bus-outline',
  'home-outline',
  'receipt-outline',
  'medkit-outline',
  'film-outline',
  'airplane-outline',
  'cut-outline',
  'school-outline',
  'briefcase-outline',
  'card-outline',
  'paw-outline',
  'ellipsis-horizontal-circle-outline',
  'cash-outline',
  'basket-outline',
  'shirt-outline',
  'phone-portrait-outline',
  'gift-outline',
  'train-outline',
  'car-outline',
  'shield-checkmark-outline',
  'wifi-outline',
  'flash-outline',
  'water-outline',
  'barbell-outline',
  'book-outline',
  'game-controller-outline',
  'sparkles-outline',
];

export const defaultCategories: CategoryDefinition[] = [
  category('food', 'Food & Dining', 'expense', '#C45A16', 'restaurant-outline', [
    subcategory('groceries', 'Groceries', '#C45A16', 'basket-outline'),
    subcategory('restaurants', 'Restaurants', '#B84D1A', 'restaurant-outline'),
    subcategory('delivery', 'Delivery', '#D06B22', 'bicycle-outline'),
  ]),
  category('shopping', 'Shopping', 'expense', '#7A4BA3', 'cart-outline', [
    subcategory('clothing', 'Clothing', '#7A4BA3', 'shirt-outline'),
    subcategory('electronics', 'Electronics', '#6842A0', 'phone-portrait-outline'),
    subcategory('home-goods', 'Home Goods', '#8A5BB0', 'home-outline'),
    subcategory('personal-items', 'Personal Items', '#935DAA', 'bag-handle-outline'),
    subcategory('apps-digital-purchases', 'Apps & Digital Purchases', '#5F53B3', 'apps-outline'),
    subcategory('hobbies', 'Hobbies', '#8C4FA3', 'color-palette-outline'),
    subcategory('gifts', 'Gifts', '#A04783', 'gift-outline'),
    subcategory('other-shopping', 'Other Shopping', '#667085', 'ellipsis-horizontal-circle-outline'),
  ]),
  category('transport', 'Transport', 'expense', '#2E7D59', 'bus-outline', [
    subcategory('public-transport', 'Public Transport', '#2E7D59', 'train-outline'),
    subcategory('rideshare-taxi', 'Rideshare & Taxi', '#338A67', 'car-outline'),
    subcategory('fuel', 'Fuel', '#3C8853', 'flame-outline'),
    subcategory('parking', 'Parking', '#4A7D67', 'location-outline'),
    subcategory('car-maintenance', 'Car Maintenance', '#2A7354', 'construct-outline'),
    subcategory('car-insurance', 'Car Insurance', '#40765E', 'shield-checkmark-outline'),
    subcategory('registration', 'Registration', '#55796B', 'document-text-outline'),
    subcategory('other-transport', 'Other Transport', '#667085', 'ellipsis-horizontal-circle-outline'),
  ]),
  category('housing', 'Housing', 'expense', '#256F9C', 'home-outline', [
    subcategory('rent', 'Rent', '#256F9C', 'key-outline'),
    subcategory('mortgage', 'Mortgage', '#1E628D', 'business-outline'),
    subcategory('maintenance-repairs', 'Maintenance & Repairs', '#2E7FAF', 'hammer-outline'),
    subcategory('insurance', 'Insurance', '#3B83A8', 'shield-checkmark-outline'),
    subcategory('furniture', 'Furniture', '#507F9D', 'bed-outline'),
    subcategory('moving-costs', 'Moving Costs', '#3C769D', 'cube-outline'),
    subcategory('other-housing', 'Other Housing', '#667085', 'ellipsis-horizontal-circle-outline'),
  ]),
  category('bills', 'Bills & Utilities', 'expense', '#2B5EAA', 'receipt-outline', [
    subcategory('electricity', 'Electricity', '#2B5EAA', 'flash-outline'),
    subcategory('gas', 'Gas', '#3568B8', 'flame-outline'),
    subcategory('water', 'Water', '#317DC2', 'water-outline'),
    subcategory('internet', 'Internet', '#2B76A8', 'wifi-outline'),
    subcategory('phone', 'Phone', '#3C67B0', 'call-outline'),
    subcategory('subscriptions', 'Subscriptions', '#4F6EDB', 'repeat-outline'),
    subcategory('insurance', 'Insurance', '#39619D', 'shield-checkmark-outline'),
    subcategory('government-fees', 'Government Fees', '#545F98', 'document-text-outline'),
    subcategory('other-bills', 'Other Bills', '#667085', 'ellipsis-horizontal-circle-outline'),
  ]),
  category('health', 'Health', 'expense', '#21878C', 'medkit-outline', [
    subcategory('doctor', 'Doctor', '#21878C', 'medical-outline'),
    subcategory('dentist', 'Dentist', '#1F7D88', 'happy-outline'),
    subcategory('pharmacy', 'Pharmacy', '#2E9196', 'medkit-outline'),
    subcategory('health-insurance', 'Health Insurance', '#237B80', 'shield-checkmark-outline'),
    subcategory('therapy', 'Therapy', '#3B8C88', 'chatbubbles-outline'),
    subcategory('fitness', 'Fitness', '#2F8F64', 'barbell-outline'),
    subcategory('glasses-contacts', 'Glasses / Contacts', '#4E858B', 'glasses-outline'),
    subcategory('other-health', 'Other Health', '#667085', 'ellipsis-horizontal-circle-outline'),
  ]),
  category('entertainment', 'Entertainment', 'expense', '#9B6B12', 'film-outline', [
    subcategory('movies', 'Movies', '#9B6B12', 'film-outline'),
    subcategory('games', 'Games', '#875FA8', 'game-controller-outline'),
    subcategory('music', 'Music', '#A0647C', 'musical-notes-outline'),
    subcategory('events', 'Events', '#A87520', 'ticket-outline'),
    subcategory('streaming', 'Streaming', '#8D6B22', 'play-circle-outline'),
    subcategory('books', 'Books', '#8A5A2B', 'book-outline'),
    subcategory('sports', 'Sports', '#7D7428', 'football-outline'),
    subcategory('other-entertainment', 'Other Entertainment', '#667085', 'ellipsis-horizontal-circle-outline'),
  ]),
  category('travel', 'Travel', 'expense', '#4F6EDB', 'airplane-outline', [
    subcategory('accommodation', 'Accommodation', '#4F6EDB', 'bed-outline'),
    subcategory('flights', 'Flights', '#3F64CA', 'airplane-outline'),
    subcategory('local-transport', 'Local Transport', '#527CC0', 'map-outline'),
    subcategory('food-while-traveling', 'Food While Traveling', '#5E72B8', 'restaurant-outline'),
    subcategory('activities', 'Activities', '#6567BC', 'walk-outline'),
    subcategory('travel-insurance', 'Travel Insurance', '#4569A7', 'shield-checkmark-outline'),
    subcategory('visas-documents', 'Visas & Documents', '#5B63A8', 'document-text-outline'),
    subcategory('other-travel', 'Other Travel', '#667085', 'ellipsis-horizontal-circle-outline'),
  ]),
  category('personal-care', 'Personal Care', 'expense', '#B44444', 'cut-outline', [
    subcategory('haircut', 'Haircut', '#B44444', 'cut-outline'),
    subcategory('skincare', 'Skincare', '#A04783', 'sparkles-outline'),
    subcategory('toiletries', 'Toiletries', '#AF5B5B', 'water-outline'),
    subcategory('laundry', 'Laundry', '#8A6B7F', 'shirt-outline'),
    subcategory('beauty', 'Beauty', '#A95076', 'color-wand-outline'),
    subcategory('clothing-care', 'Clothing Care', '#9A5D62', 'brush-outline'),
    subcategory('other-personal-care', 'Other Personal Care', '#667085', 'ellipsis-horizontal-circle-outline'),
  ]),
  category('education', 'Education', 'expense', '#6B5B95', 'school-outline', [
    subcategory('tuition', 'Tuition', '#6B5B95', 'school-outline'),
    subcategory('books', 'Books', '#5C5490', 'book-outline'),
    subcategory('courses', 'Courses', '#725DA6', 'easel-outline'),
    subcategory('software', 'Software', '#5E66A8', 'code-slash-outline'),
    subcategory('stationery', 'Stationery', '#7A668C', 'create-outline'),
    subcategory('exams-applications', 'Exams & Applications', '#685C86', 'document-text-outline'),
    subcategory('other-education', 'Other Education', '#667085', 'ellipsis-horizontal-circle-outline'),
  ]),
  category('work-business', 'Work & Business', 'expense', '#8A5A2B', 'briefcase-outline', [
    subcategory('work-supplies', 'Work Supplies', '#8A5A2B', 'briefcase-outline'),
    subcategory('software-tools', 'Software & Tools', '#7C5F2E', 'construct-outline'),
    subcategory('professional-fees', 'Professional Fees', '#91632F', 'people-outline'),
    subcategory('work-travel', 'Work Travel', '#7C6538', 'airplane-outline'),
    subcategory('uniforms', 'Uniforms', '#7A604B', 'shirt-outline'),
    subcategory('tax-deductible', 'Tax Deductible', '#8D692E', 'receipt-outline'),
    subcategory('other-work', 'Other Work', '#667085', 'ellipsis-horizontal-circle-outline'),
  ]),
  category('financial', 'Financial', 'expense', '#2F5D62', 'card-outline', [
    subcategory('bank-fees', 'Bank Fees', '#2F5D62', 'card-outline'),
    subcategory('interest', 'Interest', '#37676B', 'trending-up-outline'),
    subcategory('loan-payment', 'Loan Payment', '#415F76', 'cash-outline'),
    subcategory('credit-card-payment', 'Credit Card Payment', '#405A82', 'card-outline'),
    subcategory('taxes', 'Taxes', '#4E6074', 'receipt-outline'),
    subcategory('other-financial', 'Other Financial', '#667085', 'ellipsis-horizontal-circle-outline'),
  ]),
  category('pets', 'Pets', 'expense', '#8E5E38', 'paw-outline', [
    subcategory('pet-food', 'Pet Food', '#8E5E38', 'nutrition-outline'),
    subcategory('vet', 'Vet', '#876342', 'medkit-outline'),
    subcategory('pet-insurance', 'Pet Insurance', '#7E6848', 'shield-checkmark-outline'),
    subcategory('grooming', 'Grooming', '#936045', 'cut-outline'),
    subcategory('toys-supplies', 'Toys & Supplies', '#8D6A36', 'gift-outline'),
    subcategory('other-pets', 'Other Pets', '#667085', 'ellipsis-horizontal-circle-outline'),
  ]),
  category('other', 'Other', 'expense', '#667085', 'ellipsis-horizontal-circle-outline', [
    subcategory('uncategorized', 'Uncategorized', '#667085', 'help-circle-outline'),
    subcategory('refund-adjustment', 'Refund Adjustment', '#5F7785', 'swap-horizontal-outline'),
    subcategory('miscellaneous', 'Miscellaneous', '#717680', 'ellipsis-horizontal-circle-outline'),
  ]),
  category('income', 'Income', 'income', '#2F8F64', 'cash-outline', [
    subcategory('salary', 'Salary', '#2F8F64', 'cash-outline'),
    subcategory('wages', 'Wages', '#27845D', 'wallet-outline'),
    subcategory('bonus', 'Bonus', '#3B9364', 'sparkles-outline'),
    subcategory('overtime', 'Overtime', '#3D8766', 'time-outline'),
    subcategory('reimbursement', 'Reimbursement', '#2F7F70', 'return-up-back-outline'),
    subcategory('refund', 'Refund', '#3C8C6F', 'refresh-outline'),
    subcategory('interest', 'Interest', '#34877B', 'trending-up-outline'),
    subcategory('dividend', 'Dividend', '#2D8066', 'bar-chart-outline'),
    subcategory('gift-received', 'Gift Received', '#53895B', 'gift-outline'),
    subcategory('sale', 'Sale', '#438A53', 'pricetag-outline'),
    subcategory('freelance', 'Freelance', '#477C69', 'briefcase-outline'),
    subcategory('government-payment', 'Government Payment', '#4F7C70', 'business-outline'),
    subcategory('other-income', 'Other Income', '#667085', 'ellipsis-horizontal-circle-outline'),
  ]),
];

const categoryAliases: Record<string, string> = {
  vehicle: 'transport',
};

const subcategoryAliasesByCategory: Record<string, Record<string, string>> = {
  food: {
    'coffee': 'restaurants',
    'dining-out': 'restaurants',
  },
  housing: {
    'rent-mortgage': 'rent',
    'utilities': 'other-housing',
  },
  shopping: {
    'home': 'home-goods',
  },
  transport: {
    'service': 'car-maintenance',
    'insurance': 'car-insurance',
    'tolls': 'other-transport',
  },
  entertainment: {
    'hobbies': 'other-entertainment',
    'holidays': 'other-entertainment',
  },
  health: {
    'medical': 'doctor',
    'dental': 'dentist',
  },
  income: {
    'dividends': 'dividend',
    'gifts': 'gift-received',
    'refunds': 'refund',
  },
  other: {
    'cash': 'miscellaneous',
    'fees': 'miscellaneous',
  },
};

export function getCategory(categoryId: string, categories: CategoryDefinition[] = defaultCategories): CategoryDefinition {
  return findCategory(categoryId, categories) ?? findCategory('other', categories) ?? defaultCategories.at(-1)!;
}

export function getSubcategory(
  categoryId: string,
  subcategoryId: string,
  categories: CategoryDefinition[] = defaultCategories,
): SubcategoryDefinition | undefined {
  const category = findCategory(categoryId, categories);
  if (!category) {
    return undefined;
  }

  return findSubcategory(category, subcategoryId);
}

export function getSubcategoryName(
  categoryId: string,
  subcategoryId: string,
  categories: CategoryDefinition[] = defaultCategories,
): string {
  return getSubcategory(categoryId, subcategoryId, categories)?.name || subcategoryId || 'Uncategorized';
}

export function getSubcategoryIcon(
  categoryId: string,
  subcategoryId: string,
  categories: CategoryDefinition[] = defaultCategories,
): string {
  return getSubcategory(categoryId, subcategoryId, categories)?.icon || getCategory(categoryId, categories).icon;
}

export function getSubcategoryColor(
  categoryId: string,
  subcategoryId: string,
  categories: CategoryDefinition[] = defaultCategories,
): string {
  return getSubcategory(categoryId, subcategoryId, categories)?.color || getCategory(categoryId, categories).color;
}

export function getDefaultCategoryForKind(
  kind: TransactionKind,
  categories: CategoryDefinition[] = defaultCategories,
): CategoryDefinition {
  if (kind === 'income') {
    return getCategory('income', categories);
  }

  if (kind === 'transfer') {
    return getCategory('other', categories);
  }

  return getCategory('food', categories);
}

export function getDefaultSubcategoryId(category: CategoryDefinition): string {
  return category.subcategories[0]?.id ?? '';
}

export function normalizeCategoryId(categoryId: string, categories: CategoryDefinition[] = defaultCategories): string {
  return findCategory(categoryId, categories)?.id || categoryId;
}

export function normalizeSubcategoryId(
  categoryId: string,
  subcategoryId: string,
  categories: CategoryDefinition[] = defaultCategories,
): string {
  return getSubcategory(categoryId, subcategoryId, categories)?.id || subcategoryId;
}

export function sanitizeCategoryCatalog(input: unknown): CategoryDefinition[] {
  if (!Array.isArray(input)) {
    return defaultCategories;
  }

  const inputById = new Map(
    input
      .filter((category): category is Partial<CategoryDefinition> & { id: string } =>
        Boolean(category && typeof category === 'object' && typeof category.id === 'string'),
      )
      .map((category) => [category.id, category]),
  );

  const merged = defaultCategories.map((baseCategory) => {
    const storedCategory = inputById.get(baseCategory.id);
    const storedSubcategories: unknown[] = Array.isArray(storedCategory?.subcategories)
      ? storedCategory.subcategories as unknown[]
      : [];
    const storedSubcategoryById = new Map(
      storedSubcategories
        .filter((subcategory): subcategory is Partial<SubcategoryDefinition> & { id: string } =>
          Boolean(subcategory && typeof subcategory === 'object' && 'id' in subcategory && typeof subcategory.id === 'string'),
        )
        .map((subcategory) => [subcategory.id, subcategory]),
    );

    return {
      ...baseCategory,
      name: safeText(storedCategory?.name, baseCategory.name),
      color: safePreset(storedCategory?.color, categoryPresetColors, baseCategory.color),
      icon: safePreset(storedCategory?.icon, categoryPresetIcons, baseCategory.icon),
      subcategories: baseCategory.subcategories.map((baseSubcategory) => {
        const storedSubcategory = storedSubcategoryById.get(baseSubcategory.id);
        return {
          ...baseSubcategory,
          name: safeText(storedSubcategory?.name, baseSubcategory.name),
          color: safePreset(storedSubcategory?.color, categoryPresetColors, baseSubcategory.color),
          icon: safePreset(storedSubcategory?.icon, categoryPresetIcons, baseSubcategory.icon),
        };
      }),
    };
  });

  const knownCategoryIds = new Set(defaultCategories.map((category) => category.id));
  const customCategories: CategoryDefinition[] = input
    .filter((category): category is Partial<CategoryDefinition> & { id: string } =>
      Boolean(category && typeof category === 'object' && 'id' in category && typeof category.id === 'string' && !knownCategoryIds.has(category.id)),
    )
    .map((category) => ({
      id: category.id,
      name: safeText(category.name, category.id),
      type: category.type === 'income' ? 'income' as const : 'expense' as const,
      color: safePreset(category.color, categoryPresetColors, '#667085'),
      icon: safePreset(category.icon, categoryPresetIcons, 'ellipsis-horizontal-circle-outline'),
      subcategories: Array.isArray(category.subcategories)
        ? category.subcategories
            .filter((subcategory): subcategory is SubcategoryDefinition =>
              Boolean(subcategory && typeof subcategory === 'object' && typeof subcategory.id === 'string'),
            )
            .map((subcategory) => ({
              id: subcategory.id,
              name: safeText(subcategory.name, subcategory.id),
              color: safePreset(subcategory.color, categoryPresetColors, '#667085'),
              icon: safePreset(subcategory.icon, categoryPresetIcons, 'ellipsis-horizontal-circle-outline'),
            }))
        : [],
    }));

  return [...merged, ...customCategories];
}

function findCategory(categoryId: string, categories: CategoryDefinition[]): CategoryDefinition | undefined {
  const normalizedId = normalizeLookupValue(categoryId);
  const aliasedId = categoryAliases[normalizedId] ?? normalizedId;
  return categories.find(
    (category) =>
      category.id === categoryId ||
      normalizeLookupValue(category.name) === aliasedId ||
      normalizeLookupValue(category.id) === aliasedId,
  );
}

function safeText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function safePreset(value: unknown, presets: string[], fallback: string): string {
  return typeof value === 'string' && presets.includes(value) ? value : fallback;
}

function findSubcategory(category: CategoryDefinition, subcategoryId: string): SubcategoryDefinition | undefined {
  const normalizedId = normalizeLookupValue(subcategoryId);
  const aliasedId = subcategoryAliasesByCategory[category.id]?.[normalizedId] ?? normalizedId;
  return category.subcategories.find(
    (subcategory) =>
      subcategory.id === subcategoryId ||
      normalizeLookupValue(subcategory.name) === aliasedId ||
      normalizeLookupValue(subcategory.id) === aliasedId,
  );
}

function normalizeLookupValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function category(
  id: string,
  name: string,
  type: CategoryDefinition['type'],
  color: string,
  icon: string,
  subcategories: SubcategoryDefinition[],
): CategoryDefinition {
  return { id, name, type, color, icon, subcategories };
}

function subcategory(id: string, name: string, color: string, icon: string): SubcategoryDefinition {
  return { id, name, color, icon };
}
