import { Switch as RNSwitch, SwitchProps as RNSwitchProps } from 'react-native';
import { useAppTheme } from '@/theme/ThemeProvider';

export interface SwitchProps
  extends Omit<RNSwitchProps, 'trackColor' | 'thumbColor'> {
  /** Optional overrides - when omitted, theme colors are used */
  trackColor?: { false?: string; true?: string };
  thumbColor?: string;
}

export const Switch = ({
  value,
  onValueChange,
  disabled = false,
  trackColor: trackColorOverride,
  thumbColor: thumbColorOverride,
  ...rest
}: SwitchProps) => {
  const { theme } = useAppTheme();

  const trackColor = trackColorOverride ?? {
    false: theme.colors.border,
    true: theme.colors.primary,
  };

  const thumbColor = thumbColorOverride ?? theme.colors.thumbColor;

  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={trackColor}
      thumbColor={thumbColor}
      {...rest}
    />
  );
};
