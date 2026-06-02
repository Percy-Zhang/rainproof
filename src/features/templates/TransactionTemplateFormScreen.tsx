import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';

import { AccountIconBadge } from '../../components/AccountDisplay';
import { ActionButton, Chip, FormError, TextField } from '../../components/ui';
import {
  FormChipRow,
  FormDangerZone,
  FormHelperText,
  FormInlineAction,
  FormPreviewRow,
  FormScreenShell,
  FormSection,
  KeyboardAwareFormScroll,
} from '../../components/FormLayout';
import { formatOptionalMoneyInput } from '../../domain/accountForm';
import { getAccountBalances } from '../../domain/aggregates';
import { getAccountDisplayName } from '../../domain/accountThemes';
import {
  defaultCategories,
  getCategory,
  getDefaultCategoryForKind,
  getDefaultSubcategoryId,
  getSubcategory,
  getSubcategoryIcon,
  getSubcategoryName,
} from '../../domain/categories';
import { formatMoney, parseMoneyInput } from '../../domain/money';
import {
  createSplitTransactionFormLine,
  formatMinorInput,
  getSplitTransactionFormSummary,
  type SplitTransactionFormLine,
} from '../../domain/splitTransactionForm';
import {
  getTemplateCurrencyCodeForAccount,
  validateTransactionTemplateInput,
} from '../../domain/transactionTemplates';
import { getTransactionItemNameSuggestionValues } from '../../domain/transactionItemSuggestions';
import type {
  AppSnapshot,
  CategoryDefinition,
  NewTransactionTemplateInput,
  TransactionTemplate,
  TransactionTemplateKind,
  UpdateTransactionTemplateInput,
} from '../../domain/types';
import type {
  CategorySelectLaunchParams,
  CategorySelectionResult,
} from '../categorySelection/categorySelectionModel';
import { CategorySelectionField } from '../categorySelection/CategorySelectionField';
import { AutocompleteField, useAutocompleteOptions } from '../transactions/TransactionFormComponents';
import { SplitTransactionEditor, SplitTransactionEditorScrollContainer } from '../transactions/SplitTransactionEditor';
import { TransactionPickerScreen } from '../transactions/TransactionPickerScreen';
import { colors, spacing, typography } from '../../theme/tokens';

type TransactionTemplateFormScreenProps =
  | {
      mode: 'add';
      snapshot: AppSnapshot;
      onAddTemplate: (input: NewTransactionTemplateInput) => Promise<void>;
      onOpenCategorySelect: (
        params: CategorySelectLaunchParams,
        onSelect: (selection: CategorySelectionResult) => void,
      ) => void;
      onCancel: () => void;
      onDone: () => void;
    }
  | {
      mode: 'edit';
      snapshot: AppSnapshot;
      template: TransactionTemplate;
      onUpdateTemplate: (input: UpdateTransactionTemplateInput) => Promise<void>;
      onArchiveTemplate: (templateId: string) => Promise<void>;
      onDeleteTemplate: (templateId: string) => Promise<void>;
      onOpenCategorySelect: (
        params: CategorySelectLaunchParams,
        onSelect: (selection: CategorySelectionResult) => void,
      ) => void;
      onCancel: () => void;
      onDone: () => void;
    };

const kindOptions: { value: TransactionTemplateKind; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
];

type TemplateFormPage = 'form' | 'account' | 'split';

let templateSplitLineCounter = 0;

function createTemplateSplitLineId(): string {
  templateSplitLineCounter += 1;
  return `template-split-line-${templateSplitLineCounter}`;
}

