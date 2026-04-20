/**
 * Lightweight auto-dismissing toast for transient feedback.
 *
 * Design decisions (per Emil's design engineering principles):
 * - No layout shift: absolutely positioned, doesn't push content
 * - Auto-dismiss after 3s (no user action needed for non-critical feedback)
 * - Slides up with ease-out entrance, fades out on exit
 * - Colocated feedback: appears near the bottom of the screen
 * - Respects prefers-reduced-motion
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  type SharedValue,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/theme/ThemeProvider';

// ─── Types ──────────────────────────────────────────────────────────

type ToastVariant = 'error' | 'success' | 'info';

interface ToastConfig {
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toast: (config: ToastConfig) => void;
}

// ─── Context ────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
};

// ─── Constants ──────────────────────────────────────────────────────

const ENTER_DURATION = 200;
const EXIT_DURATION = 150;
const DEFAULT_DISPLAY_MS = 3000;
const TRANSLATE_Y = 20;

// ─── Provider ───────────────────────────────────────────────────────

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<ToastConfig | null>(null);
  const [visible, setVisible] = useState(false);
  const reduceMotion = useReducedMotion();

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(TRANSLATE_Y);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (reduceMotion) {
      opacity.value = 0;
      translateY.value = TRANSLATE_Y;
      setVisible(false);
      setConfig(null);
      return;
    }
    opacity.value = withTiming(0, { duration: EXIT_DURATION }, () => {
      runOnJS(setVisible)(false);
      runOnJS(setConfig)(null);
    });
    translateY.value = withTiming(TRANSLATE_Y, { duration: EXIT_DURATION });
  }, [opacity, translateY, reduceMotion]);

  const toast = useCallback(
    (cfg: ToastConfig) => {
      // Clear any existing timer
      if (dismissTimer.current) clearTimeout(dismissTimer.current);

      // Reset values
      opacity.value = 0;
      translateY.value = TRANSLATE_Y;

      setConfig(cfg);
      setVisible(true);

      // Animate in
      requestAnimationFrame(() => {
        if (reduceMotion) {
          opacity.value = 1;
          translateY.value = 0;
        } else {
          opacity.value = withTiming(1, { duration: ENTER_DURATION });
          translateY.value = withTiming(0, { duration: ENTER_DURATION });
        }
      });

      // Auto-dismiss
      dismissTimer.current = setTimeout(hide, cfg.duration ?? DEFAULT_DISPLAY_MS);
    },
    [opacity, translateY, hide, reduceMotion],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {visible && config && (
        <ToastView
          config={config}
          opacity={opacity}
          translateY={translateY}
        />
      )}
    </ToastContext.Provider>
  );
};

// ─── Toast View ─────────────────────────────────────────────────────

interface ToastViewProps {
  config: ToastConfig;
  opacity: SharedValue<number>;
  translateY: SharedValue<number>;
}

const ICON_MAP: Record<ToastVariant, keyof typeof Ionicons.glyphMap> = {
  error: 'alert-circle',
  success: 'checkmark-circle',
  info: 'information-circle',
};

const ToastView = ({ config, opacity, translateY }: ToastViewProps) => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const variant = config.variant ?? 'error';

  const colorMap: Record<ToastVariant, string> = {
    error: theme.colors.error,
    success: theme.colors.statusCompleted,
    info: theme.colors.primary,
  };

  const bgColorMap: Record<ToastVariant, string> = {
    error: `${theme.colors.error}18`,
    success: `${theme.colors.statusCompleted}18`,
    info: `${theme.colors.primary}18`,
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View
      style={[styles.wrapper, { bottom: insets.bottom + 80 }]}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: bgColorMap[variant],
            borderColor: colorMap[variant],
          },
          animatedStyle,
        ]}
      >
        <Ionicons
          name={ICON_MAP[variant]}
          size={18}
          color={colorMap[variant]}
        />
        <Animated.Text
          style={[styles.text, { color: theme.colors.text }]}
          numberOfLines={2}
        >
          {config.message}
        </Animated.Text>
      </Animated.View>
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
    zIndex: 9000,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
});
