import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Title3, Body, BodySecondary, Card } from '@/components';
import { styles } from './styles';

type PledgeSummaryProps = {
  durationLabel: string;
  taskCount: number;
  remindersLabel: string;
  stakeAmount: string;
  goalName?: string;
};

export const PledgeSummary = ({
  durationLabel,
  taskCount,
  remindersLabel,
  stakeAmount,
  goalName,
}: PledgeSummaryProps) => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();

  return (
    <View style={styles.section}>
      <Title3 style={{ marginBottom: 8 }}>{t('Summary')}</Title3>
      <Card style={{ marginTop: 8 }}>
        {goalName && (
          <View
            style={[
              styles.summaryRow,
              { borderBottomColor: theme.colors.border },
            ]}
          >
            <BodySecondary style={styles.summaryLabel}>
              {t('Goal Name')}
            </BodySecondary>
            <View style={styles.summaryValue}>
              <Body style={styles.summaryValueText}>{goalName}</Body>
            </View>
          </View>
        )}
        <View
          style={[styles.summaryRow, { borderBottomColor: theme.colors.border }]}
        >
          <BodySecondary style={styles.summaryLabel}>
            {t('Duration')}
          </BodySecondary>
          <View style={styles.summaryValue}>
            <Body style={styles.summaryValueText}>{durationLabel}</Body>
          </View>
        </View>
        <View
          style={[styles.summaryRow, { borderBottomColor: theme.colors.border }]}
        >
          <BodySecondary style={styles.summaryLabel}>
            {t('Total tasks')}
          </BodySecondary>
          <View style={styles.summaryValue}>
            <Body style={styles.summaryValueText}>{taskCount}</Body>
          </View>
        </View>
        <View
          style={[styles.summaryRow, { borderBottomColor: theme.colors.border }]}
        >
          <BodySecondary style={styles.summaryLabel}>
            {t('Reminders')}
          </BodySecondary>
          <View style={styles.summaryValue}>
            <Body style={styles.summaryValueText}>{remindersLabel}</Body>
          </View>
        </View>
        <View style={[styles.summaryRow, styles.summaryRowLast]}>
          <BodySecondary style={styles.summaryLabel}>
            {t('Stake Amount')}
          </BodySecondary>
          <View style={styles.summaryValue}>
            <Body style={styles.summaryValueText}>
              ${stakeAmount} {t('USDC')}
            </Body>
          </View>
        </View>
      </Card>
    </View>
  );
};
