import { ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'styled-components/native';
import styled from 'styled-components/native';
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

export const HistoryScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
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
      (p) => p.status === 'Completed' || p.status === 'Forfeited',
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
            100,
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
        <CenteredColumn $gap={16}>
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
        <CenteredColumn style={{ flex: 1 }} $gap={24}>
          {/* HEADER ROW */}
          <Row $width='100%'>
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
            <Column style={{ flex: 1 }} $gap={24}>
              {/* Stats Section */}
              <Column $gap={4}>
                <SectionHeader>
                  <Title3>{t('Stats')}</Title3>
                </SectionHeader>
                <CenteredColumn $width='100%' style={{ flex: 1 }} $gap={8}>
                  <Card style={{ alignItems: 'center' }}>
                    <StatValue>${formatUsdcAmount(totalPledged)}</StatValue>
                    <StatLabel>{t('Total Pledged')}</StatLabel>
                  </Card>
                  <Card style={{ alignItems: 'center' }}>
                    <StatValue>{successRate}%</StatValue>
                    <StatLabel>{t('Success Rate')}</StatLabel>
                  </Card>
                </CenteredColumn>
              </Column>

              {/* Past Pledges Section */}
              <Column $gap={4}>
                <SectionHeader>
                  <Title3>{t('Past Pledges')}</Title3>
                </SectionHeader>
              </Column>

              {pledgesLoading ? (
                <CenteredColumn style={{ flex: 1 }}>
                  <Gap $gap={48} />
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
                <ContentContainer>
                  {pastPledges.map((pledge) => (
                    <PastPledgeItem
                      key={pledge.id}
                      pledge={pledge}
                      onPress={() => handlePledgePress(pledge.id)}
                    />
                  ))}
                </ContentContainer>
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

const StatValue = styled(Title2)`
  color: ${({ theme }) => theme.colors.primary};
`;

const StatLabel = styled(BodySmallSecondary)`
  margin-top: 4px;
`;

const SectionHeader = styled.View`
  padding: 0 20px;
`;

const ContentContainer = styled.View`
  padding-bottom: 100px;
`;
