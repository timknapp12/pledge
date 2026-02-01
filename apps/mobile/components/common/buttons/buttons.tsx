import { useRef, useCallback } from 'react';
import {
  Pressable,
  Animated,
  PressableProps,
  ViewStyle,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import styled, { css } from 'styled-components/native';
import { useTheme } from 'styled-components/native';
import { Ionicons } from '@expo/vector-icons';

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

const sharedCss = css`
  border-bottom-right-radius: 30px;
  border-top-left-radius: 4px;
  border-top-right-radius: 30px;
  border-bottom-left-radius: 4px;
  align-items: center;
  width: 100%;
`;

// Styled base containers for button variants
const PrimaryButtonContainer = styled.View`
  ${sharedCss}
  background-color: ${(props) => props.theme.colors.buttonPrimaryBg};
  padding: 12px 24px;
`;

const SecondaryButtonContainer = styled.View`
  ${sharedCss}
  background-color: transparent;
  border-width: 1px;
  border-color: ${(props) => props.theme.colors.buttonSecondaryBorder};
  padding: 12px 24px;
`;

const OutlineButtonContainer = styled.View`
  ${sharedCss}
  background-color: transparent;
  border-width: 1px;
  border-color: ${(props) => props.theme.colors.error};
  padding: 12px 24px;
`;

// Content wrapper for icon + text
const ButtonContent = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;

// Text components (internal)
const PrimaryButtonText = styled.Text`
  color: ${(props) => props.theme.colors.buttonPrimaryText};
  font-size: 18px;
  font-weight: 600;
`;

const SecondaryButtonText = styled.Text`
  color: ${(props) => props.theme.colors.buttonSecondaryText};
  font-size: 16px;
  font-weight: 600;
`;

const OutlineButtonText = styled.Text`
  color: ${(props) => props.theme.colors.error};
  font-size: 16px;
`;

// Button components
export function PrimaryButton({
  children,
  style,
  loading = false,
  icon,
  ...props
}: ButtonProps) {
  const theme = useTheme();
  return (
    <AnimatedPressable loading={loading} {...props}>
      <PrimaryButtonContainer style={style}>
        {loading ? (
          <ActivityIndicator size="small" color={theme.colors.buttonPrimaryText} />
        ) : (
          <ButtonContent>
            {icon && <Ionicons name={icon} size={20} color={theme.colors.buttonPrimaryText} />}
            <PrimaryButtonText>{children}</PrimaryButtonText>
          </ButtonContent>
        )}
      </PrimaryButtonContainer>
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
  const theme = useTheme();
  return (
    <AnimatedPressable loading={loading} {...props}>
      <SecondaryButtonContainer style={style}>
        {loading ? (
          <ActivityIndicator size="small" color={theme.colors.buttonSecondaryText} />
        ) : (
          <ButtonContent>
            {icon && <Ionicons name={icon} size={18} color={theme.colors.buttonSecondaryText} />}
            <SecondaryButtonText>{children}</SecondaryButtonText>
          </ButtonContent>
        )}
      </SecondaryButtonContainer>
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
  const theme = useTheme();
  return (
    <AnimatedPressable loading={loading} {...props}>
      <OutlineButtonContainer style={style}>
        {loading ? (
          <ActivityIndicator size="small" color={theme.colors.error} />
        ) : (
          <ButtonContent>
            {icon && <Ionicons name={icon} size={18} color={theme.colors.error} />}
            <OutlineButtonText>{children}</OutlineButtonText>
          </ButtonContent>
        )}
      </OutlineButtonContainer>
    </AnimatedPressable>
  );
}
