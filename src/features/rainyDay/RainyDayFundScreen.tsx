import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card, FormError, SectionHeader, TextField } from '../../components/ui';
import { getRainyDayProgress } from '../../domain/aggregates';
import { getCurrenciesInUse } from '../../domain/currency';
import { normalizeCurrencyCode, parseMoneyInput } from '../../domain/money';
import { formatMinorForInput, parseRainyDayGoalForPreview } from '../../domain/rainyDay';
import type { AccountBalance, AppSnapshot, RainyDayProgress, UpdateRainyDayFundInput } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { RainyAccountRow, RainyDayProgressCard } from './RainyDayComponents';

type RainyDayFundScreenProps = {
  snapshot: AppSnapshot;
  accountBalances: AccountBalance[];
  rainyDayProgress: RainyDayProgress;
  onUpdateRainyDayFund: (input: UpdateRainyDayFundInput) => Promise<void>;
  showHeader?: boolean;
};

export function RainyDayFundScreen({
  snapshot,
  accountBalances,
  rainyDayProgress,
  onUpdateRainyDayFund,
  showHeader = true,
}: RainyDayFundScreenProps) {
  const [currencyCode, setCurrencyCode] = useState(snapshot.rainyDayFund.currencyCode);
  const [goalText, setGoalText] = useState(formatMinorForInput(snapshot.rainyDayFund.goalMinor));
  const [linkedAccountIds, setLinkedAccountIds] = useState(snapshot.rainyDayFund.linkedAccountIds);
  const [error, setError] = useState('');

  useEffect(() => {
    setCurrencyCode(snapshot.rainyDayFund.currencyCode);
    setGoalText(formatMinorForInput(snapshot.rainyDayFund.goalMinor));
    setLinkedAccountIds(snapshot.rainyDayFund.linkedAccountIds);
  }, [snapshot.rainyDayFund]);

  const currencies = useMemo(
    () =>
      getCurrenciesInUse([
        snapshot.defaultCurrencyCode,
        snapshot.rainyDayFund.currencyCode,
        ...snapshot.accounts.map((account) => account.currencyCode),
      ]),
    [snapshot],
  );
  const showCurrencyCodes = snapshot.settings.multiCurrencyEnabled || currencies.length > 1;
  const eligibleBalances = useMemo(
    () => accountBalances.filter(({ account }) => account.currencyCode === currencyCode),
    [accountBalances, currencyCode],
  );
  const validLinkedAccountIds = useMemo(
    () =>
      linkedAccountIds.filter((accountId) =>
        eligibleBalances.some(({ account }) => account.id === accountId),
      ),
    [eligibleBalances, linkedAccountIds],
  );
  const draftGoalMinor = parseRainyDayGoalForPreview(goalText);
  const draftProgress = getRainyDayProgress(
    {
      ...snapshot.rainyDayFund,
      currencyCode,
      goalMinor: draftGoalMinor ?? rainyDayProgress.fund.goalMinor,
      linkedAccountIds: validLinkedAccountIds,
    },
    accountBalances,
  );
  const hasSelectedAccounts = validLinkedAccountIds.length > 0;
  const isComplete = draftProgress.fund.goalMinor > 0 && draftProgress.remainingMinor === 0;

  function toggleAccount(accountId: string) {
    setLinkedAccountIds((currentIds) =>
      currentIds.includes(accountId)
        ? currentIds.filter((id) => id !== accountId)
        : [...currentIds, accountId],
    );
  }

  async function saveRainyDayFund() {
    try {
      const goalMinor = goalText.trim() ? parseMoneyInput(goalText) : 0;
      if (goalMinor < 0) {
        throw new Error('Enter a threshold of 0.00 or more.');
      }

      await onUpdateRainyDayFund({
        currencyCode: normalizeCurrencyCode(currencyCode, snapshot.defaultCurrencyCode),
        goalMinor,
        linkedAccountIds: validLinkedAccountIds,
      });
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update rainy day fund.');
    }
  }

  return (
    <View style={styles.stack}>
      {showHeader ? (
        <SectionHeader
          title="Rainy day fund"
          detail="Set a threshold and choose which accounts count toward it."
        />
      ) : null}

      <Card testID="rainy-day-progress-card" style={styles.progressCard}>
        <RainyDayProgressCard
          currencyCode={currencyCode}
          hasSelectedAccounts={hasSelectedAccounts}
          isComplete={isComplete}
          progress={draftProgress}
          showCurrencyCodes={showCurrencyCodes}
        />
      </Card>

      <Card testID="rainy-day-settings-card" style={styles.settingsCard}>
        <Text style={styles.cardTitle}>Settings</Text>
        {showCurrencyCodes ? (
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Currency</Text>
            <View style={styles.currencyWrap}>
              {currencies.map((currency) => (
                <Pressable
                  accessibilityRole="button"
                  key={currency}
                  onPress={() => setCurrencyCode(currency)}
                  style={({ pressed }) => [
                    styles.currencyChip,
                    currencyCode === currency && styles.currencyChipSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.currencyChipText, currencyCode === currency && styles.currencyChipTextSelected]}>
                    {currency}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        <TextField
          label="Threshold"
          value={goalText}
          onChangeText={setGoalText}
          keyboardType="decimal-pad"
          placeholder="0.00"
          testID="rainy-day-threshold"
        />
      </Card>

      <Card testID="rainy-day-accounts-card" style={styles.settingsCard}>
        <View style={styles.sectionRow}>
          <Text style={styles.cardTitle}>Connected accounts</Text>
          <Text style={styles.countText}>{validLinkedAccountIds.length} selected</Text>
        </View>
        {eligibleBalances.length ? (
          <View style={styles.accountList}>
            {eligibleBalances.map(({ account, balanceMinor }) => (
              <RainyAccountRow
                key={account.id}
                balanceMinor={balanceMinor}
                selected={validLinkedAccountIds.includes(account.id)}
                showCurrencyCodes={showCurrencyCodes}
                accountBalance={{ account, balanceMinor }}
                onPress={() => toggleAccount(account.id)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Ionicons name="wallet-outline" size={24} color={colors.primaryDark} />
            <Text style={styles.emptyText}>No open accounts use {currencyCode} yet.</Text>
          </View>
        )}
        <FormError message={error} />
        <ActionButton onPress={saveRainyDayFund} testID="save-rainy-day-fund">
          Save rainy day fund
        </ActionButton>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  progressCard: {
    gap: spacing.md,
  },
  settingsCard: {
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '900',
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
  currencyWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  currencyChip: {
    borderColor: colors.faint,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  currencyChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  currencyChipText: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '800',
  },
  currencyChipTextSelected: {
    color: colors.surface,
  },
  sectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  countText: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
  },
  accountList: {
    gap: spacing.sm,
  },
  emptyBox: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
    fontWeight: '800',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.78,
  },
});
