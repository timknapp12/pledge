import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Pressable,
  View,
  StyleSheet,
  Platform,
} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
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
  useUpdateGoalCompletion,
  useUpdatePledgeStatus,
  useUpdatePledge,
  calculateCompletionPercentage,
  formatUsdcAmount,
  getDailyTasksForDate,
  getGoals,
  toLocalDateStr,
  type PledgeTodos,
  type ReminderSettings,
} from '@/hooks/useSupabase';
import { useProgram } from '@/hooks/useProgram';
import { useTxFlow } from '@/contexts/TxFlowContext';
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
  Slider,
  Checkbox,
  useAlert,
  useToast,
} from '@/components';
import { EditPledgeSheet, GracePeriodInfoSheet } from '@/components/sheets';
import { isUserCancellation, getTransactionErrorMessage } from '@/lib/errors';

function formatDeadline(deadline: string): string {
  const date = new Date(deadline);
  return (
    date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) +
    ' ' +
    date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  );
}

function formatTimeRemaining(
  deadline: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): { text: string; isPastDue: boolean } {
  const deadlineDate = new Date(deadline);
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round(
    (startOfDay(deadlineDate) - startOfDay(now)) / (1000 * 60 * 60 * 24),
  );

  if (dayDiff > 1) {
    return { text: `${dayDiff} ${t('days left')}`, isPastDue: false };
  }
  if (dayDiff === 1) {
    return { text: `1 ${t('day left')}`, isPastDue: false };
  }
  if (dayDiff === 0) {
    return deadlineDate.getTime() < now.getTime()
      ? { text: t('Past due'), isPastDue: true }
      : { text: t('Due today'), isPastDue: false };
  }
  if (dayDiff === -1) {
    return { text: t('Due yesterday'), isPastDue: true };
  }
  return {
    text: t('{{count}} days overdue', { count: -dayDiff }),
    isPastDue: true,
  };
}

