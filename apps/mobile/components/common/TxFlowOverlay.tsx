/**
 * Full-screen loading overlay for multi-step transaction flows.
 *
 * Mounted as a sibling to the Stack (outside the navigator), so Expo
 * Router's iOS Phantom callback nav reset can't unmount it. This hides
 * the brief home-screen flash on iOS settle and the DB save window on
 * both platforms.
 *
 * Design (per Emil's engineering principles):
 * - Near-opaque backdrop — we need to fully cover the underlying screen
 *   during the iOS nav reset, not just dim it.
 * - withTiming fades (matches the user's preference against springs for
 *   simple state changes).
 * - Respects prefers-reduced-motion.
 * - Explicit progress copy instead of generic "Loading…".
 */

import { useEffect } from 'react';
import { Platform, StyleSheet, View, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
  Easing,
} from 'react-native-reanimated';
import { useAppTheme } from '@/theme/ThemeProvider';
import { cardBorderRadius } from '@/theme';
import { Title3, Body } from './texts';

// Re-declared locally to avoid a context ↔ component import cycle.
// Keep in sync with contexts/TxFlowContext.tsx.
export type TxFlowStep = 'wallet' | 'confirming' | 'saving';

interface TxFlowOverlayProps {
  visible: boolean;
  title?: string;
  step: TxFlowStep;
}

const ENTER_DURATION = 180;
const EXIT_DURATION = 140;

export const TxFlowOverlay = ({ visible, title, step }: TxFlowOverlayProps) => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const reduceMotion = useReducedMotion();

  // Two-phase mount: render while mounted=true so exit animation can play.
  const opacity = useSharedValue(0);
  const mounted = useSharedValue(false);

  useEffect(() => {
    if (visible) {
      mounted.value = true;
      if (reduceMotion) {
        opacity.value = 1;
      } else {
        opacity.value = withTiming(1, {
          duration: ENTER_DURATION,
          easing: Easing.out(Easing.cubic),
        });
      }
    } else {
      if (reduceMotion) {
        opacity.value = 0;
        mounted.value = false;
      } else {
        opacity.value = withTiming(
          0,
          { duration: EXIT_DURATION, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) {
              mounted.value = false;
            }
          },
        );
      }
    }
  }, [visible, reduceMotion, opacity, mounted]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    // Keep the overlay rendered during exit animation, then drop it from
    // the tree so it doesn't swallow touches.
    display: mounted.value ? 'flex' : 'none',
  }));

  const stepLabel = getStepLabel(step, t);

  return (
    <Animated.View
      style={[
        styles.root,
        { backgroundColor: theme.colors.background },
        containerStyle,
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.cardBackground,
            borderColor: theme.colors.border,
            shadowColor: theme.colors.shadowColor,
          },
        ]}
      >
        {title ? (
          <Title3 style={styles.title} numberOfLines={2}>
            {title}
          </Title3>
        ) : null}
        <ActivityIndicator size='large' color={theme.colors.primary} />
        <Body style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>
          {stepLabel}
        </Body>
      </View>
    </Animated.View>
  );
};

const getStepLabel = (step: TxFlowStep, t: (k: string) => string): string => {
  switch (step) {
    case 'wallet':
      return Platform.OS === 'ios'
        ? t('Opening Phantom…')
        : t('Waiting for wallet approval…');
    case 'confirming':
      return t('Confirming on Solana…');
    case 'saving':
      return t('Saving…');
  }
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    // Sits above Stack navigator + any sheet/toast portals except Alert
    // (Alert uses RN Modal which is above everything; that's fine — alerts
    // close before the flow begins).
    zIndex: 10000,
    elevation: 24,
  },
  card: {
    ...cardBorderRadius,
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 16,
    minWidth: 240,
    maxWidth: 320,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  title: {
    textAlign: 'center',
  },
});
