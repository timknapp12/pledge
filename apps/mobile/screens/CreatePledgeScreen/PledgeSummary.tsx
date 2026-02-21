import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Title3, Body, BodySecondary, Card } from '@/components';
import { styles } from './styles';

type PledgeSummaryProps = {
  durationLabel: string;
  todoCount: number;
  remindersLabel: string;
  stakeAmount: string;
};

export const PledgeSummary = ({
  durationLabel,
  todoCount,
  remindersLabel,
  stakeAmount,
}: PledgeSummaryProps) => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();

  return (
    <View style={styles.section}>
      <Title3 style={{ marginBottom: 8 }}>{t('Summary')}</Title3>
      <Card style={{ marginTop: 8 }}>
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
            <Body style={styles.summaryValueText}>{todoCount}</Body>
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
