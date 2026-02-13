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
          <BodySecondary>{t('Duration')}</BodySecondary>
          <Body>{durationLabel}</Body>
        </View>
        <View
          style={[styles.summaryRow, { borderBottomColor: theme.colors.border }]}
        >
          <BodySecondary>{t('Total tasks')}</BodySecondary>
          <Body>{todoCount}</Body>
        </View>
        <View
          style={[styles.summaryRow, { borderBottomColor: theme.colors.border }]}
        >
          <BodySecondary>{t('Reminders')}</BodySecondary>
          <Body>{remindersLabel}</Body>
        </View>
        <View style={[styles.summaryRow, styles.summaryRowLast]}>
          <BodySecondary>{t('Stake Amount')}</BodySecondary>
          <Body>
            ${stakeAmount} {t('USDC')}
          </Body>
        </View>
      </Card>
    </View>
  );
};
