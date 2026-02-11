import { useRef, useCallback } from 'react';
import {
  Pressable,
  Animated,
  PressableProps,
  ViewStyle,
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
} from 'react-native';
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
}

interface ButtonProps extends AnimatedPressableProps {
  icon?: IoniconsName;
}

function AnimatedPressable({
  children,
  onPressIn,
  onPressOut,
  onPress,
  style,
  disabled = false,
  loading = false,
  ...props
}: AnimatedPressableProps) {
  const isDisabled = disabled || loading;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(
    (e: any) => {
      if (isDisabled) return;
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0.97,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
      onPressIn?.(e);
    },
    [scaleAnim, opacityAnim, onPressIn, isDisabled],
  );

  const handlePressOut = useCallback(
    (e: any) => {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
      onPressOut?.(e);
    },
    [scaleAnim, opacityAnim, onPressOut],
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

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={isDisabled}
      style={{ width: '100%' }}
      {...props}
    >
      <Animated.View
        style={[
          style,
          {
            width: '100%',
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
          isDisabled && { opacity: 0.5 },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

export function PrimaryButton({
  children,
  style,
  loading = false,
  icon,
  ...props
}: ButtonProps) {
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

export function SecondaryButton({
  children,
  style,
  loading = false,
  icon,
  ...props
}: ButtonProps) {
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

export function OutlineButton({
  children,
  style,
  loading = false,
  icon,
  ...props
}: ButtonProps) {
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
});
