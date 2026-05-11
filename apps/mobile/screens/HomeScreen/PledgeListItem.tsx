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

function formatDeadline(deadline: string, t: (key: string) => string): string {
  const date = new Date(deadline);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return t('Expired');
  } else if (diffDays === 0) {
    return t('Due today');
  } else if (diffDays === 1) {
    return t('Due tomorrow');
  } else if (diffDays <= 7) {
    return `${diffDays} ${t('days left')}`;
  } else {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}

export interface PledgeListItemProps {
  pledge: Pledge;
  completionProgress: number;
  onPress: () => void;
  animateKey?: number;
}

export const PledgeListItem = ({
  pledge,
  completionProgress,
  onPress,
  animateKey,
}: PledgeListItemProps) => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const effectiveStatus = getEffectiveStatus(pledge, completionProgress);
  const badgeLabel =
    effectiveStatus === 'AwaitingClaim'
      ? t('Ready to claim')
      : t(effectiveStatus);

  return (
    <Pressable onPress={onPress}>
      <Card>
        <Row justify='space-between' align='flex-start'>
          <Column flex={1}>
            <Title3>{getDisplayName(pledge.name, pledge.todos)}</Title3>
            <BodySmallSecondary style={{ marginTop: 4 }}>
              {formatDeadline(pledge.deadline, t)}
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
              {badgeLabel}
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
          progress={completionProgress}
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
