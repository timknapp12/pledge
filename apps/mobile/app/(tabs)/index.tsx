import { ActivityIndicator, TouchableOpacity } from 'react-native';
import styled from 'styled-components/native';
import { useAuth } from '../../contexts/AuthContext';

export default function HomeScreen() {
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
      <Container>
        <ActivityIndicator size='large' color='#9945FF' />
        <LoadingText>Loading...</LoadingText>
      </Container>
    );
  }

  return (
    <Container>
      <Title>Pledge</Title>
      <Subtitle>Stake on your goals</Subtitle>

      <Separator />

      {user ? (
        <AuthContainer>
          <ConnectedText>Connected</ConnectedText>
          <WalletText>
            {walletAddress?.slice(0, 4)}...{walletAddress?.slice(-4)}
          </WalletText>
          <UserIdText>User ID: {user.id}</UserIdText>

          <DisconnectButton onPress={disconnect}>
            <DisconnectButtonText>Disconnect</DisconnectButtonText>
          </DisconnectButton>
        </AuthContainer>
      ) : (
        <AuthContainer>
          <DescriptionText>
            Connect your Solana wallet to get started
          </DescriptionText>

          <ConnectButton
            onPress={connect}
            disabled={isConnecting}
            style={{ opacity: isConnecting ? 0.6 : 1 }}
          >
            {isConnecting ? (
              <ActivityIndicator size='small' color='#fff' />
            ) : (
              <ConnectButtonText>Connect Wallet</ConnectButtonText>
            )}
          </ConnectButton>

          {error && <ErrorText>{error}</ErrorText>}
        </AuthContainer>
      )}
    </Container>
  );
}

const Container = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-color: ${(props) => props.theme.colors.background};
`;

const Title = styled.Text`
  font-size: 32px;
  font-weight: bold;
  color: ${(props) => props.theme.colors.primary};
`;

const Subtitle = styled.Text`
  font-size: 18px;
  margin-top: 8px;
  opacity: 0.7;
  color: ${(props) => props.theme.colors.text};
`;

const Separator = styled.View`
  margin: 30px 0;
  height: 1px;
  width: 80%;
  background-color: ${(props) => props.theme.colors.separator};
`;

const AuthContainer = styled.View`
  align-items: center;
  width: 100%;
`;

const DescriptionText = styled.Text`
  font-size: 16px;
  text-align: center;
  margin-bottom: 24px;
  opacity: 0.8;
  color: ${(props) => props.theme.colors.text};
`;

const ConnectButton = styled(TouchableOpacity)`
  background-color: ${(props) => props.theme.colors.primary};
  padding: 16px 32px;
  border-radius: 12px;
  min-width: 200px;
  align-items: center;
`;

const ConnectButtonText = styled.Text`
  color: #fff;
  font-size: 18px;
  font-weight: 600;
`;

const ConnectedText = styled.Text`
  font-size: 16px;
  color: ${(props) => props.theme.colors.success};
  font-weight: 600;
  margin-bottom: 8px;
`;

const WalletText = styled.Text`
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 4px;
  color: ${(props) => props.theme.colors.text};
`;

const UserIdText = styled.Text`
  font-size: 14px;
  opacity: 0.6;
  margin-bottom: 24px;
  color: ${(props) => props.theme.colors.text};
`;

const DisconnectButton = styled(TouchableOpacity)`
  background-color: transparent;
  border-width: 1px;
  border-color: ${(props) => props.theme.colors.error};
  padding: 12px 24px;
  border-radius: 8px;
`;

const DisconnectButtonText = styled.Text`
  color: ${(props) => props.theme.colors.error};
  font-size: 16px;
`;

const LoadingText = styled.Text`
  margin-top: 16px;
  font-size: 16px;
  opacity: 0.7;
  color: ${(props) => props.theme.colors.text};
`;

const ErrorText = styled.Text`
  color: ${(props) => props.theme.colors.error};
  margin-top: 16px;
  text-align: center;
`;
