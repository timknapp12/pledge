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
  margin: 0 20px 12px 20px;
`;

const StatusBadge = styled.View<{ $status: string }>`
  padding: 4px 8px;
  border-radius: 12px;
  background-color: ${({ theme, $status }) => {
    switch ($status) {
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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export interface PastPledgeItemProps {
  pledge: Pledge;
  onPress: () => void;
}

export const PastPledgeItem = ({ pledge, onPress }: PastPledgeItemProps) => {
  const { t } = useTranslation();

  return (
    <Pressable onPress={onPress}>
      <PledgeCard>
        <Row
          style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Column style={{ flex: 1 }}>
            <Title3>{pledge.name}</Title3>
            <BodySmallSecondary style={{ marginTop: 4 }}>
              {formatDate(pledge.deadline)}
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
          {pledge.completion_percentage !== null && (
            <BodySmall>
              {pledge.completion_percentage}% {t('Completion')}
            </BodySmall>
          )}
        </Row>
      </PledgeCard>
    </Pressable>
  );
};
