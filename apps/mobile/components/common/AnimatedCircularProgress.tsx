import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  useAnimatedReaction,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle } from 'react-native-svg';
import { useAppTheme } from '@/theme/ThemeProvider';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type AnimatedCircularProgressProps = {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  textColor?: string;
  trackColor?: string;
  style?: ViewStyle;
  /** Show animated percentage in center */
  showPercentage?: boolean;
  /** Font size for percentage text (default 14) */
  percentageFontSize?: number;
  /** Custom text to display instead of percentage (e.g. streak count) */
  customText?: string;
  /** Change this value to replay the animation from 0 */
  animateKey?: number;
};

const DURATION_MS = 1000;

export const AnimatedCircularProgress = ({
  progress,
  size = 56,
  strokeWidth = 5,
  color,
  textColor,
  trackColor,
  style,
  showPercentage = false,
  percentageFontSize = 16,
  customText,
  animateKey,
}: AnimatedCircularProgressProps) => {
  const { theme } = useAppTheme();
  const [displayPercent, setDisplayPercent] = useState(0);
  const progressValue = useSharedValue(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  useEffect(() => {
    progressValue.value = 0;
    setDisplayPercent(0);
    const targetProgress = Math.min(Math.max(progress, 0), 100);
    progressValue.value = withTiming(targetProgress, {
      duration: DURATION_MS,
    });
  }, [progress, progressValue, animateKey]);

  useAnimatedReaction(
    () => Math.round(progressValue.value),
    (value) => {
      if (showPercentage) {
        scheduleOnRN(setDisplayPercent, value);
      }
    },
    [showPercentage]
  );

  const animatedProps = useAnimatedProps(() => {
    const offset = circumference - (progressValue.value / 100) * circumference;
    return {
      strokeDashoffset: offset,
    };
  });

  const fillColor = color || theme.colors.primary;
  const track = trackColor || theme.colors.border;

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Svg
        width={size}
        height={size}
        style={[styles.svg, { width: size, height: size }]}
      >
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={track}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={fillColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeLinecap="round"
          animatedProps={animatedProps}
        />
      </Svg>
      {(showPercentage || customText !== undefined) && (
        <View style={styles.centerContent}>
          <Text
            style={[
              styles.percentText,
              { color: textColor || fillColor, fontSize: percentageFontSize },
            ]}
          >
            {customText !== undefined ? customText : `${displayPercent}%`}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  svg: {
    position: 'absolute',
    transform: [{ rotate: '-90deg' }],
  },
  centerContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentText: {
    fontWeight: '700',
  },
});
