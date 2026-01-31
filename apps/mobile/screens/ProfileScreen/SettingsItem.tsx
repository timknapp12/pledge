import { useTheme } from 'styled-components/native';
import styled from 'styled-components/native';
import { Ionicons } from '@expo/vector-icons';
import { Body, BodySecondary, Row } from '@/components';

const SettingsRow = styled.Pressable`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom-width: 1px;
  border-bottom-color: ${({ theme }) => theme.colors.border};
`;

const SettingsRowLast = styled(SettingsRow)`
  border-bottom-width: 0;
`;

const SettingsLabel = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
`;

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
  const theme = useTheme();
  const Container = isLast ? SettingsRowLast : SettingsRow;

  return (
    <Container onPress={onPress} disabled={!onPress}>
      <SettingsLabel>
        <Ionicons name={icon} size={20} color={theme.colors.textSecondary} />
        <Body>{label}</Body>
      </SettingsLabel>
      <Row $gap={8}>
        {value && <BodySecondary>{value}</BodySecondary>}
        {onPress && (
          <Ionicons
            name='chevron-forward'
            size={20}
            color={theme.colors.textSecondary}
          />
        )}
      </Row>
    </Container>
  );
};
