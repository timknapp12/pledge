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
import { formatUsdcAmount, Pledge } from '@/hooks/useSupabase';

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

export const PledgeListItem = ({ pledge, onPress, animateKey }: PledgeListItemProps) => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();

  // Calculate progress based on time elapsed
  const startDate = new Date(pledge.start_date);
  const endDate = new Date(pledge.deadline);
  const now = new Date();
  const totalDays = Math.max(
    1,
    Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  const elapsedDays = Math.max(
    0,
    Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  const timeProgress = Math.min(
    100,
    Math.round((elapsedDays / totalDays) * 100)
  );

  return (
    <Pressable onPress={onPress}>
      <Card style={localStyles.pledgeCard}>
        <Row
          style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Column flex={1}>
            <Title3>{pledge.name}</Title3>
            <BodySmallSecondary style={{ marginTop: 4 }}>
              {formatDeadline(pledge.deadline)}
            </BodySmallSecondary>
          </Column>
          <View
            style={[
              localStyles.statusBadge,
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

        <Row style={{ marginTop: 12, justifyContent: 'space-between' }}>
          <BodySecondary>
            {t('Pledged')}: ${formatUsdcAmount(pledge.stake_amount)}
          </BodySecondary>
          <BodySmall>
            {pledge.todos?.length || 0} {t('tasks')}
          </BodySmall>
        </Row>

        <ProgressBar progress={timeProgress} height={6} style={{ marginTop: 12 }} animateKey={animateKey} />
      </Card>
    </Pressable>
  );
};

const localStyles = StyleSheet.create({
  pledgeCard: {
    marginBottom: 12,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
});
