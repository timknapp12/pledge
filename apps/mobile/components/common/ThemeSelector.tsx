import { useState, useCallback, useEffect, useRef } from 'react';
import { Pressable, View, StyleSheet, LayoutChangeEvent } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { useAppTheme } from '@/theme/ThemeProvider';
import { useThemeMode, ThemeMode } from '@/theme/ThemeProvider';

const OPTIONS: { mode: ThemeMode; icon: 'sun-o' | 'moon-o' | 'cog' }[] = [
  { mode: 'light', icon: 'sun-o' },
  { mode: 'dark', icon: 'moon-o' },
  { mode: 'system', icon: 'cog' },
];

const SLIDE_TIMING = { duration: 200, easing: Easing.out(Easing.cubic) };
const ICON_FADE_MS = 150;

export const ThemeSelector = () => {
  const { theme } = useAppTheme();
  const { mode, setMode } = useThemeMode();
  const reduceMotion = useReducedMotion();

  const [containerWidth, setContainerWidth] = useState(0);
  const indicatorX = useSharedValue(0);

  const selectedIndex = OPTIONS.findIndex((o) => o.mode === mode);
  const segmentWidth = containerWidth > 0 ? (containerWidth - 8) / OPTIONS.length : 0;

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const width = e.nativeEvent.layout.width;
      setContainerWidth(width);
      const sw = (width - 8) / OPTIONS.length;
      indicatorX.value = selectedIndex * sw;
    },
    [selectedIndex, indicatorX],
  );

  const handleSelect = (newMode: ThemeMode, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (reduceMotion) {
      indicatorX.value = index * segmentWidth;
    } else {
      indicatorX.value = withTiming(index * segmentWidth, SLIDE_TIMING);
    }
    setMode(newMode);
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
      <Animated.View
        style={[
          styles.pill,
          { backgroundColor: theme.colors.primary },
          indicatorStyle,
        ]}
      />
      {OPTIONS.map((option, index) => (
        <Pressable
          key={option.mode}
          style={styles.segment}
          onPress={() => handleSelect(option.mode, index)}
        >
          <AnimatedIcon
            name={option.icon}
            isSelected={mode === option.mode}
            selectedColor={theme.colors.iconOnPrimary}
            unselectedColor={theme.colors.textSecondary}
            reduceMotion={reduceMotion}
          />
        </Pressable>
      ))}
    </View>
  );
};

const AnimatedIcon = ({
  name,
  isSelected,
  selectedColor,
  unselectedColor,
  reduceMotion,
}: {
  name: 'sun-o' | 'moon-o' | 'cog';
  isSelected: boolean;
  selectedColor: string;
  unselectedColor: string;
  reduceMotion: boolean;
}) => {
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const prevSelected = useRef(isSelected);
  useEffect(() => {
    if (prevSelected.current !== isSelected) {
      prevSelected.current = isSelected;
      if (!reduceMotion) {
        opacity.value = 0.5;
        opacity.value = withTiming(1, { duration: ICON_FADE_MS });
      }
    }
  }, [isSelected, reduceMotion, opacity]);

  return (
    <Animated.View style={animatedStyle}>
      <FontAwesome
        name={name}
        size={20}
        color={isSelected ? selectedColor : unselectedColor}
      />
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
  pill: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    borderBottomRightRadius: 16,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    zIndex: 1,
  },
});
