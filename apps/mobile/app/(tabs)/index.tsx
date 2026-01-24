import { ActivityIndicator } from 'react-native';
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
        <BodySecondary style={{ marginTop: 16 }}>Loading...</BodySecondary>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Title1>Pledge</Title1>
      <BodySecondary style={{ marginTop: 8 }}>
        Stake on your goals
      </BodySecondary>

      <Separator />

      {user ? (
        <CenteredColumn $gap={8}>
          <SuccessText>Connected</SuccessText>
          <MonoText
            style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}
          >
            {walletAddress?.slice(0, 4)}...{walletAddress?.slice(-4)}
          </MonoText>
          <BodySmallSecondary style={{ marginBottom: 16 }}>
            User ID: {user.id}
          </BodySmallSecondary>

          <OutlineButton onPress={disconnect}>
            <OutlineButtonText>Disconnect</OutlineButtonText>
          </OutlineButton>
        </CenteredColumn>
      ) : (
        <CenteredColumn $gap={8}>
          <BodySecondary style={{ textAlign: 'center', marginBottom: 16 }}>
            Connect your Solana wallet to get started
          </BodySecondary>

          <PrimaryButton
            onPress={connect}
            disabled={isConnecting}
            style={{ opacity: isConnecting ? 0.6 : 1 }}
          >
            {isConnecting ? (
              <ActivityIndicator size='small' color='#fff' />
            ) : (
              <ButtonText>Connect Wallet</ButtonText>
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
