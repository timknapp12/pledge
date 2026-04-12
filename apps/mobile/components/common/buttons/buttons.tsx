import { useCallback } from 'react';
import {
  Pressable,
  PressableProps,
  ViewStyle,
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/theme/ThemeProvider';
import { cardBorderRadius } from '@/theme';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface AnimatedPressableProps extends PressableProps {
  children: React.ReactNode;
  style?: ViewStyle;
  disabled?: boolean;
  loading?: boolean;
  /** When false, Pressable does not take full width (e.g. for round icon buttons). Default true. */
  fullWidth?: boolean;
}

interface ButtonProps extends AnimatedPressableProps {
  icon?: IoniconsName;
}

export type RoundButtonVariant = 'primary' | 'secondary' | 'outline';

interface RoundButtonProps extends Omit<AnimatedPressableProps, 'children'> {
  icon: IoniconsName;
  variant?: RoundButtonVariant;
  size?: number;
}

const PRESS_SPRING = { damping: 25, stiffness: 400 };

const AnimatedPressable = ({
  children,
  onPressIn,
  onPressOut,
  onPress,
  style,
  disabled = false,
  loading = false,
  fullWidth = true,
  ...props
}: AnimatedPressableProps) => {
  const isDisabled = disabled || loading;
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const handlePressIn = useCallback(
    (e: any) => {
      if (isDisabled) return;
      if (reduceMotion) {
        opacity.value = 0.8;
      } else {
        scale.value = withSpring(0.97, PRESS_SPRING);
        opacity.value = withTiming(0.8, { duration: 100 });
      }
      onPressIn?.(e);
    },
    [scale, opacity, onPressIn, isDisabled, reduceMotion],
  );

  const handlePressOut = useCallback(
    (e: any) => {
      if (reduceMotion) {
        opacity.value = 1;
      } else {
        scale.value = withSpring(1, PRESS_SPRING);
        opacity.value = withTiming(1, { duration: 100 });
      }
      onPressOut?.(e);
    },
    [scale, opacity, onPressOut, reduceMotion],
  );

  const handlePress = useCallback(
    (e: any) => {
      if (isDisabled) return;
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // Haptics not available (e.g., Expo Go)
      }
      onPress?.(e);
    },
    [onPress, isDisabled],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={isDisabled}
      style={fullWidth ? { width: '100%' } : undefined}
      {...props}
    >
      <ReanimatedAnimated.View
        style={[
          fullWidth && { width: '100%' },
          style,
          animatedStyle,
          isDisabled && { opacity: 0.5 },
        ]}
      >
        {children}
      </ReanimatedAnimated.View>
    </Pressable>
  );
}

export const PrimaryButton = ({
  children,
  style,
  loading = false,
  icon,
  ...props
}: ButtonProps) => {
  const { theme } = useAppTheme();
  return (
    <AnimatedPressable loading={loading} {...props}>
      <View
        style={[
          styles.buttonBase,
          { backgroundColor: theme.colors.buttonPrimaryBg, paddingVertical: 12, paddingHorizontal: 24 },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            size='small'
            color={theme.colors.buttonPrimaryText}
          />
        ) : (
          <View style={styles.buttonContent}>
            {icon && (
              <Ionicons
                name={icon}
                size={20}
                color={theme.colors.buttonPrimaryText}
              />
            )}
            <Text style={[styles.buttonText, { color: theme.colors.buttonPrimaryText }]}>
              {children}
            </Text>
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
}

export const SecondaryButton = ({
  children,
  style,
  loading = false,
  icon,
  ...props
}: ButtonProps) => {
  const { theme } = useAppTheme();
  return (
    <AnimatedPressable loading={loading} {...props}>
      <View
        style={[
          styles.buttonBase,
          {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: theme.colors.buttonSecondaryBorder,
            paddingVertical: 12,
            paddingHorizontal: 24,
          },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            size='small'
            color={theme.colors.buttonSecondaryText}
          />
        ) : (
          <View style={styles.buttonContent}>
            {icon && (
              <Ionicons
                name={icon}
                size={18}
                color={theme.colors.buttonSecondaryText}
              />
            )}
            <Text style={[styles.buttonText, { color: theme.colors.buttonSecondaryText }]}>
              {children}
            </Text>
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
}

export const OutlineButton = ({
  children,
  style,
  loading = false,
  icon,
  ...props
}: ButtonProps) => {
  const { theme } = useAppTheme();
  return (
    <AnimatedPressable loading={loading} {...props}>
      <View
        style={[
          styles.buttonBase,
          {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: theme.colors.error,
            paddingVertical: 12,
            paddingHorizontal: 24,
          },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator size='small' color={theme.colors.error} />
        ) : (
          <View style={styles.buttonContent}>
            {icon && (
              <Ionicons name={icon} size={18} color={theme.colors.error} />
            )}
            <Text style={[styles.outlineButtonText, { color: theme.colors.error }]}>
              {children}
            </Text>
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
}

const ROUND_BUTTON_SIZE = 44;

export const RoundButton = ({
  icon,
  variant = 'primary',
  size = ROUND_BUTTON_SIZE,
  style,
  loading = false,
  ...props
}: RoundButtonProps) => {
  const { theme } = useAppTheme();
  const iconSize = Math.round(size * 0.5);
  const variantStyles: ViewStyle =
    variant === 'primary'
      ? {
          backgroundColor: theme.colors.buttonPrimaryBg,
        }
      : variant === 'secondary'
        ? {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: theme.colors.buttonSecondaryBorder,
          }
        : {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: theme.colors.error,
          };
  const iconColor =
    variant === 'primary'
      ? theme.colors.buttonPrimaryText
      : variant === 'secondary'
        ? theme.colors.buttonSecondaryText
        : theme.colors.error;
  const roundStyle = StyleSheet.flatten([
    styles.roundButton,
    { width: size, height: size, borderRadius: size / 2 },
    style,
  ]) as ViewStyle;

  return (
    <AnimatedPressable
      loading={loading}
      fullWidth={false}
      style={roundStyle}
      {...props}
    >
      <View style={[styles.roundButtonInner, variantStyles, { width: size, height: size, borderRadius: size / 2 }]}>
        {loading ? (
          <ActivityIndicator size='small' color={iconColor} />
        ) : (
          <Ionicons name={icon} size={iconSize} color={iconColor} />
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  buttonBase: {
    ...cardBorderRadius,
    alignItems: 'center',
    width: '100%',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  outlineButtonText: {
    fontSize: 16,
  },
  roundButton: {
    alignSelf: 'center',
  },
  roundButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
