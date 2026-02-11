import { ActivityIndicator, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
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
  const { theme } = useAppTheme();
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
        width='100%'
        style={{
          justifyContent: 'space-between',
          flex: 1,
        }}
      >
        <CenteredColumn gap={24} style={{ flex: 1 }}>
          {/* HEADER ROW */}
          <Row
            gap={16}
            width='100%'
            style={{ justifyContent: 'space-between' }}
          >
            <Title1>{t('My Pledges')}</Title1>
            <Pressable
              onPress={disconnect}
              style={[
                localStyles.walletBadge,
                { backgroundColor: theme.colors.cardBackground },
              ]}
            >
              <Ionicons name='wallet' size={16} color={theme.colors.primary} />
              <MonoText style={{ fontSize: 12 }}>
                {walletAddress?.slice(0, 4)}...{walletAddress?.slice(-4)}
              </MonoText>
            </Pressable>
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
              <Column style={{ flex: 1 }} gap={24}>
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
            <Pressable
              onPress={handleCreatePledge}
              style={[
                localStyles.fab,
                {
                  backgroundColor: theme.colors.primary,
                  shadowColor: theme.colors.shadowColor,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 4,
                },
              ]}
            >
              <Ionicons
                name='add'
                size={28}
                color={theme.colors.iconOnPrimary}
              />
            </Pressable>
          )}
        </CenteredColumn>
      </Column>
    </ScreenContainer>
  );
};

const localStyles = StyleSheet.create({
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
