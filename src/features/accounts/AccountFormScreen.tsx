import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CurrencyDropdown } from '../../components/CurrencyDropdown';
import { AccountIconPicker } from '../../components/AccountDisplay';
import { ActionButton, Chip, FormError } from '../../components/ui';
import {
  FormChipRow,
  FormDangerZone,
  FormScreenShell,
  FormSection,
  KeyboardAwareFormScroll,
} from '../../components/FormLayout';
import {
  getAccountTypeLabel,
  formatOptionalMoneyInput,
  getInstitutionSuggestions,
  manualAccountTypes,
  parseOptionalCreditLimit,
  parseOptionalOpeningBalance,
} from '../../domain/accountForm';
import {
  accountThemeColors,
  getDefaultAccountIcon,
  normalizeAccountIconName,
} from '../../domain/accountThemes';
import { getCurrencyOptions } from '../../domain/currencyCatalog';
import { normalizeCurrencyCode } from '../../domain/money';
import type {
  Account,
  AccountType,
  AppSnapshot,
  NewAccountInput,
  UpdateAccountInput,
} from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { AccountColorPicker, AccountField, IconToggle } from './AccountFormControls';

type AccountFormScreenProps =
  | {
      mode: 'add';
      snapshot: AppSnapshot;
      onAddAccount: (input: NewAccountInput) => Promise<void>;
      onCancel: () => void;
      onDone: () => void;
    }
  | {
      mode: 'edit';
      snapshot: AppSnapshot;
      account: Account;
      onUpdateAccount: (input: UpdateAccountInput) => Promise<void>;
      onCloseAccount: (accountId: string) => Promise<void>;
      onReopenAccount: (accountId: string) => Promise<void>;
      onDeleteAccount: (accountId: string) => Promise<void>;
      onCancel: () => void;
      onDone: () => void;
    };

const currencyOptions = getCurrencyOptions();

