import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Pressable,
  View,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { getStatusBgColor, getStatusTextColor } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import {
  usePledge,
  useTodayProgress,
  useUpdateDailyProgress,
  useUpdatePledgeStatus,
  formatUsdcAmount,
  getDailyTasksForDate,
  getGoals,
  toLocalDateStr,
} from '@/hooks/useSupabase';
import { useProgram } from '@/hooks/useProgram';
import {
  Title1,
  Title3,
  Body,
  BodySecondary,
  BodySmall,
  ErrorText,
  ScreenContainer,
  Column,
  Row,
  Card,
  PrimaryButton,
  ErrorState,
  CenteredColumn,
  ProgressBar,
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
  const { theme } = useAppTheme();
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
  const updatePledgeStatus = useUpdatePledgeStatus();
  const { reportAndSettle } = useProgram();

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

      const today = toLocalDateStr(new Date());
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
    [completedTodos, id, updateProgress]
  );

  const today = toLocalDateStr(new Date());
  const dailyTasks = pledge
    ? getDailyTasksForDate(pledge.todos, today)
    : [];
  const goals = pledge ? getGoals(pledge.todos) : [];
  // Combined list: daily tasks first, then goals — indices match todos_completed
  const allTasks = [...dailyTasks, ...goals];

  const calculateProgress = (): number => {
    if (allTasks.length === 0) return 0;
    return Math.round((completedTodos.length / allTasks.length) * 100);
  };

  const handleReportAndSettle = async () => {
    if (!pledge || !walletAddress) return;

    const completionPct = calculateProgress();
    const finalStatus: 'Completed' | 'Forfeited' =
      completionPct > 0 ? 'Completed' : 'Forfeited';

    Alert.alert(
      t('Report Completion'),
      `${t('Completion')}: ${completionPct}%\n${t(
        'Your Refund'
      )}: $${formatUsdcAmount(
        Math.round(
          pledge.stake_amount *
            (completionPct / 100) *
            (completionPct === 100 ? 1 : 0.99)
        )
      )}`,
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Confirm'),
          onPress: async () => {
            setIsReporting(true);
            try {
              const signature = await reportAndSettle(
                pledge.on_chain_address,
                completionPct
              );
              await updatePledgeStatus.mutateAsync({
                pledgeId: pledge.id,
                status: finalStatus,
                completionPercentage: completionPct,
                settleTxSignature: signature,
              });
              refetch();
              Alert.alert(t('Success'), t('Pledge settled successfully'));
            } catch (err: any) {
              console.error('Report and settle error:', err);
              Alert.alert(t('Error'), err.message || 'Failed to settle pledge');
            } finally {
              setIsReporting(false);
            }
          },
        },
      ]
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
        <CenteredColumn flex={1}>
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
        <CenteredColumn flex={1}>
          <ErrorText>{t('Pledge not found')}</ErrorText>
        </CenteredColumn>
      </ScreenContainer>
    );
  }

  const progress = calculateProgress();

  return (
    <ScreenContainer style={{ flex: 1, gap: 24, paddingBottom: 32 }}>
      <Row>
        <Pressable
          onPress={() => router.back()}
          style={[
            localStyles.backButton,
            { backgroundColor: theme.colors.cardBackground },
          ]}
        >
          <Ionicons name='arrow-back' size={24} color={theme.colors.text} />
        </Pressable>
        <Column flex={1}>
          <Title1 numberOfLines={1}>{pledge.name}</Title1>
        </Column>
        <View
          style={[
            localStyles.statusBadge,
            { backgroundColor: getStatusBgColor(theme, pledge.status) },
          ]}
        >
          <BodySmall
            style={{
              color: getStatusTextColor(theme, pledge.status),
              fontWeight: '600',
            }}
          >
            {t(pledge.status)}
          </BodySmall>
        </View>
      </Row>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ width: '100%' }}
      >
        <Column gap={24}>
          {/* Info Card */}
          <Card>
            <View style={localStyles.infoRow}>
              <BodySecondary>{t('Pledged')}</BodySecondary>
              <Body>
                ${formatUsdcAmount(pledge.stake_amount)} {t('USDC')}
              </Body>
            </View>
            <View style={localStyles.infoRow}>
              <BodySecondary>{t('Deadline')}</BodySecondary>
              <Body>{formatDeadline(pledge.deadline)}</Body>
            </View>
            <View style={localStyles.infoRow}>
              <BodySecondary>{t('Time Remaining')}</BodySecondary>
              <Body>{formatTimeRemaining(pledge.deadline)}</Body>
            </View>
          </Card>

          {/* Progress */}
          <View style={localStyles.progressContainer}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Title3>{t('Progress')}</Title3>
              <Title3 style={{ color: theme.colors.primary }}>
                {progress}%
              </Title3>
            </Row>
            <ProgressBar
              progress={progress}
              height={12}
              style={{ marginTop: 8 }}
            />
          </View>

          {/* Tasks (daily + goals combined) */}
          {allTasks.length > 0 && (
            <Column gap={8}>
              <Title3 style={{ marginBottom: 8 }}>
                {t(dailyTasks.length > 0 ? "Today's Tasks" : 'Tasks')}
              </Title3>
              {allTasks.map((taskText, index) => {
                const completed = completedTodos.includes(index);
                return (
                  <Pressable
                    key={index}
                    style={[
                      localStyles.todoItem,
                      {
                        backgroundColor: completed
                          ? theme.colors.primaryAlpha10
                          : theme.colors.cardBackground,
                        borderColor: completed
                          ? theme.colors.primaryAlpha40
                          : theme.colors.border,
                      },
                    ]}
                    onPress={() =>
                      pledge.status === 'Active' && handleTodoToggle(index)
                    }
                    disabled={pledge.status !== 'Active'}
                  >
                    <View
                      style={[
                        localStyles.checkboxIcon,
                        {
                          borderColor: completed
                            ? theme.colors.primary
                            : theme.colors.border,
                          backgroundColor: completed
                            ? theme.colors.primary
                            : 'transparent',
                        },
                      ]}
                    >
                      {completed && (
                        <Ionicons
                          name='checkmark'
                          size={16}
                          color={theme.colors.iconOnPrimary}
                        />
                      )}
                    </View>
                    <Body
                      style={{
                        flex: 1,
                        textDecorationLine: completed
                          ? 'line-through'
                          : 'none',
                        opacity: completed ? 0.6 : 1,
                      }}
                    >
                      {taskText}
                    </Body>
                  </Pressable>
                );
              })}
            </Column>
          )}
        </Column>
      </ScrollView>

      {pledge.status === 'Active' && (
        <CenteredColumn>
          <PrimaryButton
            onPress={handleReportAndSettle}
            disabled={isReporting}
            loading={isReporting}
          >
            {t('Report Completion')}
          </PrimaryButton>
        </CenteredColumn>
      )}
    </ScreenContainer>
  );
};

const localStyles = StyleSheet.create({
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    gap: 24,
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  progressContainer: {
    marginBottom: 24,
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  checkboxIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
