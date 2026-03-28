import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { Title2, BodySecondary, CenteredColumn } from '@/components';

export const EmptyState = () => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();

  return (
    <CenteredColumn gap={16} padding={40}>
      <Ionicons
        name='time-outline'
        size={64}
        color={theme.colors.textSecondary}
      />
      <Title2 style={{ textAlign: 'center' }}>
        {t('No past pledges yet')}
      </Title2>
      <BodySecondary style={{ textAlign: 'center', maxWidth: 280 }}>
        {t('Complete your first pledge to see it here.')}
      </BodySecondary>
    </CenteredColumn>
  );
};
