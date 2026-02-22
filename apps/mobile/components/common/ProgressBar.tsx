import { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
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

const DURATION_MS = 1000;

export const ProgressBar = ({
  progress,
  height = 6,
  color,
  trackColor,
  style,
  animateKey,
}: ProgressBarProps) => {
  const { theme } = useAppTheme();
  const progressValue = useSharedValue(0);
  const borderRadius = height / 2;

  useEffect(() => {
    progressValue.value = 0;
    progressValue.value = withTiming(
      Math.min(Math.max(progress, 0), 100),
      { duration: DURATION_MS }
    );
  }, [progress, progressValue, animateKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progressValue.value / 100 }],
  }));

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
            width: '100%',
            borderRadius,
            backgroundColor: color || theme.colors.primary,
            transformOrigin: 'left',
          },
          animatedStyle,
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
