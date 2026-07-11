import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/ui';
import {
  addDashboardCardSetting,
  getDashboardCardAddOptions,
  getDashboardCardDefinition,
  getVisibleDashboardCardSettings,
  hideDashboardCardSetting,
  normalizeDashboardCardSettings,
  reorderVisibleDashboardCardSettings,
  type DashboardCardAddOption,
  type DashboardCardAvailability,
} from '../../domain/dashboardCards';
import { haveIdsInSameOrder } from '../../domain/reorder';
import type { DashboardCardId, DashboardCardSetting } from '../../domain/types';
import { sharedStyles } from '../../theme/sharedStyles';
import { colors, spacing, typography } from '../../theme/tokens';
import { DashboardCardReorderList } from './DashboardCardReorderList';
import { DashboardCardPreview } from './DashboardCardPreview';

type DashboardEditScreenProps = {
  availability: DashboardCardAvailability;
  onOpenAddCards: () => void;
  onUpdateSettings: (settings: DashboardCardSetting[]) => Promise<void>;
  settings: DashboardCardSetting[] | null | undefined;
};

type DashboardAddCardsScreenProps = {
  availability: DashboardCardAvailability;
  onUpdateSettings: (settings: DashboardCardSetting[]) => Promise<void>;
  settings: DashboardCardSetting[] | null | undefined;
};

export function DashboardEditScreen({
  availability,
  onOpenAddCards,
  onUpdateSettings,
  settings,
}: DashboardEditScreenProps) {
  const [draftSettings, setDraftSettings] = useState(() => normalizeDashboardCardSettings(settings));
  const visibleSettings = useMemo(() => getVisibleDashboardCardSettings(draftSettings), [draftSettings]);
  const visibleSettingIds = useMemo(
    () => visibleSettings.map((setting) => setting.id),
    [visibleSettings],
  );

  useEffect(() => {
    setDraftSettings(normalizeDashboardCardSettings(settings));
  }, [settings]);

  const commit = useCallback(async (nextSettings: DashboardCardSetting[]) => {
    setDraftSettings(nextSettings);
    await onUpdateSettings(nextSettings);
  }, [onUpdateSettings]);

  const hideCard = useCallback((cardId: DashboardCardId) => {
    void commit(hideDashboardCardSetting(draftSettings, cardId));
  }, [commit, draftSettings]);

  const reorderVisibleCards = useCallback((nextVisibleIds: DashboardCardId[]) => {
    if (haveIdsInSameOrder(visibleSettingIds, nextVisibleIds)) {
      return;
    }

    void commit(
      reorderVisibleDashboardCardSettings(draftSettings, nextVisibleIds),
    );
  }, [commit, draftSettings, visibleSettingIds]);

  const headerComponent = useMemo(() => (
    <View style={styles.headerBlock}>
      <Text style={styles.note}>Drag cards to reorder them. Remove a card to hide it from Dashboard.</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onOpenAddCards}
        style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
        testID="dashboard-edit-open-add-cards"
      >
        <Ionicons name="add" size={19} color={colors.surface} />
        <Text style={styles.primaryActionText}>Add card</Text>
      </Pressable>
    </View>
  ), [onOpenAddCards]);

  const renderEditCardRow = useCallback((
    setting: DashboardCardSetting,
    {
      dragging,
      reorderActive,
      shouldSuppressPress,
    }: {
      dragging: boolean;
      reorderActive: boolean;
      shouldSuppressPress: () => boolean;
    },
  ) => (
    <DashboardEditCardRow
      availability={availability}
      canHide={visibleSettings.length > 1}
      dragging={dragging}
      reorderActive={reorderActive}
      setting={setting}
      onHideCard={hideCard}
      shouldSuppressPress={shouldSuppressPress}
    />
  ), [availability, hideCard, visibleSettings.length]);

  return (
    <View style={styles.stack}>
      <DashboardCardReorderList
        contentContainerStyle={styles.listContent}
        headerComponent={headerComponent}
        rows={visibleSettings}
        renderRow={renderEditCardRow}
        onDragEnd={reorderVisibleCards}
      />
    </View>
  );
}

