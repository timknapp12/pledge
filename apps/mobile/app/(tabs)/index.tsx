import { ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'styled-components/native';
import { useAuth } from '../../contexts/AuthContext';
import {
  Title1,
  BodySecondary,
  BodySmallSecondary,
  ErrorText,
  SuccessText,
  MonoText,
  ScreenContainer,
  Separator,
  CenteredColumn,
  PrimaryButton,
  OutlineButton,
  ButtonText,
  OutlineButtonText,
} from '@/components';

export default function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const {
    user,
    walletAddress,
    isLoading,
    isConnecting,
    error,
    connect,
    disconnect,
  } = useAuth();

  if (isLoading) {
    return (
      <ScreenContainer>
        <ActivityIndicator size='large' color={theme.colors.primary} />
        <BodySecondary style={{ marginTop: 16 }}>{t('Loading...')}</BodySecondary>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Title1>{t('Pledge')}</Title1>
      <BodySecondary style={{ marginTop: 8 }}>
        {t('Stake on your goals')}
      </BodySecondary>

      <Separator />

      {user ? (
        <CenteredColumn $gap={8}>
          <SuccessText>{t('Connected')}</SuccessText>
          <MonoText
            style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}
          >
            {walletAddress?.slice(0, 4)}...{walletAddress?.slice(-4)}
          </MonoText>
          <BodySmallSecondary style={{ marginBottom: 16 }}>
            {t('User ID:')} {user.id}
          </BodySmallSecondary>

          <OutlineButton onPress={disconnect}>
            <OutlineButtonText>{t('Disconnect')}</OutlineButtonText>
          </OutlineButton>
        </CenteredColumn>
      ) : (
        <CenteredColumn $gap={8}>
          <BodySecondary style={{ textAlign: 'center', marginBottom: 16 }}>
            {t('Connect your Solana wallet to get started')}
          </BodySecondary>

          <PrimaryButton
            onPress={connect}
            disabled={isConnecting}
            style={{ opacity: isConnecting ? 0.6 : 1 }}
          >
            {isConnecting ? (
              <ActivityIndicator size='small' color='#fff' />
            ) : (
              <ButtonText>{t('Connect Wallet')}</ButtonText>
            )}
          </PrimaryButton>

          {error && (
            <ErrorText style={{ marginTop: 16, textAlign: 'center' }}>
              {error}
            </ErrorText>
          )}
        </CenteredColumn>
      )}
    </ScreenContainer>
  );
}
