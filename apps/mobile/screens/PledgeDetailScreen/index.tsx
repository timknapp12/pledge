import { useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'styled-components/native';
import styled from 'styled-components/native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import {
  usePledge,
  useTodayProgress,
  useUpdateDailyProgress,
  formatUsdcAmount,
} from '@/hooks/useSupabase';
import { useProgram } from '@/hooks/useProgram';
import {
  Title1,
  Title3,
  Body,
  BodySecondary,
  BodySmall,
  BodySmallSecondary,
  ErrorText,
  ScreenContainer,
  Column,
  Row,
  Card,
  PrimaryButton,
  ErrorState,
  CenteredColumn,
} from '@/components';

function formatDeadline(deadline: string): string {
  const date = new Date(deadline);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimeRemaining(deadline: string): string {
  const date = new Date(deadline);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return 'Expired';
  } else if (diffDays === 0) {
    return 'Due today';
  } else if (diffDays === 1) {
    return '1 day left';
  } else {
    return `${diffDays} days left`;
  }
}

export const PledgeDetailScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { walletAddress } = useAuth();

  const {
    data: pledge,
    isLoading: pledgeLoading,
    isError,
    error,
    refetch,
  } = usePledge(id);
  const { data: todayProgress, isLoading: progressLoading } =
    useTodayProgress(id);
  const updateProgress = useUpdateDailyProgress();
  const { reportCompletion } = useProgram();

  const [completedTodos, setCompletedTodos] = useState<number[]>([]);
  const [isReporting, setIsReporting] = useState(false);

  // Initialize completed todos from today's progress
  useEffect(() => {
    if (todayProgress && todayProgress.length > 0) {
      setCompletedTodos(todayProgress[0].todos_completed || []);
    }
  }, [todayProgress]);

  const handleTodoToggle = useCallback(
    async (index: number) => {
      if (!id) return;

      const newCompleted = completedTodos.includes(index)
        ? completedTodos.filter((i) => i !== index)
        : [...completedTodos, index];

      setCompletedTodos(newCompleted);

      const today = new Date().toISOString().split('T')[0];
      try {
        await updateProgress.mutateAsync({
          pledgeId: id,
          date: today,
          todosCompleted: newCompleted,
        });
      } catch (err) {
        console.error('Failed to update progress:', err);
        // Revert on error
        setCompletedTodos(completedTodos);
      }
    },
    [completedTodos, id, updateProgress],
  );

  const calculateProgress = (): number => {
    if (!pledge?.todos || pledge.todos.length === 0) return 0;
    return Math.round((completedTodos.length / pledge.todos.length) * 100);
  };

  const handleReportCompletion = async () => {
    if (!pledge || !walletAddress) return;

    const completionPct = calculateProgress();

    Alert.alert(
      t('Report Completion'),
      `${t('Completion')}: ${completionPct}%\n${t(
        'Your Refund',
      )}: $${formatUsdcAmount(
        Math.round(
          pledge.stake_amount *
            (completionPct / 100) *
            (completionPct === 100 ? 1 : 0.99),
        ),
      )}`,
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Confirm'),
          onPress: async () => {
            setIsReporting(true);
            try {
              await reportCompletion(pledge.on_chain_address, completionPct);
              refetch();
              Alert.alert(t('Success'), t('Completion reported successfully'));
            } catch (err: any) {
              console.error('Report completion error:', err);
              Alert.alert(
                t('Error'),
                err.message || 'Failed to report completion',
              );
            } finally {
              setIsReporting(false);
            }
          },
        },
      ],
    );
  };

  if (pledgeLoading || progressLoading) {
    return (
      <ScreenContainer>
        <ActivityIndicator size='large' color={theme.colors.primary} />
      </ScreenContainer>
    );
  }

  if (isError) {
    return (
      <ScreenContainer>
        <CenteredColumn style={{ flex: 1, justifyContent: 'center' }}>
          <ErrorState
            message={error instanceof Error ? error.message : undefined}
            onRetry={refetch}
          />
        </CenteredColumn>
      </ScreenContainer>
    );
  }

  if (!pledge) {
    return (
      <ScreenContainer>
        <CenteredColumn style={{ flex: 1, justifyContent: 'center' }}>
          <ErrorText>{t('Pledge not found')}</ErrorText>
        </CenteredColumn>
      </ScreenContainer>
    );
  }

  const progress = calculateProgress();
  const isExpired = new Date(pledge.deadline) < new Date();
  const canReport = pledge.status === 'Active' && isExpired;

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <Header>
        <BackButton onPress={() => router.back()}>
          <Ionicons name='arrow-back' size={24} color={theme.colors.text} />
        </BackButton>
        <Column style={{ flex: 1 }}>
          <Title1 numberOfLines={1}>{pledge.name}</Title1>
        </Column>
        <StatusBadge $status={pledge.status}>
          <StatusText $status={pledge.status}>{t(pledge.status)}</StatusText>
        </StatusBadge>
      </Header>

      <ScrollView showsVerticalScrollIndicator={false}>
        <ContentContainer>
          {/* Info Card */}
          <InfoCard>
            <InfoRow>
              <BodySecondary>{t('Staked')}</BodySecondary>
              <Body>
                ${formatUsdcAmount(pledge.stake_amount)} {t('USDC')}
              </Body>
            </InfoRow>
            <InfoRow>
              <BodySecondary>{t('Deadline')}</BodySecondary>
              <Body>{formatDeadline(pledge.deadline)}</Body>
            </InfoRow>
            <InfoRow>
              <BodySecondary>{t('Time Remaining')}</BodySecondary>
              <Body>{formatTimeRemaining(pledge.deadline)}</Body>
            </InfoRow>
          </InfoCard>

          {/* Progress */}
          <ProgressContainer>
            <Row style={{ justifyContent: 'space-between' }}>
              <Title3>{t('Progress')}</Title3>
              <Title3 style={{ color: theme.colors.primary }}>
                {progress}%
              </Title3>
            </Row>
            <ProgressBar>
              <ProgressFill $progress={progress} />
            </ProgressBar>
          </ProgressContainer>

          {/* Today's Tasks */}
          <Column $gap={8}>
            <Title3 style={{ marginBottom: 8 }}>{t("Today's Tasks")}</Title3>
            {pledge.todos?.map((todo, index) => (
              <TodoItem
                key={index}
                $completed={completedTodos.includes(index)}
                onPress={() =>
                  pledge.status === 'Active' && handleTodoToggle(index)
                }
                disabled={pledge.status !== 'Active'}
              >
                <CheckboxIcon $completed={completedTodos.includes(index)}>
                  {completedTodos.includes(index) && (
                    <Ionicons
                      name='checkmark'
                      size={16}
                      color={theme.colors.iconOnPrimary}
                    />
                  )}
                </CheckboxIcon>
                <TodoText $completed={completedTodos.includes(index)}>
                  {todo.text}
                </TodoText>
              </TodoItem>
            ))}
          </Column>
        </ContentContainer>
      </ScrollView>

      {pledge.status === 'Active' && (
        <ButtonContainer>
          {canReport ? (
            <PrimaryButton
              onPress={handleReportCompletion}
              disabled={isReporting}
              loading={isReporting}
            >
              {t('Report Completion')}
            </PrimaryButton>
          ) : (
            <BodySmallSecondary style={{ textAlign: 'center' }}>
              {t('Complete your tasks daily. Report after deadline.')}
            </BodySmallSecondary>
          )}
        </ButtonContainer>
      )}
    </ScreenContainer>
  );
};

