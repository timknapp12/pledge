import { useState, useEffect, useCallback, useMemo } from 'react';
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
  getEffectiveStatus,
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
  Slider,
  Checkbox,
  DateCarousel,
  useAlert,
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
  const { data: allProgress, isLoading: progressLoading } =
    useDailyProgress(id);
  const updateProgress = useUpdateDailyProgress();
  const updatePledgeStatus = useUpdatePledgeStatus();
  const { reportAndSettle } = useProgram();

  const { alert } = useAlert();
  const [completedTodos, setCompletedTodos] = useState<number[]>([]);
  const [overrideProgress, setOverrideProgress] = useState<number | null>(null);
  const [isReporting, setIsReporting] = useState(false);

  const today = toLocalDateStr(new Date());
  const effectiveStatus = pledge ? getEffectiveStatus(pledge) : null;

  // Determine if pledge has daily tasks
  const hasDailyTasks = useMemo(() => {
    if (!pledge) return false;
    return Object.keys(pledge.todos.daily).length > 0;
  }, [pledge]);

  // Default selected date: today if active and today is within range, else last day of pledge
  const defaultDate = useMemo(() => {
    if (!pledge) return today;
    const endDate = toLocalDateStr(new Date(pledge.end_date));
    if (effectiveStatus !== 'Active' || today > endDate) {
      return endDate;
    }
    const startDate = toLocalDateStr(new Date(pledge.start_date));
    if (today < startDate) return startDate;
    return today;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pledge, today]);

  const [selectedDate, setSelectedDate] = useState(defaultDate);

  // Update selectedDate when defaultDate changes (e.g. pledge loads)
  useEffect(() => {
    setSelectedDate(defaultDate);
  }, [defaultDate]);

  // Editable on today or yesterday (24h grace period), only while pledge is Active
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toLocalDateStr(d);
  }, []);

  const isSelectedDateEditable =
    (selectedDate === today || selectedDate === yesterdayStr) &&
    effectiveStatus === 'Active';

  // Initialize completed todos from selected date's progress
  useEffect(() => {
    if (allProgress) {
      const dateRecord = allProgress.find((p) => p.date === selectedDate);
      setCompletedTodos(dateRecord?.todos_completed || []);
    }
  }, [allProgress, selectedDate]);

  const handleTodoToggle = useCallback(
    async (index: number) => {
      if (!id || !isSelectedDateEditable) return;

      const newCompleted = completedTodos.includes(index)
        ? completedTodos.filter((i) => i !== index)
        : [...completedTodos, index];

      setCompletedTodos(newCompleted);

      try {
        await updateProgress.mutateAsync({
          pledgeId: id,
          date: selectedDate,
          todosCompleted: newCompleted,
        });
      } catch (err) {
        console.error('Failed to update progress:', err);
        // Revert on error
        setCompletedTodos(completedTodos);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [completedTodos, id, updateProgress, isSelectedDateEditable, today],
  );

  // Tasks for the selected date
  const dailyTasks = pledge
    ? getDailyTasksForDate(pledge.todos, selectedDate)
    : [];
  const goals = pledge ? getGoals(pledge.todos) : [];
  // For today: daily tasks first, then goals — indices match todos_completed
  // For past dates: daily tasks only (goals are shown read-only separately)
  const isToday = selectedDate === today;
  const taskList = isToday ? [...dailyTasks, ...goals] : dailyTasks;

  const taskProgress = (): number => {
    if (!pledge || !allProgress) return 0;
    // Build progress array with today's local state for immediate feedback
    const progressWithLocalState = allProgress.map((p) =>
      p.date === today ? { ...p, todos_completed: completedTodos } : p,
    );
    // If no record for today yet but user has checked items, add it
    if (
      completedTodos.length > 0 &&
      !allProgress.find((p) => p.date === today)
    ) {
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
      new Date(pledge.end_date),
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
              alert({
                title: t('Success'),
                message: t('Pledge settled successfully'),
              });
            } catch (err: any) {
              console.error('Report and settle error:', err);
              alert({
                title: t('Error'),
                message: err.message || 'Failed to settle pledge',
              });
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

  // Get completed todos for selected date from allProgress (for read-only past days)
  const selectedDateProgress = allProgress?.find(
    (p) => p.date === selectedDate,
  );
  const readOnlyCompleted = selectedDateProgress?.todos_completed || [];

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
            { backgroundColor: getStatusBgColor(theme, effectiveStatus!) },
          ]}
        >
          <BodySmall
            style={{
              color: getStatusTextColor(theme, effectiveStatus!),
              fontWeight: '600',
            }}
          >
            {t(effectiveStatus!)}
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
              <Body>{formatTimeRemaining(pledge.deadline)}</Body>
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
            {hasDailyTasks || effectiveStatus !== 'Active' ? (
              <ProgressBar progress={progress} height={12} />
            ) : (
              <Slider
                value={progress}
                onValueChange={(v) => setOverrideProgress(Math.round(v))}
              />
            )}
          </View>

          {/* Date Carousel — only for pledges with daily tasks */}
          {hasDailyTasks && (
            <DateCarousel
              startDate={pledge.start_date}
              endDate={pledge.end_date}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          )}

          {/* Daily Tasks for selected date */}
          {taskList.length > 0 && (
            <Column gap={8}>
              <Title3 style={{ marginBottom: 8 }}>
                {isToday ? t("Today's Tasks") : t('Tasks')}
              </Title3>
              {taskList.map((taskText, index) => {
                const completed = isSelectedDateEditable
                  ? completedTodos.includes(index)
                  : readOnlyCompleted.includes(index);
                return isSelectedDateEditable ? (
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
                    onPress={() => handleTodoToggle(index)}
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
                ) : (
                  <View
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
                  >
                    <Ionicons
                      name={completed ? 'checkmark-circle' : 'close-circle'}
                      size={20}
                      color={
                        completed ? theme.colors.primary : theme.colors.error
                      }
                    />
                    <Body
                      style={{
                        flex: 1,
                        textDecorationLine: completed ? 'line-through' : 'none',
                        opacity: completed ? 0.6 : 1,
                      }}
                    >
                      {taskText}
                    </Body>
                  </View>
                );
              })}
            </Column>
          )}

          {/* Goals (read-only display on non-today dates) */}
          {!isToday && goals.length > 0 && (
            <Column gap={8}>
              <Title3 style={{ marginBottom: 8 }}>{t('Goals')}</Title3>
              {goals.map((goalText, index) => (
                <View
                  key={`goal-${index}`}
                  style={[
                    styles.todoItem,
                    {
                      backgroundColor: theme.colors.cardBackground,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name='flag-outline'
                    size={18}
                    color={theme.colors.textSecondary}
                  />
                  <Body style={{ flex: 1 }}>{goalText}</Body>
                </View>
              ))}
            </Column>
          )}

          {/* No tasks message for selected date */}
          {taskList.length === 0 && goals.length === 0 && (
            <CenteredColumn>
              <BodySecondary>
                {t(isToday ? 'No tasks for today' : 'No tasks for this day')}
              </BodySecondary>
            </CenteredColumn>
          )}
        </Column>
      </ScrollView>

      {effectiveStatus === 'Active' && (
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

const styles = StyleSheet.create({
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
