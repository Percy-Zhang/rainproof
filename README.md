# Rainproof

Rainproof is a local-first personal finance app built with Expo and React Native. It helps track accounts, transactions, budgets, upcoming payments, templates, statistics, and encrypted local backups.

## Features

- **Accounts:** create and edit accounts, track balances, choose Dashboard visibility, and reorder accounts manually.
- **Transactions:** add, edit, delete, search, and filter income, expenses, and transfers.
- **Splits and transfers:** record standard and mixed split transactions, same-currency transfers, and cross-currency transfers with separate sent and received amounts.
- **Budgets:** create category-scoped budgets, navigate budget periods, view Current and Compare history charts, and reorder budgets.
- **Statistics:** review spending, income, category breakdowns, trends, transaction-size distribution, account-filtered reports, and a cash-flow waterfall that reconciles selected balances for the active period.
- **Dashboard:** customize visible cards, reorder Dashboard cards, filter by selected accounts, and use quick actions.
- **Templates and upcoming payments:** save reusable transaction templates, prefill Add Transaction from templates or planned payments, and manage one-time or recurring Upcoming Payments.
- **Linked transactions:** link reimbursements, refunds, and shared expense contributions, including parent and split-line endpoints where supported.
- **Backup and restore:** export and restore encrypted local Rainproof backups.
- **Multi-currency handling:** keep currencies separated in balances, statistics, budgets, splits, transfers, and displays.

## Financial Model

- Original transaction amounts and currencies are preserved.
- Transfers affect account balances and movement, but do not count as income, spending, budgets, top spending, or core cash-flow statistics.
- Cross-currency transfers store sent and received lines in their own currencies. User-entered sent and received amounts remain the source of truth.
- Split lines count by their own signed amount, account, category, subcategory, and currency.
- Mixed splits support income and expense lines in the same transaction.
- Budgets count expense lines only.
- Currencies are not silently combined without explicit converted or estimated display behavior.

## Backup And Privacy

Rainproof exports encrypted, compressed `.rainproof` backup files. Restoring a backup requires the matching recovery key, and the app validates backup metadata and references before applying restored data.

## Development

Install dependencies:

```sh
npm install
```

Start Expo:

```sh
npm run start
```

Useful checks:

```sh
npm run typecheck
npm run lint
npm run test
npm run expo:check
npm run verify:local -- --skip-perf
```

Large-data performance harness:

```sh
npm run perf:large-data -- --sizes=1000
```

## Project Structure

- `src/application`: app-level data loading, mutation actions, optimistic updates, and backup key storage.
- `src/components`: shared UI components and primitives.
- `src/domain`: financial rules, derived data, validation, display models, and pure helpers.
- `src/features`: screen-level features for accounts, transactions, budgets, dashboard, statistics, templates, upcoming payments, settings, imports, and rainy day funds.
- `src/navigation`: route and drawer wiring.
- `src/performance`: opt-in performance helpers and large-data harness tests.
- `src/storage`: SQLite repository, migrations, snapshot loading, backup restore, and storage tests.
- `src/theme`: color, spacing, typography, shared style, and responsive layout tokens.
- `scripts`: local verification and performance runner scripts.
