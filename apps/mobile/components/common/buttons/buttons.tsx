import { useRef, useCallback } from 'react';
import { Pressable, Animated, PressableProps, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import styled from 'styled-components/native';

interface AnimatedPressableProps extends PressableProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

function AnimatedPressable({ children, onPressIn, onPressOut, onPress, style, ...props }: AnimatedPressableProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback((e: any) => {
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
  }, [scaleAnim, opacityAnim, onPressIn]);

  const handlePressOut = useCallback((e: any) => {
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
  }, [scaleAnim, opacityAnim, onPressOut]);

  const handlePress = useCallback((e: any) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics not available (e.g., Expo Go)
    }
    onPress?.(e);
  }, [onPress]);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      {...props}
    >
      <Animated.View
        style={[
          style,
          {
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

// Styled base containers for button variants
const PrimaryButtonContainer = styled.View`
  background-color: ${(props) => props.theme.colors.primary};
  padding: 16px 32px;
  border-radius: 12px;
  min-width: 200px;
  align-items: center;
`;

const SecondaryButtonContainer = styled.View`
  background-color: transparent;
  border-width: 1px;
  border-color: ${(props) => props.theme.colors.primary};
  padding: 12px 24px;
  border-radius: 8px;
  align-items: center;
`;

const OutlineButtonContainer = styled.View`
  background-color: transparent;
  border-width: 1px;
  border-color: ${(props) => props.theme.colors.error};
  padding: 12px 24px;
  border-radius: 8px;
  align-items: center;
`;

// Button components
export function PrimaryButton({ children, style, ...props }: AnimatedPressableProps) {
  return (
    <AnimatedPressable {...props}>
      <PrimaryButtonContainer style={style}>{children}</PrimaryButtonContainer>
    </AnimatedPressable>
  );
}

export function SecondaryButton({ children, style, ...props }: AnimatedPressableProps) {
  return (
    <AnimatedPressable {...props}>
      <SecondaryButtonContainer style={style}>{children}</SecondaryButtonContainer>
    </AnimatedPressable>
  );
}

export function OutlineButton({ children, style, ...props }: AnimatedPressableProps) {
  return (
    <AnimatedPressable {...props}>
      <OutlineButtonContainer style={style}>{children}</OutlineButtonContainer>
    </AnimatedPressable>
  );
}

// Text components for buttons
export const ButtonText = styled.Text`
  color: #fff;
  font-size: 18px;
  font-weight: 600;
`;

export const SecondaryButtonText = styled.Text`
  color: ${(props) => props.theme.colors.primary};
  font-size: 16px;
  font-weight: 600;
`;

export const OutlineButtonText = styled.Text`
  color: ${(props) => props.theme.colors.error};
  font-size: 16px;
`;
