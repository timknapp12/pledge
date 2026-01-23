import { StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useAuth } from '../../contexts/AuthContext';

export default function HomeScreen() {
  const { user, walletAddress, isLoading, isConnecting, error, connect, disconnect } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#9945FF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pledge</Text>
      <Text style={styles.subtitle}>Stake on your goals</Text>

      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />

      {user ? (
        // Authenticated state
        <View style={styles.authContainer}>
          <Text style={styles.connectedText}>Connected</Text>
          <Text style={styles.walletText}>
            {walletAddress?.slice(0, 4)}...{walletAddress?.slice(-4)}
          </Text>
          <Text style={styles.userIdText}>User ID: {user.id}</Text>

          <TouchableOpacity style={styles.disconnectButton} onPress={disconnect}>
            <Text style={styles.disconnectButtonText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Unauthenticated state
        <View style={styles.authContainer}>
          <Text style={styles.descriptionText}>
            Connect your Solana wallet to get started
          </Text>

          <TouchableOpacity
            style={[styles.connectButton, isConnecting && styles.connectButtonDisabled]}
            onPress={connect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.connectButtonText}>Connect Wallet</Text>
            )}
          </TouchableOpacity>

          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#9945FF',
  },
  subtitle: {
    fontSize: 18,
    marginTop: 8,
    opacity: 0.7,
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
  authContainer: {
    alignItems: 'center',
    width: '100%',
  },
  descriptionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.8,
  },
  connectButton: {
    backgroundColor: '#9945FF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  connectButtonDisabled: {
    opacity: 0.6,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  connectedText: {
    fontSize: 16,
    color: '#14F195',
    fontWeight: '600',
    marginBottom: 8,
  },
  walletText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userIdText: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 24,
  },
  disconnectButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ff4444',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  disconnectButtonText: {
    color: '#ff4444',
    fontSize: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    opacity: 0.7,
  },
  errorText: {
    color: '#ff4444',
    marginTop: 16,
    textAlign: 'center',
  },
});
