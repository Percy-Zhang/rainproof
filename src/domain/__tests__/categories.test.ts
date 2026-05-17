import {
  defaultCategories,
  getCategory,
  getDefaultCategoryForKind,
  getSubcategory,
  getSubcategoryIcon,
  getSubcategoryName,
} from '../categories';

describe('category defaults', () => {
  it('matches the MVP category list with stable subcategory objects', () => {
    expect(
      defaultCategories.map((category) => ({
        name: category.name,
        subcategories: category.subcategories.map((item) => item.name),
      })),
    ).toEqual([
      { name: 'Food & Dining', subcategories: ['Groceries', 'Restaurants', 'Delivery'] },
      {
        name: 'Shopping',
        subcategories: [
          'Clothing',
          'Electronics',
          'Home Goods',
          'Personal Items',
          'Apps & Digital Purchases',
          'Hobbies',
          'Gifts',
          'Other Shopping',
        ],
      },
      {
        name: 'Transport',
        subcategories: [
          'Public Transport',
          'Rideshare & Taxi',
          'Fuel',
          'Parking',
          'Car Maintenance',
          'Car Insurance',
          'Registration',
          'Other Transport',
        ],
      },
      {
        name: 'Housing',
        subcategories: ['Rent', 'Mortgage', 'Maintenance & Repairs', 'Insurance', 'Furniture', 'Moving Costs', 'Other Housing'],
      },
      {
        name: 'Bills & Utilities',
        subcategories: [
          'Electricity',
          'Gas',
          'Water',
          'Internet',
          'Phone',
          'Subscriptions',
          'Insurance',
          'Government Fees',
          'Other Bills',
        ],
      },
      {
        name: 'Health',
        subcategories: [
          'Doctor',
          'Dentist',
          'Pharmacy',
          'Health Insurance',
          'Therapy',
          'Fitness',
          'Glasses / Contacts',
          'Other Health',
        ],
      },
      {
        name: 'Entertainment',
        subcategories: ['Movies', 'Games', 'Music', 'Events', 'Streaming', 'Books', 'Sports', 'Other Entertainment'],
      },
      {
        name: 'Travel',
        subcategories: [
          'Accommodation',
          'Flights',
          'Local Transport',
          'Food While Traveling',
          'Activities',
          'Travel Insurance',
          'Visas & Documents',
          'Other Travel',
        ],
      },
      {
        name: 'Personal Care',
        subcategories: ['Haircut', 'Skincare', 'Toiletries', 'Laundry', 'Beauty', 'Clothing Care', 'Other Personal Care'],
      },
      {
        name: 'Education',
        subcategories: ['Tuition', 'Books', 'Courses', 'Software', 'Stationery', 'Exams & Applications', 'Other Education'],
      },
      {
        name: 'Work & Business',
        subcategories: ['Work Supplies', 'Software & Tools', 'Professional Fees', 'Work Travel', 'Uniforms', 'Tax Deductible', 'Other Work'],
      },
      {
        name: 'Financial',
        subcategories: ['Bank Fees', 'Interest', 'Loan Payment', 'Credit Card Payment', 'Taxes', 'Other Financial'],
      },
      {
        name: 'Pets',
        subcategories: ['Pet Food', 'Vet', 'Pet Insurance', 'Grooming', 'Toys & Supplies', 'Other Pets'],
      },
      {
        name: 'Other',
        subcategories: ['Uncategorized', 'Refund Adjustment', 'Miscellaneous'],
      },
      {
        name: 'Income',
        subcategories: [
          'Salary',
          'Wages',
          'Bonus',
          'Overtime',
          'Reimbursement',
          'Refund',
          'Interest',
          'Dividend',
          'Gift Received',
          'Sale',
          'Freelance',
          'Government Payment',
          'Other Income',
        ],
      },
    ]);
  });

  it('does not include transfer categories', () => {
    expect(defaultCategories.some((category) => /transfer/i.test(category.name))).toBe(false);
    expect(getDefaultCategoryForKind('transfer').type).toBe('expense');
  });

  it('resolves old subcategory display names to stable IDs and labels', () => {
    expect(getSubcategory('food', 'Groceries')?.id).toBe('groceries');
    expect(getSubcategory('food', 'Dining Out')?.id).toBe('restaurants');
    expect(getSubcategory('transport', 'Public Transport')?.id).toBe('public-transport');
    expect(getCategory('vehicle').id).toBe('transport');
    expect(getSubcategoryName('income', 'Interest')).toBe('Interest');
  });

  it('provides icon metadata for categories and subcategories', () => {
    expect(defaultCategories.every((category) => category.icon && category.color)).toBe(true);
    expect(defaultCategories.every((category) => category.subcategories.every((item) => item.id && item.icon && item.color))).toBe(true);
    expect(getSubcategoryIcon('food', 'groceries')).toBe('basket-outline');
  });
});
