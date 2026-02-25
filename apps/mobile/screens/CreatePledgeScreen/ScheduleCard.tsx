import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { Body, BodySecondary, BodySmall, Row } from '@/components';
import { styles } from './styles';

type ScheduleCardProps = {
  startDate: Date;
  endDate: Date;
  formatDate: (date: Date) => string;
  formatTime: (date: Date) => string;
  getDurationLabel: () => string;
  getRemindersLabel: () => string;
  onStartDatePress: () => void;
  onDurationPress: () => void;
  onRemindersPress: () => void;
};

export const ScheduleCard = ({
  startDate,
  endDate,
  formatDate,
  formatTime,
  getDurationLabel,
  getRemindersLabel,
  onStartDatePress,
  onDurationPress,
  onRemindersPress,
}: ScheduleCardProps) => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();

  return (
    <View style={styles.section}>
      <View
        style={[
          styles.scheduleCard,
          { backgroundColor: theme.colors.cardBackground },
        ]}
      >
        {/* Start Date */}
        <Pressable style={styles.scheduleRow} onPress={onStartDatePress}>
          <BodySecondary>{t('Starts')}</BodySecondary>
          <Row gap={8}>
            <View
              style={[
                styles.dateChip,
                { backgroundColor: theme.colors.background },
              ]}
            >
              <Body>{formatDate(startDate)}</Body>
            </View>
            <View
              style={[
                styles.dateChip,
                { backgroundColor: theme.colors.background },
              ]}
            >
              <Body>{formatTime(startDate)}</Body>
            </View>
            <Ionicons
              name='chevron-forward'
              size={16}
              color={theme.colors.textSecondary}
            />
          </Row>
        </Pressable>

        <View
          style={[
            styles.scheduleDivider,
            { backgroundColor: theme.colors.border },
          ]}
        />

        {/* End Date / Duration */}
        <Pressable style={styles.scheduleRow} onPress={onDurationPress}>
          <BodySecondary>{t('Ends')}</BodySecondary>
          <Row gap={8}>
            <View
              style={[
                styles.durationBadge,
                { backgroundColor: theme.colors.primaryAlpha10 },
              ]}
            >
              <BodySmall style={{ color: theme.colors.primary }}>
                {getDurationLabel()}
              </BodySmall>
            </View>
            <View
              style={[
                styles.dateChip,
                { backgroundColor: theme.colors.background },
              ]}
            >
              <Body>{formatDate(endDate)}</Body>
            </View>
            <Ionicons
              name='chevron-forward'
              size={16}
              color={theme.colors.textSecondary}
            />
          </Row>
        </Pressable>

        <View
          style={[
            styles.scheduleDivider,
            { backgroundColor: theme.colors.border },
          ]}
        />

        {/* Reminders */}
        <Pressable
          style={[styles.scheduleRow, styles.scheduleRowReminders]}
          onPress={onRemindersPress}
        >
          <Body style={[styles.summaryLabel, { marginRight: 12 }]}>
            {t('Reminders')}
          </Body>
          <View style={styles.scheduleRowValue}>
            <BodySecondary
              style={[styles.scheduleRowValueText, styles.summaryValueText]}
            >
              {getRemindersLabel()}
            </BodySecondary>
            <View style={styles.scheduleRowChevron}>
              <Ionicons
                name='chevron-forward'
                size={16}
                color={theme.colors.textSecondary}
              />
            </View>
          </View>
        </Pressable>
      </View>
    </View>
  );
};