export function TransactionTemplateFormScreen(props: TransactionTemplateFormScreenProps) {
  const { mode, snapshot, onCancel, onDone } = props;
  const editingTemplate = mode === 'edit' ? props.template : null;
  const accounts = snapshot.accounts.filter((account) => !account.isArchived);
  const firstAccount = accounts[0];
  const categories = useMemo(() => snapshot.categories ?? defaultCategories, [snapshot.categories]);
  const [kind, setKind] = useState<TransactionTemplateKind>(editingTemplate?.kind ?? 'expense');
  const [name, setName] = useState(editingTemplate?.name ?? '');
  const [title, setTitle] = useState(editingTemplate?.title ?? '');
  const [amount, setAmount] = useState(formatOptionalMoneyInput(editingTemplate?.amountMinor));
  const [accountId, setAccountId] = useState(editingTemplate?.accountId ?? firstAccount?.id ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(editingTemplate?.categoryId ?? null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(editingTemplate?.subcategoryId ?? null);
  const [notes, setNotes] = useState(editingTemplate?.notes ?? '');
  const [splitLines, setSplitLines] = useState<SplitTransactionFormLine[]>(() =>
    (editingTemplate?.splitLines ?? []).map((line) =>
      createSplitTransactionFormLine({
        id: line.id,
        amount: formatMinorInput(line.amountMinor),
        categoryId: line.categoryId,
        subcategoryId: line.subcategoryId,
        note: line.note,
      })),
  );
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState<TemplateFormPage>('form');
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const currencyCode = getTemplateCurrencyCodeForAccount(accounts, accountId);
  const selectedAccountBalance = useMemo(
    () => getAccountBalances(snapshot.accounts, snapshot.transactionLines).find(({ account }) => account.id === accountId),
    [accountId, snapshot.accounts, snapshot.transactionLines],
  );
  const itemNameSuggestionValues = useMemo(
    () => getTransactionItemNameSuggestionValues({
      transactions: snapshot.transactions,
      transactionLines: snapshot.transactionLines,
      transactionTemplates: snapshot.transactionTemplates,
      recurringItems: snapshot.recurringItems,
      excludeTemplateId: editingTemplate?.id,
    }),
    [
      editingTemplate?.id,
      snapshot.recurringItems,
      snapshot.transactionLines,
      snapshot.transactionTemplates,
      snapshot.transactions,
    ],
  );
  const nameSuggestions = useAutocompleteOptions(itemNameSuggestionValues, name);
  const titleSuggestions = useAutocompleteOptions(itemNameSuggestionValues, title);
  const splitTotalMinor = getTemplateAmountMinor(amount);
  const splitSummary = getSplitTransactionFormSummary(splitTotalMinor, splitLines);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (page === 'account' || page === 'split') {
          setPage('form');
          return true;
        }

        return false;
      });

      return () => subscription.remove();
    }, [page]),
  );

  function changeKind(nextKind: TransactionTemplateKind) {
    setKind(nextKind);
    setCategoryId(null);
    setSubcategoryId(null);
    setSplitLines([]);
    setConfirmArchive(false);
    setConfirmDelete(false);
    setError('');
  }

  async function submit() {
    try {
      if (!selectedAccount) {
        throw new Error(accountId ? 'Template account needs attention.' : 'Template account is required.');
      }

      const input = buildTemplateInput();
      validateTransactionTemplateInput(input, accounts);

      if (mode === 'add') {
        await props.onAddTemplate(input);
      } else {
        await props.onUpdateTemplate({ id: props.template.id, ...input });
      }

      setError('');
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save transaction template.');
    }
  }

  async function archiveTemplate() {
    if (mode !== 'edit') {
      return;
    }

    if (!confirmArchive) {
      setConfirmArchive(true);
      setConfirmDelete(false);
      return;
    }

    try {
      await props.onArchiveTemplate(props.template.id);
      setError('');
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not archive transaction template.');
    }
  }

  async function deleteTemplate() {
    if (mode !== 'edit') {
      return;
    }

    if (!confirmDelete) {
      setConfirmDelete(true);
      setConfirmArchive(false);
      return;
    }

    try {
      await props.onDeleteTemplate(props.template.id);
      setError('');
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete transaction template.');
    }
  }

  function buildTemplateInput(): NewTransactionTemplateInput {
    return {
      name,
      kind,
      title,
      accountId,
      amountMinor: parseOptionalTemplateAmount(amount),
      currencyCode,
      categoryId,
      subcategoryId,
      notes,
      splitLines: splitLines.map((line) => ({
        amountMinor: Math.abs(parseMoneyInput(line.amount)),
        categoryId: line.categoryId,
        subcategoryId: line.subcategoryId,
        note: line.note,
      })),
      isActive: true,
    };
  }

  function selectAccount(nextAccountId: string) {
    setAccountId(nextAccountId);
    setPage('form');
    setConfirmArchive(false);
    setConfirmDelete(false);
    setError('');
  }

  function openCategorySelect() {
    const defaultCategory = getDefaultCategoryForKind(kind, categories);
    const selectedCategory = categoryId ? getCategory(categoryId, categories) : defaultCategory;

    props.onOpenCategorySelect(
      {
        kind,
        selectedCategoryId: selectedCategory.id,
        selectedSubcategoryId: subcategoryId ?? getDefaultSubcategoryId(selectedCategory),
        selectionMode: 'subcategory',
        showSuggestions: false,
        title: 'Template category',
      },
      ({ categoryId: nextCategoryId, subcategoryId: nextSubcategoryId }) => {
        const nextCategory = getCategory(nextCategoryId, categories);
        setCategoryId(nextCategory.id);
        setSubcategoryId(nextSubcategoryId ?? getDefaultSubcategoryId(nextCategory));
      },
    );
  }

  function clearCategory() {
    setCategoryId(null);
    setSubcategoryId(null);
  }

  function getSplitBaseCategorySelection() {
    const category = categoryId ? getCategory(categoryId, categories) : getDefaultCategoryForKind(kind, categories);
    return {
      categoryId: category.id,
      subcategoryId: subcategoryId ?? getDefaultSubcategoryId(category),
    };
  }

  function startSplitTemplate() {
    const selection = getSplitBaseCategorySelection();
    const totalMinor = getTemplateAmountMinor(amount);
    setCategoryId(selection.categoryId);
    setSubcategoryId(selection.subcategoryId);
    setSplitLines([
      createSplitTransactionFormLine({
        id: createTemplateSplitLineId(),
        amount: totalMinor > 0 ? formatMinorInput(totalMinor) : '',
        categoryId: selection.categoryId,
        subcategoryId: selection.subcategoryId,
      }),
      createSplitTransactionFormLine({
        id: createTemplateSplitLineId(),
        categoryId: selection.categoryId,
        subcategoryId: selection.subcategoryId,
      }),
    ]);
    setError('');
  }

  function openSplitTemplateEditor() {
    if (splitLines.length < 2) {
      startSplitTemplate();
    }

    setPage('split');
  }

  function stopSplitTemplate() {
    if (splitLines.length === 1) {
      setCategoryId(splitLines[0].categoryId);
      setSubcategoryId(splitLines[0].subcategoryId);
    }
    setSplitLines([]);
    setError('');
  }

  function addSplitLine() {
    const selection = getSplitBaseCategorySelection();
    const remainingMinor = getSplitTransactionFormSummary(getTemplateAmountMinor(amount), splitLines).remainingMinor;
    setSplitLines((current) => [
      ...current,
      createSplitTransactionFormLine({
        id: createTemplateSplitLineId(),
        amount: remainingMinor > 0 ? formatMinorInput(remainingMinor) : '',
        categoryId: selection.categoryId,
        subcategoryId: selection.subcategoryId,
      }),
    ]);
  }

  function updateSplitLine(lineId: string, patch: Partial<SplitTransactionFormLine>) {
    setSplitLines((current) => current.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  }

  function removeSplitLine(lineId: string) {
    const nextLines = splitLines.filter((line) => line.id !== lineId);
    if (nextLines.length === 1) {
      setCategoryId(nextLines[0].categoryId);
      setSubcategoryId(nextLines[0].subcategoryId);
      setSplitLines([]);
      setPage('form');
      return;
    }

    setSplitLines(nextLines);
  }

  function openSplitLineCategorySelect(lineId: string) {
    const selection = getSplitBaseCategorySelection();
    const line = splitLines.find((candidate) => candidate.id === lineId);
    props.onOpenCategorySelect(
      {
        kind,
        selectedCategoryId: line?.categoryId ?? selection.categoryId,
        selectedSubcategoryId: line?.subcategoryId ?? selection.subcategoryId,
        selectionMode: 'subcategory',
        showSuggestions: false,
        title: 'Split line category',
      },
      ({ categoryId: nextCategoryId, subcategoryId: nextSubcategoryId }) => {
        const nextCategory = getCategory(nextCategoryId, categories);
        updateSplitLine(lineId, {
          categoryId: nextCategory.id,
          subcategoryId: nextSubcategoryId ?? getDefaultSubcategoryId(nextCategory),
        });
      },
    );
  }

  if (page === 'account') {
    return (
      <TransactionPickerScreen
        mode="sourceAccount"
        accounts={accounts}
        selectedAccountId={accountId}
        selectedCategoryId={categoryId ?? ''}
        selectedSubcategoryId={subcategoryId ?? ''}
        kind={kind}
        categories={categories}
        transactions={snapshot.transactions}
        transactionLines={snapshot.transactionLines}
        showCurrencyCodes
        sourceAccountId={accountId}
        onClose={() => setPage('form')}
        onExit={onCancel}
        onSelectAccount={selectAccount}
        onSelectCategory={() => undefined}
        cancelTestID="cancel-transaction-template-account-picker"
      />
    );
  }

  if (page === 'split') {
    return (
      <FormScreenShell
        title={`Split ${kind} template`}
        onBack={() => setPage('form')}
        onSave={() => setPage('form')}
        saveLabel="Done"
        saveTestID="done-transaction-template-split"
      >
        <SplitTransactionEditorScrollContainer testID="transaction-template-split-page">
          <SplitTransactionEditor
            categories={categories}
            currencyCode={currencyCode}
            itemNameSuggestions={itemNameSuggestionValues}
            lines={splitLines}
            showCurrencyCodes={snapshot.settings.multiCurrencyEnabled}
            totalMinor={splitTotalMinor}
            onAddLine={addSplitLine}
            onPickCategory={openSplitLineCategorySelect}
            onRemoveLine={removeSplitLine}
            onUpdateLine={updateSplitLine}
          />
          <FormInlineAction label="Use as normal template" onPress={stopSplitTemplate} />
        </SplitTransactionEditorScrollContainer>
      </FormScreenShell>
    );
  }

  return (
    <FormScreenShell
      title={mode === 'add' ? 'Add template' : 'Edit template'}
      onBack={onCancel}
      onSave={submit}
      saveTestID={mode === 'add' ? 'save-new-transaction-template' : 'save-transaction-template'}
    >
      <KeyboardAwareFormScroll>
        <FormSection label="Type">
          <FormChipRow>
            {kindOptions.map((option) => (
              <Chip
                key={option.value}
                selected={kind === option.value}
                onPress={() => changeKind(option.value)}
                testID={`template-kind-${option.value}`}
              >
                {option.label}
              </Chip>
            ))}
          </FormChipRow>
        </FormSection>

        <AutocompleteField
          label="Template name"
          value={name}
          onChange={setName}
          placeholder={kind === 'income' ? 'Paycheck' : 'Coffee, groceries, lunch'}
          suggestions={nameSuggestions}
        />
        <AutocompleteField
          label="Transaction item"
          value={title}
          onChange={setTitle}
          placeholder={kind === 'income' ? 'Salary' : 'Groceries'}
          suggestions={titleSuggestions}
        />
        <TextField
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          placeholder={splitLines.length >= 2 ? 'Required for split templates' : 'Optional'}
          keyboardType="decimal-pad"
        />

        <FormSection label="Account">
          <TemplateAccountRow
            account={selectedAccount}
            balanceMinor={selectedAccountBalance?.balanceMinor}
            showCurrencyCodes={snapshot.settings.multiCurrencyEnabled}
            onPress={() => setPage('account')}
          />
        </FormSection>

        <FormSection label="Category">
          <CategorySelectionField
            label="Category"
            value={getCategorySelectionLabel(categoryId, subcategoryId, categories)}
            onPress={openCategorySelect}
            color={getCategorySelectionColor(categoryId, subcategoryId, categories, kind)}
            icon={getCategorySelectionIcon(categoryId, subcategoryId, categories, kind)}
            iconColor={getCategorySelectionColor(categoryId, subcategoryId, categories, kind)}
            empty={!categoryId}
          />
          {categoryId ? (
            <FormInlineAction label="Clear category" onPress={clearCategory} />
          ) : null}
        </FormSection>

        <FormSection label="Split lines">
          <SplitTemplateSummaryRow
            kind={kind}
            lineCount={splitLines.length}
            splitSummary={splitSummary}
            totalMinor={splitTotalMinor}
            currencyCode={currencyCode}
            showCurrencyCodes={snapshot.settings.multiCurrencyEnabled}
            onPress={openSplitTemplateEditor}
          />
          {splitLines.length >= 2 ? (
            <FormInlineAction label="Use as normal template" onPress={stopSplitTemplate} />
          ) : null}
        </FormSection>

        <TextField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
          multiline
        />

        <FormSection label="Template preview">
          <TemplatePreview
            amount={amount}
            categoryId={categoryId}
            categories={categories}
            currencyCode={currencyCode}
            kind={kind}
            name={name}
            splitLineCount={splitLines.length}
            subcategoryId={subcategoryId}
            title={title}
          />
          <FormHelperText>Preview only. This is what will be prefilled.</FormHelperText>
        </FormSection>

        <FormError message={error} />

        {mode === 'edit' ? (
          <FormDangerZone
            label="Template status"
            warning={
              confirmArchive || confirmDelete
                ? 'Archived templates are hidden from the template list. Deleted templates cannot be restored.'
                : undefined
            }
          >
            <ActionButton variant="secondary" onPress={archiveTemplate} testID="archive-transaction-template">
              {confirmArchive ? 'Confirm archive' : 'Archive template'}
            </ActionButton>
            <ActionButton variant="danger" onPress={deleteTemplate} testID="delete-transaction-template">
              {confirmDelete ? 'Confirm delete' : 'Delete template'}
            </ActionButton>
          </FormDangerZone>
        ) : null}
      </KeyboardAwareFormScroll>
    </FormScreenShell>
  );
}

