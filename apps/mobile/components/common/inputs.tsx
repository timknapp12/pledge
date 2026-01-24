import { useRef, useState, useCallback, useEffect } from 'react';
import {
  TextInput,
  Animated,
  TextInputProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import styled, { useTheme } from 'styled-components/native';

interface FloatingLabelInputProps extends Omit<TextInputProps, 'placeholder'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  containerStyle?: ViewStyle;
}

export function FloatingLabelInput({
  label,
  value,
  onChangeText,
  error,
  containerStyle,
  onFocus,
  onBlur,
  ...props
}: FloatingLabelInputProps) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  // Animation value for label position (native driver compatible)
  const labelAnim = useRef(new Animated.Value(value ? 1 : 0)).current;

  const isActive = isFocused || value.length > 0;

  useEffect(() => {
    Animated.spring(labelAnim, {
      toValue: isActive ? 1 : 0,
      useNativeDriver: true,
      damping: 15,
      stiffness: 150,
    }).start();
  }, [isActive, labelAnim]);

  const handleFocus = useCallback(
    (e: any) => {
      setIsFocused(true);
      onFocus?.(e);
    },
    [onFocus],
  );

  const handleBlur = useCallback(
    (e: any) => {
      setIsFocused(false);
      onBlur?.(e);
    },
    [onBlur],
  );

  // Interpolations for label transform
  const labelTranslateY = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -28],
  });

  const labelScale = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.85],
  });

  // Colors based on state (not animated to avoid native driver conflicts)
  const labelColor = error
    ? theme.colors.error
    : isFocused
    ? theme.colors.primary
    : theme.colors.textSecondary;

  const borderColor = error
    ? theme.colors.error
    : isFocused
    ? theme.colors.primary
    : theme.colors.border;

  return (
    <Container style={containerStyle}>
      <InputContainer style={{ borderColor }}>
        <AnimatedLabel
          style={{
            transform: [{ translateY: labelTranslateY }, { scale: labelScale }],
            color: labelColor,
          }}
        >
          {label}
        </AnimatedLabel>
        <StyledInput
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={theme.colors.textSecondary}
          selectionColor={theme.colors.primary}
          {...props}
          style={[{ color: theme.colors.text }, props.style as TextStyle]}
        />
      </InputContainer>
      {error && <ErrorText>{error}</ErrorText>}
    </Container>
  );
}

const Container = styled.View`
  width: 100%;
`;

const InputContainer = styled.View`
  border-bottom-width: 2px;
  padding: 8px;
  padding-top: 24px;
  padding-bottom: 4px;
`;

const Label = styled.Text`
  position: absolute;
  left: 0px;
  top: 20px;
  font-size: 16px;
`;

const AnimatedLabel = Animated.createAnimatedComponent(Label);

const StyledInput = styled(TextInput)`
  font-size: 16px;
  padding: 0;
  margin: 0;
`;

const ErrorText = styled.Text`
  color: ${(props) => props.theme.colors.error};
  font-size: 12px;
  margin-top: 4px;
  margin-left: 16px;
`;

// TextArea Component
interface TextAreaProps
  extends Omit<TextInputProps, 'placeholder' | 'multiline'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  containerStyle?: ViewStyle;
  minHeight?: number;
}

export function TextArea({
  label,
  value,
  onChangeText,
  error,
  containerStyle,
  minHeight = 120,
  onFocus,
  onBlur,
  ...props
}: TextAreaProps) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  // Animation value for label position (native driver compatible)
  const labelAnim = useRef(new Animated.Value(value ? 1 : 0)).current;

  const isActive = isFocused || value.length > 0;

  useEffect(() => {
    Animated.spring(labelAnim, {
      toValue: isActive ? 1 : 0,
      useNativeDriver: true,
      damping: 15,
      stiffness: 150,
    }).start();
  }, [isActive, labelAnim]);

  const handleFocus = useCallback(
    (e: any) => {
      setIsFocused(true);
      onFocus?.(e);
    },
    [onFocus],
  );

  const handleBlur = useCallback(
    (e: any) => {
      setIsFocused(false);
      onBlur?.(e);
    },
    [onBlur],
  );

  // Interpolations for label transform
  const labelTranslateY = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  const labelScale = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.85],
  });

  // Colors based on state
  const labelColor = error
    ? theme.colors.error
    : isFocused
    ? theme.colors.primary
    : theme.colors.textSecondary;

  const borderColor = error
    ? theme.colors.error
    : isFocused
    ? theme.colors.primary
    : theme.colors.border;

  return (
    <Container style={containerStyle}>
      <TextAreaContainer style={{ borderColor, minHeight }}>
        <TextAreaLabel
          style={{
            transform: [{ translateY: labelTranslateY }, { scale: labelScale }],
            color: labelColor,
          }}
        >
          {label}
        </TextAreaLabel>
        <StyledTextArea
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          multiline
          textAlignVertical='top'
          selectionColor={theme.colors.primary}
          {...props}
          style={[{ color: theme.colors.text }, props.style as TextStyle]}
        />
      </TextAreaContainer>
      {error && <TextAreaErrorText>{error}</TextAreaErrorText>}
    </Container>
  );
}

const TextAreaContainer = styled.View`
  border-width: 1.5px;
  border-bottom-right-radius: 30px;
  border-top-left-radius: 4px;
  border-top-right-radius: 30px;
  border-bottom-left-radius: 4px;
  padding: 16px;
  padding-top: 28px;
  background-color: ${(props) => props.theme.colors.cardBackground};
`;

const TextAreaLabelBase = styled.Text`
  position: absolute;
  left: 16px;
  top: 20px;
  font-size: 16px;
`;

const TextAreaLabel = Animated.createAnimatedComponent(TextAreaLabelBase);

const StyledTextArea = styled(TextInput)`
  font-size: 16px;
  padding: 0;
  margin: 0;
  flex: 1;
`;

const TextAreaErrorText = styled.Text`
  color: ${(props) => props.theme.colors.error};
  font-size: 12px;
  margin-top: 4px;
  margin-left: 16px;
`;
