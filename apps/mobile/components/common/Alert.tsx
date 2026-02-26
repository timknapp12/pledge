import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  type SharedValue,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/theme/ThemeProvider';
import { cardBorderRadius } from '@/theme';

// ─── Types ──────────────────────────────────────────────────────────

type ButtonStyle = 'default' | 'cancel' | 'destructive';

interface AlertButton {
  text: string;
  style?: ButtonStyle;
  onPress?: () => void;
}

interface AlertConfig {
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

interface AlertContextValue {
  alert: (config: AlertConfig) => void;
}

// ─── Context ────────────────────────────────────────────────────────

const AlertContext = createContext<AlertContextValue | null>(null);

export const useAlert = (): AlertContextValue => {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert must be used inside AlertProvider');
  return ctx;
};

// ─── Provider ───────────────────────────────────────────────────────

export const AlertProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [visible, setVisible] = useState(false);

  const backdrop = useSharedValue(0);
  const scale = useSharedValue(0.85);
  const translateY = useSharedValue(30);
  const contentOpacity = useSharedValue(0);

  const isAnimating = useRef(false);

  const animateIn = useCallback(() => {
    backdrop.value = withTiming(1, { duration: 200 });
    scale.value = withSpring(1, { damping: 18, stiffness: 300 });
    translateY.value = withSpring(0, { damping: 18, stiffness: 300 });
    contentOpacity.value = withTiming(1, { duration: 200 });
  }, [backdrop, scale, translateY, contentOpacity]);

  const animateOut = useCallback(
    (onDone: () => void) => {
      if (isAnimating.current) return;
      isAnimating.current = true;
      backdrop.value = withTiming(0, { duration: 180 });
      scale.value = withTiming(0.9, { duration: 180 });
      translateY.value = withTiming(20, { duration: 180 });
      contentOpacity.value = withTiming(0, { duration: 150 }, () => {
        runOnJS(onDone)();
      });
    },
    [backdrop, scale, translateY, contentOpacity],
  );

  const dismiss = useCallback(
    (callback?: () => void) => {
      animateOut(() => {
        setVisible(false);
        setConfig(null);
        isAnimating.current = false;
        callback?.();
      });
    },
    [animateOut],
  );

  const alert = useCallback(
    (cfg: AlertConfig) => {
      // Default to a single OK button
      const buttons =
        cfg.buttons && cfg.buttons.length > 0
          ? cfg.buttons
          : [{ text: 'OK', style: 'default' as ButtonStyle }];

      setConfig({ ...cfg, buttons });
      setVisible(true);

      // Kick off entrance animation after the modal mounts
      requestAnimationFrame(() => {
        scale.value = 0.85;
        translateY.value = 30;
        contentOpacity.value = 0;
        backdrop.value = 0;
        animateIn();
      });
    },
    [animateIn, scale, translateY, contentOpacity, backdrop],
  );

  return (
    <AlertContext.Provider value={{ alert }}>
      {children}
      {visible && config && (
        <AlertModal
          config={config}
          dismiss={dismiss}
          backdrop={backdrop}
          scale={scale}
          translateY={translateY}
          contentOpacity={contentOpacity}
        />
      )}
    </AlertContext.Provider>
  );
};

// ─── Modal ──────────────────────────────────────────────────────────

interface AlertModalProps {
  config: AlertConfig;
  dismiss: (callback?: () => void) => void;
  backdrop: SharedValue<number>;
  scale: SharedValue<number>;
  translateY: SharedValue<number>;
  contentOpacity: SharedValue<number>;
}

const AlertModal = ({
  config,
  dismiss,
  backdrop,
  scale,
  translateY,
  contentOpacity,
}: AlertModalProps) => {
  const { theme, isDark } = useAppTheme();
  const { width } = useWindowDimensions();
  const alertWidth = Math.min(width - 48, 340);

  const buttons = config.buttons ?? [{ text: 'OK' }];
  const hasDestructive = buttons.some((b) => b.style === 'destructive');

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value * 0.55,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  const handlePress = (button: AlertButton) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics not available
    }
    dismiss(button.onPress);
  };

  const getButtonColor = (style?: ButtonStyle) => {
    if (style === 'destructive') return theme.colors.error;
    if (style === 'cancel') return theme.colors.textSecondary;
    return theme.colors.primary;
  };

  const getButtonBg = (style?: ButtonStyle) => {
    if (style === 'destructive') return `${theme.colors.statusForfeited}25`;
    if (style === 'cancel') return 'transparent';
    return `${theme.colors.primary}18`;
  };

  return (
    <Modal transparent statusBarTranslucent animationType="none">
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme.colors.shadowColor },
            backdropStyle,
          ]}
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={() => dismiss()} />

        {/* Card */}
        <Animated.View
          style={[
            styles.card,
            cardStyle,
            {
              width: alertWidth,
              backgroundColor: isDark ? '#1C1C1E' : theme.colors.background,
              shadowColor: theme.colors.shadowColor,
            },
          ]}
        >
          {/* Icon */}
          {hasDestructive ? (
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: `${theme.colors.statusForfeited}30` },
              ]}
            >
              <Text style={{ fontSize: 22, color: theme.colors.error, fontWeight: '700' }}>!</Text>
            </View>
          ) : null}

          {/* Title */}
          <Text
            style={[
              styles.title,
              {
                color: hasDestructive ? theme.colors.error : theme.colors.text,
              },
            ]}
          >
            {config.title}
          </Text>

          {/* Message */}
          {config.message ? (
            <Text
              style={[styles.message, { color: theme.colors.textSecondary }]}
            >
              {config.message}
            </Text>
          ) : null}

          {/* Buttons */}
          <View
            style={[
              styles.buttonRow,
              buttons.length === 1 && styles.buttonRowSingle,
            ]}
          >
            {buttons.map((btn, i) => (
              <Pressable
                key={i}
                style={({ pressed }) => [
                  styles.button,
                  buttons.length > 1 && { flex: 1 },
                  {
                    backgroundColor: getButtonBg(btn.style),
                    opacity: pressed ? 0.7 : 1,
                  },
                  btn.style === 'cancel' && {
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={() => handlePress(btn)}
              >
                <Text
                  style={[
                    styles.buttonText,
                    { color: getButtonColor(btn.style) },
                    btn.style === 'destructive' && { fontWeight: '700' },
                  ]}
                >
                  {btn.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    ...cardBorderRadius,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Iceberg',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    width: '100%',
  },
  buttonRowSingle: {
    justifyContent: 'center',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