function TemplatePreview({
  amount,
  categories,
  categoryId,
  currencyCode,
  kind,
  name,
  splitLineCount,
  subcategoryId,
  title,
}: {
  amount: string;
  categories: CategoryDefinition[];
  categoryId: string | null;
  currencyCode: string;
  kind: TransactionTemplateKind;
  name: string;
  splitLineCount: number;
  subcategoryId: string | null;
  title: string;
}) {
  const color = getCategorySelectionColor(categoryId, subcategoryId, categories, kind);
  const icon = getCategorySelectionIcon(categoryId, subcategoryId, categories, kind);
  const label = title.trim() || name.trim() || 'New transaction';
  const amountLabel = amount.trim() ? `${currencyCode} ${amount.trim()}` : 'Amount set when adding';

  return (
    <FormPreviewRow
      color={color}
      icon={icon}
      title={label}
      detail={`${splitLineCount >= 2 ? `Split ${capitalize(kind)}` : capitalize(kind)} / ${amountLabel}`}
    />
  );
}

function TemplateAccountRow({
  account,
  balanceMinor,
  onPress,
  showCurrencyCodes,
}: {
  account?: AppSnapshot['accounts'][number];
  balanceMinor?: number;
  onPress: () => void;
  showCurrencyCodes: boolean;
}) {
  const detail = account
    ? [
        account.type.replace('_', ' '),
        account.currencyCode,
        balanceMinor !== undefined
          ? formatMoney(balanceMinor, account.currencyCode, { showCurrencyCode: showCurrencyCodes })
          : null,
      ].filter(Boolean).join(' / ')
    : 'Add an account before creating templates.';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.selectorRow, pressed && styles.pressed]}
      testID="transaction-template-account-row"
    >
      {account ? (
        <AccountIconBadge account={account} size="md" />
      ) : (
        <View style={styles.emptyIcon}>
          <Ionicons name="wallet-outline" size={18} color={colors.primaryDark} />
        </View>
      )}
      <View style={styles.selectorText}>
        <Text numberOfLines={1} style={styles.selectorTitle}>
          {account ? getAccountDisplayName(account) : 'No account selected'}
        </Text>
        <Text numberOfLines={1} style={styles.selectorDetail}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

