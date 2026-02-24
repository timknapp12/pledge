import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
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
  } = useActivePledges();

  const [focusCount, setFocusCount] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocusCount((c) => c + 1);
    }, []),
  );

  const handleRefresh = useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsPullRefreshing(false);
    }
  }, [refetch]);

  const handleCreatePledge = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
        <CenteredColumn gap={24} flex={1}>
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
            <CenteredColumn justify='center' flex={1}>
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
                  refreshing={isPullRefreshing}
                  onRefresh={handleRefresh}
                  tintColor={theme.colors.primary}
                />
              }
            >
              <Column flex={1} gap={24}>
                {pledges.map((pledge) => (
                  <PledgeListItem
                    key={pledge.id}
                    pledge={pledge}
                    onPress={() => handlePledgePress(pledge.id)}
                    animateKey={focusCount}
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
    bottom: 60,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