export function DashboardAddCardsScreen({
  availability,
  onUpdateSettings,
  settings,
}: DashboardAddCardsScreenProps) {
  const [draftSettings, setDraftSettings] = useState(() => normalizeDashboardCardSettings(settings));
  const options = useMemo(
    () => getDashboardCardAddOptions(draftSettings, availability),
    [availability, draftSettings],
  );
  const addableOptions = options.filter((option) => option.available);
  const unavailableOptions = options.filter((option) => !option.available);

  useEffect(() => {
    setDraftSettings(normalizeDashboardCardSettings(settings));
  }, [settings]);

  async function addCard(cardId: DashboardCardId) {
    const nextSettings = addDashboardCardSetting(draftSettings, cardId);
    setDraftSettings(nextSettings);
    await onUpdateSettings(nextSettings);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.addListContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      testID="dashboard-add-cards-list"
    >
      <Text style={styles.note}>Browse card previews and add the cards you want on Dashboard.</Text>

      {addableOptions.length ? (
        <View style={styles.addCardStack}>
          {addableOptions.map((option) => (
            <DashboardAddCardRow key={option.id} option={option} onAddCard={addCard} />
          ))}
        </View>
      ) : (
        <Card style={styles.emptyCard} testID="dashboard-add-cards-empty">
          <Text style={styles.cardTitle}>No hidden cards</Text>
          <Text style={styles.emptyText}>Every available card is already enabled on your Dashboard.</Text>
        </Card>
      )}

      {unavailableOptions.length ? (
        <View style={styles.addCardStack}>
          <Text style={styles.sectionLabel}>Not available yet</Text>
          {unavailableOptions.map((option) => (
            <DashboardAddCardRow key={option.id} option={option} onAddCard={addCard} />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function DashboardEditCardRow({
  availability,
  canHide,
  dragging,
  reorderActive,
  setting,
  onHideCard,
  shouldSuppressPress,
}: {
  availability: DashboardCardAvailability;
  canHide: boolean;
  dragging: boolean;
  reorderActive: boolean;
  setting: DashboardCardSetting;
  onHideCard: (cardId: DashboardCardId) => void;
  shouldSuppressPress: () => boolean;
}) {
  const definition = getDashboardCardDefinition(setting.id);
  const available = availability[setting.id] !== false;
  const hideEnabled = canHide && !reorderActive;
  const reason = available ? '' : definition.unavailableReason ?? 'This card is not available yet.';

  return (
    <View style={styles.editCardFrame}>
      <View
        style={[
          styles.editCardRow,
          dragging && sharedStyles.draggingSurface,
          dragging && sharedStyles.draggingLift,
        ]}
        testID={`dashboard-edit-card-${setting.id}`}
      >
        <View style={styles.editCardHeader}>
          <View
            accessibilityLabel={`Reorder ${definition.title}`}
            style={styles.dragHandle}
            testID={`dashboard-card-drag-${setting.id}`}
          >
            <Ionicons name="reorder-three-outline" size={24} color={colors.primaryDark} />
          </View>

          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{definition.title}</Text>
            <Text style={styles.rowDetail}>{definition.description}</Text>
            {!available ? <Text style={styles.unavailableText}>{reason}</Text> : null}
          </View>

          <Pressable
            accessibilityLabel={`Remove ${definition.title}`}
            accessibilityRole="button"
            disabled={!hideEnabled}
            onPress={() => {
              if (!shouldSuppressPress()) {
                onHideCard(setting.id);
              }
            }}
            style={({ pressed }) => [
              styles.hideButton,
              !hideEnabled && styles.disabledButton,
              pressed && hideEnabled && styles.pressed,
            ]}
            testID={`dashboard-card-hide-${setting.id}`}
          >
            <Ionicons name="close" size={20} color={hideEnabled ? colors.danger : colors.muted} />
          </Pressable>
        </View>

        <DashboardCardPreview cardId={setting.id} disabled={!available} />
      </View>
    </View>
  );
}

function DashboardAddCardRow({
  onAddCard,
  option,
}: {
  onAddCard: (cardId: DashboardCardId) => void;
  option: DashboardCardAddOption;
}) {
  return (
    <Card
      style={option.available ? styles.addCard : styles.unavailableAddCard}
      testID={`dashboard-add-card-${option.id}`}
    >
      <View style={styles.addCardHeader}>
        <View style={styles.rowText}>
          <Text style={styles.cardTitle}>{option.title}</Text>
          <Text style={styles.rowDetail}>{option.description}</Text>
          {!option.available ? <Text style={styles.unavailableText}>{option.unavailableReason}</Text> : null}
        </View>
        <Pressable
          accessibilityLabel={`Add ${option.title}`}
          accessibilityRole="button"
          disabled={!option.available}
          onPress={() => onAddCard(option.id)}
          style={({ pressed }) => [
            styles.addButton,
            !option.available && styles.disabledButton,
            pressed && option.available && styles.pressed,
          ]}
          testID={`dashboard-card-add-${option.id}`}
        >
          <Text style={[styles.addButtonText, !option.available && styles.disabledButtonText]}>
            {option.available ? 'Add' : 'Unavailable'}
          </Text>
        </Pressable>
      </View>

      <DashboardCardPreview cardId={option.id} disabled={!option.available} />
    </Card>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  addButtonText: {
    color: colors.surface,
    fontSize: typography.small,
    fontWeight: '900',
  },
  addCard: {
    gap: spacing.md,
    padding: spacing.md,
  },
  addCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  addCardStack: {
    gap: spacing.md,
  },
  addListContent: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledButtonText: {
    color: colors.muted,
  },
  dragHandle: {
    alignItems: 'center',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    width: 38,
  },
  editCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editCardFrame: {
    paddingBottom: spacing.md,
    width: '100%',
  },
  editCardRow: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  emptyCard: {
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 21,
  },
  headerBlock: {
    gap: spacing.md,
  },
  hideButton: {
    alignItems: 'center',
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  listContent: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  note: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 21,
  },
  pressed: {
    opacity: 0.78,
  },
  primaryAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  primaryActionText: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: '900',
  },
  rowDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  rowTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  stack: {
    flex: 1,
  },
  unavailableAddCard: {
    gap: spacing.md,
    opacity: 0.78,
    padding: spacing.md,
  },
  unavailableText: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: '800',
    lineHeight: 17,
  },
});
