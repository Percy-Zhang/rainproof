import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/ui';
import type {
  StatsCashFlowWaterfall,
  StatsCashFlowWaterfallStep,
} from '../../domain/statsCashFlowWaterfall';
import { formatMoney } from '../../domain/money';
import { colors, spacing, typography } from '../../theme/tokens';
import { formatSignedMoney } from './StatsScreenUtils';

export function StatsCashFlowWaterfallCard({
  model,
  onOpenStep,
}: {
  model: StatsCashFlowWaterfall;
  onOpenStep?: (step: StatsCashFlowWaterfallStep) => void;
}) {
  const scale = getWaterfallScale(model.steps);

  return (
    <Card testID="stats-cash-flow-waterfall-card">
      <View style={styles.header}>
        <Text style={styles.title}>Cash flow</Text>
        <Text style={styles.subtitle}>Selected balance movement for this period</Text>
      </View>

      {model.eligibleAccountIds.length ? (
        <View style={styles.rows}>
          {model.steps.map((step, index) => (
            <WaterfallStepRow
              key={step.id}
              currencyCode={model.currencyCode}
              onPress={isInteractiveStep(step) && onOpenStep ? () => onOpenStep(step) : undefined}
              scale={scale}
              showSeparator={index < model.steps.length - 1}
              step={step}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText} testID="stats-cash-flow-waterfall-empty">
          Select an account in this currency to see cash flow.
        </Text>
      )}
    </Card>
  );
}

function WaterfallStepRow({
  currencyCode,
  onPress,
  scale,
  showSeparator,
  step,
}: {
  currencyCode: string;
  onPress?: () => void;
  scale: WaterfallScale;
  showSeparator: boolean;
  step: StatsCashFlowWaterfallStep;
}) {
  const isAnchor = step.kind === 'start' || step.kind === 'end';
  const tone = getStepTone(step);
  const startPosition = getScalePosition(step.startBalanceMinor, scale);
  const endPosition = getScalePosition(step.endBalanceMinor, scale);
  const rawBarWidth = Math.abs(endPosition - startPosition);
  const barWidth = step.deltaMinor === 0 ? 0 : Math.max(1.5, rawBarWidth);
  const barLeft = Math.min(Math.min(startPosition, endPosition), 100 - barWidth);
  const amountLabel = isAnchor
    ? formatMoney(step.endBalanceMinor, currencyCode)
    : formatSignedMoney(step.deltaMinor, currencyCode);

  return (
    <Pressable
      accessibilityLabel={`${step.label}, ${amountLabel}`}
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        showSeparator && styles.rowSeparator,
        pressed && styles.pressed,
      ]}
      testID={`stats-cash-flow-step-${step.id}`}
    >
      <View style={styles.labelRow}>
        <Text numberOfLines={1} style={[styles.stepLabel, isAnchor && styles.anchorLabel]}>
          {step.label}
        </Text>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.68}
          numberOfLines={1}
          style={[styles.amount, isAnchor ? styles.anchorAmount : { color: tone }]}
          testID={`stats-cash-flow-step-amount-${step.id}`}
        >
          {amountLabel}
        </Text>
      </View>

      <View
        accessible={false}
        style={styles.track}
        testID={`stats-cash-flow-step-track-${step.id}`}
      >
        <View style={styles.rail} />
        {barWidth > 0 ? (
          <View
            style={[
              styles.movementBar,
              {
                backgroundColor: tone,
                left: toPercentage(barLeft),
                width: toPercentage(barWidth),
              },
            ]}
          />
        ) : null}
        <View
          style={[
            styles.balanceMarker,
            isAnchor && styles.anchorMarker,
            { left: toPercentage(endPosition) },
          ]}
        />
      </View>
    </Pressable>
  );
}

type WaterfallScale = {
  minimumMinor: number;
  spanMinor: number;
};

function getWaterfallScale(steps: StatsCashFlowWaterfallStep[]): WaterfallScale {
  const balances = steps.flatMap((step) => [step.startBalanceMinor, step.endBalanceMinor]);
  if (!balances.length) {
    return { minimumMinor: -1, spanMinor: 2 };
  }

  const minimumMinor = Math.min(...balances);
  const maximumMinor = Math.max(...balances);
  const rawSpanMinor = maximumMinor - minimumMinor;
  const paddingMinor = rawSpanMinor > 0
    ? Math.max(1, Math.round(rawSpanMinor * 0.04))
    : Math.max(1, Math.round(Math.abs(minimumMinor) * 0.02));

  return {
    minimumMinor: minimumMinor - paddingMinor,
    spanMinor: rawSpanMinor + paddingMinor * 2,
  };
}

function getScalePosition(balanceMinor: number, scale: WaterfallScale): number {
  return Math.max(0, Math.min(100, ((balanceMinor - scale.minimumMinor) / scale.spanMinor) * 100));
}

function toPercentage(value: number): `${number}%` {
  return `${Math.max(0, Math.min(100, value))}%`;
}

function isInteractiveStep(step: StatsCashFlowWaterfallStep): boolean {
  return !!step.categoryId && !!step.drilldownReportKind;
}

function getStepTone(step: StatsCashFlowWaterfallStep): string {
  if (step.kind === 'start' || step.kind === 'end') {
    return colors.ink;
  }

  if (step.kind === 'income') {
    return colors.success;
  }

  if (step.kind === 'expense-category' || step.kind === 'other-expenses') {
    return colors.danger;
  }

  return colors.primary;
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
  title: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  rows: {
    marginHorizontal: -spacing.xs,
  },
  row: {
    gap: spacing.xs,
    minHeight: 52,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  rowSeparator: {
    borderBottomColor: colors.faint,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  stepLabel: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '800',
    minWidth: 0,
  },
  anchorLabel: {
    fontWeight: '900',
  },
  amount: {
    flexShrink: 0,
    fontSize: typography.body,
    fontWeight: '900',
    maxWidth: '48%',
    textAlign: 'right',
  },
  anchorAmount: {
    color: colors.ink,
  },
  track: {
    height: 10,
    justifyContent: 'center',
    marginHorizontal: 2,
    position: 'relative',
  },
  rail: {
    backgroundColor: colors.faint,
    height: 2,
    left: 0,
    opacity: 0.65,
    position: 'absolute',
    right: 0,
  },
  movementBar: {
    borderRadius: 999,
    height: 8,
    position: 'absolute',
  },
  balanceMarker: {
    backgroundColor: colors.ink,
    borderRadius: 2,
    height: 10,
    marginLeft: -1,
    position: 'absolute',
    width: 2,
  },
  anchorMarker: {
    backgroundColor: colors.primaryDark,
    height: 12,
    marginLeft: -2,
    width: 4,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
});
