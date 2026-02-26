import { Pressable, View, StyleSheet } from 'react-native';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Switch } from '@/components';
import { Ionicons } from '@expo/vector-icons';
import { Body, BodySecondary, Row } from '@/components';

export type IoniconsName = keyof typeof Ionicons.glyphMap;

export interface SettingsItemProps {
  icon: IoniconsName;
  label: string;
  value?: string;
  onPress?: () => void;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  switchDisabled?: boolean;
  isLast?: boolean;
}

export const SettingsItem = ({
  icon,
  label,
  value,
  onPress,
  switchValue,
  onSwitchChange,
  switchDisabled,
  isLast,
}: SettingsItemProps) => {
  const { theme } = useAppTheme();

  const hasSwitch = switchValue !== undefined && onSwitchChange !== undefined;

  return (
    <Pressable
      onPress={hasSwitch ? undefined : onPress}
      disabled={hasSwitch || !onPress}
      style={[
        localStyles.settingsRow,
        !isLast && {
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
      ]}
    >
      <View style={localStyles.settingsLabel}>
        <Ionicons name={icon} size={20} color={theme.colors.textSecondary} />
        <Body>{label}</Body>
      </View>
      <Row gap={8}>
        {value && <BodySecondary>{value}</BodySecondary>}
        {hasSwitch ? (
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            disabled={switchDisabled}
          />
        ) : (
          onPress && (
            <Ionicons
              name='chevron-forward'
              size={20}
              color={theme.colors.textSecondary}
            />
          )
        )}
      </Row>
    </Pressable>
  );
};

const localStyles = StyleSheet.create({
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingsLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
