import { useEffect } from 'react';
import { View, Pressable, StyleSheet, Dimensions } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useDerivedValue,
} from 'react-native-reanimated';
import { useTheme } from 'styled-components/native';
import { useThemeMode } from '@/theme/ThemeProvider';
import { useScrollContext } from '@/contexts/ScrollContext';

type IconName = keyof typeof Ionicons.glyphMap;

interface TabConfig {
  activeIcon: IconName;
  inactiveIcon: IconName;
  labelKey: string;
}

const TAB_CONFIG: Record<string, TabConfig> = {
  index: {
    activeIcon: 'home',
    inactiveIcon: 'home-outline',
    labelKey: 'Home',
  },
  two: {
    activeIcon: 'grid',
    inactiveIcon: 'grid-outline',
    labelKey: 'Components',
  },
  three: {
    activeIcon: 'person',
    inactiveIcon: 'person-outline',
    labelKey: 'Profile',
  },
};

const SPRING_CONFIG = {
  damping: 12,
  stiffness: 600,
  mass: 0.1,
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TabItemProps {
  routeName: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function TabItem({ routeName, isFocused, onPress, onLongPress }: TabItemProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  const config = TAB_CONFIG[routeName] || {
    activeIcon: 'ellipse' as IconName,
    inactiveIcon: 'ellipse-outline' as IconName,
    labelKey: routeName,
  };

  useEffect(() => {
    if (isFocused) {
      // Scale up then spring back
      scale.value = withSpring(1.2, SPRING_CONFIG, () => {
        scale.value = withSpring(1, SPRING_CONFIG);
      });
    }
  }, [isFocused, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const iconName = isFocused ? config.activeIcon : config.inactiveIcon;
  const color = isFocused ? theme.colors.primary : theme.colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabItem}
    >
      <Animated.View style={animatedStyle}>
        <Ionicons name={iconName} size={26} color={color} />
      </Animated.View>
    </Pressable>
  );
}

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const { isDark } = useThemeMode();
  const { isScrolling } = useScrollContext();
  const numTabs = state.routes.length;
  const tabWidth = SCREEN_WIDTH / numTabs;

  // Animated position for the glow
  const glowPosition = useSharedValue(state.index * tabWidth);

  // Animated background opacity based on scroll state
  const backgroundOpacity = useDerivedValue(() => {
    return withTiming(isScrolling.value ? 0 : 1, { duration: 50 });
  });

  useEffect(() => {
    glowPosition.value = withSpring(state.index * tabWidth, {
      damping: 50,
      stiffness: 400,
    });
  }, [state.index, tabWidth, glowPosition]);

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: glowPosition.value }],
    opacity: backgroundOpacity.value,
  }));

  const backgroundStyle = useAnimatedStyle(() => ({
    backgroundColor: theme.colors.background,
    opacity: backgroundOpacity.value,
  }));

  // Gradient colors for the glow
  const glowColors = isDark
    ? [`${theme.colors.primary}00`, `${theme.colors.primary}40`]
    : [`${theme.colors.primary}00`, `${theme.colors.primary}30`];

  return (
    <View style={styles.container}>
      {/* Blur background (visible when scrolling) */}
      <BlurView
        intensity={50}
        tint={isDark ? 'dark' : 'light'}
        experimentalBlurMethod='dimezisBlurView'
        style={styles.background}
      />
      {/* Solid background (fades out when scrolling to reveal blur) */}
      <Animated.View style={[styles.background, backgroundStyle]} />
      {/* Animated glow behind selected tab */}
      <Animated.View
        style={[styles.glowContainer, { width: tabWidth }, glowStyle]}
      >
        <LinearGradient
          colors={glowColors as [string, string]}
          style={styles.glow}
          start={{ x: 0.5, y: 1 }}
          end={{ x: 0.5, y: 0 }}
        />
      </Animated.View>

      {/* Tab items */}
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <TabItem
              key={route.key}
              routeName={route.name}
              isFocused={isFocused}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  glowContainer: {
    position: 'absolute',
    top: 0,
    height: '100%',
  },
  glow: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    paddingBottom: 30,
    paddingTop: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
});
