import { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { Slider as AwesomeSlider } from 'react-native-awesome-slider';
import { useAppTheme } from '@/theme/ThemeProvider';

type SliderProps = {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  height?: number;
  color?: string;
  trackColor?: string;
  style?: ViewStyle;
  disabled?: boolean;
};

export const Slider = ({
  value,
  onValueChange,
  min = 0,
  max = 100,
  height = 12,
  color,
  trackColor,
  style,
  disabled = false,
}: SliderProps) => {
  const { theme } = useAppTheme();
  const progress = useSharedValue(0);
  const minVal = useSharedValue(min);
  const maxVal = useSharedValue(max);
  const borderRadius = height / 2;
  const thumbSize = height + 12;

  useEffect(() => {
    progress.value = withTiming(value, { duration: 1000 });
  }, [value, progress]);

  return (
    <View style={[styles.wrapper, { height: thumbSize }, style]}>
      <AwesomeSlider
        progress={progress}
        minimumValue={minVal}
        maximumValue={maxVal}
        onValueChange={onValueChange}
        disable={disabled}
        containerStyle={{ borderRadius }}
        style={{ borderRadius }}
        theme={{
          minimumTrackTintColor: color || theme.colors.primary,
          maximumTrackTintColor: trackColor || theme.colors.border,
        }}
        thumbWidth={thumbSize}
        renderBubble={() => null}
        sliderHeight={height}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
  },
});
