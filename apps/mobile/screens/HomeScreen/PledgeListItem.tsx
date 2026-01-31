import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components/native';
import {
  Title3,
  BodySecondary,
  BodySmall,
  BodySmallSecondary,
  Column,
  Row,
  Card,
} from '@/components';
import { formatUsdcAmount, Pledge } from '@/hooks/useSupabase';

const PledgeCard = styled(Card)`
  margin-bottom: 12px;
`;

const StatusBadge = styled.View<{ $status: string }>`
  padding: 4px 8px;
  border-radius: 12px;
  background-color: ${({ theme, $status }) => {
    switch ($status) {
      case 'Active':
        return theme.colors.primaryAlpha20;
      case 'Completed':
        return theme.colors.statusCompletedBg;
      case 'Forfeited':
        return theme.colors.statusForfeitedBg;
      default:
        return theme.colors.cardBackground;
    }
  }};
`;

const StatusText = styled(BodySmall)<{ $status: string }>`
  color: ${({ theme, $status }) => {
    switch ($status) {
      case 'Active':
        return theme.colors.primary;
      case 'Completed':
        return theme.colors.statusCompleted;
      case 'Forfeited':
        return theme.colors.statusForfeited;
      default:
        return theme.colors.text;
    }
  }};
  font-weight: 600;
`;

const ProgressBar = styled.View`
  height: 6px;
  background-color: ${({ theme }) => theme.colors.border};
  border-radius: 3px;
  overflow: hidden;
  margin-top: 12px;
`;

const ProgressFill = styled.View<{ $progress: number }>`
  height: 100%;
  width: ${({ $progress }) => $progress}%;
  background-color: ${({ theme }) => theme.colors.primary};
  border-radius: 3px;
`;

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
}

export const PledgeListItem = ({ pledge, onPress }: PledgeListItemProps) => {
  const { t } = useTranslation();

  // Calculate progress based on time elapsed
  const startDate = new Date(pledge.start_date);
  const endDate = new Date(pledge.deadline);
  const now = new Date();
  const totalDays = Math.max(
    1,
    Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    ),
  );
  const elapsedDays = Math.max(
    0,
    Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const timeProgress = Math.min(
    100,
    Math.round((elapsedDays / totalDays) * 100),
  );

  return (
    <Pressable onPress={onPress}>
      <PledgeCard>
        <Row
          style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Column style={{ flex: 1 }}>
            <Title3>{pledge.name}</Title3>
            <BodySmallSecondary style={{ marginTop: 4 }}>
              {formatDeadline(pledge.deadline)}
            </BodySmallSecondary>
          </Column>
          <StatusBadge $status={pledge.status}>
            <StatusText $status={pledge.status}>{t(pledge.status)}</StatusText>
          </StatusBadge>
        </Row>

        <Row style={{ marginTop: 12, justifyContent: 'space-between' }}>
          <BodySecondary>
            {t('Staked')}: ${formatUsdcAmount(pledge.stake_amount)}
          </BodySecondary>
          <BodySmall>
            {pledge.todos?.length || 0} {t('tasks')}
          </BodySmall>
        </Row>

        <ProgressBar>
          <ProgressFill $progress={timeProgress} />
        </ProgressBar>
      </PledgeCard>
    </Pressable>
  );
};
