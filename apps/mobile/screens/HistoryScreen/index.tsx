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
} from '@/components';
import { PastPledgeItem } from './PastPledgeItem';
import { EmptyState } from './EmptyState';

const Header = styled.View`
  padding: 60px 20px 20px 20px;
`;

const StatsContainer = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  padding: 0 20px;
  gap: 12px;
  margin-bottom: 24px;
`;

const StatCard = styled(Card)`
  flex: 1;
  min-width: 45%;
  align-items: center;
`;

const StatValue = styled(Title2)`
  color: ${({ theme }) => theme.colors.primary};
`;

const StatLabel = styled(BodySmallSecondary)`
  margin-top: 4px;
`;

const SectionHeader = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  margin-bottom: 12px;
`;

const ContentContainer = styled.View`
  padding-bottom: 100px;
`;

export const HistoryScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const {
    data: allPledges,
    isLoading: pledgesLoading,
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
        <Header>
          <Title1>{t('History')}</Title1>
        </Header>

        {/* Stats Section */}
        <SectionHeader>
          <Title3>{t('Stats')}</Title3>
        </SectionHeader>
        <StatsContainer>
          <StatCard>
            <StatValue>${formatUsdcAmount(totalPledged)}</StatValue>
            <StatLabel>{t('Total Pledged')}</StatLabel>
          </StatCard>
          <StatCard>
            <StatValue>{successRate}%</StatValue>
            <StatLabel>{t('Success Rate')}</StatLabel>
          </StatCard>
        </StatsContainer>

        {/* Past Pledges Section */}
        <SectionHeader>
          <Title3>{t('Past Pledges')}</Title3>
        </SectionHeader>

        {pledgesLoading ? (
          <ScreenContainer>
            <ActivityIndicator size='large' color={theme.colors.primary} />
          </ScreenContainer>
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
      </TrackedScrollView>
    </ScreenContainer>
  );
};
