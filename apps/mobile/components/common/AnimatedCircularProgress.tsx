import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, ViewStyle } from 'react-native';
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
  /** Change this value to replay the animation from 0 */
  animateKey?: number;
};

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
  animateKey,
}: AnimatedCircularProgressProps) => {
  const { theme } = useAppTheme();
  const animValue = useRef(new Animated.Value(0)).current;
  const [displayPercent, setDisplayPercent] = useState(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  useEffect(() => {
    animValue.setValue(0);
    setDisplayPercent(0);
    const listenerId = showPercentage
      ? animValue.addListener(({ value }) => {
          setDisplayPercent(Math.round(value));
        })
      : undefined;
    Animated.timing(animValue, {
      toValue: Math.min(Math.max(progress, 0), 100),
      duration: 600,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (listenerId) {
        animValue.removeListener(listenerId);
        if (finished) setDisplayPercent(Math.round(progress));
      }
    });
    return () => {
      if (listenerId) animValue.removeListener(listenerId);
    };
  }, [progress, animValue, animateKey, showPercentage]);

  const strokeDashoffset = animValue.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
    extrapolate: 'clamp',
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
        {/* Track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={track}
          strokeWidth={strokeWidth}
          fill='none'
        />
        {/* Progress */}
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={fillColor}
          strokeWidth={strokeWidth}
          fill='none'
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap='round'
        />
      </Svg>
      {showPercentage && (
        <View style={styles.centerContent}>
          <Text
            style={[
              styles.percentText,
              { color: textColor || fillColor, fontSize: percentageFontSize },
            ]}
          >
            {displayPercent}%
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
    fontSize: 14,
    fontWeight: '700',
  },
});