/** Count tasks scheduled for dates strictly after today */
function countFutureTasks(todos: PledgeTodos): number {
  const todayStr = toLocalDateStr(new Date());
  let count = 0;
  for (const [dateStr, tasks] of Object.entries(todos.daily)) {
    if (dateStr > todayStr) {
      count += tasks.length;
    }
  }
  return count;
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
  const updateGoal = useUpdateGoalCompletion();
  const updatePledgeStatus = useUpdatePledgeStatus();
  const { reportAndSettle } = useProgram();
  const updatePledge = useUpdatePledge();
  const { beginFlow, setStep, endFlow } = useTxFlow();
  const editSheetRef = useRef<BottomSheet>(null);
  const graceSheetRef = useRef<BottomSheet>(null);

  const { alert } = useAlert();
  const { toast } = useToast();
  const [completedTodos, setCompletedTodos] = useState<number[]>([]);
  const [completedGoals, setCompletedGoals] = useState<boolean[]>([]);
  const [overrideProgress, setOverrideProgress] = useState<number | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const isCompletionBusy = updateProgress.isPending || updateGoal.isPending || isReporting;

  // Initialize completed todos from today's progress (daily) and pledge.goals_completed (goals)
  const today = toLocalDateStr(new Date());
  useEffect(() => {
    if (allProgress) {
      const todayRecord = allProgress.find((p) => p.date === today);
      setCompletedTodos(todayRecord?.todos_completed || []);
    }
  }, [allProgress, today]);

  useEffect(() => {
    if (pledge) {
      setCompletedGoals(pledge.goals_completed ?? []);
    }
  }, [pledge]);

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
        setCompletedTodos(completedTodos);
        toast({
          message: t("Couldn't save progress. Please try again."),
          variant: 'error',
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [completedTodos, id, updateProgress],
  );

  const handleGoalToggle = useCallback(
    async (index: number) => {
      if (!id || !pledge) return;
      const next = [...completedGoals];
      while (next.length <= index) next.push(false);
      next[index] = !next[index];
      setCompletedGoals(next);
      try {
        await updateGoal.mutateAsync({ pledgeId: id, goalsCompleted: next });
      } catch (err) {
        console.error('Failed to update goal:', err);
        setCompletedGoals(completedGoals);
        toast({
          message: t("Couldn't save progress. Please try again."),
          variant: 'error',
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [completedGoals, id, pledge, updateGoal],
  );

  const dailyTasks = pledge ? getDailyTasksForDate(pledge.todos, today) : [];
  const goals = pledge ? getGoals(pledge.todos) : [];

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
        user_id: pledge.user_id,
        date: today,
        todos_completed: completedTodos,
        created_at: '',
        updated_at: '',
      });
    }
    // Through-today completion: only counts days up to today. The slider
    // overrides this for past/present claims. Future-task dock is applied
    // separately at settle time so the user cannot override it via the slider.
    return calculateCompletionPercentage(
      pledge.todos,
      completedGoals,
      progressWithLocalState,
      new Date(pledge.start_date),
      new Date(pledge.end_date),
    );
  };

  const progress = overrideProgress ?? taskProgress();

  // Reset override when todos change so slider stays in sync
  useEffect(() => {
    setOverrideProgress(null);
  }, [completedTodos.length, completedGoals]);

  const executeSettlement = async (
    completionPct: number,
    earlyTaskCount?: number,
    earlyGoalOnly?: boolean,
  ) => {
    if (!pledge || !walletAddress) return;

    const finalStatus: 'Completed' | 'Forfeited' =
      completionPct > 0 ? 'Completed' : 'Forfeited';

    const refund = Math.round(
      pledge.stake_amount *
        (completionPct / 100) *
        (completionPct === 100 ? 1 : 0.99),
    );

    const isEarlyDaily = earlyTaskCount !== undefined && earlyTaskCount > 0;
    const isEarly = isEarlyDaily || !!earlyGoalOnly;
    let earlyWarning = '';
    if (isEarlyDaily) {
      earlyWarning =
        t(
          'You still have {{count}} tasks scheduled. Settling now means those count as incomplete and will reduce your return.',
          { count: earlyTaskCount },
        ) + '\n\n';
    } else if (earlyGoalOnly) {
      earlyWarning =
        t(
          'Your refund is based on the goals you have checked off and the position of the progress bar. Confirm those reflect your actual progress before settling.',
        ) + '\n\n';
    }
    const calc = `${t('Completion')}: ${completionPct}%\n${t(
      'Your Refund',
    )}: $${formatUsdcAmount(refund)}`;

    alert({
      title: isEarly ? t('Settle Early?') : t('Report Completion'),
      message: earlyWarning + calc,
      buttons: [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: isEarly ? t('Settle Now') : t('Confirm'),
          onPress: async () => {
            setIsReporting(true);
            beginFlow({ title: t('Settling your pledge'), step: 'wallet' });
            try {
              const signature = await reportAndSettle(
                pledge.on_chain_address,
                completionPct,
              );
              // iOS Phantom deep-link returns trigger Expo Router to reset
              // the stack to the home tab. Re-push this screen so the user
              // lands back here to see the settlement result. The overlay
              // hides the flash while this happens.
              if (Platform.OS === 'ios') {
                router.push({
                  pathname: '/pledge/[id]',
                  params: { id: pledge.id },
                });
              }
              setStep('saving');
              await updatePledgeStatus.mutateAsync({
                pledgeId: pledge.id,
                status: finalStatus,
                completionPercentage: completionPct,
                settleTxSignature: signature,
              });
              // Await the refetch so the overlay stays up until the screen
              // renders the resolved status — no stale-data flash.
              await refetch();
              endFlow(150);
              toast({
                message: t('Pledge settled successfully'),
                variant: 'success',
              });
            } catch (err: any) {
              console.error('Report and settle error:', err);
              endFlow();
              if (!isUserCancellation(err)) {
                const message = getTransactionErrorMessage(err);
                alert({ title: t('Error'), message: t(message!) });
              }
            } finally {
              setIsReporting(false);
            }
          },
        },
      ],
    });
  };

  const handleReportAndSettle = async () => {
    if (!pledge || !walletAddress || !allProgress) return;

    // The slider (`progress`, with override) controls the through-today claim.
    // Future-day tasks are deducted automatically: actual = slider * (today / total).
    // This makes it impossible to override the future-task dock — sliding to
    // 100% claims 100% of past/present, but no more than that.
    const deadlinePassed = new Date(pledge.deadline) <= new Date();
    const futureTasks = deadlinePassed ? 0 : countFutureTasks(pledge.todos);

    let settlementPct = progress;
    if (futureTasks > 0) {
      const todayStr = toLocalDateStr(new Date());
      let nToday = 0;
      let nTotal = 0;
      for (const [dateStr, tasks] of Object.entries(pledge.todos.daily)) {
        nTotal += tasks.length;
        if (dateStr <= todayStr) nToday += tasks.length;
      }
      // Goals are per-pledge (not date-bound) and never get future-docked
      nToday += pledge.todos.goals.length;
      nTotal += pledge.todos.goals.length;
      if (nTotal > 0) {
        settlementPct = Math.round((progress / 100) * (nToday / nTotal) * 100);
      }
    }

    // Goal-only pledges have no future-task dock, so they bypass the daily
    // early-settle warning. Warn here when the user is settling before the
    // deadline at <100% so unchecked goals / a low slider don't silently
    // reduce their refund.
    const hasDaily = Object.keys(pledge.todos.daily).length > 0;
    const hasGoals = pledge.todos.goals.length > 0;
    const earlyGoalOnly =
      !deadlinePassed && hasGoals && !hasDaily && settlementPct < 100;

    await executeSettlement(settlementPct, futureTasks, earlyGoalOnly);
  };

  const handleEditSave = useCallback(
    async (
      newName: string,
      newTodos: PledgeTodos,
      newReminderSettings: ReminderSettings | null,
    ) => {
      if (!pledge) return;
      // Extend goals_completed if new goals were appended
      const currentGoals = pledge.goals_completed ?? [];
      const goalsGrew = newTodos.goals.length > currentGoals.length;
      const nextGoalsCompleted = goalsGrew
        ? [
            ...currentGoals,
            ...new Array(newTodos.goals.length - currentGoals.length).fill(false),
          ]
        : undefined;
      await updatePledge.mutateAsync({
        pledgeId: pledge.id,
        name: newName,
        todos: newTodos,
        goals_completed: nextGoalsCompleted,
        reminder_settings: newReminderSettings,
      });
      toast({ message: t('Pledge updated successfully'), variant: 'success' });
    },
    [pledge, updatePledge, toast, t],
  );

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
        {pledge.status === 'Active' && (
          <Pressable
            onPress={() => editSheetRef.current?.expand()}
            style={[
              styles.editButton,
              { backgroundColor: theme.colors.cardBackground },
            ]}
          >
            <Ionicons
              name='create-outline'
              size={20}
              color={theme.colors.text}
            />
          </Pressable>
        )}
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
              {(() => {
                const tr = formatTimeRemaining(pledge.deadline, t);
                return (
                  <View style={styles.timeRemainingRight}>
                    <Body
                      style={
                        tr.isPastDue ? { color: theme.colors.error } : undefined
                      }
                    >
                      {tr.text}
                    </Body>
                    {tr.isPastDue && (
                      <Pressable
                        onPress={() => graceSheetRef.current?.expand()}
                        hitSlop={8}
                      >
                        <Ionicons
                          name='information-circle-outline'
                          size={18}
                          color={theme.colors.error}
                        />
                      </Pressable>
                    )}
                  </View>
                );
              })()}
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
              disabled={pledge.status !== 'Active' || isCompletionBusy}
            />
            <BodySmallSecondary>
              {t('Reflects progress up to today and does not account for future tasks')}
            </BodySmallSecondary>
          </View>

          {/* Today's daily tasks */}
          {dailyTasks.length > 0 && (
            <Column gap={8}>
              <Title3 style={{ marginBottom: 8 }}>{t("Today's Tasks")}</Title3>
              {dailyTasks.map((taskText, index) => {
                const completed = completedTodos.includes(index);
                return (
                  <Pressable
                    key={`daily-${index}`}
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
                    disabled={pledge.status !== 'Active' || isCompletionBusy}
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

          {/* Goals (one-time, persist across all dates) */}
          {goals.length > 0 && (
            <Column gap={8}>
              <Title3 style={{ marginBottom: 8 }}>{t('One-time goals')}</Title3>
              {goals.map((goalText, index) => {
                const completed = completedGoals[index] ?? false;
                return (
                  <Pressable
                    key={`goal-${index}`}
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
                    onPress={() => handleGoalToggle(index)}
                    disabled={pledge.status !== 'Active' || isCompletionBusy}
                  >
                    <Checkbox checked={completed} />
                    <Ionicons
                      name='flag-outline'
                      size={16}
                      color={theme.colors.primary}
                    />
                    <Body
                      style={{
                        flex: 1,
                        textDecorationLine: completed ? 'line-through' : 'none',
                        opacity: completed ? 0.6 : 1,
                      }}
                    >
                      {goalText}
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
            {progress === 100
              ? t('Claim Your Pledge')
              : new Date(pledge.deadline) <= new Date()
              ? t('Report Completion')
              : t('Settle Early')}
          </PrimaryButton>
        </CenteredColumn>
      )}

      {pledge.status === 'Active' && (
        <EditPledgeSheet
          ref={editSheetRef}
          pledge={pledge}
          onSave={handleEditSave}
        />
      )}

      <GracePeriodInfoSheet ref={graceSheetRef} deadline={pledge.deadline} />
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
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
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
  timeRemainingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
