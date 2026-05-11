import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Body,
  BodySmall,
  BodySmallSecondary,
  Title3,
  Column,
  Row,
  Card,
  Checkbox,
  useToast,
} from '@/components';
import {
  type Pledge,
  type PledgeTodos,
  getDailyTasksForDate,
  getGoals,
  toLocalDateStr,
  useAllDailyProgress,
  useUpdateDailyProgress,
  useUpdateGoalCompletion,
} from '@/hooks/useSupabase';

/** If a pledge has exactly 1 task/goal and a date-range name, show the task text instead. */
const getDisplayName = (name: string, todos: PledgeTodos): string => {
  const goals = getGoals(todos);
  const uniqueDaily = [...new Set(Object.values(todos.daily).flat())];
  const allTasks = [...goals, ...uniqueDaily];
  if (allTasks.length !== 1) return name;
  if (!name || name.includes(' - ')) return allTasks[0];
  return name;
};

interface DailyTasksViewProps {
  pledges: Pledge[];
}

const formatDateLabel = (date: Date): string => {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
};

export const DailyTasksView = ({ pledges }: DailyTasksViewProps) => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const router = useRouter();
  const updateProgress = useUpdateDailyProgress();
  const updateGoal = useUpdateGoalCompletion();
  const { toast } = useToast();

  // Date state: today or yesterday
  const [showYesterday, setShowYesterday] = useState(false);
  const selectedDate = useMemo(() => {
    const d = new Date();
    if (showYesterday) d.setDate(d.getDate() - 1);
    return toLocalDateStr(d);
  }, [showYesterday]);

  const { data: allProgress } = useAllDailyProgress(selectedDate);

  // Daily tasks are date-specific; goals are per-pledge and shown on any
  // in-range date so completion state is visible/editable from any tab.
  const isDateInPledgeRange = useCallback((pledge: Pledge, date: string) => {
    const startLocal = toLocalDateStr(new Date(pledge.start_date));
    const endLocal = toLocalDateStr(new Date(pledge.end_date));
    return date >= startLocal && date <= endLocal;
  }, []);

  // Check if any pledge has tasks for yesterday (to decide whether to show the toggle)
  const yesterdayDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toLocalDateStr(d);
  }, []);

  const hasYesterdayTasks = useMemo(() => {
    return pledges.some((pledge) => {
      if (!isDateInPledgeRange(pledge, yesterdayDate)) return false;
      if (getDailyTasksForDate(pledge.todos, yesterdayDate).length > 0) return true;
      return getGoals(pledge.todos).length > 0;
    });
  }, [pledges, yesterdayDate, isDateInPledgeRange]);

  // Per-pledge data for the selected date: daily tasks (date-scoped) + goals (per-pledge)
  const pledgeTaskData = useMemo(() => {
    return pledges
      .map((pledge) => {
        const dailyTasks = getDailyTasksForDate(pledge.todos, selectedDate);
        const goals = isDateInPledgeRange(pledge, selectedDate)
          ? getGoals(pledge.todos)
          : [];
        const progress = allProgress?.find((p) => p.pledge_id === pledge.id);
        const completedDaily = (progress?.todos_completed ?? []).filter(
          (i) => i >= 0 && i < dailyTasks.length,
        );
        return { pledge, dailyTasks, goals, completedDaily };
      })
      .filter((d) => d.dailyTasks.length > 0 || d.goals.length > 0);
  }, [pledges, selectedDate, allProgress, isDateInPledgeRange]);

  const handleToggle = useCallback(
    async (pledgeId: string, taskIndex: number, currentCompleted: number[]) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      const newCompleted = currentCompleted.includes(taskIndex)
        ? currentCompleted.filter((i) => i !== taskIndex)
        : [...currentCompleted, taskIndex];

      try {
        await updateProgress.mutateAsync({
          pledgeId,
          date: selectedDate,
          todosCompleted: newCompleted,
        });
      } catch (err) {
        console.error('Failed to update progress:', err);
        toast({ message: t("Couldn't save progress. Please try again."), variant: 'error' });
      }
    },
    [selectedDate, updateProgress, toast, t],
  );

  const handleGoalToggle = useCallback(
    async (pledge: Pledge, goalIndex: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const current = pledge.goals_completed ?? [];
      const next = [...current];
      while (next.length <= goalIndex) next.push(false);
      next[goalIndex] = !next[goalIndex];
      try {
        await updateGoal.mutateAsync({ pledgeId: pledge.id, goalsCompleted: next });
      } catch (err) {
        console.error('Failed to update goal:', err);
        toast({ message: t("Couldn't save progress. Please try again."), variant: 'error' });
      }
    },
    [updateGoal, toast, t],
  );

  // Select-all toggles every visible item on the card: daily tasks for the
  // selected date AND the per-pledge goals. Two writes: daily_progress + pledges.
  const handleSelectAll = useCallback(
    async (
      pledge: Pledge,
      dailyTaskCount: number,
      currentCompletedDaily: number[],
      goalCount: number,
    ) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      const currentGoals = pledge.goals_completed ?? [];
      const dailyAllDone =
        dailyTaskCount === 0 || currentCompletedDaily.length === dailyTaskCount;
      const goalsAllDone =
        goalCount === 0 ||
        Array.from({ length: goalCount }, (_, i) => currentGoals[i] ?? false).every(Boolean);
      const allDone = dailyAllDone && goalsAllDone;

      const newCompleted = allDone
        ? []
        : Array.from({ length: dailyTaskCount }, (_, i) => i);
      const newGoals = (() => {
        const next = [...currentGoals];
        while (next.length < goalCount) next.push(false);
        for (let i = 0; i < goalCount; i++) next[i] = !allDone;
        return next;
      })();

      try {
        const writes: Promise<unknown>[] = [];
        if (dailyTaskCount > 0) {
          writes.push(
            updateProgress.mutateAsync({
              pledgeId: pledge.id,
              date: selectedDate,
              todosCompleted: newCompleted,
            }),
          );
        }
        if (goalCount > 0) {
          writes.push(
            updateGoal.mutateAsync({ pledgeId: pledge.id, goalsCompleted: newGoals }),
          );
        }
        await Promise.all(writes);
      } catch (err) {
        console.error('Failed to update progress:', err);
        toast({ message: t("Couldn't save progress. Please try again."), variant: 'error' });
      }
    },
    [selectedDate, updateProgress, updateGoal, toast, t],
  );

  const noTasksForSelectedDate = pledgeTaskData.length === 0;

  if (noTasksForSelectedDate && !hasYesterdayTasks) {
    return (
      <Column
        gap={12}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <Ionicons
          name='checkmark-circle-outline'
          size={48}
          color={theme.colors.textSecondary}
        />
        <Body style={{ color: theme.colors.textSecondary }}>
          {t(!showYesterday ? 'No tasks for today' : 'No tasks for this day')}
        </Body>
      </Column>
    );
  }

  return (
    <Column gap={12} flex={1}>
      {/* Date toggle — only show if yesterday has tasks */}
      {hasYesterdayTasks && (
        <Row width='100%' justify='center' gap={8}>
          <Pressable
            style={[
              styles.datePill,
              {
                backgroundColor: !showYesterday
                  ? theme.colors.primary
                  : theme.colors.cardBackground,
              },
            ]}
            onPress={() => setShowYesterday(false)}
          >
            <BodySmall
              style={{
                color: !showYesterday
                  ? theme.colors.iconOnPrimary
                  : theme.colors.textSecondary,
                fontWeight: '600',
              }}
            >
              {t('Today')}
            </BodySmall>
          </Pressable>
          <Pressable
            style={[
              styles.datePill,
              {
                backgroundColor: showYesterday
                  ? theme.colors.primary
                  : theme.colors.cardBackground,
              },
            ]}
            onPress={() => setShowYesterday(true)}
          >
            <BodySmall
              style={{
                color: showYesterday
                  ? theme.colors.iconOnPrimary
                  : theme.colors.textSecondary,
                fontWeight: '600',
              }}
            >
              {t('Yesterday')}
            </BodySmall>
          </Pressable>
        </Row>
      )}

      <BodySmallSecondary style={{ textAlign: 'center' }}>
        {formatDateLabel(
          showYesterday
            ? new Date(new Date().setDate(new Date().getDate() - 1))
            : new Date(),
        )}
      </BodySmallSecondary>

      {/* Per-pledge task groups */}
      {pledgeTaskData.map(({ pledge, dailyTasks, goals, completedDaily }) => {
        const goalsCompleted = pledge.goals_completed ?? [];
        const goalDoneCount = Array.from(
          { length: goals.length },
          (_, i) => goalsCompleted[i] ?? false,
        ).filter(Boolean).length;
        const totalCount = dailyTasks.length + goals.length;
        const totalDone = completedDaily.length + goalDoneCount;
        const allDone = totalCount > 0 && totalDone === totalCount;
        return (
          <Card key={pledge.id}>
            {/* Pledge header — tappable to go to detail */}
            <Pressable
              onPress={() => router.push(`/pledge/${pledge.id}`)}
              style={styles.pledgeHeader}
            >
              <Column flex={1} width='auto'>
                <Title3 numberOfLines={1}>{getDisplayName(pledge.name, pledge.todos)}</Title3>
                <BodySmallSecondary>
                  {totalDone}/{totalCount} {t('done')}
                </BodySmallSecondary>
              </Column>
              <Row gap={8} width='auto'>
                {/* Select all / deselect all — toggles daily + goals together */}
                <Pressable
                  onPress={() =>
                    handleSelectAll(pledge, dailyTasks.length, completedDaily, goals.length)
                  }
                  style={[
                    styles.selectAllButton,
                    {
                      backgroundColor: allDone
                        ? theme.colors.statusCompleted
                        : theme.colors.primaryAlpha40,
                    },
                  ]}
                >
                  <Ionicons
                    name={allDone ? 'checkmark-done' : 'checkmark-done-outline'}
                    size={18}
                    color={
                      allDone
                        ? theme.colors.background
                        : theme.colors.textSecondary
                    }
                  />
                </Pressable>
                <Ionicons
                  name='chevron-forward'
                  size={16}
                  color={theme.colors.textSecondary}
                />
              </Row>
            </Pressable>

            {/* Daily task list */}
            {dailyTasks.map((taskText, index) => {
              const isCompleted = completedDaily.includes(index);
              return (
                <Pressable
                  key={`daily-${index}`}
                  style={[
                    styles.taskRow,
                    {
                      backgroundColor: isCompleted
                        ? theme.colors.primaryAlpha10
                        : 'transparent',
                    },
                  ]}
                  onPress={() => handleToggle(pledge.id, index, completedDaily)}
                >
                  <Checkbox checked={isCompleted} />
                  <Body
                    style={{
                      flex: 1,
                      textDecorationLine: isCompleted ? 'line-through' : 'none',
                      opacity: isCompleted ? 0.6 : 1,
                    }}
                  >
                    {taskText}
                  </Body>
                </Pressable>
              );
            })}

            {/* Goals subsection (per-pledge, visible on any in-range tab) */}
            {goals.length > 0 && (
              <>
                {dailyTasks.length > 0 && (
                  <BodySmallSecondary style={styles.goalsLabel}>
                    {t('One-time goals')}
                  </BodySmallSecondary>
                )}
                {goals.map((goalText, index) => {
                  const isCompleted = goalsCompleted[index] ?? false;
                  return (
                    <Pressable
                      key={`goal-${index}`}
                      style={[
                        styles.taskRow,
                        {
                          backgroundColor: isCompleted
                            ? theme.colors.primaryAlpha10
                            : 'transparent',
                        },
                      ]}
                      onPress={() => handleGoalToggle(pledge, index)}
                    >
                      <Checkbox checked={isCompleted} />
                      <Ionicons
                        name='flag-outline'
                        size={16}
                        color={theme.colors.primary}
                      />
                      <Body
                        style={{
                          flex: 1,
                          textDecorationLine: isCompleted ? 'line-through' : 'none',
                          opacity: isCompleted ? 0.6 : 1,
                        }}
                      >
                        {goalText}
                      </Body>
                    </Pressable>
                  );
                })}
              </>
            )}
          </Card>
        );
      })}

      {/* Inline empty state when toggle is visible but selected date has no tasks */}
      {noTasksForSelectedDate && (
        <Column
          gap={12}
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 32 }}
        >
          <Ionicons
            name='checkmark-circle-outline'
            size={48}
            color={theme.colors.textSecondary}
          />
          <Body style={{ color: theme.colors.textSecondary }}>
            {t(!showYesterday ? 'No tasks for today' : 'No tasks for this day')}
          </Body>
        </Column>
      )}
    </Column>
  );
};

const styles = StyleSheet.create({
  datePill: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  pledgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  selectAllButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginBottom: 2,
  },
  goalsLabel: {
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 4,
    fontWeight: '600',
  },
});
