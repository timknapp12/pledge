import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
} from '@/components';
import {
  type Pledge,
  getDailyTasksForDate,
  getGoals,
  toLocalDateStr,
  useAllDailyProgress,
  useUpdateDailyProgress,
} from '@/hooks/useSupabase';

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
  const localStyles = useMemo(() => createLocalStyles(theme), [theme]);

  // Date state: today or yesterday
  const [showYesterday, setShowYesterday] = useState(false);
  const selectedDate = useMemo(() => {
    const d = new Date();
    if (showYesterday) d.setDate(d.getDate() - 1);
    return toLocalDateStr(d);
  }, [showYesterday]);

  const { data: allProgress } = useAllDailyProgress(selectedDate);

  // Combine daily tasks + goals for a pledge on a given date.
  // Goals show on every date within the pledge's active range.
  const getTasksForDate = useCallback(
    (pledge: Pledge, date: string): string[] => {
      const dailyTasks = getDailyTasksForDate(pledge.todos, date);
      const startLocal = toLocalDateStr(new Date(pledge.start_date));
      const endLocal = toLocalDateStr(new Date(pledge.end_date));
      const isWithinRange = date >= startLocal && date <= endLocal;
      const goals = isWithinRange ? getGoals(pledge.todos) : [];
      return [...dailyTasks, ...goals];
    },
    [],
  );

  // Check if any pledge has tasks for yesterday (to decide whether to show the toggle)
  const yesterdayDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toLocalDateStr(d);
  }, []);

  const hasYesterdayTasks = useMemo(() => {
    return pledges.some(
      (pledge) => getTasksForDate(pledge, yesterdayDate).length > 0,
    );
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
      }
    },
    [selectedDate, updateProgress],
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
      }
    },
    [selectedDate, updateProgress],
  );

  if (pledgeTaskData.length === 0) {
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
          {t('No tasks for this day')}
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
              localStyles.datePill,
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
              localStyles.datePill,
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
              style={localStyles.pledgeHeader}
            >
              <Column flex={1} width='auto'>
                <Title3 numberOfLines={1}>{pledge.name}</Title3>
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
                    localStyles.selectAllButton,
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
                    localStyles.taskRow,
                    {
                      backgroundColor: isCompleted
                        ? theme.colors.primaryAlpha10
                        : 'transparent',
                    },
                  ]}
                  onPress={() => handleToggle(pledge.id, index, completed)}
                >
                  <View
                    style={[
                      localStyles.checkbox,
                      {
                        backgroundColor: isCompleted
                          ? theme.colors.primary
                          : 'transparent',
                      },
                    ]}
                  >
                    {isCompleted && (
                      <Ionicons
                        name='checkmark'
                        size={14}
                        color={theme.colors.iconOnPrimary}
                      />
                    )}
                  </View>
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
    </Column>
  );
};

const createLocalStyles = (theme: ReturnType<typeof useAppTheme>['theme']) =>
  StyleSheet.create({
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
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
