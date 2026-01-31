import {
  ActivityIndicator,
  RefreshControl,
  Pressable,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'styled-components/native';
import styled from 'styled-components/native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import {
  useActivePledges,
  formatUsdcAmount,
  Pledge,
} from '@/hooks/useSupabase';
import {
  Title1,
  Title2,
  Title3,
  BodySecondary,
  BodySmall,
  BodySmallSecondary,
  ErrorText,
  MonoText,
  ScreenContainer,
  CenteredColumn,
  Column,
  Row,
  Card,
  PrimaryButton,
  ButtonText,
  TrackedScrollView,
} from '@/components';

// Styled components for this screen
const Header = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 60px 20px 20px 20px;
`;

const WalletBadge = styled.Pressable`
  flex-direction: row;
  align-items: center;
  background-color: ${({ theme }) => theme.colors.cardBackground};
  padding: 8px 12px;
  border-radius: 20px;
  gap: 6px;
`;

const PledgeCard = styled(Card)`
  margin-bottom: 12px;
`;

const StatusBadge = styled.View<{ $status: string }>`
  padding: 4px 8px;
  border-radius: 12px;
  background-color: ${({ theme, $status }) => {
    switch ($status) {
      case 'Active':
        return theme.colors.primaryAlpha20;
      case 'Completed':
        return theme.colors.statusCompletedBg;
      case 'Forfeited':
        return theme.colors.statusForfeitedBg;
      default:
        return theme.colors.cardBackground;
    }
  }};
`;

const StatusText = styled(BodySmall)<{ $status: string }>`
  color: ${({ theme, $status }) => {
    switch ($status) {
      case 'Active':
        return theme.colors.primary;
      case 'Completed':
        return theme.colors.statusCompleted;
      case 'Forfeited':
        return theme.colors.statusForfeited;
      default:
        return theme.colors.text;
    }
  }};
  font-weight: 600;
`;

const ProgressBar = styled.View`
  height: 6px;
  background-color: ${({ theme }) => theme.colors.border};
  border-radius: 3px;
  overflow: hidden;
  margin-top: 12px;
`;

const ProgressFill = styled.View<{ $progress: number }>`
  height: 100%;
  width: ${({ $progress }) => $progress}%;
  background-color: ${({ theme }) => theme.colors.primary};
  border-radius: 3px;
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

const EmptyStateContainer = styled(CenteredColumn)`
  flex: 1;
  padding: 40px 20px;
`;

const ContentContainer = styled.View`
  flex: 1;
  padding: 0 20px 100px 20px;
`;

function formatDeadline(deadline: string): string {
  const date = new Date(deadline);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return 'Expired';
  } else if (diffDays === 0) {
    return 'Due today';
  } else if (diffDays === 1) {
    return 'Due tomorrow';
  } else if (diffDays <= 7) {
    return `${diffDays} days left`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

function PledgeListItem({
  pledge,
  onPress,
}: {
  pledge: Pledge;
  onPress: () => void;
}) {
  const { t } = useTranslation();

  // Calculate progress based on time elapsed (simplified - will improve with daily progress)
  const startDate = new Date(pledge.start_date);
  const endDate = new Date(pledge.deadline);
  const now = new Date();
  const totalDays = Math.max(
    1,
    Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    ),
  );
  const elapsedDays = Math.max(
    0,
    Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const timeProgress = Math.min(
    100,
    Math.round((elapsedDays / totalDays) * 100),
  );

  return (
    <Pressable onPress={onPress}>
      <PledgeCard>
        <Row
          style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Column style={{ flex: 1 }}>
            <Title3>{pledge.name}</Title3>
            <BodySmallSecondary style={{ marginTop: 4 }}>
              {formatDeadline(pledge.deadline)}
            </BodySmallSecondary>
          </Column>
          <StatusBadge $status={pledge.status}>
            <StatusText $status={pledge.status}>{t(pledge.status)}</StatusText>
          </StatusBadge>
        </Row>

        <Row style={{ marginTop: 12, justifyContent: 'space-between' }}>
          <BodySecondary>
            {t('Staked')}: ${formatUsdcAmount(pledge.stake_amount)}
          </BodySecondary>
          <BodySmall>
            {pledge.todos?.length || 0} {t('tasks')}
          </BodySmall>
        </Row>

        <ProgressBar>
          <ProgressFill $progress={timeProgress} />
        </ProgressBar>
      </PledgeCard>
    </Pressable>
  );
}

function EmptyState({ onCreatePress }: { onCreatePress: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <EmptyStateContainer $gap={16}>
      <Ionicons
        name='flag-outline'
        size={64}
        color={theme.colors.textSecondary}
      />
      <Title2 style={{ textAlign: 'center' }}>{t('No active pledges')}</Title2>
      <BodySecondary style={{ textAlign: 'center', maxWidth: 280 }}>
        {t(
          'Create your first pledge to start achieving your goals with skin in the game.',
        )}
      </BodySecondary>
      <PrimaryButton onPress={onCreatePress} style={{ marginTop: 16 }}>
        <ButtonText>{t('Create Pledge')}</ButtonText>
      </PrimaryButton>
    </EmptyStateContainer>
  );
}

function ConnectWalletScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { isConnecting, error, connect } = useAuth();

  return (
    <ScreenContainer>
      <CenteredColumn $gap={16}>
        <Ionicons
          name='wallet-outline'
          size={64}
          color={theme.colors.primary}
        />
        <Title1>{t('Pledge')}</Title1>
        <BodySecondary style={{ textAlign: 'center', maxWidth: 280 }}>
          {t('Stake on your goals. Connect your Solana wallet to get started.')}
        </BodySecondary>

        <PrimaryButton
          onPress={connect}
          disabled={isConnecting}
          style={{ marginTop: 24, opacity: isConnecting ? 0.6 : 1 }}
        >
          {isConnecting ? (
            <ActivityIndicator size='small' color={theme.colors.iconOnPrimary} />
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
    </ScreenContainer>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { user, walletAddress, isLoading: authLoading, disconnect } = useAuth();
  const {
    data: pledges,
    isLoading: pledgesLoading,
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
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Header>
        <Title1>{t('My Pledges')}</Title1>
        <WalletBadge onPress={disconnect}>
          <Ionicons name='wallet' size={16} color={theme.colors.primary} />
          <MonoText style={{ fontSize: 12 }}>
            {walletAddress?.slice(0, 4)}...{walletAddress?.slice(-4)}
          </MonoText>
        </WalletBadge>
      </Header>

      {pledgesLoading ? (
        <ScreenContainer>
          <ActivityIndicator size='large' color={theme.colors.primary} />
        </ScreenContainer>
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
          <ContentContainer>
            {pledges.map((pledge) => (
              <PledgeListItem
                key={pledge.id}
                pledge={pledge}
                onPress={() => handlePledgePress(pledge.id)}
              />
            ))}
          </ContentContainer>
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
          <Ionicons name='add' size={28} color={theme.colors.iconOnPrimary} />
        </FAB>
      )}
    </View>
  );
}
