import { RefObject, useEffect } from 'react';
import { View, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { usePathname, useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useDerivedValue,
  useReducedMotion,
} from 'react-native-reanimated';
import { useAppTheme, useThemeMode } from '@/theme/ThemeProvider';
import { useScrollContext } from '@/contexts/ScrollContext';

type IconName = keyof typeof Ionicons.glyphMap;

interface TabConfig {
  activeIcon: IconName;
  inactiveIcon: IconName;
  path: '/' | '/history' | '/profile';
}

const TAB_ORDER = ['index', 'history', 'profile'] as const;
type TabName = (typeof TAB_ORDER)[number];

const TAB_CONFIG: Record<TabName, TabConfig> = {
  index: {
    activeIcon: 'home',
    inactiveIcon: 'home-outline',
    path: '/',
  },
  history: {
    activeIcon: 'time',
    inactiveIcon: 'time-outline',
    path: '/history',
  },
  profile: {
    activeIcon: 'person',
    inactiveIcon: 'person-outline',
    path: '/profile',
  },
};

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 400,
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TabItemProps {
  routeName: TabName;
  isFocused: boolean;
  onPress: () => void;
}

function TabItem({ routeName, isFocused, onPress }: TabItemProps) {
  const { theme } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const config = TAB_CONFIG[routeName];

  useEffect(() => {
    if (isFocused && !reduceMotion) {
      scale.value = withSpring(1.08, SPRING_CONFIG, () => {
        scale.value = withSpring(1, SPRING_CONFIG);
      });
    }
  }, [isFocused, scale, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const iconName = isFocused ? config.activeIcon : config.inactiveIcon;
  const color = isFocused ? theme.colors.primary : theme.colors.textSecondary;

  return (
    <Pressable onPress={onPress} style={styles.tabItem}>
      <Animated.View style={animatedStyle}>
        <Ionicons name={iconName} size={26} color={color} />
      </Animated.View>
    </Pressable>
  );
}

interface CustomTabBarProps {
  blurTarget?: RefObject<View | null>;
}

export const CustomTabBar = ({ blurTarget }: CustomTabBarProps) => {
  const { theme } = useAppTheme();
  const { isDark } = useThemeMode();
  const { isScrolling } = useScrollContext();
  const router = useRouter();
  const pathname = usePathname();

  const currentTab: TabName =
    TAB_ORDER.find((name) => TAB_CONFIG[name].path === pathname) ?? 'index';
  const currentIndex = TAB_ORDER.indexOf(currentTab);
  const tabWidth = SCREEN_WIDTH / TAB_ORDER.length;

  const glowPosition = useSharedValue(currentIndex * tabWidth);

  const backgroundOpacity = useDerivedValue(() => {
    return withTiming(isScrolling.value ? 0 : 1, { duration: 150 });
  });

  useEffect(() => {
    glowPosition.value = withSpring(currentIndex * tabWidth, {
      damping: 50,
      stiffness: 400,
    });
  }, [currentIndex, tabWidth, glowPosition]);

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: glowPosition.value }],
    opacity: backgroundOpacity.value,
  }));

  const backgroundStyle = useAnimatedStyle(() => ({
    backgroundColor: theme.colors.background,
    opacity: backgroundOpacity.value,
  }));

  const glowColors = isDark
    ? [`${theme.colors.primary}00`, `${theme.colors.primary}40`]
    : [`${theme.colors.primary}00`, `${theme.colors.primary}30`];

  return (
    <View style={styles.container}>
      <BlurView
        intensity={50}
        tint={isDark ? 'dark' : 'light'}
        blurMethod='dimezisBlurViewSdk31Plus'
        blurTarget={blurTarget}
        style={styles.background}
      />
      <Animated.View style={[styles.background, backgroundStyle]} />
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

      <View style={styles.tabBar}>
        {TAB_ORDER.map((name) => {
          const isFocused = name === currentTab;
          const onPress = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
              () => {},
            );
            if (!isFocused) {
              router.replace(TAB_CONFIG[name].path);
            }
          };
          return (
            <TabItem
              key={name}
              routeName={name}
              isFocused={isFocused}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
};

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
