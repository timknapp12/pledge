import { Pressable, View, StyleSheet } from 'react-native';
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
} from '@/components';
import { formatUsdcAmount, Pledge } from '@/hooks/useSupabase';

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
  const { theme } = useAppTheme();

  return (
    <Pressable onPress={onPress}>
      <Card style={localStyles.pledgeCard}>
        <Row
          style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Column style={{ flex: 1 }}>
            <Title3>{pledge.name}</Title3>
            <BodySmallSecondary style={{ marginTop: 4 }}>
              {formatDate(pledge.deadline)}
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
            {t('Staked')}: ${formatUsdcAmount(pledge.stake_amount)}
          </BodySecondary>
          {pledge.completion_percentage !== null && (
            <BodySmall>
              {pledge.completion_percentage}% {t('Completion')}
            </BodySmall>
          )}
        </Row>
      </Card>
    </Pressable>
  );
};

const localStyles = StyleSheet.create({
  pledgeCard: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
});
