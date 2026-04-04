import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import {
  Title1,
  BodySecondary,
  ErrorText,
  ScreenContainer,
  CenteredColumn,
  PrimaryButton,
  Gap,
} from '@/components';

export const ConnectWalletScreen = () => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const { isConnecting, error, connect } = useAuth();

  return (
    <ScreenContainer>
      <CenteredColumn
        gap={16}
        style={{
          justifyContent: 'space-between',
          flex: 1,
          marginBottom: 60,
        }}
      >
        <CenteredColumn gap={12} justify='center' flex={1}>
          <Ionicons
            name='wallet-outline'
            size={64}
            color={theme.colors.primary}
          />
          <Title1>{t('Pledge')}</Title1>
          <Gap gap={32} />
          <BodySecondary style={{ textAlign: 'center', maxWidth: 280 }}>
            {t(
              'Pledge your tokens, crush your goals. Connect your wallet to get started.',
            )}
          </BodySecondary>
        </CenteredColumn>

        <PrimaryButton
          onPress={connect}
          loading={isConnecting}
          icon='wallet-outline'
        >
          {t('Connect Wallet')}
        </PrimaryButton>

        {error && (
          <ErrorText style={{ marginTop: 16, textAlign: 'center' }}>
            {error}
          </ErrorText>
        )}
      </CenteredColumn>
    </ScreenContainer>
  );
};
