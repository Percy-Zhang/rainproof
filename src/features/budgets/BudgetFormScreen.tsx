import { useMemo, useState } from 'react';

import { CurrencyDropdown } from '../../components/CurrencyDropdown';
import { ActionButton, Chip, FormError, TextField } from '../../components/ui';
import {
  FormChipRow,
  FormDangerZone,
  FormHelperText,
  FormPreviewRow,
  FormScreenShell,
  FormSection,
  KeyboardAwareFormScroll,
} from '../../components/FormLayout';
import { formatOptionalMoneyInput } from '../../domain/accountForm';
import {
  defaultCategories,
} from '../../domain/categories';
import {
  getBudgetCurrencyOptions,
  getBudgetPeriodDescription,
  getBudgetPeriodLabel,
  getBudgetScopeItems,
  getBudgetScopeLabel,
  normalizeBudgetScopeItems,
} from '../../domain/budgets';
import { parseMoneyInput } from '../../domain/money';
import type {
  AppSnapshot,
  Budget,
  BudgetPeriod,
  BudgetScopeItem,
  BudgetScopeType,
  CategoryDefinition,
  NewBudgetInput,
  UpdateBudgetInput,
} from '../../domain/types';
import { CategorySelectionField } from '../categorySelection/CategorySelectionField';
import {
  getBudgetScopeFormSummary,
  type BudgetScopeSelectLaunchParams,
} from './budgetScopeSelectionModel';
import type { BudgetPeriodSelectLaunchParams } from './budgetPeriodSelectionModel';
import { colors } from '../../theme/tokens';

type BudgetFormScreenProps =
  | {
      mode: 'add';
      snapshot: AppSnapshot;
      onAddBudget: (input: NewBudgetInput) => Promise<void>;
      onOpenBudgetScopeSelect: (
        params: BudgetScopeSelectLaunchParams,
        onConfirm: (scopeItems: BudgetScopeItem[]) => void,
      ) => void;
      onOpenBudgetPeriodSelect: (
        params: BudgetPeriodSelectLaunchParams,
        onSelect: (period: BudgetPeriod) => void,
      ) => void;
      onCancel: () => void;
      onDone: () => void;
    }
  | {
      mode: 'edit';
      snapshot: AppSnapshot;
      budget: Budget;
      onUpdateBudget: (input: UpdateBudgetInput) => Promise<void>;
      onArchiveBudget: (budgetId: string) => Promise<void>;
      onOpenBudgetScopeSelect: (
        params: BudgetScopeSelectLaunchParams,
        onConfirm: (scopeItems: BudgetScopeItem[]) => void,
      ) => void;
      onOpenBudgetPeriodSelect: (
        params: BudgetPeriodSelectLaunchParams,
        onSelect: (period: BudgetPeriod) => void,
      ) => void;
      onCancel: () => void;
      onDone: () => void;
    };

type BudgetScopeMode = Extract<BudgetScopeType, 'overall' | 'include' | 'exclude'>;

const scopeOptions: { value: BudgetScopeMode; label: string }[] = [
  { value: 'overall', label: 'Overall' },
  { value: 'include', label: 'Include selected categories' },
  { value: 'exclude', label: 'Exclude selected categories' },
];

