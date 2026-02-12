import { useRef, useState, useCallback, useEffect } from 'react';
import {
  TextInput,
  Animated,
  TextInputProps,
  ViewStyle,
  TextStyle,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useAppTheme } from '@/theme/ThemeProvider';
import { cardBorderRadius } from '@/theme';

interface FloatingLabelInputProps extends Omit<TextInputProps, 'placeholder'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  containerStyle?: ViewStyle;
}

const AnimatedText = Animated.createAnimatedComponent(Text);

export const FloatingLabelInput = ({
  label,
  value,
  onChangeText,
  error,
  containerStyle,
  onFocus,
  onBlur,
  ...props
}: FloatingLabelInputProps) => {
  const { theme } = useAppTheme();
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
    <View style={[styles.container, containerStyle]}>
      <View style={[styles.inputContainer, { borderColor }]}>
        <AnimatedText
          style={[
            styles.label,
            {
              transform: [{ translateY: labelTranslateY }, { scale: labelScale }],
              color: labelColor,
            },
          ]}
        >
          {label}
        </AnimatedText>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={theme.colors.textSecondary}
          selectionColor={theme.colors.primary}
          {...props}
          style={[styles.styledInput, { color: theme.colors.text }, props.style as TextStyle]}
        />
      </View>
      {error && (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {error}
        </Text>
      )}
    </View>
  );
}

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

export const TextArea = ({
  label,
  value,
  onChangeText,
  error,
  containerStyle,
  minHeight = 120,
  onFocus,
  onBlur,
  ...props
}: TextAreaProps) => {
  const { theme } = useAppTheme();
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
    <View style={[styles.container, containerStyle]}>
      <View
        style={[
          styles.textAreaContainer,
          {
            borderColor,
            minHeight,
            backgroundColor: theme.colors.cardBackground,
          },
        ]}
      >
        <AnimatedText
          style={[
            styles.textAreaLabel,
            {
              transform: [{ translateY: labelTranslateY }, { scale: labelScale }],
              color: labelColor,
            },
          ]}
        >
          {label}
        </AnimatedText>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          multiline
          textAlignVertical='top'
          selectionColor={theme.colors.primary}
          {...props}
          style={[styles.styledTextArea, { color: theme.colors.text }, props.style as TextStyle]}
        />
      </View>
      {error && (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputContainer: {
    borderBottomWidth: 2,
    padding: 8,
    paddingTop: 24,
    paddingBottom: 4,
  },
  label: {
    position: 'absolute',
    left: 0,
    top: 20,
    fontSize: 16,
  },
  styledInput: {
    fontSize: 16,
    padding: 0,
    margin: 0,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 16,
  },
  textAreaContainer: {
    borderWidth: 1.5,
    ...cardBorderRadius,
    padding: 16,
    paddingTop: 28,
  },
  textAreaLabel: {
    position: 'absolute',
    left: 16,
    top: 20,
    fontSize: 16,
  },
  styledTextArea: {
    fontSize: 16,
    padding: 0,
    margin: 0,
    flex: 1,
  },
});
