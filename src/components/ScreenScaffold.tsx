import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { spacing } from '../theme/tokens';
import { ScreenHeader } from './ScreenHeader';

type ScreenScaffoldProps = PropsWithChildren<{
  screenKey: string;
}>;

type BackScreenScaffoldProps = ScreenScaffoldProps & {
  onBack: () => void;
  scroll?: boolean;
};

type EdgeScreenScaffoldProps = ScreenScaffoldProps & {
  onBack: () => void;
};

export function ComposerScreenScaffold({ children, screenKey }: ScreenScaffoldProps) {
  return (
    <View style={styles.composerContent} testID={`screen-${screenKey}`}>
      {children}
    </View>
  );
}

export function DashboardScrollScaffold({ children, screenKey }: ScreenScaffoldProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.dashboardContent}
      keyboardShouldPersistTaps="handled"
      testID={`screen-${screenKey}`}
    >
      {children}
    </ScrollView>
  );
}

export function BackScreenScaffold({
  children,
  onBack,
  screenKey,
  scroll = false,
}: BackScreenScaffoldProps) {
  return (
    <View style={styles.fullScreenContent} testID={`screen-${screenKey}`}>
      <ScreenHeader onBack={onBack} />
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.subScreenContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.subScreenScroll}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </View>
  );
}

export function EdgeScreenScaffold({ children, onBack, screenKey }: EdgeScreenScaffoldProps) {
  return (
    <View style={styles.edgeScreenContent} testID={`screen-${screenKey}`}>
      <View style={styles.returnHeaderInset}>
        <ScreenHeader onBack={onBack} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  composerContent: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  dashboardContent: {
    padding: spacing.lg,
    paddingBottom: 96,
  },
  fullScreenContent: {
    flex: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  edgeScreenContent: {
    flex: 1,
  },
  returnHeaderInset: {
    paddingHorizontal: spacing.lg,
  },
  subScreenScroll: {
    flex: 1,
  },
  subScreenContent: {
    paddingBottom: spacing.xl,
  },
});
