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
  const { toast } = useToast();

  // Date state: today or yesterday
  const [showYesterday, setShowYesterday] = useState(false);
  const selectedDate = useMemo(() => {
    const d = new Date();
    if (showYesterday) d.setDate(d.getDate() - 1);
    return toLocalDateStr(d);
  }, [showYesterday]);

  const { data: allProgress } = useAllDailyProgress(selectedDate);

  // Combine daily tasks + goals for a pledge on a given date.
  // Goals only appear on today — they are one-time completions, not daily.
  const todayStr = toLocalDateStr(new Date());
  const getTasksForDate = useCallback(
    (pledge: Pledge, date: string): string[] => {
      const dailyTasks = getDailyTasksForDate(pledge.todos, date);
      const startLocal = toLocalDateStr(new Date(pledge.start_date));
      const endLocal = toLocalDateStr(new Date(pledge.end_date));
      const isWithinRange = date >= startLocal && date <= endLocal;
      const goals = isWithinRange && date === todayStr ? getGoals(pledge.todos) : [];
      return [...dailyTasks, ...goals];
    },
    [todayStr],
  );

  // Check if any pledge has tasks for yesterday (to decide whether to show the toggle)
  const yesterdayDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toLocalDateStr(d);
  }, []);

  const hasYesterdayTasks = useMemo(() => {
    return pledges.some((pledge) => {
      if (getTasksForDate(pledge, yesterdayDate).length > 0) return true;
      // Also count goal-only pledges within range
      const goals = getGoals(pledge.todos);
      if (goals.length === 0) return false;
      const start = toLocalDateStr(new Date(pledge.start_date));
      const end = toLocalDateStr(new Date(pledge.end_date));
      return yesterdayDate >= start && yesterdayDate <= end;
    });
  }, [pledges, yesterdayDate, getTasksForDate]);

  // Build per-pledge task data
  const pledgeTaskData = useMemo(() => {
    return pledges
      .map((pledge) => {
        const tasks = getTasksForDate(pledge, selectedDate);
        const progress = allProgress?.find((p) => p.pledge_id === pledge.id);
        const completed = progress?.todos_completed ?? [];
        return { pledge, tasks, completed };
      })
      .filter((d) => d.tasks.length > 0); // Only pledges with tasks for this date
  }, [pledges, selectedDate, allProgress, getTasksForDate]);

  // Goal-only pledges: have goals but no daily tasks for this date
  const goalOnlyPledges = useMemo(() => {
    const startLocal = (p: Pledge) => toLocalDateStr(new Date(p.start_date));
    const endLocal = (p: Pledge) => toLocalDateStr(new Date(p.end_date));
    return pledges.filter((pledge) => {
      const hasTasks = getTasksForDate(pledge, selectedDate).length > 0;
      if (hasTasks) return false; // already in pledgeTaskData
      const goals = getGoals(pledge.todos);
      if (goals.length === 0) return false;
      const inRange =
        selectedDate >= startLocal(pledge) && selectedDate <= endLocal(pledge);
      return inRange;
    });
  }, [pledges, selectedDate, getTasksForDate]);

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

  const handleSelectAll = useCallback(
    async (pledgeId: string, taskCount: number, currentCompleted: number[]) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      const allSelected = currentCompleted.length === taskCount;
      const newCompleted = allSelected
        ? []
        : Array.from({ length: taskCount }, (_, i) => i);

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

  const noTasksForSelectedDate =
    pledgeTaskData.length === 0 && goalOnlyPledges.length === 0;

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
      {pledgeTaskData.map(({ pledge, tasks, completed }) => {
        const allDone = completed.length === tasks.length && tasks.length > 0;
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
                  {completed.length}/{tasks.length} {t('done')}
                </BodySmallSecondary>
              </Column>
              <Row gap={8} width='auto'>
                {/* Select all / deselect all */}
                <Pressable
                  onPress={() =>
                    handleSelectAll(pledge.id, tasks.length, completed)
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

            {/* Task list */}
            {tasks.map((taskText, index) => {
              const isCompleted = completed.includes(index);
              return (
                <Pressable
                  key={index}
                  style={[
                    styles.taskRow,
                    {
                      backgroundColor: isCompleted
                        ? theme.colors.primaryAlpha10
                        : 'transparent',
                    },
                  ]}
                  onPress={() => handleToggle(pledge.id, index, completed)}
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

      {/* Goal-only pledges — no daily tasks, shown as tappable reminder cards */}
      {goalOnlyPledges.map((pledge) => {
        const goals = getGoals(pledge.todos);
        return (
          <Pressable
            key={pledge.id}
            onPress={() => router.push(`/pledge/${pledge.id}`)}
          >
            <Card>
              <Row justify='space-between' align='center'>
                <Column flex={1} width='auto'>
                  <Title3 numberOfLines={1}>{getDisplayName(pledge.name, pledge.todos)}</Title3>
                  <BodySmallSecondary style={{ marginTop: 2 }}>
                    {goals.length} {goals.length === 1 ? t('goal') : t('goals')}
                  </BodySmallSecondary>
                </Column>
                <Ionicons
                  name='chevron-forward'
                  size={16}
                  color={theme.colors.textSecondary}
                />
              </Row>
              {goals.map((goal, index) => (
                <Row key={index} gap={8} style={styles.goalRow}>
                  <Ionicons
                    name='flag-outline'
                    size={16}
                    color={theme.colors.primary}
                  />
                  <Body style={{ flex: 1 }}>{goal}</Body>
                </Row>
              ))}
            </Card>
          </Pressable>
        );
      })}
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
  goalRow: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
});
