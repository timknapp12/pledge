import { Pressable, View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
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

const SPRING_CONFIG = { damping: 20, stiffness: 300 };

export const SegmentControl = ({
  segments,
  selectedKey,
  onSelect,
}: SegmentControlProps) => {
  const { theme } = useAppTheme();
  const selectedIndex = segments.findIndex((s) => s.key === selectedKey);

  // Animated indicator position
  const indicatorPosition = useSharedValue(selectedIndex);

  const handleSelect = (key: string, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    indicatorPosition.value = withSpring(index, SPRING_CONFIG);
    onSelect(key);
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          indicatorPosition.value *
          (1 / segments.length) *
          100 +
          '%' === 'NaN%'
            ? 0
            : 0,
      },
    ],
    left: `${(indicatorPosition.value / segments.length) * 100}%`,
    width: `${100 / segments.length}%`,
  }));

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.cardBackground },
      ]}
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
            <BodySmall
              style={{
                color: isSelected
                  ? theme.colors.iconOnPrimary
                  : theme.colors.textSecondary,
                fontWeight: isSelected ? '700' : '500',
              }}
            >
              {segment.label}
            </BodySmall>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    borderRadius: 8,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