function SplitTemplateSummaryRow({
  currencyCode,
  kind,
  lineCount,
  onPress,
  showCurrencyCodes,
  splitSummary,
  totalMinor,
}: {
  currencyCode: string;
  kind: TransactionTemplateKind;
  lineCount: number;
  onPress: () => void;
  showCurrencyCodes: boolean;
  splitSummary: ReturnType<typeof getSplitTransactionFormSummary>;
  totalMinor: number;
}) {
  const hasSplitLines = lineCount >= 2;
  const detail = hasSplitLines
    ? `${lineCount} lines / ${splitSummary.isBalanced ? 'Ready' : 'Needs total'} / ${formatMoney(totalMinor, currencyCode, { showCurrencyCode: showCurrencyCodes })}`
    : `Create a split ${kind} template`;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.selectorRow, pressed && styles.pressed]}
      testID="transaction-template-split-row"
    >
      <View style={styles.emptyIcon}>
        <Ionicons name="git-branch-outline" size={18} color={colors.primaryDark} />
      </View>
      <View style={styles.selectorText}>
        <Text numberOfLines={1} style={styles.selectorTitle}>
          {hasSplitLines ? `Split ${kind} template` : 'Normal template'}
        </Text>
        <Text numberOfLines={1} style={styles.selectorDetail}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

