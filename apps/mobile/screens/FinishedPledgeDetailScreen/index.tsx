import { ActivityIndicator, Pressable, ScrollView, View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { getStatusBgColor, getStatusTextColor } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  usePledge,
  useDailyProgress,
  formatUsdcAmount,
  getDailyTasksForDate,
  getGoals,
  calculateCompletionPercentage,
} from '@/hooks/useSupabase';
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
  CenteredColumn,
  ErrorState,
} from '@/components';
import { ProgressBar } from '@/components/common/ProgressBar';
import { ExplorerWebView } from './ExplorerWebView';

function formatDeadline(deadline: string): string {
  const date = new Date(deadline);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export const FinishedPledgeDetailScreen = () => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const {
    data: pledge,
    isLoading: pledgeLoading,
    isError,
    error,
    refetch,
  } = usePledge(id);
  const { data: allProgress, isLoading: progressLoading } =
    useDailyProgress(id);

  // Compute final completion from daily progress if completion_percentage not stored
  const completionPct = (() => {
    if (pledge?.completion_percentage !== null && pledge?.completion_percentage !== undefined) {
      return pledge.completion_percentage;
    }
    if (!pledge || !allProgress) return 0;
    return calculateCompletionPercentage(
      pledge.todos,
      allProgress,
      new Date(pledge.start_date),
      new Date(pledge.end_date),
    );
  })();

  // Build a set of all completed task indices across all days
  const completedIndicesPerDay = new Map<string, number[]>();
  if (allProgress) {
    for (const p of allProgress) {
      completedIndicesPerDay.set(p.date, p.todos_completed);
    }
  }

  // Get all unique daily dates and goals
  const dailyDates = pledge ? Object.keys(pledge.todos.daily).sort() : [];
  const goals = pledge ? getGoals(pledge.todos) : [];

  // For display: show the last day's tasks as representative, plus goals
  const lastDate = dailyDates.length > 0 ? dailyDates[dailyDates.length - 1] : null;
  const representativeTasks = lastDate && pledge
    ? getDailyTasksForDate(pledge.todos, lastDate)
    : [];

  // Calculate per-day completion for a summary
  const totalDays = dailyDates.length;
  const daysFullyCompleted = dailyDates.filter((date) => {
    const dayTasks = pledge ? getDailyTasksForDate(pledge.todos, date) : [];
    const completed = completedIndicesPerDay.get(date) ?? [];
    return dayTasks.length > 0 && completed.filter((i) => i < dayTasks.length).length === dayTasks.length;
  }).length;

  // Goal completion: stored in last day's progress after daily task indices
  const lastDayTasks = lastDate && pledge ? getDailyTasksForDate(pledge.todos, lastDate) : [];
  const lastDayCompleted = lastDate ? (completedIndicesPerDay.get(lastDate) ?? []) : [];
  const completedGoalIndices = lastDayCompleted.filter(
    (i) => i >= lastDayTasks.length && i < lastDayTasks.length + goals.length,
  );

  // Fallback: if completion is 100% but no daily_progress records, treat all tasks as done
  const allDoneByPercentage = completionPct === 100;

  // Calculate refund amount
  const refundAmount = pledge
    ? Math.round(
        pledge.stake_amount *
          (completionPct / 100) *
          (completionPct === 100 ? 1 : 0.99),
      )
    : 0;

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

      <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
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
              <BodySecondary>{t('Completion')}</BodySecondary>
              <Body style={{ color: theme.colors.primary }}>{completionPct}%</Body>
            </View>
            <View style={styles.infoRow}>
              <BodySecondary>{t('Refund')}</BodySecondary>
              <Body style={{ color: refundAmount > 0 ? theme.colors.primary : theme.colors.error }}>
                ${formatUsdcAmount(refundAmount)} {t('USDC')}
              </Body>
            </View>
            {totalDays > 0 && (
              <View style={styles.infoRow}>
                <BodySecondary>{t('Days Completed')}</BodySecondary>
                <Body>{daysFullyCompleted}/{totalDays}</Body>
              </View>
            )}
          </Card>

          {/* Progress Bar */}
          <Column gap={8}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Title3>{t('Progress')}</Title3>
              <Title3 style={{ color: theme.colors.primary }}>{completionPct}%</Title3>
            </Row>
            <ProgressBar progress={completionPct} height={8} />
          </Column>

          {/* Tasks Summary */}
          {(representativeTasks.length > 0 || goals.length > 0) && (
            <Column gap={8}>
              <Title3 style={{ marginBottom: 8 }}>{t('Tasks')}</Title3>

              {/* Daily tasks */}
              {representativeTasks.map((taskText, index) => {
                // Check how many days this task was completed across all days
                const taskCompletedDays = dailyDates.filter((date) => {
                  const completed = completedIndicesPerDay.get(date) ?? [];
                  return completed.includes(index);
                }).length;
                const allDone = allDoneByPercentage || taskCompletedDays === totalDays;

                return (
                  <View
                    key={`daily-${index}`}
                    style={[
                      styles.taskItem,
                      {
                        backgroundColor: allDone
                          ? theme.colors.primaryAlpha10
                          : theme.colors.cardBackground,
                        borderColor: allDone
                          ? theme.colors.primaryAlpha40
                          : theme.colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={allDone ? 'checkmark-circle' : 'close-circle'}
                      size={24}
                      color={allDone ? theme.colors.primary : theme.colors.error}
                    />
                    <Column flex={1} gap={2}>
                      <Body
                        style={{
                          opacity: allDone ? 0.6 : 1,
                          textDecorationLine: allDone ? 'line-through' : 'none',
                        }}
                      >
                        {taskText}
                      </Body>
                      <BodySmallSecondary>
                        {taskCompletedDays}/{totalDays} {t('days')}
                      </BodySmallSecondary>
                    </Column>
                  </View>
                );
              })}

              {/* Goals */}
              {goals.map((goalText, index) => {
                const done = allDoneByPercentage || completedGoalIndices.includes(lastDayTasks.length + index);
                return (
                  <View
                    key={`goal-${index}`}
                    style={[
                      styles.taskItem,
                      {
                        backgroundColor: done
                          ? theme.colors.primaryAlpha10
                          : theme.colors.cardBackground,
                        borderColor: done
                          ? theme.colors.primaryAlpha40
                          : theme.colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={done ? 'checkmark-circle' : 'close-circle'}
                      size={24}
                      color={done ? theme.colors.primary : theme.colors.error}
                    />
                    <Column flex={1} gap={2}>
                      <Body
                        style={{
                          opacity: done ? 0.6 : 1,
                          textDecorationLine: done ? 'line-through' : 'none',
                        }}
                      >
                        {goalText}
                      </Body>
                      <BodySmallSecondary>{t('Goal')}</BodySmallSecondary>
                    </Column>
                  </View>
                );
              })}
            </Column>
          )}

          {/* Transaction */}
          {pledge.settle_tx_signature && (
            <Column gap={8}>
              <Title3>{t('Transaction')}</Title3>
              <ExplorerWebView txSignature={pledge.settle_tx_signature} />
            </Column>
          )}
        </Column>
      </ScrollView>
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
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
});