export function AccountFormScreen(props: AccountFormScreenProps) {
  const { mode, snapshot, onCancel, onDone } = props;
  const editingAccount = mode === 'edit' ? props.account : null;
  const [name, setName] = useState(editingAccount?.name ?? '');
  const [nickname, setNickname] = useState(editingAccount?.nickname ?? '');
  const [type, setType] = useState<AccountType>(editingAccount?.type === 'brokerage' ? 'checking' : editingAccount?.type ?? 'checking');
  const [currencyCode, setCurrencyCode] = useState(editingAccount?.currencyCode ?? snapshot.defaultCurrencyCode);
  const [openingBalance, setOpeningBalance] = useState('');
  const [creditLimit, setCreditLimit] = useState(formatOptionalMoneyInput(editingAccount?.creditLimitMinor));
  const [notes, setNotes] = useState(editingAccount?.notes ?? '');
  const [institutionName, setInstitutionName] = useState(editingAccount?.institutionName ?? '');
  const [includeInRainyDay, setIncludeInRainyDay] = useState(editingAccount?.includeInRainyDay ?? false);
  const [themeColor, setThemeColor] = useState(editingAccount?.themeColor ?? accountThemeColors[0]);
  const [iconName, setIconName] = useState(editingAccount?.iconName ?? getDefaultAccountIcon(type));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [error, setError] = useState('');
  const institutionSuggestions = useMemo(() => {
    const query = institutionName.trim().toLowerCase();
    if (!query) {
      return [];
    }

    return getInstitutionSuggestions(snapshot.accounts, query, institutionName);
  }, [institutionName, snapshot.accounts]);

  async function submit() {
    try {
      if (mode === 'add') {
        await props.onAddAccount({
          name,
          nickname,
          type,
          currencyCode: normalizeCurrencyCode(currencyCode, snapshot.defaultCurrencyCode),
          openingBalanceMinor: parseOptionalOpeningBalance(openingBalance),
          creditLimitMinor: type === 'credit_card' ? parseOptionalCreditLimit(creditLimit) : null,
          notes,
          institutionName,
          includeInRainyDay,
          themeColor,
          iconName: normalizeAccountIconName(iconName, type),
        });
      } else {
        await props.onUpdateAccount({
          id: props.account.id,
          name,
          nickname,
          notes,
          institutionName,
          includeInRainyDay,
          creditLimitMinor: props.account.type === 'credit_card' ? parseOptionalCreditLimit(creditLimit) : null,
          themeColor,
          iconName: normalizeAccountIconName(iconName, props.account.type),
        });
      }

      setError('');
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save account.');
    }
  }

  async function closeAccount() {
    if (mode !== 'edit') {
      return;
    }

    if (!confirmClose) {
      setConfirmClose(true);
      setConfirmDelete(false);
      return;
    }

    try {
      await props.onCloseAccount(props.account.id);
      setError('');
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not close account.');
    }
  }

  async function reopenAccount() {
    if (mode !== 'edit') {
      return;
    }

    try {
      await props.onReopenAccount(props.account.id);
      setError('');
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not reopen account.');
    }
  }

  async function deleteAccount() {
    if (mode !== 'edit') {
      return;
    }

    if (!confirmDelete) {
      setConfirmDelete(true);
      setConfirmClose(false);
      return;
    }

    try {
      await props.onDeleteAccount(props.account.id);
      setError('');
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete account.');
    }
  }

  return (
    <FormScreenShell
      title={mode === 'add' ? 'Add account' : 'Edit account'}
      onBack={onCancel}
      onSave={submit}
      saveLabel="Confirm"
      saveTestID={mode === 'add' ? 'add-account' : 'save-account'}
    >
      <KeyboardAwareFormScroll>
        <AccountField label="Name" value={name} onChangeText={setName} placeholder="Everyday account" />
        <AccountField
          label="Nickname"
          value={nickname}
          onChangeText={setNickname}
          placeholder={name || 'Defaults to account name'}
        />

        {mode === 'add' ? (
          <>
            <FormSection label="Account type">
              <FormChipRow>
                {manualAccountTypes.map((accountType) => (
                  <Chip
                    key={accountType}
                    selected={type === accountType}
                    onPress={() => {
                      setIconName((currentIcon) =>
                        currentIcon === getDefaultAccountIcon(type) ? getDefaultAccountIcon(accountType) : currentIcon,
                      );
                      setType(accountType);
                      if (accountType !== 'credit_card') {
                        setCreditLimit('');
                      }
                    }}
                  >
                    {getAccountTypeLabel(accountType)}
                  </Chip>
                ))}
              </FormChipRow>
            </FormSection>

            <CurrencyDropdown
              label="Currency"
              value={currencyCode}
              options={currencyOptions}
              onChange={setCurrencyCode}
              testID="account-currency-dropdown"
            />
            <AccountField
              label="Opening balance"
              value={openingBalance}
              onChangeText={setOpeningBalance}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </>
        ) : null}

        {type === 'credit_card' ? (
          <AccountField
            label="Credit limit"
            value={creditLimit}
            onChangeText={setCreditLimit}
            placeholder="Optional"
            keyboardType="decimal-pad"
          />
        ) : null}

        <View style={styles.autocompleteWrap}>
          <AccountField
            label="Institution"
            value={institutionName}
            onChangeText={setInstitutionName}
            placeholder="Optional"
          />
          {institutionSuggestions.length ? (
            <View style={styles.suggestions}>
              {institutionSuggestions.map((suggestion) => (
                <Pressable
                  key={suggestion}
                  accessibilityRole="button"
                  onPress={() => setInstitutionName(suggestion)}
                  style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <AccountField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional purpose, fees, or details"
          multiline
        />

        <FormSection label="Account flags">
          <View style={styles.iconToggleRow}>
            <IconToggle
              accessibilityLabel="Toggle rainy day fund"
              icon="umbrella-outline"
              selected={includeInRainyDay}
              onPress={() => setIncludeInRainyDay((value) => !value)}
            />
          </View>
        </FormSection>

        <AccountColorPicker value={themeColor} onChange={setThemeColor} />
        <FormSection label="Account icon">
          <AccountIconPicker selectedColor={themeColor} selectedIcon={iconName} onSelectIcon={setIconName} />
        </FormSection>

        <FormError message={error} />

        {mode === 'edit' ? (
          <FormDangerZone
            label="Account status"
            warning={
              confirmDelete
                ? 'Delete only works for accounts with no transaction history. Otherwise, close the account.'
                : undefined
            }
          >
            <View style={styles.actionRow}>
              {props.account.isArchived ? (
                <ActionButton variant="secondary" onPress={reopenAccount}>
                  Reopen account
                </ActionButton>
              ) : (
                <ActionButton variant="secondary" onPress={closeAccount}>
                  {confirmClose ? 'Confirm close' : 'Close account'}
                </ActionButton>
              )}
              <ActionButton variant="danger" onPress={deleteAccount}>
                {confirmDelete ? 'Confirm delete' : 'Delete'}
              </ActionButton>
            </View>
          </FormDangerZone>
        ) : null}
      </KeyboardAwareFormScroll>
    </FormScreenShell>
  );
}

const styles = StyleSheet.create({
  iconToggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  autocompleteWrap: {
    gap: spacing.xs,
    position: 'relative',
    zIndex: 10,
  },
  suggestions: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    elevation: 8,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    top: 72,
    zIndex: 20,
  },
  suggestion: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  suggestionText: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.78,
  },
});
