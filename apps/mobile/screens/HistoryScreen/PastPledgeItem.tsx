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
import { AnimatedCircularProgress } from '@/components/common/AnimatedCircularProgress';
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
  animateKey?: number;
}

export const PastPledgeItem = ({
  pledge,
  onPress,
  animateKey = 0,
}: PastPledgeItemProps) => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();

  return (
    <Pressable onPress={onPress}>
      <Card style={localStyles.pledgeCard}>
        <Row justify='space-between' align='flex-start'>
          <Column width='auto'>
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

        <Row justify='space-between'>
          <BodySecondary>
            {t('Pledged')}: ${formatUsdcAmount(pledge.stake_amount)}
          </BodySecondary>
          {pledge.completion_percentage !== null && (
            <AnimatedCircularProgress
              progress={pledge.completion_percentage}
              size={48}
              strokeWidth={4}
              showPercentage
              percentageFontSize={12}
              animateKey={animateKey}
              color={theme.colors.primary}
              textColor={theme.colors.text}
            />
          )}
        </Row>
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
