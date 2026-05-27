export const SCHEMA_VERSION = 8;

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  nickname TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  opening_balance_minor INTEGER NOT NULL,
  credit_limit_minor INTEGER,
  notes TEXT NOT NULL DEFAULT '',
  institution_name TEXT NOT NULL DEFAULT '',
  include_in_rainy_day INTEGER NOT NULL DEFAULT 0,
  theme_color TEXT NOT NULL DEFAULT '#1876A8',
  icon_name TEXT NOT NULL DEFAULT '',
  show_on_dashboard INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  datetime TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  labels_json TEXT NOT NULL DEFAULT '[]',
  group_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transaction_lines (
  id TEXT PRIMARY KEY NOT NULL,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount_minor INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  category_id TEXT NOT NULL DEFAULT '',
  subcategory_id TEXT NOT NULL DEFAULT '',
  external_party TEXT NOT NULL DEFAULT '',
  transfer_peer_account_id TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transaction_lines_transaction_id
ON transaction_lines(transaction_id);

CREATE INDEX IF NOT EXISTS idx_transaction_lines_account_id
ON transaction_lines(account_id);

CREATE TABLE IF NOT EXISTS transaction_links (
  id TEXT PRIMARY KEY NOT NULL,
  source_transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  target_transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  source_line_id TEXT REFERENCES transaction_lines(id) ON DELETE CASCADE,
  target_line_id TEXT REFERENCES transaction_lines(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (source_transaction_id <> target_transaction_id),
  CHECK (link_type IN ('refund', 'reimbursement', 'shared_expense_contribution')),
  CHECK (amount_minor > 0)
);

CREATE INDEX IF NOT EXISTS idx_transaction_links_source_transaction_id
ON transaction_links(source_transaction_id);

CREATE INDEX IF NOT EXISTS idx_transaction_links_target_transaction_id
ON transaction_links(target_transaction_id);

CREATE INDEX IF NOT EXISTS idx_transaction_links_link_type
ON transaction_links(link_type);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  amount_minor INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly',
  scope_type TEXT NOT NULL DEFAULT 'category',
  category_id TEXT,
  subcategory_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (amount_minor > 0),
  CHECK (period IN ('monthly')),
  CHECK (scope_type IN ('overall', 'category', 'subcategory')),
  CHECK (
    (scope_type = 'overall' AND category_id IS NULL AND subcategory_id IS NULL) OR
    (scope_type = 'category' AND category_id IS NOT NULL AND category_id <> '' AND subcategory_id IS NULL) OR
    (scope_type = 'subcategory' AND category_id IS NOT NULL AND category_id <> '' AND subcategory_id IS NOT NULL AND subcategory_id <> '')
  )
);

CREATE TABLE IF NOT EXISTS recurring_items (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  account_id TEXT NOT NULL DEFAULT '',
  category_id TEXT NOT NULL DEFAULT '',
  subcategory_id TEXT,
  note TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT 'monthly',
  next_due_date TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (kind IN ('expense', 'income')),
  CHECK (amount_minor > 0),
  CHECK (frequency IN ('weekly', 'fortnightly', 'monthly', 'yearly')),
  CHECK (next_due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);

CREATE INDEX IF NOT EXISTS idx_recurring_items_active_due
ON recurring_items(is_active, next_due_date);

CREATE TABLE IF NOT EXISTS rainy_day_funds (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  goal_minor INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rainy_day_fund_accounts (
  fund_id TEXT NOT NULL REFERENCES rainy_day_funds(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (fund_id, account_id)
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id TEXT PRIMARY KEY NOT NULL,
  base_currency_code TEXT NOT NULL,
  quote_currency_code TEXT NOT NULL,
  rate_decimal TEXT NOT NULL,
  source TEXT NOT NULL,
  effective_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;
