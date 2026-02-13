import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import {
  Title2,
  BodySecondary,
  CenteredColumn,
  PrimaryButton,
  Gap,
} from '@/components';

export interface EmptyStateProps {
  onCreatePress: () => void;
}

export const EmptyState = ({ onCreatePress }: EmptyStateProps) => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();

  return (
    <CenteredColumn
      gap={24}
      width='100%'
      style={{
        flex: 1,
        justifyContent: 'space-between',
        marginBottom: 60,
      }}
    >
      <CenteredColumn gap={12} flex={1}>
        <Ionicons
          name='flag-outline'
          size={64}
          color={theme.colors.textSecondary}
        />
        <Title2 style={{ textAlign: 'center' }}>
          {t('No active pledges')}
        </Title2>

        <Gap gap={32} />
        {/* // TODO - think of new copy */}
        <BodySecondary style={{ textAlign: 'center', maxWidth: 280 }}>
          {t(
            'Create your first pledge to start achieving your goals with skin in the game.'
          )}
        </BodySecondary>
      </CenteredColumn>
      <PrimaryButton onPress={onCreatePress} style={{ marginTop: 16 }}>
        {t('Create Pledge')}
      </PrimaryButton>
    </CenteredColumn>
  );
};
