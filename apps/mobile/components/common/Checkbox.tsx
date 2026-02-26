import { View, StyleSheet, ViewProps } from 'react-native';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';

export interface CheckboxProps extends ViewProps {
  checked: boolean;
}

export const Checkbox = ({ checked, style, ...props }: CheckboxProps) => {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.checkbox,
        {
          borderColor: theme.colors.primary,
          backgroundColor: checked ? theme.colors.primary : 'transparent',
        },
        style,
      ]}
      {...props}
    >
      {checked && (
        <Ionicons
          name="checkmark"
          size={14}
          color={theme.colors.iconOnPrimary}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
