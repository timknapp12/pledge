import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { getStatusBgColor, getStatusTextColor } from '@/theme';
import {
  Title3,
  BodySecondary,
  BodySmall,
  BodySmallSecondary,
  Column,
  Row,
  Card,
  ProgressBar,
} from '@/components';
import {
  formatUsdcAmount,
  getTotalTaskCount,
  getGoals,
  getEffectiveStatus,
  useDailyProgress,
  calculateCompletionPercentage,
  Pledge,
  type PledgeTodos,
} from '@/hooks/useSupabase';

/** If a pledge has exactly 1 task/goal and a date-range name, show the task text instead. */
function getDisplayName(name: string, todos: PledgeTodos): string {
  const goals = getGoals(todos);
  const uniqueDaily = [...new Set(Object.values(todos.daily).flat())];
  const allTasks = [...goals, ...uniqueDaily];
  if (allTasks.length !== 1) return name;
  // Detect auto-generated date-range names (e.g., "Mar 3 - Mar 10")
  if (!name || name.includes(' - ')) return allTasks[0];
  return name;
}

function formatDeadline(deadline: string): string {
  const date = new Date(deadline);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return 'Expired';
  } else if (diffDays === 0) {
    return 'Due today';
  } else if (diffDays === 1) {
    return 'Due tomorrow';
  } else if (diffDays <= 7) {
    return `${diffDays} days left`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

export interface PledgeListItemProps {
  pledge: Pledge;
  onPress: () => void;
  animateKey?: number;
}

export const PledgeListItem = ({
  pledge,
  onPress,
  animateKey,
}: PledgeListItemProps) => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const { data: allProgress } = useDailyProgress(pledge.id);
  const effectiveStatus = getEffectiveStatus(pledge);

  const taskProgress = allProgress
    ? calculateCompletionPercentage(
        pledge.todos,
        allProgress,
        new Date(pledge.start_date),
        new Date(pledge.end_date),
      )
    : 0;

  return (
    <Pressable onPress={onPress}>
      <Card>
        <Row justify='space-between' align='flex-start'>
          <Column flex={1}>
            <Title3>{getDisplayName(pledge.name, pledge.todos)}</Title3>
            <BodySmallSecondary style={{ marginTop: 4 }}>
              {formatDeadline(pledge.deadline)}
            </BodySmallSecondary>
          </Column>
          <View
            style={[
              localStyles.statusBadge,
              { backgroundColor: getStatusBgColor(theme, effectiveStatus) },
            ]}
          >
            <BodySmall
              style={{
                color: getStatusTextColor(theme, effectiveStatus),
                fontWeight: '600',
              }}
            >
              {t(effectiveStatus)}
            </BodySmall>
          </View>
        </Row>

        <Row style={{ marginTop: 12, justifyContent: 'space-between' }}>
          <BodySecondary>
            {t('Pledged')}: ${formatUsdcAmount(pledge.stake_amount)}
          </BodySecondary>
          <BodySmall>
            {pledge.todos ? getTotalTaskCount(pledge.todos) : 0} {t('tasks')}
          </BodySmall>
        </Row>

        <ProgressBar
          progress={taskProgress}
          height={6}
          style={{ marginTop: 12 }}
          animateKey={animateKey}
        />
      </Card>
    </Pressable>
  );
};

const localStyles = StyleSheet.create({
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
});
