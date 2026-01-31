import { useTranslation } from 'react-i18next';
import { useTheme } from 'styled-components/native';
import { Ionicons } from '@expo/vector-icons';
import {
  Title2,
  BodySecondary,
  CenteredColumn,
  PrimaryButton,
} from '@/components';

export interface EmptyStateProps {
  onCreatePress: () => void;
}

export const EmptyState = ({ onCreatePress }: EmptyStateProps) => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <CenteredColumn $gap={16} $padding={40}>
      <Ionicons
        name='flag-outline'
        size={64}
        color={theme.colors.textSecondary}
      />
      <Title2 style={{ textAlign: 'center' }}>{t('No active pledges')}</Title2>
      <BodySecondary style={{ textAlign: 'center', maxWidth: 280 }}>
        {t(
          'Create your first pledge to start achieving your goals with skin in the game.',
        )}
      </BodySecondary>
      <PrimaryButton onPress={onCreatePress} style={{ marginTop: 16 }}>
        {t('Create Pledge')}
      </PrimaryButton>
    </CenteredColumn>
  );
};
