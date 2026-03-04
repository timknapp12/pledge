import { useRef, useEffect, useState } from 'react';
import {
  Animated,
  Pressable,
  LayoutChangeEvent,
  View,
  StyleSheet,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAppTheme } from '@/theme/ThemeProvider';
import { useThemeMode, ThemeMode } from '@/theme/ThemeProvider';

const OPTIONS: { mode: ThemeMode; icon: 'sun-o' | 'moon-o' | 'cog' }[] = [
  { mode: 'light', icon: 'sun-o' },
  { mode: 'dark', icon: 'moon-o' },
  { mode: 'system', icon: 'cog' },
];

export const ThemeSelector = () => {
  const { theme } = useAppTheme();
  const { mode, setMode } = useThemeMode();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const segmentWidth = useRef(0);
  const [pillWidth, setPillWidth] = useState(0);

  const selectedIndex = OPTIONS.findIndex((o) => o.mode === mode);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: selectedIndex * segmentWidth.current,
      useNativeDriver: true,
      damping: 15,
      stiffness: 150,
    }).start();
  }, [selectedIndex, slideAnim]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    const padding = 4;
    const sw = (width - padding * 2) / OPTIONS.length;
    segmentWidth.current = sw;
    setPillWidth(sw);
    // Set initial position without animation
    slideAnim.setValue(selectedIndex * sw);
  };

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
          {
            backgroundColor: theme.colors.primary,
            transform: [{ translateX: slideAnim }],
            width: pillWidth || `${100 / OPTIONS.length}%`,
          },
        ]}
      />
      {OPTIONS.map((option) => (
        <Pressable
          key={option.mode}
          style={styles.segment}
          onPress={() => setMode(option.mode)}
        >
          <FontAwesome
            name={option.icon}
            size={20}
            color={
              mode === option.mode
                ? theme.colors.background
                : theme.colors.textSecondary
            }
          />
        </Pressable>
      ))}
    </View>
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
