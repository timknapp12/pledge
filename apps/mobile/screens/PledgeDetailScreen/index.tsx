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
  useUpdatePledgeStatus,
  useUpdatePledge,
  calculateCompletionPercentage,
  formatUsdcAmount,
  getDailyTasksForDate,
  getGoals,
  toLocalDateStr,
  type PledgeTodos,
  type DailyProgress,
  type ReminderSettings,
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
  useToast,
} from '@/components';
import { EditPledgeSheet } from '@/components/sheets';
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
  t: (key: string) => string,
): string {
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

/**
 * Calculate completion across the FULL pledge duration (including future tasks).
 * Used for early settlement so future uncompleted tasks reduce the percentage.
 */
function calculateFullDurationCompletion(
  todos: PledgeTodos,
  dailyProgress: DailyProgress[],
  startDate: Date,
  endDate: Date,
): number {
  let totalTasks = 0;
  let completedTasks = 0;

  const todayStr = toLocalDateStr(new Date());

  // Count ALL daily tasks across entire duration
  const currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (currentDate <= end) {
    const dateStr = toLocalDateStr(currentDate);
    const dayTasks = todos.daily[dateStr] || [];
    totalTasks += dayTasks.length;

    // Only count completions for days up to today
    if (dateStr <= todayStr) {
      const dayProgress = dailyProgress.find((p) => p.date === dateStr);
      const completedIndices = dayProgress?.todos_completed ?? [];
      completedTasks += completedIndices.filter(
        (i) => i >= 0 && i < dayTasks.length,
      ).length;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Goals count once
  const goalCount = todos.goals.length;
  if (goalCount > 0) {
    totalTasks += goalCount;
    const todayProgress = dailyProgress.find((p) => p.date === todayStr);
    const todayDayTasks = todos.daily[todayStr] || [];
    const completedIndices = todayProgress?.todos_completed ?? [];
    completedTasks += completedIndices.filter(
      (i) => i >= todayDayTasks.length && i < todayDayTasks.length + goalCount,
    ).length;
  }

  if (totalTasks === 0) return 0;
  return Math.round((completedTasks / totalTasks) * 100);
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
  const updatePledge = useUpdatePledge();
  const editSheetRef = useRef<BottomSheet>(null);

  const { alert } = useAlert();
  const { toast } = useToast();
  const [completedTodos, setCompletedTodos] = useState<number[]>([]);
  const [overrideProgress, setOverrideProgress] = useState<number | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const isCompletionBusy = updateProgress.isPending || isReporting;

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

  const dailyTasks = pledge ? getDailyTasksForDate(pledge.todos, today) : [];
  const goals = pledge ? getGoals(pledge.todos) : [];
  // Combined list: daily tasks first, then goals — indices match todos_completed
  const allTasks = [...dailyTasks, ...goals];

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

  const executeSettlement = async (completionPct: number) => {
    if (!pledge || !walletAddress) return;

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
              // iOS Phantom deep-link returns trigger Expo Router to reset
              // the stack to the home tab. Re-push this screen so the user
              // lands back here to see the settlement result.
              if (Platform.OS === 'ios') {
                router.push({
                  pathname: '/pledge/[id]',
                  params: { id: pledge.id },
                });
              }
              await updatePledgeStatus.mutateAsync({
                pledgeId: pledge.id,
                status: finalStatus,
                completionPercentage: completionPct,
                settleTxSignature: signature,
              });
              refetch();
              toast({
                message: t('Pledge settled successfully'),
                variant: 'success',
              });
            } catch (err: any) {
              console.error('Report and settle error:', err);
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

    const deadlinePassed = new Date(pledge.deadline) <= new Date();

    if (deadlinePassed) {
      // Deadline passed — use normal progress (capped at today)
      await executeSettlement(progress);
      return;
    }

    // Early settlement — check for future tasks
    const futureTasks = countFutureTasks(pledge.todos);

    if (futureTasks === 0) {
      // No future tasks — settle immediately with normal progress
      await executeSettlement(progress);
      return;
    }

    // Future tasks exist — calculate completion across full duration
    const progressWithLocalState = allProgress.map((p) =>
      p.date === today ? { ...p, todos_completed: completedTodos } : p,
    );
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

    const earlyCompletionPct = calculateFullDurationCompletion(
      pledge.todos,
      progressWithLocalState,
      new Date(pledge.start_date),
      new Date(pledge.end_date),
    );

    alert({
      title: t('Settle Early?'),
      message: t(
        'You still have {{count}} tasks scheduled. Settling now means those count as incomplete and will reduce your return.',
        { count: futureTasks },
      ),
      buttons: [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Settle Now'),
          onPress: () => executeSettlement(earlyCompletionPct),
        },
      ],
    });
  };

  const handleEditSave = useCallback(
    async (
      newName: string,
      newTodos: PledgeTodos,
      newReminderSettings: ReminderSettings | null,
    ) => {
      if (!pledge) return;
      await updatePledge.mutateAsync({
        pledgeId: pledge.id,
        name: newName,
        todos: newTodos,
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
              disabled={pledge.status !== 'Active' || isCompletionBusy}
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
