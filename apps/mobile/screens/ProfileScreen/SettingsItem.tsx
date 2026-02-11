import { Pressable, View, StyleSheet } from 'react-native';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { Body, BodySecondary, Row } from '@/components';

export type IoniconsName = keyof typeof Ionicons.glyphMap;

export interface SettingsItemProps {
  icon: IoniconsName;
  label: string;
  value?: string;
  onPress?: () => void;
  isLast?: boolean;
}

export const SettingsItem = ({
  icon,
  label,
  value,
  onPress,
  isLast,
}: SettingsItemProps) => {
  const { theme } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
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
        {onPress && (
          <Ionicons
            name='chevron-forward'
            size={20}
            color={theme.colors.textSecondary}
          />
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
