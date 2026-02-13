import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { useAppTheme } from '@/theme/ThemeProvider';

type ProgressBarProps = {
  progress: number;
  height?: number;
  color?: string;
  trackColor?: string;
  style?: ViewStyle;
  /** Change this value to replay the animation from 0 */
  animateKey?: number;
};

export const ProgressBar = ({
  progress,
  height = 6,
  color,
  trackColor,
  style,
  animateKey,
}: ProgressBarProps) => {
  const { theme } = useAppTheme();
  const animValue = useRef(new Animated.Value(0)).current;
  const borderRadius = height / 2;

  useEffect(() => {
    animValue.setValue(0);
    Animated.timing(animValue, {
      toValue: Math.min(Math.max(progress, 0), 100),
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [progress, animValue, animateKey]);

  const widthInterpolated = animValue.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={[
        styles.track,
        {
          height,
          borderRadius,
          backgroundColor: trackColor || theme.colors.border,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            width: widthInterpolated,
            borderRadius,
            backgroundColor: color || theme.colors.primary,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