function parseOptionalTemplateAmount(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  return parseMoneyInput(value);
}

function getTemplateAmountMinor(value: string): number {
  try {
    return Math.abs(parseMoneyInput(value));
  } catch {
    return 0;
  }
}

function getCategorySelectionLabel(
  categoryId: string | null,
  subcategoryId: string | null,
  categories: CategoryDefinition[],
): string {
  if (!categoryId) {
    return 'Optional';
  }

  const category = getCategory(categoryId, categories);
  return subcategoryId ? `${category.name} / ${getSubcategoryName(category.id, subcategoryId, categories)}` : category.name;
}

function getCategorySelectionColor(
  categoryId: string | null,
  subcategoryId: string | null,
  categories: CategoryDefinition[],
  kind: TransactionTemplateKind,
): string {
  if (!categoryId) {
    return kind === 'income' ? colors.success : colors.danger;
  }

  return getSubcategory(categoryId, subcategoryId ?? '', categories)?.color ?? getCategory(categoryId, categories).color;
}

function getCategorySelectionIcon(
  categoryId: string | null,
  subcategoryId: string | null,
  categories: CategoryDefinition[],
  kind: TransactionTemplateKind,
): string {
  if (!categoryId) {
    return kind === 'income' ? 'trending-up-outline' : 'cart-outline';
  }

  return getSubcategoryIcon(categoryId, subcategoryId ?? '', categories);
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

const styles = StyleSheet.create({
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  pressed: {
    opacity: 0.78,
  },
  selectorDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
  },
  selectorRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectorText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  selectorTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
});
