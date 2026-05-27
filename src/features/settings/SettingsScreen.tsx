import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { Card, SectionHeader } from '../../components/ui';
import { getCurrencyName, uniqueCurrencyCodes } from '../../domain/currencyCatalog';
import { getCurrencySymbol } from '../../domain/money';
import type { AppSnapshot, UpdateAppSettingsInput } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';

type SettingsScreenProps = {
  snapshot: AppSnapshot;
  onOpenDashboardCards: () => void;
  onOpenCategoryManagement: () => void;
  onUpdateSettings: (input: UpdateAppSettingsInput) => Promise<void>;
  showHeader?: boolean;
};

export function SettingsScreen({
  snapshot,
  onOpenDashboardCards,
  onOpenCategoryManagement,
  showHeader = true,
}: SettingsScreenProps) {
  const accountCurrencyCodes = uniqueCurrencyCodes(snapshot.accounts.map((account) => account.currencyCode));
  const displayCurrencyCodes = accountCurrencyCodes.length ? accountCurrencyCodes : [snapshot.settings.defaultCurrencyCode];

  return (
    <View style={styles.stack}>
      {showHeader ? (
        <SectionHeader title="Settings" detail="App defaults, currency behavior, and categories." />
      ) : null}

      <Card testID="currency-settings-card">
        <Text style={styles.cardTitle}>Currency</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Default currency</Text>
            <Text style={styles.smallMuted}>
              New accounts default to this currency, detected from your device when Rainproof is first set up.
            </Text>
          </View>
          <Text style={styles.currencyBadge}>
            {snapshot.settings.defaultCurrencyCode} {getCurrencySymbol(snapshot.settings.defaultCurrencyCode)}
          </Text>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Currency display</Text>
            <Text style={styles.smallMuted}>
              Rainproof automatically shows currency codes when accounts use more than one currency.
            </Text>
          </View>
          <Text style={styles.currencyBadge}>
            {snapshot.settings.multiCurrencyEnabled ? 'Multiple' : 'Single'}
          </Text>
        </View>

        <View style={styles.currencyList}>
          {displayCurrencyCodes.map((currencyCode) => (
            <View key={currencyCode} style={styles.currencyRow}>
              <Text style={styles.currencyPillText}>
                {currencyCode} {getCurrencySymbol(currencyCode)}
              </Text>
              <Text style={styles.smallMuted}>{getCurrencyName(currencyCode)}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card testID="dashboard-card-settings-card">
        <Text style={styles.cardTitle}>Dashboard</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenDashboardCards}
          style={({ pressed }) => [styles.settingsNavRow, pressed && styles.pressed]}
        >
          <CategoryIconBadge color={colors.primary} icon="grid-outline" size="md" />
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Dashboard cards</Text>
            <Text style={styles.smallMuted}>Choose visible cards and reorder the Dashboard.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      </Card>

      <Card testID="category-settings-card">
        <Text style={styles.cardTitle}>Categories</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenCategoryManagement}
          style={({ pressed }) => [styles.settingsNavRow, pressed && styles.pressed]}
        >
          <CategoryIconBadge color={colors.primary} icon="pricetags-outline" size="md" />
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Edit categories</Text>
            <Text style={styles.smallMuted}>Names, colors, icons, and subcategories.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      </Card>

      <Text style={styles.note}>
        Currency conversion and exchange rates are not active yet. Until then, balances remain separated internally by
        currency.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '800',
  },
  settingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  settingsNavRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  settingText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  settingTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '800',
  },
  smallMuted: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
  },
  currencyBadge: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
  },
  currencyList: {
    gap: spacing.sm,
  },
  currencyRow: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  currencyPillText: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '800',
  },
  note: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    paddingBottom: spacing.xl,
  },
  pressed: {
    opacity: 0.78,
  },
});
