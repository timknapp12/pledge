import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { CenteredColumn } from './containers';
import { BodySecondary, BodySmallSecondary } from './texts';
import { SecondaryButton } from './buttons';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorState = ({ message, onRetry }: ErrorStateProps) => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();

  return (
    <CenteredColumn gap={16} style={{ padding: 32 }}>
      <Ionicons
        name='cloud-offline-outline'
        size={48}
        color={theme.colors.error}
      />
      <BodySecondary style={{ textAlign: 'center' }}>
        {t('Something went wrong')}
      </BodySecondary>
      {message && (
        <BodySmallSecondary style={{ textAlign: 'center' }}>
          {message}
        </BodySmallSecondary>
      )}
      {onRetry && (
        <SecondaryButton onPress={onRetry} icon='refresh-outline'>
          {t('Try Again')}
        </SecondaryButton>
      )}
    </CenteredColumn>
  );
};
