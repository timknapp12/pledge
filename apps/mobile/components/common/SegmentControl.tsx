import { useState, useCallback, useEffect, useRef } from 'react';
import { Pressable, View, StyleSheet, LayoutChangeEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { useAppTheme } from '@/theme/ThemeProvider';
import { BodySmall } from './texts';

export interface Segment {
  key: string;
  label: string;
}

interface SegmentControlProps {
  segments: Segment[];
  selectedKey: string;
  onSelect: (key: string) => void;
}

const SLIDE_TIMING = { duration: 200, easing: Easing.out(Easing.cubic) };
const TEXT_FADE_MS = 150;

export const SegmentControl = ({
  segments,
  selectedKey,
  onSelect,
}: SegmentControlProps) => {
  const { theme } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const selectedIndex = segments.findIndex((s) => s.key === selectedKey);

  const [containerWidth, setContainerWidth] = useState(0);
  const indicatorX = useSharedValue(0);

  const segmentWidth = containerWidth > 0 ? (containerWidth - 8) / segments.length : 0;

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const width = e.nativeEvent.layout.width;
      setContainerWidth(width);
      const sw = (width - 8) / segments.length;
      // Set initial position without animation
      indicatorX.value = selectedIndex * sw;
    },
    [segments.length, selectedIndex, indicatorX],
  );

  const handleSelect = (key: string, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (reduceMotion) {
      indicatorX.value = index * segmentWidth;
    } else {
      indicatorX.value = withTiming(index * segmentWidth, SLIDE_TIMING);
    }
    onSelect(key);
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: segmentWidth,
  }));

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.cardBackground },
      ]}
      onLayout={handleLayout}
    >
      {/* Animated indicator */}
      <Animated.View
        style={[
          styles.indicator,
          { backgroundColor: theme.colors.primary },
          indicatorStyle,
        ]}
      />

      {/* Segment buttons */}
      {segments.map((segment, index) => {
        const isSelected = segment.key === selectedKey;
        return (
          <Pressable
            key={segment.key}
            style={styles.segment}
            onPress={() => handleSelect(segment.key, index)}
          >
            <AnimatedSegmentText
              isSelected={isSelected}
              selectedColor={theme.colors.iconOnPrimary}
              unselectedColor={theme.colors.textSecondary}
              reduceMotion={reduceMotion}
            >
              {segment.label}
            </AnimatedSegmentText>
          </Pressable>
        );
      })}
    </View>
  );
};

const AnimatedSegmentText = ({
  isSelected,
  selectedColor,
  unselectedColor,
  reduceMotion,
  children,
}: {
  isSelected: boolean;
  selectedColor: string;
  unselectedColor: string;
  reduceMotion: boolean;
  children: string;
}) => {
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  // Cross-fade on selection change: brief dip then restore
  const prevSelected = useRef(isSelected);
  useEffect(() => {
    if (prevSelected.current !== isSelected) {
      prevSelected.current = isSelected;
      if (!reduceMotion) {
        opacity.value = 0.5;
        opacity.value = withTiming(1, { duration: TEXT_FADE_MS });
      }
    }
  }, [isSelected, reduceMotion, opacity]);

  return (
    <Animated.View style={animatedStyle}>
      <BodySmall
        style={{
          color: isSelected ? selectedColor : unselectedColor,
          fontWeight: '600',
        }}
      >
        {children}
      </BodySmall>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomRightRadius: 20,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 4,
    padding: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderBottomRightRadius: 16,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
