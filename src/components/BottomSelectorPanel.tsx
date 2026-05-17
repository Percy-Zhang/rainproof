import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '../theme/tokens';

type BottomSelectorPanelProps = PropsWithChildren<{
  testID?: string;
}>;

export function BottomSelectorPanel({ children, testID }: BottomSelectorPanelProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.panel, { bottom: -insets.bottom, paddingBottom: spacing.md + insets.bottom }]}
      testID={testID}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderTopColor: colors.faint,
    borderTopWidth: 1,
    gap: spacing.sm,
    left: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    position: 'absolute',
    right: 0,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
});
