import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
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
  useDailyProgress,
  useUpdateDailyProgress,
  useUpdatePledgeStatus,
  calculateCompletionPercentage,
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
  Slider,
  Checkbox,
  useAlert,
} from '@/components';

function formatDeadline(deadline: string): string {
  const date = new Date(deadline);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' ' + date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTimeRemaining(deadline: string, t: (key: string) => string): string {
  const date = new Date(deadline);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return t('Expired');
  } else if (diffDays === 0) {
    return t('Due today');
  } else if (diffDays === 1) {
    return `1 ${t('day left')}`;
  } else {
    return `${diffDays} ${t('days left')}`;
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
  const { data: allProgress, isLoading: progressLoading } =
    useDailyProgress(id);
  const updateProgress = useUpdateDailyProgress();
  const updatePledgeStatus = useUpdatePledgeStatus();
  const { reportAndSettle } = useProgram();

  const { alert } = useAlert();
  const [completedTodos, setCompletedTodos] = useState<number[]>([]);
  const [overrideProgress, setOverrideProgress] = useState<number | null>(null);
  const [isReporting, setIsReporting] = useState(false);

  // Initialize completed todos from today's progress
  const today = toLocalDateStr(new Date());
  useEffect(() => {
    if (allProgress) {
      const todayRecord = allProgress.find((p) => p.date === today);
      setCompletedTodos(todayRecord?.todos_completed || []);
    }
  }, [allProgress, today]);

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
    [completedTodos, id, updateProgress],
  );

  const dailyTasks = pledge ? getDailyTasksForDate(pledge.todos, today) : [];
  const goals = pledge ? getGoals(pledge.todos) : [];
  // Combined list: daily tasks first, then goals — indices match todos_completed
  const allTasks = [...dailyTasks, ...goals];

  const taskProgress = (): number => {
    if (!pledge || !allProgress) return 0;
    // Build progress array with today's local state for immediate feedback
    const progressWithLocalState = allProgress.map((p) =>
      p.date === today ? { ...p, todos_completed: completedTodos } : p
    );
    // If no record for today yet but user has checked items, add it
    if (completedTodos.length > 0 && !allProgress.find((p) => p.date === today)) {
      progressWithLocalState.push({
        id: '',
        pledge_id: pledge.id,
        date: today,
        todos_completed: completedTodos,
        created_at: '',
      });
    }
    return calculateCompletionPercentage(
      pledge.todos,
      progressWithLocalState,
      new Date(pledge.start_date),
      new Date(pledge.end_date)
    );
  };

  const progress = overrideProgress ?? taskProgress();

  // Reset override when todos change so slider stays in sync
  useEffect(() => {
    setOverrideProgress(null);
  }, [completedTodos.length]);

  const handleReportAndSettle = async () => {
    if (!pledge || !walletAddress) return;

    const completionPct = progress;
    const finalStatus: 'Completed' | 'Forfeited' =
      completionPct > 0 ? 'Completed' : 'Forfeited';

    alert({
      title: t('Report Completion'),
      message: `${t('Completion')}: ${completionPct}%\n${t(
        'Your Refund',
      )}: $${formatUsdcAmount(
        Math.round(
          pledge.stake_amount *
            (completionPct / 100) *
            (completionPct === 100 ? 1 : 0.99),
        ),
      )}`,
      buttons: [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Confirm'),
          onPress: async () => {
            setIsReporting(true);
            try {
              const signature = await reportAndSettle(
                pledge.on_chain_address,
                completionPct,
              );
              await updatePledgeStatus.mutateAsync({
                pledgeId: pledge.id,
                status: finalStatus,
                completionPercentage: completionPct,
                settleTxSignature: signature,
              });
              refetch();
              alert({ title: t('Success'), message: t('Pledge settled successfully') });
            } catch (err: any) {
              console.error('Report and settle error:', err);
              alert({ title: t('Error'), message: err.message || t('Something went wrong') });
            } finally {
              setIsReporting(false);
            }
          },
        },
      ],
    });
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

  return (
    <ScreenContainer style={{ flex: 1, gap: 24, paddingBottom: 32 }}>
      <Row>
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.backButton,
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
            styles.statusBadge,
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
            <View style={styles.infoRow}>
              <BodySecondary>{t('Pledged')}</BodySecondary>
              <Body>
                ${formatUsdcAmount(pledge.stake_amount)} {t('USDC')}
              </Body>
            </View>
            <View style={styles.infoRow}>
              <BodySecondary>{t('Deadline')}</BodySecondary>
              <Body>{formatDeadline(pledge.deadline)}</Body>
            </View>
            <View style={styles.infoRow}>
              <BodySecondary>{t('Time Remaining')}</BodySecondary>
              <Body>{formatTimeRemaining(pledge.deadline, t)}</Body>
            </View>
          </Card>

          {/* Progress */}
          <View style={styles.progressContainer}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Title3>{t('Progress')}</Title3>
              <Title3 style={{ color: theme.colors.primary }}>
                {progress}%
              </Title3>
            </Row>
            <Slider
              value={progress}
              onValueChange={(v) => setOverrideProgress(Math.round(v))}
              disabled={pledge.status !== 'Active'}
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
                      styles.todoItem,
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
                    <Checkbox checked={completed} />
                    <Body
                      style={{
                        flex: 1,
                        textDecorationLine: completed ? 'line-through' : 'none',
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
          {new Date(pledge.deadline) <= new Date() ? (
            <PrimaryButton
              onPress={handleReportAndSettle}
              disabled={isReporting}
              loading={isReporting}
            >
              {t('Report Completion')}
            </PrimaryButton>
          ) : (
            <BodySecondary style={{ textAlign: 'center' }}>
              {t('You can report after {{deadline}}', { deadline: formatDeadline(pledge.deadline) })}
            </BodySecondary>
          )}
        </CenteredColumn>
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
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
    gap: 8,
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
});
