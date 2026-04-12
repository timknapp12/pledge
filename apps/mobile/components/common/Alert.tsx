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
  useReducedMotion,
} from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';
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

// ─── Animation constants ────────────────────────────────────────────

const ENTRANCE_SPRING = { damping: 25, stiffness: 400 };
const ENTRANCE_DURATION = 200;
const EXIT_DURATION = 150;
const INITIAL_SCALE = 0.95;
const INITIAL_TRANSLATE_Y = 10;

// ─── Provider ───────────────────────────────────────────────────────

export const AlertProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [visible, setVisible] = useState(false);
  const reduceMotion = useReducedMotion();

  const backdrop = useSharedValue(0);
  const scale = useSharedValue(INITIAL_SCALE);
  const translateY = useSharedValue(INITIAL_TRANSLATE_Y);
  const contentOpacity = useSharedValue(0);

  const isAnimating = useRef(false);

  const animateIn = useCallback(() => {
    if (reduceMotion) {
      backdrop.value = 1;
      scale.value = 1;
      translateY.value = 0;
      contentOpacity.value = 1;
      return;
    }
    backdrop.value = withTiming(1, { duration: ENTRANCE_DURATION });
    scale.value = withSpring(1, ENTRANCE_SPRING);
    translateY.value = withSpring(0, ENTRANCE_SPRING);
    contentOpacity.value = withTiming(1, { duration: ENTRANCE_DURATION });
  }, [backdrop, scale, translateY, contentOpacity, reduceMotion]);

  const animateOut = useCallback(
    (onDone: () => void) => {
      if (isAnimating.current) return;
      isAnimating.current = true;

      if (reduceMotion) {
        backdrop.value = 0;
        scale.value = INITIAL_SCALE;
        translateY.value = INITIAL_TRANSLATE_Y;
        contentOpacity.value = 0;
        onDone();
        return;
      }

      backdrop.value = withTiming(0, { duration: EXIT_DURATION });
      scale.value = withTiming(INITIAL_SCALE, { duration: EXIT_DURATION });
      translateY.value = withTiming(INITIAL_TRANSLATE_Y, { duration: EXIT_DURATION });
      contentOpacity.value = withTiming(0, { duration: EXIT_DURATION }, () => {
        runOnJS(onDone)();
      });
    },
    [backdrop, scale, translateY, contentOpacity, reduceMotion],
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

      // Reset shared values synchronously before mounting
      scale.value = INITIAL_SCALE;
      translateY.value = INITIAL_TRANSLATE_Y;
      contentOpacity.value = 0;
      backdrop.value = 0;

      setConfig({ ...cfg, buttons });
      setVisible(true);

      // Kick off entrance animation after the modal mounts
      requestAnimationFrame(() => {
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
          reduceMotion={reduceMotion}
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
  reduceMotion: boolean;
}

const BUTTON_PRESS_SPRING = { damping: 25, stiffness: 400 };

const AlertButtonItem = ({
  button,
  onPress,
  bgColor,
  textColor,
  hasBorder,
  borderColor,
  flex,
  reduceMotion,
}: {
  button: AlertButton;
  onPress: () => void;
  bgColor: string;
  textColor: string;
  hasBorder: boolean;
  borderColor?: string;
  flex: boolean;
  reduceMotion: boolean;
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = useCallback(() => {
    if (reduceMotion) {
      opacity.value = 0.7;
    } else {
      scale.value = withSpring(0.97, BUTTON_PRESS_SPRING);
      opacity.value = withTiming(0.7, { duration: 100 });
    }
  }, [scale, opacity, reduceMotion]);

  const handlePressOut = useCallback(() => {
    if (reduceMotion) {
      opacity.value = 1;
    } else {
      scale.value = withSpring(1, BUTTON_PRESS_SPRING);
      opacity.value = withTiming(1, { duration: 100 });
    }
  }, [scale, opacity, reduceMotion]);

  return (
    <Animated.View style={[flex && { flex: 1 }, animatedStyle]}>
      <Pressable
        style={[
          styles.button,
          { backgroundColor: bgColor },
          hasBorder && { borderWidth: 1, borderColor },
        ]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
      >
        <Text
          style={[
            styles.buttonText,
            { color: textColor },
            button.style === 'destructive' && { fontWeight: '700' },
          ]}
        >
          {button.text}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

const AlertModal = ({
  config,
  dismiss,
  backdrop,
  scale,
  translateY,
  contentOpacity,
  reduceMotion,
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

  const handlePress = (button: { text: string; style?: ButtonStyle; onPress?: () => void }) => {
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
              <AlertButtonItem
                key={i}
                button={btn}
                onPress={() => handlePress(btn)}
                bgColor={getButtonBg(btn.style)}
                textColor={getButtonColor(btn.style)}
                hasBorder={btn.style === 'cancel'}
                borderColor={theme.colors.border}
                flex={buttons.length > 1}
                reduceMotion={reduceMotion}
              />
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