export function BudgetFormScreen(props: BudgetFormScreenProps) {
  const { mode, snapshot, onCancel, onDone } = props;
  const categories = useMemo(
    () => (snapshot.categories ?? defaultCategories).filter((category) => category.type === 'expense'),
    [snapshot.categories],
  );
  const firstCategory = categories[0];
  const editingBudget = mode === 'edit' ? props.budget : null;
  const currencyOptions = useMemo(
    () => getBudgetCurrencyOptions({
      accounts: snapshot.accounts,
      currentBudgetCurrencyCode: editingBudget?.currencyCode,
    }),
    [editingBudget?.currencyCode, snapshot.accounts],
  );
  const [name, setName] = useState(editingBudget?.name ?? '');
  const [amount, setAmount] = useState(formatOptionalMoneyInput(editingBudget?.amountMinor));
  const [currencyCode, setCurrencyCode] = useState(editingBudget?.currencyCode ?? currencyOptions[0]?.code ?? '');
  const [period, setPeriod] = useState<BudgetPeriod>(editingBudget?.period ?? 'monthly');
  const [scopeMode, setScopeMode] = useState<BudgetScopeMode>(getInitialBudgetScopeMode(editingBudget));
  const [scopeItems, setScopeItems] = useState<BudgetScopeItem[]>(() =>
    getInitialBudgetScopeItems(editingBudget, firstCategory),
  );
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [error, setError] = useState('');
  const scopeDraft = getBudgetScopeDraft(scopeMode, scopeItems);
  const scopeSummary = getBudgetScopeFormSummary({
    categories,
    currencyCode,
    mode: scopeMode,
    scopeItems,
  });

  function setSelectedScope(nextScopeMode: BudgetScopeMode) {
    setScopeMode(nextScopeMode);
    if (nextScopeMode !== 'overall' && !scopeItems.length && firstCategory) {
      setScopeItems([{ categoryId: firstCategory.id, subcategoryId: null }]);
    }
    setConfirmArchive(false);
  }

  function openBudgetScopeSelect() {
    if (scopeMode === 'overall') {
      return;
    }

    props.onOpenBudgetScopeSelect(
      {
        mode: scopeMode,
        selectedItems: normalizeBudgetScopeItems(scopeItems),
      },
      (confirmedItems) => setScopeItems(normalizeBudgetScopeItems(confirmedItems)),
    );
  }

  function openBudgetPeriodSelect() {
    props.onOpenBudgetPeriodSelect(
      { selectedPeriod: period },
      (selectedPeriod) => setPeriod(selectedPeriod),
    );
  }

  async function submit() {
    try {
      const amountMinor = parseMoneyInput(amount);
      if (amountMinor <= 0) {
        throw new Error('Budget amount must be greater than zero.');
      }

      const input = buildBudgetInput(amountMinor);
      if (mode === 'add') {
        await props.onAddBudget(input);
      } else {
        await props.onUpdateBudget({ id: props.budget.id, ...input });
      }

      setError('');
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save budget.');
    }
  }

  async function archiveBudget() {
    if (mode !== 'edit') {
      return;
    }

    if (!confirmArchive) {
      setConfirmArchive(true);
      return;
    }

    try {
      await props.onArchiveBudget(props.budget.id);
      setError('');
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not archive budget.');
    }
  }

  function buildBudgetInput(amountMinor: number): NewBudgetInput {
    const normalizedScopeItems = scopeMode === 'overall' ? [] : normalizeBudgetScopeItems(scopeItems);
    const primaryScopeItem = normalizedScopeItems[0] ?? null;

    return {
      name: name.trim() || getFallbackBudgetName(scopeMode, scopeDraft, categories),
      amountMinor,
      currencyCode,
      period,
      scopeType: scopeMode,
      categoryId: scopeMode === 'overall' ? null : primaryScopeItem?.categoryId ?? null,
      subcategoryId: scopeMode === 'overall' ? null : primaryScopeItem?.subcategoryId ?? null,
      scopeItems: normalizedScopeItems,
      isActive: true,
    };
  }

  return (
    <FormScreenShell
      title={mode === 'add' ? 'Add budget' : 'Edit budget'}
      onBack={onCancel}
      onSave={submit}
      saveTestID={mode === 'add' ? 'save-new-budget' : 'save-budget'}
    >
      <KeyboardAwareFormScroll>
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder={getFallbackBudgetName(scopeMode, scopeDraft, categories)}
        />
        <TextField
          label={`${getBudgetPeriodLabel(period)} limit`}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
        <CurrencyDropdown
          label="Currency"
          value={currencyCode}
          options={currencyOptions}
          onChange={setCurrencyCode}
          testID="budget-currency-dropdown"
        />

        <FormSection label="Budget period">
          <CategorySelectionField
            color={colors.primary}
            icon="calendar-outline"
            label="Period"
            onPress={openBudgetPeriodSelect}
            value={`${getBudgetPeriodLabel(period)} · ${getBudgetPeriodDescription(period)}`}
          />
        </FormSection>

        <FormSection label="Scope">
          <FormChipRow>
            {scopeOptions.map((option) => (
              <Chip
                key={option.value}
                selected={scopeMode === option.value}
                onPress={() => setSelectedScope(option.value)}
                testID={`budget-scope-${option.value}`}
              >
                {option.label}
              </Chip>
            ))}
          </FormChipRow>
        </FormSection>

        {scopeMode !== 'overall' ? (
          <FormSection label="Category scope">
            <CategorySelectionField
              color={scopeMode === 'exclude' ? colors.danger : colors.primary}
              empty={!scopeItems.length}
              icon={scopeMode === 'exclude' ? 'remove-circle-outline' : 'checkmark-circle-outline'}
              label={scopeSummary.fieldLabel}
              onPress={openBudgetScopeSelect}
              value={scopeSummary.title}
            />
            <FormHelperText>{scopeSummary.detail}</FormHelperText>
          </FormSection>
        ) : (
          <FormPreviewRow
            color={colors.primary}
            icon="wallet-outline"
            title={scopeSummary.title}
            detail={scopeSummary.detail}
          />
        )}

        <FormError message={error} />

        {mode === 'edit' ? (
          <FormDangerZone
            label="Budget status"
            warning={confirmArchive ? 'Archived budgets disappear from the active budget list.' : undefined}
          >
            <ActionButton variant="danger" onPress={archiveBudget} testID="archive-budget">
              {confirmArchive ? 'Confirm archive' : 'Archive budget'}
            </ActionButton>
          </FormDangerZone>
        ) : null}
      </KeyboardAwareFormScroll>
    </FormScreenShell>
  );
}

function getFallbackBudgetName(
  scopeMode: BudgetScopeMode,
  scopeDraft: Pick<Budget, 'scopeType' | 'categoryId' | 'subcategoryId' | 'scopeItems'>,
  categories = defaultCategories,
): string {
  if (scopeMode === 'overall') {
    return 'Overall spending';
  }

  if (scopeMode === 'exclude') {
    return 'Filtered spending budget';
  }

  return `${getBudgetScopeLabel(scopeDraft, categories)} budget`;
}

function getInitialBudgetScopeMode(budget: Budget | null): BudgetScopeMode {
  if (!budget) {
    return 'overall';
  }

  if (budget.scopeType === 'exclude') {
    return 'exclude';
  }

  if (budget.scopeType === 'overall') {
    return 'overall';
  }

  return 'include';
}

function getInitialBudgetScopeItems(budget: Budget | null, fallbackCategory: CategoryDefinition | undefined): BudgetScopeItem[] {
  if (budget) {
    return getBudgetScopeItems(budget);
  }

  return fallbackCategory ? [{ categoryId: fallbackCategory.id, subcategoryId: null }] : [];
}

function getBudgetScopeDraft(scopeType: BudgetScopeMode, scopeItems: BudgetScopeItem[]) {
  const normalizedScopeItems = scopeType === 'overall' ? [] : normalizeBudgetScopeItems(scopeItems);
  const primaryScopeItem = normalizedScopeItems[0] ?? null;

  return {
    scopeType,
    categoryId: primaryScopeItem?.categoryId ?? null,
    subcategoryId: primaryScopeItem?.subcategoryId ?? null,
    scopeItems: normalizedScopeItems,
  };
}
