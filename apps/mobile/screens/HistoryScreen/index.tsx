import { ActivityIndicator, RefreshControl, View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { usePledges, formatUsdcAmount } from '@/hooks/useSupabase';
import {
  Title1,
  Title2,
  Title3,
  BodySecondary,
  BodySmallSecondary,
  ScreenContainer,
  CenteredColumn,
  Card,
  TrackedScrollView,
  Column,
  Row,
  Gap,
  ErrorState,
} from '@/components';
import { PastPledgeItem } from './PastPledgeItem';
import { EmptyState } from './EmptyState';
// TODO - add haptic feedback to nav buttons

export const HistoryScreen = () => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const {
    data: allPledges,
    isLoading: pledgesLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = usePledges();

  // Filter for past pledges (completed or forfeited)
  const pastPledges =
    allPledges?.filter(
      (p) => p.status === 'Completed' || p.status === 'Forfeited'
    ) || [];

  // Calculate stats
  const totalPledged =
    allPledges?.reduce((sum, p) => sum + p.stake_amount, 0) || 0;
  const completedPledges =
    allPledges?.filter((p) => p.status === 'Completed') || [];
  const successRate =
    allPledges && allPledges.length > 0
      ? Math.round(
          (completedPledges.length /
            allPledges.filter((p) => p.status !== 'Active').length) *
            100
        ) || 0
      : 0;

  const handlePledgePress = (pledgeId: string) => {
    router.push(`/pledge/${pledgeId}`);
  };

  if (authLoading) {
    return (
      <ScreenContainer>
        <ActivityIndicator size='large' color={theme.colors.primary} />
      </ScreenContainer>
    );
  }

  if (!user) {
    return (
      <ScreenContainer>
        <CenteredColumn gap={16}>
          <Ionicons
            name='lock-closed-outline'
            size={64}
            color={theme.colors.textSecondary}
          />
          <BodySecondary style={{ textAlign: 'center' }}>
            {t('Connect your Solana wallet to get started')}
          </BodySecondary>
        </CenteredColumn>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <Column
        style={{
          justifyContent: 'space-between',
          flex: 1,
          width: '100%',
        }}
      >
        <CenteredColumn style={{ flex: 1 }} gap={24}>
          {/* HEADER ROW */}
          <Row width='100%'>
            <Title1>{t('History')}</Title1>
          </Row>

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
              {/* Stats Section */}
              <Column gap={4}>
                <View style={localStyles.sectionHeader}>
                  <Title3>{t('Stats')}</Title3>
                </View>
                <CenteredColumn width='100%' style={{ flex: 1 }} gap={8}>
                  <Card style={{ alignItems: 'center' }}>
                    <Title2 style={{ color: theme.colors.primary }}>
                      ${formatUsdcAmount(totalPledged)}
                    </Title2>
                    <BodySmallSecondary style={{ marginTop: 4 }}>
                      {t('Total Pledged')}
                    </BodySmallSecondary>
                  </Card>
                  <Card style={{ alignItems: 'center' }}>
                    <Title2 style={{ color: theme.colors.primary }}>
                      {successRate}%
                    </Title2>
                    <BodySmallSecondary style={{ marginTop: 4 }}>
                      {t('Success Rate')}
                    </BodySmallSecondary>
                  </Card>
                </CenteredColumn>
              </Column>

              {/* Past Pledges Section */}
              <Column gap={4}>
                <View style={localStyles.sectionHeader}>
                  <Title3>{t('Past Pledges')}</Title3>
                </View>
              </Column>

              {pledgesLoading ? (
                <CenteredColumn style={{ flex: 1 }}>
                  <Gap gap={48} />
                  <ActivityIndicator
                    size='large'
                    color={theme.colors.primary}
                  />
                </CenteredColumn>
              ) : isError ? (
                <ErrorState
                  message={error instanceof Error ? error.message : undefined}
                  onRetry={refetch}
                />
              ) : pastPledges.length > 0 ? (
                <View style={localStyles.contentContainer}>
                  {pastPledges.map((pledge) => (
                    <PastPledgeItem
                      key={pledge.id}
                      pledge={pledge}
                      onPress={() => handlePledgePress(pledge.id)}
                    />
                  ))}
                </View>
              ) : (
                <EmptyState />
              )}
            </Column>
          </TrackedScrollView>
        </CenteredColumn>
      </Column>
    </ScreenContainer>
  );
};

const localStyles = StyleSheet.create({
  sectionHeader: {
    paddingHorizontal: 20,
  },
  contentContainer: {
    paddingBottom: 100,
  },
});