const Header = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 60px 20px 20px 20px;
  gap: 16px;
`;

const BackButton = styled.Pressable`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background-color: ${({ theme }) => theme.colors.cardBackground};
  align-items: center;
  justify-content: center;
`;

const ContentContainer = styled.View`
  padding: 0 20px 100px 20px;
`;

const StatusBadge = styled.View<{ $status: string }>`
  padding: 6px 12px;
  border-radius: 16px;
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

const InfoCard = styled(Card)`
  margin-bottom: 16px;
`;

const InfoRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  padding: 8px 0;
`;

const ProgressContainer = styled.View`
  margin-bottom: 24px;
`;

const ProgressBar = styled.View`
  height: 12px;
  background-color: ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  overflow: hidden;
  margin-top: 8px;
`;

const ProgressFill = styled.View<{ $progress: number }>`
  height: 100%;
  width: ${({ $progress }) => $progress}%;
  background-color: ${({ theme }) => theme.colors.primary};
  border-radius: 6px;
`;

const TodoItem = styled.Pressable<{ $completed: boolean }>`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background-color: ${({ theme, $completed }) =>
    $completed ? theme.colors.primaryAlpha10 : theme.colors.cardBackground};
  border-radius: 12px;
  margin-bottom: 8px;
  border-width: 1px;
  border-color: ${({ theme, $completed }) =>
    $completed ? theme.colors.primaryAlpha40 : theme.colors.border};
`;

const TodoText = styled(Body)<{ $completed: boolean }>`
  flex: 1;
  text-decoration-line: ${({ $completed }) =>
    $completed ? 'line-through' : 'none'};
  opacity: ${({ $completed }) => ($completed ? 0.6 : 1)};
`;

const CheckboxIcon = styled.View<{ $completed: boolean }>`
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border-width: 2px;
  border-color: ${({ theme, $completed }) =>
    $completed ? theme.colors.primary : theme.colors.border};
  background-color: ${({ theme, $completed }) =>
    $completed ? theme.colors.primary : 'transparent'};
  align-items: center;
  justify-content: center;
`;

const ButtonContainer = styled.View`
  padding: 20px;
  gap: 12px;
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
`;
