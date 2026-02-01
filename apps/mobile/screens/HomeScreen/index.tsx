import { ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'styled-components/native';
import styled from 'styled-components/native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useActivePledges } from '@/hooks/useSupabase';
import {
  Title1,
  BodySecondary,
  MonoText,
  ScreenContainer,
  TrackedScrollView,
  Row,
  Column,
  CenteredColumn,
  ErrorState,
} from '@/components';
import { PledgeListItem } from './PledgeListItem';
import { EmptyState } from './EmptyState';
import { ConnectWalletScreen } from './ConnectWalletScreen';

export const HomeScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { user, walletAddress, isLoading: authLoading, disconnect } = useAuth();
  const {
    data: pledges,
    isLoading: pledgesLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useActivePledges();

  const handleCreatePledge = () => {
    router.push('/create-pledge');
  };

  const handlePledgePress = (pledgeId: string) => {
    router.push(`/pledge/${pledgeId}`);
  };

  // Loading state
  if (authLoading) {
    return (
      <ScreenContainer>
        <ActivityIndicator size='large' color={theme.colors.primary} />
        <BodySecondary style={{ marginTop: 16 }}>
          {t('Loading...')}
        </BodySecondary>
      </ScreenContainer>
    );
  }

  // Not authenticated
  if (!user) {
    return <ConnectWalletScreen />;
  }

  // Authenticated - show pledges
  return (
    <ScreenContainer style={{ flex: 1 }}>
      <Column
        $width='100%'
        style={{
          justifyContent: 'space-between',
          flex: 1,
        }}
      >
        <CenteredColumn $gap={24} style={{ flex: 1 }}>
          {/* HEADER ROW */}
          <Row
            $gap={16}
            $width='100%'
            style={{ justifyContent: 'space-between' }}
          >
            <Title1>{t('My Pledges')}</Title1>
            <WalletBadge onPress={disconnect}>
              <Ionicons name='wallet' size={16} color={theme.colors.primary} />
              <MonoText style={{ fontSize: 12 }}>
                {walletAddress?.slice(0, 4)}...{walletAddress?.slice(-4)}
              </MonoText>
            </WalletBadge>
          </Row>

          {pledgesLoading ? (
            <CenteredColumn
              style={{
                flex: 1,
                justifyContent: 'center',
              }}
            >
              <ActivityIndicator size='large' color={theme.colors.primary} />
              <BodySecondary style={{ marginTop: 16 }}>
                {t('Pledging...')}
              </BodySecondary>
            </CenteredColumn>
          ) : isError ? (
            <CenteredColumn style={{ flex: 1, justifyContent: 'center' }}>
              <ErrorState
                message={error instanceof Error ? error.message : undefined}
                onRetry={refetch}
              />
            </CenteredColumn>
          ) : pledges && pledges.length > 0 ? (
            <TrackedScrollView
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={isRefetching}
                  onRefresh={refetch}
                  tintColor={theme.colors.primary}
                />
              }
            >
              <Column style={{ flex: 1 }} $gap={24}>
                {pledges.map((pledge) => (
                  <PledgeListItem
                    key={pledge.id}
                    pledge={pledge}
                    onPress={() => handlePledgePress(pledge.id)}
                  />
                ))}
              </Column>
            </TrackedScrollView>
          ) : (
            <EmptyState onCreatePress={handleCreatePledge} />
          )}

          {pledges && pledges.length > 0 && (
            <FAB
              onPress={handleCreatePledge}
              style={{
                shadowColor: theme.colors.shadowColor,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
              }}
            >
              <Ionicons
                name='add'
                size={28}
                color={theme.colors.iconOnPrimary}
              />
            </FAB>
          )}
        </CenteredColumn>
      </Column>
    </ScreenContainer>
  );
};

const WalletBadge = styled.Pressable`
  flex-direction: row;
  align-items: center;
  background-color: ${({ theme }) => theme.colors.cardBackground};
  padding: 8px 12px;
  border-radius: 20px;
  gap: 6px;
`;

const FAB = styled.Pressable`
  position: absolute;
  bottom: 100px;
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 28px;
  background-color: ${({ theme }) => theme.colors.primary};
  align-items: center;
  justify-content: center;
`;
